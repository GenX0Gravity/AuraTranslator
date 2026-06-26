import os
import json
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
import numpy as np

# Lazy load FAISS and ChromaDB to avoid import overhead if one is not used
class BaseTMStore(ABC):
    @abstractmethod
    def add(
        self,
        entry_id: str,
        embedding: List[float],
        source_text: str,
        target_translation: str,
        source_lang: str,
        target_lang: str,
        domain: str,
        rating: float,
        corrections: List[str]
    ) -> None:
        pass

    @abstractmethod
    def search(
        self,
        embedding: List[float],
        source_lang: str,
        target_lang: str,
        domain: str,
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def update(
        self,
        entry_id: str,
        rating: Optional[float] = None,
        correction: Optional[str] = None
    ) -> bool:
        pass

    @abstractmethod
    def get(self, entry_id: str) -> Optional[Dict[str, Any]]:
        pass


class ChromaTMStore(BaseTMStore):
    def __init__(self, persist_dir: str) -> None:
        import chromadb
        os.makedirs(persist_dir, exist_ok=True)
        self.client = chromadb.PersistentClient(path=persist_dir)
        # Cosine space: distance is 1.0 - cosine_similarity
        self.collection = self.client.get_or_create_collection(
            name="translation_memory",
            metadata={"hnsw:space": "cosine"}
        )

    def add(
        self,
        entry_id: str,
        embedding: List[float],
        source_text: str,
        target_translation: str,
        source_lang: str,
        target_lang: str,
        domain: str,
        rating: float,
        corrections: List[str]
    ) -> None:
        metadata = {
            "source_text": source_text,
            "target_translation": target_translation,
            "source_lang": source_lang,
            "target_lang": target_lang,
            "domain": domain,
            "user_ratings": json.dumps([rating]),
            "average_rating": float(rating),
            "corrections": json.dumps(corrections),
        }
        self.collection.upsert(
            ids=[entry_id],
            embeddings=[embedding],
            documents=[source_text],
            metadatas=[metadata]
        )

    def search(
        self,
        embedding: List[float],
        source_lang: str,
        target_lang: str,
        domain: str,
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        # Filter metadata by languages and domain
        where_clause = {
            "$and": [
                {"source_lang": source_lang},
                {"target_lang": target_lang},
                {"domain": domain}
            ]
        }
        results = self.collection.query(
            query_embeddings=[embedding],
            n_results=limit,
            where=where_clause
        )

        output = []
        if not results or not results["ids"] or len(results["ids"][0]) == 0:
            return output

        ids = results["ids"][0]
        distances = results["distances"][0]
        metadatas = results["metadatas"][0]

        for i in range(len(ids)):
            meta = metadatas[i]
            # Convert distance to similarity score: similarity = 1.0 - distance
            similarity = 1.0 - distances[i]
            
            output.append({
                "id": ids[i],
                "source_text": meta.get("source_text"),
                "target_translation": meta.get("target_translation"),
                "source_lang": meta.get("source_lang"),
                "target_lang": meta.get("target_lang"),
                "domain": meta.get("domain"),
                "user_ratings": json.loads(meta.get("user_ratings", "[]")),
                "average_rating": meta.get("average_rating", 0.0),
                "corrections": json.loads(meta.get("corrections", "[]")),
                "similarity": float(similarity)
            })
        return output

    def update(
        self,
        entry_id: str,
        rating: Optional[float] = None,
        correction: Optional[str] = None
    ) -> bool:
        entry = self.get(entry_id)
        if not entry:
            return False

        metadatas = self.collection.get(ids=[entry_id])["metadatas"]
        if not metadatas:
            return False

        meta = metadatas[0]
        user_ratings = json.loads(meta.get("user_ratings", "[]"))
        corrections = json.loads(meta.get("corrections", "[]"))

        if rating is not None:
            user_ratings.append(rating)
            meta["user_ratings"] = json.dumps(user_ratings)
            meta["average_rating"] = float(np.mean(user_ratings))

        if correction is not None and correction.strip():
            # Update target_translation to the latest correction and append to corrections history
            meta["target_translation"] = correction.strip()
            if correction.strip() not in corrections:
                corrections.append(correction.strip())
            meta["corrections"] = json.dumps(corrections)

        self.collection.update(
            ids=[entry_id],
            metadatas=[meta]
        )
        return True

    def get(self, entry_id: str) -> Optional[Dict[str, Any]]:
        res = self.collection.get(ids=[entry_id])
        if not res or not res["ids"] or len(res["ids"]) == 0:
            return None
        meta = res["metadatas"][0]
        return {
            "id": res["ids"][0],
            "source_text": meta.get("source_text"),
            "target_translation": meta.get("target_translation"),
            "source_lang": meta.get("source_lang"),
            "target_lang": meta.get("target_lang"),
            "domain": meta.get("domain"),
            "user_ratings": json.loads(meta.get("user_ratings", "[]")),
            "average_rating": meta.get("average_rating", 0.0),
            "corrections": json.loads(meta.get("corrections", "[]"))
        }


class FAISSTMStore(BaseTMStore):
    def __init__(self, persist_dir: str, dimension: int = 384) -> None:
        import faiss
        self.faiss = faiss
        self.persist_dir = persist_dir
        self.dimension = dimension
        self.index_path = os.path.join(persist_dir, "index.faiss")
        self.meta_path = os.path.join(persist_dir, "metadata.json")

        os.makedirs(persist_dir, exist_ok=True)
        
        # Load or initialize FAISS IndexFlatIP (Inner Product index for cosine similarity)
        if os.path.exists(self.index_path):
            self.index = faiss.read_index(self.index_path)
        else:
            self.index = faiss.IndexFlatIP(dimension)

        # Load or initialize Metadata
        if os.path.exists(self.meta_path):
            with open(self.meta_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                self.metadata = data.get("metadata", {})
                self.id_to_faiss_idx = {k: int(v) for k, v in data.get("id_to_faiss_idx", {}).items()}
                self.faiss_idx_to_id = {int(k): v for k, v in data.get("faiss_idx_to_id", {}).items()}
        else:
            self.metadata = {}
            self.id_to_faiss_idx = {}
            self.faiss_idx_to_id = {}

    def _save(self) -> None:
        self.faiss.write_index(self.index, self.index_path)
        with open(self.meta_path, "w", encoding="utf-8") as f:
            json.dump({
                "metadata": self.metadata,
                "id_to_faiss_idx": self.id_to_faiss_idx,
                "faiss_idx_to_id": self.faiss_idx_to_id
            }, f, indent=2, ensure_ascii=False)

    def add(
        self,
        entry_id: str,
        embedding: List[float],
        source_text: str,
        target_translation: str,
        source_lang: str,
        target_lang: str,
        domain: str,
        rating: float,
        corrections: List[str]
    ) -> None:
        vector = np.array([embedding], dtype=np.float32)
        # Normalize vector to ensure Inner Product is exactly Cosine Similarity
        faiss_norm = np.linalg.norm(vector)
        if faiss_norm > 0:
            vector = vector / faiss_norm

        if entry_id in self.id_to_faiss_idx:
            # Upsert case: we update the metadata. Replacing vectors in FAISS IndexFlat is complex,
            # but since it's a small app, we can just overwrite the metadata and keep the FAISS vector.
            pass
        else:
            faiss_idx = self.index.ntotal
            self.index.add(vector)
            self.id_to_faiss_idx[entry_id] = faiss_idx
            self.faiss_idx_to_id[faiss_idx] = entry_id

        self.metadata[entry_id] = {
            "source_text": source_text,
            "target_translation": target_translation,
            "source_lang": source_lang,
            "target_lang": target_lang,
            "domain": domain,
            "user_ratings": [rating],
            "average_rating": float(rating),
            "corrections": corrections
        }
        self._save()

    def search(
        self,
        embedding: List[float],
        source_lang: str,
        target_lang: str,
        domain: str,
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        if self.index.ntotal == 0:
            return []

        vector = np.array([embedding], dtype=np.float32)
        faiss_norm = np.linalg.norm(vector)
        if faiss_norm > 0:
            vector = vector / faiss_norm

        # Search FAISS index. FlatIP returns inner product (similarity) directly.
        similarities, indices = self.index.search(vector, min(limit * 2, self.index.ntotal))
        
        output = []
        if len(indices) == 0:
            return []

        for i in range(len(indices[0])):
            idx = int(indices[0][i])
            sim = float(similarities[0][i])
            if idx == -1:
                continue

            entry_id = self.faiss_idx_to_id.get(idx)
            if not entry_id:
                continue

            meta = self.metadata.get(entry_id)
            if not meta:
                continue

            # Apply domain and language filters
            if (meta.get("source_lang") == source_lang and 
                meta.get("target_lang") == target_lang and 
                meta.get("domain") == domain):
                
                output.append({
                    "id": entry_id,
                    "source_text": meta.get("source_text"),
                    "target_translation": meta.get("target_translation"),
                    "source_lang": meta.get("source_lang"),
                    "target_lang": meta.get("target_lang"),
                    "domain": meta.get("domain"),
                    "user_ratings": meta.get("user_ratings", []),
                    "average_rating": meta.get("average_rating", 0.0),
                    "corrections": meta.get("corrections", []),
                    "similarity": sim
                })

            if len(output) >= limit:
                break

        return output

    def update(
        self,
        entry_id: str,
        rating: Optional[float] = None,
        correction: Optional[str] = None
    ) -> bool:
        meta = self.metadata.get(entry_id)
        if not meta:
            return False

        if rating is not None:
            meta["user_ratings"].append(rating)
            meta["average_rating"] = float(np.mean(meta["user_ratings"]))

        if correction is not None and correction.strip():
            meta["target_translation"] = correction.strip()
            if correction.strip() not in meta["corrections"]:
                meta["corrections"].append(correction.strip())

        self._save()
        return True

    def get(self, entry_id: str) -> Optional[Dict[str, Any]]:
        meta = self.metadata.get(entry_id)
        if not meta:
            return None
        return {
            "id": entry_id,
            "source_text": meta.get("source_text"),
            "target_translation": meta.get("target_translation"),
            "source_lang": meta.get("source_lang"),
            "target_lang": meta.get("target_lang"),
            "domain": meta.get("domain"),
            "user_ratings": meta.get("user_ratings", []),
            "average_rating": meta.get("average_rating", 0.0),
            "corrections": meta.get("corrections", [])
        }
