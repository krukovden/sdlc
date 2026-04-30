#!/usr/bin/env python3
"""SDLC server launcher — checks PID file, spawns dashboard.py if not running."""

import json
import os
import platform
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

PORT = 7865


def is_pid_alive(pid):
    try:
        os.kill(pid, 0)
        return True
    except (OSError, ProcessLookupError):
        return False


def main():
    cwd = Path.cwd()
    server_json = cwd / '\.sdlc/server.json'
    log_file = cwd / '\.sdlc/server.log'

    # Already running?
    if server_json.exists():
        try:
            data = json.loads(server_json.read_text())
            pid = data.get('pid')
            if pid and is_pid_alive(int(pid)):
                print(data.get('url', f'http://localhost:{PORT}'))
                return
        except (json.JSONDecodeError, KeyError, ValueError):
            pass
        try:
            server_json.unlink()
        except FileNotFoundError:
            pass

    # Locate dashboard.py next to this file
    dashboard_py = Path(__file__).parent / 'dashboard.py'
    if not dashboard_py.exists():
        print(f'ERROR: dashboard.py not found at {dashboard_py}', file=sys.stderr)
        sys.exit(1)

    kwargs = {'cwd': str(cwd)}
    if platform.system() == 'Windows':
        kwargs['creationflags'] = (
            subprocess.CREATE_NO_WINDOW | subprocess.DETACHED_PROCESS
        )
    else:
        kwargs['start_new_session'] = True

    log = open(log_file, 'a')
    try:
        proc = subprocess.Popen(
            [sys.executable, str(dashboard_py), '--port', str(PORT)],
            stdout=log,
            stderr=log,
            **kwargs,
        )
    finally:
        log.close()

    url = f'http://localhost:{PORT}'
    server_json.write_text(json.dumps({
        'pid': proc.pid,
        'port': PORT,
        'url': url,
        'started': datetime.now(timezone.utc).isoformat(),
    }))

    print(url)


if __name__ == '__main__':
    main()
