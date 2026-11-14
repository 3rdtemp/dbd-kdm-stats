#!/usr/bin/env python3
"""Persist an Apps Script JSON response into the public site's records snapshot.

No extra dependencies: runs with the Python on GitHub Actions.
API URL is read from the existing, public config.js file; no credentials needed.
The script never modifies the Google Spreadsheet itself.
"""

import argparse
from datetime import datetime, timezone
from pathlib import Path
import json
import os
import re
import time
from urllib.parse import urlparse, urlencode, parse_qsl, urlunparse
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / 'config.js'
DEFAULT_OUTPUT = ROOT / 'data' / 'records.json'
ENDPOINT_REGEX = re.compile(r"appsScriptUrl\s*:\s*['\"]([^'\"]+)['\"]")
VALID_KINDS = {'killer', 'survivor'}
VALID_RESULTS = {'win', 'loss'}


def read_endpoint():
    match = ENDPOINT_REGEX.search(CONFIG.read_text(encoding='utf-8'))
    if not match:
        raise RuntimeError('config.js에서 Apps Script 주소를 찾지 못했습니다.')
    endpoint = match.group(1)
    url = urlparse(endpoint)
    if url.scheme != 'https' or url.hostname != 'script.google.com' or not re.fullmatch(r'/macros/s/[^/]+/exec', url.path):
        raise RuntimeError('Apps Script /exec 주소 형식이 올바르지 않습니다.')
    return endpoint


def fetch_json(endpoint):
    url = urlparse(endpoint)
    query = dict(parse_qsl(url.query))
    query.pop('callback', None)
    query['snapshot'] = str(int(time.time()))
    url = urlunparse(url._replace(query=urlencode(query)))
    errors=[]
    for attempt in range(3):
        try:
            request=Request(url, headers={'User-Agent': 'KDM-Stats-Snapshot/1.6.9', 'Accept':'application/json, text/plain, */*'})
            with urlopen(request, timeout=35) as response:
                raw=response.read(8_000_001)
                if len(raw)>8_000_000: raise RuntimeError('API 응답이 비정상적으로 큽니다.')
            payload=json.loads(raw.decode('utf-8-sig'))
            return payload
        except Exception as exc:
            errors.append(str(exc))
            if attempt<2:time.sleep(2**attempt)
    raise RuntimeError('Apps Script API 요청 실패: '+' | '.join(errors))


def validate(data, existing=None, allow_large_drop=False):
    if not isinstance(data, dict) or data.get('schemaVersion') != 2 or not isinstance(data.get('sessions'),list):
        raise ValueError('API JSON 형식이 맞지 않습니다 (schemaVersion=2, sessions 필요).')
    if not isinstance(data.get('killerCategories'),dict) or not data['killerCategories']:
        raise ValueError('살인마 분류가 누락됐습니다.')
    total=wins=0
    session_ids=set()
    for session in data['sessions']:
        if not isinstance(session,dict) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}',str(session.get('dateISO',''))):
            raise ValueError('기록의 날짜 형식이 잘못됐습니다.')
        if not isinstance(session.get('rounds'),list):raise ValueError('라운드 배열이 없습니다.')
        sid=session.get('id')
        if sid and sid in session_ids:raise ValueError('중복 세션 ID가 있습니다.')
        session_ids.add(sid)
        for item in session['rounds']:
            if not isinstance(item,dict) or item.get('mode') not in VALID_KINDS or item.get('result') not in VALID_RESULTS:
                raise ValueError('라운드의 승패 또는 유형이 잘못됐습니다.')
            if item['mode']=='survivor' and (item.get('name') or item.get('map')):
                raise ValueError('생존자 맵 이름이 API에 포함돼 있습니다.')
            total+=1; wins+=item['result']=='win'
    if not total: raise ValueError('경기 기록이 비어 있으므로 덮어쓰지 않습니다.')
    previous_total=0
    if existing and isinstance(existing.get('sessions'),list):
        previous_total=sum(len(s.get('rounds',[])) for s in existing['sessions'] if isinstance(s,dict))
    if previous_total and total < previous_total*0.75 and not allow_large_drop:
        raise ValueError(f'기존 {previous_total}전 → 새 {total}전: 경기 수가 25% 넘게 감소했습니다. 잘못된 데이터인지 확인 후 수동 실행에서 allow_large_drop를 켜 주세요.')
    print(f'검증 완료: {total}전 {wins}승 {total-wins}패 / {len(data["sessions"])}개 기록 행 (이전 {previous_total}전)')
    return total


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--input',type=Path,help='로컬 테스트용 JSON (외부 API에 접속하지 않음)')
    parser.add_argument('--output',type=Path,default=DEFAULT_OUTPUT)
    parser.add_argument('--reason',choices=['schedule','manual','push','test'],default='manual')
    parser.add_argument('--allow-large-drop',action='store_true')
    parser.add_argument('--dry-run',action='store_true')
    opts=parser.parse_args()
    old=None
    if opts.output.is_file():
        try: old=json.loads(opts.output.read_text(encoding='utf-8'))
        except (ValueError, OSError): pass
    data=json.loads(opts.input.read_text(encoding='utf-8')) if opts.input else fetch_json(read_endpoint())
    total=validate(data,old,opts.allow_large_drop)
    now=datetime.now(timezone.utc)
    kst=now.astimezone(ZoneInfo('Asia/Seoul'))
    data['snapshotMetadata']={
        'savedAtUTC': now.isoformat(timespec='seconds'),
        'savedAtKST': kst.isoformat(timespec='seconds'),
        'kind': {'schedule':'weekly-final','manual':'manual','push':'initial-or-site-update','test':'test'}[opts.reason],
        'rounds':total,
        'sourceLastDate':data.get('sourceLastDate','')
    }
    if opts.dry_run:
        print('모의 테스트 완료: 저장본을 변경하지 않았습니다.')
        return
    opts.output.parent.mkdir(parents=True,exist_ok=True)
    temp=opts.output.with_suffix('.json.tmp')
    temp.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
    temp.replace(opts.output)
    print(f'최신 저장본 생성 완료: {opts.output}')


if __name__=='__main__':
    main()
