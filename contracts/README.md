# Hybrid API Contract v1.0

The Node application calls the Python service with `POST /plan`. Both sides validate the payload against the JSON Schema files in this directory.

## Files

- `hybrid-plan-request.schema.json`: Node → Python request.
- `hybrid-plan-response.schema.json`: Python → Node response.
- `../server/contracts.ts`: Zod runtime validation and TypeScript types.
- `../python_backend/app/main.py`: Pydantic runtime validation and FastAPI response models.

## Ownership

| Responsibility | Owner | Contract fields |
|---|---|---|
| Request identity and versioning | Node | `contractVersion`, `requestId`, `requestedAt` |
| User-entered room and preferences | Node/frontend | `room`, `budget`, `styles`, `finish`, `mood`, `priorities` |
| Image reference | Node/storage layer | `room.image` |
| Image observations | Python/Bedrock adapter | `observations.imageAnalysis` |
| Candidate retrieval | Python/Chroma or Node fallback | `retrieval` |
| Hard constraint checks | Deterministic planner | `constraints` |
| Final SKU/design selection | Current Node planner; planned Python migration | `optimization` |
| Evidence and uncertainty | Both services | `signals`, `warnings`, `trace` |

## Important rules

1. `contractVersion` is currently exactly `"1.0"`.
2. `requestId` must be echoed unchanged in the response.
3. All dimensions use millimetres and all confidence values use the range `0..1`.
4. AI observations are estimates. User-confirmed measurements remain authoritative.
5. Python may return `partial` while it is only performing preflight; the Node planner remains the source of truth for catalogue SKU selection until semantic retrieval is enabled.
6. Any invalid or mismatched Python response causes the Node bridge to use its deterministic local fallback.
7. `warnings` must disclose unavailable model or retrieval capabilities rather than implying that they ran.

## Current response behavior

The current Python implementation returns room preflight signals, a retrieval handoff record, constraint status, and a `not_run` optimization section. This makes the contract ready for Bedrock/Nova and Chroma without changing the Node endpoint again.
