import { useState, useEffect, useRef, useCallback } from "react";
import "./index.css";

// ── Config ────────────────────────────────────────────────────────────────────
const WS_URL   = "ws://localhost:5000/ws/yoga";
const REST_URL = "http://localhost:5000/poses";
const FPS      = 12;

// ── Helpers ───────────────────────────────────────────────────────────────────
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const calcPoints = (s) => {
  if (s >= 95) return 100;
  if (s >= 90) return 80;
  if (s >= 85) return 60;
  if (s >= 80) return 40;
  return 0;
};

// ── Sukhasana SVG (level 1 placeholder) ──────────────────────────────────────
function SukhasanaIllustration() {
  return (
    <div className="sukhasana-placeholder">
      <svg
        className="sukhasana-svg"
        width="110" height="148"
        viewBox="0 0 120 160"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Glow halo */}
        <circle cx="60" cy="22" r="22" stroke="#e8b86d" strokeWidth="1.5"
          strokeDasharray="4 3" opacity="0.5"/>
        {/* Head */}
        <circle cx="60" cy="22" r="13" fill="#d4a06a"/>
        {/* Body */}
        <ellipse cx="60" cy="72" rx="17" ry="25" fill="#c98e56"/>
        {/* Left arm */}
        <path d="M44 62 Q24 72 18 86" stroke="#c98e56" strokeWidth="8"
          strokeLinecap="round"/>
        {/* Right arm */}
        <path d="M76 62 Q96 72 102 86" stroke="#c98e56" strokeWidth="8"
          strokeLinecap="round"/>
        {/* Left hand */}
        <circle cx="17" cy="89" r="6" fill="#d4a06a"/>
        {/* Right hand */}
        <circle cx="103" cy="89" r="6" fill="#d4a06a"/>
        {/* Left leg (crossed) */}
        <path d="M44 94 Q30 112 24 132 Q42 140 60 138"
          stroke="#c98e56" strokeWidth="9" strokeLinecap="round" fill="none"/>
        {/* Right leg (crossed) */}
        <path d="M76 94 Q90 112 96 132 Q78 140 60 138"
          stroke="#c98e56" strokeWidth="9" strokeLinecap="round" fill="none"/>
      </svg>
      <span style={{ fontSize:11, color:"var(--text-muted)", fontStyle:"italic" }}>
        Sukhasana — Easy Pose
      </span>
    </div>
  );
}

// ── Accuracy Ring ─────────────────────────────────────────────────────────────
function AccuracyRing({ score, size = 120 }) {
  const r    = (size - 14) / 2;
  const circ = 2 * Math.PI * r;
  const dash = clamp((score / 100) * circ, 0, circ);
  const color =
    score >= 80 ? "var(--sage)"  :
    score >= 60 ? "var(--amber)" : "var(--terra)";
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke="var(--bg-deep)" strokeWidth={9}/>
      <circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth={9}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.5s ease, stroke 0.3s" }}
      />
      <text
        x={size/2} y={size/2}
        className="ring-score-text"
        textAnchor="middle" dominantBaseline="central"
        fill={color} fontSize={size * 0.2} fontWeight="700"
        style={{
          transform: `rotate(90deg)`,
          transformOrigin: `${size/2}px ${size/2}px`,
        }}
      >
        {score.toFixed(0)}%
      </text>
    </svg>
  );
}

// ── Hold Bar ──────────────────────────────────────────────────────────────────
function HoldBar({ progress }) {
  return (
    <div className="hold-bar-wrap">
      <div className="hold-bar-label">
        Stability — {Math.round(clamp(progress, 0, 1) * 100)}%
      </div>
      <div className="hold-bar-track">
        <div className="hold-bar-fill"
          style={{ width: `${clamp(progress * 100, 0, 100)}%` }}/>
      </div>
    </div>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────
function Badge({ points, passed }) {
  if (!passed) return <span className="badge badge-fail">Need 80% to pass</span>;
  if (points >= 100) return <span className="badge badge-perfect">⭐ Perfect</span>;
  if (points >= 80)  return <span className="badge badge-excellent">🏆 Excellent</span>;
  if (points >= 60)  return <span className="badge badge-great">💎 Great</span>;
  return <span className="badge badge-passed">✅ Passed</span>;
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function App() {
  const videoRef    = useRef(null);
  const canvasRef   = useRef(null);
  const wsRef       = useRef(null);
  const intervalRef = useRef(null);
  const streamRef   = useRef(null);
  const prevPassRef = useRef(false);

  const [poses, setPoses]             = useState([]);
  const [refImages, setRefImages]     = useState({});
  const [camReady, setCamReady]       = useState(false);
  const [wsReady, setWsReady]         = useState(false);
  const [serverFrame, setServerFrame] = useState(null);

  const [gameState, setGameState]         = useState("adjusting");
  const [holdProgress, setHoldProgress]   = useState(0);
  const [score, setScore]                 = useState(0);
  const [feedback, setFeedback]           = useState([]);
  const [session, setSession]             = useState({
    current_level: 0, pose_name: "", total_points: 0,
    level_passed: false, total_levels: 0,
  });
  const [justPassed, setJustPassed]       = useState(false);
  const [pointsEarned, setPointsEarned]   = useState(0);
  const [confetti, setConfetti]           = useState([]);
  const [selectedPose, setSelectedPose]   = useState(""); // user-chosen pose

  // ── REST ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(REST_URL)
      .then(r => r.json())
      .then(data => {
        setPoses(data.poses.map(p => p.name));
        const imgs = {};
        data.poses.forEach(p => { if (p.ref_image) imgs[p.name] = p.ref_image; });
        setRefImages(imgs);
      })
      .catch(() => {});
  }, []);

  // ── WebSocket ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    ws.onopen  = () => setWsReady(true);
    ws.onclose = () => setWsReady(false);

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);

      if (msg.type === "frame") {
        setServerFrame(`data:image/jpeg;base64,${msg.frame}`);
        setGameState(msg.state);
        setHoldProgress(msg.hold_progress ?? 0);

        if (msg.state === "locked") {
          const newScore = msg.score ?? 0;
          setScore(newScore);
          setFeedback(msg.feedback ?? []);

          if (msg.session?.level_passed && !prevPassRef.current) {
            const earned = calcPoints(newScore);
            setPointsEarned(earned);
            setJustPassed(true);
            spawnConfetti();
          }
          prevPassRef.current = msg.session?.level_passed ?? false;
        }
        if (msg.session) setSession(msg.session);
      }

      if (msg.type === "session") {
        setSession(msg.session);
        if (msg.session?.selected_pose) setSelectedPose(msg.session.selected_pose);
        setJustPassed(false);
        setScore(0);
        setFeedback([]);
        prevPassRef.current = false;
      }
    };

    return () => ws.close();
  }, []);

  // ── Camera ────────────────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" }, audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCamReady(true);
      }
    } catch (err) { alert("Camera access denied: " + err.message); }
  }, []);

  useEffect(() => {
    startCamera();
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      clearInterval(intervalRef.current);
    };
  }, [startCamera]);

  // ── Frame loop ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!camReady || !wsReady) return;
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      const video  = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;
      const ctx = canvas.getContext("2d");
      canvas.width = 480; canvas.height = 360;
      ctx.drawImage(video, 0, 0, 480, 360);
      const b64 = canvas.toDataURL("image/jpeg", 0.7).split(",")[1];
      if (wsRef.current?.readyState === WebSocket.OPEN)
        wsRef.current.send(JSON.stringify({ action: "frame", frame: b64 }));
    }, 1000 / FPS);
    return () => clearInterval(intervalRef.current);
  }, [camReady, wsReady]);

  // ── WS actions ──────────────────────────────────────────────────────────────
  const sendAction = (action) => {
    if (wsRef.current?.readyState === WebSocket.OPEN)
      wsRef.current.send(JSON.stringify({ action }));
    setJustPassed(false);
    setConfetti([]);
  };

  const sendSelectPose = (poseName) => {
    setSelectedPose(poseName);
    if (wsRef.current?.readyState === WebSocket.OPEN)
      wsRef.current.send(JSON.stringify({ action: "select_pose", pose: poseName }));
    setJustPassed(false);
    setConfetti([]);
  };

  // initialise selectedPose once poses are loaded
  useEffect(() => {
    if (poses.length > 0 && !selectedPose) {
      setSelectedPose(poses[0]);
    }
  }, [poses]); // eslint-disable-line

  // ── Confetti ──────────────────────────────────────────────────────────────────
  const spawnConfetti = () => {
    const colors = ["#7aaa7e","#d4820a","#c1623f","#6ba3be","#c9940a","#a78b6a","#e8cc80"];
    const items  = Array.from({ length: 34 }, (_, i) => ({
      id: i, x: Math.random() * 100,
      color: colors[i % colors.length],
      size: 5 + Math.random() * 9,
      delay: Math.random() * 0.7,
      spin:  Math.random() * 360,
      dur:   2.8 + Math.random() * 1.2,
    }));
    setConfetti(items);
    setTimeout(() => setConfetti([]), 4400);
  };

  // ── Derived ───────────────────────────────────────────────────────────────────
  const currentPose = selectedPose || session.pose_name || poses[0] || "Sukhasana";
  const refImg      = refImages[currentPose];
  const isLevel0    = session.current_level === 0;

  const statusClass =
    gameState === "holding"                 ? "holding"     :
    gameState === "locked" && score >= 80   ? "locked-pass" :
    gameState === "locked"                  ? "locked-fail" : "adjusting";

  const statusText =
    gameState === "adjusting" ? "🌿 Get into position & hold still…" :
    gameState === "holding"   ? "🌀 Hold it — locking your pose…"    :
    score >= 80               ? `✨ ${score >= 95 ? "Perfect!" : score >= 85 ? "Excellent!" : "Passed!"}` :
                                `🌱 ${score.toFixed(0)}% accuracy — need 80% to pass`;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="yoga-app">
      <canvas ref={canvasRef} style={{ display:"none" }} />
      <video  ref={videoRef}  style={{ display:"none" }} muted playsInline />

      {/* Confetti */}
      {confetti.map(c => (
        <div key={c.id} className="confetti-piece" style={{
          left: `${c.x}%`, width: c.size, height: c.size,
          background: c.color,
          animationDuration: `${c.dur}s`,
          animationDelay: `${c.delay}s`,
          transform: `rotate(${c.spin}deg)`,
        }}/>
      ))}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="header">
        <div className="header-brand">
          <span className="header-lotus">🪷</span>
          <div>
            <div className="header-title">YogaFlow</div>
            <div className="header-sub">AI Pose Trainer</div>
          </div>
        </div>
        <div className="header-right">
          <div className="pts-chip">
            <span className="pts-icon">✨</span>
            <span className="pts-value">{session.total_points}</span>
            <span className="pts-label">pts</span>
          </div>
          <div className={`status-chip ${wsReady ? "live" : "offline"}`}>
            <span className={`status-dot ${wsReady ? "live" : "offline"}`}/>
            {wsReady ? "Live" : "Offline"}
          </div>
        </div>
      </header>

      {/* ── Level strip ─────────────────────────────────────────────────────── */}
      <div className="level-strip">
        <span className="level-label">
          Level {session.current_level + 1} / {session.total_levels || poses.length}
        </span>
        <div className="level-dots">
          {poses.map((_, i) => (
            <div key={i} className={`level-dot ${
              i < session.current_level   ? "done"    :
              i === session.current_level ? "current" : "future"
            }`}/>
          ))}
        </div>
        <span className="level-pose-name">{currentPose}</span>
      </div>

      {/* ── Main grid ───────────────────────────────────────────────────────── */}
      <div className="main-grid">

        {/* Left — Reference pose */}
        <div className="panel">
          <div className="panel-title">Choose Your Pose</div>

          {/* Pose dropdown */}
          <div className="pose-select-wrap">
            <span className="pose-select-icon">🧘</span>
            <select
              className="pose-select"
              value={selectedPose}
              onChange={e => sendSelectPose(e.target.value)}
            >
              {poses.length === 0 && (
                <option value="">Loading poses…</option>
              )}
              {poses.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <span className="pose-select-arrow">▾</span>
          </div>

          {refImg ? (
            <div className="ref-img-wrap">
              <img className="ref-img"
                src={`data:image/jpeg;base64,${refImg}`}
                alt={currentPose}/>
              <span className="ref-img-badge">{currentPose}</span>
            </div>
          ) : isLevel0 ? (
            <SukhasanaIllustration />
          ) : (
            <div className="ref-img-placeholder">
              <span style={{ fontSize:36 }}>🧘</span>
              <span>No image available</span>
            </div>
          )}

          <div className="pose-name">{currentPose}</div>
          <div className={`pose-status ${statusClass}`}>{statusText}</div>

          {gameState === "holding" && <HoldBar progress={holdProgress}/>}

          {gameState === "locked" && feedback.length > 0 && (
            <div className="feedback-box">
              {feedback.map((tip, i) => (
                <div key={i} className="feedback-item">⚠ {tip}</div>
              ))}
            </div>
          )}
        </div>

        {/* Centre — Live feed */}
        <div className="feed-panel">
          <div className="panel-title">Live Camera</div>
          <div className="feed-outer">
            {serverFrame ? (
              <img className="feed-img" src={serverFrame} alt="live feed"/>
            ) : (
              <div className="feed-placeholder">
                <span className="feed-placeholder-icon">📷</span>
                <span className="feed-placeholder-text">
                  {wsReady ? "Waiting for camera…" : "Connecting to server…"}
                </span>
              </div>
            )}
            {gameState === "locked" && (
              <div className="ring-overlay">
                <AccuracyRing score={score} size={108}/>
              </div>
            )}
          </div>
        </div>

        {/* Right — Score & actions */}
        <div className="panel">
          <div className="panel-title">Your Score</div>

          {gameState === "locked" ? (
            <>
              <div className="ring-center">
                <AccuracyRing score={score} size={148}/>
              </div>
              <div className="badge-row">
                <Badge points={pointsEarned} passed={session.level_passed}/>
              </div>
              {session.level_passed && (
                <div className="pts-earned">+{pointsEarned} pts earned</div>
              )}
              <div className="action-btns">
                <button className="btn-secondary" onClick={() => sendAction("retry")}>
                  🔁 Retry Pose
                </button>
                {session.level_passed &&
                  session.current_level < session.total_levels - 1 && (
                  <button className="btn-primary" onClick={() => sendAction("next_level")}>
                    Next Level →
                  </button>
                )}
                {session.current_level >= session.total_levels - 1 &&
                  session.level_passed && (
                  <div className="all-done">
                    🎉 All levels complete!<br/>
                    Total: <strong>{session.total_points} pts</strong>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="waiting-score">
              <span className={`waiting-icon ${gameState === "holding" ? "pulsing" : ""}`}>
                {gameState === "holding" ? "⏳" : "🧘"}
              </span>
              <span className="waiting-text">
                {gameState === "holding"
                  ? "Almost there — hold still…"
                  : "Strike the pose to get your score"}
              </span>
            </div>
          )}

          <div className="pts-summary">
            <div className="pts-summary-label">Total Points</div>
            <div className="pts-summary-value">{session.total_points}</div>
            <div className="pts-summary-sub">
              Level {session.current_level + 1} of {session.total_levels || poses.length}
            </div>
          </div>
        </div>
      </div>

      {/* ── Pass banner ─────────────────────────────────────────────────────── */}
      {justPassed && (
        <div className="pass-banner" onClick={() => setJustPassed(false)}>
          <span>🏆</span>
          <span>Level Passed! +{pointsEarned} points</span>
          <span>🎉</span>
        </div>
      )}
    </div>
  );
}
