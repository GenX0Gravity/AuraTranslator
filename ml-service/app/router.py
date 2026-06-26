"""Intelligent model routing for the ML service based on translation quality."""

from __future__ import annotations

INDIAN_LANGS = {
    "hi", "bn", "mr", "ta", "te", "kn", "ml", "gu", "pa", "as", "or", "ur",
    "hin", "ben", "mar", "tam", "tel", "kan", "mal", "guj", "pan", "ory", "urd", "asm"
}

OPUS_PAIRS = {
    "en-de", "de-en", "en-fr", "fr-en", "en-es", "es-en", "en-it", "it-en",
    "en-pt", "pt-en", "en-ru", "ru-en", "en-ja", "ja-en", "en-zh", "zh-en"
}

SEAMLESS_LANGS = {
    "af", "am", "ar", "as", "ast", "az", "be", "bn", "bs", "bg", "ca", "ceb", "cs", "cy", "da", "de", "el", "en", "es", "et",
    "eu", "fa", "fi", "fr", "fy", "ga", "gd", "gl", "gu", "ha", "he", "hi", "hr", "hu", "hy", "id", "ig", "is", "it", "ja",
    "jv", "ka", "kk", "km", "kn", "ko", "ku", "ky", "lo", "lt", "lv", "mg", "mk", "ml", "mn", "mr", "ms", "mt", "my", "ne",
    "nl", "no", "ny", "or", "pa", "pl", "ps", "pt", "ro", "ru", "sd", "si", "sk", "sl", "so", "sq", "sr", "su", "sv", "sw",
    "ta", "te", "tg", "th", "tl", "tr", "uk", "ur", "uz", "vi", "xh", "yi", "yo", "zu"
}


def normalize_code(lang: str) -> str:
    # Extract prefix (e.g., swh_Latn -> swh, en-US -> en)
    clean = lang.split("_")[0].split("-")[0].lower()
    # Normalize 3-letter to 2-letter
    mapping = {
        "eng": "en", "deu": "de", "fra": "fr", "spa": "es", "ita": "it",
        "por": "pt", "rus": "ru", "ukr": "uk", "pol": "pl", "tur": "tr",
        "arb": "ar", "pes": "fa", "fas": "fa", "heb": "he", "zho": "zh", "jpn": "ja",
        "kor": "ko", "tha": "th", "vie": "vi", "ind": "id", "zsm": "ms",
        "swh": "sw", "ben": "bn", "hin": "hi", "tam": "ta", "tel": "te",
        "mar": "mr", "pan": "pa", "guj": "gu", "urd": "ur", "asm": "as",
        "ory": "or", "kan": "kn", "mal": "ml"
    }
    return mapping.get(clean, clean)


def is_model_supported(model_id: str, src: str, tgt: str, domain: str = "general") -> bool:
    if model_id == "domain-finetuned":
        if domain == "general":
            return False
        import os
        from app.models.registry import DOMAIN_MODEL_DIR
        return os.path.isdir(os.path.join(DOMAIN_MODEL_DIR, domain))

    s = normalize_code(src)
    t = normalize_code(tgt)

    if model_id == "indictrans2":
        return (s in INDIAN_LANGS and t in INDIAN_LANGS) or (s == "en" and t in INDIAN_LANGS) or (s in INDIAN_LANGS and t == "en")

    if model_id in {"opus-mt", "marianmt"}:
        return f"{s}-{t}" in OPUS_PAIRS

    if model_id == "seamless-m4t":
        return s in SEAMLESS_LANGS and t in SEAMLESS_LANGS

    if model_id == "m2m100":
        return s in SEAMLESS_LANGS and t in SEAMLESS_LANGS

    if model_id == "nllb-200":
        return True

    return False


def get_model_quality_score(model_id: str, src: str, tgt: str, domain: str = "general") -> int:
    if not is_model_supported(model_id, src, tgt, domain):
        return -1

    scores = {
        "domain-finetuned": 95,
        "indictrans2": 92,
        "opus-mt": 88,
        "marianmt": 86,  # MarianMT score 86 gives OPUS-MT score 88 strict preference
        "seamless-m4t": 85,
        "nllb-200": 82,
        "m2m100": 75,
    }
    return scores.get(model_id, 0)


def route_model(
    source_lang: str,
    target_lang: str,
    requested_model: str | None = None,
    domain: str = "general",
    lightweight: bool = False,
) -> str:
    if requested_model:
        if is_model_supported(requested_model, source_lang, target_lang, domain):
            return requested_model

    if domain != "general" and is_model_supported("domain-finetuned", source_lang, target_lang, domain):
        return "domain-finetuned"

    if lightweight:
        if is_model_supported("marianmt", source_lang, target_lang, domain):
            return "marianmt"
        if is_model_supported("opus-mt", source_lang, target_lang, domain):
            return "opus-mt"

    models = ["marianmt", "opus-mt", "seamless-m4t", "indictrans2", "nllb-200", "m2m100"]
    best_model = max(
        models,
        key=lambda m: get_model_quality_score(m, source_lang, target_lang, domain),
        default="nllb-200"
    )

    if get_model_quality_score(best_model, source_lang, target_lang, domain) > 0:
        return best_model

    return "nllb-200"
