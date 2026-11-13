"""Hugging Face Spaces entry point (Gradio SDK, free CPU tier).

Serves the FastAPI agent API on port 7860, with a small info page at "/".
Locally, run `uvicorn app.main:app` instead.
"""

import os

os.environ.setdefault("GRADIO_ANALYTICS_ENABLED", "False")

import gradio as gr  # noqa: E402
import uvicorn  # noqa: E402

from app.main import app as api  # noqa: E402

with gr.Blocks(title="Ask Devraj API") as info:
    gr.Markdown(
        "# Ask Devraj — API\n"
        "Backend for the **Ask Devraj** portfolio agent: a LangGraph pipeline "
        "(Planner → hybrid BM25 + FAISS Retriever → Answerer → Validator) over Devraj Gaikwad's resume and projects.\n\n"
        "Endpoints: `GET /api/health`, `POST /api/chat`, `POST /api/fit` (Server-Sent Events).\n\n"
        "Source: [github.com/Devraj8068/ask-devraj](https://github.com/Devraj8068/ask-devraj)"
    )

# API routes are registered first, so they take precedence over the mounted info page.
app = gr.mount_gradio_app(api, info, path="/")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=7860)
