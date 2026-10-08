const app = document.querySelector('#app');
let token = localStorage.getItem('vm_token') || '';
let servers = [];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function api(path, opts={}) {
  opts.headers = {'content-type':'application/json', ...(opts.headers||{}), ...(token?{Authorization:`Bearer ${token}`}:{})};
  const r = await fetch(path, opts); if (!r.ok) throw new Error(await r.text()); return r.json();
}
function login(){ app.innerHTML=`<div class="login"><h1>VLESS Manager</h1><input id="pw" type="password" placeholder="管理员密码"><button onclick="doLogin()">登录</button></div>`; }
window.doLogin=async()=>{try{const r=await api('/api/login',{method:'POST',body:JSON.stringify({password:document.querySelector('#pw').value})}); token=r.token;localStorage.setItem('vm_token',token);render()}catch(e){alert('密码错误')}};
async function render(){try{servers=await api('/api/servers');}catch(e){localStorage.removeItem('vm_token');token='';return login();}app.innerHTML=`<header><h1>VLESS Manager</h1><button onclick="addServer()">+ 添加服务器</button></header><section class="grid">${servers.map(s=>`<article><div class="top"><strong>${esc(s.name)}</strong><span class="badge ${s.status==='online'?'on':''}">${esc(s.status)}</span></div><div class="meta">${esc(s.host||'等待 Agent')} · ${esc(s.port)}</div><div class="actions"><button onclick="details('${s.id}')">详情</button><button onclick="cmd('${s.id}','restart_xray')">重启 Xray</button></div></article>`).join('')}</section>`}
window.addServer=async()=>{const name=prompt('服务器名称');if(!name)return;try{const r=await api('/api/servers',{method:'POST',body:JSON.stringify({name})});prompt('复制下面的一键安装命令',r.command);render()}catch(e){alert(e.message)}};
window.details=async id=>{try{const r=await api('/api/servers/'+id);const s=r.server;const v=s.uuid?`vless://${s.uuid}@${s.host}:${s.port}?encryption=none&flow=xtls-rprx-vision&security=reality&sni=${encodeURIComponent(s.sni)}&fp=chrome&pbk=${s.publicKey}&sid=${s.shortId}&type=tcp#${encodeURIComponent(s.name)}`:'未注册';alert(`服务器：${s.name}\n状态：${r.state.online?'在线':'离线'}\nXray：${r.state.info?.xray||'-'}\n\n${v}`)}catch(e){alert(e.message)}};
window.cmd=async(id,action)=>{try{await api('/api/servers/'+id+'/command',{method:'POST',body:JSON.stringify({action})});alert('命令已进入队列');}catch(e){alert(e.message)}};
render();
