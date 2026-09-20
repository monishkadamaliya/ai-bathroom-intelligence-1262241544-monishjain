from __future__ import annotations

import os
from typing import Any, Literal

from fastapi import FastAPI
from pydantic import BaseModel, Field


class Room(BaseModel):
    width: int = Field(ge=1200, le=10000)
    depth: int = Field(ge=1200, le=10000)
    height: int = Field(ge=1800, le=5000)
    doorPosition: str
    doorWidth: int = Field(ge=400, le=1800)
    windowPosition: str
    windowWidth: int = Field(ge=0, le=5000)
    fixedConstraints: str = ""
    imageProvided: bool = False


class Priorities(BaseModel):
    spaceEfficiency: int = Field(ge=0, le=100)
    luxury: int = Field(ge=0, le=100)
    sustainability: int = Field(ge=0, le=100)


class PlanRequest(BaseModel):
    budget: int = Field(ge=10000, le=10000000)
    styles: list[str] = Field(default_factory=list, max_length=2)
    finish: str
    mood: int = Field(ge=0, le=100)
    room: Room
    priorities: Priorities


class Signal(BaseModel):
    key: str
    value: str | int | float | bool
    confidence: float = Field(ge=0, le=1)
    source: str


class PlanEnvelope(BaseModel):
    provider: str = "python-fastapi"
    version: str = "hybrid-v1"
    mode: Literal["python-orchestrator"] = "python-orchestrator"
    confidence: float = Field(ge=0, le=1)
    signals: list[Signal]
    models: dict[str, str | None]
    warnings: list[str] = []


app = FastAPI(title="KOHLER Hybrid Orchestrator", version="0.1.0")


def build_signals(request: PlanRequest) -> list[Signal]:
    tight_room = request.room.width < 1800 or request.room.depth < 2400
    return [
        Signal(
            key="room_geometry",
            value=f"{request.room.width} × {request.room.depth} × {request.room.height} mm",
            confidence=0.95,
            source="user-entered measurements",
        ),
        Signal(
            key="spatial_review",
            value="review" if tight_room else "pass",
            confidence=0.82,
            source="python constraint preflight",
        ),
        Signal(
            key="image_analysis",
            value="requested" if request.room.imageProvided else "not_configured",
            confidence=0.5 if not request.room.imageProvided else 0.65,
            source="Nova multimodal adapter placeholder",
        ),
        Signal(
            key="retrieval",
            value="catalogue-grounded",
            confidence=0.9,
            source="Node planner catalogue contract",
        ),
    ]


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "service": "kohler-python-orchestrator",
        "bedrockConfigured": bool(os.getenv("AWS_REGION")),
        "chromaConfigured": bool(os.getenv("CHROMA_HOST")),
    }


@app.post("/plan", response_model=PlanEnvelope)
def plan(request: PlanRequest) -> PlanEnvelope:
    # This first hybrid slice deliberately returns structured preflight signals.
    # The Node planner remains the source of truth for SKU selection and hard checks
    # until Bedrock and the vector index are configured in the Python deployment.
    return PlanEnvelope(
        confidence=0.78 if request.room.imageProvided else 0.68,
        signals=build_signals(request),
        models={
            "vision": "amazon.nova multimodal" if os.getenv("AWS_REGION") else None,
            "reasoning": "amazon.nova" if os.getenv("AWS_REGION") else None,
            "retrieval": "chroma" if os.getenv("CHROMA_HOST") else "node-catalogue-contract",
        },
        warnings=[
            "Python service currently performs orchestration preflight; Node planner remains the deterministic recommendation source.",
            "Configure AWS Bedrock and Chroma before enabling model-backed image analysis or semantic retrieval.",
        ],
    )
