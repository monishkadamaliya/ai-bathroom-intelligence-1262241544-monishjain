from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

PAYLOAD = {
    "contractVersion": "1.0",
    "requestId": "test-request-001",
    "requestedAt": "2026-09-20T12:00:00Z",
    "budget": 300000,
    "styles": ["Warm", "Minimal"],
    "finish": "Brushed brass",
    "mood": 38,
    "room": {
        "widthMm": 2400,
        "depthMm": 3000,
        "heightMm": 2400,
        "doorPosition": "South wall",
        "doorWidthMm": 750,
        "windowPosition": "North wall",
        "windowWidthMm": 900,
        "fixedConstraints": "",
        "source": "user-entered",
    },
    "priorities": {"spaceEfficiency": 72, "luxury": 54, "sustainability": 48},
    "catalogue": {"datasetVersion": "kohler-india-pricebook-2026-v2"},
    "options": {"maxDesigns": 3, "includeImageAnalysis": False, "includeSemanticRetrieval": True, "includeLookbookEvidence": True},
}


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["contractVersion"] == "1.0"


def test_plan_contract():
    response = client.post("/plan", json=PAYLOAD)
    assert response.status_code == 200
    body = response.json()
    assert body["contractVersion"] == "1.0"
    assert body["requestId"] == PAYLOAD["requestId"]
    assert body["provider"] == "python-fastapi"
    assert body["status"] == "partial"
    assert body["observations"]["roomGeometry"]["widthMm"] == 2400
    assert body["retrieval"]["backend"] in {"chroma", "node-catalogue-contract"}
    assert body["constraints"]["status"] == "pass"
    assert body["optimization"]["status"] == "not_run"
    assert body["signals"]
    assert body["trace"]["serviceVersion"] == "hybrid-v1"
