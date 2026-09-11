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
