"""Open-source translation model registry and lazy loading."""

from __future__ import annotations

import os
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any

import torch
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer, MarianMTModel, MarianTokenizer, SeamlessM4TModel, AutoProcessor

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
CACHE_DIR = os.environ.get("MODEL_CACHE_DIR", "/tmp/auratranslator-models")
DOMAIN_MODEL_DIR = os.environ.get("DOMAIN_MODEL_DIR", "/models/domain")


@dataclass
class TranslateOutput:
    text: str
    confidence: float
    latency_ms: float
    model_id: str


class BaseTranslator(ABC):
    model_id: str

    @abstractmethod
    def translate(self, text: str, source_lang: str, target_lang: str) -> TranslateOutput:
        pass

    @abstractmethod
    def is_supported(self, source_lang: str, target_lang: str) -> bool:
        pass


class MockTranslator(BaseTranslator):
    def __init__(self, model_id: str) -> None:
        self.model_id = model_id

    def is_supported(self, source_lang: str, target_lang: str) -> bool:
        return True

    def translate(self, text: str, source_lang: str, target_lang: str, domain: str = "general") -> TranslateOutput:
        # Simple simulated translation
        return TranslateOutput(
            text=f"[Mocked {self.model_id} translation of '{text}' to {target_lang} in domain {domain}]",
            confidence=0.95,
            latency_ms=10.0,
            model_id=self.model_id,
        )


class NLLBTranslator(BaseTranslator):
    model_id = "nllb-200"

    def __init__(self) -> None:
        model_name = os.environ.get("NLLB_MODEL", "facebook/nllb-200-distilled-600M")
        self.tokenizer = AutoTokenizer.from_pretrained(model_name, cache_dir=CACHE_DIR)
        self.model = AutoModelForSeq2SeqLM.from_pretrained(model_name, cache_dir=CACHE_DIR)
        self.model.to(DEVICE)
        self.model.eval()

    def is_supported(self, source_lang: str, target_lang: str) -> bool:
        return True

    def translate(self, text: str, source_lang: str, target_lang: str) -> TranslateOutput:
        start = time.time()
        src = source_lang if source_lang != "auto" else "eng_Latn"
        tgt = target_lang

        self.tokenizer.src_lang = src
        inputs = self.tokenizer(text, return_tensors="pt", truncation=True, max_length=512).to(DEVICE)
        forced_bos = self.tokenizer.convert_tokens_to_ids(tgt)
        with torch.no_grad():
            outputs = self.model.generate(
                **inputs,
                forced_bos_token_id=forced_bos,
                max_length=512,
                num_beams=4,
            )
        result = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
        return TranslateOutput(
            text=result,
            confidence=0.88,
            latency_ms=(time.time() - start) * 1000,
            model_id=self.model_id,
        )


class M2M100Translator(BaseTranslator):
    model_id = "m2m100"

    def __init__(self) -> None:
        model_name = os.environ.get("M2M100_MODEL", "facebook/m2m100_418M")
        self.tokenizer = AutoTokenizer.from_pretrained(model_name, cache_dir=CACHE_DIR)
        self.model = AutoModelForSeq2SeqLM.from_pretrained(model_name, cache_dir=CACHE_DIR)
        self.model.to(DEVICE)
        self.model.eval()

    def is_supported(self, source_lang: str, target_lang: str) -> bool:
        return True

    def translate(self, text: str, source_lang: str, target_lang: str) -> TranslateOutput:
        start = time.time()
        src = source_lang.split("_")[0] if "_" in source_lang else source_lang
        tgt = target_lang.split("_")[0] if "_" in target_lang else target_lang
        self.tokenizer.src_lang = src
        inputs = self.tokenizer(text, return_tensors="pt", truncation=True, max_length=512).to(DEVICE)
        generated = self.model.generate(**inputs, forced_bos_token_id=self.tokenizer.get_lang_id(tgt), max_length=512)
        result = self.tokenizer.decode(generated[0], skip_special_tokens=True)
        return TranslateOutput(
            text=result,
            confidence=0.85,
            latency_ms=(time.time() - start) * 1000,
            model_id=self.model_id,
        )


class MarianTranslator(BaseTranslator):
    model_id = "marianmt"

    PAIR_MODELS: dict[str, str] = {
        "en-de": "Helsinki-NLP/opus-mt-en-de",
        "de-en": "Helsinki-NLP/opus-mt-de-en",
        "en-fr": "Helsinki-NLP/opus-mt-en-fr",
        "fr-en": "Helsinki-NLP/opus-mt-fr-en",
        "en-es": "Helsinki-NLP/opus-mt-en-es",
        "es-en": "Helsinki-NLP/opus-mt-es-en",
        "en-it": "Helsinki-NLP/opus-mt-en-it",
        "it-en": "Helsinki-NLP/opus-mt-it-en",
        "en-pt": "Helsinki-NLP/opus-mt-en-pt",
        "pt-en": "Helsinki-NLP/opus-mt-pt-en",
        "en-ru": "Helsinki-NLP/opus-mt-en-ru",
        "ru-en": "Helsinki-NLP/opus-mt-ru-en",
        "en-ja": "Helsinki-NLP/opus-mt-en-jap",
        "ja-en": "Helsinki-NLP/opus-mt-jap-en",
        "en-zh": "Helsinki-NLP/opus-mt-en-zh",
        "zh-en": "Helsinki-NLP/opus-mt-zh-en",
    }

    def __init__(self) -> None:
        self._loaded: dict[str, tuple[Any, Any]] = {}

    def _get_model(self, pair: str) -> tuple[Any, Any]:
        if pair not in self._loaded:
            model_name = self.PAIR_MODELS[pair]
            tok = MarianTokenizer.from_pretrained(model_name, cache_dir=CACHE_DIR)
            mdl = MarianMTModel.from_pretrained(model_name, cache_dir=CACHE_DIR)
            mdl.to(DEVICE)
            mdl.eval()
            self._loaded[pair] = (tok, mdl)
        return self._loaded[pair]

    def is_supported(self, source_lang: str, target_lang: str) -> bool:
        src = source_lang.split("_")[0] if "_" in source_lang else source_lang
        tgt = target_lang.split("_")[0] if "_" in target_lang else target_lang
        return f"{src}-{tgt}" in self.PAIR_MODELS

    def translate(self, text: str, source_lang: str, target_lang: str) -> TranslateOutput:
        start = time.time()
        src = source_lang.split("_")[0] if "_" in source_lang else source_lang
        tgt = target_lang.split("_")[0] if "_" in target_lang else target_lang
        pair = f"{src}-{tgt}"
        tokenizer, model = self._get_model(pair)
        inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=512).to(DEVICE)
        with torch.no_grad():
            outputs = model.generate(**inputs, max_length=512)
        result = tokenizer.decode(outputs[0], skip_special_tokens=True)
        return TranslateOutput(
            text=result,
            confidence=0.82,
            latency_ms=(time.time() - start) * 1000,
            model_id=self.model_id,
        )


class OpusTranslator(MarianTranslator):
    model_id = "opus-mt"


class IndicTrans2Translator(BaseTranslator):
    model_id = "indictrans2"

    INDIAN_LANGS = {
        "hin_Deva", "ben_Beng", "mar_Deva", "tam_Taml", "tel_Telu",
        "kan_Knda", "mal_Mlym", "guj_Gujr", "pan_Guru", "asm_Beng",
        "ory_Orya", "urd_Arab", "eng_Latn",
    }

    def __init__(self) -> None:
        self.en_to_indic_name = os.environ.get(
            "INDICTRANS_EN_INDIC", "ai4bharat/indictrans2-en-indic-1B"
        )
        self.indic_to_en_name = os.environ.get(
            "INDICTRANS_INDIC_EN", "ai4bharat/indictrans2-indic-en-1B"
        )
        self._en_indic: tuple[Any, Any] | None = None
        self._indic_en: tuple[Any, Any] | None = None

    def _load_en_indic(self) -> tuple[Any, Any]:
        if self._en_indic is None:
            tok = AutoTokenizer.from_pretrained(self.en_to_indic_name, cache_dir=CACHE_DIR)
            mdl = AutoModelForSeq2SeqLM.from_pretrained(self.en_to_indic_name, cache_dir=CACHE_DIR)
            mdl.to(DEVICE)
            mdl.eval()
            self._en_indic = (tok, mdl)
        return self._en_indic

    def _load_indic_en(self) -> tuple[Any, Any]:
        if self._indic_en is None:
            tok = AutoTokenizer.from_pretrained(self.indic_to_en_name, cache_dir=CACHE_DIR)
            mdl = AutoModelForSeq2SeqLM.from_pretrained(self.indic_to_en_name, cache_dir=CACHE_DIR)
            mdl.to(DEVICE)
            mdl.eval()
            self._indic_en = (tok, mdl)
        return self._indic_en

    def is_supported(self, source_lang: str, target_lang: str) -> bool:
        return source_lang in self.INDIAN_LANGS and target_lang in self.INDIAN_LANGS

    def translate(self, text: str, source_lang: str, target_lang: str) -> TranslateOutput:
        start = time.time()
        if source_lang == "eng_Latn":
            tokenizer, model = self._load_en_indic()
        elif target_lang == "eng_Latn":
            tokenizer, model = self._load_indic_en()
        else:
            tokenizer, model = self._load_en_indic()
            inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=512).to(DEVICE)
            with torch.no_grad():
                mid = model.generate(**inputs, max_length=512)
            english = tokenizer.decode(mid[0], skip_special_tokens=True)
            tokenizer, model = self._load_en_indic()
            text = english
            source_lang = "eng_Latn"

        inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=512).to(DEVICE)
        with torch.no_grad():
            outputs = model.generate(**inputs, max_length=512, num_beams=4)
        result = tokenizer.decode(outputs[0], skip_special_tokens=True)
        return TranslateOutput(
            text=result,
            confidence=0.90,
            latency_ms=(time.time() - start) * 1000,
            model_id=self.model_id,
        )


class DomainFineTunedTranslator(BaseTranslator):
    model_id = "domain-finetuned"

    def __init__(self) -> None:
        self._models: dict[str, tuple[Any, Any]] = {}

    def _load_domain(self, domain: str) -> tuple[Any, Any] | None:
        path = os.path.join(DOMAIN_MODEL_DIR, domain)
        if not os.path.isdir(path):
            return None
        if domain not in self._models:
            tok = AutoTokenizer.from_pretrained(path)
            mdl = AutoModelForSeq2SeqLM.from_pretrained(path)
            mdl.to(DEVICE)
            mdl.eval()
            self._models[domain] = (tok, mdl)
        return self._models[domain]

    def is_supported(self, source_lang: str, target_lang: str) -> bool:
        return True

    def translate(self, text: str, source_lang: str, target_lang: str, domain: str = "general") -> TranslateOutput:
        loaded = self._load_domain(domain)
        if loaded is None:
            raise ValueError(f"No fine-tuned model for domain: {domain}")
        start = time.time()
        tokenizer, model = loaded
        inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=512).to(DEVICE)
        with torch.no_grad():
            outputs = model.generate(**inputs, max_length=512)
        result = tokenizer.decode(outputs[0], skip_special_tokens=True)
        return TranslateOutput(
            text=result,
            confidence=0.92,
            latency_ms=(time.time() - start) * 1000,
            model_id=self.model_id,
        )


class SeamlessM4TTranslator(BaseTranslator):
    model_id = "seamless-m4t"

    def __init__(self) -> None:
        model_name = os.environ.get("SEAMLESS_MODEL", "facebook/hf-seamless-m4t-medium")
        self.processor = AutoProcessor.from_pretrained(model_name, cache_dir=CACHE_DIR)
        self.model = SeamlessM4TModel.from_pretrained(model_name, cache_dir=CACHE_DIR)
        self.model.to(DEVICE)
        self.model.eval()

    def _map_to_3letter(self, lang: str) -> str | None:
        # extract language prefix if it is an NLLB code like eng_Latn or ISO code like en-US
        clean = lang.split("_")[0].split("-")[0].lower()
        mapping = {
            "af": "afr", "am": "amh", "ar": "arb", "as": "asm", "ast": "ast",
            "az": "azj", "be": "bel", "bn": "ben", "bs": "bos", "bg": "bul",
            "ca": "cat", "ceb": "ceb", "cs": "ces", "cy": "cym", "da": "dan",
            "de": "deu", "el": "ell", "en": "eng", "es": "spa", "et": "est",
            "eu": "eus", "fa": "pes", "fi": "fin", "fr": "fra", "fy": "fry",
            "ga": "gle", "gd": "gla", "gl": "glg", "gu": "guj", "ha": "hau",
            "he": "heb", "hi": "hin", "hr": "hrv", "hu": "hun", "hy": "hye",
            "id": "ind", "ig": "ibo", "is": "isl", "it": "ita", "ja": "jpn",
            "jv": "jav", "ka": "kat", "kk": "kaz", "km": "khm", "kn": "kan",
            "ko": "kor", "ku": "kmr", "ky": "kir", "lo": "lao", "lt": "lit",
            "lv": "lvs", "mg": "plt", "mk": "mkd", "ml": "mal", "mn": "khk",
            "mr": "mar", "ms": "zsm", "mt": "mlt", "my": "mya", "ne": "npi",
            "nl": "nld", "no": "nob", "ny": "nya", "or": "ory", "pa": "pan",
            "pl": "pol", "ps": "pbt", "pt": "por", "ro": "ron", "ru": "rus",
            "sd": "snd", "si": "sin", "sk": "slk", "sl": "slv", "so": "som",
            "sq": "als", "sr": "srp", "su": "sun", "sv": "swe", "sw": "swh",
            "ta": "tam", "te": "tel", "tg": "tgk", "th": "tha", "tl": "tgl",
            "tr": "tur", "uk": "ukr", "ur": "urd", "uz": "uzn", "vi": "vie",
            "xh": "xho", "yi": "yid", "yo": "yor", "zu": "zul"
        }
        return mapping.get(clean)

    def is_supported(self, source_lang: str, target_lang: str) -> bool:
        src = self._map_to_3letter(source_lang)
        tgt = self._map_to_3letter(target_lang)
        return src is not None and tgt is not None

    def translate(self, text: str, source_lang: str, target_lang: str) -> TranslateOutput:
        start = time.time()
        src = self._map_to_3letter(source_lang) or "eng"
        tgt = self._map_to_3letter(target_lang) or "spa"

        inputs = self.processor(text=text, src_lang=src, return_tensors="pt").to(DEVICE)
        with torch.no_grad():
            output_tokens = self.model.generate(**inputs, tgt_lang=tgt, generate_speech=False)
        
        result = self.processor.decode(output_tokens[0].tolist(), skip_special_tokens=True)
        return TranslateOutput(
            text=result,
            confidence=0.89,
            latency_ms=(time.time() - start) * 1000,
            model_id=self.model_id,
        )

    def translate_speech(self, audio_data: Any, source_lang: str, target_lang: str, task: str = "speech_to_speech") -> tuple[str, Any | None]:
        src = self._map_to_3letter(source_lang) or "eng"
        tgt = self._map_to_3letter(target_lang) or "spa"

        inputs = self.processor(audios=audio_data, sampling_rate=16000, return_tensors="pt").to(DEVICE)
        
        with torch.no_grad():
            if task == "speech_to_text":
                output_tokens = self.model.generate(**inputs, tgt_lang=tgt, generate_speech=False)
                translated_text = self.processor.decode(output_tokens[0].tolist(), skip_special_tokens=True)
                return translated_text, None
            else:  # speech_to_speech
                out = self.model.generate(**inputs, tgt_lang=tgt, return_intermediate_token_ids=True)
                if hasattr(out, "waveform"):
                    audio_waveform = out.waveform[0].cpu().numpy().squeeze()
                    text_tokens = out.text_token_ids[0].tolist()
                else:
                    audio_waveform = out[0].cpu().numpy().squeeze()
                    text_tokens = out[1][0].tolist() if len(out) > 1 else []
                
                translated_text = self.processor.decode(text_tokens, skip_special_tokens=True)
                return translated_text, audio_waveform

    def text_to_speech(self, text: str, source_lang: str, target_lang: str) -> tuple[str, Any]:
        src = self._map_to_3letter(source_lang) or "eng"
        tgt = self._map_to_3letter(target_lang) or "spa"

        inputs = self.processor(text=text, src_lang=src, return_tensors="pt").to(DEVICE)
        with torch.no_grad():
            out = self.model.generate(**inputs, tgt_lang=tgt, generate_speech=True)
            if hasattr(out, "waveform"):
                audio_waveform = out.waveform[0].cpu().numpy().squeeze()
            else:
                audio_waveform = out[0].cpu().numpy().squeeze()
            return text, audio_waveform


_REGISTRY: dict[str, BaseTranslator] = {}


def get_translator(model_id: str) -> BaseTranslator:
    if os.environ.get("MOCK_ML_SERVICE", "false").lower() == "true":
        return MockTranslator(model_id)

    if model_id not in _REGISTRY:
        factories: dict[str, type[BaseTranslator]] = {
            "nllb-200": NLLBTranslator,
            "m2m100": M2M100Translator,
            "seamless-m4t": SeamlessM4TTranslator,
            "marianmt": MarianTranslator,
            "opus-mt": OpusTranslator,
            "indictrans2": IndicTrans2Translator,
            "domain-finetuned": DomainFineTunedTranslator,
        }
        cls = factories.get(model_id)
        if cls is None:
            raise ValueError(f"Unknown model: {model_id}")
        _REGISTRY[model_id] = cls()
    return _REGISTRY[model_id]

