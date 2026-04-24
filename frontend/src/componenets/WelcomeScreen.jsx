export default function WelcomeScreen({ onBegin, posesLoaded }) {
  return (
    <div className="welcome">
      <div className="welcome__inner">
        {/* Floating lotus */}
        <div className="welcome__lotus">🪷</div>
        {/* Heading */}
        <h1 className="welcome__title">SOKRATES</h1>
        <p className="welcome__subtitle">Mind · Body · Wisdom</p>
        {/* Info card */}
        <div className="welcome__card">
          <p className="welcome__card-greeting">Welcome, dear student.</p>
          <p className="welcome__card-body">
           We ,team Night's Watch believes that friction is not always the enemy —
            sometimes it is precisely what gives life its deepest flavor. It is
            the resistance that sharpens your mind, strengthens your learning,
            and makes every small victory worth smiling about. We focus on two
            meaningful forms of friction: <strong>cognitive</strong> and{" "}
            <strong>physical</strong>. And so, before we engage the mind —
            let us first awaken the body.
          </p>
          <p className="welcome__card-body">
            You will be guided through a short <strong>Yoga</strong> pose. Hold
            it steadily at <strong>≥80% accuracy</strong> for{" "}
            <strong>10 seconds</strong> to unlock the dialogue that follows.
          </p>
        </div>
        {/* CTA */}
        <button
          className="welcome__btn"
          onClick={onBegin}
          disabled={!posesLoaded}
        >
          {posesLoaded ? "Begin Practice →" : "Loading poses…"}
        </button>
        <p className="welcome__hint">
          Please ensure your camera is enabled before the yoga session begins.
        </p>
      </div>
    </div>
  );
}