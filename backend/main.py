import os
import io
import re
import json
import base64
import urllib.request
import urllib.parse
from typing import Optional
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from groq import Groq

import edge_tts

try:
    from gtts import gTTS
    GTTS_AVAILABLE = True
except ImportError:
    gTTS = None
    GTTS_AVAILABLE = False

try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    Image = None
    PIL_AVAILABLE = False

load_dotenv()

app = FastAPI(title="AccessPaste API", version="4.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AnalyzeRequest(BaseModel):
    raw_text: Optional[str] = ""
    image_base64: Optional[str] = None
    target_language: str = "English"

class TTSRequest(BaseModel):
    text: str
    language: str = "English"

# Exact neural voices dictionary for edge-tts
NEURAL_VOICES = {
    "English": "en-IN-NeerjaNeural",
    "Hindi": "hi-IN-SwaraNeural",
    "Telugu": "te-IN-ShrutiNeural",
    "Tamil": "ta-IN-PallaviNeural",
    "Kannada": "kn-IN-SapnaNeural",
    "Malayalam": "ml-IN-SobhanaNeural",
    "Marathi": "mr-IN-AarohiNeural",
    "Bengali": "bn-IN-TanishaaNeural",
    "Gujarati": "gu-IN-DhwaniNeural",
    "Punjabi": "pa-IN-OjasNeural",
    "Odia": "or-IN-SubhasiniNeural",
    "Urdu": "ur-IN-GulNeural"
}

# Complete language mapping for gTTS (Google Text-to-Speech fallback)
GTTS_LANG_MAP = {
    "english": "en",
    "hindi": "hi",
    "telugu": "te",
    "tamil": "ta",
    "kannada": "kn",
    "malayalam": "ml",
    "marathi": "mr",
    "bengali": "bn",
    "gujarati": "gu",
    "punjabi": "pa",
    "urdu": "ur",
    "odia": "hi",  # Phonetic fallback
}

def get_working_groq_model(client: Groq, vision: bool = False) -> str:
    """Dynamically selects an active model available on the user's Groq account."""
    try:
        models_list = client.models.list()
        available_ids = [m.id for m in models_list.data]
    except Exception:
        available_ids = []

    if vision:
        # Check active vision models on Groq
        vision_candidates = [
            "meta-llama/llama-4-scout-17b-16e-instruct",
            "qwen/qwen3.8-27b",
            "qwen/qwen2.5-vl-72b-instruct",
            "meta-llama/llama-3.2-11b-vision-preview",
            "meta-llama/llama-3.2-90b-vision-preview",
        ]
        for vc in vision_candidates:
            if vc in available_ids:
                return vc
        for candidate in available_ids:
            if any(k in candidate.lower() for k in ["qwen", "scout", "vision", "vl", "pixtral", "llava"]):
                return candidate
        return "qwen/qwen3.8-27b"

    # Preferred text models in order of quality
    preferred = [
        "openai/gpt-oss-120b",
        "qwen/qwen3-32b",
        "openai/gpt-oss-20b",
        "llama-3.3-70b-versatile",
        "llama-3.1-8b-instant",
    ]
    for p in preferred:
        if p in available_ids:
            return p

    for candidate in available_ids:
        if not any(x in candidate.lower() for x in ["whisper", "orpheus", "tts", "guard", "embed"]):
            return candidate

    return "openai/gpt-oss-20b"

def optimize_image_base64(image_base64: str) -> str:
    """Pre-processes and resizes image to max 1280px for fast, reliable Groq Vision inference."""
    try:
        data = image_base64.strip()
        if "," in data:
            _, b64_part = data.split(",", 1)
        else:
            b64_part = data

        raw_bytes = base64.b64decode(b64_part)
        img = Image.open(io.BytesIO(raw_bytes)).convert("RGB")

        max_size = 1280
        if img.width > max_size or img.height > max_size:
            img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)

        out_buf = io.BytesIO()
        img.save(out_buf, format="JPEG", quality=85)
        optimized_b64 = base64.b64encode(out_buf.getvalue()).decode("utf-8")
        return f"data:image/jpeg;base64,{optimized_b64}"
    except Exception:
        return image_base64

def extract_text_free_ocr(base64_image: str) -> str:
    """Free OCR fallback using OCR.space free tier API if needed."""
    try:
        payload = urllib.parse.urlencode({
            "base64Image": base64_image,
            "apikey": "helloworld",
            "language": "eng",
            "isOverlayRequired": "false",
            "scale": "true",
            "OCREngine": "2"
        }).encode("utf-8")
        req = urllib.request.Request("https://api.ocr.space/parse/image", data=payload, method="POST")
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            parsed = data.get("ParsedResults", [])
            if parsed and parsed[0].get("ParsedText"):
                return parsed[0]["ParsedText"].strip()
    except Exception:
        pass
    return ""

@app.get("/api/health")
def health():
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    return {
        "status": "online",
        "service": "AccessPaste",
        "groq_key_configured": bool(api_key and api_key.startswith("gsk_")),
        "tts_supported_languages": list(GTTS_LANG_MAP.keys())
    }

@app.post("/api/analyze")
def analyze_document(req: AnalyzeRequest):
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="GROQ_API_KEY is missing in backend/.env. Add GROQ_API_KEY=gsk_... and save the file."
        )

    client = Groq(api_key=api_key)
    source_text = (req.raw_text or "").strip()
    extracted_from_image = ""

    # Step 1: If image was uploaded and text wasn't manually typed
    if req.image_base64 and not source_text:
        optimized_img_b64 = optimize_image_base64(req.image_base64)
        vision_model = get_working_groq_model(client, vision=True)
        
        if vision_model:
            try:
                vision_resp = client.chat.completions.create(
                    model=vision_model,
                    messages=[
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": "Transcribe ALL readable text, numbers, dates, dosages, warnings, and instructions from this document image verbatim. Be accurate and complete."},
                                {"type": "image_url", "image_url": {"url": optimized_img_b64}}
                            ]
                        }
                    ],
                    temperature=0.1,
                    max_tokens=2048,
                )
                extracted_from_image = vision_resp.choices[0].message.content.strip()
            except Exception as vision_err:
                print(f"[Warning] Groq vision model {vision_model} error: {vision_err}")
                extracted_from_image = ""

        if not extracted_from_image:
            extracted_from_image = extract_text_free_ocr(optimized_img_b64)

        source_text = extracted_from_image.strip()

    if not source_text:
        raise HTTPException(
            status_code=400,
            detail="Could not detect or read text from the provided image. Please upload a clear photo or type/paste text directly."
        )

    # Step 2: Select a live working text model from Groq account
    text_model = get_working_groq_model(client, vision=False)

    system_prompt = f"""You are AccessPaste, an AI document accessibility and translation engine.
Analyze the user's document (medical report, prescription, scholarship, government circular, job notice, or legal form) and simplify it for everyday citizens.

STRICT LANGUAGE & ACCURACY RULES:
1. Target Language: {req.target_language}.
2. Every single value in the JSON output (title, category, summary, key_details, eligibility_or_warnings, required_documents, action_steps, ready_to_paste_reply) MUST be written 100% in the genuine native script of {req.target_language}:
   - Telugu -> తెలుగు script
   - Hindi -> हिन्दी (Devanagari) script
   - Tamil -> தமிழ் script
   - Kannada -> ಕನ್ನಡ script
   - Malayalam -> മലയാളം script
   - Marathi -> मराठी script
   - Bengali -> বাংলা script
   - Gujarati -> ગુજરાતી script
   - Punjabi -> ਪੰਜਾਬੀ script
   - Odia -> ଓଡ଼ିଆ script
   - Urdu -> اردو script
   - English -> Simple plain English
3. NEVER use English with tags like "[Telugu]" or "[Hindi]". Write strictly in the real native script.
4. Extract ONLY real facts, dates, amounts, medicines, or conditions present in the provided text.

Return ONLY valid raw JSON matching this exact structure:
{{
  "title": "Clear translated title of the document in {req.target_language}",
  "category": "Category translated in {req.target_language}",
  "summary": "2-3 clear sentences explaining the core purpose and benefit in simple {req.target_language}",
  "key_details": [
    "Specific fact, amount, date, or dosage 1 in {req.target_language}",
    "Specific fact 2 in {req.target_language}"
  ],
  "eligibility_or_warnings": [
    "Specific eligibility rule or medical warning 1 in {req.target_language}",
    "Rule or warning 2 in {req.target_language}"
  ],
  "required_documents": [
    "Required document or item 1 in {req.target_language}",
    "Required document or item 2 in {req.target_language}"
  ],
  "action_steps": [
    "Step 1 to take immediately in {req.target_language}",
    "Step 2 in {req.target_language}",
    "Step 3 in {req.target_language}"
  ],
  "ready_to_paste_reply": "A ready-to-copy inquiry message or application note in {req.target_language}"
}}"""

    try:
        completion = client.chat.completions.create(
            model=text_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Translate and simplify into {req.target_language}:\n\n{source_text}"}
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
        )
        raw_output = completion.choices[0].message.content.strip()
        result = json.loads(raw_output)
        result["extracted_source_text"] = extracted_from_image or (source_text if req.image_base64 else "")
        result["target_language"] = req.target_language
        result["model_used"] = text_model
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Translation Error ({text_model}): {str(e)}")

async def stream_neural_tts(text: str, language: str):
    clean_text = (text or "").strip()
    if not clean_text:
        raise HTTPException(status_code=400, detail="Text cannot be empty.")

    clean_text = re.sub(r'[*_#`[\]()]', '', clean_text)
    if len(clean_text) > 1000:
        clean_text = clean_text[:1000]

    matched_voice = None
    for k, v in NEURAL_VOICES.items():
        if k.lower() == language.lower().strip():
            matched_voice = v
            break
    voice = matched_voice or "en-IN-NeerjaNeural"

    async def audio_generator():
        try:
            communicate = edge_tts.Communicate(text=clean_text, voice=voice, rate="+5%")
            has_data = False
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    has_data = True
                    yield chunk["data"]

            if not has_data:
                fallback_voice = "hi-IN-SwaraNeural" if language.lower() != "english" else "en-IN-NeerjaNeural"
                fb_comm = edge_tts.Communicate(text=clean_text, voice=fallback_voice, rate="+5%")
                async for chunk in fb_comm.stream():
                    if chunk["type"] == "audio":
                        yield chunk["data"]
        except Exception:
            try:
                fallback_voice = "hi-IN-SwaraNeural" if language.lower() != "english" else "en-IN-NeerjaNeural"
                fb_comm = edge_tts.Communicate(text=clean_text, voice=fallback_voice, rate="+5%")
                async for chunk in fb_comm.stream():
                    if chunk["type"] == "audio":
                        yield chunk["data"]
            except Exception:
                if GTTS_AVAILABLE and gTTS is not None:
                    try:
                        lang_code = GTTS_LANG_MAP.get(language.lower().strip(), "en")
                        tts = gTTS(text=clean_text, lang=lang_code, slow=False)
                        buf = io.BytesIO()
                        tts.write_to_fp(buf)
                        yield buf.getvalue()
                    except Exception:
                        pass

    return StreamingResponse(
        audio_generator(),
        media_type="audio/mpeg",
        headers={
            "Content-Type": "audio/mpeg",
            "Cache-Control": "public, max-age=86400",
        }
    )

@app.get("/api/tts")
async def text_to_speech_get(
    text: str = Query(...), 
    lang: Optional[str] = Query(None), 
    language: Optional[str] = Query(None)
):
    target_lang = lang or language or "English"
    return await stream_neural_tts(text, target_lang)

@app.post("/api/tts")
async def text_to_speech_post(req: TTSRequest):
    return await stream_neural_tts(req.text, req.language)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8005, reload=True)
