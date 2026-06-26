"""Language detection endpoint logic."""

from __future__ import annotations

import re

try:
    from langdetect import detect_langs
except ImportError:
    detect_langs = None  # type: ignore

SCRIPT_LANG = [
    (r"[\u0900-\u097F]", "hi", 0.92),
    (r"[\u0980-\u09FF]", "bn", 0.92),
    (r"[\u0B80-\u0BFF]", "ta", 0.92),
    (r"[\u0C00-\u0C7F]", "te", 0.92),
    (r"[\u0C80-\u0CFF]", "kn", 0.92),
    (r"[\u0D00-\u0D7F]", "ml", 0.92),
    (r"[\u3040-\u309F\u30A0-\u30FF]", "ja", 0.95),
    (r"[\u4E00-\u9FFF]", "zh", 0.90),
    (r"[\uAC00-\uD7AF]", "ko", 0.95),
    (r"[\u0600-\u06FF]", "ar", 0.88),
]


def detect_language(text: str) -> dict[str, float | str]:
    trimmed = text.strip()
    if not trimmed:
        return {"language": "en", "confidence": 0.5}

    for pattern, lang, conf in SCRIPT_LANG:
        if re.search(pattern, trimmed):
            return {"language": lang, "confidence": conf}

    if detect_langs:
        try:
            results = detect_langs(trimmed[:1000])
            if results:
                best = results[0]
                return {"language": best.lang, "confidence": round(best.prob, 3)}
        except Exception:
            pass

    return {"language": "en", "confidence": 0.55}
