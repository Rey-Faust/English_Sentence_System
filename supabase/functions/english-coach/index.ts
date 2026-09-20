import {createClient} from 'npm:@supabase/supabase-js@2';
const cors={'Access-Control-Allow-Origin':'https://rey-faust.github.io','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 try{
  const authorization=req.headers.get('Authorization')||'';
  if(!authorization.startsWith('Bearer '))return json({error:'请先登录。'},401);
  const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
  const {data:{user},error}=await client.auth.getUser(authorization.slice(7));
  if(error||!user)return json({error:'登录已过期，请重新登录。'},401);
  const owner=Deno.env.get('COACH_OWNER_EMAIL');
  if(!owner||user.email?.toLowerCase()!==owner.toLowerCase())return json({error:'当前账号未获 AI 练习授权。'},403);
  const key=Deno.env.get('DEEPSEEK_API_KEY');
  if(!key)return json({error:'管理员尚未配置 DeepSeek 服务。'},503);
  const raw=await req.text();if(raw.length>20000)return json({error:'输入过长。'},413);
  let input;try{input=JSON.parse(raw)}catch{return json({error:'Invalid JSON'},400)}
  if(!Array.isArray(input.messages)||input.messages.length<1||input.messages.length>8||input.messages.some((x:any)=>!['system','user','assistant'].includes(x.role)||typeof x.content!=='string'||x.content.length>12000))return json({error:'Invalid messages'},400);
  const quota=await client.rpc('consume_coach_quota');
  if(quota.error)return json({error:'暂时无法验证练习额度。'},503);
  if(!quota.data)return json({error:'今日已达到 100 次 AI 请求上限。'},429);
  const response=await fetch('https://api.deepseek.com/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},body:JSON.stringify({model:'deepseek-flash',messages:input.messages,response_format:{type:'json_object'},thinking:{type:'disabled'},temperature:0.5,max_tokens:2500,stream:false}),signal:AbortSignal.timeout(60000)});
  if(!response.ok)return json({error:`AI 服务请求失败（${response.status}），请稍后重试。`},502);
  const result=await response.json();
  const content=result?.choices?.[0]?.message?.content;
  if(typeof content!=='string')return json({error:'AI 返回内容为空，请重试。'},502);
  let output;try{output=JSON.parse(content.replace(/^```json\s*/i,'').replace(/```$/,'').trim())}catch{return json({error:'AI 返回格式不正确，请重试。'},502)}
  if(!output||typeof output!=='object'||Array.isArray(output))return json({error:'AI 返回格式不正确。'},502);
  return json(output);
 }catch{return json({error:'服务暂时不可用，请稍后重试。'},503)}
});
