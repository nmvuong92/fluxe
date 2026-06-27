"""fluxe backend — service Python THẬT (chỉ stdlib, không pip deps).
Cùng "hợp đồng" với interface Backend: list / add / toggle todo.
Chạy: PORT=8083 python3 app/native/python/server.py
"""
import json
import os
import re
from http.server import BaseHTTPRequestHandler, HTTPServer

todos = []
seq = 0


def add(title):
    global seq
    seq += 1
    t = {"id": f"py{seq}", "title": f"[Python] {title}", "done": False}
    todos.append(t)
    return t


def toggle(tid):
    for t in todos:
        if t["id"] == tid:
            t["done"] = not t["done"]
    return todos


class Handler(BaseHTTPRequestHandler):
    def _json(self, obj, code=200):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/todos":
            self._json(todos)
        else:
            self._json({"error": "not found"}, 404)

    def do_POST(self):
        n = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(n).decode() if n else "{}"
        m = re.match(r"^/todos/([^/]+)/toggle$", self.path)
        if self.path == "/todos":
            self._json(add(json.loads(raw or "{}").get("title", "")))
        elif m:
            self._json(toggle(m.group(1)))
        else:
            self._json({"error": "not found"}, 404)

    def log_message(self, *args):
        pass  # tắt log ồn


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8083"))
    print(f"[python backend] listening on :{port}")
    HTTPServer(("127.0.0.1", port), Handler).serve_forever()
