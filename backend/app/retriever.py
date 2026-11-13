"""Hybrid retriever: BM25 keyword search + FAISS dense search, fused with Reciprocal Rank Fusion.

Dense vectors come from a small model2vec static-embedding model bundled with the code,
so the API starts fast and fits comfortably in serverless memory limits.
"""

import re
from dataclasses import dataclass

import faiss
import numpy as np
from model2vec import StaticModel
from rank_bm25 import BM25Okapi

from .knowledge import Chunk

_TOKEN = re.compile(r"[a-z0-9+#.]+")
RRF_K = 60  # standard RRF damping constant
STOPWORDS = set(
    "a an and are as at be by did do does for from has have he him his how i in is it of on or "
    "the to was what when where which who why with you your about any can tell me devraj gaikwad".split()
)


def stem(token: str) -> str:
    """Tiny suffix stripper so 'studied'/'studies'/'study' and 'agents'/'agent' match."""
    if len(token) <= 4 or not token.isalpha():
        return token
    for suffix, repl in (("ies", "y"), ("ied", "y"), ("ing", ""), ("ed", ""), ("es", ""), ("s", "")):
        if token.endswith(suffix) and len(token) - len(suffix) >= 3:
            return token[: -len(suffix)] + repl
    return token


def tokenize(text: str) -> list[str]:
    tokens = (t.strip(".") for t in _TOKEN.findall(text.lower()))
    return [stem(t) for t in tokens if t and t not in STOPWORDS]


@dataclass
class Hit:
    chunk: Chunk
    score: float  # fused RRF score
    dense: float  # cosine similarity, useful for the trace panel


class HybridRetriever:
    def __init__(self, chunks: list[Chunk], embed_model: str):
        self.chunks = chunks
        self.bm25 = BM25Okapi([tokenize(c.as_context()) for c in chunks])
        self.embedder = StaticModel.from_pretrained(embed_model)
        vectors = self._normalize(self.embedder.encode([c.as_context() for c in chunks]))
        self.index = faiss.IndexFlatIP(vectors.shape[1])  # inner product on normalized vectors = cosine
        self.index.add(vectors)

    @staticmethod
    def _normalize(embeddings) -> np.ndarray:
        vecs = np.array(list(embeddings), dtype="float32")
        faiss.normalize_L2(vecs)
        return vecs

    def search(self, query: str, k: int = 6) -> list[Hit]:
        n = len(self.chunks)
        sims, ids = self.index.search(self._normalize(self.embedder.encode([query])), n)
        dense_rank = {int(i): r for r, i in enumerate(ids[0])}
        dense_sim = {int(i): float(s) for s, i in zip(sims[0], ids[0])}

        bm25_scores = self.bm25.get_scores(tokenize(query))
        bm25_order = np.argsort(-bm25_scores)
        bm25_rank = {int(i): r for r, i in enumerate(bm25_order) if bm25_scores[i] > 0}

        fused = {}
        for i in range(n):
            score = 1 / (RRF_K + dense_rank[i] + 1)
            if i in bm25_rank:
                score += 1 / (RRF_K + bm25_rank[i] + 1)
            fused[i] = score
        best = sorted(fused, key=fused.get, reverse=True)[:k]
        return [Hit(self.chunks[i], fused[i], dense_sim[i]) for i in best]

    def search_many(self, queries: list[str], k: int = 6) -> list[Hit]:
        """Run several queries and merge results, keeping each chunk's best score."""
        merged: dict[str, Hit] = {}
        for q in queries:
            for hit in self.search(q, k):
                prev = merged.get(hit.chunk.id)
                if prev is None or hit.score > prev.score:
                    merged[hit.chunk.id] = hit
        return sorted(merged.values(), key=lambda h: h.score, reverse=True)[:k]
