# Simulateur poulies-courroies (Flask)

Interactive sizing of classic V-belts and timing belts, following the course
« Système poulies et courroies » step by step. Flask does all the calculations
through a JSON API. The browser draws the course charts and the animated drive
to scale.

Created as part of a research collaboration between **Ghada Hakiri** and **Riadh Ayari**.

## Layout

```
app/
  belts/data.py      course tables and digitised chart curves
  belts/numeric.py   interpolation and chart-zone lookup
  belts/calc.py      compute_v() / compute_t(): the sizing method
  belts/payload.py   table and chart geometry sent to the browser
  routes.py          /, /api/data, /api/compute/<v|t>, /healthz
  templates/         Jinja pages (FR/EN text switched in the browser)
  static/            app.css, charts.js, drive.js, steps.js, app.js
tests/               pytest: worked examples, sweeps, API
wsgi.py              entry point (gunicorn wsgi:app)
gunicorn.conf.py     server settings (environment overridable)
Dockerfile           base → test (optional) → runtime
docker-compose.yml   one service, read-only filesystem, port 8080
```

## Run with Docker

```bash
cd webapp

# optional: run the tests inside the image build (fails the build if a test fails)
docker build --target test -t poulies-courroies:test .

# build and start
docker compose up -d --build

# check
docker compose ps            # STATUS should become "healthy"
curl http://localhost:8080/healthz
```

Open http://localhost:8080. To use another host port, run `HOST_PORT=9000 docker compose up -d`.

Without compose:

```bash
docker build -t poulies-courroies .
docker run -d --name poulies-courroies -p 8080:8000 --read-only --tmpfs /tmp poulies-courroies
```

Stop with `docker compose down` (or `docker rm -f poulies-courroies`).

## Publish as a website with Render

This project is a web application and does not need to be submitted to an app
store. The included [`render.yaml`](render.yaml) deploys the Docker image as a
public HTTPS website.

1. Push this project to a GitHub, GitLab, or Bitbucket repository.
2. Create a Render account at <https://render.com>.
3. Select **New → Blueprint** and connect the repository.
4. Confirm the service from `render.yaml` and choose **Apply**.
5. Wait for the deployment to finish, then open the generated `onrender.com`
   URL.
6. In Render, open the service's **Settings → Custom Domains** to connect
   your own domain. Render provisions HTTPS automatically.

Render uses `/healthz` to determine whether the service is ready. The free
plan may suspend an idle service; choose a paid plan if the site must remain
continuously warm.

## Publish on Google Play

The Android wrapper in [`android/`](android/) packages the public website as a
Trusted Web Activity. Deploy the website first, then follow
[`android/README.md`](android/README.md) to build and sign the Android App
Bundle. Google Play publication still requires a Play Console account, a
public HTTPS URL, a signing key, privacy policy, store graphics, and review
declarations.

## Settings (environment variables)

| Variable | Default | Effect |
|---|---|---|
| `PORT` | `8000` | Port gunicorn listens on inside the container |
| `WEB_CONCURRENCY` | `2` | gunicorn worker processes |
| `THREADS` | `4` | threads per worker |
| `FORWARDED_ALLOW_IPS` | `127.0.0.1` | proxy addresses trusted for `X-Forwarded-*` headers |
| `STATIC_MAX_AGE` | `3600` | cache lifetime of static files, in seconds |
| `HOST_PORT` | `8080` | compose only: port published on the host |
| `ANDROID_PACKAGE_NAME` | unset | package name used by the Android Digital Asset Links response |
| `ANDROID_SHA256_CERT_FINGERPRINT` | unset | SHA-256 fingerprints for Android Digital Asset Links, comma-separated (Play app-signing key, upload key) |
| `ACCESS_LOG` | unset | set to `1` to log every request with the visitor's IP address (update the privacy policy if you do) |

## Behind a reverse proxy

The app serves plain HTTP on port 8000 and makes only relative requests
(`api/compute/...`), so it also works under a sub-path. A minimal nginx block:

```nginx
location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## Develop without Docker

```bash
python -m venv .venv
.venv/bin/pip install -r requirements-dev.txt      # Windows: .venv\Scripts\pip
.venv/bin/python -m pytest                          # 12 tests
.venv/bin/python wsgi.py                            # http://127.0.0.1:8000
```

Gunicorn does not run on Windows. `python wsgi.py` uses Flask's development
server, which is only for local work.

## API

`POST /api/compute/v` (V-belts) or `/api/compute/t` (timing belts) with the
step inputs as JSON, for example:

```bash
curl -s -X POST localhost:8080/api/compute/v \
  -H 'Content-Type: application/json' \
  -d '{"P": 7.5, "Nd": 1450, "ND": 600, "ks": [1, 1]}'
```

This returns every intermediate value (`sec`, `dp`, `Dp`, `a`, `Lp`, `Pb`, `KL`, `Kth`, `Pa`, `nc`,
tensions, and so on) plus `W`, the list of warnings. Omitted choices (`sec`, `dp`, `Dp`,
`a`, `Lp`; for timing belts `type`, `Zd`, `ZD`, `a`, `Zc`, `b`) are picked automatically.

## Data notes

- Chart curves (graphs 1 to 5) were traced from the course scans and match a hand reading within a few percent.
- Two blurry cells of table 4 were read to match their neighbours: 3.59 kW (A, 100 mm, 20 m/s) and 9.85 kW (B, 250 mm, 25 m/s).
- The belt mass per metre `m′` in step 9 is a typical catalogue value; the course does not give one.
- For timing belts, the centre-distance rule is the V-belt rule, used as a guide only.
