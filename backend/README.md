# Ask Devraj — API

FastAPI + LangGraph backend for [Ask Devraj](https://github.com/Devraj8068/ask-devraj). See the root README for architecture and setup.

- **Vercel:** the FastAPI preset serves the `app` exported by `index.py` (zero config).
- **Anywhere else:** use the `Dockerfile`, or run `uvicorn app.main:app`.

Required env var: `GROQ_API_KEY`. Set `ALLOWED_ORIGINS` to the deployed frontend URL.

The embedding model in `models/` is [minishlab/potion-base-8M](https://huggingface.co/minishlab/potion-base-8M) (MIT), quantized to int8 with model2vec.
