export default function YogaPosesScreen({
  isFirstPose,
  selectedPose,
  refImages,
  score,
  holdProgress,
  feedback,
  serverFrame,
  session,
  scoreHistory,
  wsReady,
  onSkipToChat,
}) {
  const pct      = Math.round(holdProgress * 100);
  const holdSecs = Math.round(holdProgress * 10);
  const isGood   = score >= 80;

  return (
    <div className="yoga">
      {/* ── Header ── */}
      <header className="sk-header">
        <div className="sk-header__logo">
          <span className="sk-header__logo-icon">🪷</span>
          SOKRATES
        </div>
        <div className="sk-header__right">
          {!isFirstPose && (
            <span className="sk-badge sk-badge--break">🧘 Yoga Break</span>
          )}
          <span className="sk-badge sk-badge--points">
            <strong>{session.total_points} pts</strong>
          </span>
        </div>
      </header>

      {/* ── Main grid ── */}
      <div className="yoga__grid">

        {/* ── Left column ── */}
        <div className="yoga__left">

          {/* Title card */}
          <div className="sk-card">
            <p className="yoga__title-label">
              {isFirstPose ? "Welcome Pose" : "Mindful Break"}
            </p>
            <h2 className="yoga__title-pose">{selectedPose}</h2>
            <p className="yoga__title-desc">
              {isFirstPose
                ? "Perform this pose to unlock your dialogue with Sokrates."
                : "A short break to reconnect with your body. Hold steadily to continue."}
            </p>
          </div>

          {/* Reference image – fixed 4:3 ratio, never resizes */}
          <div className="yoga__ref-img">
            {refImages[selectedPose] ? (
              <img
                src={`data:image/jpeg;base64,${refImages[selectedPose]}`}
                alt={`Reference: ${selectedPose}`}
              />
            ) : (
              <div className="yoga__ref-img-empty">
                <span style={{ fontSize: "36px" }}>🧘</span>
                <span>Reference loading…</span>
              </div>
            )}
            <div className="yoga__ref-badge">Reference pose</div>
          </div>

          {/* Score & hold card */}
          <div className="sk-card">
            <div className="yoga__score-row">

              {/* Accuracy ring */}
              <div className={`yoga__score-ring${isGood ? " is-good" : ""}`}>
                <span className="yoga__score-number">{score.toFixed(0)}</span>
                <span className="yoga__score-unit">%</span>
              </div>

              {/* Hold bar */}
              <div className="yoga__hold-info">
                <div className="yoga__hold-labels">
                  <span>Hold progress</span>
                  <span className={`yoga__hold-secs${isGood ? " is-good" : ""}`}>
                    {holdSecs}/10s
                  </span>
                </div>
                <div className="yoga__hold-track">
                  <div
                    className={`yoga__hold-fill${isGood ? " is-good" : ""}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className={`yoga__hold-status${isGood ? " is-good" : ""}`}>
                  {isGood
                    ? pct >= 100
                      ? "🎉 Pose complete!"
                      : "✓ Keep holding…"
                    : score > 0
                      ? "Need ≥ 80% accuracy to start timer"
                      : wsReady
                        ? "Calibrating…"
                        : "Connecting…"}
                </div>
              </div>
            </div>

            {/* Feedback */}
            {feedback.length > 0 && (
              <div className="yoga__feedback">
                {feedback.map((f, i) => (
                  <div key={i} className="yoga__feedback-item">
                    <span>⚠️</span>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Score history */}
          {scoreHistory.length > 0 && (
            <div className="sk-card" style={{ padding: "16px 20px" }}>
              <p className="yoga__history-label">Session history</p>
              {scoreHistory.map((h, i) => (
                <div key={i} className="yoga__history-row">
                  <span>{h.pose}</span>
                  <span className="yoga__history-score">{h.score.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Camera feed – RIGHT panel ── */}
        {/*
          The panel fills the grid cell via CSS (min-height: 0).
          yoga__feed-img-wrap is position:absolute inset:0, so the image
          always matches the panel exactly — no jumping or resizing.
        */}
        <div className="yoga__feed-panel">
          <div className="yoga__feed-img-wrap">
            {serverFrame ? (
              <img src={serverFrame} alt="AI pose feed" />
            ) : (
              <div className="yoga__feed-empty">
                <span className="yoga__feed-empty-icon">📷</span>
                <span className="yoga__feed-empty-text">
                  {wsReady ? "Waiting for camera…" : "Connecting to server…"}
                </span>
              </div>
            )}
          </div>

          {/* Live dot badge */}
          {wsReady && (
            <div className="yoga__feed-badge">
              <span className="yoga__feed-live-dot" />
              AI LIVE
            </div>
          )}

          {/* Score overlay */}
          {score > 0 && (
            <div className={`yoga__feed-score${isGood ? " is-good" : ""}`}>
              {score.toFixed(0)}%
            </div>
          )}

          {/* Bottom hold-progress bar */}
          {isGood && holdProgress > 0 && (
            <div className="yoga__feed-progress-track">
              <div
                className="yoga__feed-progress-fill"
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}