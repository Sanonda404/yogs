import { useState, useEffect, useRef, useCallback } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import api, { WS_URL } from "./api";
import SokratesChat from "./componenets/SokratesChat";
import YogaPosesScreen from "./componenets/YogaPosesScreen";
import ChatScreen from "./componenets/ChatScreen";
import WelcomeScreen from "./componenets/WelcomeScreen";

const FPS                = 12;
const HOLD_THRESHOLD     = 80;
const REQUIRED_HOLD_TIME = 10;
const CHAT_BREAK_MINUTES = 25;

export default function App() {
  const navigate = useNavigate();
  const location = useLocation(); // Track the current route

  const videoRef    = useRef(null);
  const canvasRef   = useRef(null);
  const wsRef       = useRef(null);
  const intervalRef = useRef(null);
  const streamRef   = useRef(null);

  const [poses, setPoses]             = useState([]);
  const [refImages, setRefImages]     = useState({});
  const [posesLoaded, setPosesLoaded] = useState(false);
  const [isFirstPose, setIsFirstPose] = useState(true);
  const [selectedPose, setSelectedPose] = useState("Nomoskar");
  const [score, setScore]               = useState(0);
  const [holdProgress, setHoldProgress] = useState(0);
  const [feedback, setFeedback]         = useState([]);
  const [serverFrame, setServerFrame]   = useState(null);
  const [wsReady, setWsReady]           = useState(false);
  const [session, setSession]           = useState({ total_points: 0 });
  const [scoreHistory, setScoreHistory] = useState([]);
  const [chatTimer, setChatTimer] = useState(CHAT_BREAK_MINUTES * 60);

  useEffect(() => {
  api.get("/poses")
    .then(res => {
      const list = res.data.poses.map(p => p.name);
      setPoses(list);
      
      const imgs = {};
      res.data.poses.forEach(p => { 
        if (p.ref_image) imgs[p.name] = p.ref_image; 
      });
      setRefImages(imgs);
      setPosesLoaded(true);

      // FIX: If no pose is selected yet, default to the first one in the list
      if (list.length > 0) {
        setSelectedPose(list[0]); 
      }
    })
    .catch(err => console.error("Pose fetch failed", err));
}, []);

  // ── WebSocket logic ──
  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    ws.onopen  = () => setWsReady(true);
    ws.onclose = () => setWsReady(false);

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "frame") {
        setServerFrame(`data:image/jpeg;base64,${msg.frame}`);
        setScore(msg.score || 0);
        setFeedback(msg.feedback || []);

        if (msg.score >= HOLD_THRESHOLD) {
          setHoldProgress(prev => {
            const next = prev + (1 / (FPS * REQUIRED_HOLD_TIME));
            if (next >= 1) {
              setScoreHistory(h => [...h, {
                pose: selectedPose,
                score: msg.score,
                ts: new Date().toLocaleTimeString(),
              }]);
              setIsFirstPose(false);
              navigate("/chat");
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
  }, [selectedPose, navigate]);

  // ── Updated Camera setup: Start/Stop based on Route ──
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => videoRef.current.play();
      }
    } catch (err) {
      console.error("Webcam access denied:", err);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      // Loop through tracks and stop them to turn off the light
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    // Only turn on camera if the user is on the /yoga page
    if (location.pathname === "/yoga") {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
      clearInterval(intervalRef.current);
    };
  }, [location.pathname, startCamera, stopCamera]); // Monitor route changes

  // ── Frame-sending loop ──
  useEffect(() => {
    if (!wsReady || location.pathname !== "/yoga") return;

    intervalRef.current = setInterval(() => {
      const video  = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;

      const ctx = canvas.getContext("2d");
      canvas.width  = 480;
      canvas.height = 360;
      ctx.drawImage(video, 0, 0, 480, 360);

      const b64 = canvas.toDataURL("image/jpeg", 0.7).split(",")[1];
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ action: "frame", frame: b64, pose: selectedPose }));
      }
    }, 1000 / FPS);

    return () => clearInterval(intervalRef.current);
  }, [wsReady, selectedPose, location.pathname]);

  // ── Break timer ──
  useEffect(() => {
    if (location.pathname !== "/chat") return;

    const timer = setInterval(() => {
      setChatTimer(prev => {
        if (prev <= 1) {
          const others = poses.filter(p => p !== "Nomoskar");
          const next = others.length > 0
            ? others[Math.floor(Math.random() * others.length)]
            : "Nomoskar";
          setSelectedPose(next);
          navigate("/yoga");
          return CHAT_BREAK_MINUTES * 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [poses, navigate, location.pathname]);

  const handleManualYoga = () => {
    const others = poses.filter(p => p !== "Nomoskar");
    const next = others.length > 0
      ? others[Math.floor(Math.random() * others.length)]
      : "Nomoskar";
    setIsFirstPose(false);
    setSelectedPose(next);
    setHoldProgress(0);
    setScore(0);
    setFeedback([]);
    setServerFrame(null);
    navigate("/yoga");
  };

  return (
    <>
      <canvas ref={canvasRef} style={{ display: "none" }} />
      <video  ref={videoRef}  style={{ display: "none" }} muted playsInline />

      <Routes>
        <Route path="/" element={<WelcomeScreen posesLoaded={posesLoaded} onBegin={() => { setSelectedPose("Nomoskar"); navigate("/yoga"); }} />} />
        <Route path="/yoga" element={<YogaPosesScreen isFirstPose={isFirstPose} selectedPose={selectedPose} setSelectedPose={setSelectedPose} // Pass the state setter
      poses={poses} refImages={refImages} score={score} holdProgress={holdProgress} feedback={feedback} serverFrame={serverFrame} session={session} scoreHistory={scoreHistory} wsReady={wsReady} onSkipToChat={() => { setIsFirstPose(false); navigate("/chat"); }} />} />
        <Route path="/chat" element={<ChatScreen session={session} scoreHistory={scoreHistory} chatTimer={chatTimer} onManualYoga={handleManualYoga} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}