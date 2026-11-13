"""Vercel serverless entry point: exposes the FastAPI app (ASGI) as a Python function."""

from app.main import app  # noqa: F401
