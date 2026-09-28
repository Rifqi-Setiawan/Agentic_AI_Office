#!/usr/bin/env python3
"""Browser-only deterministic QA against a running STAGING frontend.

Mocks execution snapshots in this browser context only; does NOT write to the VPS.
This is a test scenario, not evidence of live agent work. Requires Playwright.
"""
import argparse
import copy
import json
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-url', required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--username')
    parser.add_argument('--password-file', type=Path)
    args = parser.parse_args()
    if urlsplit(args.base_url).scheme not in {'http','https'}:
        parser.error('Expected a staging HTTP(S) URL')
    if bool(args.username) != bool(args.password_file):
        parser.error('Supply both --username and --password-file for Basic auth')
    root = Path(__file__).resolve().parents[1]
    snapshot = json.loads((root/'qa/snapshot.example.json').read_text())
    args.output.mkdir(parents=True, exist_ok=True)
    credentials = {'username': args.username, 'password': args.password_file.read_text().strip()} if args.username else None
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for width, height in [(1920,1080),(1440,900),(1280,720),(768,1024),(390,844)]:
            context = browser.new_context(viewport={'width':width,'height':height}, http_credentials=credentials)
            page = context.new_page()
            page.route('**/api/v1/execution/snapshot', lambda route: route.fulfill(json=copy.deepcopy(snapshot)))
            page.route('**/api/v1/execution/events', lambda route: route.fulfill(status=200,
                content_type='text/event-stream', body='event: delegation_snapshot\ndata: '+json.dumps(snapshot)+'\n\n'))
            page.goto(args.base_url, wait_until='domcontentloaded')
            page.locator('.mc-agent').first.wait_for()
            page.wait_for_function("document.querySelectorAll('.mc-agent').length === 14 && document.querySelectorAll('.mc-circuit--active').length === 3")
            page.wait_for_timeout(350)
            failures = page.locator('.mc-agent').evaluate_all('''cards => {
                const issues=[]; const boxes=cards.map(card=>card.getBoundingClientRect());
                for(let i=0;i<boxes.length;i++) for(let j=i+1;j<boxes.length;j++) {
                    const a=boxes[i],b=boxes[j];
                    if(a.left<b.right && a.right>b.left && a.top<b.bottom && a.bottom>b.top) issues.push(`overlap ${i}/${j}`);
                }
                for(const card of cards) for(const node of card.querySelectorAll('h3,.mc-agent__role,.mc-agent__footer'))
                    if(node.scrollWidth>node.clientWidth+1 || node.scrollHeight>node.clientHeight+1) issues.push(`text overflow: ${node.textContent}`);
                return issues;
            }''')
            assert not failures, failures
            for theme in ['dark','light']:
                current=page.locator('.mc-shell').get_attribute('data-theme')
                if current != theme:
                    page.get_by_role('button',name='Gunakan tema terang' if theme=='light' else 'Gunakan tema gelap').click()
                page.screenshot(path=str(args.output/f'TEST_FIXTURE_{width}x{height}_{theme}.png'), full_page=True)
            context.close()
        browser.close()
    print('Browser QA passed for five viewports and two themes using the labeled test fixture.')


if __name__ == '__main__':
    main()
