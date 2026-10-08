const PAGE=`<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>VLESS Manager</title><style>body{font:15px system-ui;background:#0b1020;color:#eee;max-width:1100px;margin:auto;padding:24px}button,input{padding:10px;margin:4px;border-radius:8px;border:1px solid #345;background:#121a2d;color:#fff}button{cursor:pointer}.card{display:inline-block;vertical-align:top;width:300px;margin:8px;padding:18px;background:#121a2d;border:1px solid #263552;border-radius:14px}.on{color:#70e0a0}.code{word-break:break-all;background:#080d18;padding:10px;border-radius:8px}.modal{position:fixed;inset:0;background:#000b;display:flex;align-items:center;justify-content:center}.box{background:#121a2d;padding:24px;border-radius:14px;max-width:700px;width:90%}</style><div id=a></div><script>
let T=localStorage.vless_token||'';const A=document.querySelector('#a');
async function api(u,o={}){o.headers={'content-type':'application/json',...(T?{Authorization:'Bearer '+T}:{})};let r=await fetch(u,o);if(!r.ok)throw Error(await r.text());return r.json()}
function esc(x){return String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function login(){A.innerHTML='<div class=box><h2>VLESS Manager</h2><input id=p type=password placeholder=管理员密码><button onclick="go()">登录</button></div>'}window.go=async()=>{try{let r=await api('/api/login',{method:'POST',body:JSON.stringify({password:p.value})});T=r.token;localStorage.vless_token=T;load()}catch(e){alert('密码错误')}};
async function load(){try{let s=await api('/api/servers');A.innerHTML='<h2>VLESS Manager <button onclick="add()">+ 添加服务器</button></h2>'+s.map(x=>\`<div class=card><b>\${esc(x.name)}</b> <span class=\${x.status==='online'?'on':''}>● \${esc(x.status||'pending')}</span><p>\${esc(x.host||'等待 Agent')}:\${x.port}</p><p>SNI: \${esc(x.sni)}</p><button onclick="detail('\${x.id}')">节点详情</button><button onclick="restart('\${x.id}')">重启 Xray</button></div>\`).join('')}catch(e){T='';localStorage.removeItem('vless_token');login()}}
window.add=()=>A.insertAdjacentHTML('beforeend','<div class=modal><div class=box><h3>添加服务器</h3><input id=n placeholder=服务器名称><input id=po value=443><input id=s value=www.microsoft.com><button onclick="create()">生成安装命令</button><button onclick="load()">取消</button></div></div>');
window.create=async()=>{try{let r=await api('/api/servers',{method:'POST',body:JSON.stringify({name:n.value,port:+po.value,sni:s.value})});A.insertAdjacentHTML('beforeend',\`<div class=modal><div class=box><h3>一键安装</h3><div class=code>\${esc(r.command)}</div><button onclick="navigator.clipboard.writeText(\${JSON.stringify(r.command)})">复制</button><button onclick="load()">关闭</button></div></div>\`)}catch(e){alert(e)}};
window.detail=async id=>{let r=await api('/api/servers/'+id),s=r.server,v=s.uuid?\`vless://\${s.uuid}@\${s.host}:\${s.port}?encryption=none&flow=xtls-rprx-vision&security=reality&sni=\${encodeURIComponent(s.sni)}&fp=chrome&pbk=\${encodeURIComponent(s.publicKey)}&sid=\${s.shortId}&type=tcp#\${encodeURIComponent(s.name)}\`:'Agent 尚未注册';A.insertAdjacentHTML('beforeend',\`<div class=modal><div class=box><h3>\${esc(s.name)}</h3><div class=code>\${esc(v)}</div><button onclick='navigator.clipboard.writeText(\${JSON.stringify(v)})'>复制链接</button><button onclick="load()">关闭</button></div></div>\`) };window.restart=async id=>{await api('/api/servers/'+id+'/command',{method:'POST',body:JSON.stringify({action:'restart_xray'})});alert('已加入命令队列')};load();</script>`;
const j=(x,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{'content-type':'application/json;charset=utf-8'}});
async function hash(x){let b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(x));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}
const sk=id=>`server:${id}`,ik=t=>`install:${t}`,qk=id=>`queue:${id}`;
function ok(r,e){return (r.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'')===e.ADMIN_PASSWORD}
function link(s){return `vless://${s.uuid}@${s.host}:${s.port}?encryption=none&flow=xtls-rprx-vision&security=reality&sni=${encodeURIComponent(s.sni)}&fp=chrome&pbk=${encodeURIComponent(s.publicKey)}&sid=${s.shortId}&type=tcp#${encodeURIComponent(s.name)}`}
function installScript(origin,t){return `#!/bin/bash
set -e
W='${origin}'; T='${t}'
command -v curl >/dev/null || { apt-get update -y; apt-get install -y curl openssl; }
mkdir -p /etc/vless-agent
curl -fsSL "$W/agent.sh?token=$T" -o /etc/vless-agent/agent.sh
chmod +x /etc/vless-agent/agent.sh
cat >/etc/vless-agent/config <<EOF
WORKER=$W
TOKEN=$T
EOF
cat >/etc/systemd/system/vless-agent.service <<EOF
[Unit]
After=network-online.target
[Service]
ExecStart=/etc/vless-agent/agent.sh
Restart=always
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload; systemctl enable --now vless-agent
`}
function agentScript(){return `#!/bin/bash
set -u
. /etc/vless-agent/config
install_x(){ command -v xray >/dev/null || curl -fsSL https://github.com/XTLS/Xray-install/raw/main/install-release.sh | bash -s install --version latest; }
ip(){ curl -4 -fsS --max-time 5 https://api.ipify.org 2>/dev/null || curl -6 -fsS --max-time 5 https://api64.ipify.org 2>/dev/null || echo ''; }
install_x
I=$(curl -fsS "$WORKER/api/install/$TOKEN")
SNI=$(echo "$I"|sed -n 's/.*"sni":"\([^"]*\)".*/\\1/p'); PORT=$(echo "$I"|sed -n 's/.*"port":\([0-9]*\).*/\\1/p'); [ -n "$SNI" ]||SNI=www.microsoft.com; [ -n "$PORT" ]||PORT=443
UUID=$(xray uuid); K=$(xray x25519); PRIV=$(echo "$K"|awk '/Private key/{print $3}'); PUB=$(echo "$K"|awk '/Public key/{print $3}'); SID=$(openssl rand -hex 4)
mkdir -p /etc/xray
cat >/etc/xray/config.json <<EOF
{"log":{"loglevel":"warning"},"inbounds":[{"listen":"0.0.0.0","port":$PORT,"protocol":"vless","settings":{"clients":[{"id":"$UUID","flow":"xtls-rprx-vision"}],"decryption":"none"},"streamSettings":{"network":"tcp","security":"reality","realitySettings":{"show":false,"dest":"$SNI:443","xver":0,"serverNames":["$SNI"],"privateKey":"$PRIV","shortIds":["$SID"]}}}],"outbounds":[{"protocol":"freedom"}]}
EOF
systemctl enable --now xray || systemctl restart xray
IP=$(ip -4 route get 1.1.1.1 2>/dev/null|awk '{for(i=1;i<=NF;i++)if($i=="src"){print $(i+1);exit}}'); [ -n "$IP" ]||IP=$(ip -6 route get 2606:4700:4700::1111 2>/dev/null|awk '{for(i=1;i<=NF;i++)if($i=="src"){print $(i+1);exit}}')
R=$(curl -fsS -X POST "$WORKER/api/agent/register" -H 'content-type: application/json' -d "{\"installToken\":\"$TOKEN\",\"uuid\":\"$UUID\",\"publicKey\":\"$PUB\",\"shortId\":\"$SID\",\"host\":\"$IP\",\"port\":$PORT}")
AG=$(echo "$R"|sed -n 's/.*"agentToken":"\([^"]*\)".*/\\1/p'); echo "$R" >/etc/vless-agent/register.json
while true; do curl -fsS -X POST "$WORKER/api/agent/heartbeat" -H "Authorization: Bearer $AG" -H 'content-type: application/json' -d "{\"xray\":\"$(systemctl is-active xray 2>/dev/null)\",\"ip\":\"$IP\"}" >/dev/null || true; C=$(curl -fsS --max-time 60 "$WORKER/api/agent/poll" -H "Authorization: Bearer $AG" 2>/dev/null||echo '{}'); echo "$C"|grep -q restart_xray && systemctl restart xray; sleep 2; done
`}
export default{async fetch(r,e){let u=new URL(r.url),p=u.pathname;
if(p==='/'||p==='/index.html')return new Response(PAGE,{headers:{'content-type':'text/html;charset=utf-8'}});
if(p==='/api/login'&&r.method==='POST'){let b=await r.json();return b.password===e.ADMIN_PASSWORD?j({ok:true,token:e.ADMIN_PASSWORD}):j({error:'Unauthorized'},401)}
if(p==='/api/servers'&&r.method==='GET'){if(!ok(r,e))return j({error:'Unauthorized'},401);let z=[],c;do{let x=await e.DATA.list({prefix:'server:',cursor:c,limit:1000});for(let k of x.keys){let s=await e.DATA.get(k.name,'json');if(s)z.push(s)}c=x.list_complete?undefined:x.cursor}while(c);return j(z)}
if(p==='/api/servers'&&r.method==='POST'){if(!ok(r,e))return j({error:'Unauthorized'},401);let b=await r.json(),id='srv_'+crypto.randomUUID().replaceAll('-','').slice(0,16),t=crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-',''),s={id,name:b.name,host:'',port:+b.port||443,sni:b.sni||'www.microsoft.com',status:'pending',createdAt:Date.now()};await e.DATA.put(sk(id),JSON.stringify(s));await e.DATA.put(ik(t),JSON.stringify({serverId:id}),{expirationTtl:3600});return j({server:s,command:`curl -fsSL ${u.origin}/install/${t} | sudo bash`})}
if(p.startsWith('/api/servers/')&&p.endsWith('/command')&&r.method==='POST'){if(!ok(r,e))return j({error:'Unauthorized'},401);let id=p.split('/')[3],q=await e.DATA.get(qk(id),'json')||[];q.push({id:crypto.randomUUID(),...(await r.json()),createdAt:Date.now()});await e.DATA.put(qk(id),JSON.stringify(q),{expirationTtl:3600});return j({ok:true})}
if(p.startsWith('/api/servers/')&&r.method==='GET'){if(!ok(r,e))return j({error:'Unauthorized'},401);let s=await e.DATA.get(sk(p.split('/')[3]),'json');return s?j({server:s,state:{online:s.status==='online'&&Date.now()-s.lastSeen<90000}}):j({error:'Not found'},404)}
if(p.startsWith('/install/')){let t=p.split('/')[2];if(!await e.DATA.get(ik(t)))return new Response('Invalid token',{status:404});return new Response(installScript(u.origin,t),{headers:{'content-type':'text/plain'}})}
if(p==='/agent.sh'){let t=u.searchParams.get('token')||'';if(!await e.DATA.get(ik(t)))return new Response('Invalid token',{status:404});return new Response(agentScript(),{headers:{'content-type':'text/plain'}})}
if(p==='/api/install/'+p.split('/')[3]){let t=p.split('/')[3],r0=await e.DATA.get(ik(t),'json');if(!r0)return j({error:'Invalid token'},404);let s=await e.DATA.get(sk(r0.serverId),'json');return j(s||{})}
if(p==='/api/agent/register'&&r.method==='POST'){let b=await r.json(),rr=await e.DATA.get(ik(b.installToken),'json');if(!rr)return j({error:'Invalid token'},401);let s=await e.DATA.get(sk(rr.serverId),'json');if(!s)return j({error:'Not found'},404);let at=crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');Object.assign(s,{uuid:b.uuid,publicKey:b.publicKey,shortId:b.shortId,host:b.host||s.host,port:b.port||s.port,status:'online',lastSeen:Date.now(),agentTokenHash:await hash(at)});await e.DATA.put(sk(s.id),JSON.stringify(s));await e.DATA.delete(ik(b.installToken));return j({serverId:s.id,agentToken:at,vless:link(s)})}
if(p==='/api/agent/heartbeat'&&r.method==='POST'){let at=(r.headers.get('Authorization')||'').replace(/^Bearer\s+/i,''),a=[],c;do{let x=await e.DATA.list({prefix:'server:',cursor:c,limit:1000});a.push(...x.keys);c=x.list_complete?undefined:x.cursor}while(c);for(let k of a){let s=await e.DATA.get(k.name,'json');if(s&&s.agentTokenHash===await hash(at)){s.lastSeen=Date.now();s.status='online';s.agentInfo=await r.json();await e.DATA.put(k.name,JSON.stringify(s));return j({ok:true})}}return j({error:'Unauthorized'},401)}
if(p==='/api/agent/poll'){let at=(r.headers.get('Authorization')||'').replace(/^Bearer\s+/i,''),a=await e.DATA.list({prefix:'server:',limit:1000});for(let k of a.keys){let s=await e.DATA.get(k.name,'json');if(s&&s.agentTokenHash===await hash(at)){let q=await e.DATA.get(qk(s.id),'json')||[];if(q.length){let c=q.shift();await e.DATA.put(qk(s.id),JSON.stringify(q),{expirationTtl:3600});return j({command:c})}return j({command:null})}}return j({error:'Unauthorized'},401)}
return new Response('Not Found',{status:404})}};
