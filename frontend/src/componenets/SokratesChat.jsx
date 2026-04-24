import React from "react";
const SokratesChat = () => {
return (
<div className="chat-full-container">
{/* Mini Header to keep the brand visible without taking much space */}
<div className="chat-mini-header">
<div className="brand-group">
<span className="brand-emoji">🏛️</span>
<div>
<div className="brand-name">Sokrates</div>
<div className="brand-sub">Philosophy AI</div>
</div>
</div>
<div className="status-indicator">
<span className="dot"></span> Sanctuary Mode
</div>
</div>
code
Code
<div className="iframe-wrapper">
    <iframe
      src="https://niloy64-sokrates.hf.space/?__theme=dark"
      frameBorder="0"
      width="100%"
      height="100%"
      title="Sokrates AI"
      allow="accelerometer; ambient-light-sensor; microphone; camera; clipboard-read; clipboard-write"
    ></iframe>
  </div>

  <style dangerouslySetInnerHTML={{ __html: `
    /* Remove padding from the parent to ensure full width */
    .chat-full-container {
      width: 100vw;
      height: calc(100vh - 70px); /* Adjust based on your App header height */
      display: flex;
      flex-direction: column;
      background: #222425;
      position: fixed;
      top: 70px; /* Shifts it below your App.jsx main header */
      left: 0;
      z-index: 100;
    }

    .chat-mini-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 24px;
      background: #1a1b1c;
      border-bottom: 1px solid #333;
    }

    .brand-group { display: flex; align-items: center; gap: 12px; }
    .brand-emoji { font-size: 24px; }
    .brand-name { font-family: serif; color: #fdf6ee; font-weight: bold; }
    .brand-sub { font-size: 10px; color: #8ba88e; text-transform: uppercase; letter-spacing: 1px; }

    .status-indicator { color: #8ba88e; font-size: 12px; display: flex; align-items: center; gap: 6px; }
    .dot { width: 8px; height: 8px; background: #8ba88e; border-radius: 50%; display: inline-block; box-shadow: 0 0 8px #8ba88e; }

    .iframe-wrapper {
      flex: 1; /* Takes all remaining height */
      width: 100%;
      border: none;
    }

    /* Ensure the Gradio app inside the iframe feels integrated */
    iframe {
      background-color: #222425;
    }
  `}} />
</div>
);
};
