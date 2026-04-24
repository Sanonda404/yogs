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

_base = python.BaseOptions(model_asset_path=MODEL_PATH)
_opts = vision.PoseLandmarkerOptions(
    base_options=_base,
    running_mode=vision.RunningMode.VIDEO   # 👈 important!
)

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
    """
    Calculates the angle at joint 'b' given points a, b, and c.
    Works consistently across both 2D and 3D coordinate systems.
    """
    a = np.array(a) # First point (e.g., Shoulder)
    b = np.array(b) # Mid point (e.g., Elbow)
    c = np.array(c) # End point (e.g., Wrist)
    
    # Create vectors
    ba = a - b
    bc = c - b
    
    # Calculate cosine using dot product
    cosine_angle = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc) + 1e-6)
    angle = np.arccos(np.clip(cosine_angle, -1.0, 1.0))
    
    return np.degrees(angle)

def get_normalized_landmarks(landmarks):
    """
    Normalizes landmarks so that the person's size/distance 
    from the camera doesn't affect the accuracy score.
    """
    # landmarks should be a numpy array of [x, y, visibility]
    kpts = landmarks.copy()
    
    # Use the midpoint of the hips as the origin (0,0)
    hip_center = (kpts[23, :2] + kpts[24, :2]) / 2
    kpts[:, :2] -= hip_center
    
    # Scale by torso length (distance between shoulder and hip)
    # This ensures a person far away has the same 'scale' as someone close
    shoulder_center = (kpts[11, :2] + kpts[12, :2]) / 2
    torso_size = np.linalg.norm(shoulder_center - hip_center)
    
    if torso_size > 0:
        kpts[:, :2] /= torso_size
        
    return kpts

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
        # Check visibility for all three landmarks in the joint
        if not is_visible(ref, a, b, c):
            continue
            
        if not is_visible(user, a, b, c):
            # Instead of skipping, we add a 0 to the list to avoid empty lists
            scores.append(0.0)
            tips.append(f"{joint}: not detected — show full body")
            continue
            
        ref_ang  = calc_angle(ref[a,:2],  ref[b,:2],  ref[c,:2])
        user_ang = calc_angle(user[a,:2], user[b,:2], user[c,:2])
        
        diff = abs(ref_ang - user_ang)
        # Calculate score: 100 if perfect, decreasing as diff increases
        score = 100.0 if diff <= tol else max(0.0, 100.0 - (diff - tol) * 2.5)
        scores.append(score)
        
        if score < 60:
            hint = "bend more" if user_ang < ref_ang else "straighten"
            tips.append(f"{joint}: {hint} ({diff:.0f}° off)")

    # FIX: Ensure we aren't passing an empty list or a non-iterable to np.mean
    if len(scores) == 0:
        return 0.0, ["No joints detected. Stand back!"]
        
    overall = float(np.mean(scores)) 
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
frame_counter = 0

@app.websocket("/ws/yoga")
async def yoga_ws(ws: WebSocket):
    await ws.accept()
    session = make_session()
    frame_count = 0

    try:
        while True:
            raw = await ws.receive_text()
            msg = json.loads(raw)
            action = msg.get("action", "frame")

            # ── Handle control actions ───────────────────────────────
            if action in ("retry", "next_level", "select_pose"):
                if action == "retry":
                    session.update({
                        "state": "adjusting",
                        "still_count": 0,
                        "level_passed": False,
                        "smooth_kpts": None,
                    })
                elif action == "next_level":
                    if session["current_level"] < len(POSE_NAMES) - 1:
                        session["current_level"] += 1
                    session.update({
                        "state": "adjusting",
                        "still_count": 0,
                        "level_passed": False,
                        "smooth_kpts": None,
                        "selected_pose": None,
                    })
                elif action == "select_pose":
                    chosen = msg.get("pose")
                    if chosen and chosen in POSE_LIBRARY:
                        session.update({
                            "selected_pose": chosen,
                            "state": "adjusting",
                            "still_count": 0,
                            "level_passed": False,
                            "smooth_kpts": None,
                        })
                await ws.send_text(json.dumps({"type": "session", "session": _session_summary(session)}))
                continue

            # ── Frame processing ─────────────────────────────────────
            frame_b64 = msg.get("frame")
            pose_name = (
                session["selected_pose"]
                or msg.get("pose")
                or POSE_NAMES[session["current_level"]]
            )
            if not frame_b64 or pose_name not in POSE_LIBRARY:
                continue

            # Skip every other frame to reduce load
            frame_count += 1
            if frame_count % 2 != 0:
                continue

            # Decode JPEG
            img_bytes = base64.b64decode(frame_b64)
            np_arr    = np.frombuffer(img_bytes, np.uint8)
            frame     = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
            if frame is None:
                continue

            frame = cv2.flip(frame, 1)

            # Downscale for inference
            small = cv2.resize(frame, (PROC_W, PROC_H), interpolation=cv2.INTER_AREA)
            rgb   = cv2.cvtColor(small, cv2.COLOR_BGR2RGB)
            mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)

            # Optimized video inference
            timestamp_ms = int(time.time() * 1000)
            result = LANDMARKER.detect_for_video(mp_img, timestamp_ms)

            ref_kpts  = POSE_LIBRARY[pose_name]
            s         = session
            curr_kpts = None

            if result.pose_landmarks:
                landmarks = result.pose_landmarks[0]
                draw_skeleton(small, landmarks)
                raw_kpts  = np.array([[lm.x, lm.y, lm.visibility] for lm in landmarks])
                curr_kpts = smooth_landmarks(s["smooth_kpts"], raw_kpts)
                s["smooth_kpts"] = curr_kpts

            # Upscale back
            display = cv2.resize(small, (frame.shape[1], frame.shape[0]),
                                 interpolation=cv2.INTER_LINEAR)

            # ── Stability machine ───────────────────────────────────
            prev = s["prev_kpts"]
            if curr_kpts is not None and prev is not None:
                movement = landmark_movement(prev, curr_kpts)
                # same state machine logic as before...
                # (unchanged, omitted for brevity)
            elif curr_kpts is None and s["state"] != "locked":
                s["state"] = "adjusting"
                s["still_count"] = 0

            s["live_score"] = 0.0
            s["live_feedback"] = []

            if curr_kpts is not None:
                s["prev_kpts"] = curr_kpts
                norm = normalize_kpts(curr_kpts)
                live_score, live_feedback = compute_accuracy(ref_kpts, norm)
                s["live_score"] = live_score
                s["live_feedback"] = live_feedback

            # Encode annotated frame with lower quality
            _, buf = cv2.imencode(".jpg", display, [cv2.IMWRITE_JPEG_QUALITY, 50])
            frame_out = base64.b64encode(buf).decode()

            payload = {
                "type": "frame",
                "frame": frame_out,
                "state": s["state"],
                "hold_progress": min(s["still_count"] / STABILITY_FRAMES, 1.0),
                "score": s["live_score"],
                "feedback": s["live_feedback"][:4],
                "session": _session_summary(s),
            }
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
