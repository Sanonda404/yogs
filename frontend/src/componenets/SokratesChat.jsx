import React, { useState, useEffect, useRef } from "react";

const SokratesChat = () => {
  const [velocity, setVelocity] = useState(0);
  const [isTooFast, setIsTooFast] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const scrollTimeout = useRef(null);

  useEffect(() => {
    const handleWheel = (e) => {
      // Calculate speed based on the deltaY (vertical scroll intensity)
      const currentVelocity = Math.abs(e.deltaY);
      setVelocity(currentVelocity);

      // Trigger warning if velocity exceeds threshold (e.g., 70)
      if (currentVelocity > 70) {
        setIsTooFast(true);
      }

      // Reset the warning after 1.5 seconds of "calm" scrolling
      clearTimeout(scrollTimeout.current);
      scrollTimeout.current = setTimeout(() => {
        setIsTooFast(false);
        setVelocity(0);
      }, 1500);
    };

    const handleMouseMove = (e) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };

    // Add listeners to window to capture intent even over the iframe
    window.addEventListener("wheel", handleWheel, { passive: true });
    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  return (
    <div className="chat-full-container">
      {/* The Warning Message on the rightmost screen */}
      <div className={`scroll-warning ${isTooFast ? "visible" : ""}`}>
        Read genuinely and understand before hurry
      </div>

      {/* The Bubble Cursor */}
      <div 
        className={`bubble-cursor ${isTooFast ? "red" : "green"}`}
        style={{ left: `${mousePos.x}px`, top: `${mousePos.y}px` }}
      />

      <div className="chat-mini-header">
        <div className="brand-group">
          <span className="brand-emoji">🏛️</span>
          <div>
            <div className="brand-name">Sokrates</div>
            <div className="brand-sub">Philosophy AI</div>
          </div>
        </div>
        <div className="status-indicator">
          <span className={`dot ${isTooFast ? "danger" : ""}`}></span> 
          {isTooFast ? "Slow Down, Think" : "Sanctuary Mode"}
        </div>
      </div>

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
        .chat-full-container {
          width: 100vw;
          height: calc(100vh - 70px);
          display: flex;
          flex-direction: column;
          background: #222425;
          position: fixed;
          top: 70px;
          left: 0;
          z-index: 100;
          overflow: hidden;
        }

        /* The Warning Message */
        .scroll-warning {
          position: fixed;
          right: 20px;
          top: 50%;
          transform: translateY(-50%) translateX(100%);
          background: rgba(255, 68, 68, 0.9);
          color: white;
          padding: 15px 25px;
          border-radius: 8px 0 0 8px;
          font-family: sans-serif;
          font-weight: bold;
          transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          z-index: 1000;
          pointer-events: none;
          box-shadow: -5px 0 15px rgba(0,0,0,0.3);
        }
        .scroll-warning.visible {
          transform: translateY(-50%) translateX(0);
        }

        /* The Bubble Cursor */
        .bubble-cursor {
          position: fixed;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          pointer-events: none;
          z-index: 999;
          transform: translate(-50%, -50%);
          transition: background 0.3s ease, transform 0.1s ease;
        }
        .bubble-cursor.green {
          background: rgba(139, 168, 142, 0.4);
          border: 2px solid #8ba88e;
        }
        .bubble-cursor.red {
          background: rgba(255, 68, 68, 0.6);
          border: 2px solid #ff4444;
          width: 40px;
          height: 40px;
          box-shadow: 0 0 20px #ff4444;
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
        .dot { width: 8px; height: 8px; background: #8ba88e; border-radius: 50%; display: inline-block; box-shadow: 0 0 8px #8ba88e; transition: all 0.3s; }
        .dot.danger { background: #ff4444; box-shadow: 0 0 12px #ff4444; scale: 1.5; }

        .iframe-wrapper {
          flex: 1;
          width: 100%;
          border: none;
        }

        iframe {
          background-color: #222425;
        }
      `}} />
    </div>
  );
};

export default SokratesChat;
