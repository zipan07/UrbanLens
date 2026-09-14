"""Read-only OSM snapshot acquisition. Respect API limits; cache successful tiles."""
import concurrent.futures, datetime, json, pathlib, sys, urllib.request
root = pathlib.Path(sys.argv[1]); root.mkdir(parents=True, exist_ok=True)
tiles = [(118.7144899,32.0309981,118.75806655,32.08231105),
         (118.75806655,32.0309981,118.8016432,32.056654575),
         (118.75806655,32.056654575,118.8016432,32.08231105),
         (118.7144899,32.08231105,118.75806655,32.133624),
         (118.75806655,32.08231105,118.8016432,32.133624)]
def read(url, path):
    if path.exists(): return json.loads(path.read_bytes())
    with urllib.request.urlopen(url, timeout=65) as response: body = response.read()
    data = json.loads(body)
    if not data.get('elements'): raise ValueError('Empty source response')
    path.write_bytes(body)
    return data
read('https://www.openstreetmap.org/api/0.6/relation/2139790/full.json',root.parent/'gulou-osm-response.json')
def tile(item):
    i,b=item
    return read('https://www.openstreetmap.org/api/0.6/map.json?bbox='+','.join(map(str,b)),root/f'osm-tile-{i}.json')
elements={}
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    for data in pool.map(tile,enumerate(tiles)):
        for e in data['elements']: elements[e['type']+'/'+str(e['id'])]=e
stamp=datetime.datetime.now(datetime.timezone.utc).isoformat()
(root/'gulou-bbox-raw.json').write_text(json.dumps({'version':0.6,'osm3s':{'timestamp_osm_base':stamp,'timestamp_areas_base':None},'source':'OpenStreetMap API','elements':list(elements.values())}))
print(len(elements),'unique OSM elements; acquired',stamp)
