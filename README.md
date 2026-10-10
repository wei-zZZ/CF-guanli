# VLESS Node Manager：安装教程与功能说明

**快速流程总结**

1. 部署 Worker 源码。
2. 绑定 KV：`DATA`。
3. 配置 `CF_API_TOKEN`、`CF_ACCOUNT_ID`、`CF_ZONE_ID`、`CF_DOMAIN`，并按需设置 `ADMIN_KEY`。
4. 打开面板添加 Reality 或 Argo 节点。
5. 复制节点安装命令，在目标 VPS 上以 root 身份执行。
6. 等待 Agent 注册后，在面板复制 VLESS 分享链接。



## 1. 项目介绍

这是一个部署在 Cloudflare Workers 上的轻量级 VLESS 节点管理面板，支持两类节点：

- **Reality 节点**：在 VPS 上安装 Xray，生成 VLESS + Reality 配置，并通过面板显示分享链接。
- **Argo 节点**：通过 Cloudflare API 创建 Named Tunnel 和 DNS CNAME。VPS 安装 Xray、`cloudflared` 与节点 Agent，流量通过 Cloudflare Tunnel 接入，不需要为该节点额外开放公网入站端口。

面板可以查看节点状态、复制安装命令、复制 VLESS 分享链接、复制卸载命令和删除节点。Agent 会定期向 Worker 汇报状态。

> 说明：Argo 模式仍然需要 VPS 主动连接 Cloudflare Tunnel；“无需开放端口”指通常不需要为该节点开放公网入站端口，并不意味着 VPS 不需要访问互联网。

## 2. 工作原理

### Reality 节点

1. 在面板填写节点名称、端口和 SNI。
2. 面板生成安装命令。
3. 在 VPS 上执行安装命令，脚本下载 Xray、生成 UUID 和 Reality 密钥，写入配置并启动服务。
4. 安装脚本向 Worker 注册节点，面板获得 VLESS 分享链接。
5. Agent 定期汇报节点状态。

### Argo 节点

1. 在面板填写节点名称和子域名。
2. Worker 使用 Cloudflare API 创建 Named Tunnel，并配置 Tunnel 的回源地址。
3. Worker 在指定 Zone 中创建代理状态为开启的 CNAME，指向该 Tunnel 的 `cfargotunnel.com` 域名。
4. 在 VPS 执行该 Argo 节点的安装命令。脚本安装 Xray 和 `cloudflared`，配置本机 WebSocket 入站，并启动 Tunnel。
5. 安装脚本注册节点，面板显示 VLESS + WS + TLS 分享链接。
6. Agent 定期报告状态。

## 3. 部署前准备

你需要：

- 一个 Cloudflare 账号。
- 一个已经接入 Cloudflare DNS 的域名。
- 一个 Cloudflare Worker。
- 一个 Cloudflare Workers KV Namespace，并将其绑定到 Worker，绑定变量名必须为 **`DATA`**。
- 一个用于运行节点的 Linux VPS。安装脚本主要面向常见 Linux 发行版，建议使用具有 systemd 的 Debian/Ubuntu 系统。
- VPS 能够访问 Worker、GitHub 下载地址以及 Cloudflare Tunnel 服务。

## 4. 创建 Cloudflare API Token

在 Cloudflare 用户面板创建自定义 API Token，按实际账户和域名范围授予以下权限：

| 资源 | 权限 |
|---|---|
| Cloudflare Tunnel | 编辑、读取 |
| DNS | 编辑 |

资源范围应覆盖创建 Tunnel 所在的账户，以及要创建 DNS 记录的域名 Zone。创建后复制 Token；**Token 只应保存在 Worker 的 Secret 中，不要写进前端代码、公开仓库或安装教程截图。**

## 5. 配置 Worker

### 5.1 上传代码

1. 打开 Cloudflare Dashboard。
2. 进入 **Workers & Pages**，创建或打开 Worker。
3. 将项目的 Worker JavaScript 源码完整粘贴到编辑器。
4. 保存并部署。

### 5.2 绑定 KV

1. 在 Worker 的设置中打开 **Bindings（绑定）**。
2. 添加 Workers KV Namespace。
3. 变量名称填写 `DATA`，并选择对应的 Namespace。
4. 保存设置并重新部署。

如果没有 `DATA` 绑定，节点信息无法正常持久化。

### 5.3 配置环境变量

在 Worker 的 **Settings → Variables and Secrets** 中配置：

| 变量 | 类型 | 用途 |
|---|---|---|
| `CF_API_TOKEN` | **Secret** | Cloudflare API Token |
| `CF_ACCOUNT_ID` | 普通变量 | Cloudflare Account ID |
| `CF_ZONE_ID` | 普通变量 | 用于添加 DNS 记录的 Zone ID |
| `CF_DOMAIN` | 普通变量 | 已接入该 Zone 的域名，例如 `example.com` |
| `ADMIN_KEY` | 可选 Secret | 管理员访问密钥 |

`CF_DOMAIN` 填主域名，例如 `example.com`，不要填写 `https://`，也不要填写路径或端口。

代码中只有在设置了 `ADMIN_KEY` 时，主页才要求通过 `?key=你的密钥` 访问。若设置了该变量，访问面板时请使用：

`https://你的-worker-域名/?key=你的管理员密钥`

请不要将包含管理员密钥的完整 URL 分享给他人。

### 5.4 检查部署

部署完成后，打开 Worker 域名。可检查健康接口：

`https://你的-worker-域名/api/health`

正常时会返回类似：

```json
{"ok":true,"time":1234567890000}
```

其中时间戳会随实际请求变化。

## 6. 添加 Reality 节点

1. 打开管理面板。
2. 在“添加节点”区域填写：
   - **节点名称**：自定义名称，例如 `Tokyo-01`。
   - **端口**：VPS 上用于 Reality 入站的 TCP 端口，例如 `26443`。确认该端口未被其他程序占用。
   - **SNI**：Reality 使用的服务器名称，例如 `www.microsoft.com`。请按自己的网络环境选择合适的值。
3. 点击“添加节点”。
4. 在节点列表中点击“安装命令”，复制命令。
5. 登录目标 VPS，以 root 身份执行命令。
6. 等待安装完成，在面板中查看节点状态和 VLESS 分享链接。

### 防火墙提示

脚本会尝试调整 VPS 内常见的本机防火墙规则，但云服务商控制台的安全组/防火墙可能仍需手动允许所选 TCP 端口。不要在没有确认端口用途时随意开放端口。

## 7. 添加 Argo 节点

### 7.1 填写表单

Argo 表单只有两个输入框：

- **节点名称**：例如 `Argo-HK`。
- **子域名**：例如 `hk01`。系统会将其与 `CF_DOMAIN` 组合为 `hk01.example.com`。

此处不要填写 `http://127.0.0.1:8080`；它不是表单字段。当前源码会为每个 Argo 节点生成一个本地回源端口和 WebSocket 路径，并把它们写入 Tunnel 配置。

点击“添加 Argo”后，Worker 会调用 Cloudflare API 创建 Tunnel 和 DNS 记录。成功后，节点会出现在列表中。

### 7.2 在 VPS 安装

1. 在 Argo 节点卡片中点击“安装命令”。
2. 复制命令并在目标 Linux VPS 上以 root 身份执行。
3. 脚本会安装 Xray 和 `cloudflared`，创建 Xray WebSocket 配置、systemd 服务，并启动 Tunnel 和 Agent。
4. 安装完成后，查看终端输出及面板中的 VLESS 分享链接和状态。

Argo 节点的连接方式为 VLESS + WebSocket + TLS，域名使用刚才创建的子域名，外部连接通常通过 Cloudflare 的 443 端口接入。

### 7.3 删除节点

在面板中点击节点的“删除”按钮。对于 Argo 节点，Worker 会尝试删除对应的 Cloudflare Tunnel 和 DNS 记录，再移除 Worker KV 中的节点信息。

删除操作不可轻率执行。若 VPS 上已安装服务，删除面板记录并不等同于在 VPS 上卸载所有软件；如需清理 VPS，请先使用面板提供的“卸载命令”，并确认不影响其他服务。

## 8. 常见问题

### 创建 Argo 时提示 API 权限或 Tunnel 错误

检查：

- `CF_API_TOKEN` 是否配置为 Secret，且没有多余空格。
- Token 是否包含 Cloudflare Tunnel 的读取/编辑权限。
- `CF_ACCOUNT_ID` 是否属于该 Token 授权的账户。
- `CF_ZONE_ID` 是否对应 `CF_DOMAIN` 所属的域名 Zone。
- DNS 权限是否覆盖该 Zone。

### 提示缺少 Cloudflare 配置

确认以下变量都已设置且名称拼写完全一致：

- `CF_API_TOKEN`
- `CF_ACCOUNT_ID`
- `CF_ZONE_ID`
- `CF_DOMAIN`

修改变量后保存并重新部署/生效。

### Argo 域名创建成功，但节点无法连接

按顺序检查：

1. VPS 上 `xray`、`cloudflared` 和 `vless-agent` 服务是否运行。
2. VPS 是否能正常访问互联网和 Cloudflare Tunnel。
3. Cloudflare Zero Trust 的 Tunnels 页面中，Tunnel 是否在线。
4. DNS 记录是否存在，记录名称是否与 `CF_DOMAIN` 和子域名组合后的主机名一致。
5. 面板中的 VLESS 分享链接是否完整，客户端是否支持 VLESS + WS + TLS。
6. VPS 是否有其他程序占用了安装脚本所使用的本地端口。

可在 VPS 上执行以下命令查看服务状态：

```bash
systemctl status xray --no-pager -l
systemctl status cloudflared --no-pager -l
systemctl status vless-agent --no-pager -l
```

查看日志：

```bash
journalctl -u xray -n 100 --no-pager
journalctl -u cloudflared -n 100 --no-pager
journalctl -u vless-agent -n 100 --no-pager
```

### 安装脚本下载失败

安装脚本需要从 GitHub 下载 Xray 和 `cloudflared`。如果 VPS 无法访问 GitHub，安装过程可能失败。请先确认 VPS DNS、HTTPS 出站连接和系统时间正常，再重试。

### 面板状态没有变成 ONLINE

确认安装脚本是否完整执行，`vless-agent` 是否运行，以及 VPS 能否访问 Worker 域名。状态依赖 Agent 定期上报；仅创建节点但未在 VPS 安装，不代表节点已可用。

### 服务地址格式错误

Argo 创建表单不要求用户输入服务地址。当前代码在创建 Argo 时会生成本地回源端口并设置 Tunnel 配置。如果仍然出现“服务地址格式不正确，例如 http://localhost:8080”，请核对实际部署的 Worker 是否为对应版本，避免浏览器仍访问旧代码或部署了不同的源码。

## 9. 安全建议

- 将 `CF_API_TOKEN` 和 `ADMIN_KEY` 存为 Worker Secret，不要硬编码在公开源码中。
- 为 API Token 仅授予必需权限，并限制到实际使用的账户和 Zone。
- 不要公开分享带有 `?key=` 的管理员 URL。
- 安装命令含有节点专属安装 Token。不要把完整命令贴到公开论坛或群聊。
- 变更或删除节点前，先确认目标节点和 Tunnel 名称，避免误删。
- 定期更新 Worker 源码，并在更新前备份当前可用版本。

## 10. 当前源码行为与限制

本文档依据当前提供的 Worker 源码整理。实际行为可能受到 Cloudflare API、Worker 绑定、系统环境及源码版本影响。

- 节点信息保存在绑定为 `DATA` 的 Workers KV 中。
- `ADMIN_KEY` 是可选配置；未设置时，主页不会执行该密钥校验。
- Reality 安装脚本会尝试开放本机防火墙端口，但云厂商安全组需另行检查。
- Argo 安装脚本依赖 VPS 访问 GitHub 下载软件。
- 删除 Argo 节点时，Cloudflare Tunnel 和 DNS 删除属于尽力执行；API 删除失败时需要到 Cloudflare 控制台检查是否有残留资源。
- 卸载脚本会停止并删除 Xray、cloudflared 和 Agent 相关服务/文件。执行前请确认这些服务不是由其他项目共用。

---


