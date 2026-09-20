# KOHLER Python Hybrid Orchestrator

This service is the Python/FastAPI side of the hybrid architecture. The existing WebDev Node/tRPC app remains the public application, authentication boundary, deterministic catalogue planner, and frontend API. When `PYTHON_ORCHESTRATOR_URL` is configured, the Node planner calls this service at `POST /plan` and attaches the returned structured signals to the planner result. If the service is unavailable, the Node app falls back automatically to its local deterministic planner.

## Run locally

```bash
cd python_backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Then configure the Node service with `PYTHON_ORCHESTRATOR_URL=http://localhost:8000`.

## Production configuration

Set these variables only in the Python service deployment:

- `AWS_REGION`: AWS region where Bedrock/Nova access is enabled.
- `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`, or an equivalent IAM role.
- `CHROMA_HOST` and optional `CHROMA_PORT` for the persistent vector service.

The current service implements a validated orchestration preflight. The deterministic Node planner remains the source of truth for catalogue SKU selection, product relationships, budget, and spatial checks until Bedrock and Chroma are configured and the model-backed adapters are implemented.

## Hybrid request flow

```text
React/Vite → Node/tRPC → Python FastAPI /plan
                         ├─ room and constraint preflight
                         ├─ future Nova image understanding
                         ├─ future Chroma semantic retrieval
                         └─ structured signals back to Node

Node planner → final catalogue-grounded designs → React/Vite
```
