import React, { useEffect } from "react";

const SokratesChat = () => {
  useEffect(() => {
    // Load the Gradio script dynamically
    const script = document.createElement("script");
    script.type = "module";
    script.src = "https://gradio.s3-us-west-2.amazonaws.com/6.13.0/gradio.js";
    document.body.appendChild(script);

    return () => {
      // Cleanup script on unmount if necessary
      document.body.removeChild(script);
    };
  }, []);

  return (
    <div className="chat-wrapper-container">
      <div className="chat-header">
        <span className="chat-icon">🏛️</span>
        <h2>Sokrates Philosophy AI</h2>
      </div>
      
      <div className="gradio-frame">
        <gradio-app
          src="https://niloy64-sokrates.hf.space"
          theme_mode="dark"
          show_footer="false"
          container="false"
        ></gradio-app>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .chat-wrapper-container {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 20px;
          animation: fadeIn 0.8s ease-out;
        }

        .chat-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
        }

        .chat-header h2 {
          font-family: var(--font-display);
          color: var(--text-primary);
          font-size: 28px;
          margin: 0;
        }

        .gradio-frame {
          width: 100%;
          max-width: 1000px;
          height: 80vh;
          box-shadow: var(--shadow-cozy);
          border-radius: var(--radius-lg);
          background: #222425; /* Keep dark for the philosophy vibe */
          border: 4px solid var(--surface);
          overflow: hidden;
        }

        gradio-app {
          --text-sm: 16px !important;
          --text-md: 18px !important;
          --text-lg: 22px !important;
          --input-text-size: 18px !important;
          --button-large-text-size: 18px !important;
          --primary-500: #8ba88e !important; /* Changed to your Sage color */
          border-radius: 20px !important;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </div>
  );
};

export default SokratesChat;