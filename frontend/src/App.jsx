import { useState, useEffect, useRef, useCallback } from "react";
import api, { WS_URL } from "./api"; 
import SokratesChat from "./componenets/SokratesChat"; 
import "./index.css";

const FPS = 12;
const HOLD_THRESHOLD = 80;
const REQUIRED_HOLD_TIME = 10; 
const CHAT_BREAK_MINUTES = 25;

export default function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const wsRef = useRef(null);
  const intervalRef = useRef(null);
  const streamRef = useRef(null);

  // --- Journey State ---
  const [appMode, setAppMode] = useState("yoga"); // 'yoga' or 'chat'
  const [isInitialGreeting, setIsInitialGreeting] = useState(true);
  const [chatTimer, setChatTimer] = useState(CHAT_BREAK_MINUTES * 60);

  // --- Yoga State ---
  const [poses, setPoses] = useState([]);
  const [refImages, setRefImages] = useState({});
  const [selectedPose, setSelectedPose] = useState("Nomoskar");
  const [score, setScore] = useState(0);
  const [holdProgress, setHoldProgress] = useState(0);
  const [feedback, setFeedback] = useState([]);
  const [serverFrame, setServerFrame] = useState(null);
  const [wsReady, setWsReady] = useState(false);
  const [session, setSession] = useState({ total_points: 0 });

  // 1. Load Poses & Map Reference Images
  useEffect(() => {
    api.get("/poses").then(res => {
      setPoses(res.data.poses.map(p => p.name));
      const imgs = {};
      res.data.poses.forEach(p => { if (p.ref_image) imgs[p.name] = p.ref_image; });
      setRefImages(imgs);
    }).catch(err => console.error("Pose fetch failed", err));
  }, []);

  // 2. WebSocket & 10s Hold Logic
  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    ws.onopen = () => setWsReady(true);
    ws.onclose = () => setWsReady(false);

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "frame") {
        setServerFrame(`data:image/jpeg;base64,${msg.frame}`);
        setScore(msg.score || 0);
        setFeedback(msg.feedback || []);

        // Logic: Require 80% accuracy for 10 seconds
        if (msg.score >= HOLD_THRESHOLD) {
          setHoldProgress(prev => {
            const next = prev + (1 / (FPS * REQUIRED_HOLD_TIME));
            if (next >= 1) {
              setAppMode("chat");
              setIsInitialGreeting(false);
              return 0;
            }
            return next;
          });
        } else {
          setHoldProgress(0);
        }
      }
      if (msg.session) setSession(msg.session);
    };
    return () => ws.close();
  }, [appMode]);

  // 3. Camera Setup (Fixing the Black Screen)
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Wait for metadata to load before playing to avoid black frames
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play();
        };
      }
    } catch (err) {
      console.error("Webcam access denied:", err);
    }
  }, []);

  useEffect(() => {
    startCamera();
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      clearInterval(intervalRef.current);
    };
  }, [startCamera]);

  // 4. Processing Loop (Fixing "canvas not defined")
  useEffect(() => {
    if (!wsReady) return;

    intervalRef.current = setInterval(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current; // Define canvas here
      
      if (!video || !canvas || video.readyState < 2) return;

      const ctx = canvas.getContext("2d");
      canvas.width = 480; 
      canvas.height = 360;
      ctx.drawImage(video, 0, 0, 480, 360);
      
      const b64 = canvas.toDataURL("image/jpeg", 0.7).split(",")[1];
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ 
          action: "frame", 
          frame: b64, 
          pose: selectedPose 
        }));
      }
    }, 1000 / FPS);

    return () => clearInterval(intervalRef.current);
  }, [wsReady, selectedPose]);

  // 5. 25-Minute Break Timer
  useEffect(() => {
    let timer;
    if (appMode === "chat") {
      timer = setInterval(() => {
        setChatTimer(prev => {
          if (prev <= 1) {
            setAppMode("yoga");
            return CHAT_BREAK_MINUTES * 60;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [appMode]);
  

  return (
    <div className="yoga-app" style={{ background: "#fdf6ee" }}>
      <canvas ref={canvasRef} style={{ display: "none" }} />
      <video ref={videoRef} style={{ display: "none" }} muted playsInline />

      <header className="header" style={{ padding: '10px 20px', background: '#fff', borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ fontWeight: 'bold' }}>🪷 SOKRATES</div>
        <div style={{ display: 'flex', gap: '15px' }}>
          {appMode === "chat" && <div className="timer">Next Break: {Math.floor(chatTimer/60)}m</div>}
          <div className="pts">✨ {session.total_points} pts</div>
        </div>
      </header>

      {appMode === "yoga" ? (
        <div className="main-grid" style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '20px', padding: '20px' }}>
          <div className="panel" style={{ background: '#fff', padding: '20px', borderRadius: '15px' }}>
            <h2 style={{ fontFamily: 'serif' }}>{isInitialGreeting ? "Welcome" : "Mindful Break"}</h2>
            
            {/* Show Reference Image */}
            <div className="ref-img-wrap" style={{ height: '200px', background: '#eee', borderRadius: '10px', overflow: 'hidden', margin: '15px 0' }}>
              {refImages[selectedPose] && (
                <img 
                  src={`data:image/jpeg;base64,${refImages[selectedPose]}`} 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                  alt="Reference"
                />
              )}
            </div>

            <p>{isInitialGreeting ? "Perform Nomoskar to unlock." : `Time for ${selectedPose}.`}</p>
            
            <div className="hold-bar-wrap" style={{ marginTop: '20px' }}>
              <div style={{ fontSize: '12px', marginBottom: '5px' }}>Stability: {score.toFixed(0)}%</div>
              <div style={{ height: '10px', background: '#eee', borderRadius: '5px' }}>
                <div style={{ width: `${holdProgress * 100}%`, height: '100%', background: '#4CAF50', transition: 'width 0.1s' }} />
              </div>
            </div>

            <div style={{ marginTop: '15px' }}>
              {feedback.map((f, i) => <div key={i} style={{ color: 'red', fontSize: '12px' }}>⚠️ {f}</div>)}
            </div>
          </div>

          <div className="feed-panel" style={{ background: '#000', borderRadius: '15px', overflow: 'hidden', position: 'relative' }}>
            {serverFrame ? (
              <img src={serverFrame} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="AI Feed" />
            ) : (
              <div style={{ color: 'white', display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                Calibrating AI Feed...
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ padding: '20px', height: '80vh' }}>
          <SokratesChat />
          <button 
            onClick={() => setAppMode("yoga")}
            style={{ position: 'fixed', bottom: '30px', right: '30px', padding: '10px 20px', borderRadius: '20px', background: '#3b2f1e', color: 'white', border: 'none', cursor: 'pointer' }}
          >
            🧘 Manual Yoga
          </button>
        </div>
      )}
    </div>
  );
}