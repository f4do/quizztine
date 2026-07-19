# Stage 1: Dependencies
FROM python:3.14-slim AS deps
WORKDIR /app
COPY pyproject.toml ./
RUN pip install --no-cache-dir .

# Stage 2: Runtime
FROM python:3.14-slim AS runtime
WORKDIR /app
COPY --from=deps /usr/local/lib/python3.14/site-packages /usr/local/lib/python3.14/site-packages
COPY --from=deps /usr/local/bin /usr/local/bin
COPY src ./src
EXPOSE 8000
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
