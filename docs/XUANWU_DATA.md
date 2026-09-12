# 玄武区空间数据 / Xuanwu Atlas 06

研究范围经用户确认为南京市玄武区（320102），制作者署名为“制作者：东南大学建筑学院 蔡子攀”。首页使用真实开放空间数据，历史虚构评估工作流移至 `dist/demo.html`，与玄武区没有地理或评分关联。DeepSeek 接入暂缓。

## 来源与快照

- OpenStreetMap 行政边界：<https://www.openstreetmap.org/relation/2138698>。
- Overpass 查询：`https://overpass-api.de/api/interpreter`。数据快照时点写入 `dist/data/manifest.json`，不是每一对象的实测日期。
- 原始数据遵循 ODbL 1.0，地图和导出包含 © OpenStreetMap contributors。GeoJSON 是本仓库提供的衍生数据库，按同一 ODbL 提供；下载不代表官方测绘或规划成果。
- 地形：Mapzen Terrain Tiles，<https://registry.opendata.aws/terrain-tiles/>。12 张 Terrarium z12 区域瓦片来自公开 AWS 数据集，同站保存，避免运行时跨域依赖。主要全球来源含 USGS SRTM / GMTED2010 与 NOAA ETOPO1；源采集年份不一，不宣称最新测绘精度。来源与许可见 `dist/data/terrain/ATTRIBUTION.md`。

| 图层 | 快照收录 | 口径 |
| --- | ---: | --- |
| 地上建筑及建筑部件 | 3,845 | 不是独立栋数。剔除 30 个地下/室内对象，建筑部件可能与主体重叠。 |
| 道路、轨道、线状水系 | 3,868 | OSM 分段对象，非道路条数。 |
| 用地、绿地及部分公共服务范围 | 684 | 开放地图标签分类，非法定现状用途。 |
| 水体面 | 123 | 湖泊、水塘等多边形。 |
| 具名设施与地名 | 640 | 具名 POI、地名及部分面对象的包围盒中心，不是完整设施普查。 |
| 行政边界 | 1 | OSM relation 2138698，非官方勘界。 |

查询包含与玄武区相交对象的完整几何，未按区界裁切；统计不是区内精确普查总量。未覆盖的邻区显示区域背景，不添加虚构街道。建筑密度差异可能反映制图覆盖差异，不直接用于城区分析。所有坐标为 WGS84，经纬度没有混入 GCJ-02。

## 高度与三维口径

187 个地上建筑/部件有可解析 OSM `height`；94 个以 `building:levels × 3m` 推算；3,564 个高度未知，事实字段 `height_m` 为 null。默认三维为未知对象显示统一 12m 示意，可在图层中关闭。它们没有被随机生成高度或当作测量值。标签高度和楼层也未经专业复核。地形网格只表示区域地势，不提供建筑高度。

真实轮廓、地形、2D/3D 摄像机和光照不等同于高德的卫星影像、建筑精模或倾斜摄影。本版未调用高德接口，没有配置高德 Key 或安全凭证，不抓取其瓦片。后续如接入授权高德服务，应将其 GCJ-02 坐标体系与当前 WGS84 数据明确转换、核查和分层。

## 可复现处理

使用 Overpass 保存三份 JSON：`xuanwu-boundary-raw.json`、`xuanwu-features-raw.json`、`xuanwu-nodes-raw.json`。执行 `node scripts/prepare-xuanwu.mjs <raw-directory>` 生成衍生 GeoJSON 与清单；脚本发现 Overpass 超时/截断 remark 则失败。原始响应不作为运行时依赖。查询脚本见 `scripts/fetch-xuanwu.py`，刷新需对比覆盖和数据版本。

地图本地打包 MapLibre 5.6.1、系统字体 SDF、GeoJSON 和 DEM，首屏无需访问外部底图或字形服务器。三种主题均由同一真实数据绘制。PNG 导出包含数据口径、来源和署名。对象 GeoJSON 与逐图层 GeoJSON 可下载。

研究范围导入仅本机预览，最大20 MB / 1,000 条 / 200,000 个坐标点；校验 FeatureCollection、Polygon/MultiPolygon、闭合环、唯一 parcel_id、WGS84合理范围和玄武区边界点包含关系，整批失败不覆盖之前导入。尚未做完整自交、环包含及拓扑校验，不自动当作宗地，不计算地籍面积或更新评分。包围盒中心仅用于定位，可位于多边形外。

## 仍缺少的业务数据

真实宗地与权属、法定规划条件及控制线、建筑调查与安全鉴定、空置率及运营台账、授权正射影像与实景三维模型均未接入。数据目录逐项显示待接入；不会把未检索到资料解释为没有约束。
