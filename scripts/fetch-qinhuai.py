"""Read-only OSM snapshot acquisition. Respect API limits; cache successful tiles."""
import concurrent.futures, datetime, json, pathlib, sys, urllib.request
root = pathlib.Path(sys.argv[1]); root.mkdir(parents=True, exist_ok=True)
tiles = [(118.7588812,31.9767275,118.8172406,32.0108038),
         (118.8172406,31.9767275,118.8756,32.0108038),
         (118.7588812,32.0108038,118.7880609,32.0448801),
         (118.7880609,32.0108038,118.8172406,32.0448801),
         (118.8172406,32.0108038,118.8756,32.0448801)]
def read(url, path):
    if path.exists(): return json.loads(path.read_bytes())
    with urllib.request.urlopen(url, timeout=65) as response: body = response.read()
    data = json.loads(body)
    if not data.get('elements'): raise ValueError('Empty source response')
    path.write_bytes(body)
    return data
read('https://www.openstreetmap.org/api/0.6/relation/2140011/full.json',root.parent/'qinhuai-osm-response.json')
def tile(item):
    i,b=item
    return read('https://www.openstreetmap.org/api/0.6/map.json?bbox='+','.join(map(str,b)),root/f'osm-tile-{i}.json')
elements={}
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    for data in pool.map(tile,enumerate(tiles)):
        for e in data['elements']: elements[e['type']+'/'+str(e['id'])]=e
stamp=datetime.datetime.now(datetime.timezone.utc).isoformat()
(root/'qinhuai-bbox-raw.json').write_text(json.dumps({'version':0.6,'osm3s':{'timestamp_osm_base':stamp,'timestamp_areas_base':None},'source':'OpenStreetMap API','elements':list(elements.values())}))
print(len(elements),'unique OSM elements; acquired',stamp)
