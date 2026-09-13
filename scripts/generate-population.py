"""Build an explicitly simulated 500 m population scenario from public OSM context.

Run with shapely/pyproj installed. Reads existing UrbanLens data; never edits it.
This fallback does NOT contain WorldPop raster values. Reference API result is
recorded separately because the official raster server did not honor Range.
"""
import json, math, hashlib, argparse
from pathlib import Path
from shapely.geometry import shape, box, mapping, Point
from shapely.ops import transform
from shapely.strtree import STRtree
from pyproj import Transformer

HERE = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument('--data-dir', type=Path, default=HERE.parent/'dist'/'data')
parser.add_argument('--out-dir', type=Path, default=HERE)
args = parser.parse_args()
args.out_dir.mkdir(parents=True, exist_ok=True)
forward = Transformer.from_crs(4326, 32650, always_xy=True).transform
back = Transformer.from_crs(32650, 4326, always_xy=True).transform
load = lambda name: json.loads((args.data_dir/name).read_text())
boundary_input = load('boundary.geojson')
boundary = transform(forward, shape(boundary_input['features'][0]['geometry']))
assert boundary.is_valid
land_features = load('land.geojson')['features']
residential = [transform(forward,shape(f['geometry'])).buffer(0).intersection(boundary) for f in land_features if f['properties'].get('kind')=='residential']
residential = [x for x in residential if not x.is_empty]
res_tree = STRtree(residential)

def positive(x):
    try:
        x=float(x)
        return x if math.isfinite(x) and x > 0 else None
    except (ValueError, TypeError): return None

building_geoms=[]; building_weights=[]
res_kinds={'apartments','house','residential','dormitory','stlit_house'}
job_kinds={'commercial','office','retail','industrial','warehouse','hospital','hotel','university','school','college','public','train_station'}
omit_kinds={'roof','ruins','construction','bridge','pavilion','greenhouse','grandstand'}
for f in load('buildings.geojson')['features']:
    p=f['properties']; kind=p.get('building','yes')
    if kind in omit_kinds: continue
    g=transform(forward,shape(f['geometry'])).buffer(0).intersection(boundary)
    if g.is_empty or g.area <= 0: continue
    c=g.representative_point()
    residential_context=any(residential[int(j)].covers(c) for j in res_tree.query(c))
    floor=positive(p.get('building:levels')) or positive(p.get('levels'))
    h=positive(p.get('height_m')) if p.get('height_source')=='osm' else None
    if floor is None: floor=h/3.2 if h else (6 if kind in res_kinds else 5 if kind in job_kinds else 4)
    floor=min(60,max(1,floor))
    nr=1 if kind in res_kinds else 0.7 if residential_context else 0.12 if kind in job_kinds else 0.35
    jr=1 if kind in job_kinds else 0.12 if kind in res_kinds or residential_context else 0.45
    building_geoms.append(g);building_weights.append((floor*nr,floor*jr))
btree=STRtree(building_geoms)
service_points=[];service_weights=[]
for f in load('services.geojson')['features']:
    p=transform(forward,shape(f['geometry']))
    if not boundary.covers(p):continue
    category=f['properties'].get('category')
    # Weighted activity proxies, not observed users, jobs, seats, or visitors.
    weight={'daily':1000,'education':2400,'health':2000,'transit':800,'heritage':500,'park':250}.get(category,500)
    service_points.append(p);service_weights.append(weight)
stree=STRtree(service_points)
grid=[]
minx,miny,maxx,maxy=boundary.bounds
for x in range(math.floor(minx/500)*500, math.ceil(maxx/500)*500, 500):
    for y in range(math.floor(miny/500)*500, math.ceil(maxy/500)*500, 500):
        cell=box(x,y,x+500,y+500).intersection(boundary)
        if cell.is_empty or cell.area<1: continue
        res_area=sum(cell.intersection(residential[int(j)]).area for j in res_tree.query(cell))
        night_weight=0.12*res_area
        job_weight=0
        for j in btree.query(cell):
            j=int(j);area=cell.intersection(building_geoms[j]).area
            night_weight+=area*building_weights[j][0]
            job_weight+=area*building_weights[j][1]
        poi_weight=sum(service_weights[int(j)] for j in stree.query(cell) if cell.covers(service_points[int(j)]))
        grid.append({'id':f'XW-P500-{x//500}-{y//500}','geometry':mapping(transform(back,cell)),
                     'area':cell.area,'nightWeight':night_weight,'jobWeight':job_weight+poi_weight})

total_night=536900
day_multiplier=1.15
total_day=round(total_night*day_multiplier)
sum_n=sum(g['nightWeight'] for g in grid)
sum_j=sum(g['jobWeight'] for g in grid)
assert sum_n>0 and sum_j>0
night=[round(total_night*g['nightWeight']/sum_n,2) for g in grid]
day=[round(total_day*(0.40*g['nightWeight']/sum_n +0.60*g['jobWeight']/sum_j),2) for g in grid]
ni=max(range(len(grid)),key=lambda i:night[i]);di=max(range(len(grid)),key=lambda i:day[i])
night[ni]=round(night[ni]+total_night-sum(night),2)
day[di]=round(day[di]+total_day-sum(day),2)
def rounded(v):
    if isinstance(v,(list,tuple)):return [rounded(x) for x in v]
    return round(v,8) if isinstance(v,float) else v
features=[]
for i,g in enumerate(grid):
    geo=g['geometry'];geo['coordinates']=rounded(geo['coordinates'])
    features.append({'type':'Feature','id':g['id'],'geometry':geo,'properties':{
        'id':g['id'],'night':night[i],'day':day[i],'area_m2':round(g['area'],2),
        'night_density':round(night[i]/g['area']*1e6,1),'day_density':round(day[i]/g['area']*1e6,1),
        'source_kind':'simulated','reference_year':2023,'model':'XW-POP-SIM-1'}})
geojson={'type':'FeatureCollection','features':features}
out=args.out_dir/'population-grid.geojson';out.write_text(json.dumps(geojson,ensure_ascii=False,separators=(',',':')))
metadata={
    'version':'XW-POP-SIM-1','generatedAt':'2026-09-13','referenceYear':2023,'scope':'南京市玄武区，按现有 OSM 区界裁切',
    'crs':'EPSG:4326','gridCRS':'EPSG:32650','gridSizeM':500,'gridCount':len(features),
    'boundaryAreaM2':round(boundary.area,2),'nightTotal':total_night,'dayTotal':total_day,
    'nightKind':'simulated','dayKind':'simulated',
    'nightLabel':'夜间人口（居住分布推算）','dayLabel':'白天人口（活动情景推算）',
    'nightMethod':'以居住用地面积×0.12与建筑面积×假设层数×居住权重形成空间权重，归一化至2023年末全区常住人口536900人。常住人口总量为官方资料；格网及夜间存在均为假设，不是手机信令或夜间观测。',
    'dayMethod':'白天总量暂设夜间总量的1.15倍；格网分布取40%夜间归一化权重＋60%就业建筑及设施归一化权重。总量倍率与分配系数均为演示假设，尚无通勤OD、访客或日间实测校准。',
    'parameters':{'dayTotalMultiplier':day_multiplier,'dayResidentialShare':0.40,'dayEmploymentShare':0.60,
      'nightResidentialLandWeight':0.12,'buildingLevels':'优先OSM层数；其次OSM高度÷3.2m；否则住宅6、就业类5、未分类4；范围1–60',
      'nightBuildingWeights':{'residential':1,'insideResidentialLand':0.7,'employment':0.12,'unclassified':0.35},
      'dayBuildingWeights':{'employment':1,'residential':0.12,'unclassified':0.45},
      'poiWeights':{'daily':1000,'education':2400,'health':2000,'transit':800,'heritage':500,'park':250}},
    'sources':[
      {'id':'POP-XW-2023','title':'2023年南京市常住人口954.7万人','publisher':'南京市政府门户网站 / 南京日报，转述南京市统计局数据',
       'url':'https://www.nanjing.gov.cn/zzb/ywdt/msxx/202403/t20240312_5125829.html','publishedAt':'2024-03-12','period':'2023-12-31',
       'value':536900,'unit':'人','geography':'全区','status':'官方正文核对','use':'总量锚点；非夜间测量'},
      {'id':'OSM-XW-20260912','title':'玄武区建筑、用地与设施快照','publisher':'OpenStreetMap contributors / UrbanLens分类整理',
       'url':'https://www.openstreetmap.org/copyright','date':'2026-09-12','license':'ODbL 1.0','attribution':'© OpenStreetMap contributors',
       'use':'构建人口情景空间权重，收录不完整、不是建筑和设施普查'},
      {'id':'WORLDPOP-2023-CHECK','title':'WorldPop Global2 China 2023 R2025A v1，100m人口模型',
       'url':'https://api.stac.worldpop.org/collections/CHN/items/chn_pop_2023_CN_100m_R2025A_v1',
       'documentationUrl':'https://data.worldpop.org/repo/prj/Global_2015_2030/R2025A/doc/Global2_Release_Statement_R2025A_v1.pdf',
       'doi':'10.5258/SOTON/WP00839','license':'CC BY 4.0','unit':'人/像元','referenceDate':'2023-01-01',
       'status':'官方API已返回区界总人口572286.12；未下载栅格，未用于本格网计算',
       'apiTotal':572286.12,'apiAreaKm2':75.1961,'apiTask':'fc9fe82a-7e6e-48bc-a672-bedf51f8b0e3',
       'use':'候选真实开放人口模型接入核对。与年末统计总量存在时点、边界和模型差异，不把两者视为同一观测。'},
      {'id':'NANJING-30M-2023','title':'南京市中心城区30m常住人口分布数据集(2023年)',
       'url':'https://www.geodata.cn/data/datadetails.html?dataguid=241440575070762',
       'status':'找到元数据索引；未取得完整数据及公开再分发许可','use':'科研候选数据；不捆绑公开产品'}
    ],
    'limitations':['500m格网是显示与情景计算尺度，不表示人口精度；格内按面积计算自定义片区人口也是模拟。',
       '2023人口总量与2026 OSM空间快照时间不同。','建筑及设施收录不完整，山体公园等区域可能有昼间活动但缺乏对应点位。',
       '不是手机信令热力，不提供实时、分小时或个体轨迹。','不等同实际服务人数、就业岗位、户数或市场需求。'],
    'license':'ODbL 1.0 (derived OSM database); retain source attribution and make modified database available',
    'attribution':'人口总量：南京市统计局公开资料；空间情景：UrbanLens；© OpenStreetMap contributors',
    'sha256':hashlib.sha256(out.read_bytes()).hexdigest()
}
metadata.update(dict(nightSimulated=True,daySimulated=True,simulated=True,date='2023-12-31',nightSource='玄武区2023常住人口总量＋UrbanLens居住分布推算',daySource='UrbanLens白天活动情景（夜间总量×1.15）',url='https://www.nanjing.gov.cn/zzb/ywdt/msxx/202403/t20240312_5125829.html'))
metadata.pop('sha256', None)
population = json.loads(out.read_text())
population['metadata'] = metadata
out.write_text(json.dumps(population,ensure_ascii=False,separators=(',',':')))
(args.out_dir/'population-metadata.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2))
assert len(out.read_bytes())<400000
assert abs(sum(f['properties']['night'] for f in features)-total_night)<0.0001
assert abs(sum(f['properties']['day'] for f in features)-total_day)<0.0001
assert all(shape(f['geometry']).is_valid for f in features)
print(json.dumps({'gridCount':len(features),'bytes':out.stat().st_size,'night':sum(night),'day':sum(day),'boundaryAreaM2':boundary.area},ensure_ascii=False))
