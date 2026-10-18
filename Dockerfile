# syntax=docker/dockerfile:1

# ---- base: Python + runtime dependencies ----
FROM python:3.12-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /srv
COPY requirements.txt .
RUN pip install -r requirements.txt

# ---- test: only built with `--target test`; fails the build if a test fails ----
FROM base AS test
COPY requirements-dev.txt pytest.ini ./
RUN pip install -r requirements-dev.txt
COPY app ./app
COPY tests ./tests
RUN python -m pytest -q

# ---- runtime: the image you deploy (default target) ----
FROM base AS runtime
RUN useradd --create-home --uid 10001 app
COPY app ./app
COPY wsgi.py gunicorn.conf.py ./
USER app
ENV PORT=8000
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD python -c "import os, urllib.request; urllib.request.urlopen('http://127.0.0.1:%s/healthz' % os.environ.get('PORT', '8000'), timeout=2)"
CMD ["gunicorn", "-c", "gunicorn.conf.py", "wsgi:app"]
