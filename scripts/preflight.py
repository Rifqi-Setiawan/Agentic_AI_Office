#!/usr/bin/env python3
"""Read-only environment checks; never installs packages or changes an existing DB."""
import argparse
import importlib.metadata
import json
import os
import shutil
import sqlite3
import subprocess
import sys
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo', type=Path, default=Path.cwd())
    parser.add_argument('--production', action='store_true')
    args = parser.parse_args()
    version = sqlite3.sqlite_version_info
    patched = version >= (3,51,3) or (version[:2] == (3,44) and version >= (3,44,6)) or (version[:2] == (3,50) and version >= (3,50,7))
    report = {'python': sys.version.split()[0], 'python_sqlite': sqlite3.sqlite_version,
              'wal_fix_by_upstream_version': patched, 'vendor_backport_explicitly_verified': os.environ.get('HERMES_MC_SQLITE_BACKPORT_VERIFIED') == '1',
              'node': None, 'packages': {}, 'frontend_lockfile_present': (args.repo/'frontend/package-lock.json').exists(),
              'frontend_node_modules_present': (args.repo/'frontend/node_modules').exists(), 'warnings': []}
    for package in ['fastapi','pydantic','uvicorn','pytest','httpx']:
        try: report['packages'][package] = importlib.metadata.version(package)
        except importlib.metadata.PackageNotFoundError: report['packages'][package] = None
    if shutil.which('node'):
        report['node'] = subprocess.run(['node','--version'],capture_output=True,text=True,check=True).stdout.strip()
    if not patched and not report['vendor_backport_explicitly_verified']:
        report['warnings'].append('Production WAL requires SQLite WAL-reset fix. Check Python binding, not just CLI. See sqlite.org/wal.html section 11.')
    if sys.version_info < (3,12):
        report['warnings'].append('Existing repository documents Python 3.12+; validate with that interpreter on VPS.')
    print(json.dumps(report, indent=2))
    if args.production and (report['warnings'] or any(report['packages'][p] is None for p in ['fastapi','pydantic','uvicorn'])):
        raise SystemExit(1)


if __name__ == '__main__':
    main()
