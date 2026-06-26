"""Model benchmarking across language pairs."""

from __future__ import annotations

import time
from typing import Any

from app.models.registry import get_translator
from app.router import route_model


def run_benchmark(
    source_lang: str,
    target_lang: str,
    samples: list[str],
    reference: list[str] | None = None,
) -> dict[str, Any]:
    models = ["indictrans2", "nllb-200", "m2m100", "seamless-m4t", "marianmt", "opus-mt"]
    results: list[dict[str, Any]] = []

    for model_id in models:
        try:
            translator = get_translator(model_id)
            if not translator.is_supported(source_lang, target_lang):
                continue

            latencies: list[float] = []
            hypotheses: list[str] = []

            for sample in samples[:5]:
                out = translator.translate(sample, source_lang, target_lang)
                latencies.append(out.latency_ms)
                hypotheses.append(out.text)

            entry: dict[str, Any] = {
                "model": model_id,
                "language_pair": f"{source_lang}-{target_lang}",
                "latency_ms": round(sum(latencies) / len(latencies), 2) if latencies else 0,
                "sample_count": len(hypotheses),
                "hypotheses": hypotheses,
            }

            if reference and len(reference) == len(hypotheses):
                try:
                    import sacrebleu
                    bleu = sacrebleu.corpus_bleu(hypotheses, [reference])
                    entry["bleu_score"] = round(bleu.score, 2)
                except Exception:
                    pass

            results.append(entry)
        except Exception as exc:
            results.append({"model": model_id, "error": str(exc)})

    best = min(
        [r for r in results if "latency_ms" in r],
        key=lambda x: (-(x.get("bleu_score") or 0), x["latency_ms"]),
        default=None,
    )

    return {
        "language_pair": f"{source_lang}-{target_lang}",
        "results": results,
        "recommended_model": best["model"] if best else route_model(source_lang, target_lang),
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
