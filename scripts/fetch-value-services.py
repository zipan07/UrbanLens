"""Refresh service reference points; run prepare-value-data.mjs afterwards."""
import json, pathlib, urllib.parse, urllib.request
query = '''[out:json][timeout:120];(nwr[amenity](32.00,118.76,32.125,118.92);nwr[shop](32.00,118.76,32.125,118.92);nwr[railway=station](32.00,118.76,32.125,118.92);node[highway=bus_stop](32.00,118.76,32.125,118.92);nwr[leisure=park](32.00,118.76,32.125,118.92);nwr[historic](32.00,118.76,32.125,118.92););out center;'''
req=urllib.request.Request('https://overpass-api.de/api/interpreter',data=urllib.parse.urlencode({'data':query}).encode(),headers={'User-Agent':'UrbanLens research demo (github.com/zipan07/UrbanLens)'})
body=urllib.request.urlopen(req,timeout=160).read(); data=json.loads(body)
if data.get('remark') or not data.get('elements'): raise RuntimeError('Incomplete response')
pathlib.Path('/tmp/xuanwu-services-raw.json').write_bytes(body)
print(len(data['elements']),data['osm3s']['timestamp_osm_base'])
