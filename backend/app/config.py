"""Runtime settings, read from environment variables (and a local .env file)."""

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent


def _csv(name: str, default: str) -> list[str]:
    return [v.strip() for v in os.getenv(name, default).split(",") if v.strip()]


@dataclass(frozen=True)
class Settings:
    groq_api_key: str = os.getenv("GROQ_API_KEY", "")
    # Main model writes answers and fit assessments; the fast model plans and validates.
    model_main: str = os.getenv("MODEL_MAIN", "openai/gpt-oss-120b")
    model_fast: str = os.getenv("MODEL_FAST", "openai/gpt-oss-20b")
    # gpt-oss models reason before answering; "low" keeps latency and token use down.
    reasoning_effort: str = os.getenv("REASONING_EFFORT", "low")
    embed_model: str = os.getenv("EMBED_MODEL", "BAAI/bge-small-en-v1.5")
    knowledge_dir: Path = Path(os.getenv("KNOWLEDGE_DIR", str(BASE_DIR / "knowledge")))
    allowed_origins: list[str] = field(
        default_factory=lambda: _csv("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
    )
    # Simple per-IP limits to protect the free Groq quota.
    rate_per_minute: int = int(os.getenv("RATE_PER_MINUTE", "8"))
    rate_per_day: int = int(os.getenv("RATE_PER_DAY", "60"))
    max_question_chars: int = 500
    max_jd_chars: int = 6000
    top_k: int = 8


settings = Settings()
