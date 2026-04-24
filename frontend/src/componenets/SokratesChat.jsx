import { useEffect, useState } from "react";

export default function SokratesChat() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // ── Load Gradio Script ──
    const script = document.createElement("script");
    script.type = "module";
    script.src = "https://gradio.s3-us-west-2.amazonaws.com/6.13.0/gradio.js";
    script.async = true;
    document.head.appendChild(script);

    // Event listener for Gradio custom element
    const handleLoad = () => setLoaded(true);
    window.addEventListener("gradio-load", handleLoad);

    return () => {
      window.removeEventListener("gradio-load", handleLoad);
      // Optional: don't remove script to allow caching if user toggles views
    };
  }, []);

  return (
    <div className="sk-chat">
      {/* Branded top bar */}
      <div className="sk-chat__topbar">
        <div className="sk-chat__brand">
          <div className="sk-chat__avatar">🏛️</div>
          <div className="sk-chat__brand-text">
            <span className="sk-chat__brand-name">Sokrates</span>
            <span className="sk-chat__brand-sub">Philosophy AI · Sanctuary Mode</span>
          </div>
        </div>
        <div className="sk-chat__status">
          <span className={`sk-chat__status-dot${loaded ? " is-ready" : ""}`} />
          {loaded ? "Ready" : "Connecting…"}
        </div>
      </div>

      {/* Chat Area */}
      <div className="sk-chat__body">
        {/* Loading overlay */}
        {!loaded && (
          <div className="sk-chat__loader">
            <span className="sk-chat__loader-icon">🌿</span>
            <span className="sk-chat__loader-text">Opening your sanctuary…</span>
          </div>
        )}

        <div className="chat-wrapper">
          <gradio-app
            src="https://niloy64-sokrates.hf.space"
            theme_mode="light" 
            show_footer="false"
            container="false"
            style={{ display: loaded ? "block" : "none" }}
          ></gradio-app>
        </div>
      </div>
    </div>
  );
}