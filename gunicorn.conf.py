"""Gunicorn settings, overridable through environment variables."""
import os

bind = f"0.0.0.0:{os.environ.get('PORT', '8000')}"
workers = int(os.environ.get("WEB_CONCURRENCY", "2"))
threads = int(os.environ.get("THREADS", "4"))
worker_class = "gthread"
worker_tmp_dir = "/dev/shm"  # keeps working with a read-only root filesystem
timeout = 30
graceful_timeout = 20
keepalive = 5
# Access logs record visitor IP addresses; they are off unless ACCESS_LOG=1,
# so the privacy policy and the Play "Data safety" form can say no data is kept.
accesslog = "-" if os.environ.get("ACCESS_LOG") == "1" else None
errorlog = "-"
# Trust X-Forwarded-* only from these addresses (set to your reverse proxy).
forwarded_allow_ips = os.environ.get("FORWARDED_ALLOW_IPS", "127.0.0.1")
