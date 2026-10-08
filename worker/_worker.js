const json=(d,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{'content-type':'application/json;charset=utf-8'}});
const html=(s,st=200)=>new Response(s,{status:st,headers:{'content-type':'text/html;charset=utf-8'}});
const rand=(n=32)=>{const a=new Uint8Array(n);crypto.getRandomValues(a);return [...a].map(x=>x.toString(16).padStart(2,'0')).join('')};
const gid=p=>`${p}_${rand(8)}`;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const get=k=>DATA.get(k,'json');
const put=(k,v)=>DATA.put(k,JSON.stringify(v));
const auth=r=>(r.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim();

async function installInfo(token){const m=await get(`install:${token}`);return m?await get(`server:${m.serverId}`):null}
async function agentServer(req){const t=auth(req);if(!t)return null;const m=await get(`agent:${t}`);if(!m)return null;const s=await get(`server:${m.serverId}`);return s?{s,t}:null}

async function home(req){
 const u=new URL(req.url), admin=env.ADMIN_KEY||'', key=u.searchParams.get('key')||'';
 if(admin&&key!==admin)return html('<h3>Admin key required</h3>',403);
 const list=await DATA.list({prefix:'server:'}), ss=[]; for(const k of list.keys){const s=await get(k.name);if(s)ss.push(s)} ss.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
 const rows=ss.map(s=>`<tr><td>${esc(s.name)}</td><td>${esc(s.host||'-')}</td><td>${s.port||'-'}</td><td>${esc(s.sni)}</td><td>${esc(s.status)}</td><td>${s.vless?`<textarea readonly>${esc(s.vless)}</textarea>`:'-'}</td></tr>`).join('');
 const cmds=ss.map(s=>`<div class="box"><b>${esc(s.name)}</b><pre>curl -fsSL "${u.origin}/api/install-script/${s.installToken}" | bash</pre></div>`).join('');
 return html(`<!doctype html><meta charset=utf-8><title>VLESS Node Manager</title><style>body{font-family:system-ui;max-width:1200px;margin:30px auto;padding:0 15px}input,button{padding:8px;margin:3px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:7px;vertical-align:top}textarea{width:520px;height:55px}.box{border:1px solid #ddd;padding:10px;margin:10px 0}pre{white-space:pre-wrap;word-break:break-all;background:#f5f5f5;padding:10px}</style><h1>VLESS Node Manager</h1><form method=post action="/api/server/create${admin?'?key='+encodeURIComponent(key):''}"><input name=name placeholder="节点名称" required><input name=port placeholder="端口，默认26443"><input name=sni placeholder="SNI，默认www.microsoft.com"><button>添加节点</button></form><h2>节点</h2><table><tr><th>名称</th><th>Host</th><th>Port</th><th>SNI</th><th>Status</th><th>VLESS</th></tr>${rows}</table><h2>安装命令</h2>${cmds||'暂无节点'}`)
}
async function create(req){const u=new URL(req.url),f=await req.formData(),s={id:gid('srv'),name:String(f.get('name')||'node'),host:'',port:Number(f.get('port')||26443),sni:String(f.get('sni')||'www.microsoft.com'),status:'pending',createdAt:Date.now(),installToken:rand(),agentToken:null,vless:null,lastHeartbeat:null};await put(`server:${s.id}`,s);await put(`install:${s.installToken}`,{serverId:s.id});return Response.redirect(`${u.origin}/`+(u.search||''),303)}
async function install(req,token){const s=await installInfo(token);return s?json({id:s.id,name:s.name,host:s.host,port:s.port,sni:s.sni,status:s.status,createdAt:s.createdAt}):json({error:'invalid install token'},401)}
async function script(req,token){const s=await installInfo(token);if(!s)return new Response('invalid install token',{status:401});const w=new URL(req.url).origin;return new Response(`#!/bin/bash\nset -u\nWORKER=${JSON.stringify(w)}\nTOKEN=${JSON.stringify(token)}\n${AGENT_SCRIPT}\n`,{headers:{'content-type':'text/plain;charset=utf-8'}})}
async function register(req){let b;try{b=await req.json()}catch{return json({error:'invalid json'},400)}if(!b.installToken)return json({error:'missing installToken'},400);const m=await get(`install:${b.installToken}`);if(!m)return json({error:'invalid installToken'},401);const s=await get(`server:${m.serverId}`);if(!s)return json({error:'server not found'},404);for(const k of ['uuid','publicKey','shortId','host','port'])if(!b[k])return json({error:`missing ${k}`},400);const at=rand();s.host=b.host;s.port=Number(b.port);s.uuid=b.uuid;s.publicKey=b.publicKey;s.shortId=b.shortId;s.agentToken=at;s.status='online';s.lastHeartbeat=Date.now();s.vless=`vless://${b.uuid}@${b.host}:${s.port}?encryption=none&flow=xtls-rprx-vision&security=reality&sni=${encodeURIComponent(s.sni)}&fp=chrome&pbk=${encodeURIComponent(b.publicKey)}&sid=${b.shortId}&type=tcp#${encodeURIComponent(s.name)}`;await put(`server:${s.id}`,s);await put(`agent:${at}`,{serverId:s.id});return json({serverId:s.id,agentToken:at,vless:s.vless})}
async function heartbeat(req){const x=await agentServer(req);if(!x)return json({error:'unauthorized'},401);let b={};try{b=await req.json()}catch{}x.s.status='online';x.s.lastHeartbeat=Date.now();if(b.ip)x.s.host=b.ip;if(b.xray)x.s.xray=b.xray;await put(`server:${x.s.id}`,x.s);return json({ok:true})}
async function poll(req){const x=await agentServer(req);if(!x)return json({error:'unauthorized'},401);if(x.s.pendingCommand){const c=x.s.pendingCommand;x.s.pendingCommand=null;await put(`server:${x.s.id}`,x.s);return json(c)}return json({command:'none'})}

const AGENT_SCRIPT=String.raw`
CONFIG=/etc/vless-agent/config
mkdir -p /etc/vless-agent /etc/xray
printf 'WORKER=%q\nTOKEN=%q\n' "$WORKER" "$TOKEN" > "$CONFIG"
chmod 600 "$CONFIG"
. "$CONFIG"
log(){ echo "[vless-agent] $*"; }
fail(){ log "ERROR: $*"; exit 1; }
install_xray(){
  [ -x /usr/local/bin/xray ] && return 0
  curl -fsSL https://github.com/XTLS/Xray-install/raw/main/install-release.sh | bash -s install --version latest || fail "Xray installation failed"
}
setup_xray_service(){
cat >/etc/systemd/system/xray.service <<'UNIT'
[Unit]
Description=Xray Service
After=network.target nss-lookup.target
Wants=network.target
[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/xray run -config /etc/xray/config.json
Restart=on-failure
RestartSec=5
LimitNOFILE=1048576
[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
}
install_xray
setup_xray_service
I=$(curl -fsS --max-time 15 "$WORKER/api/install/$TOKEN") || fail "Worker install API failed"
SNI=$(printf '%s' "$I"|sed -n 's/.*"sni":"\([^"]*\)".*/\1/p')
PORT=$(printf '%s' "$I"|sed -n 's/.*"port":\([0-9]*\).*/\1/p')
[ -n "$SNI" ]||SNI=www.microsoft.com
[ -n "$PORT" ]||PORT=26443
UUID=$(/usr/local/bin/xray uuid)||fail "UUID generation failed"
K=$(/usr/local/bin/xray x25519)||fail "x25519 failed"
PRIV=$(printf '%s\n' "$K"|awk -F': ' '/^PrivateKey:/{print $2}')
PUB=$(printf '%s\n' "$K"|awk -F': ' '/PublicKey\):/{print $2}')
SID=$(openssl rand -hex 4)||fail "shortId generation failed"
[ -n "$PRIV" ]||fail "Reality privateKey empty"
[ -n "$PUB" ]||fail "Reality publicKey empty"
cat >/etc/xray/config.json <<EOF
{
  "log":{"loglevel":"warning"},
  "inbounds":[{"listen":"0.0.0.0","port":$PORT,"protocol":"vless","settings":{"clients":[{"id":"$UUID","flow":"xtls-rprx-vision"}],"decryption":"none"},"streamSettings":{"network":"tcp","security":"reality","realitySettings":{"show":false,"dest":"$SNI:443","xver":0,"serverNames":["$SNI"],"privateKey":"$PRIV","shortIds":["$SID"]}}}],
  "outbounds":[{"protocol":"freedom"}]
}
EOF
/usr/local/bin/xray run -test -config /etc/xray/config.json||fail "Xray config test failed"
systemctl enable xray >/dev/null 2>&1||true
systemctl restart xray
sleep 1
systemctl is-active --quiet xray||{ systemctl status xray --no-pager -l;fail "Xray failed to start"; }
IP=$(curl -4 -fsS --max-time 8 https://api.ipify.org 2>/dev/null||true)
[ -n "$IP" ]||IP=$(curl -6 -fsS --max-time 8 https://api64.ipify.org 2>/dev/null||true)
[ -n "$IP" ]||fail "public IP detection failed"
R=$(curl -fsS --max-time 15 -X POST "$WORKER/api/agent/register" -H 'content-type: application/json' --data "{\"installToken\":\"$TOKEN\",\"uuid\":\"$UUID\",\"publicKey\":\"$PUB\",\"shortId\":\"$SID\",\"host\":\"$IP\",\"port\":$PORT}")||fail "register failed"
AG=$(printf '%s' "$R"|sed -n 's/.*"agentToken":"\([^"]*\)".*/\1/p')
VLESS=$(printf '%s' "$R"|sed -n 's/.*"vless":"\([^"]*\)".*/\1/p')
[ -n "$AG" ]||{ echo "$R";fail "no agentToken returned"; }
printf '%s\n' "$R">/etc/vless-agent/register.json
printf 'AGENT_TOKEN=%q\n' "$AG">>/etc/vless-agent/config
chmod 600 /etc/vless-agent/config
cat >/etc/systemd/system/vless-agent.service <<'UNIT'
[Unit]
Description=VLESS Node Agent
After=network-online.target xray.service
Wants=network-online.target
[Service]
Type=simple
ExecStart=/usr/local/bin/vless-agent
Restart=always
RestartSec=5
[Install]
WantedBy=multi-user.target
UNIT
cat >/usr/local/bin/vless-agent <<'AGENT'
#!/bin/bash
set -u
. /etc/vless-agent/config
AGENT_TOKEN=\${AGENT_TOKEN:-}
[ -n "$AGENT_TOKEN" ] || exit 1
while true; do
  IP=$(curl -4 -fsS --max-time 8 https://api.ipify.org 2>/dev/null || true)
  curl -fsS --max-time 15 -X POST "$WORKER/api/agent/heartbeat" -H "Authorization: Bearer $AGENT_TOKEN" -H 'content-type: application/json' --data "{\"xray\":\"$(systemctl is-active xray 2>/dev/null || true)\",\"ip\":\"$IP\"}" >/dev/null 2>&1 || true
  C=$(curl -fsS --max-time 65 "$WORKER/api/agent/poll" -H "Authorization: Bearer $AGENT_TOKEN" 2>/dev/null || true)
  if printf '%s' "$C" | grep -q '"command":"restart_xray"'; then systemctl restart xray; fi
  sleep 5
done
AGENT
chmod 700 /usr/local/bin/vless-agent
systemctl daemon-reload
systemctl enable --now vless-agent
echo "VLESS: $VLESS"
`;

export default {async fetch(req,env){globalThis.DATA=env.DATA;globalThis.env=env;try{const u=new URL(req.url),p=u.pathname;if(p==='/'&&req.method==='GET')return home(req);if(p==='/api/server/create'&&req.method==='POST')return create(req);if(p.startsWith('/api/install/')&&req.method==='GET')return install(req,p.split('/').pop());if(p.startsWith('/api/install-script/')&&req.method==='GET')return script(req,p.split('/').pop());if(p==='/api/agent/register'&&req.method==='POST')return register(req);if(p==='/api/agent/heartbeat'&&req.method==='POST')return heartbeat(req);if(p==='/api/agent/poll'&&req.method==='GET')return poll(req);if(p==='/api/health')return json({ok:true,time:Date.now()});return new Response('Not found',{status:404})}catch(e){return json({error:String(e?.stack||e)},500)}}};
