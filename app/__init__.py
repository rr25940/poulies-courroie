"""Flask application factory for the pulley & belt simulator."""
import os

from flask import Flask

CSP = "; ".join([
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data:",
    "connect-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
])


def create_app(config=None):
    app = Flask(__name__)
    app.config.update(
        MAX_CONTENT_LENGTH=16 * 1024,  # state payloads are tiny
        JSON_SORT_KEYS=False,
        SEND_FILE_MAX_AGE_DEFAULT=int(os.environ.get("STATIC_MAX_AGE", "3600")),
    )
    app.json.sort_keys = False
    if config:
        app.config.update(config)

    from .routes import bp
    app.register_blueprint(bp)

    @app.after_request
    def security_headers(resp):
        resp.headers.setdefault("Content-Security-Policy", CSP)
        resp.headers.setdefault("X-Content-Type-Options", "nosniff")
        resp.headers.setdefault("Referrer-Policy", "same-origin")
        resp.headers.setdefault("X-Frame-Options", "SAMEORIGIN")
        return resp

    return app
