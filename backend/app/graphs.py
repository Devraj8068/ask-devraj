"""LangGraph agents.

Chat:      Planner -> Retriever -> Answerer -> Validator (-> Reviser)
Fit check: Extractor -> Retriever -> Assessor -> Validator -> Scorer

Every node reports progress through LangGraph's custom stream so the UI can draw a live trace.
"""

import time
from contextlib import contextmanager
from typing import Any, TypedDict

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langgraph.config import get_stream_writer
from langgraph.graph import END, START, StateGraph

from . import prompts
from .llm import LLMs, ask_json
from .retriever import Hit, HybridRetriever


@contextmanager
def step(node: str, label: str):
    """Emit running/done events around a node; the body can attach detail/data via the yielded dict."""
    writer = get_stream_writer()
    info: dict[str, Any] = {"detail": "", "data": {}}
    t0 = time.perf_counter()
    writer({"type": "step", "id": node, "label": label, "status": "running"})
    try:
        yield info
    except Exception as exc:
        writer({"type": "step", "id": node, "label": label, "status": "error", "detail": str(exc)[:200]})
        raise
    ms = round((time.perf_counter() - t0) * 1000)
    writer({"type": "step", "id": node, "label": label, "status": "done", "ms": ms, **info})


def fill(template: str, **values: str) -> str:
    """Substitute {name} placeholders without tripping over literal JSON braces in the template."""
    for key, value in values.items():
        template = template.replace("{" + key + "}", value)
    return template


def number_hits(hits: list[Hit]) -> str:
    return "\n\n".join(f"[{n}] {h.chunk.as_context()}" for n, h in enumerate(hits, 1))


def sources_payload(hits: list[Hit]) -> list[dict]:
    return [
        {"n": n, "title": h.chunk.title, "url": h.chunk.url, "text": h.chunk.text, "score": round(h.dense, 3)}
        for n, h in enumerate(hits, 1)
    ]


def history_messages(history: list[dict]) -> list[BaseMessage]:
    out: list[BaseMessage] = []
    for m in history[-6:]:
        cls = HumanMessage if m.get("role") == "user" else AIMessage
        out.append(cls(content=str(m.get("content", ""))[:1000]))
    return out


# --------------------------------------------------------------------------- chat


class ChatState(TypedDict, total=False):
    question: str
    history: list[dict]
    intent: str
    queries: list[str]
    hits: list[Hit]
    answer: str


def build_chat_graph(retriever: HybridRetriever, llms: LLMs, top_k: int = 6):
    async def planner(state: ChatState) -> ChatState:
        with step("planner", "Planner") as info:
            convo = "\n".join(f"{m['role']}: {m['content'][:300]}" for m in state.get("history", [])[-4:])
            plan = await ask_json(
                llms.json_fast,
                [SystemMessage(prompts.PLANNER), HumanMessage(f"Conversation so far:\n{convo or '(none)'}\n\nLatest message: {state['question']}")],
            )
            intent = plan.get("intent") if plan.get("intent") in {"about", "smalltalk", "off_topic"} else "about"
            queries = [str(q)[:200] for q in plan.get("queries") or [] if str(q).strip()][:3]
            if intent == "about" and not queries:
                queries = [state["question"]]
            info["detail"] = f"intent: {intent}" + (f" · {len(queries)} search quer{'y' if len(queries) == 1 else 'ies'}" if queries else "")
            info["data"] = {"intent": intent, "queries": queries}
        return {"intent": intent, "queries": queries}

    async def retrieve(state: ChatState) -> ChatState:
        with step("retriever", "Retriever") as info:
            hits = retriever.search_many(state["queries"], k=top_k)
            info["detail"] = f"{len(hits)} passages · hybrid BM25 + FAISS"
            info["data"] = {"hits": [{"n": n, "title": h.chunk.title, "score": round(h.dense, 3)} for n, h in enumerate(hits, 1)]}
        get_stream_writer()({"type": "sources", "items": sources_payload(hits)})
        return {"hits": hits}

    async def answer(state: ChatState) -> ChatState:
        writer = get_stream_writer()
        grounded = state.get("intent") == "about"
        with step("answerer", "Answerer") as info:
            system = prompts.ANSWER.format(context=number_hits(state["hits"])) if grounded else prompts.SMALLTALK
            msgs = [SystemMessage(system), *history_messages(state.get("history", [])), HumanMessage(state["question"])]
            parts: list[str] = []
            async for chunk in llms.chat.astream(msgs):
                if chunk.content:
                    parts.append(chunk.content)
                    writer({"type": "token", "text": chunk.content})
            text = "".join(parts).strip()
            info["detail"] = f"{len(text.split())} words" + (" · grounded in sources" if grounded else " · no retrieval needed")
        return {"answer": text}

    async def validate(state: ChatState) -> dict:
        with step("validator", "Validator") as info:
            verdict = await ask_json(
                llms.judge,
                [SystemMessage(prompts.VALIDATOR), HumanMessage(f"CONTEXT:\n{number_hits(state['hits'])}\n\nANSWER:\n{state['answer']}")],
            )
            claims = [str(c) for c in verdict.get("unsupported_claims") or [] if str(c).strip()]
            ok = not claims
            info["detail"] = "all claims supported by sources" if ok else f"{len(claims)} unsupported claim(s) — revising"
            info["data"] = {"supported": ok, "unsupported_claims": claims}
        get_stream_writer()({"type": "verdict", "supported": ok, "claims": claims})
        return {"unsupported": claims}

    async def revise(state: dict) -> ChatState:
        with step("reviser", "Reviser") as info:
            system = prompts.REVISER.format(claims="; ".join(state["unsupported"]), context=number_hits(state["hits"]))
            resp = await llms.chat.ainvoke([SystemMessage(system), HumanMessage(f"ANSWER:\n{state['answer']}")])
            text = str(resp.content).strip()
            info["detail"] = "removed unsupported claims"
        get_stream_writer()({"type": "replace", "text": text})
        return {"answer": text}

    class _State(ChatState, total=False):
        unsupported: list[str]

    g = StateGraph(_State)
    g.add_node("planner", planner)
    g.add_node("retriever", retrieve)
    g.add_node("answerer", answer)
    g.add_node("validator", validate)
    g.add_node("reviser", revise)
    g.add_edge(START, "planner")
    g.add_conditional_edges("planner", lambda s: "retriever" if s["intent"] == "about" else "answerer")
    g.add_edge("retriever", "answerer")
    g.add_conditional_edges("answerer", lambda s: "validator" if s.get("intent") == "about" and s.get("answer") else END)
    g.add_conditional_edges("validator", lambda s: "reviser" if s.get("unsupported") else END)
    g.add_edge("reviser", END)
    return g.compile()


# ---------------------------------------------------------------------- fit check

STATUS_POINTS = {"match": 1.0, "partial": 0.5, "gap": 0.0}
PRIORITY_WEIGHT = {"must": 2, "nice": 1}


class FitState(TypedDict, total=False):
    jd: str
    role: str
    company: str
    requirements: list[dict]
    hits: list[Hit]
    assessments: list[dict]
    summary: str
    talking_points: list[str]


def score_fit(requirements: list[dict], assessments: list[dict]) -> int:
    total = got = 0.0
    for req, a in zip(requirements, assessments):
        w = PRIORITY_WEIGHT.get(req.get("priority"), 1)
        total += w
        got += w * STATUS_POINTS.get(a.get("status"), 0)
    return round(100 * got / total) if total else 0


def build_fit_graph(retriever: HybridRetriever, llms: LLMs):
    async def extract(state: FitState) -> FitState:
        with step("extractor", "Requirement extractor") as info:
            data = await ask_json(llms.json_main, [SystemMessage(prompts.FIT_EXTRACT), HumanMessage(state["jd"])])
            reqs = []
            for r in data.get("requirements") or []:
                text = str(r.get("text", "") if isinstance(r, dict) else r).strip()
                if text:
                    prio = r.get("priority") if isinstance(r, dict) and r.get("priority") in PRIORITY_WEIGHT else "must"
                    reqs.append({"text": text[:160], "priority": prio})
            reqs = reqs[:10]
            if not reqs:
                raise ValueError("Couldn't find concrete requirements in that text. Paste the full job description.")
            role = str(data.get("role") or "this role")[:120]
            info["detail"] = f"{len(reqs)} requirements for {role}"
            info["data"] = {"requirements": reqs}
        return {"requirements": reqs, "role": role, "company": str(data.get("company") or "")[:120]}

    async def retrieve(state: FitState) -> FitState:
        with step("retriever", "Retriever") as info:
            # Retrieve per requirement so every requirement gets its own evidence, then de-duplicate.
            hits, seen = [], set()
            for req in state["requirements"]:
                for hit in retriever.search(req["text"], k=3):
                    if hit.chunk.id not in seen:
                        seen.add(hit.chunk.id)
                        hits.append(hit)
            info["detail"] = f"{len(hits)} passages matched across {len(state['requirements'])} requirements"
            info["data"] = {"hits": [{"n": n, "title": h.chunk.title, "score": round(h.dense, 3)} for n, h in enumerate(hits, 1)]}
        return {"hits": hits}

    async def assess(state: FitState) -> FitState:
        with step("assessor", "Assessor") as info:
            reqs = "\n".join(f"{i}. ({r['priority']}) {r['text']}" for i, r in enumerate(state["requirements"]))
            data = await ask_json(
                llms.json_main,
                [HumanMessage(fill(prompts.FIT_ASSESS, context=number_hits(state["hits"]), requirements=reqs))],
            )
            by_index = {a.get("index"): a for a in data.get("assessments") or [] if isinstance(a, dict)}
            n_hits = len(state["hits"])
            out = []
            for i, _ in enumerate(state["requirements"]):
                a = by_index.get(i, {})
                status = a.get("status") if a.get("status") in STATUS_POINTS else "gap"
                srcs = [s for s in a.get("sources") or [] if isinstance(s, int) and 1 <= s <= n_hits]
                if status != "gap" and not srcs:  # a claimed match must cite evidence
                    status = "partial" if status == "match" else "gap"
                evidence = str(a.get("evidence") or "His profile doesn't show this.")[:300]
                out.append({"status": status, "evidence": evidence, "sources": srcs})
            counts = {s: sum(a["status"] == s for a in out) for s in STATUS_POINTS}
            info["detail"] = f"{counts['match']} match · {counts['partial']} partial · {counts['gap']} gap"
        return {
            "assessments": out,
            "summary": str(data.get("summary") or "")[:800],
            "talking_points": [str(t)[:240] for t in data.get("talking_points") or []][:3],
        }

    async def validate(state: FitState) -> FitState:
        with step("validator", "Validator") as info:
            checkable = [i for i, a in enumerate(state["assessments"]) if a["status"] != "gap"]
            unsupported: set[int] = set()
            if checkable:
                evidence = "\n".join(f"{i}. {state['assessments'][i]['evidence']}" for i in checkable)
                data = await ask_json(
                    llms.judge,
                    [HumanMessage(fill(prompts.FIT_VALIDATE, context=number_hits(state["hits"]), evidence=evidence))],
                )
                unsupported = {i for i in data.get("unsupported") or [] if i in checkable}
            assessments = []
            for i, a in enumerate(state["assessments"]):
                a = dict(a)
                if i in unsupported:
                    # Flawed evidence lowers confidence but doesn't erase cited experience:
                    # a match becomes partial, a partial stays partial (both flagged in the UI).
                    a["status"] = "partial"
                    a["downgraded"] = True
                assessments.append(a)
            info["detail"] = (
                f"verified {len(checkable)} claims" + (f" · downgraded {len(unsupported)}" if unsupported else " · all supported")
            )
            info["data"] = {"checked": len(checkable), "downgraded": sorted(unsupported)}
        return {"assessments": assessments}

    async def finish(state: FitState) -> dict:
        score = score_fit(state["requirements"], state["assessments"])
        rows = [{**r, **a} for r, a in zip(state["requirements"], state["assessments"])]
        get_stream_writer()(
            {
                "type": "fit",
                "result": {
                    "role": state["role"],
                    "company": state.get("company", ""),
                    "score": score,
                    "rows": rows,
                    "summary": state.get("summary", ""),
                    "talking_points": state.get("talking_points", []),
                },
                "sources": sources_payload(state["hits"]),
            }
        )
        return {}

    g = StateGraph(FitState)
    for name, fn in [("extractor", extract), ("retriever", retrieve), ("assessor", assess), ("validator", validate), ("finish", finish)]:
        g.add_node(name, fn)
    g.add_edge(START, "extractor")
    g.add_edge("extractor", "retriever")
    g.add_edge("retriever", "assessor")
    g.add_edge("assessor", "validator")
    g.add_edge("validator", "finish")
    g.add_edge("finish", END)
    return g.compile()
