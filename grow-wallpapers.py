#!/usr/bin/env python3
"""Append high-resolution anime wallpapers; retain every catalog entry."""
import argparse, collections, fcntl, json, os, time, urllib.error, urllib.parse, urllib.request
from datetime import datetime, timezone
from pathlib import Path

BASE = Path(os.environ.get('SUN_PANEL_DIR', str(Path(__file__).resolve().parent)))
ROOT = BASE / 'conf/custom'
CATALOG = ROOT / 'hd-wallpapers.json'
STATE = BASE / 'wallpaper-state.json'
REPORT = ROOT / 'wallpaper-update.json'
TOPICS = [
    ('blue-archive', '碧蓝档案', 'blue archive'),
    ('genshin', '原神', 'genshin impact'),
    ('star-rail', '崩坏：星穹铁道', 'honkai star rail'),
    ('arknights', '明日方舟', 'arknights'),
    ('azur-lane', '碧蓝航线', 'azur lane'),
    ('touhou', '东方Project', 'touhou'),
    ('miku', '初音未来', 'hatsune miku'),
    ('bocchi', '孤独摇滚', 'bocchi the rock'),
    ('frieren', '葬送的芙莉莲', 'frieren'),
    ('eva', '新世纪福音战士', 'neon genesis evangelion'),
    ('anime', '其他二次元', ''),
]

def read_json(path, default):
    return json.loads(path.read_text(encoding='utf-8')) if path.exists() else default

def atomic_json(path, value):
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    os.replace(temporary, path)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--bootstrap', type=int, default=0)
    args = parser.parse_args()
    lock = (BASE / 'wallpaper-refresh.lock').open('a')
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        print('Another wallpaper update is already running.', flush=True)
        lock.close()
        return
    items = read_json(CATALOG, [])
    state = read_json(STATE, {})
    cursors = state.setdefault('topics', {})
    by_url = {entry['url']: entry for entry in items}
    initial_count = len(items)
    errors, calls = [], 0
    last_request = 0.0

    def fetch(query, page):
        nonlocal last_request, calls
        params = dict(q=query, categories='010', purity='100', atleast='2560x1440', ratios='landscape', sorting='date_added', order='desc', page=page)
        if not query:
            params['atleast'] = '3840x2160'
        url = 'https://wallhaven.cc/api/v1/search?' + urllib.parse.urlencode(params)
        for attempt in range(3):
            time.sleep(max(0, 2.2 - (time.monotonic() - last_request)))
            last_request = time.monotonic()
            calls += 1
            try:
                request = urllib.request.Request(url, headers={'User-Agent': 'SunPanelWallpaper/2.0', 'Accept': 'application/json'})
                with urllib.request.urlopen(request, timeout=25) as response:
                    data = json.load(response)
                if not isinstance(data.get('data'), list) or 'meta' not in data:
                    raise ValueError('Unexpected wallpaper response')
                return data
            except (urllib.error.URLError, ValueError, TimeoutError) as error:
                if attempt == 2:
                    raise
                wait = 3 * (attempt + 1)
                if isinstance(error, urllib.error.HTTPError) and error.code == 429:
                    wait = min(120, max(30, int(error.headers.get('Retry-After', '60'))))
                time.sleep(wait)

    def merge(data, topic):
        added = 0
        for image in data['data']:
            width, height = image.get('dimension_x', 0), image.get('dimension_y', 0)
            url = image.get('path', '')
            if width < 2560 or height < 1440 or not 1.45 <= width / max(height, 1) <= 2.5:
                continue
            if image.get('purity') != 'sfw' or not url.startswith('https://w.wallhaven.cc/'):
                continue
            if image.get('file_type') not in ('image/jpeg', 'image/png', 'image/webp'):
                continue
            if url not in by_url:
                entry = {'url': url, 'resolution': image['resolution'], 'page': image['url'], 'width': width, 'height': height, 'topics': []}
                items.append(entry)
                by_url[url] = entry
                added += 1
            topics = by_url[url].setdefault('topics', [])
            if topic not in topics:
                topics.append(topic)
        atomic_json(CATALOG, items)
        return added

    for topic, label, query in TOPICS:
        cursor = cursors.setdefault(topic, {'backfill': state.get('page', 1) if topic == 'anime' else 1, 'initialized': False})
        count_before = len(items)
        try:
            if args.bootstrap:
                # First run fills several pages immediately; Blue Archive gets extra coverage.
                pages = args.bootstrap * 2 if topic == 'blue-archive' else args.bootstrap
            else:
                # Scan all newly added pages until reaching the last successful scan.
                previous = set(cursor.get('latest_ids', []))
                page, newest = 1, []
                while True:
                    data = fetch(query, page)
                    page_ids = [entry['id'] for entry in data['data']]
                    if page == 1:
                        newest = page_ids
                    merge(data, topic)
                    if not page_ids or not previous or previous.intersection(page_ids) or not cursor['initialized'] or page >= data['meta']['last_page']:
                        break
                    page += 1
                cursor['latest_ids'] = newest
                pages = 2
            # Keep a durable cursor through older pages, without any catalog size cap.
            for _ in range(pages):
                page = max(1, int(cursor['backfill']))
                data = fetch(query, page)
                merge(data, topic)
                if page == 1:
                    cursor['latest_ids'] = [entry['id'] for entry in data['data']]
                cursor['backfill'] = page + 1 if page < max(1, data['meta']['last_page']) else 1
                cursor['initialized'] = True
                atomic_json(STATE, state)
            cursor['last_success'] = datetime.now(timezone.utc).isoformat()
            atomic_json(STATE, state)
            print(f'{label}: +{len(items) - count_before}; catalog {len(items)}', flush=True)
        except Exception as error:
            errors.append({'topic': label, 'error': str(error)})
            print(f'{label}: update failed: {error}', flush=True)

    counts = collections.Counter(topic for entry in items for topic in entry.get('topics', []))
    report = {'updated_at': datetime.now(timezone.utc).isoformat(), 'total': len(items), 'added': len(items) - initial_count, 'topics': dict(counts), 'errors': errors, 'api_calls': calls, 'minimum_resolution': '2560x1440', 'catalog_limit': None}
    atomic_json(REPORT, report)
    if len(errors) < len(TOPICS):
        state['last_success'] = report['updated_at']
        atomic_json(STATE, state)
    print(json.dumps(report, ensure_ascii=False), flush=True)
    lock.close()
    if errors:
        raise SystemExit(1)

if __name__ == '__main__':
    main()
