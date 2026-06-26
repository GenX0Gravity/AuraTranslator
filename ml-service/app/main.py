"""AuraTranslator ML Service — Open-source translation inference."""

from __future__ import annotations

import io
import os
import time
import base64
from typing import Any
import urllib.parse
import numpy as np
import scipy.io.wavfile as wavfile

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.benchmark import run_benchmark
from app.detection import detect_language
from app.models.registry import DEVICE, get_translator
from app.router import route_model

app = FastAPI(
    title="AuraTranslator ML Service",
    description="Open-source NLLB, M2M100, MarianMT, IndicTrans2, OPUS-MT inference",
    version="2.0.0",
)


class TranslateRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=10000)
    source_lang: str = "auto"
    target_lang: str
    model: str | None = None
    domain: str = "general"
    source_nllb: str | None = None
    target_nllb: str | None = None
    source_indic: str | None = None
    target_indic: str | None = None


class DetectRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)


class ClassifyDomainRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=10000)


class BenchmarkRequest(BaseModel):
    source_lang: str
    target_lang: str
    samples: list[str] = Field(..., min_length=1, max_length=20)
    reference: list[str] | None = None


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "device": DEVICE,
        "models_loaded": list(os.environ.get("LOADED_MODELS", "").split(",")) if os.environ.get("LOADED_MODELS") else [],
    }


@app.get("/models")
def list_models() -> dict[str, Any]:
    return {
        "models": [
            {"id": "nllb-200", "name": "NLLB-200 Distilled", "languages": "200+", "gpu": True},
            {"id": "m2m100", "name": "M2M100 418M", "languages": "100+", "gpu": True},
            {"id": "seamless-m4t", "name": "SeamlessM4T", "languages": "96+", "gpu": True},
            {"id": "marianmt", "name": "MarianMT (Helsinki-NLP)", "languages": "pair-specific", "gpu": False},
            {"id": "indictrans2", "name": "IndicTrans2 (AI4Bharat)", "languages": "Indian", "gpu": True},
            {"id": "opus-mt", "name": "OPUS-MT", "languages": "pair-specific", "gpu": False},
            {"id": "domain-finetuned", "name": "Domain Fine-tuned", "languages": "custom", "gpu": True},
        ],
        "device": DEVICE,
    }


@app.post("/detect")
def detect(req: DetectRequest) -> dict[str, Any]:
    return detect_language(req.text)


_domain_classifier = None


def get_domain_classifier():
    global _domain_classifier
    if _domain_classifier is None:
        from app.classifier import DomainClassifier
        _domain_classifier = DomainClassifier()
    return _domain_classifier


@app.post("/classify-domain")
def classify_domain(req: ClassifyDomainRequest) -> dict[str, Any]:
    try:
        classifier = get_domain_classifier()
        return classifier.classify(req.text)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/translate")
def translate(req: TranslateRequest) -> dict[str, Any]:
    start = time.time()

    src = req.source_nllb or req.source_indic or req.source_lang
    tgt = req.target_nllb or req.target_indic or req.target_lang

    if req.source_lang == "auto":
        detected = detect_language(req.text)
        src_iso = str(detected["language"])
        src = req.source_nllb or f"{src_iso}_Latn"
    else:
        detected = None

    model_id = route_model(src, tgt, req.model, req.domain)

    try:
        translator = get_translator(model_id)

        if model_id == "domain-finetuned":
            out = translator.translate(req.text, src, tgt, domain=req.domain)  # type: ignore
        else:
            if not translator.is_supported(src, tgt):
                model_id = "nllb-200"
                translator = get_translator(model_id)
            out = translator.translate(req.text, src, tgt)

        return {
            "translated_text": out.text,
            "detected_language": detected["language"] if detected else req.source_lang,
            "model": out.model_id,
            "confidence": out.confidence,
            "latency_ms": out.latency_ms or (time.time() - start) * 1000,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/benchmark")
def benchmark(req: BenchmarkRequest) -> dict[str, Any]:
    return run_benchmark(req.source_lang, req.target_lang, req.samples, req.reference)


class TextToSpeechRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
    source_lang: str
    target_lang: str


@app.post("/translate-speech")
def translate_speech(
    file: UploadFile = File(...),
    source_lang: str = Form("en"),
    target_lang: str = Form("es"),
    task: str = Form("speech_to_speech"),
) -> Any:
    try:
        contents = file.file.read()
        sr, audio_data = wavfile.read(io.BytesIO(contents))
        
        if audio_data.dtype == np.int16:
            audio_data = audio_data.astype(np.float32) / 32768.0
        elif audio_data.dtype == np.int32:
            audio_data = audio_data.astype(np.float32) / 2147483648.0
        elif audio_data.dtype == np.uint8:
            audio_data = (audio_data.astype(np.float32) - 128.0) / 128.0
            
        if len(audio_data.shape) > 1:
            audio_data = audio_data[:, 0]
            
        translator = get_translator("seamless-m4t")
        
        translated_text, out_audio = translator.translate_speech(
            audio_data, source_lang, target_lang, task
        )
        
        if task == "speech_to_text" or out_audio is None:
            return {"translated_text": translated_text}
            
        out_buf = io.BytesIO()
        wavfile.write(out_buf, 16000, out_audio.astype(np.float32))
        out_buf.seek(0)
        
        return StreamingResponse(
            out_buf,
            media_type="audio/wav",
            headers={"X-Translated-Text": urllib.parse.quote(translated_text, safe='')}
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/text-to-speech")
def text_to_speech_route(req: TextToSpeechRequest) -> Any:
    try:
        translator = get_translator("seamless-m4t")
        _, out_audio = translator.text_to_speech(req.text, req.source_lang, req.target_lang)
        
        out_buf = io.BytesIO()
        wavfile.write(out_buf, 16000, out_audio.astype(np.float32))
        out_buf.seek(0)
        
        return StreamingResponse(
            out_buf,
            media_type="audio/wav",
            headers={"X-Translated-Text": urllib.parse.quote(req.text, safe='')}
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


class TMAddRequest(BaseModel):
    source_text: str
    target_translation: str
    source_lang: str
    target_lang: str
    domain: str = "general"
    rating: float = 5.0
    corrections: list[str] = []


class TMSearchRequest(BaseModel):
    query: str
    source_lang: str
    target_lang: str
    domain: str = "general"
    threshold: float = 0.85
    limit: int = 5


class TMUpdateRequest(BaseModel):
    entry_id: str
    rating: float | None = None
    correction: str | None = None


_tm_manager = None


def get_tm_manager():
    global _tm_manager
    if _tm_manager is None:
        from app.tm.manager import TranslationMemoryManager
        _tm_manager = TranslationMemoryManager()
    return _tm_manager


@app.post("/tm/add")
def tm_add(req: TMAddRequest) -> dict[str, Any]:
    try:
        manager = get_tm_manager()
        entry_id = manager.add(
            source_text=req.source_text,
            target_translation=req.target_translation,
            source_lang=req.source_lang,
            target_lang=req.target_lang,
            domain=req.domain,
            rating=req.rating,
            corrections=req.corrections
        )
        return {"status": "success", "id": entry_id}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/tm/search")
def tm_search(req: TMSearchRequest) -> dict[str, Any]:
    try:
        manager = get_tm_manager()
        matches = manager.search(
            query=req.query,
            source_lang=req.source_lang,
            target_lang=req.target_lang,
            domain=req.domain,
            threshold=req.threshold,
            limit=req.limit
        )
        return {"matches": matches}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/tm/update")
def tm_update(req: TMUpdateRequest) -> dict[str, Any]:
    try:
        manager = get_tm_manager()
        success = manager.update(
            entry_id=req.entry_id,
            rating=req.rating,
            correction=req.correction
        )
        if not success:
            raise HTTPException(status_code=404, detail="TM entry not found")
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


_document_translator = None


def get_document_translator():
    global _document_translator
    if _document_translator is None:
        from app.document_translator import DocumentTranslator
        _document_translator = DocumentTranslator()
    return _document_translator


@app.post("/translate-doc-layout")
async def translate_doc_layout(
    file: UploadFile = File(...),
    sourceLang: str = Form("auto"),
    targetLang: str = Form("en"),
    ocrEngine: str = Form("tesseract"),
    outputFormat: str = Form("pdf"),
) -> dict[str, Any]:
    try:
        contents = await file.read()
        file_name = file.filename.lower()
        
        is_pdf = file_name.endswith('.pdf')
        
        translator = get_document_translator()
        
        if is_pdf:
            out_bytes = translator.translate_pdf(
                contents, sourceLang, targetLang, engine=ocrEngine
            )
        else:
            from PIL import Image
            pil_image = Image.open(io.BytesIO(contents))
            translated_image = translator.translate_image(
                pil_image, sourceLang, targetLang, engine=ocrEngine
            )
            out_buf = io.BytesIO()
            fmt = 'PNG' if file_name.endswith('.png') else 'JPEG'
            translated_image.save(out_buf, format=fmt)
            out_bytes = out_buf.getvalue()
            
        encoded = base64.b64encode(out_bytes).decode('utf-8')
        return {"fileBuffer": encoded}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

