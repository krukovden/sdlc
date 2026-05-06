#!/usr/bin/env python3
"""SDLC manifest tracking HTTP server. Pure stdlib — no pip dependencies."""

import argparse
import glob
import json
import os
import signal
import threading
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

POLL_INTERVAL = 1  # seconds
SERVER_DIR = Path(__file__).parent


class _State:
    def __init__(self):
        self._lock = threading.Lock()
        self._active = None
        self._recent = []

    def update(self, active, recent):
        with self._lock:
            self._active = active
            self._recent = list(recent)

    def snapshot(self):
        with self._lock:
            return {'active_workflow': self._active, 'recent_workflows': self._recent}


_state = _State()
_project_dir = Path.cwd()
_server = None  # set in main(); used by /stop handler


def _find_manifest_paths():
    pattern = str(_project_dir / 'sdlc-doc' / 'workflows' / '**' / 'manifest.json')
    return glob.glob(pattern, recursive=True)


def _load_manifest(path):
    try:
        with open(path, encoding='utf-8') as f:
            data = json.load(f)
        data['manifest_path'] = str(Path(path).relative_to(_project_dir)).replace('\\', '/')
        data['last_updated'] = datetime.fromtimestamp(
            os.path.getmtime(path), tz=timezone.utc
        ).isoformat()
        return data
    except (json.JSONDecodeError, OSError, ValueError):
        return None


def _is_active(manifest):
    for phase_data in manifest.get('phases', {}).values():
        if isinstance(phase_data, dict) and phase_data.get('status') == 'in_progress':
            return True
    return False


def _poll():
    paths = _find_manifest_paths()
    manifests = [m for p in paths if (m := _load_manifest(p)) is not None]

    active_list = [m for m in manifests if _is_active(m)]
    done_list = [m for m in manifests if not _is_active(m)]

    active = None
    if active_list:
        active = max(active_list, key=lambda m: m.get('last_updated', ''))

    recent = sorted(done_list, key=lambda m: m.get('last_updated', ''), reverse=True)[:5]
    _state.update(active, recent)


def _watcher():
    mtimes = {}
    while True:
        paths = _find_manifest_paths()
        current_set = set(paths)
        tracked_set = set(mtimes.keys())
        changed = current_set != tracked_set

        for p in paths:
            try:
                mtime = os.path.getmtime(p)
                if mtimes.get(p) != mtime:
                    mtimes[p] = mtime
                    changed = True
            except OSError:
                pass

        for removed in tracked_set - current_set:
            del mtimes[removed]

        if changed:
            _poll()

        time.sleep(POLL_INTERVAL)


class _Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass  # suppress default per-request logging

    def do_GET(self):
        path = self.path.split('?')[0]
        if path == '/':
            self.send_response(302)
            self.send_header('Location', '/dashboard')
            self.end_headers()
        elif path == '/dashboard':
            self._serve_file(SERVER_DIR / 'dashboard.html', 'text/html; charset=utf-8')
        elif path == '/api/state':
            self._send_json(_state.snapshot())
        elif path == '/health':
            self._send_json({'ok': True})
        else:
            self.send_error(404)

    def do_POST(self):
        if self.path == '/stop':
            self._send_json({'stopping': True})
            if _server:
                threading.Thread(target=_server.shutdown, daemon=True).start()
        else:
            self.send_error(404)

    def _serve_file(self, path, content_type):
        try:
            content = Path(path).read_bytes()
            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(len(content)))
            self.end_headers()
            self.wfile.write(content)
        except OSError:
            self.send_error(404)

    def _send_json(self, data):
        body = json.dumps(data, default=str).encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main():
    parser = argparse.ArgumentParser(description='SDLC dashboard server')
    parser.add_argument('--port', type=int, default=7865)
    args = parser.parse_args()

    _poll()  # initial load before accepting connections

    watcher = threading.Thread(target=_watcher, daemon=True)
    watcher.start()

    global _server
    _server = HTTPServer(('127.0.0.1', args.port), _Handler)

    def _shutdown(signum, frame):
        threading.Thread(target=_server.shutdown, daemon=True).start()

    signal.signal(signal.SIGTERM, _shutdown)

    print(f'SDLC dashboard at http://localhost:{args.port}', flush=True)
    try:
        _server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
