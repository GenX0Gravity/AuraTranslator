import os
import hashlib
from typing import Any, Dict, List, Optional
from app.models.registry import CACHE_DIR
from app.tm.store import ChromaTMStore, FAISSTMStore, BaseTMStore

class TranslationMemoryManager:
    def __init__(self, model_name: Optional[str] = None, store_type: Optional[str] = None) -> None:
        self.model_name = model_name or os.environ.get("TM_EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
        self.store_type = store_type or os.environ.get("TM_DATABASE_TYPE", "chromadb").lower()
        self._model = None
        self.store: Optional[BaseTMStore] = None

    def _get_model(self):
        if self._model is None:
            from sentence_transformers import SentenceTransformer
            self._model = SentenceTransformer(self.model_name, cache_folder=CACHE_DIR)
        return self._model

    def _initialize_store(self, dimension: int) -> None:
        if self.store is not None:
            return

        if self.store_type == "faiss":
            persist_dir = os.path.join(CACHE_DIR, "tm-faiss")
            self.store = FAISSTMStore(persist_dir=persist_dir, dimension=dimension)
        else:
            persist_dir = os.path.join(CACHE_DIR, "tm-chroma")
            self.store = ChromaTMStore(persist_dir=persist_dir)

    def _get_embedding(self, text: str) -> List[float]:
        model = self._get_model()
        # L2-normalize embeddings so that inner product equals cosine similarity
        embedding = model.encode([text], normalize_embeddings=True)[0]
        dimension = len(embedding)
        self._initialize_store(dimension)
        return embedding.tolist()

    def add(
        self,
        source_text: str,
        target_translation: str,
        source_lang: str,
        target_lang: str,
        domain: str = "general",
        rating: float = 5.0,
        corrections: Optional[List[str]] = None
    ) -> str:
        trimmed = source_text.strip()
        # Create deterministic ID based on source, target and language pair
        key = f"{source_lang}:{target_lang}:{trimmed.lower()}"
        entry_id = hashlib.sha256(key.encode("utf-8")).hexdigest()

        embedding = self._get_embedding(trimmed)
        
        self.store.add(
            entry_id=entry_id,
            embedding=embedding,
            source_text=trimmed,
            target_translation=target_translation.strip(),
            source_lang=source_lang,
            target_lang=target_lang,
            domain=domain,
            rating=rating,
            corrections=corrections or []
        )
        return entry_id

    def search(
        self,
        query: str,
        source_lang: str,
        target_lang: str,
        domain: str = "general",
        threshold: float = 0.85,
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        trimmed = query.strip()
        if not trimmed:
            return []

        embedding = self._get_embedding(trimmed)
        
        matches = self.store.search(
            embedding=embedding,
            source_lang=source_lang,
            target_lang=target_lang,
            domain=domain,
            limit=limit
        )

        # Filter by similarity threshold
        filtered_matches = [m for m in matches if m["similarity"] >= threshold]
        # Sort by similarity descending
        filtered_matches.sort(key=lambda x: x["similarity"], reverse=True)
        return filtered_matches

    def update(
        self,
        entry_id: str,
        rating: Optional[float] = None,
        correction: Optional[str] = None
    ) -> bool:
        # Initialize store by querying dimension dynamically if not initialized yet
        if self.store is None:
            # Run a dummy encoding to trigger initialization
            self._get_embedding("dummy")
        
        return self.store.update(
            entry_id=entry_id,
            rating=rating,
            correction=correction
        )

    def get(self, entry_id: str) -> Optional[Dict[str, Any]]:
        if self.store is None:
            self._get_embedding("dummy")
        return self.store.get(entry_id)
