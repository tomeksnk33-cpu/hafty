#!/usr/bin/env python3
"""GTM Bukowski - wyłączanie komputera przyciskiem w aplikacji (Linux).

Nasłuchuje tylko na 127.0.0.1:47800. POST /wylacz od strony aplikacji
(nagłówek Origin z ORIGINS) wyłącza komputer (systemctl poweroff).
GET /ping odpowiada "ok". Uruchamiaj przy logowaniu (autostart środowiska).
--na-probe: nie wyłącza, tylko wypisuje komunikat (do testów).
"""
import re
import subprocess
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = 47800
ORIGINS = {"https://gtm-bukowski.vercel.app"}
DRY = "--na-probe" in sys.argv


def allowed(origin):
    return bool(origin) and (origin in ORIGINS or re.fullmatch(r"http://localhost(:\d+)?", origin) is not None)


class H(BaseHTTPRequestHandler):
    def reply(self, code, body=""):
        data = body.encode()
        self.send_response(code)
        origin = self.headers.get("Origin")
        if allowed(origin):
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Private-Network", "true")
            self.send_header("Vary", "Origin")
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        self.reply(204)

    def do_GET(self):
        self.reply(200, "ok") if self.path == "/ping" else self.reply(404, "nie ma")

    def do_POST(self):
        if self.path != "/wylacz":
            return self.reply(404, "nie ma")
        if not allowed(self.headers.get("Origin")):
            return self.reply(403, "brak dostepu")
        self.reply(200, "ok")
        if DRY:
            print("NA PROBE: tu komputer by sie wylaczyl", flush=True)
        else:
            subprocess.Popen(["sh", "-c", "sleep 3; systemctl poweroff"])

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    try:
        ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
    except OSError:
        sys.exit(0)  # już działa
