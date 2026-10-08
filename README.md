# VLESS Worker Manager

Cloudflare Worker + KV + Durable Objects + Go Agent，用于管理多台 VPS 上的 Xray VLESS TCP REALITY 节点。

## 功能

- Web 面板添加服务器
- 为服务器生成一次性 Agent 安装命令
- Agent 注册、心跳、长轮询
- 自动安装 Xray
- 自动生成 VLESS + TCP + REALITY
- 自动生成 VLESS 分享链接
- Web 面板查看服务器/Xray/节点状态
- Worker KV 只保存持久数据
- Durable Object 保存实时状态和命令队列

## 部署

### 1. 安装 Wrangler

```bash
npm install -g wrangler
wrangler login
```

### 2. 创建 KV

```bash
cd worker
wrangler kv namespace create DATA
```

把返回的 `id` 填入 `wrangler.toml` 的 `kv_namespaces`。

### 3. 部署

```bash
npm install
wrangler deploy
```

首次部署后访问 Worker URL，默认管理员登录：

- 用户名：`admin`
- 密码：第一次打开后必须在环境变量中设置 `ADMIN_PASSWORD`

生产环境请务必设置：

```bash
wrangler secret put ADMIN_PASSWORD
wrangler secret put INSTALL_SECRET
```

`INSTALL_SECRET` 用于签发一次性安装 Token。

### 4. Agent

在面板添加服务器后复制安装命令到 VPS 执行。

Agent 默认安装到：

```text
/usr/local/vless-agent/agent
/usr/local/vless-agent/config.json
```

systemd：

```text
/etc/systemd/system/vless-agent.service
```

Xray：

```text
/usr/local/bin/xray
/usr/local/etc/xray/config.json
```

## 安全说明

第一版默认仅支持管理员单用户登录。正式公网部署建议：

- 给 Worker 配置自定义域名
- 使用强随机 ADMIN_PASSWORD
- 使用强随机 INSTALL_SECRET
- 后续增加多管理员/WebAuthn/2FA
- 不要把长期 Agent Token 写入安装 URL

### Agent assets

After the Worker is deployed and `KV_ID` is exported:

```bash
cd worker
export KV_ID='你的KV ID'
./upload-assets.sh
```

Then generate a new server install command from the panel. The installer token is one-time and expires after 1 hour.

> The MVP currently uses KV for the installer/binary blobs only during installation. Runtime heartbeat and command polling use Durable Objects.

## Xray REALITY key note

Current Xray releases may display the public key as `Password` rather than `Public key`; the installer accepts both names. The current official Xray installer installs/upgrades from the XTLS/Xray-install project. urlXray-installhttps://github.com/XTLS/Xray-install
