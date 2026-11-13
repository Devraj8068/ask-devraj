---
title: Ask Devraj API
emoji: 🤖
colorFrom: indigo
colorTo: blue
sdk: gradio
sdk_version: 6.32.0
python_version: "3.12"
app_file: hf_app.py
pinned: false
short_description: API for the Ask Devraj portfolio agent (LangGraph RAG)
---

# Ask Devraj — API

FastAPI + LangGraph backend for [Ask Devraj](https://github.com/Devraj8068/ask-devraj). See the root README for architecture and setup.

- On Hugging Face Spaces, `hf_app.py` serves the API on the free CPU tier (Gradio SDK).
- Anywhere else, use the `Dockerfile` or `uvicorn app.main:app`.

Required secret: `GROQ_API_KEY`. Set `ALLOWED_ORIGINS` to the deployed frontend URL.
