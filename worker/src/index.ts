import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { AgentManager } from './do/AgentManager';

export { AgentManager };

type Env = {
  DATA: KVNamespace;
  AGENTS: DurableObjectNamespace;
  ADMIN_PASSWORD?: string;
  INSTALL_SECRET?: string;
  PANEL_NAME?: string;
};

const app = new Hono<{ Bindings: Env }>();
app.use('*', cors());

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8' }
});

async function auth(c: any): Promise<boolean> {
  const token = c.req.header('Authorization')?.replace(/^Bearer\s+/i, '');
  return !!token && token === c.env.ADMIN_PASSWORD;
}

function serverKey(id: string) { return `server:${id}`; }
function installKey(token: string) { return `install:${token}`; }
function agentKey(id: string) { return `agent:${id}`; }

function makeVless(server: any) {
  const p = new URLSearchParams({
    encryption: 'none',
    flow: 'xtls-rprx-vision',
    security: 'reality',
    sni: server.sni,
    fp: 'chrome',
    pbk: server.publicKey,
    sid: server.shortId,
    type: 'tcp'
  });
  return `vless://${server.uuid}@${server.host}:${server.port}?${p.toString()}#${encodeURIComponent(server.name)}`;
}

app.get('/api/health', c => c.json({ ok: true, name: c.env.PANEL_NAME || 'VLESS Manager' }));

app.post('/api/login', async c => {
  const body = await c.req.json<{ password?: string }>();
  if (!c.env.ADMIN_PASSWORD || body.password !== c.env.ADMIN_PASSWORD) return c.json({ ok: false }, 401);
  return c.json({ ok: true, token: c.env.ADMIN_PASSWORD });
});

app.get('/api/servers', async c => {
  if (!await auth(c)) return c.json({ error: 'Unauthorized' }, 401);
  const list: any[] = [];
  let cursor: string | undefined;
  do {
    const page = await c.env.DATA.list({ prefix: 'server:', cursor, limit: 1000 });
    for (const key of page.keys) {
      const s = await c.env.DATA.get(key.name, 'json');
      if (s) list.push(s);
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return c.json(list);
});

app.post('/api/servers', async c => {
  if (!await auth(c)) return c.json({ error: 'Unauthorized' }, 401);
  const body = await c.req.json<{ name: string; host?: string; port?: number; sni?: string }>();
  if (!body.name) return c.json({ error: 'name required' }, 400);
  const id = `srv_${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`;
  const installToken = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
  const server = {
    id,
    name: body.name,
    host: body.host || '',
    port: body.port || 443,
    sni: body.sni || 'www.microsoft.com',
    status: 'pending',
    createdAt: Date.now()
  };
  await c.env.DATA.put(serverKey(id), JSON.stringify(server));
  await c.env.DATA.put(installKey(installToken), JSON.stringify({ serverId: id, createdAt: Date.now() }), { expirationTtl: 3600 });
  const origin = new URL(c.req.url).origin;
  const command = `curl -fsSL ${origin}/install/${installToken} | sudo bash`;
  return c.json({ server, command });
});

app.get('/api/servers/:id', async c => {
  if (!await auth(c)) return c.json({ error: 'Unauthorized' }, 401);
  const id = c.req.param('id');
  const server: any = await c.env.DATA.get(serverKey(id), 'json');
  if (!server) return c.json({ error: 'Not found' }, 404);
  const stub = c.env.AGENTS.get(c.env.AGENTS.idFromName(id));
  const state = await (await stub.fetch('https://agent/state')).json();
  return c.json({ server, state });
});

app.post('/api/servers/:id/command', async c => {
  if (!await auth(c)) return c.json({ error: 'Unauthorized' }, 401);
  const id = c.req.param('id');
  const server: any = await c.env.DATA.get(serverKey(id), 'json');
  if (!server) return c.json({ error: 'Not found' }, 404);
  const body = await c.req.json();
  const stub = c.env.AGENTS.get(c.env.AGENTS.idFromName(id));
  const r = await stub.fetch('https://agent/command', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
  return new Response(r.body, r);
});

app.get('/api/install/:token', async c => {
  const token = c.req.param('token');
  const record: any = await c.env.DATA.get(installKey(token), 'json');
  if (!record) return c.json({ error: 'Invalid or expired install token' }, 404);
  const server: any = await c.env.DATA.get(serverKey(record.serverId), 'json');
  if (!server) return c.json({ error: 'Server not found' }, 404);
  return c.json({ serverId: server.id, name: server.name, worker: new URL(c.req.url).origin });
});

app.post('/api/agent/register', async c => {
  const body = await c.req.json<{ installToken: string; publicKey: string; shortId: string; uuid: string; host?: string; port?: number }>();
  const record: any = await c.env.DATA.get(installKey(body.installToken), 'json');
  if (!record) return c.json({ error: 'Invalid install token' }, 401);
  const server: any = await c.env.DATA.get(serverKey(record.serverId), 'json');
  if (!server) return c.json({ error: 'Server not found' }, 404);
  const agentToken = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
  server.uuid = body.uuid;
  server.publicKey = body.publicKey;
  server.shortId = body.shortId;
  if (body.host) server.host = body.host;
  if (body.port) server.port = body.port;
  server.status = 'online';
  server.agentTokenHash = await sha256(agentToken);
  server.updatedAt = Date.now();
  await c.env.DATA.put(serverKey(server.id), JSON.stringify(server));
  await c.env.DATA.delete(installKey(body.installToken));
  return c.json({ serverId: server.id, agentToken, server, vless: makeVless(server) });
});

app.post('/api/agent/:id/heartbeat', async c => {
  const id = c.req.param('id');
  const server: any = await c.env.DATA.get(serverKey(id), 'json');
  if (!server) return c.json({ error: 'Not found' }, 404);
  const token = c.req.header('Authorization')?.replace(/^Bearer\s+/i, '') || '';
  if (!token || await sha256(token) !== server.agentTokenHash) return c.json({ error: 'Unauthorized' }, 401);
  const stub = c.env.AGENTS.get(c.env.AGENTS.idFromName(id));
  const r = await stub.fetch('https://agent/heartbeat', { method: 'POST', body: JSON.stringify(await c.req.json()), headers: { 'content-type': 'application/json' } });
  return new Response(r.body, r);
});

app.get('/api/agent/:id/poll', async c => {
  const id = c.req.param('id');
  const server: any = await c.env.DATA.get(serverKey(id), 'json');
  if (!server) return c.json({ error: 'Not found' }, 404);
  const token = c.req.header('Authorization')?.replace(/^Bearer\s+/i, '') || '';
  if (!token || await sha256(token) !== server.agentTokenHash) return c.json({ error: 'Unauthorized' }, 401);
  const stub = c.env.AGENTS.get(c.env.AGENTS.idFromName(id));
  const r = await stub.fetch('https://agent/poll');
  return new Response(r.body, r);
});

app.get('/install/:token', async c => {
  const token = c.req.param('token');
  const origin = new URL(c.req.url).origin;
  const script = `#!/bin/bash\nset -e\nINSTALL_TOKEN='${token.replaceAll("'", "")}'\nWORKER='${origin}'\nexec 3>&1\necho '[1/1] Downloading installer...'\ncurl -fsSL "$WORKER/agent/install.sh?token=$INSTALL_TOKEN" | INSTALL_TOKEN="$INSTALL_TOKEN" WORKER="$WORKER" bash\n`;
  return new Response(script, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
});

app.get('/agent/bin/:arch', async c => {
  const token = c.req.query('token') || '';
  const record: any = await c.env.DATA.get(installKey(token), 'json');
  if (!record) return new Response('Invalid or expired install token\n', { status: 404 });
  const arch = c.req.param('arch');
  if (arch !== 'amd64' && arch !== 'arm64') return new Response('Unsupported arch\n', { status: 400 });
  const obj = await c.env.DATA.get(`agent-bin-${arch}`, 'arrayBuffer');
  if (!obj) return new Response('Agent binary not uploaded\n', { status: 503 });
  return new Response(obj, { headers: { 'content-type': 'application/octet-stream', 'cache-control': 'private, max-age=300' } });
});

app.get('/agent/install.sh', async c => {
  const token = c.req.query('token') || '';
  const record: any = await c.env.DATA.get(installKey(token), 'json');
  if (!record) return new Response('Invalid or expired install token\n', { status: 404 });
  const origin = new URL(c.req.url).origin;
  const script = await c.env.DATA.get('agent-installer');
  if (script) return new Response(script.replaceAll('__WORKER__', origin).replaceAll('__INSTALL_TOKEN__', token), { headers: { 'content-type': 'text/plain' } });
  return new Response('Installer not configured. Upload worker/public/agent-install.sh to KV key agent-installer.\n', { status: 503 });
});

app.get('*', async c => {
  const html = PANEL_HTML.replaceAll('__TITLE__', c.env.PANEL_NAME || 'VLESS Manager');
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
});

async function sha256(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(x => x.toString(16).padStart(2, '0')).join('');
}

const PANEL_HTML = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>__TITLE__</title><style>:root{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#e8edf7;background:#0b1020}*{box-sizing:border-box}body{margin:0;background:#0b1020}.login{max-width:420px;margin:15vh auto;padding:32px;background:#121a2d;border:1px solid #263552;border-radius:16px}.login input,.login button,button{width:100%;padding:12px;margin-top:12px;border-radius:10px;border:1px solid #334362;background:#172139;color:#fff}.login button,header button{cursor:pointer;background:#315ee8}header{display:flex;justify-content:space-between;align-items:center;padding:28px;max-width:1200px;margin:auto}header button{width:auto;padding:10px 16px}.grid{max-width:1200px;margin:auto;padding:0 28px;display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}article{padding:20px;background:#121a2d;border:1px solid #263552;border-radius:16px}.top{display:flex;justify-content:space-between}.badge{font-size:12px;padding:4px 8px;border-radius:20px;background:#4b2931}.badge.on{background:#173c2b;color:#70e0a0}.meta{margin:18px 0;color:#94a3bf}.actions{display:flex;gap:8px}.actions button{margin:0}.actions button:first-child{background:#1d2b47}
</style></head><body><main id="app"></main><script>const app = document.querySelector('#app');
let token = localStorage.getItem('vm_token') || '';
let servers = [];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function api(path, opts={}) {
  opts.headers = {'content-type':'application/json', ...(opts.headers||{}), ...(token?{Authorization:\\`Bearer \${token}\\`}:{})};
  const r = await fetch(path, opts); if (!r.ok) throw new Error(await r.text()); return r.json();
}
function login(){ app.innerHTML=\\`<div class="login"><h1>VLESS Manager</h1><input id="pw" type="password" placeholder="管理员密码"><button onclick="doLogin()">登录</button></div>\\`; }
window.doLogin=async()=>{try{const r=await api('/api/login',{method:'POST',body:JSON.stringify({password:document.querySelector('#pw').value})}); token=r.token;localStorage.setItem('vm_token',token);render()}catch(e){alert('密码错误')}};
async function render(){try{servers=await api('/api/servers');}catch(e){localStorage.removeItem('vm_token');token='';return login();}app.innerHTML=\\`<header><h1>VLESS Manager</h1><button onclick="addServer()">+ 添加服务器</button></header><section class="grid">\${servers.map(s=>\\`<article><div class="top"><strong>\${esc(s.name)}</strong><span class="badge \${s.status==='online'?'on':''}">\${esc(s.status)}</span></div><div class="meta">\${esc(s.host||'等待 Agent')} · \${esc(s.port)}</div><div class="actions"><button onclick="details('\${s.id}')">详情</button><button onclick="cmd('\${s.id}','restart_xray')">重启 Xray</button></div></article>\\`).join('')}</section>\\`}
window.addServer=async()=>{const name=prompt('服务器名称');if(!name)return;try{const r=await api('/api/servers',{method:'POST',body:JSON.stringify({name})});prompt('复制下面的一键安装命令',r.command);render()}catch(e){alert(e.message)}};
window.details=async id=>{try{const r=await api('/api/servers/'+id);const s=r.server;const v=s.uuid?\\`vless://\${s.uuid}@\${s.host}:\${s.port}?encryption=none&flow=xtls-rprx-vision&security=reality&sni=\${encodeURIComponent(s.sni)}&fp=chrome&pbk=\${s.publicKey}&sid=\${s.shortId}&type=tcp#\${encodeURIComponent(s.name)}\\`:'未注册';alert(\\`服务器：\${s.name}\\n状态：\${r.state.online?'在线':'离线'}\\nXray：\${r.state.info?.xray||'-'}\\n\\n\${v}\\`)}catch(e){alert(e.message)}};
window.cmd=async(id,action)=>{try{await api('/api/servers/'+id+'/command',{method:'POST',body:JSON.stringify({action})});alert('命令已进入队列');}catch(e){alert(e.message)}};
render();
</script></body></html>`;

export default app;
