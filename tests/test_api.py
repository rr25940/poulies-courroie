"""HTTP layer: pages, JSON API and health check."""
import pytest

from app import create_app


@pytest.fixture()
def client():
    return create_app({"TESTING": True}).test_client()


def test_index_renders_both_tabs(client):
    resp = client.get("/")
    assert resp.status_code == 200
    html = resp.get_data(as_text=True)
    assert "Simulateur poulies-courroies" in html
    assert 'id="steps-v"' in html and 'id="steps-t"' in html
    assert "Ghada Hakiri" in html and "Riadh Ayari" in html
    assert 'id="splash"' in html and 'class="splashing"' in html
    assert "Content-Security-Policy" in resp.headers


def test_compute_v(client):
    resp = client.post("/api/compute/v", json={"P": 7.5, "Nd": 1450, "ND": 600, "ks": [1, 1]})
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["nc"] == 3 and body["sec"] == "B"


def test_compute_t(client):
    resp = client.post("/api/compute/t", json={"P": 3, "Nd": 1450, "ND": 725, "ks": [0, 1]})
    assert resp.get_json()["desig"] == "300 H 100"


def test_compute_rejects_bad_requests(client):
    assert client.post("/api/compute/x", json={}).status_code == 404
    assert client.post("/api/compute/v", data="not json", content_type="application/json").status_code == 400
    assert client.post("/api/compute/v", json=[1, 2]).status_code == 400


def test_data_and_health(client):
    data = client.get("/api/data").get_json()
    assert set(data["G1"]["zones"]) == {"Z", "A", "B", "C", "D", "E"}
    assert client.get("/healthz").get_json() == {"status": "ok"}


def test_pwa_assets(client, monkeypatch):
    manifest = client.get("/static/manifest.webmanifest")
    assert manifest.status_code == 200
    assert manifest.get_json()["display"] == "standalone"
    assert client.get("/static/sw.js").status_code == 200
    assert client.get("/.well-known/assetlinks.json").status_code == 404

    monkeypatch.setenv("ANDROID_PACKAGE_NAME", "com.douda.pouliescourroies")
    monkeypatch.setenv("ANDROID_SHA256_CERT_FINGERPRINT", "AA:BB:CC")
    links = client.get("/.well-known/assetlinks.json")
    assert links.status_code == 200
    assert links.get_json()[0]["target"]["package_name"] == "com.douda.pouliescourroies"


def test_root_service_worker_and_privacy(client, monkeypatch):
    sw = client.get("/sw.js")
    assert sw.status_code == 200
    assert sw.mimetype == "application/javascript"
    assert "no-cache" in sw.headers["Cache-Control"]
    assert "Politique de confidentialité" in client.get("/privacy").get_data(as_text=True)

    # Play app-signing key and upload key can both be listed
    monkeypatch.setenv("ANDROID_PACKAGE_NAME", "com.douda.pouliescourroies")
    monkeypatch.setenv("ANDROID_SHA256_CERT_FINGERPRINT", "aa:bb, CC:DD ")
    target = client.get("/.well-known/assetlinks.json").get_json()[0]["target"]
    assert target["sha256_cert_fingerprints"] == ["AA:BB", "CC:DD"]
