"""Pages and JSON API."""
import os

from flask import Blueprint, abort, current_app, jsonify, render_template, request, send_from_directory

from .belts import client_payload, compute_t, compute_v, json_safe

bp = Blueprint("main", __name__)

DEFAULT_STATE = {
    "mode": "v", "lang": "fr",
    "v": {"P": 7.5, "Nd": 1450, "ND": 600, "driver": "small", "ks": [1, 1], "sec": None, "dp": None, "Dp": None,
          "a": None, "Lp": None, "f": 0.3, "beta": 38, "k": 5, "m": None},
    "t": {"P": 3, "Nd": 1450, "ND": 725, "driver": "small", "ks": [0, 1], "type": None, "Zd": None, "ZD": None,
          "a": None, "Zc": None, "b": None},
}
COMPUTE = {"v": compute_v, "t": compute_t}


@bp.get("/")
def index():
    return render_template("index.html", data=client_payload(), defaults=DEFAULT_STATE)


@bp.get("/api/data")
def data():
    return jsonify(client_payload())


@bp.post("/api/compute/<mode>")
def compute(mode):
    fn = COMPUTE.get(mode)
    if fn is None:
        abort(404)
    state = request.get_json(silent=True)
    if not isinstance(state, dict):
        return jsonify(error="Expected a JSON object with the step inputs."), 400
    return jsonify(json_safe(fn(state)))


@bp.get("/healthz")
def healthz():
    return jsonify(status="ok")


@bp.get("/privacy")
def privacy():
    return render_template("privacy.html")


@bp.get("/sw.js")
def service_worker():
    # A service worker only controls pages at or below its own URL, so it is served from the root.
    resp = send_from_directory(current_app.static_folder, "sw.js", mimetype="application/javascript", max_age=0)
    resp.headers["Cache-Control"] = "no-cache"
    return resp


@bp.get("/.well-known/assetlinks.json")
def assetlinks():
    """Digital Asset Links: proves to Android that the Play app and this website belong together.

    ANDROID_SHA256_CERT_FINGERPRINT may list several comma-separated fingerprints: the Play
    app-signing key (from Play Console) and the upload key (for builds installed by hand).
    """
    package_name = os.environ.get("ANDROID_PACKAGE_NAME")
    fingerprints = [f.strip().upper() for f in os.environ.get("ANDROID_SHA256_CERT_FINGERPRINT", "").split(",") if f.strip()]
    if not package_name or not fingerprints:
        return jsonify(error="Android Digital Asset Links are not configured."), 404
    return jsonify([{
        "relation": ["delegate_permission/common.handle_all_urls"],
        "target": {
            "namespace": "android_app",
            "package_name": package_name,
            "sha256_cert_fingerprints": fingerprints,
        },
    }])
