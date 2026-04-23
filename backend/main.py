"""
Yoga Pose Trainer — FastAPI WebSocket Backend
Run: uvicorn main:app --reload --host 0.0.0.0 --port 8000
"""

import asyncio
import base64
import json
import os
import uvicorn
import time

import cv2
import mediapipe as mp
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="Yoga Pose Trainer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── MediaPipe Model ───────────────────────────────────────────────────────────
MODEL_PATH = "pose_landmarker_full.task"
_base   = python.BaseOptions(model_asset_path=MODEL_PATH)
_opts   = vision.PoseLandmarkerOptions(base_options=_base)
LANDMARKER = vision.PoseLandmarker.create_from_options(_opts)

# ── Constants ─────────────────────────────────────────────────────────────────
JOINT_ANGLES = {
    "Left Elbow":     (11, 13, 15),
    "Right Elbow":    (12, 14, 16),
    "Left Shoulder":  (13, 11, 23),
    "Right Shoulder": (14, 12, 24),
    "Left Hip":       (11, 23, 25),
    "Right Hip":      (12, 24, 26),
    "Left Knee":      (23, 25, 27),
    "Right Knee":     (24, 26, 28),
    "Left Ankle":     (25, 27, 31),
    "Right Ankle":    (26, 28, 32),
}

STABILITY_JOINTS = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]
STABILITY_FRAMES = 10          # slightly more frames = more confidence before locking
STABILITY_THRESH = 0.045       # ↑ was 0.022 — tolerates gentle air / micro-trembles
RESET_THRESH     = 0.072       # ↑ was 0.035 — only resets on intentional large movement
EMA_ALPHA        = 0.40        # EMA smoothing factor (lower = smoother, more lag)
PROC_W, PROC_H   = 480, 360

CONNECTIONS = [
    (11,12),(11,13),(13,15),(12,14),(14,16),
    (11,23),(12,24),(23,24),
    (23,25),(25,27),(24,26),(26,28),
    (27,29),(27,31),(28,30),(28,32),
]

# ── Reward / level config ─────────────────────────────────────────────────────
PASS_THRESHOLD = 80.0        # accuracy % required to advance

def accuracy_to_points(score: float) -> int:
    """Award bonus points scaled to accuracy above threshold."""
    if score >= 95:  return 100
    if score >= 90:  return 80
    if score >= 85:  return 60
    if score >= 80:  return 40
    return 0

# ── Pose library ──────────────────────────────────────────────────────────────
def load_library():
    library, ref_b64 = {}, {}
    kpt_dir = "pose_keypoints"
    img_dir = "refImg"

    if not os.path.exists(kpt_dir):
        raise RuntimeError("pose_keypoints/ folder not found.")

    img_map = {}
    if os.path.exists(img_dir):
        for fname in os.listdir(img_dir):
            stem = os.path.splitext(fname)[0].lower()
            img_map[stem] = os.path.join(img_dir, fname)

    for fname in sorted(os.listdir(kpt_dir)):
        if not fname.endswith(".npy"):
            continue
        stem         = os.path.splitext(fname)[0]
        display_name = stem.replace("_", " ").title()
        kpts         = np.load(os.path.join(kpt_dir, fname))
        library[display_name] = kpts

        img_path = img_map.get(stem.lower())
        if img_path:
            img = cv2.imread(img_path)
            if img is not None:
                _, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 85])
                ref_b64[display_name] = base64.b64encode(buf).decode()

    return library, ref_b64

POSE_LIBRARY, REF_IMAGES_B64 = load_library()
POSE_NAMES = list(POSE_LIBRARY.keys())
if not POSE_NAMES:
    raise RuntimeError("No poses loaded from pose_keypoints/")

# ── Math helpers ──────────────────────────────────────────────────────────────
def calc_angle(a, b, c):
    a, b, c = np.array(a), np.array(b), np.array(c)
    ba, bc  = a - b, c - b
    cos     = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc) + 1e-6)
    return float(np.degrees(np.arccos(np.clip(cos, -1.0, 1.0))))

def normalize_kpts(kpts):
    hip   = (kpts[23, :2] + kpts[24, :2]) / 2
    k     = kpts.copy()
    k[:, :2] -= hip
    torso = np.linalg.norm((kpts[11, :2] + kpts[12, :2]) / 2 - hip)
    if torso > 0:
        k[:, :2] /= torso
    return k

def is_visible(kpts, a, b, c, thr=0.4):
    return kpts[a,2] > thr and kpts[b,2] > thr and kpts[c,2] > thr

def compute_accuracy(ref, user, tol=15):
    scores, tips = [], []
    for joint, (a, b, c) in JOINT_ANGLES.items():
        if not is_visible(ref, a, b, c):
            continue
        if not is_visible(user, a, b, c):
            scores.append(0.0)
            tips.append(f"{joint}: not detected — show full body")
            continue
        ref_ang  = calc_angle(ref[a,:2],  ref[b,:2],  ref[c,:2])
        user_ang = calc_angle(user[a,:2], user[b,:2], user[c,:2])
        diff     = abs(ref_ang - user_ang)
        score    = 100.0 if diff <= tol else max(0.0, 100.0 - (diff - tol) * 2.5)
        scores.append(score)
        if score < 60:
            hint = "bend more" if user_ang < ref_ang else "straighten"
            tips.append(f"{joint}: {hint} ({diff:.0f}° off)")
    overall = float(np.mean(scores)) if scores else 0.0
    return overall, tips

def landmark_movement(prev, curr):
    diffs = [np.linalg.norm(curr[j,:2] - prev[j,:2])
             for j in STABILITY_JOINTS
             if prev[j,2] > 0.4 and curr[j,2] > 0.4]
    return float(np.mean(diffs)) if diffs else 1.0

def smooth_landmarks(prev_smooth: np.ndarray | None, curr: np.ndarray) -> np.ndarray:
    """Exponential moving average on x,y coordinates to kill micro-jitter.
    Visibility is NOT smoothed — we always use the raw value for detection."""
    if prev_smooth is None:
        return curr.copy()
    smoothed = curr.copy()
    smoothed[:, :2] = EMA_ALPHA * curr[:, :2] + (1 - EMA_ALPHA) * prev_smooth[:, :2]
    return smoothed

def draw_skeleton(frame, landmarks):
    h, w = frame.shape[:2]
    pts  = [(int(lm.x * w), int(lm.y * h)) for lm in landmarks]
    for a, b in CONNECTIONS:
        if landmarks[a].visibility > 0.4 and landmarks[b].visibility > 0.4:
            cv2.line(frame, pts[a], pts[b], (100, 255, 100), 2)
    for idx, pt in enumerate(pts):
        vis = landmarks[idx].visibility
        if vis > 0.4:
            col = (0, 200, 255) if vis > 0.6 else (0, 140, 255)
            cv2.circle(frame, pt, 5, col, -1)

def make_session():
    return {
        "state":           "adjusting",
        "still_count":     0,
        "locked_score":    0.0,
        "locked_feedback": [],
        "prev_kpts":       None,   # raw previous frame keypoints (for movement delta)
        "smooth_kpts":     None,   # EMA-smoothed keypoints (for accuracy & stability)
        "current_level":   0,
        "selected_pose":   None,   # None = follow level order; string = user choice
        "total_points":    0,
        "level_passed":    False,
    }

# ── REST: pose list ───────────────────────────────────────────────────────────
@app.get("/poses")
def get_poses():
    """Return pose names and their base64 reference images."""
    return {
        "poses": [
            {
                "name": name,
                "ref_image": REF_IMAGES_B64.get(name)
            }
            for name in POSE_NAMES
        ]
    }

# ── WebSocket: frame processing ───────────────────────────────────────────────
# 1. Add a frame counter outside the function or in session

FPS_LIMIT = 10
FRAME_INTERVAL = 1.0 / FPS_LIMIT
INFERENCE_SKIP = 3   # run inference every 3 frames

@app.websocket("/ws/yoga")
async def yoga_ws(ws: WebSocket):
    await ws.accept()
    session = make_session()

    last_time = 0
    frame_count = 0
    last_payload = None

    try:
        while True:
            # 🔥 FPS throttling
            now = time.time()
            if now - last_time < FRAME_INTERVAL:
                await asyncio.sleep(0.001)
                continue
            last_time = now

            raw = await ws.receive_text()
            msg = json.loads(raw)
            action = msg.get("action", "frame")

            # ───────── CONTROL ACTIONS ─────────
            if action == "retry":
                session.update({
                    "state": "adjusting",
                    "still_count": 0,
                    "level_passed": False,
                    "smooth_kpts": None
                })
                await ws.send_text(json.dumps({"type": "session", "session": _session_summary(session)}))
                continue

            if action == "next_level":
                if session["current_level"] < len(POSE_NAMES) - 1:
                    session["current_level"] += 1
                session.update({
                    "state": "adjusting",
                    "still_count": 0,
                    "level_passed": False,
                    "smooth_kpts": None,
                    "selected_pose": None
                })
                await ws.send_text(json.dumps({"type": "session", "session": _session_summary(session)}))
                continue

            if action == "select_pose":
                chosen = msg.get("pose")
                if chosen in POSE_LIBRARY:
                    session.update({
                        "selected_pose": chosen,
                        "state": "adjusting",
                        "still_count": 0,
                        "level_passed": False,
                        "smooth_kpts": None
                    })
                await ws.send_text(json.dumps({"type": "session", "session": _session_summary(session)}))
                continue

            # ───────── FRAME PROCESSING ─────────
            frame_b64 = msg.get("frame")
            pose_name = (
                session["selected_pose"]
                or msg.get("pose")
                or POSE_NAMES[session["current_level"]]
            )

            if not frame_b64 or pose_name not in POSE_LIBRARY:
                continue

            # Decode
            img_bytes = base64.b64decode(frame_b64)
            np_arr = np.frombuffer(img_bytes, np.uint8)
            frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
            if frame is None:
                continue

            frame = cv2.flip(frame, 1)

            # 🔥 smaller resolution
            small = cv2.resize(frame, (256, 144))
            rgb = cv2.cvtColor(small, cv2.COLOR_BGR2RGB)
            mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)

            frame_count += 1
            run_inference = (frame_count % INFERENCE_SKIP == 0)

            curr_kpts = None

            if run_inference:
                result = await asyncio.get_event_loop().run_in_executor(
                    None, LANDMARKER.detect, mp_img
                )

                if result.pose_landmarks:
                    landmarks = result.pose_landmarks[0]
                    draw_skeleton(small, landmarks)

                    raw_kpts = np.array([[lm.x, lm.y, lm.visibility] for lm in landmarks])
                    curr_kpts = smooth_landmarks(session["smooth_kpts"], raw_kpts)
                    session["smooth_kpts"] = curr_kpts

            else:
                curr_kpts = session["smooth_kpts"]

            # ───────── STATE MACHINE ─────────
            prev = session["prev_kpts"]

            if curr_kpts is not None and prev is not None:
                movement = landmark_movement(prev, curr_kpts)

                if session["state"] == "adjusting":
                    if movement < STABILITY_THRESH:
                        session["still_count"] += 1
                        session["state"] = "holding"
                    else:
                        session["still_count"] = 0

                elif session["state"] == "holding":
                    if movement < STABILITY_THRESH:
                        session["still_count"] += 1
                        if session["still_count"] >= STABILITY_FRAMES:
                            _lock(session, POSE_LIBRARY[pose_name], curr_kpts)
                    else:
                        session["still_count"] = max(0, session["still_count"] - 2)

                elif session["state"] == "locked":
                    if movement > RESET_THRESH:
                        session.update({
                            "state": "adjusting",
                            "still_count": 0,
                            "level_passed": False,
                            "smooth_kpts": None
                        })

            elif curr_kpts is None and session["state"] != "locked":
                session["state"] = "adjusting"
                session["still_count"] = 0

            # ───────── SCORE (only when needed) ─────────
            if curr_kpts is not None:
                session["prev_kpts"] = curr_kpts

                if run_inference:  # 🔥 compute less often
                    norm = normalize_kpts(curr_kpts)
                    score, feedback = compute_accuracy(POSE_LIBRARY[pose_name], norm)
                    session["live_score"] = score
                    session["live_feedback"] = feedback

            # ───────── ENCODE FRAME (LESS OFTEN) ─────────
            send_frame = (frame_count % 2 == 0)

            frame_out = None
            if send_frame:
                display = cv2.resize(small, (frame.shape[1], frame.shape[0]))
                _, buf = cv2.imencode(".jpg", display, [cv2.IMWRITE_JPEG_QUALITY, 50])
                frame_out = base64.b64encode(buf).decode()

            payload = {
                "type": "frame",
                "frame": frame_out,  # may be None
                "state": session["state"],
                "hold_progress": min(session["still_count"] / STABILITY_FRAMES, 1.0),
                "score": session.get("live_score", 0),
                "feedback": session.get("live_feedback", [])[:4],
                "session": _session_summary(session),
            }

            last_payload = payload
            await ws.send_text(json.dumps(payload))

    except WebSocketDisconnect:
        pass


def _lock(s, ref_kpts, curr_kpts):
    norm              = normalize_kpts(curr_kpts)
    score, feedback   = compute_accuracy(ref_kpts, norm)
    s["locked_score"]    = score
    s["locked_feedback"] = feedback
    s["state"]           = "locked"
    s["still_count"]     = 0
    if score >= PASS_THRESHOLD and not s["level_passed"]:
        pts               = accuracy_to_points(score)
        s["total_points"] += pts
        s["level_passed"]  = True


def _session_summary(s):
    pose_name = s["selected_pose"] or POSE_NAMES[s["current_level"]]
    return {
        "current_level":  s["current_level"],
        "pose_name":      pose_name,
        "selected_pose":  s["selected_pose"],
        "total_points":   s["total_points"],
        "level_passed":   s["level_passed"],
        "total_levels":   len(POSE_NAMES),
    }
    
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=5000, reload=True)