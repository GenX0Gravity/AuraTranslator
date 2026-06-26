"""Zero-shot semantic domain classification using SentenceTransformers."""

from __future__ import annotations

import os
import sys
from typing import Any, Dict
import numpy as np

# Description keywords/phrases to represent each of the eight domains
DOMAINS: Dict[str, list[str]] = {
    "medical": [
        "medical diagnosis, clinical treatment, and patient health care",
        "hospitals, doctors, patients, and health care services",
        "anatomy, pharmacology, disease prevention, and pharmacy",
        "clinical trial, surgery, symptoms, and medical records"
    ],
    "legal": [
        "legal contract, agreement, and terms of service",
        "court trial, lawsuit, litigation, and judicial hearing",
        "lawyer, attorney, judge, prosecution, and defense",
        "statutes, regulations, intellectual property, and compliance"
    ],
    "education": [
        "school curriculum, classroom teaching, and learning pedagogy",
        "students, teachers, textbooks, homework, and academic courses",
        "educational materials, schools, colleges, and university lectures",
        "e-learning, tutoring, instruction, and student assessment"
    ],
    "finance": [
        "bank account, investment portfolio, stock market, and wealth",
        "corporate finance, accounting, revenue, and auditing",
        "macroeconomics, inflation, monetary policy, and interest rates",
        "tax return, budget, financial statements, and assets"
    ],
    "engineering": [
        "civil engineering, structural design, and construction projects",
        "mechanical parts, engine design, hardware, and machinery",
        "electrical engineering, power grid, and circuits",
        "manufacturing specifications, blueprint, CAD modeling, and industrial systems"
    ],
    "software_development": [
        "software development, programming languages, and coding",
        "computer database, SQL, web applications, and backend systems",
        "git repositories, codebase, APIs, and software architecture",
        "cloud computing, debugging, compiler, and frontend framework"
    ],
    "government": [
        "government policy, public administration, and state governance",
        "municipal council, federal legislation, and public affairs",
        "official administrative guidelines, civil service, and elections",
        "diplomatic relations, policy regulation, and state documents"
    ],
    "academic_research": [
        "academic research paper, scientific journals, and scholarly studies",
        "hypothesis testing, research methodology, and data analysis",
        "literature review, university research labs, and bibliography",
        "academic thesis, scientific experiment, and peer review"
    ]
}

class DomainClassifier:
    def __init__(self) -> None:
        self._model = None
        self._domain_embeddings = None
        self.threshold = 0.22  # Fallback to 'general' if similarity score is below this

    def _get_model(self) -> Any:
        if self._model is None:
            # Re-use the existing model from TM manager if loaded, avoiding duplicate memory overhead
            try:
                if "app.main" in sys.modules and hasattr(sys.modules["app.main"], "get_tm_manager"):
                    self._model = sys.modules["app.main"].get_tm_manager()._get_model()
                else:
                    # Look up from tm manager module directly
                    from app.tm.manager import TranslationMemoryManager
                    # Create a dummy manager or look up TM_EMBEDDING_MODEL
                    model_name = os.environ.get("TM_EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
                    from app.models.registry import CACHE_DIR
                    from sentence_transformers import SentenceTransformer
                    self._model = SentenceTransformer(model_name, cache_folder=CACHE_DIR)
            except Exception:
                from sentence_transformers import SentenceTransformer
                from app.models.registry import CACHE_DIR
                model_name = os.environ.get("TM_EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
                self._model = SentenceTransformer(model_name, cache_folder=CACHE_DIR)
        return self._model

    def _get_domain_embeddings(self) -> Dict[str, np.ndarray]:
        if self._domain_embeddings is None:
            model = self._get_model()
            self._domain_embeddings = {}
            for domain, phrases in DOMAINS.items():
                # Encode all phrases for this domain
                embeddings = model.encode(phrases, normalize_embeddings=True)
                # Average them to represent the domain vector
                avg_embedding = np.mean(embeddings, axis=0)
                # Re-normalize to a unit vector so we can use dot product for cosine similarity
                norm = np.linalg.norm(avg_embedding)
                if norm > 0:
                    avg_embedding = avg_embedding / norm
                self._domain_embeddings[domain] = avg_embedding
        return self._domain_embeddings

    def classify(self, text: str) -> Dict[str, Any]:
        trimmed = text.strip()
        if not trimmed:
            return {
                "domain": "general",
                "confidence": 1.0,
                "scores": {d: 0.0 for d in DOMAINS}
            }

        # Encode input text to a normalized embedding
        model = self._get_model()
        text_embedding = model.encode([trimmed], normalize_embeddings=True)[0]

        # Calculate cosine similarity with each domain vector
        domain_vectors = self._get_domain_embeddings()
        scores: Dict[str, float] = {}
        for domain, vector in domain_vectors.items():
            # Dot product of normalized vectors = Cosine Similarity
            similarity = float(np.dot(text_embedding, vector))
            scores[domain] = round(similarity, 4)

        # Find best domain
        best_domain = max(scores, key=scores.get)  # type: ignore
        best_score = scores[best_domain]

        if best_score < self.threshold:
            resolved_domain = "general"
        else:
            resolved_domain = best_domain

        return {
            "domain": resolved_domain,
            "confidence": round(best_score, 4),
            "scores": scores
        }
