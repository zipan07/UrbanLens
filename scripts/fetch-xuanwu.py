"""Explicit maintenance job, not a runtime dependency. Recheck source coverage after refresh."""
import json
import pathlib
import sys
import urllib.parse
import urllib.request

queries = {
    'boundary': '[out:json][timeout:40];relation(2138698);out geom;',
    'features': '''[out:json][timeout:180];relation(2138698);map_to_area->.a;(way["building"](area.a);relation["building"](area.a);way["building:part"](area.a);way["highway"](area.a);way["railway"](area.a);way["waterway"](area.a);way["natural"](area.a);relation["natural"](area.a);way["landuse"](area.a);relation["landuse"](area.a);way["leisure"](area.a);relation["leisure"](area.a);nwr["amenity"](area.a);nwr["tourism"](area.a);nwr["historic"](area.a);nwr["public_transport"]["name"](area.a);node["railway"="station"](area.a););out body geom;''',
    'nodes': '[out:json][timeout:50];area(3602138698)->.a;(node["natural"="peak"](area.a);node["place"](area.a);node["natural"="tree"](area.a););out body;'
}
dest = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp')
dest.mkdir(parents=True, exist_ok=True)
for name, query in queries.items():
    req = urllib.request.Request('https://overpass-api.de/api/interpreter', data=urllib.parse.urlencode({'data': query}).encode(), headers={'User-Agent': 'UrbanLens/0.1 (https://github.com/zipan07/UrbanLens)'})
    body = urllib.request.urlopen(req, timeout=220).read()
    data = json.loads(body)
    if data.get('remark') or not data.get('elements'):
        raise RuntimeError(f'Incomplete {name} response: {data.get("remark")}')
    (dest / f'xuanwu-{name}-raw.json').write_bytes(body)
    print(name, len(data['elements']), data.get('osm3s', {}).get('timestamp_osm_base'))
