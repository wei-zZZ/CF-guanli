const json=(d,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{'content-type':'application/json;charset=utf-8'}});
const html=(s,st=200,extra={})=>new Response(s,{status:st,headers:{'content-type':'text/html;charset=utf-8',...extra}});
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
 if(admin&&key!==admin)return html(`<!doctype html><meta charset=utf-8><title>VLESS Manager</title><style>body{font-family:system-ui;margin:0;background:#0b1020;color:#e8ecf5;display:grid;place-items:center;min-height:100vh}main{background:#121a2e;padding:32px;border-radius:18px;box-shadow:0 20px 60px #0008}a{color:#8ab4ff}</style><main><h2>需要管理员密钥</h2><p>请在 URL 后添加 <code>?key=...</code></p></main>`,403);
 const list=await DATA.list({prefix:'server:'}), ss=[]; for(const k of list.keys){const s=await get(k.name);if(s)ss.push(s)} ss.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
 const base=u.origin;
 const rows=ss.map(s=>{
   const online=s.status==='online' && s.lastHeartbeat && Date.now()-s.lastHeartbeat<600000;
   const installCmd=`curl -fsSL "${base}/api/install-script/${s.installToken}" | bash`;
   const uninstallCmd=`curl -fsSL "${base}/api/uninstall-script/${s.installToken}" | bash`;
   return `<div class="node"><div class="node-main"><div class="node-title"><span class="dot ${online?'on':''}"></span><strong>${esc(s.name)}</strong><span class="badge ${online?'green':''}">${online?'ONLINE':'PENDING'}</span>${(s.type==='argo')?'<span class="badge" style="background:#2a1f4d;color:#c4b5fd;border:1px solid #4c3d7a">ARGO</span>':''}</div><div class="meta"><span>HOST <b>${esc(s.host||'-')}</b></span><span>PORT <b>${s.port||'-'}</b></span>${s.type==='argo'?`<span>PATH <b>${esc(s.wsPath||'-')}</b></span>`:`<span>SNI <b>${esc(s.sni)}</b></span>`}<span>创建 <b>${s.createdAt?new Date(s.createdAt).toLocaleString('zh-CN'): '-'}</b></span></div>${s.vless?`<div class="share"><div class="share-label">VLESS 分享链接</div><textarea id="v-${esc(s.id)}" readonly>${esc(s.vless)}</textarea><button class="mini copy-el" data-target="v-${esc(s.id)}">复制</button></div>`:''}</div><div class="actions"><button class="primary copy-btn" data-copy="${esc(installCmd)}">安装命令</button><button class="danger copy-btn" data-copy="${esc(uninstallCmd)}">卸载命令</button>${s.vless?`<button class="ghost copy-btn" data-copy="${esc(s.vless)}">复制节点</button>`:''}<button class="danger del-btn" data-id="${esc(s.id)}">删除</button></div></div>`;
 }).join('');
 const createUrl=`/api/server/create${admin?'?key='+encodeURIComponent(key):''}`;
 return html(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>VLESS Node Manager</title><style>
 :root{--bg:#080d18;--panel:#101827;--panel2:#151f31;--line:#253249;--text:#edf2fa;--muted:#8d9bb2;--blue:#5b8cff;--blue2:#7aa3ff;--red:#ef6262;--green:#35c98a}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 20% -10%,#19335e 0,#080d18 38%);color:var(--text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;min-height:100vh}.wrap{max-width:1250px;margin:0 auto;padding:34px 20px 60px}.top{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;margin-bottom:28px}.brand{display:flex;align-items:center;gap:14px}.logo{width:44px;height:44px;border-radius:13px;background:linear-gradient(135deg,#5b8cff,#8c6cff);display:grid;place-items:center;font-weight:900;box-shadow:0 10px 30px #4268d844}.title{font-size:25px;font-weight:800;letter-spacing:-.5px}.sub{color:var(--muted);font-size:13px;margin-top:4px}.count{background:#17243a;border:1px solid var(--line);padding:9px 13px;border-radius:12px;color:#b9c8df;font-size:13px}.panel{background:rgba(16,24,39,.84);border:1px solid var(--line);border-radius:18px;box-shadow:0 20px 70px #0005;backdrop-filter:blur(12px);padding:18px;margin-bottom:20px}.panel-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}.panel h2{font-size:16px;margin:0}.form{display:grid;grid-template-columns:1.4fr 150px 1.3fr auto;gap:10px}.input{width:100%;background:#0b1220;border:1px solid var(--line);color:var(--text);border-radius:10px;padding:11px 12px;outline:none}.input:focus{border-color:#5b8cff;box-shadow:0 0 0 3px #5b8cff18}.btn{border:0;border-radius:10px;padding:10px 14px;color:white;font-weight:700;cursor:pointer;transition:.15s}.btn:hover,button:hover{transform:translateY(-1px)}.add{background:linear-gradient(135deg,#5b8cff,#6b72ff)}.node{display:flex;gap:20px;justify-content:space-between;background:linear-gradient(145deg,#131d2e,#101827);border:1px solid var(--line);border-radius:16px;padding:18px;margin-top:12px}.node-main{min-width:0;flex:1}.node-title{display:flex;align-items:center;gap:9px;font-size:16px}.dot{width:9px;height:9px;border-radius:50%;background:#68758a;box-shadow:0 0 0 4px #68758a18}.dot.on{background:var(--green);box-shadow:0 0 0 4px #35c98a1c}.badge{font-size:10px;padding:4px 7px;border-radius:7px;background:#263247;color:#9eacc1;letter-spacing:.4px}.badge.green{background:#10372d;color:#5ce1a8}.meta{display:flex;flex-wrap:wrap;gap:7px 18px;color:var(--muted);font-size:11px;margin:11px 0 14px}.meta b{color:#c8d2e1;font-weight:600;margin-left:4px}.share{position:relative}.share-label{font-size:11px;color:var(--muted);margin-bottom:6px}.share textarea{width:100%;height:58px;resize:none;background:#0a111e;border:1px solid #253249;color:#aecaef;border-radius:9px;padding:10px 48px 10px 10px;font:12px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace;outline:none}.mini{position:absolute;right:7px;top:23px;background:#202d42;border:1px solid #34445f;color:#dce7f7;border-radius:7px;padding:6px 8px;font-size:11px;cursor:pointer}.actions{display:flex;flex-direction:column;gap:8px;min-width:105px;justify-content:center}.actions button{cursor:pointer;border:1px solid transparent;border-radius:9px;padding:9px 12px;font-size:12px;font-weight:700}.primary{background:#426eea;color:#fff}.danger{background:#351b25;border-color:#5b2936!important;color:#ff9eaa}.ghost{background:#172235;border-color:#2a3a55!important;color:#c8d7ed}.empty{text-align:center;color:var(--muted);padding:45px 10px}.tip{font-size:12px;color:var(--muted);line-height:1.7;margin-top:10px}@media(max-width:760px){.top{align-items:flex-start}.form{grid-template-columns:1fr}.node{flex-direction:column}.actions{flex-direction:row;flex-wrap:wrap}.actions button{flex:1}.meta{gap:7px 12px}.wrap{padding:22px 12px 40px}}
 </style></head><body><div class="wrap"><div class="top"><div class="brand"><div class="logo">V</div><div><div class="title">VLESS Node Manager</div><div class="sub">Cloudflare Worker · Xray · Reality 节点管理</div></div></div><div class="count">${ss.length} 个节点</div></div><section class="panel"><div class="panel-head"><h2>添加节点</h2></div><form class="form" method="post" action="${createUrl}"><input class="input" name="name" placeholder="节点名称，例如 Tokyo-01" required><input class="input" name="port" type="number" min="1" max="65535" placeholder="26443"><input class="input" name="sni" placeholder="SNI，例如 www.microsoft.com"><button class="btn add">＋ 添加节点</button></form><div class="tip">创建节点后点击「安装命令」，复制到 VPS 执行即可自动安装 Xray、生成 Reality 密钥并注册节点。</div></section>
<section class="panel"><div class="panel-head"><h2>添加 Argo 节点</h2><span style="font-size:12px;color:var(--muted)">Cloudflare Tunnel · 无需开放端口</span></div>
${(env.CF_API_TOKEN&&env.CF_ACCOUNT_ID&&env.CF_ZONE_ID&&env.CF_DOMAIN)?`<form class="form" method="post" action="/api/server/create-argo${admin?'?key='+encodeURIComponent(key):''}" style="grid-template-columns:1.4fr 1.2fr auto"><input class="input" name="name" placeholder="节点名称，例如 Argo-HK" required><input class="input" name="subdomain" placeholder="子域名，例如 hk01（将生成 hk01.${esc(env.CF_DOMAIN||'')}）" required><button class="btn add" style="background:linear-gradient(135deg,#7c5cff,#5b8cff)">＋ 添加 Argo</button></form><div class="tip">使用 Cloudflare API 自动创建 Tunnel + DNS。安装后流量经 CF 443，VPS 无需暴露端口。域名：<b>${esc(env.CF_DOMAIN||'')}</b></div>`:`<div class="tip" style="color:#ef6262">未配置 Cloudflare 变量。请在 Worker 设置中添加：<code>CF_API_TOKEN</code>、<code>CF_ACCOUNT_ID</code>、<code>CF_ZONE_ID</code>、<code>CF_DOMAIN</code></div>`}
</section>
<section class="panel"><div class="panel-head"><h2>节点列表</h2><span style="font-size:12px;color:var(--muted)">安装 / 卸载 / 分享 / 删除</span></div>${rows||'<div class="empty">暂无节点<br><span>先在上方添加一个节点</span></div>'}</section></div><script>function toast(t){let x=document.getElementById('toast');if(!x){x=document.createElement('div');x.id='toast';x.style='position:fixed;left:50%;bottom:30px;transform:translateX(-50%);background:#1b2940;color:#fff;border:1px solid #34445f;padding:11px 16px;border-radius:10px;box-shadow:0 10px 30px #0008;font-size:13px;z-index:99';document.body.appendChild(x)}x.textContent=t;x.style.opacity=1;clearTimeout(x._t);x._t=setTimeout(()=>x.style.opacity=0,1800)}async function copyText(t,b){try{if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(t)}else{const a=document.createElement('textarea');a.value=t;a.style.position='fixed';a.style.left='-9999px';document.body.appendChild(a);a.focus();a.select();if(!document.execCommand('copy'))throw new Error('copy failed');a.remove()}let z=b.textContent;b.textContent='已复制';setTimeout(()=>b.textContent=z,1200);toast('已复制到剪贴板')}catch(e){const a=document.createElement('textarea');a.value=t;a.style.position='fixed';a.style.left='10px';a.style.top='10px';a.style.width='90%';a.style.height='120px';a.style.zIndex='9999';document.body.appendChild(a);a.focus();a.select();toast('自动复制失败，请按 Ctrl+C');setTimeout(()=>a.remove(),5000)}}document.addEventListener('click',e=>{const b=e.target.closest('.copy-btn');if(b){copyText(b.dataset.copy,b);return}const c=e.target.closest('.copy-el');if(c){const el=document.getElementById(c.dataset.target);if(el)copyText(el.value,c);return}const d=e.target.closest('.del-btn');if(d){if(!confirm('确定删除该节点？此操作不可恢复。'))return;const id=d.dataset.id;d.disabled=true;d.textContent='删除中…';fetch('/api/server/delete'+(location.search||''),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id})}).then(r=>r.json()).then(j=>{if(j.ok){toast('已删除');location.reload()}else{toast(j.error||'删除失败');d.disabled=false;d.textContent='删除'}}).catch(()=>{toast('删除失败');d.disabled=false;d.textContent='删除'})}})</script></body></html>`,200,{'cache-control':'private, max-age=30'})
}

async function cfApi(path,method='GET',body){
  const token=env.CF_API_TOKEN,acc=env.CF_ACCOUNT_ID;
  if(!token||!acc)throw new Error('CF_API_TOKEN / CF_ACCOUNT_ID not set');
  const opt={method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'}};
  if(body!==undefined)opt.body=JSON.stringify(body);
  const r=await fetch('https://api.cloudflare.com/client/v4'+path,opt);
  const j=await r.json().catch(()=>({}));
  if(!r.ok||j.success===false)throw new Error((j.errors&&j.errors[0]&&j.errors[0].message)||('CF API '+r.status));
  return j.result;
}
async function createArgo(req){
  const u=new URL(req.url),f=await req.formData();
  const name=String(f.get('name')||'argo-node');
  let sub=String(f.get('subdomain')||'').trim().toLowerCase().replace(/[^a-z0-9-]/g,'');
  if(!sub)sub=rand(4);
  const domain=(env.CF_DOMAIN||'').replace(/^\.+/,'').replace(/\.$/,'');
  const zone=env.CF_ZONE_ID;
  if(!env.CF_API_TOKEN||!env.CF_ACCOUNT_ID||!zone||!domain){
    return html(`<!doctype html><meta charset=utf-8><title>配置缺失</title><body style="font-family:system-ui;background:#0b1020;color:#e8ecf5;padding:40px"><h2>缺少 Cloudflare 配置</h2><p>请在 Worker 变量中设置：</p><ul><li>CF_API_TOKEN</li><li>CF_ACCOUNT_ID</li><li>CF_ZONE_ID</li><li>CF_DOMAIN</li></ul><a href="/${u.search||''}" style="color:#8ab4ff">返回</a></body>`,400);
  }
  const hostname=`${sub}.${domain}`;
  const localPort=10000+Math.floor(Math.random()*50000);
  const wsPath='/'+rand(8);
  const tunnel=await cfApi(`/accounts/${env.CF_ACCOUNT_ID}/cfd_tunnel`,'POST',{name:`vless-${sub}-${Date.now().toString(36)}`,config_src:'cloudflare'});
  const tunnelId=tunnel.id,tunnelToken=tunnel.token;
  await cfApi(`/accounts/${env.CF_ACCOUNT_ID}/cfd_tunnel/${tunnelId}/configurations`,'PUT',{config:{ingress:[{hostname,service:`http://127.0.0.1:${localPort}`},{service:'http_status:404'}]}});
  let dnsId=null;
  try{
    const dns=await cfApi(`/zones/${zone}/dns_records`,'POST',{type:'CNAME',proxied:true,name:hostname,content:`${tunnelId}.cfargotunnel.com`});
    dnsId=dns.id;
  }catch(e){
    // try update existing
    try{
      const list=await cfApi(`/zones/${zone}/dns_records?type=CNAME&name=${encodeURIComponent(hostname)}`);
      const rec=(Array.isArray(list)?list:(list&&list.result)||[])[0];
      if(rec&&rec.id){
        await cfApi(`/zones/${zone}/dns_records/${rec.id}`,'PUT',{type:'CNAME',proxied:true,name:hostname,content:`${tunnelId}.cfargotunnel.com`});
        dnsId=rec.id;
      }else throw e;
    }catch(e2){throw e}
  }
  const s={id:gid('srv'),name,host:hostname,port:443,sni:hostname,status:'pending',createdAt:Date.now(),installToken:rand(),agentToken:null,vless:null,lastHeartbeat:null,type:'argo',tunnelId,tunnelToken,dnsId,localPort,wsPath,hostname};
  await put(`server:${s.id}`,s);
  await put(`install:${s.installToken}`,{serverId:s.id});
  return Response.redirect(`${u.origin}/`+(u.search||''),303);
}
async function create(req){const u=new URL(req.url),f=await req.formData(),s={id:gid('srv'),name:String(f.get('name')||'node'),host:'',port:Number(f.get('port')||26443),sni:String(f.get('sni')||'www.microsoft.com'),status:'pending',createdAt:Date.now(),installToken:rand(),agentToken:null,vless:null,lastHeartbeat:null,type:'reality'};await put(`server:${s.id}`,s);await put(`install:${s.installToken}`,{serverId:s.id});return Response.redirect(`${u.origin}/`+(u.search||''),303)}
async function install(req,token){const s=await installInfo(token);return s?json({id:s.id,name:s.name,host:s.host,port:s.port,sni:s.sni,status:s.status,createdAt:s.createdAt,type:s.type||'reality',tunnelToken:s.tunnelToken||null,localPort:s.localPort||null,wsPath:s.wsPath||null,hostname:s.hostname||s.host||null}):json({error:'invalid install token'},401)}
async function script(req,token){const s=await installInfo(token);if(!s)return new Response('invalid install token',{status:401});const w=new URL(req.url).origin;const body=(s.type==='argo'?ARGO_SCRIPT:AGENT_SCRIPT);return new Response(`#!/bin/bash\nset -u\nWORKER=${JSON.stringify(w)}\nTOKEN=${JSON.stringify(token)}\n${body}\n`,{headers:{'content-type':'text/plain;charset=utf-8'}})}
async function uninstallScript(req,token){
 const s=await installInfo(token);if(!s)return new Response('invalid install token',{status:401});
 return new Response(`#!/bin/bash
set -u
systemctl disable --now vless-agent 2>/dev/null || true
systemctl disable --now xray 2>/dev/null || true
systemctl disable --now cloudflared 2>/dev/null || true
rm -f /etc/systemd/system/vless-agent.service /etc/systemd/system/xray.service /etc/systemd/system/cloudflared.service /usr/local/bin/vless-agent
rm -rf /etc/vless-agent /etc/xray
rm -f /usr/local/bin/xray /usr/local/bin/xray-helper /usr/local/bin/cloudflared 2>/dev/null || true
systemctl daemon-reload
systemctl reset-failed 2>/dev/null || true
echo "VLESS Agent / Xray / cloudflared 已卸载"`,{headers:{'content-type':'text/plain;charset=utf-8'}})
}
async function register(req){let b;try{b=await req.json()}catch{return json({error:'invalid json'},400)}if(!b.installToken)return json({error:'missing installToken'},400);const m=await get(`install:${b.installToken}`);if(!m)return json({error:'invalid installToken'},401);const s=await get(`server:${m.serverId}`);if(!s)return json({error:'server not found'},404);if(!b.uuid)return json({error:'missing uuid'},400);if((s.type||'reality')!=='argo'){for(const k of ['publicKey','shortId','host','port'])if(!b[k])return json({error:`missing ${k}`},400)}const at=rand();s.uuid=b.uuid;s.publicKey=b.publicKey||null;s.shortId=b.shortId||null;s.agentToken=at;s.status='online';s.lastHeartbeat=Date.now();if((s.type||'reality')==='argo'){s.host=s.hostname||b.host||s.host;s.port=443;s.vless=`vless://${b.uuid}@${s.host}:443?encryption=none&security=tls&type=ws&host=${encodeURIComponent(s.host)}&path=${encodeURIComponent(s.wsPath||'/')}&sni=${encodeURIComponent(s.host)}&fp=chrome#${encodeURIComponent(s.name)}`}else{s.host=b.host;s.port=Number(b.port);s.vless=`vless://${b.uuid}@${b.host}:${s.port}?encryption=none&flow=xtls-rprx-vision&security=reality&sni=${encodeURIComponent(s.sni)}&fp=chrome&pbk=${encodeURIComponent(b.publicKey)}&sid=${b.shortId}&spx=%2F&type=tcp#${encodeURIComponent(s.name)}`};await put(`server:${s.id}`,s);await put(`agent:${at}`,{serverId:s.id});return json({serverId:s.id,agentToken:at,vless:s.vless})}
async function heartbeat(req){const x=await agentServer(req);if(!x)return json({error:'unauthorized'},401);let b={};try{b=await req.json()}catch{}const now=Date.now();const prev=x.s.lastHeartbeat||0;const ipChanged=!!(b.ip&&b.ip!==x.s.host);let cmd=null;if(x.s.pendingCommand){cmd=x.s.pendingCommand;x.s.pendingCommand=null}const minInterval=Number(env.HB_MIN_MS||300000);const mustWrite=!!(b.force||ipChanged||cmd||!prev||(now-prev)>=minInterval);if(!mustWrite){return json({ok:true,skipped:true,command:{command:'none'}})}x.s.status='online';x.s.lastHeartbeat=now;if(b.ip)x.s.host=b.ip;if(b.xray)x.s.xray=b.xray;if(b.cloudflared)x.s.cloudflared=b.cloudflared;if((x.s.type||'reality')!=='argo'&&x.s.uuid&&x.s.publicKey&&x.s.shortId&&x.s.host&&x.s.port){x.s.vless=`vless://${x.s.uuid}@${x.s.host}:${x.s.port}?encryption=none&flow=xtls-rprx-vision&security=reality&sni=${encodeURIComponent(x.s.sni||'www.microsoft.com')}&fp=chrome&pbk=${encodeURIComponent(x.s.publicKey)}&sid=${x.s.shortId}&spx=%2F&type=tcp#${encodeURIComponent(x.s.name||'node')}`}await put(`server:${x.s.id}`,x.s);return json({ok:true,command:cmd||{command:'none'}})}
async function poll(req){const x=await agentServer(req);if(!x)return json({error:'unauthorized'},401);if(x.s.pendingCommand){const c=x.s.pendingCommand;x.s.pendingCommand=null;await put(`server:${x.s.id}`,x.s);return json(c)}return json({command:'none'})}


const ARGO_SCRIPT=String.raw`
CONFIG=/etc/vless-agent/config
mkdir -p /etc/vless-agent /etc/xray
printf 'WORKER=%q\nTOKEN=%q\n' "$WORKER" "$TOKEN" > "$CONFIG"
chmod 600 "$CONFIG"
. "$CONFIG"
log(){ echo "[vless-argo] $*"; }
fail(){ log "ERROR: $*"; exit 1; }
install_xray(){
  [ -x /usr/local/bin/xray ] && return 0
  local arch ver tmp url
  case "$(uname -m)" in
    x86_64|amd64) arch=64;;
    aarch64|arm64) arch=arm64-v8a;;
    armv7l|armv7) arch=arm32-v7a;;
    armv6l) arch=arm32-v6;;
    i386|i686) arch=32;;
    *) fail "unsupported architecture: $(uname -m)";;
  esac
  tmp=$(mktemp -d)
  ver=$(curl -fsSL --max-time 20 https://api.github.com/repos/XTLS/Xray-core/releases/latest | sed -n 's/.*"tag_name": *"\([^"]*\)".*/\1/p' | head -n1)
  [ -n "$ver" ] || fail "failed to get latest Xray version"
  url="https://github.com/XTLS/Xray-core/releases/download/$ver/Xray-linux-$arch.zip"
  log "Downloading Xray $ver..."
  curl -fsSL --max-time 120 -o "$tmp/xray.zip" "$url" || fail "download Xray failed"
  if ! command -v unzip >/dev/null 2>&1; then
    if command -v apt-get >/dev/null 2>&1; then apt-get update -y >/dev/null 2>&1; apt-get install -y unzip >/dev/null 2>&1
    elif command -v yum >/dev/null 2>&1; then yum install -y unzip >/dev/null 2>&1
    elif command -v dnf >/dev/null 2>&1; then dnf install -y unzip >/dev/null 2>&1
    fi
  fi
  unzip -qo "$tmp/xray.zip" xray -d "$tmp" || fail "extract failed"
  install -m 755 "$tmp/xray" /usr/local/bin/xray
  rm -rf "$tmp"
}
install_cloudflared(){
  if command -v cloudflared >/dev/null 2>&1; then return 0; fi
  local arch
  case "$(uname -m)" in
    x86_64|amd64) arch=amd64;;
    aarch64|arm64) arch=arm64;;
    armv7l) arch=arm;;
    *) fail "unsupported arch for cloudflared";;
  esac
  curl -fsSL -o /usr/local/bin/cloudflared "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-$arch" || fail "download cloudflared failed"
  chmod +x /usr/local/bin/cloudflared
}
install_xray
install_cloudflared
I=$(curl -fsS --max-time 15 "$WORKER/api/install/$TOKEN") || fail "Worker install API failed"
HOST=$(printf '%s' "$I"|sed -n 's/.*"hostname":"\([^"]*\)".*/\1/p')
[ -n "$HOST" ] || HOST=$(printf '%s' "$I"|sed -n 's/.*"host":"\([^"]*\)".*/\1/p')
LPORT=$(printf '%s' "$I"|sed -n 's/.*"localPort":\([0-9]*\).*/\1/p')
WSPATH=$(printf '%s' "$I"|sed -n 's/.*"wsPath":"\([^"]*\)".*/\1/p')
TUNTOKEN=$(printf '%s' "$I"|sed -n 's/.*"tunnelToken":"\([^"]*\)".*/\1/p')
[ -n "$LPORT" ] || fail "missing localPort"
[ -n "$WSPATH" ] || fail "missing wsPath"
[ -n "$TUNTOKEN" ] || fail "missing tunnelToken"
[ -n "$HOST" ] || fail "missing hostname"
UUID=$(/usr/local/bin/xray uuid)||fail "uuid failed"
cat >/etc/xray/config.json <<EOF
{
  "log":{"loglevel":"warning"},
  "inbounds":[{
    "listen":"127.0.0.1",
    "port":$LPORT,
    "protocol":"vless",
    "settings":{"clients":[{"id":"$UUID"}],"decryption":"none"},
    "streamSettings":{"network":"ws","wsSettings":{"path":"$WSPATH"}}
  }],
  "outbounds":[{"protocol":"freedom"}]
}
EOF
/usr/local/bin/xray run -test -config /etc/xray/config.json||fail "config test failed"
cat >/etc/systemd/system/xray.service <<'UNIT'
[Unit]
Description=Xray Service
After=network.target
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
cat >/etc/systemd/system/cloudflared.service <<UNIT
[Unit]
Description=Cloudflare Tunnel
After=network-online.target
Wants=network-online.target
[Service]
Type=simple
ExecStart=/usr/local/bin/cloudflared tunnel --no-autoupdate run --token $TUNTOKEN
Restart=on-failure
RestartSec=5
[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now xray
systemctl enable --now cloudflared
sleep 2
systemctl is-active --quiet xray||{ systemctl status xray --no-pager -l; fail "xray failed"; }
systemctl is-active --quiet cloudflared||{ systemctl status cloudflared --no-pager -l; fail "cloudflared failed"; }
R=$(curl -fsS --max-time 15 -X POST "$WORKER/api/agent/register" -H 'content-type: application/json' --data "{\"installToken\":\"$TOKEN\",\"uuid\":\"$UUID\",\"host\":\"$HOST\",\"port\":443}")||fail "register failed"
AG=$(printf '%s' "$R"|sed -n 's/.*"agentToken":"\([^"]*\)".*/\1/p')
VLESS=$(printf '%s' "$R"|sed -n 's/.*"vless":"\([^"]*\)".*/\1/p')
[ -n "$AG" ]||{ echo "$R"; fail "no agentToken"; }
printf '%s\n' "$R">/etc/vless-agent/register.json
printf 'AGENT_TOKEN=%q\n' "$AG">>/etc/vless-agent/config
chmod 600 /etc/vless-agent/config
cat >/etc/systemd/system/vless-agent.service <<'UNIT'
[Unit]
Description=VLESS Node Agent
After=network-online.target
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
[ -n "$AGENT_TOKEN" ] || exit 1
while true; do
  curl -fsS --max-time 15 -X POST "$WORKER/api/agent/heartbeat" -H "Authorization: Bearer $AGENT_TOKEN" -H 'content-type: application/json' --data "{\"xray\":\"$(systemctl is-active xray 2>/dev/null || true)\",\"cloudflared\":\"$(systemctl is-active cloudflared 2>/dev/null || true)\"}" >/dev/null 2>&1 || true
  sleep 300
done
AGENT
chmod 700 /usr/local/bin/vless-agent
systemctl daemon-reload
systemctl enable --now vless-agent
echo "Argo VLESS: $VLESS"
echo "Hostname: $HOST"
`;

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
  local arch ver tmp url
  case "$(uname -m)" in
    x86_64|amd64) arch=64;;
    aarch64|arm64) arch=arm64-v8a;;
    armv7l|armv7) arch=arm32-v7a;;
    armv6l) arch=arm32-v6;;
    i386|i686) arch=32;;
    *) fail "unsupported architecture: $(uname -m)";;
  esac
  systemctl stop xray 2>/dev/null || true
  systemctl disable xray 2>/dev/null || true
  pkill -x xray 2>/dev/null || true
  tmp=$(mktemp -d)
  ver=$(curl -fsSL --max-time 20 https://api.github.com/repos/XTLS/Xray-core/releases/latest | sed -n 's/.*"tag_name": *"\([^"]*\)".*/\1/p' | head -n1)
  [ -n "$ver" ] || fail "failed to get latest Xray version from GitHub"
  url="https://github.com/XTLS/Xray-core/releases/download/$ver/Xray-linux-$arch.zip"
  log "Downloading Xray $ver ($arch)..."
  curl -fsSL --max-time 120 -o "$tmp/xray.zip" "$url" || fail "download Xray failed: $url"
  if ! command -v unzip >/dev/null 2>&1; then
    if command -v apt-get >/dev/null 2>&1; then apt-get update -y >/dev/null 2>&1; apt-get install -y unzip >/dev/null 2>&1
    elif command -v dnf >/dev/null 2>&1; then dnf install -y unzip >/dev/null 2>&1
    elif command -v yum >/dev/null 2>&1; then yum install -y unzip >/dev/null 2>&1
    elif command -v apk >/dev/null 2>&1; then apk add --no-cache unzip >/dev/null 2>&1
    fi
  fi
  command -v unzip >/dev/null 2>&1 || fail "unzip is required but not installed"
  unzip -qo "$tmp/xray.zip" xray -d "$tmp" || fail "extract Xray failed"
  install -m 755 "$tmp/xray" /usr/local/bin/xray || fail "install xray binary failed"
  rm -rf "$tmp"
  log "Xray $ver installed to /usr/local/bin/xray"
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
PRIV=$(printf '%s\n' "$K"|sed -n 's/^[Pp]rivate[Kk]ey:[[:space:]]*//p'|head -n1|tr -d '\r')
PUB=$(printf '%s\n' "$K"|sed -n 's/^[Pp]assword[^:]*:[[:space:]]*//p;s/^[Pp]ublic[Kk]ey:[[:space:]]*//p'|head -n1|tr -d '\r')
SID=$(openssl rand -hex 8)||fail "shortId generation failed"
[ -n "$PRIV" ]||{ echo "$K"; fail "Reality privateKey empty"; }
[ -n "$PUB" ]||{ echo "$K"; fail "Reality publicKey empty"; }
log "Reality keys ok (pbk=$PUB sid=$SID)"
cat >/etc/xray/config.json <<EOF
{
  "log":{"loglevel":"warning"},
  "inbounds":[{"listen":"0.0.0.0","port":$PORT,"protocol":"vless","settings":{"clients":[{"id":"$UUID","flow":"xtls-rprx-vision"}],"decryption":"none"},"streamSettings":{"network":"tcp","security":"reality","realitySettings":{"show":false,"dest":"$SNI:443","xver":0,"serverNames":["$SNI"],"privateKey":"$PRIV","shortIds":["$SID"]}}}],
  "outbounds":[{"protocol":"freedom"}]
}
EOF
/usr/local/bin/xray run -test -config /etc/xray/config.json||fail "Xray config test failed"
# open port on common firewalls
if command -v ufw >/dev/null 2>&1; then ufw allow "$PORT"/tcp >/dev/null 2>&1 || true; fi
if command -v firewall-cmd >/dev/null 2>&1; then firewall-cmd --permanent --add-port="$PORT"/tcp >/dev/null 2>&1 || true; firewall-cmd --reload >/dev/null 2>&1 || true; fi
iptables -C INPUT -p tcp --dport "$PORT" -j ACCEPT 2>/dev/null || iptables -I INPUT -p tcp --dport "$PORT" -j ACCEPT 2>/dev/null || true
iptables -C INPUT -p tcp --dport "$PORT" -j ACCEPT 2>/dev/null || true
systemctl enable xray >/dev/null 2>&1||true
systemctl restart xray
sleep 1
systemctl is-active --quiet xray||{ systemctl status xray --no-pager -l;fail "Xray failed to start"; }
ss -lntp 2>/dev/null | grep -E ":$PORT\\b" || log "warning: port $PORT not seen in ss (check cloud security group)"
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
[ -n "$AGENT_TOKEN" ] || exit 1
while true; do
  IP=$(curl -4 -fsS --max-time 8 https://api.ipify.org 2>/dev/null || true)
  R=$(curl -fsS --max-time 15 -X POST "$WORKER/api/agent/heartbeat" -H "Authorization: Bearer $AGENT_TOKEN" -H 'content-type: application/json' --data "{\"xray\":\"$(systemctl is-active xray 2>/dev/null || true)\",\"ip\":\"$IP\"}" 2>/dev/null || true)
  if printf '%s' "$R" | grep -q '"command":"restart_xray"'; then systemctl restart xray; fi
  sleep 300
done
AGENT
chmod 700 /usr/local/bin/vless-agent
systemctl daemon-reload
systemctl enable --now vless-agent
echo "VLESS: $VLESS"
`;

async function remove(req){const u=new URL(req.url),admin=env.ADMIN_KEY||'',key=u.searchParams.get('key')||'';if(admin&&key!==admin)return json({error:'unauthorized'},403);let id;try{const b=await req.json();id=b.id}catch{return json({error:'invalid body'},400)}if(!id)return json({error:'missing id'},400);const s=await get(`server:${id}`);if(!s)return json({error:'not found'},404);if(s.type==='argo'&&s.tunnelId&&env.CF_API_TOKEN&&env.CF_ACCOUNT_ID){try{await cfApi(`/accounts/${env.CF_ACCOUNT_ID}/cfd_tunnel/${s.tunnelId}`,'DELETE')}catch(e){}}if(s.type==='argo'&&s.dnsId&&env.CF_API_TOKEN&&env.CF_ZONE_ID){try{await cfApi(`/zones/${env.CF_ZONE_ID}/dns_records/${s.dnsId}`,'DELETE')}catch(e){}}await DATA.delete(`server:${id}`);if(s.installToken)await DATA.delete(`install:${s.installToken}`);if(s.agentToken)await DATA.delete(`agent:${s.agentToken}`);return json({ok:true})}
export default {async fetch(req,env){globalThis.DATA=env.DATA;globalThis.env=env;try{const u=new URL(req.url),p=u.pathname;if(p==='/'&&req.method==='GET')return home(req);if(p==='/api/server/create'&&req.method==='POST')return create(req);if(p==='/api/server/create-argo'&&req.method==='POST')return createArgo(req);if(p==='/api/server/delete'&&req.method==='POST')return remove(req);if(p.startsWith('/api/install/')&&req.method==='GET')return install(req,p.split('/').pop());if(p.startsWith('/api/install-script/')&&req.method==='GET')return script(req,p.split('/').pop());if(p.startsWith('/api/uninstall-script/')&&req.method==='GET')return uninstallScript(req,p.split('/').pop());if(p==='/api/agent/register'&&req.method==='POST')return register(req);if(p==='/api/agent/heartbeat'&&req.method==='POST')return heartbeat(req);if(p==='/api/agent/poll'&&req.method==='GET')return poll(req);if(p==='/api/health')return json({ok:true,time:Date.now()});return new Response('Not found',{status:404})}catch(e){return json({error:String(e?.stack||e)},500)}}};
