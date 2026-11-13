"""LLM clients. Each role falls back to the small model if the main one is rate-limited."""

import json
import re
from dataclasses import dataclass

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import BaseMessage
from langchain_core.runnables import Runnable

JSON_MODE = {"response_format": {"type": "json_object"}}


@dataclass
class LLMs:
    chat: Runnable  # streams user-facing answers
    json_main: Runnable  # structured reasoning (fit assessment, fact checking)
    json_fast: Runnable  # cheap structured calls (planning)
    judge: Runnable  # fact-checking; thinks harder than the other roles


def build_llms(
    main: BaseChatModel, fast: BaseChatModel, judge: BaseChatModel | None = None, json_mode: bool = True
) -> LLMs:
    kw = JSON_MODE if json_mode else {}
    json_main = main.bind(**kw).with_fallbacks([fast.bind(**kw)])
    return LLMs(
        chat=main.with_fallbacks([fast]),
        json_main=json_main,
        json_fast=fast.bind(**kw),
        judge=judge.bind(**kw).with_fallbacks([main.bind(**kw)]) if judge is not None else json_main,
    )


def groq_llms() -> LLMs:
    from langchain_groq import ChatGroq

    from .config import settings

    if not settings.groq_api_key:
        raise RuntimeError("GROQ_API_KEY is not set. Copy .env.example to .env and add your key.")
    # A hard per-call timeout keeps a slow or rate-limited request from hanging the stream.
    common = {"api_key": settings.groq_api_key, "max_retries": 1, "timeout": 30, "reasoning_effort": settings.reasoning_effort}
    main = ChatGroq(model=settings.model_main, temperature=0.2, **common)
    fast = ChatGroq(model=settings.model_fast, temperature=0, **common)
    judge = ChatGroq(
        model=settings.model_main,
        api_key=settings.groq_api_key,
        max_retries=1,
        timeout=30,
        temperature=0,
        reasoning_effort="medium",
    )
    return build_llms(main, fast, judge)


def parse_json(text: str) -> dict:
    """Parse a JSON object from model output, tolerating code fences or surrounding prose."""
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.S)
        if not match:
            return {}
        try:
            data = json.loads(match.group(0))
        except json.JSONDecodeError:
            return {}
    return data if isinstance(data, dict) else {}


async def ask_json(llm: Runnable, messages: list[BaseMessage]) -> dict:
    resp = await llm.ainvoke(messages)
    return parse_json(resp.content if isinstance(resp.content, str) else str(resp.content))
