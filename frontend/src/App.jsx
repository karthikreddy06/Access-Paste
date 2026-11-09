import React, { useState, useRef, useEffect } from "react";
import {
  ClipboardPaste,
  Upload,
  Camera,
  Volume2,
  Square,
  CheckCircle2,
  AlertCircle,
  FileText,
  Sparkles,
  Copy,
  Check,
  X,
  Eye,
  Languages,
  Loader2,
  RefreshCw
} from "lucide-react";

const INDIAN_LANGUAGES = [
  { label: "English", value: "English", langCode: "en-IN" },
  { label: "Hindi (हिन्दी)", value: "Hindi", langCode: "hi-IN" },
  { label: "Telugu (తెలుగు)", value: "Telugu", langCode: "te-IN" },
  { label: "Tamil (தமிழ்)", value: "Tamil", langCode: "ta-IN" },
  { label: "Kannada (ಕನ್ನಡ)", value: "Kannada", langCode: "kn-IN" },
  { label: "Malayalam (മലയാളം)", value: "Malayalam", langCode: "ml-IN" },
  { label: "Marathi (मराठी)", value: "Marathi", langCode: "mr-IN" },
  { label: "Bengali (বাংলা)", value: "Bengali", langCode: "bn-IN" },
  { label: "Gujarati (ગુજરાતી)", value: "Gujarati", langCode: "gu-IN" },
  { label: "Punjabi (ਪੰਜਾਬੀ)", value: "Punjabi", langCode: "pa-IN" },
  { label: "Odia (ଓଡ଼ିଆ)", value: "Odia", langCode: "or-IN" },
  { label: "Urdu (اردو)", value: "Urdu", langCode: "ur-IN" }
];

export default function App() {
  const [activeTab, setActiveTab] = useState("text"); // "text" | "upload" | "camera"
  const [rawText, setRawText] = useState("");
  const [imageBase64, setImageBase64] = useState(null);
  const [targetLanguage, setTargetLanguage] = useState("English");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [checkedDocs, setCheckedDocs] = useState({});
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const audioRef = useRef(null);
  const stopAudioFlag = useRef(false);
  const [highContrast, setHighContrast] = useState(false);
  const [fontScale, setFontScale] = useState(100);

  // Camera refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);

  // Stop camera stream on tab change or unmount
  useEffect(() => {
    if (activeTab !== "camera") {
      stopCamera();
    }
    return () => stopCamera();
  }, [activeTab]);

  const startCamera = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
      }
    } catch (err) {
      setError("Unable to access camera. Please allow camera permissions in your browser or use Image Upload.");
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setImageBase64(dataUrl);
    stopCamera();
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setImageBase64(reader.result);
      setError("");
    };
    reader.readAsDataURL(file);
  };

  const handleClipboardPaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setRawText(text);
        setActiveTab("text");
        setError("");
      }
    } catch {
      setError("Press Ctrl+V directly inside the text box to paste.");
    }
  };

  const handleAnalyze = async () => {
    if (!rawText.trim() && !imageBase64) {
      setError("Please paste text, upload an image, or capture a photo first.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    setCheckedDocs({});
    stopSpeaking();

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raw_text: rawText,
          image_base64: imageBase64,
          target_language: targetLanguage
        })
      });

      let data;
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const textErr = await response.text();
        data = { detail: textErr || `Server returned ${response.status}: Please make sure the backend is running on port 8000.` };
      }

      if (!response.ok) {
        throw new Error(data.detail || `Analysis failed (${response.status}). Please try again.`);
      }

      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const stopSpeaking = () => {
    stopAudioFlag.current = true;
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      } catch (e) { }
      audioRef.current = null;
    }
    setIsSpeaking(false);
    setAudioLoading(false);
  };

  const speakSummary = async () => {
    if (!result) return;
    stopSpeaking();
    stopAudioFlag.current = false;
    setAudioLoading(true);

    // 1. Split result.title, result.summary, and result.action_steps into short sentence strings
    const sentences = [];

    if (result.title) {
      sentences.push(result.title.trim());
    }

    if (result.summary) {
      const summaryParts = result.summary
        .split(/(?<=[.।!?])\s+/)
        .map((s) => s.trim())
        .filter(Boolean);
      sentences.push(...summaryParts);
    }

    if (result.action_steps && Array.isArray(result.action_steps)) {
      result.action_steps.forEach((step) => {
        if (step && typeof step === "string") {
          const stepTrimmed = step.trim();
          if (stepTrimmed) sentences.push(stepTrimmed);
        }
      });
    }

    const cleanSentences = sentences
      .map((s) => s.replace(/[*_#`[\]()]/g, "").trim())
      .filter((s) => s.length > 0);

    if (cleanSentences.length === 0) {
      setAudioLoading(false);
      return;
    }

    // 2. Pre-configure Audio objects with preload="auto" for sentence-level pre-fetching
    const audioQueue = cleanSentences.map((sentence) => {
      const audio = new Audio(
        `/api/tts?text=${encodeURIComponent(sentence)}&lang=${encodeURIComponent(targetLanguage)}`
      );
      audio.preload = "auto";
      return audio;
    });

    setIsSpeaking(true);
    setAudioLoading(false);

    // 3. Play through queue sequentially, pre-buffering sentence i + 1 in background
    for (let i = 0; i < audioQueue.length; i++) {
      if (stopAudioFlag.current) break;

      const currentAudio = audioQueue[i];
      audioRef.current = currentAudio;

      // Pre-buffer next sentence in background
      if (i + 1 < audioQueue.length) {
        try {
          audioQueue[i + 1].load();
        } catch (e) { }
      }

      // Play current sentence and await completion
      try {
        await new Promise((resolve) => {
          currentAudio.onended = () => resolve();
          currentAudio.onerror = (err) => {
            console.warn(`Audio sentence ${i + 1} playback error, continuing to next:`, err);
            resolve();
          };
          currentAudio.play().catch((playErr) => {
            console.warn("Audio play rejected:", playErr);
            resolve();
          });
        });
      } catch (err) {
        console.warn("Playback error:", err);
      }

      if (stopAudioFlag.current) break;
    }

    if (!stopAudioFlag.current) {
      setIsSpeaking(false);
      audioRef.current = null;
    }
  };

  const copyReply = () => {
    if (!result?.ready_to_paste_reply) return;
    navigator.clipboard.writeText(result.ready_to_paste_reply);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const clearAll = () => {
    setRawText("");
    setImageBase64(null);
    setResult(null);
    setError("");
    stopSpeaking();
  };

  return (
    <div
      style={{ fontSize: `${fontScale}%` }}
      className={`min-h-screen transition-colors ${highContrast
        ? "bg-black text-yellow-300"
        : "bg-slate-950 text-slate-100"
        }`}
    >
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-600/30">
              <ClipboardPaste className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">
                AccessPaste
              </h1>
              <p className="text-xs text-slate-400">
                AI Document, Image & Camera Accessibility Engine
              </p>
            </div>
          </div>

          {/* Language & Accessibility Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5">
              <Languages className="w-4 h-4 text-blue-400" />
              <select
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
                className="bg-transparent text-sm font-medium text-white focus:outline-none"
              >
                {INDIAN_LANGUAGES.map((lang) => (
                  <option
                    key={lang.value}
                    value={lang.value}
                    className="bg-slate-900 text-white"
                  >
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg p-1 text-xs">
              {[100, 115, 130].map((size) => (
                <button
                  key={size}
                  onClick={() => setFontScale(size)}
                  className={`px-2 py-1 rounded ${fontScale === size
                    ? "bg-blue-600 text-white font-semibold"
                    : "text-slate-300 hover:text-white"
                    }`}
                >
                  {size}%
                </button>
              ))}
            </div>

            <button
              onClick={() => setHighContrast(!highContrast)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition ${highContrast
                ? "bg-yellow-400 text-black border-yellow-300"
                : "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
                }`}
            >
              <Eye className="w-4 h-4" />
              Contrast
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Input Hub Card */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          {/* Input Mode Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-5 border-b border-slate-800 pb-4">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setActiveTab("text")}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition ${activeTab === "text"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
              >
                <FileText className="w-4 h-4" />
                Paste Text (Ctrl+V)
              </button>

              <button
                onClick={() => setActiveTab("upload")}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition ${activeTab === "upload"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
              >
                <Upload className="w-4 h-4" />
                Upload Image
              </button>

              <button
                onClick={() => {
                  setActiveTab("camera");
                  startCamera();
                }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition ${activeTab === "camera"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
              >
                <Camera className="w-4 h-4" />
                Use Camera
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleClipboardPaste}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700"
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                Paste Clipboard
              </button>
              {(rawText || imageBase64 || result) && (
                <button
                  onClick={clearAll}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-950/60 hover:bg-red-900/60 text-red-300 text-xs font-medium border border-red-800/50"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Tab 1: Paste Text */}
          {activeTab === "text" && (
            <div>
              <textarea
                rows={6}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Paste (Ctrl+V) any medical report, prescription, scholarship circular, government welfare scheme, or job notice here..."
                className="w-full rounded-xl bg-slate-950 border border-slate-800 p-4 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
              />
            </div>
          )}

          {/* Tab 2: Upload Image */}
          {activeTab === "upload" && (
            <div className="border-2 border-dashed border-slate-700 rounded-xl p-8 text-center bg-slate-950/50">
              <input
                type="file"
                accept="image/*"
                id="doc-image-upload"
                onChange={handleImageUpload}
                className="hidden"
              />
              <label
                htmlFor="doc-image-upload"
                className="cursor-pointer flex flex-col items-center justify-center gap-3"
              >
                <div className="w-14 h-14 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-semibold text-white">
                    Click to upload a photo or screenshot of any document
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Supports JPG, PNG, WEBP (Prescriptions, Circulars, Forms, Notices)
                  </p>
                </div>
              </label>
            </div>
          )}

          {/* Tab 3: Live Camera */}
          {activeTab === "camera" && (
            <div className="space-y-4 text-center bg-slate-950 p-4 rounded-xl border border-slate-800">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className={`w-full max-h-96 rounded-lg mx-auto bg-black ${cameraActive ? "block" : "hidden"
                  }`}
              />
              <canvas ref={canvasRef} className="hidden" />
              <div className="flex justify-center gap-3">
                {cameraActive ? (
                  <>
                    <button
                      onClick={capturePhoto}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                    >
                      <Camera className="w-5 h-5" />
                      Snap Photo
                    </button>
                    <button
                      onClick={stopCamera}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
                    >
                      <X className="w-4 h-4" />
                      Close Camera
                    </button>
                  </>
                ) : (
                  <button
                    onClick={startCamera}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold"
                  >
                    <Camera className="w-5 h-5" />
                    Start Camera
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Image Preview Thumbnail (if uploaded or captured) */}
          {imageBase64 && (
            <div className="mt-4 p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <img
                  src={imageBase64}
                  alt="Document preview"
                  className="w-16 h-16 object-cover rounded-lg border border-slate-700"
                />
                <div>
                  <p className="text-sm font-medium text-emerald-400">
                    Document Image Attached Ready for AI OCR
                  </p>
                  <p className="text-xs text-slate-400">
                    Will be scanned and translated into {targetLanguage}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setImageBase64(null)}
                className="p-2 text-slate-400 hover:text-red-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="mt-4 p-4 rounded-xl bg-red-950/80 border border-red-800 text-red-200 flex items-center gap-3 text-sm">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Analyze CTA */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
            <p className="text-xs text-slate-400">
              Output Language:{" "}
              <strong className="text-white">{targetLanguage}</strong>
            </p>
            <button
              onClick={handleAnalyze}
              disabled={loading}
              className="flex items-center gap-2.5 px-7 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold shadow-lg shadow-blue-600/30 transition"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Analyzing & Translating to {targetLanguage}...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Simplify & Translate ({targetLanguage})
                </>
              )}
            </button>
          </div>
        </section>

        {/* Results Dashboard (Rendered ONLY when real backend response arrives) */}
        {result && (
          <section className="space-y-6 animate-fadeIn">
            {/* Title & Audio Banner */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30 mb-2">
                  {result.category} • {result.target_language}
                </span>
                <h2 className="text-2xl font-bold text-white">
                  {result.title}
                </h2>
              </div>

              <div className="flex items-center gap-3">
                {!isSpeaking ? (
                  <button
                    onClick={speakSummary}
                    disabled={audioLoading}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold transition shadow-md shadow-emerald-600/20"
                  >
                    {audioLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Loading Voice Audio...</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-5 h-5" />
                        <span>Listen in {targetLanguage}</span>
                      </>
                    )}
                  </button>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 px-3 py-2 bg-emerald-950/60 border border-emerald-500/40 rounded-xl">
                      <span className="w-1.5 h-4 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                      <span className="w-1.5 h-6 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                      <span className="w-1.5 h-3 bg-emerald-400 rounded-full animate-bounce"></span>
                      <span className="w-1.5 h-5 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.2s]"></span>
                      <span className="text-xs font-semibold text-emerald-300 ml-2">Playing {targetLanguage} Voice</span>
                    </div>
                    <button
                      onClick={stopSpeaking}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold transition shadow-md shadow-amber-600/20"
                    >
                      <Square className="w-4 h-4 fill-white" />
                      <span>Stop Audio</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Summary & Key Details Grid */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Plain Summary */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-blue-400">
                  Plain-Language Summary
                </h3>
                <p className="text-lg leading-relaxed text-slate-100">
                  {result.summary}
                </p>

                {result.key_details?.length > 0 && (
                  <div className="pt-3 border-t border-slate-800 space-y-2">
                    <h4 className="text-xs font-semibold uppercase text-slate-400">
                      Key Highlights & Numbers
                    </h4>
                    <ul className="space-y-2">
                      {result.key_details.map((item, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2.5 text-sm text-slate-200"
                        >
                          <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-1" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Eligibility & Warnings */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-emerald-400">
                  Eligibility Rules & Important Warnings
                </h3>
                <ul className="space-y-3">
                  {result.eligibility_or_warnings?.map((rule, idx) => (
                    <li
                      key={idx}
                      className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-200"
                    >
                      {rule}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Required Documents & Action Steps Grid */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Interactive Document Checklist */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-amber-400">
                  Required Documents / Items Checklist
                </h3>
                <div className="space-y-2.5">
                  {result.required_documents?.map((doc, idx) => (
                    <label
                      key={idx}
                      className="flex items-center gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={!!checkedDocs[idx]}
                        onChange={() =>
                          setCheckedDocs((prev) => ({
                            ...prev,
                            [idx]: !prev[idx]
                          }))
                        }
                        className="w-4 h-4 rounded accent-blue-600"
                      />
                      <span
                        className={`text-sm ${checkedDocs[idx]
                          ? "line-through text-slate-500"
                          : "text-slate-200"
                          }`}
                      >
                        {doc}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Action Steps */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-purple-400">
                  Step-by-Step Action Plan
                </h3>
                <ol className="space-y-3">
                  {result.action_steps?.map((step, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-200"
                    >
                      <span className="w-6 h-6 rounded-full bg-purple-600/30 text-purple-300 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            {/* Ready-to-Paste Reply / Application Note */}
            {result.ready_to_paste_reply && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-blue-400">
                    Ready-to-Paste Application / Inquiry Draft
                  </h3>
                  <button
                    onClick={copyReply}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy Draft
                      </>
                    )}
                  </button>
                </div>
                <p className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-300 whitespace-pre-wrap">
                  {result.ready_to_paste_reply}
                </p>
              </div>
            )}

            {/* OCR Extracted Source Text (if image was uploaded) */}
            {result.extracted_source_text && (
              <details className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-xs text-slate-400">
                <summary className="cursor-pointer font-semibold text-slate-300">
                  View Raw Text Extracted from Uploaded Image (OCR)
                </summary>
                <pre className="mt-3 p-3 bg-slate-950 rounded-lg overflow-x-auto whitespace-pre-wrap text-slate-300">
                  {result.extracted_source_text}
                </pre>
              </details>
            )}
          </section>
        )}
      </main>
    </div>
  );
}