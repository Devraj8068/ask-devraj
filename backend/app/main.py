"""FastAPI entry point: streams agent events to the browser as Server-Sent Events."""

import json
import logging
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator, Literal

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from .config import settings
from .graphs import build_chat_graph, build_fit_graph
from .knowledge import load_chunks
from .llm import LLMs, groq_llms
from .retriever import HybridRetriever

log = logging.getLogger("ask-devraj")


class Turn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=4000)


class ChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=settings.max_question_chars)
    history: list[Turn] = Field(default_factory=list, max_length=12)


class FitRequest(BaseModel):
    jd: str = Field(min_length=80, max_length=settings.max_jd_chars)


class RateLimiter:
    """In-memory sliding windows per client IP (fine for a single small instance)."""

    def __init__(self, per_minute: int, per_day: int):
        self.limits = [(60, per_minute), (86_400, per_day)]
        self.hits: dict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str) -> None:
        now = time.time()
        q = self.hits[key]
        while q and now - q[0] > 86_400:
            q.popleft()
        for window, limit in self.limits:
            if sum(1 for t in q if now - t <= window) >= limit:
                period = "minute" if window == 60 else "day"
                raise HTTPException(429, f"You've reached the limit of {limit} questions per {period}. Please try again later.")
        q.append(now)


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    return forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "unknown")


def create_app(llms: LLMs | None = None, retriever: HybridRetriever | None = None) -> FastAPI:
    state: dict[str, Any] = {}

    def agents() -> dict[str, Any]:
        """Build the retriever and graphs once, on first use.

        Lazy so it also works on serverless platforms that don't run lifespan hooks.
        """
        if not state:
            r = retriever or HybridRetriever(load_chunks(settings.knowledge_dir), settings.embed_model)
            models = llms or groq_llms()
            state.update(
                chat=build_chat_graph(r, models, settings.top_k),
                fit=build_fit_graph(r, models),
                chunks=len(r.chunks),
            )
            log.info("Ready: %d knowledge chunks indexed", len(r.chunks))
        return state

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        agents()  # warm up when the server supports lifespan
        yield

    app = FastAPI(title="Ask Devraj API", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )
    limiter = RateLimiter(settings.rate_per_minute, settings.rate_per_day)

    async def sse(events: AsyncIterator[dict]) -> AsyncIterator[str]:
        t0 = time.perf_counter()
        try:
            async for event in events:
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as exc:  # surface a friendly error instead of a dropped connection
            log.exception("agent run failed")
            msg = str(exc)
            if "rate limit" in msg.lower() or "429" in msg:
                msg = "The agent is getting a lot of questions right now (free-tier limit). Please try again in a minute."
            elif not isinstance(exc, ValueError):
                msg = "Something went wrong while answering. Please try again."
            yield f"data: {json.dumps({'type': 'error', 'message': msg})}\n\n"
        yield f"data: {json.dumps({'type': 'done', 'ms': round((time.perf_counter() - t0) * 1000)})}\n\n"

    def stream(events: AsyncIterator[dict]) -> StreamingResponse:
        return StreamingResponse(
            sse(events),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    @app.get("/api/health")
    async def health() -> dict:
        return {"ok": True, "chunks": agents()["chunks"]}

    @app.post("/api/chat")
    async def chat(body: ChatRequest, request: Request) -> StreamingResponse:
        limiter.check(client_ip(request))
        inputs = {"question": body.question.strip(), "history": [t.model_dump() for t in body.history]}
        return stream(agents()["chat"].astream(inputs, stream_mode="custom"))

    @app.post("/api/fit")
    async def fit(body: FitRequest, request: Request) -> StreamingResponse:
        limiter.check(client_ip(request))
        return stream(agents()["fit"].astream({"jd": body.jd.strip()}, stream_mode="custom"))

    return app


logging.basicConfig(level=logging.INFO)
app = create_app()
