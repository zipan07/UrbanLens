# GitHub Pages 发布

完整源码、PRD 和测试位于 `main`；可直接托管的网页文件位于 `gh-pages` 根目录。发布内容包括首页、样式、运行脚本、`packed/` 压缩分块、数据清单、研究单元、地形与字体等本地资产，以及 `.nojekyll`。历史 `demo.html` 及其运行资产继续保留。

## 首次启用

进入 [仓库 Pages 设置](https://github.com/zipan07/UrbanLens/settings/pages)：

1. Source 选择 `Deploy from a branch`。
2. Branch 选择 `gh-pages`。
3. Folder 选择 `/(root)`，点击 Save。
4. 等待 GitHub 的 Pages 构建与部署完成，在 Actions 查看状态。

预期网址为 [UrbanLens 工作台](https://zipan07.github.io/UrbanLens/)。启用前或部署完成前，该地址可能返回 404；代码已推送不等于网站已上线。

## 后续更新

开发与验证在 `main` 对应源码进行。先执行 `npm ci`、`npm run build`、`npm run check` 和 `npm test`，再将 `dist/` 下所需运行文件同步到 `gh-pages` 根目录并保留 `.nojekyll`。目前采用分支发布，尚未配置从 `main` 自动同步 `gh-pages` 的自定义工作流。

## Studio 09 空间数据打包

六个原始空间图层 `boundary.geojson`、`buildings.geojson`、`roads.geojson`、`land.geojson`、`water.geojson`、`pois.geojson`，以及 `services.geojson`，均在 `.gitignore` 中排除。版本库保存其 `dist/packed/<layer>.json` 清单与无损 gzip 分块；**全新检出后必须执行 `npm run build`**，构建脚本会从这些压缩分块还原本地 GeoJSON，供后续处理、测试和再次打包使用。缺少某个原始 GeoJSON 不表示版本库丢失该层数据，不应重新向 Overpass 下载才能完成普通构建。

前端直接读取分块清单与带内容哈希的 `.bin` 文件，在浏览器中拼接、解压为完整 GeoJSON。六区空间数据压缩传输合计约 7.7 MB，而不是直接传输约 60 MB 的原始 JSON；这是无损压缩，没有简化几何或删除属性。文件名包含内容哈希，使新旧版本的分块内容可区分。发布时须保证清单引用的全部分块均已上传，不能仅上传 `.json` 清单或混用不同构建的清单与分块。

上述大型原始 GeoJSON 不是在线加载所必需的文件，无需再重复提交到 `gh-pages`。地图数据目录根据已经载入的完整数据动态下载 GeoJSON；研究单元和证据资料等小文件继续使用现有静态路径。`dist/data/manifest.json`、`research-units.geojson`、`value-evidence.json`、`terrain/` 和全部必要 `packed/` 文件仍须一并发布。

所有资源采用相对路径，适配 `/UrbanLens/` 子路径。地图运行没有外部底图、字形服务器或模型服务依赖；真实空间数据已覆盖指定六区，但账号、服务器持久化和模型后端仍未接入。部署后需检查首页版本、压缩分块请求、六区菜单和对象详情，再分别记录桌面、窄屏与真实 GPU / 硬件手势的实际验证结果。

GitHub Pages 官方设置说明：[配置发布来源](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)。
