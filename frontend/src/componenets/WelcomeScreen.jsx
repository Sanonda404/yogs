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
            Before we begin our conversation, let us first bring awareness to
            the body. A clear mind begins with a pleasent body.
          </p>
          <p className="welcome__card-body">
            You will be guided through a short{" "}
            <strong>Yoga</strong> pose. Hold it steadily at {`>=`} 80% accuracy
            for 10 seconds to unlock the dialogue.
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

        <p className="welcome__hint">Make sure your camera is enabled</p>
      </div>
    </div>
  );
}