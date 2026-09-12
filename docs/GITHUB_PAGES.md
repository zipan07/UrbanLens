# GitHub Pages 发布

完整源码、PRD和测试位于 `main`；可直接托管的网页文件位于 `gh-pages` 根目录。`gh-pages` 包含 index.html、styles.css、app.js、domain.js 和 .nojekyll，保持与本轮 dist 内容一致。

## 首次启用

进入 https://github.com/zipan07/UrbanLens/settings/pages ：

1. Source 选择 `Deploy from a branch`。
2. Branch 选择 `gh-pages`。
3. Folder 选择 `/(root)`，点击 Save。
4. 等待 GitHub 的 Pages 构建与部署完成，在 Actions 查看状态。

预期网址为 https://zipan07.github.io/UrbanLens/ 。启用前或部署完成前，该地址可能返回404；代码已推送不等于网站已上线。

## 后续更新

开发变更通过 PR 合并到 main。验证通过后，将 `dist/` 下的运行文件同步到 `gh-pages` 根目录并保留 `.nojekyll`。这次采用分支发布，尚未配置从main自动同步gh-pages的自定义工作流。

所有资源均采用相对路径，适配 `/UrbanLens/` 子路径。没有外部底图、字体或模型依赖。本轮是完整的已实现前端原型；真实数据、账号与后端模型能力仍按 ROADMAP.md 推进。

GitHub Pages 官方设置说明：https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

## Studio 13 发布约定

主入口保持 https://zipan07.github.io/UrbanLens/ 。发布必须同步两处：

1. 私有项目服务更新为匹配版本，保持既有受众。
2. 完整源码通过 PR 合并 `main`。
3. `dist` 的网页资源发布到 `gh-pages` 根，排除 `client`、`server`、`.openai`，保留 `.nojekyll`。
4. 核对此提交的 Pages Actions 部署结果，并核实主入口版本。

GitHub Pages 托管网页，不运行项目 API。点击“连接项目”在已登录的私有工作区窗口确认后，原网页通过限定来源和窗口的消息通道操作已授权项目。连接窗口应保持打开；浏览器若中断窗口关系，可直接进入云端工作区。认证凭据不传给 GitHub 页面。没有启用 CORS 或改变项目受众。

公开源码排除后台部署配置 `.openai/hosting.json`；网页构建不依赖该文件。私有服务的部署配置在授权后台保留。
