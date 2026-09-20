from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

PAYLOAD = {
    "budget": 300000,
    "styles": ["Warm", "Minimal"],
    "finish": "Brushed brass",
    "mood": 38,
    "room": {
        "width": 2400,
        "depth": 3000,
        "height": 2400,
        "doorPosition": "South wall",
        "doorWidth": 750,
        "windowPosition": "North wall",
        "windowWidth": 900,
        "fixedConstraints": "",
        "imageProvided": False,
    },
    "priorities": {"spaceEfficiency": 72, "luxury": 54, "sustainability": 48},
}


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_plan_contract():
    response = client.post("/plan", json=PAYLOAD)
    assert response.status_code == 200
    body = response.json()
    assert body["provider"] == "python-fastapi"
    assert body["mode"] == "python-orchestrator"
    assert body["signals"]
    assert body["models"]["retrieval"] in {"chroma", "node-catalogue-contract"}
