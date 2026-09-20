import {createClient} from '@supabase/supabase-js';
const cfg=window.APP_CONFIG||{};
const client=cfg.supabaseUrl&&cfg.supabaseAnonKey?createClient(cfg.supabaseUrl,cfg.supabaseAnonKey):null;
let user=null, ready=false;
const panel=document.createElement('div');
panel.className='card cloud-panel';panel.style.cssText='margin-bottom:20px';
document.querySelector('main').prepend(panel);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function status(message=''){
 panel.innerHTML=!client?'<b>云端连接待配置</b><p>知识卡可先浏览；登录、保存与 AI 练习将在后端配置完成后启用。</p>':user?`<div class="row"><b>${escape(user.email)}</b><span>${ready?'云端记录已载入':'正在载入记录…'}</span><button class="btn ghost" id="logout">退出</button><button class="btn ghost" id="reloadRecords">刷新记录</button></div>`:'<form id="loginForm"><b>登录你的练习空间</b><div class="row" style="margin-top:10px"><input id="loginEmail" type="email" required placeholder="你的邮箱" autocomplete="email"><button class="btn primary">发送登录链接</button></div><p>仅已获邀请的账号可登录。训练答案只保存在你的账号下。</p></form>';
 if(message){const p=document.createElement('p');p.textContent=message;panel.append(p)}
 document.getElementById('loginForm')?.addEventListener('submit',async e=>{
  e.preventDefault();const email=document.getElementById('loginEmail').value.trim();
  const button=e.target.querySelector('button');button.disabled=true;
  const {error}=await client.auth.signInWithOtp({email,options:{shouldCreateUser:false,emailRedirectTo:location.origin+location.pathname}});
  status(error?error.message:'登录链接已发送，请在邮箱中打开。');
 });
 document.getElementById('logout')?.addEventListener('click',async()=>{const {error}=await client.auth.signOut();if(error)status(error.message)});
 document.getElementById('reloadRecords')?.addEventListener('click',()=>loadRecords());
}
async function loadRecords(){
 ready=false;status();const uid=user?.id;if(!uid)return;
 try{
  let rows=[];
  for(let start=0;;start+=1000){
   const {data,error}=await client.from('training_records').select('id,payload').eq('user_id',uid).order('created_at').order('id').range(start,start+999);
   if(error)throw error;rows.push(...data);if(data.length<1000)break;
  }
  if(user?.id!==uid)return;
  window.setCloudRecords(rows.map(x=>({...x.payload,recordId:x.id})));ready=true;status();
 }catch(e){status('云端记录读取失败：'+e.message)}
}
window.cloud={
 authenticated:()=>!!user&&ready,
 async add(record){
  if(!user||!ready)throw Error('请先登录并等待云端记录载入。');
  const id=record.recordId||crypto.randomUUID();
  const {error}=await client.from('training_records').insert({id,user_id:user.id,payload:record});
  if(error)throw error;return {...record,recordId:id};
 },
 async clear(){
  if(!user||!ready)throw Error('请先登录。');
  const {error}=await client.from('training_records').delete().eq('user_id',user.id);if(error)throw error;
 },
 async coach(messages){
  if(!user||!ready)throw Error('请先登录并等待云端记录载入。');
  const {data,error}=await client.functions.invoke('english-coach',{body:{messages}});
  if(error){let detail='';try{detail=(await error.context.json()).error||''}catch{}throw Error(detail||error.message)}
  if(data?.error)throw Error(data.error);return data;
 }
};
status();
if(client){
 let generation=0;
 client.auth.onAuthStateChange((_event,session)=>{
  const next=session?.user||null;if(next?.id===user?.id&&ready)return;
  user=next;ready=false;window.setCloudRecords([]);status();
  const current=++generation;
  setTimeout(()=>{if(current===generation&&user)loadRecords()},0);
 });
}
