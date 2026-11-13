# Runs on Hugging Face Spaces (Docker SDK): non-root user 1000, port 7860.
FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:0.13.8 /uv /bin/uv
RUN useradd -m -u 1000 user
USER user
WORKDIR /home/user/app
ENV PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    FASTEMBED_CACHE_PATH=/home/user/app/.cache/fastembed

COPY --chown=user pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

# Bake the embedding model into the image so cold starts don't download it.
RUN uv run --no-sync python -c "from fastembed import TextEmbedding; TextEmbedding('BAAI/bge-small-en-v1.5')"

COPY --chown=user app ./app
COPY --chown=user knowledge ./knowledge

EXPOSE 7860
CMD ["uv", "run", "--no-sync", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
