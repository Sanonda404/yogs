import SokratesChat from "./SokratesChat";

const formatTimer = (secs) =>
  `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

export default function ChatScreen({ session, scoreHistory, chatTimer, onManualYoga }) {
  return (
    <div className="chat-screen">

      {/* Shared header */}
      <header className="sk-header">
        <div className="sk-header__right">
          <span className="sk-badge sk-badge--timer">
            🧘 Yoga in <strong>&nbsp;{formatTimer(chatTimer)}</strong>
          </span>
          <span className="sk-badge sk-badge--points">
            ✨ <strong>{session.total_points} pts</strong>
          </span>
        </div>
      </header>

      {/* Chat body — SokratesChat fills all remaining height */}
      <div className="chat-screen__body">
        <SokratesChat />
      </div>

      {/* Manual yoga break — fixed bottom-right */}
      <button className="chat-screen__yoga-btn" onClick={onManualYoga}>
        🧘 Take a Yoga Break
      </button>

      {/* Score history — fixed bottom-left, only shown after ≥1 pose */}
      {scoreHistory.length > 0 && (
        <div className="chat-screen__history">
          <div className="chat-screen__history-title">🏅 Session History</div>
          {scoreHistory.slice(-5).map((h, i) => (
            <div key={i} className="chat-screen__history-row">
              <span>{h.pose}</span>
              <span className="chat-screen__history-score">
                {h.score.toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}