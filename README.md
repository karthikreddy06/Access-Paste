# AccessPaste 📋⚡
### Instant AI Document, Image & Camera Accessibility Engine

> **Empowering citizens to dismantle bureaucratic, clinical, and institutional wall-of-text barriers into clear, plain-language action plans, interactive checklists, and natural neural voice audio in 12 languages.**

---

## 🎯 Problem Statement

Millions of citizens every day encounter critical documents—hospital discharge summaries, complex prescription regimens, government scholarship circulars, welfare subsidy guidelines, and legal notices—written in dense, intimidating jargon. For patients, students, elderly citizens, and individuals with visual, literacy, or cognitive impairments, these barriers often lead to missed financial aid deadlines, improper medication dosages, and lost opportunities.

**AccessPaste** eliminates this friction. By simply pasting text (`Ctrl+V`), uploading a document photo, or snapping a picture via live camera capture, AccessPaste uses state-of-the-art Groq vision and language models to instantly transform inaccessible walls of text into plain-language summaries, structured action steps, document checklists, and low-latency native voice audio.

---

## ✨ Key Features

- **⚡ 3 Flexible Input Modes**:
  - **Paste Text (`Ctrl+V`)**: Instant paste-and-analyze command center for circulars, medical notes, or job notices.
  - **Document Image Upload**: High-speed OCR supporting PNG, JPG, JPEG, and WEBP formats with automated client/server image optimization.
  - **WebRTC Camera Capture**: Direct browser-based mobile and desktop camera scanner (`navigator.mediaDevices.getUserMedia`) with live preview and frame capture.
- **🌐 12 Indian Regional Languages + English (100% Native Script)**:
  - Supports English, Hindi (हिन्दी), Telugu (తెలుగు), Tamil (தமிழ்), Kannada (ಕನ್ನಡ), Malayalam (മലയാളം), Marathi (मराठी), Bengali (বাংলা), Gujarati (ગુજરાતી), Punjabi (ਪੰਜਾਬੀ), Odia (ଓଡ଼ିଆ), and Urdu (اردو).
  - Strict native script output (no pseudo-English tags or phonetic approximations).
- **🔊 Low-Latency Neural Voice Streaming via `edge-tts`**:
  - First-chunk audio latency under **300ms** using Microsoft Edge neural voice streams (`ShrutiNeural`, `SwaraNeural`, `NeerjaNeural`, `PallaviNeural`, etc.).
  - **Sentence-Level Pre-Fetching Queue**: Plays sentence $i$ immediately while pre-buffering sentence $i+1$ in the background for continuous playback.
- **👁️ Visual Accessibility Suite**:
  - **High-Contrast Vision Mode**: High-visibility palette for low-vision users.
  - **Font Size Scaler**: 100%, 115%, and 130% zoom levels.
  - **Interactive Checklists**: Real-time progress bar for tracking required paperwork.
  - **"Ready-to-Paste" Action Draft**: Pre-generated, tailored inquiry or application letter ready to copy into email, WhatsApp, or official portals.

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 18 (Vite)
- **Styling**: Tailwind CSS, PostCSS, Autoprefixer
- **Icons**: Lucide React
- **Media & Camera**: WebRTC (`getUserMedia`), HTML5 Canvas
- **Audio Engine**: Asynchronous HTML5 Audio Queue with sentence-level pre-buffering

### Backend
- **Framework**: FastAPI (Python 3.10+)
- **Server**: Uvicorn (ASGI)
- **AI & Vision Engine**: Groq Cloud API (`openai/gpt-oss-120b`, `qwen/qwen3.8-27b`)
- **Speech Synthesis**: `edge-tts` (Microsoft Edge Neural Voice Streaming) + `gTTS` fallback
- **Image Processing**: Pillow (`PIL`) for automated aspect-ratio preservation and compression
- **Data Validation**: Pydantic v2

---

## 🚀 Local Setup & Installation

### Prerequisites
- Python 3.10 or higher
- Node.js 18.0 or higher
- A free [Groq Cloud API Key](https://console.groq.com)

---

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create and activate a virtual environment
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On macOS/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# Edit .env and insert your GROQ_API_KEY
```

**Run the FastAPI backend server (Port 8005):**
```bash
python -m uvicorn main:app --reload --port 8005
```
- API Docs: [http://localhost:8005/docs](http://localhost:8005/docs)
- Health Check: [http://localhost:8005/api/health](http://localhost:8005/api/health)

---

### 2. Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start Vite dev server (Port 5174)
npm run dev
```

Open your browser at **[http://localhost:5174](http://localhost:5174)**.

---

## 📁 Repository Structure

```
Access-Paste/
├── backend/
│   ├── main.py               # FastAPI server, Groq Vision OCR, edge-tts streaming
│   ├── requirements.txt      # Python dependencies
│   ├── .env.example          # Template environment config
│   └── .env                  # (Git-ignored) Local credentials
├── frontend/
│   ├── index.html            # HTML5 shell with accessible typography
│   ├── package.json          # React, Vite, Tailwind & Lucide dependencies
│   ├── vite.config.js        # Port 5174 setup with /api reverse proxy to 8005
│   ├── tailwind.config.js    # Custom accessible color palettes & animations
│   ├── postcss.config.js     # PostCSS configuration
│   └── src/
│       ├── main.jsx          # React entry point
│       ├── App.jsx           # Main AccessPaste UI, Camera & Neural Voice Queue
│       └── index.css         # High-contrast and typography rules
├── .gitignore                # Comprehensive credential & build exclusion rules
└── README.md                 # Project documentation
```

---

## 🛡️ License & Contributing

Built with ❤️ for accessible, barrier-free access to everyday critical information. Contributions and issues are welcome!
