#!/usr/bin/env python3
"""Deploy webhook for gabrielciolac.com. Lives on the NAS as /root/bin/deploy-hook.py.

CI sends POST /hook with
  X-Deploy-Timestamp: <unix seconds>
  X-Deploy-Signature: sha256=<hex HMAC-SHA256(secret, "<timestamp>.<body>")>
and this runs /root/bin/site-autodeploy in the background, answering 202.

It binds only to the site app's Docker network gateway, so only the site's
nginx can reach it. Secret: /root/.deploy-hook-secret. Started at boot by a
TrueNAS POSTINIT init script through deploy-hook-run. Logs: journalctl -t deploy-hook.
"""
import hashlib
import hmac
import os
import subprocess
import time

BIND = os.environ.get("DEPLOY_HOOK_BIND", "172.16.16.1")
PORT = int(os.environ.get("DEPLOY_HOOK_PORT", "30089"))
SCRIPT = os.environ.get("DEPLOY_HOOK_SCRIPT", "/root/bin/site-autodeploy")
SECRET_FILE = os.environ.get("DEPLOY_HOOK_SECRET_FILE", "/root/.deploy-hook-secret")
WINDOW = 300      # seconds a signed request stays valid
MAX_BODY = 1024


def sign(secret: bytes, ts: str, body: bytes) -> str:
    return "sha256=" + hmac.new(secret, ts.encode() + b"." + body, hashlib.sha256).hexdigest()


def check(secret: bytes, ts: str, sig: str, body: bytes, now: float, seen: dict):
    """Decide whether a request is allowed. Returns (http_status, message).

    `seen` maps accepted signatures to their time and is updated in place,
    so a captured request can't be replayed inside the window."""
    if len(body) > MAX_BODY:
        return 413, "too large"
    if not ts.isdigit() or abs(now - int(ts)) > WINDOW:
        return 401, "bad timestamp"
    if not hmac.compare_digest(sign(secret, ts, body), sig or ""):
        return 401, "bad signature"
    for k in [k for k, t in seen.items() if now - t > WINDOW]:
        del seen[k]
    if sig in seen:
        return 409, "replay"
    seen[sig] = now
    return 202, "redeploy queued"


def serve():  # pragma: no cover - exercised on the NAS, not in unit tests
    import syslog
    from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

    secret = open(SECRET_FILE, "rb").read().strip()
    seen = {}
    syslog.openlog("deploy-hook")
    log = lambda m: syslog.syslog(syslog.LOG_INFO, m)

    class Hook(BaseHTTPRequestHandler):
        server_version = "deploy-hook"
        sys_version = ""

        def log_message(self, *a):
            pass

        def reply(self, code, msg):
            body = (msg + "\n").encode()
            self.send_response(code)
            self.send_header("Content-Type", "text/plain")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            self.reply(405, "POST only")

        def do_POST(self):
            if self.path != "/hook":
                return self.reply(404, "not found")
            n = int(self.headers.get("Content-Length") or 0)
            if n > MAX_BODY:
                return self.reply(413, "too large")
            body = self.rfile.read(n)
            code, msg = check(secret, self.headers.get("X-Deploy-Timestamp", ""),
                              self.headers.get("X-Deploy-Signature", ""), body, time.time(), seen)
            if code == 202:
                log("accepted %s; running %s" % (body.decode(errors="replace")[:120], SCRIPT))
                subprocess.Popen([SCRIPT], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
            else:
                log("rejected: %s" % msg)
            self.reply(code, msg)

    ThreadingHTTPServer((BIND, PORT), Hook).serve_forever()


if __name__ == "__main__":
    serve()
