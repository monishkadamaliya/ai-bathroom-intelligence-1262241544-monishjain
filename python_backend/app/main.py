from __future__ import annotations

import os
import time
from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import FastAPI
from pydantic import BaseModel, ConfigDict, Field


ContractVersion = Literal["1.0"]
Source = Literal["user-entered", "user-confirmed", "ai-estimate", "mixed"]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ImageReference(StrictModel):
    storagePath: str = Field(min_length=1, max_length=500)
    mimeType: Literal["image/jpeg", "image/png", "image/webp"]
    widthPx: int | None = Field(default=None, gt=0, le=20000)
    heightPx: int | None = Field(default=None, gt=0, le=20000)


class Room(StrictModel):
    widthMm: int = Field(ge=1200, le=10000)
    depthMm: int = Field(ge=1200, le=10000)
    heightMm: int = Field(ge=1800, le=5000)
    doorPosition: str = Field(min_length=1, max_length=100)
    doorWidthMm: int = Field(ge=400, le=1800)
    windowPosition: str = Field(min_length=1, max_length=100)
    windowWidthMm: int = Field(ge=0, le=5000)
    fixedConstraints: str = Field(default="", max_length=2000)
    source: Source
    image: ImageReference | None = None


class Priorities(StrictModel):
    spaceEfficiency: int = Field(ge=0, le=100)
    luxury: int = Field(ge=0, le=100)
    sustainability: int = Field(ge=0, le=100)


class CatalogueContext(StrictModel):
    datasetVersion: str | None = Field(default=None, max_length=100)
    candidateSkus: list[str] = Field(default_factory=list, max_length=200)


class PlanOptions(StrictModel):
    maxDesigns: int = Field(ge=1, le=3)
    includeImageAnalysis: bool
    includeSemanticRetrieval: bool
    includeLookbookEvidence: bool


class PlanRequest(StrictModel):
    contractVersion: ContractVersion
    requestId: str = Field(min_length=8, max_length=100, pattern=r"^[A-Za-z0-9._:-]+$")
    requestedAt: datetime
    budget: int = Field(ge=10000, le=10000000)
    styles: list[str] = Field(default_factory=list, max_length=2)
    finish: str = Field(min_length=1, max_length=100)
    mood: int = Field(ge=0, le=100)
    room: Room
    priorities: Priorities
    catalogue: CatalogueContext | None = None
    options: PlanOptions


class Observation(StrictModel):
    key: str
    value: Any
    confidence: float = Field(ge=0, le=1)
    source: str


class RoomGeometry(StrictModel):
    widthMm: int = Field(ge=0)
    depthMm: int = Field(ge=0)
    heightMm: int = Field(ge=0)
    source: Source
    confidence: float = Field(ge=0, le=1)


class ImageAnalysis(StrictModel):
    status: Literal["not_requested", "not_configured", "completed", "failed"]
    observations: list[Observation] = Field(default_factory=list, max_length=100)
    confidence: float = Field(ge=0, le=1)
    imageStoragePath: str | None = Field(default=None, max_length=500)


class Observations(StrictModel):
    roomGeometry: RoomGeometry
    imageAnalysis: ImageAnalysis


class Candidate(StrictModel):
    sku: str
    score: float
    reasons: list[str] = Field(default_factory=list, max_length=20)


class Evidence(StrictModel):
    type: str
    reference: str
    detail: str
    confidence: float = Field(ge=0, le=1)


class Retrieval(StrictModel):
    status: Literal["not_requested", "completed", "partial", "failed"]
    backend: Literal["chroma", "node-catalogue-contract", "none"]
    candidates: list[Candidate] = Field(default_factory=list, max_length=200)
    evidence: list[Evidence] = Field(default_factory=list, max_length=200)


class ConstraintCheck(StrictModel):
    key: str
    status: Literal["pass", "review", "conflict"]
    detail: str


class Constraints(StrictModel):
    status: Literal["pass", "review", "conflict"]
    checks: list[ConstraintCheck] = Field(default_factory=list, max_length=100)


class Alternative(StrictModel):
    id: str
    skus: list[str]
    score: float
    rationale: str


class Optimization(StrictModel):
    status: Literal["not_run", "completed", "partial", "failed"]
    objective: str = Field(max_length=1000)
    selectedSkus: list[str] = Field(default_factory=list, max_length=200)
    alternatives: list[Alternative] = Field(default_factory=list, max_length=3)


class Signal(StrictModel):
    key: str
    value: Any
    confidence: float = Field(ge=0, le=1)
    source: str


class Trace(StrictModel):
    serviceVersion: str | None = None
    models: dict[str, str | None] = Field(default_factory=dict)
    latencyMs: int | None = Field(default=None, ge=0)


class PlanResponse(StrictModel):
    contractVersion: ContractVersion
    requestId: str
    status: Literal["ok", "partial", "failed"]
    provider: str
    generatedAt: datetime
    confidence: float = Field(ge=0, le=1)
    observations: Observations
    retrieval: Retrieval
    constraints: Constraints
    optimization: Optimization
    signals: list[Signal] = Field(default_factory=list, max_length=200)
    warnings: list[str] = Field(default_factory=list, max_length=50)
    trace: Trace | None = None


app = FastAPI(title="KOHLER Hybrid Orchestrator", version="0.2.0")


def build_signals(request: PlanRequest) -> list[Signal]:
    tight_room = request.room.widthMm < 1800 or request.room.depthMm < 2400
    return [
        Signal(key="room_geometry", value=f"{request.room.widthMm} × {request.room.depthMm} × {request.room.heightMm} mm", confidence=0.95, source="user-entered measurements"),
        Signal(key="spatial_review", value="review" if tight_room else "pass", confidence=0.82, source="python constraint preflight"),
        Signal(key="image_analysis", value="requested" if request.options.includeImageAnalysis else "not_requested", confidence=0.5 if not request.options.includeImageAnalysis else 0.65, source="Nova multimodal adapter placeholder"),
        Signal(key="retrieval", value="catalogue-grounded", confidence=0.9, source="Node planner catalogue contract"),
    ]


@app.get("/health")
def health() -> dict[str, Any]:
    return {"status": "ok", "service": "kohler-python-orchestrator", "contractVersion": "1.0", "bedrockConfigured": bool(os.getenv("AWS_REGION")), "chromaConfigured": bool(os.getenv("CHROMA_HOST"))}


@app.post("/plan", response_model=PlanResponse)
def plan(request: PlanRequest) -> PlanResponse:
    started = time.perf_counter()
    image_status = "not_configured" if request.options.includeImageAnalysis else "not_requested"
    room_source = request.room.source
    spatial_status: Literal["pass", "review", "conflict"] = "review" if request.room.widthMm < 1800 or request.room.depthMm < 2400 else "pass"
    signals = build_signals(request)
    warnings = [
        "Python service currently performs orchestration preflight; Node planner remains the deterministic recommendation source.",
        "Configure AWS Bedrock and Chroma before enabling model-backed image analysis or semantic retrieval.",
    ]
    return PlanResponse(
        contractVersion="1.0",
        requestId=request.requestId,
        status="partial",
        provider="python-fastapi",
        generatedAt=datetime.now(timezone.utc),
        confidence=0.78 if request.options.includeImageAnalysis else 0.68,
        observations=Observations(
            roomGeometry=RoomGeometry(widthMm=request.room.widthMm, depthMm=request.room.depthMm, heightMm=request.room.heightMm, source=room_source, confidence=0.95),
            imageAnalysis=ImageAnalysis(status=image_status, observations=[], confidence=0.5 if image_status != "completed" else 0.8, imageStoragePath=request.room.image.storagePath if request.room.image else None),
        ),
        retrieval=Retrieval(status="partial", backend="chroma" if os.getenv("CHROMA_HOST") else "node-catalogue-contract", candidates=[], evidence=[Evidence(type="contract", reference=request.catalogue.datasetVersion if request.catalogue else "unknown", detail="Candidate retrieval is delegated to the Node catalogue planner until Chroma is configured.", confidence=0.9)]),
        constraints=Constraints(status=spatial_status, checks=[ConstraintCheck(key="room_envelope", status=spatial_status, detail="Python preflight checked the submitted room envelope.")]),
        optimization=Optimization(status="not_run", objective="Defer final SKU selection and design optimization to the deterministic Node planner.", selectedSkus=[], alternatives=[]),
        signals=signals,
        warnings=warnings,
        trace=Trace(serviceVersion="hybrid-v1", models={"vision": "amazon.nova multimodal" if os.getenv("AWS_REGION") else None, "reasoning": "amazon.nova" if os.getenv("AWS_REGION") else None, "retrieval": "chroma" if os.getenv("CHROMA_HOST") else "node-catalogue-contract"}, latencyMs=round((time.perf_counter() - started) * 1000)),
    )
