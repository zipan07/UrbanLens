"""Bounded, resumable refresh of the six Nanjing study districts from Overpass.

Two requests at most run concurrently. Failed / remarked responses are never
accepted or silently replaced with invented geometry. Existing validated raw
snapshots can be reused by prepare-nanjing.mjs; this is a maintenance task only.
"""
import argparse
import concurrent.futures
import json
import pathlib
import time
import urllib.parse
import urllib.request

DISTRICTS = [
    ('320106', '鼓楼区', 2139790), ('320102', '玄武区', 2138698),
    ('320104', '秦淮区', 2140011), ('320114', '雨花台区', 2139830),
    ('320105', '建邺区', 2139809), ('320113', '栖霞区', 2140010),
]
ENDPOINT = 'https://overpass-api.de/api/interpreter'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', nargs='?', default='/tmp/nanjing-raw')
    parser.add_argument('--refresh', action='store_true')
    parser.add_argument('--workers', type=int, choices=(1, 2), default=1,
                        help='Default one request at a time to respect service rate limits')
    args = parser.parse_args()
    dest = pathlib.Path(args.directory)
    dest.mkdir(parents=True, exist_ok=True)
    relation_ids = ','.join(str(d[2]) for d in DISTRICTS)
    jobs = [('boundary', f'[out:json][timeout:75];relation(id:{relation_ids});out geom;')]
    for code, name, relation in DISTRICTS:
        selectors = [
            'way[building]', 'relation[building]', 'way["building:part"]',
            'way[highway]', 'way[railway]', 'way[waterway]',
            'way[natural]', 'relation[natural]', 'way[landuse]',
            'relation[landuse]', 'way[leisure]', 'relation[leisure]',
            'nwr[amenity]', 'nwr[tourism]', 'nwr[historic]', 'nwr[shop]',
            'nwr[public_transport][name]', 'node[railway=station]',
            'node[highway=bus_stop]', 'node[natural=peak]', 'node[place]',
        ]
        body = ''.join(s + '(area.a);' for s in selectors)
        query = f'[out:json][timeout:110];relation({relation});map_to_area->.a;({body});out body geom;'
        jobs.append((code, query))

    def fetch(job):
        key, query = job
        path = dest / f'nanjing-{key}-raw.json'
        if path.exists() and not args.refresh:
            data = json.loads(path.read_text())
            if data.get('elements') and not data.get('remark'):
                return {'key': key, 'count': len(data['elements']), 'cache': True,
                        'snapshotAt': data.get('osm3s', {}).get('timestamp_osm_base')}
        started = time.monotonic()
        request = urllib.request.Request(
            ENDPOINT, data=urllib.parse.urlencode({'data': query}).encode(),
            headers={'User-Agent': 'UrbanLens/0.9 (https://github.com/zipan07/UrbanLens)'})
        body = urllib.request.urlopen(request, timeout=135).read()
        data = json.loads(body)
        if data.get('remark') or not data.get('elements'):
            raise RuntimeError(f'Incomplete {key}: {data.get("remark", "no elements")}')
        path.write_bytes(body)
        (dest / f'nanjing-{key}-query.txt').write_text(query)
        return {'key': key, 'count': len(data['elements']), 'bytes': len(body),
                'seconds': round(time.monotonic() - started, 1),
                'snapshotAt': data.get('osm3s', {}).get('timestamp_osm_base')}

    failures = []
    results = []
    # Obtain complete boundaries first so the spatial extent is independently usable.
    try:
        result = fetch(jobs[0]); results.append(result)
        print(json.dumps(result, ensure_ascii=False), flush=True)
    except Exception as error:
        raise RuntimeError(f'Boundary refresh failed: {error}') from error
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(fetch, job): job[0] for job in jobs[1:]}
        for future in concurrent.futures.as_completed(futures):
            try:
                result = future.result(); results.append(result)
                print(json.dumps(result, ensure_ascii=False), flush=True)
            except Exception as error:
                failures.append({'key': futures[future], 'error': str(error)})
                print(json.dumps(failures[-1], ensure_ascii=False), flush=True)
    (dest / 'download-log.json').write_text(json.dumps({
        'endpoint': ENDPOINT, 'results': results, 'failures': failures,
        'downloadedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
    }, ensure_ascii=False, indent=2))
    if failures:
        raise SystemExit('Some districts failed. Rerun to retry only failed snapshots.')


if __name__ == '__main__':
    main()
