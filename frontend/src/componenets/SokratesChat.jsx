import React, { useState, useEffect, useRef } from "react";

const SokratesChat = () => {
  const [velocity, setVelocity] = useState(0);
  const [isTooFast, setIsTooFast] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const scrollTimeout = useRef(null);

  useEffect(() => {
    // Check if window exists (prevents Vercel/Next.js build errors)
    if (typeof window === "undefined") return;

    const handleWheel = (e) => {
      const currentVelocity = Math.abs(e.deltaY);
      setVelocity(currentVelocity);

      if (currentVelocity > 75) {
        setIsTooFast(true);
      }

      clearTimeout(scrollTimeout.current);
      scrollTimeout.current = setTimeout(() => {
        setIsTooFast(false);
        setVelocity(0);
      }, 1500);
    };

    const handleMouseMove = (e) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener("wheel", handleWheel, { passive: true });
    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("mousemove", handleMouseMove);
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    };
  }, []);

  return (
    <div className="chat-full-container">
      {/* Warning Message */}
      <div className={`scroll-warning ${isTooFast ? "visible" : ""}`}>
        Read genuinely and understand before hurry
      </div>

      {/* Bubble Cursor - Dynamic Styles applied via inline 'style' for performance */}
      <div 
        className={`bubble-cursor ${isTooFast ? "red" : "green"}`}
        style={{ 
          left: mousePos.x, 
          top: mousePos.y,
          transform: `translate(-50%, -50%) scale(${isTooFast ? 1.5 : 1})` 
        }}
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
          <span style={{ color: isTooFast ? "#ff4444" : "#8ba88e" }}>
            {isTooFast ? "Slow Down, Think" : "Sanctuary Mode"}
          </span>
        </div>
      </div>

      <div className="iframe-wrapper">
        <iframe
          src="https://niloy64-sokrates.hf.space/?__theme=dark"
          width="100%"
          height="100%"
          title="Sokrates AI"
          style={{ border: 'none', backgroundColor: '#222425' }}
          allow="accelerometer; ambient-light-sensor; microphone; camera; clipboard-read; clipboard-write"
        ></iframe>
      </div>

      <style>{`
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

        .scroll-warning {
          position: fixed;
          right: 20px;
          top: 50%;
          transform: translateY(-50%) translateX(120%);
          background: #ff4444;
          color: white;
          padding: 16px 24px;
          border-radius: 12px;
          font-family: sans-serif;
          font-weight: 600;
          transition: transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          z-index: 1001;
          pointer-events: none;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        }

        .scroll-warning.visible {
          transform: translateY(-50%) translateX(0);
        }

        .bubble-cursor {
          position: fixed;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          pointer-events: none;
          z-index: 9999;
          transition: background 0.3s ease, border 0.3s ease, width 0.3s ease, height 0.3s ease;
        }

        .bubble-cursor.green {
          background: rgba(139, 168, 142, 0.2);
          border: 2px solid #8ba88e;
        }

        .bubble-cursor.red {
          background: rgba(255, 68, 68, 0.4);
          border: 2px solid #ff4444;
          box-shadow: 0 0 20px rgba(255, 68, 68, 0.6);
        }

        .chat-mini-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 24px;
          background: #1a1b1c;
          border-bottom: 1px solid #333;
        }

        .brand-group { display: flex; align-items: center; gap: 12px; }
        .brand-emoji { font-size: 24px; }
        .brand-name { font-family: serif; color: #fdf6ee; font-weight: bold; font-size: 1.1rem; }
        .brand-sub { font-size: 10px; color: #8ba88e; text-transform: uppercase; letter-spacing: 1px; }

        .status-indicator { font-size: 12px; display: flex; align-items: center; gap: 8px; font-weight: 500; }
        .dot { width: 8px; height: 8px; background: #8ba88e; border-radius: 50%; display: inline-block; box-shadow: 0 0 8px #8ba88e; transition: all 0.3s ease; }
        .dot.danger { background: #ff4444; box-shadow: 0 0 12px #ff4444; transform: scale(1.4); }

        .iframe-wrapper {
          flex: 1;
          width: 100%;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
};

export default SokratesChat;

export default SokratesChat;