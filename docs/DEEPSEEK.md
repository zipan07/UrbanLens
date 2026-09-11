# DeepSeek 证据问答部署

前端继续托管在 GitHub Pages。Pages 不能运行服务端，因此模型调用独立部署。
本仓库提供 `server/worker.js`，使用标准 Request/Response API，可部署为 Cloudflare Worker。
目前尚无已连接后端或 DeepSeek 密钥；前端默认运行带来源的本地检索，不冒充模型回答。

## 部署

1. 在自己的 Cloudflare 账号创建 Worker，入口为 `server/worker.js`，配置文件为 `server/wrangler.toml`。部署工具必须打包该文件对 `dist/knowledge.js` 与 `dist/domain.js` 的导入。
2. 在主机的 Secrets 中配置 `DEEPSEEK_API_KEY` 与一个随机且足够长的 `URBANLENS_ACCESS_TOKEN`。不要提交到仓库、前端或聊天。
3. 确认 `ALLOWED_ORIGIN` 为前端的源地址（当前为 `https://zipan07.github.io`）。`DEEPSEEK_MODEL` 默认 `deepseek-flash`，可按账号实际可用模型调整。
4. 部署完成后，在平台“连接模型”里输入服务 HTTPS 根地址与应用访问口令。这里输入的是应用口令，不是 DeepSeek API 密钥；连接信息仅保存在本次页面会话。
5. 检查 `/health`，再发送问题，确认回答标签为 DeepSeek 并含可打开的引用。本次尚未进行真实模型联调。

## 证据链

先校验项目与地块范围，再从服务端自带的演示台账、确定性计算、规则与产品说明中检索。网页只提交地块编号、问题和范围，不能伪造评分或替换资料。模型只负责解释。结果引用必须属于本次检索集合，前端显示原始证据。

本阶段为小型平台语料的关键词检索增强生成，不包含向量库、外部文档上传或正式政策检索。引用编号通过验证不等于所有结论都正确，模型推断仍需人工复核。无法连接模型时保留本地证据回答。

应用口令用于小范围演示访问，不等于 PRD 中的用户权限体系。公开大规模开放之前，需要独立账号鉴权、按用户的调用限额、费用监控与审计。

接口依据：[DeepSeek 官方 API 文档](https://api-docs.deepseek.com/)。
