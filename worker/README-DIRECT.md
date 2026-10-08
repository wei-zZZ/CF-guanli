# VLESS Worker Manager — 单文件部署

1. Cloudflare 创建 Worker。
2. 创建 KV Namespace，并绑定变量名 `DATA`。
3. 设置 Worker 环境变量 `ADMIN_PASSWORD`。
4. 把 `_worker.js` 全部复制到 Worker 编辑器并部署。
5. 打开 Worker URL 登录，添加 VPS。
6. 在 VPS root 执行面板生成的一键安装命令。

Agent 会安装 Xray、生成 VLESS TCP REALITY、注册节点并返回分享链接。

注意：这是为了直接部署而做的第一版，Agent 心跳/命令暂存使用 KV；节点规模较大时建议下一版改 Durable Objects。Xray 安装默认依赖 GitHub 可访问。
