import {createClient} from '@supabase/supabase-js';

const config=window.APP_CONFIG||{};
const client=config.supabaseUrl&&config.supabaseAnonKey?createClient(config.supabaseUrl,config.supabaseAnonKey):null;
const root=document.getElementById('accountRoot');
let user=null,ready=false,open=false,message='';

const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

function renderAccount(){
 const label=user?'账号与同步状态':'登录练习空间';
 root.innerHTML=`<button class="account-trigger" id="accountToggle" aria-label="${label}" aria-expanded="${open}">
  <span class="account-avatar">${user?escape((user.email||'U').slice(0,1).toUpperCase()):'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 8a7 7 0 0 0-14 0"/></svg>'}</span>
  <i class="account-dot ${user&&ready?'online':user?'loading':''}"></i>
 </button>
 <div class="account-popover ${open?'open':''}" id="accountPopover" role="dialog" aria-label="账号">
  <div class="popover-head"><div><small>ACCOUNT</small><b>${user?'练习空间':'登录后开始 AI 训练'}</b></div><button id="accountClose" aria-label="关闭">×</button></div>
  ${accountBody()}
  ${message?`<p class="account-message" role="status">${escape(message)}</p>`:''}
 </div>`;
 document.getElementById('accountToggle')?.addEventListener('click',event=>{event.stopPropagation();setOpen(!open)});
 document.getElementById('accountClose')?.addEventListener('click',()=>setOpen(false));
 document.getElementById('loginForm')?.addEventListener('submit',login);
 document.getElementById('logout')?.addEventListener('click',logout);
 document.getElementById('reloadRecords')?.addEventListener('click',loadRecords);
}

function accountBody(){
 if(!client)return '<div class="account-state"><b>云端连接待配置</b><p>知识卡可以浏览，AI 训练暂不可用。</p></div>';
 if(!user)return `<form id="loginForm" class="account-login"><label>邮箱<input id="loginEmail" type="email" required placeholder="你的邮箱" autocomplete="email"></label><button class="btn primary wide">发送登录链接</button><p>仅已获邀请的账号可登录，训练答案只保存在你的账号下。</p></form>`;
 return `<div class="account-state"><span class="account-email">${escape(user.email)}</span><div class="sync-status"><i class="${ready?'ready':''}"></i><span>${ready?'云端记录已载入':'正在载入记录…'}</span></div><div class="account-actions"><button class="btn ghost" id="reloadRecords">刷新记录</button><button class="btn ghost" id="logout">退出</button></div></div>`;
}

function setOpen(value){
 open=value;renderAccount();
 if(open)setTimeout(()=>document.querySelector('#accountPopover input, #accountPopover button:not(#accountClose)')?.focus(),0);
}

async function login(event){
 event.preventDefault();const email=document.getElementById('loginEmail').value.trim();message='正在发送登录链接…';renderAccount();
 const {error}=await client.auth.signInWithOtp({email,options:{shouldCreateUser:false,emailRedirectTo:location.origin+location.pathname}});
 message=error?error.message:'登录链接已发送，请在邮箱中打开。';open=true;renderAccount();
}

async function logout(){const {error}=await client.auth.signOut();if(error){message=error.message;renderAccount()}}

async function loadRecords(){
 ready=false;message='';renderAccount();const uid=user?.id;if(!uid)return;
 try{
  const rows=[];
  for(let start=0;;start+=1000){
   const {data,error}=await client.from('training_records').select('id,payload').eq('user_id',uid).order('created_at').order('id').range(start,start+999);
   if(error)throw error;rows.push(...data);if(data.length<1000)break;
  }
  if(user?.id!==uid)return;
  ready=true;window.setCloudRecords(rows.map(row=>({...row.payload,recordId:row.id})));renderAccount();
 }catch(error){message='云端记录读取失败：'+error.message;renderAccount()}
}

window.cloud={
 authenticated:()=>!!user&&ready,
 openAccount:()=>setOpen(true),
 async add(record){
  if(!user||!ready)throw Error('请先登录并等待云端记录载入。');
  const id=record.recordId||crypto.randomUUID();const payload={...record,recordId:id};const {error}=await client.from('training_records').insert({id,user_id:user.id,payload});if(error&&error.code!=='23505')throw error;return payload;
 },
 async clear(){if(!user||!ready)throw Error('请先登录。');const {error}=await client.from('training_records').delete().eq('user_id',user.id);if(error)throw error},
 async coach(messages){
  if(!user||!ready)throw Error('请先登录并等待云端记录载入。');
  const {data,error}=await client.functions.invoke('english-coach',{body:{messages}});
  if(error){let detail='';try{detail=(await error.context.json()).error||''}catch{}throw Error(detail||error.message)}
  if(data?.error)throw Error(data.error);return data;
 }
};

document.addEventListener('click',event=>{if(open&&!root.contains(event.target))setOpen(false)});
document.addEventListener('keydown',event=>{
 if(event.key==='Escape'&&open){setOpen(false);document.getElementById('accountToggle')?.focus();return}
 if(event.key==='Tab'&&open){
  const focusable=[...document.querySelectorAll('#accountPopover input, #accountPopover button')].filter(element=>!element.disabled);
  if(!focusable.length)return;const first=focusable[0],last=focusable.at(-1);
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
 }
});

renderAccount();
if(client){
 let generation=0;
 client.auth.onAuthStateChange((_event,session)=>{
  const next=session?.user||null;if(next?.id===user?.id&&ready)return;
  user=next;ready=false;message='';window.setCloudRecords([]);renderAccount();const current=++generation;
  setTimeout(()=>{if(current===generation&&user)loadRecords()},0);
 });
}
