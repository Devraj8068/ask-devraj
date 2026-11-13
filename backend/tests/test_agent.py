"""Tests run with scripted fake LLMs (no API key needed) and the real hybrid retriever."""

import json

import pytest
from fastapi.testclient import TestClient
from langchain_core.language_models.fake_chat_models import GenericFakeChatModel
from langchain_core.messages import AIMessage

from app.config import settings
from app.graphs import build_chat_graph, build_fit_graph, score_fit
from app.knowledge import load_chunks
from app.llm import build_llms, parse_json
from app.main import RateLimiter, create_app
from app.retriever import HybridRetriever


@pytest.fixture(scope="session")
def retriever() -> HybridRetriever:
    return HybridRetriever(load_chunks(settings.knowledge_dir), settings.embed_model)


def fake(*responses: str) -> GenericFakeChatModel:
    return GenericFakeChatModel(messages=iter([AIMessage(content=r) for r in responses]))


def llms(main: list[str], fast: list[str]):
    return build_llms(fake(*main), fake(*fast), json_mode=False)


async def run(graph, inputs) -> list[dict]:
    return [e async for e in graph.astream(inputs, stream_mode="custom")]


# ------------------------------------------------------------------ knowledge + retrieval


def test_knowledge_chunks_have_sections_and_urls():
    chunks = load_chunks(settings.knowledge_dir)
    assert len(chunks) > 20
    assert all(c.section and c.text and c.url.startswith("#") for c in chunks)


@pytest.mark.parametrize(
    "query, expected_section",
    [
        ("Has he worked with AWS cloud?", "Cloud and AI services"),
        ("hallucination reduction multi-agent RAG", "Role-based multi-agent RAG system"),
        ("computer vision YOLO grading", "Answer sheet re-evaluation system (computer vision)"),
        ("legal assistant for lawyers", "LegisAI: court hearing preparation tool"),
        ("Where did he study?", "Degree"),
    ],
)
def test_hybrid_retrieval_finds_the_right_section(retriever, query, expected_section):
    top3 = [h.chunk.section for h in retriever.search(query, k=3)]
    assert expected_section in top3, top3


def test_parse_json_tolerates_fences():
    assert parse_json('```json\n{"a": 1}\n```') == {"a": 1}
    assert parse_json("nope") == {}


# --------------------------------------------------------------------------- chat graph


async def test_chat_flow_streams_trace_tokens_and_verdict(retriever):
    graph = build_chat_graph(
        retriever,
        llms(
            main=["He used AWS EC2 and S3 [1].", json.dumps({"supported": True, "unsupported_claims": []})],
            fast=[json.dumps({"intent": "about", "queries": ["AWS cloud services"]})],
        ),
    )
    events = await run(graph, {"question": "Does he know AWS?", "history": []})
    steps = [(e["id"], e["status"]) for e in events if e["type"] == "step"]
    assert steps == [
        ("planner", "running"), ("planner", "done"),
        ("retriever", "running"), ("retriever", "done"),
        ("answerer", "running"), ("answerer", "done"),
        ("validator", "running"), ("validator", "done"),
    ]
    assert "".join(e["text"] for e in events if e["type"] == "token") == "He used AWS EC2 and S3 [1]."
    sources = next(e for e in events if e["type"] == "sources")["items"]
    assert sources[0]["n"] == 1 and sources[0]["url"].startswith("#")
    assert next(e for e in events if e["type"] == "verdict")["supported"] is True


async def test_chat_revises_unsupported_claims(retriever):
    graph = build_chat_graph(
        retriever,
        llms(
            main=[
                "He has 10 years of Kubernetes experience [1].",
                json.dumps({"supported": False, "unsupported_claims": ["10 years of Kubernetes"]}),
                "I don't have information about Kubernetes experience.",
            ],
            fast=[json.dumps({"intent": "about", "queries": ["Kubernetes"]})],
        ),
    )
    events = await run(graph, {"question": "Kubernetes?", "history": []})
    assert any(e["type"] == "step" and e["id"] == "reviser" for e in events)
    assert next(e for e in events if e["type"] == "replace")["text"].startswith("I don't have")


async def test_off_topic_skips_retrieval_and_validation(retriever):
    graph = build_chat_graph(
        retriever,
        llms(main=["I only answer questions about Devraj."], fast=[json.dumps({"intent": "off_topic", "queries": []})]),
    )
    events = await run(graph, {"question": "Write me a poem", "history": []})
    ids = {e["id"] for e in events if e["type"] == "step"}
    assert ids == {"planner", "answerer"}


async def test_bad_planner_json_falls_back_to_retrieval(retriever):
    graph = build_chat_graph(
        retriever,
        llms(main=["Answer [1].", json.dumps({"supported": True})], fast=["not json"]),
    )
    events = await run(graph, {"question": "What projects has he built?", "history": []})
    assert any(e["type"] == "sources" for e in events)


# ---------------------------------------------------------------------------- fit check


def test_score_weights_must_haves_double():
    reqs = [{"priority": "must"}, {"priority": "nice"}]
    assert score_fit(reqs, [{"status": "match"}, {"status": "gap"}]) == 67
    assert score_fit(reqs, [{"status": "partial"}, {"status": "match"}]) == 67
    assert score_fit([], []) == 0


async def test_fit_flow_validates_and_downgrades(retriever):
    extract = {
        "role": "GenAI Engineer",
        "company": "Acme",
        "requirements": [
            {"text": "LangGraph multi-agent systems", "priority": "must"},
            {"text": "Kubernetes", "priority": "nice"},
            {"text": "AWS", "priority": "must"},
        ],
    }
    assess = {
        "assessments": [
            {"index": 0, "status": "match", "evidence": "Built role-based agents [1].", "sources": [1]},
            {"index": 1, "status": "match", "evidence": "Runs Kubernetes clusters.", "sources": []},  # no source -> partial
            {"index": 2, "status": "match", "evidence": "Uses AWS EC2 [2].", "sources": [2]},
        ],
        "summary": "Strong GenAI overlap.",
        "talking_points": ["+68% accuracy"],
    }
    graph = build_fit_graph(
        retriever,
        llms(main=[json.dumps(extract), json.dumps(assess), json.dumps({"unsupported": [1]})], fast=[]),
    )
    events = await run(graph, {"jd": "x" * 100})
    result = next(e for e in events if e["type"] == "fit")["result"]
    statuses = [r["status"] for r in result["rows"]]
    # row 1: uncited match -> partial by the assessor guard; the validator flag keeps it at partial
    assert statuses == ["match", "partial", "match"]
    assert result["rows"][1]["downgraded"] is True
    assert result["score"] == 90  # (2 + 0.5 + 2) / (2 + 1 + 2)


# --------------------------------------------------------------------------------- API


def test_api_streams_sse_and_rate_limits(retriever, monkeypatch):
    models = llms(
        main=["Hello [1].", json.dumps({"supported": True})],
        fast=[json.dumps({"intent": "about", "queries": ["profile"]})],
    )
    app = create_app(llms=models, retriever=retriever)
    with TestClient(app) as client:
        assert client.get("/api/health").json()["chunks"] > 20
        r = client.post("/api/chat", json={"question": "Who is Devraj?"})
        assert r.status_code == 200
        events = [json.loads(line[6:]) for line in r.text.splitlines() if line.startswith("data: ")]
        assert events[-1]["type"] == "done"
        assert client.post("/api/fit", json={"jd": "too short"}).status_code == 422


def test_rate_limiter_blocks_after_limit():
    limiter = RateLimiter(per_minute=2, per_day=10)
    limiter.check("ip")
    limiter.check("ip")
    with pytest.raises(Exception) as exc:
        limiter.check("ip")
    assert exc.value.status_code == 429
    limiter.check("other-ip")
