#!/usr/bin/env python3
"""Generate real random credentials; never overwrite, deploy, or restart anything."""
import argparse
import json
import os
import secrets
import shlex
import shutil
import subprocess
from pathlib import Path

ACTORS = ["rifqi", "jarvis", "vps-assistant", "senku", "swe-backend", "swe-frontend", "tech-mentor",
          "data-engineer", "paperwright", "swe-verifier", "ui-designer", "devops-engineer", "github-manager", "office-lead", "runtime-dispatcher"]


def write_private(path: Path, text: str):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w', encoding='utf-8') as file:
        file.write(text)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--directory', type=Path, required=True)
    parser.add_argument('--db-path', type=Path, required=True)
    parser.add_argument('--caddy-snippet', action='store_true', help='Requires caddy on PATH; generates authenticated read-API routing')
    parser.add_argument('--backend-port', type=int, default=8000)
    args = parser.parse_args()
    directory, database = args.directory.expanduser().resolve(), args.db_path.expanduser().resolve()
    if directory.exists():
        parser.error('Credential directory already exists. Refusing to overwrite or rotate credentials implicitly.')
    if not 1024 <= args.backend_port <= 65535:
        parser.error('Backend port must be between 1024 and 65535')
    viewer_password, password_hash = secrets.token_urlsafe(24), None
    if args.caddy_snippet:
        if not shutil.which('caddy'):
            parser.error('Caddy executable not found; omit --caddy-snippet to use an existing authenticated proxy.')
        result = subprocess.run(['caddy', 'hash-password', '--algorithm', 'bcrypt'], input=viewer_password+'\n',
                                text=True, capture_output=True, check=True, timeout=30)
        password_hash = result.stdout.strip()
        if not password_hash.startswith(('$2a$', '$2b$', '$2y$')):
            parser.error('Caddy returned an unexpected password hash format')
    directory.mkdir(parents=True, mode=0o700)
    directory.chmod(0o700)
    tokens_dir = directory / 'actors'; tokens_dir.mkdir(mode=0o700); tokens_dir.chmod(0o700)
    actors = {actor: secrets.token_urlsafe(48) for actor in ACTORS}
    read_token = secrets.token_urlsafe(48)
    write_private(directory / 'actor-tokens.json', json.dumps(actors, indent=2)+'\n')
    for actor, token in actors.items():
        write_private(tokens_dir / f'{actor}.token', token+'\n')
    env = {
        'HERMES_MC_ENABLED': '1', 'HERMES_MC_DB': str(database),
        'HERMES_MC_READ_TOKEN': read_token,
        'HERMES_MC_ACTOR_TOKENS_FILE': str(directory / 'actor-tokens.json'),
        'HERMES_MC_REQUIRE_PATCHED_SQLITE': '1',
    }
    write_private(directory / 'mission-control.env', ''.join(f'{key}={shlex.quote(value)}\n' for key,value in env.items()))
    if password_hash:
        snippet = f'''# Import INSIDE the existing TLS site block, before its fallback handle.
# Protect all other legacy endpoints with the site's existing authentication too.
@hermes_execution path /api/v1/execution/*
handle @hermes_execution {{
    basic_auth {{
        rifqi {password_hash}
    }}
    reverse_proxy 127.0.0.1:{args.backend_port} {{
        header_up X-Hermes-Read-Token {read_token}
    }}
}}
'''
        write_private(directory / 'execution.caddy', snippet)
        write_private(directory / 'viewer-password.txt', viewer_password+'\n')
    print(f'Created private configuration in {directory}. No credentials were printed.')
    print('Distribute each actor token only to its corresponding isolated worker account.')
    print('No files in the repository, system services, or reverse proxy were modified.')


if __name__ == '__main__':
    main()
