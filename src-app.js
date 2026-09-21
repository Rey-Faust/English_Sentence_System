import {GROUPS,escapeHtml as esc,groupFor,legacyPage,rankedStructures,selectSessionStructures,structureStats,summarizeSession} from './src-training.mjs';

const DATA=window.DATA;
const SESSION_KEY='core15-active-session-v1';
function restoreSession(){try{const saved=JSON.parse(localStorage.getItem(SESSION_KEY));return saved?.id&&saved?.structures?.length?saved:null}catch{return null}}
function persistSession(){try{state.session?localStorage.setItem(SESSION_KEY,JSON.stringify(state.session)):localStorage.removeItem(SESSION_KEY)}catch{}}
const restoredSession=restoreSession();
const state={
 records:[],page:legacyPage(location.hash),coreFilter:'all',coreQuery:'',forcedStructure:null,
 session:restoredSession,voice:null,voiceActive:false,inputMode:'text'
};
if(['#dashboard','#practice'].includes(location.hash))history.replaceState(null,'','#train');
let toastTimer=null;

const $=selector=>document.querySelector(selector);
const page=()=>$('#page');
const currentStructure=()=>state.session?.structures[state.session.round-1]||null;
const average=values=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:0;
const todayKey=()=>new Date().toLocaleDateString();

function toast(message){
 const element=$('#toast');if(!element)return;
 element.textContent=message;element.classList.add('show');clearTimeout(toastTimer);
 toastTimer=setTimeout(()=>element.classList.remove('show'),2400);
}

function header(kicker,title,subtitle,action=''){
 return `<header class="page-header"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1><p>${subtitle}</p></div>${action}</header>`;
}

function go(next){
 state.page=legacyPage(next);history.replaceState(null,'','#'+state.page);window.closeCoreDrawer();render();
 window.scrollTo({top:0,behavior:'smooth'});
}
window.go=go;

function stats(id){return structureStats(state.records,id)}
function weak(excluded=[]){return rankedStructures(DATA.core,state.records,excluded)}

function overallMetrics(){
 const scores=state.records.map(row=>Number(row.score)||0).filter(Boolean);
 const today=state.records.filter(row=>new Date(row.date).toLocaleDateString()===todayKey()).length;
 return {today,coverage:new Set(state.records.map(row=>String(row.id))).size,average:scores.length?average(scores):0,weakest:weak()[0]};
}

function trainSetup(){
 const recommended=state.forcedStructure
  ?[DATA.core.find(item=>String(item['#'])===String(state.forcedStructure)),...weak([state.forcedStructure]).slice(0,2)].filter(Boolean)
  :selectSessionStructures(DATA.core,state.records);
 const forced=state.forcedStructure?DATA.core.find(item=>String(item['#'])===String(state.forcedStructure)):null;
 return `<section class="train-grid">
  <div class="card setup-card">
   <div class="section-kicker">10 MIN · 3 ROUNDS</div>
   <h2>Start an adaptive conversation</h2>
   <p class="muted">AI 会优先训练未练或低分结构，并在第三轮加入 Precision 测试。</p>
   ${forced?`<div class="locked-structure"><span>第一轮已锁定</span><b>#${forced['#']} ${esc(forced.Function)} · ${esc(forced['中文'])}</b><button onclick="clearForcedStructure()" aria-label="取消锁定">×</button></div>`:''}
   <div class="form-grid">
    <label>Topic<input id="sessionTopic" value="${esc(state.lastTopic||'')}" placeholder="e.g. project update / learning / daily decision"></label>
    <label>Scenario<input id="sessionScenario" value="${esc(state.lastScenario||'')}" placeholder="e.g. work discussion / presentation / daily life"></label>
   </div>
   <button class="btn primary wide" id="startSession" onclick="startTrainingSession()">开始 10 分钟训练</button>
   <p class="privacy-note">回答会发送至 DeepSeek 进行训练分析，请勿输入敏感工作信息。</p>
  </div>
  <aside class="card recommendation-card">
   <div class="section-title">Recommended today</div>
   <div class="recommendation-list">${recommended.map((item,index)=>{
    const itemStats=stats(item['#']);
    return `<div><span>${index+1}</span><p><b>${esc(item.Function)} · ${esc(item['中文'])}</b><small>${itemStats.count?`${itemStats.avg.toFixed(1)}/5 · ${itemStats.count} attempts`:'Not practiced yet'}</small></p></div>`;
   }).join('')}</div>
  </aside>
 </section>`;
}

function sessionHeader(session){
 const elapsed=Math.max(0,Date.now()-session.startedAt);
 const remaining=Math.max(0,10-Math.floor(elapsed/60000));
 return `<div class="session-bar">
  <div><span>ROUND ${Math.min(session.round,3)} / 3</span><b>${session.phase==='complete'?'Session complete':`${remaining} min suggested`}</b></div>
  <div class="session-progress"><i style="width:${session.phase==='complete'?100:((session.round-1)/3)*100}%"></i></div>
  ${session.phase!=='complete'?'<button class="btn ghost compact" onclick="requestEarlyFinish()">提前结束</button>':''}
 </div>`;
}

function conversationTurn(role,label,content,extra=''){
 return `<article class="conversation-turn ${role}"><div class="turn-label">${label}</div><div class="turn-body">${content}</div>${extra}</article>`;
}

function answerComposer(mode){
 const placeholder=mode==='revision'?'Use the feedback and answer again in clearer English.':'Answer naturally in English. 1–4 sentences is enough.';
 return `<div class="answer-composer">
  <label for="sessionAnswer">${mode==='revision'?'Your improved answer':'Your answer'}</label>
  <textarea id="sessionAnswer" placeholder="${placeholder}"></textarea>
  <div class="composer-actions">
   <button class="btn voice" id="voiceButton" onclick="toggleVoice('sessionAnswer')">🎙 <span>${state.voiceActive?'停止录音':'语音回答'}</span></button>
   <button class="btn primary" id="submitAnswer" onclick="${mode==='revision'?'submitRevision()':'submitInitialAnswer()'}">${mode==='revision'?'提交改进答案':'提交并获得纠正'}</button>
  </div>
  <p class="voice-note">语音由浏览器服务转写；本站不保存音频，提交前可编辑文字。</p>
 </div>`;
}

function activeSessionPage(){
 const session=state.session;
 if(session.phase==='complete')return completedSessionPage();
 const structure=currentStructure();
 const turns=[];
 turns.push(conversationTurn('coach',`AI Coach · #${structure['#']} ${esc(structure.Function)}`,`<p class="question-text">${esc(session.question||'Preparing your question…')}</p><div class="target-pattern">Target: <b>${esc(structure['Core Answer Pattern'])}</b></div>`,session.phase==='question'?answerComposer('initial'):''));
 if(session.originalAnswer)turns.push(conversationTurn('learner','Your first answer',`<p>${esc(session.originalAnswer)}</p>`));
 if(session.feedback){
  const f=session.feedback;
  turns.push(conversationTurn('feedback','Minimum correction',`<div class="feedback-mini"><span>${esc(f.what_worked||'')}</span><b>${esc(f.key_issue||'')}</b><p>${esc(f.hint||f.why_it_matters||'')}</p></div><div class="followup"><small>FOLLOW-UP</small><strong>${esc(f.follow_up_question||'Please answer once more with greater precision.')}</strong></div>`,session.phase==='revision'?answerComposer('revision'):''));
 }
 return `<section class="session-shell">${sessionHeader(session)}<div class="conversation-feed">${turns.join('')}</div></section>`;
}

function completedSessionPage(){
 const session=state.session;const summary=summarizeSession(session.results);
 return `<section class="session-shell">${sessionHeader(session)}
  <div class="card session-summary">
   <div class="summary-mark">✓</div><div class="eyebrow">SESSION COMPLETE</div><h2>Three focused rounds finished</h2>
   <div class="summary-metrics"><div><b>${summary.average.toFixed(1)}</b><span>Average / 5</span></div><div><b>+${summary.improvement.toFixed(1)}</b><span>Average improvement</span></div><div><b>${session.results.length}</b><span>Rounds saved</span></div></div>
   <div class="summary-grid"><div><small>Strongest</small><b>${esc(summary.strongest?.function||'—')}</b><p>${esc(summary.strongest?.summary||'')}</p></div><div><small>Keep training</small><b>${esc(summary.weakest?.function||'—')}</b><p>${esc(session.finalRecommendation||'Repeat the weakest structure in a new context.')}</p></div></div>
   <div class="summary-actions"><button class="btn primary" onclick="repeatWeakest()">再练最弱结构</button><button class="btn ghost" onclick="finishSession()">结束训练</button></div>
  </div></section>`;
}

function trainPage(){
 const metrics=overallMetrics();
 return `${header('ADAPTIVE AI TRAINING','Think clearly. Speak naturally.','用 Core 15 建立思考结构，再通过即时追问和重答形成可迁移的表达能力。','<span class="pill">DeepSeek Coach</span>')}
 <section class="compact-metrics">
  <div><span>Today</span><b>${metrics.today}</b><small>rounds</small></div>
  <div><span>Coverage</span><b>${metrics.coverage}/15</b><small>structures</small></div>
  <div><span>Average</span><b>${metrics.average?metrics.average.toFixed(1):'—'}</b><small>out of 5</small></div>
  <div><span>Focus next</span><b class="metric-word">${esc(metrics.weakest?.Function||'Define')}</b><small>${esc(metrics.weakest?.['中文']||'定义')}</small></div>
 </section>
 ${state.session?activeSessionPage():trainSetup()}`;
}

function coreCard(item){
 const itemStats=stats(item['#']);
 return `<button class="core-card" data-group="${groupFor(item)}" data-search="${esc(`${item.Function} ${item['中文']} ${item['Core Question']} ${item['Core Answer Pattern']}`.toLowerCase())}" onclick="openCoreDrawer(${item['#']})">
  <div class="core-card-head"><span>${item['#']}</span><div><b>${esc(item.Function)}</b><small>${esc(item['中文'])}</small></div><i>→</i></div>
  <p>${esc(item['Core Question'])}</p><code>${esc(item['Core Answer Pattern'])}</code>
  <footer><span>${itemStats.count} attempts</span><span>${itemStats.count?itemStats.avg.toFixed(1):'—'}/5</span></footer>
 </button>`;
}

function corePage(){
 const groups=GROUPS.filter(group=>state.coreFilter==='all'||group.id===state.coreFilter);
 return `${header('CORE KNOWLEDGE','Core 15','先识别思想关系，再选择语言结构。点击卡片查看完整结构与示例。')}
 <section class="core-toolbar"><label class="search-box">⌕<input id="coreSearch" value="${esc(state.coreQuery)}" oninput="filterCoreCards(this.value)" placeholder="搜索结构、问题或句型"></label><div class="filter-pills"><button class="${state.coreFilter==='all'?'active':''}" onclick="setCoreFilter('all')">All</button>${GROUPS.map(group=>`<button class="${state.coreFilter===group.id?'active':''}" onclick="setCoreFilter('${group.id}')">${group.label}</button>`).join('')}</div></section>
 <div id="coreGroups">${groups.map(group=>`<section class="core-group"><div class="group-heading"><div><span>${group.label}</span><h2>${group.cn}</h2></div><b>${group.functions.length}</b></div><div class="core-grid">${DATA.core.filter(item=>group.functions.includes(item.Function)).map(coreCard).join('')}</div></section>`).join('')}</div>`;
}

function logPage(){
 const rows=[...state.records].reverse();
 return `${header('HISTORY','Training Log','查看第一次回答、改进回答与每轮训练结果。','<button class="btn ghost" onclick="exportCSV()">Export CSV</button>')}
 <div class="card"><div class="table-wrap"><table class="responsive-table log-table"><thead><tr><th>Date</th><th>Structure</th><th>Topic</th><th>Answer → Revision</th><th>Score</th><th>Status</th></tr></thead><tbody>${rows.length?rows.map(row=>`<tr><td data-label="Date">${new Date(row.date).toLocaleDateString()}</td><td data-label="Structure"><b>${esc(row.function)}</b>${row.round?`<br><span class="tag">Round ${row.round}</span>`:row.ai?'<br><span class="tag">AI</span>':''}</td><td data-label="Topic">${esc(row.topic||'')}<br><span class="muted">${esc(row.scenario||'')}</span></td><td data-label="Answer"><span>${esc(row.originalAnswer||row.answer||'')}</span>${row.revisedAnswer||row.answer2?`<strong>→ ${esc(row.revisedAnswer||row.answer2)}</strong>`:''}</td><td data-label="Score">${row.score}/5${row.improvement?`<br><span class="positive">+${Number(row.improvement).toFixed(1)}</span>`:''}</td><td data-label="Status">${esc(row.status||'')}</td></tr>`).join(''):'<tr><td colspan="6">No records yet.</td></tr>'}</tbody></table></div><div class="row actions-row"><button class="btn ghost" onclick="clearLog()">Clear All</button></div></div>`;
}

function progressPage(){
 const rows=DATA.core.map(item=>({item,...stats(item['#'])}));
 return `${header('ANALYTICS','Progress & Weakness','未练、低分和少练的结构会优先进入下一次自适应训练。')}
 <div class="card"><div class="table-wrap"><table class="responsive-table progress-table"><thead><tr><th>#</th><th>Structure</th><th>Group</th><th>Attempts</th><th>Avg</th><th>Status</th><th>Progress</th></tr></thead><tbody>${rows.map(row=>`<tr><td data-label="#">${row.item['#']}</td><td data-label="Structure"><b>${esc(row.item.Function)}</b><br><span class="muted">${esc(row.item['中文'])}</span></td><td data-label="Group">${esc(GROUPS.find(group=>group.id===groupFor(row.item))?.label)}</td><td data-label="Attempts">${row.count}</td><td data-label="Average">${row.count?row.avg.toFixed(1):'—'}</td><td data-label="Status">${row.count>=3&&row.avg>=4?'Mastered':row.count?'Training':'Not started'}</td><td data-label="Progress"><div class="progress"><span style="width:${Math.min(100,(row.count/3)*Math.min(1,row.avg/4)*100)}%"></span></div></td></tr>`).join('')}</tbody></table></div></div>`;
}

function grammarPage(){
 return `${header('REFERENCE','Question Grammar','Core 15 决定思考关系；Question Grammar 帮助你把问题问得准确自然。')}
 <div class="card"><div class="table-wrap"><table class="responsive-table grammar-table"><thead><tr><th>Type</th><th>功能</th><th>Structure</th><th>Example</th><th>Use</th><th>Scenario</th></tr></thead><tbody>${DATA.grammar.map(item=>`<tr><td data-label="Type"><b>${esc(item['Question Type'])}</b></td><td data-label="功能">${esc(item['中文功能'])}</td><td data-label="Structure"><code>${esc(item['结构'])}</code></td><td data-label="Example">${esc(item.Example)}</td><td data-label="Use">${esc(item['主要用途'])}</td><td data-label="Scenario">${esc(item['高频场景'])}</td></tr>`).join('')}</tbody></table></div></div>`;
}

function render(){
 document.querySelectorAll('[data-page]').forEach(button=>{const active=button.dataset.page===state.page;button.classList.toggle('active',active);active?button.setAttribute('aria-current','page'):button.removeAttribute('aria-current')});
 page().innerHTML=state.page==='train'?trainPage():state.page==='core'?corePage():state.page==='log'?logPage():state.page==='progress'?progressPage():grammarPage();
 if(state.page==='core'&&state.coreQuery)filterCoreCards(state.coreQuery);
}

window.setCloudRecords=records=>{state.records=records;render()};
window.setCoreFilter=filter=>{state.coreFilter=filter;render()};
window.filterCoreCards=query=>{state.coreQuery=query;const normalized=query.trim().toLowerCase();document.querySelectorAll('.core-card').forEach(card=>card.hidden=!!normalized&&!card.dataset.search.includes(normalized))};
window.clearForcedStructure=()=>{state.forcedStructure=null;render()};

window.startTrainingSession=async()=>{
 if(!window.cloud?.authenticated()){toast('请先登录后开始 AI 训练。');window.cloud?.openAccount();return}
 const topic=$('#sessionTopic')?.value.trim()||'daily life';const scenario=$('#sessionScenario')?.value.trim()||'general conversation';
 state.lastTopic=topic;state.lastScenario=scenario;
 const structures=selectSessionStructures(DATA.core,state.records,state.forcedStructure);state.forcedStructure=null;
 state.session={id:crypto.randomUUID(),topic,scenario,structures,round:1,phase:'loading',startedAt:Date.now(),results:[],question:'',originalAnswer:'',feedback:null,finalRecommendation:''};persistSession();render();
 await generateRoundQuestion();
};

async function coach(messages){if(!window.cloud)throw Error('云端连接尚未准备好。');return window.cloud.coach(messages)}

async function generateRoundQuestion(){
 const session=state.session;const structure=currentStructure();
 try{
  const output=await coach([{role:'system',content:'You are an English thinking coach. Create one concise, practical question that naturally requires the target logical structure. Return JSON only: {"question":"...","why":"..."}.'},{role:'user',content:`Round ${session.round}/3. Topic: ${session.topic}. Scenario: ${session.scenario}. Function: ${structure.Function}. Pattern: ${structure['Core Answer Pattern']}. Use: ${structure['Core Use']}.`}]);
  session.question=output.question||structure['Core Question'];session.phase='question';persistSession();render();
 }catch(error){session.phase='question';session.question=structure['Core Question'];persistSession();render();toast(error.message)}
}

window.submitInitialAnswer=async()=>{
 const answer=$('#sessionAnswer')?.value.trim();if(!answer)return toast('请先回答问题。');
 const session=state.session;const structure=currentStructure();const button=$('#submitAnswer');if(button){button.disabled=true;button.textContent='AI 正在分析…'}
 try{
  const output=await coach([{role:'system',content:'You are a concise English coach. Give only the highest-value correction. Return JSON only with keys: score (1-5), clarity_score, structure_score, naturalness_score, what_worked, key_issue, hint, better_version, follow_up_question.'},{role:'user',content:`Target: ${structure.Function} / ${structure['Core Answer Pattern']}. Question: ${session.question}. Learner answer: ${answer}. Topic: ${session.topic}.`}]);
  session.originalAnswer=answer;session.originalInputMode=state.inputMode;session.feedback=output;session.phase='revision';state.inputMode='text';persistSession();render();
  requestAnimationFrame(()=>$('.answer-composer')?.scrollIntoView({behavior:'smooth',block:'center'}));
 }catch(error){toast(error.message);if(button){button.disabled=false;button.textContent='提交并获得纠正'}}
};

window.submitRevision=async()=>{
 const revised=$('#sessionAnswer')?.value.trim();if(!revised)return toast('请提交改进后的回答。');
 const session=state.session;const structure=currentStructure();const isFinal=session.round===3;const nextStructure=!isFinal?session.structures[session.round]:null;const button=$('#submitAnswer');if(button){button.disabled=true;button.textContent='正在评估改进…'}
 try{
  const output=await coach([{role:'system',content:`You evaluate improvement after immediate feedback. ${isFinal?'Also give one next-session recommendation.':'Also create the next concise question for the supplied next structure.'} Return JSON only with keys: revised_score (1-5), improvement (0-4), round_summary, next_question, next_tip, final_recommendation.`},{role:'user',content:`Current structure: ${structure.Function} / ${structure['Core Answer Pattern']}. Question: ${session.question}. Original answer: ${session.originalAnswer}. Key correction: ${session.feedback?.key_issue||''}. Follow-up: ${session.feedback?.follow_up_question||''}. Revised answer: ${revised}.${nextStructure?` Next structure: ${nextStructure.Function} / ${nextStructure['Core Answer Pattern']}.`:''}`}]);
  const score=Math.max(1,Math.min(5,Number(output.revised_score)||Number(session.feedback?.score)||3));
  const improvement=Math.max(0,Number(output.improvement)||score-(Number(session.feedback?.score)||score));
  const record={date:new Date().toISOString(),id:structure['#'],function:structure.Function,topic:session.topic,scenario:session.scenario,answer:session.originalAnswer,answer2:revised,originalAnswer:session.originalAnswer,revisedAnswer:revised,precision:session.feedback?.better_version||'',score,status:score<=3?'Review':'Done',ai:true,sessionId:session.id,round:session.round,improvement,inputMode:session.originalInputMode||'text',sessionCompleted:isFinal,question:session.question,aiIssue:session.feedback?.key_issue||'',aiBetter:session.feedback?.better_version||'',aiFollowup:session.feedback?.follow_up_question||'',roundSummary:output.round_summary||''};
  const saved=await window.cloud.add(record);state.records.push(saved);session.results.push({...record,summary:output.round_summary||''});
  session.originalAnswer='';session.feedback=null;state.inputMode='text';
  if(isFinal){session.phase='complete';session.finalRecommendation=output.final_recommendation||output.next_tip||'Repeat the weakest structure in a new context.'}
  else{session.round+=1;session.question=output.next_question||nextStructure['Core Question'];session.phase='question'}
  persistSession();render();window.scrollTo({top:0,behavior:'smooth'});
 }catch(error){toast(error.message);if(button){button.disabled=false;button.textContent='提交改进答案'}}
};

window.requestEarlyFinish=()=>{
 if(!state.session?.results.length){state.session=null;persistSession();render();return}
 state.session.phase='complete';state.session.finalRecommendation='Continue with the next recommended structure when you return.';persistSession();render();
};
window.finishSession=()=>{state.session=null;persistSession();render();window.scrollTo({top:0,behavior:'smooth'})};
window.repeatWeakest=()=>{const summary=summarizeSession(state.session.results);state.forcedStructure=summary.weakest?.id||weak()[0]?.['#'];state.session=null;persistSession();render();window.scrollTo({top:0,behavior:'smooth'})};

window.toggleVoice=targetId=>{
 if(state.voiceActive){state.voice?.stop();return}
 const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;if(!Recognition)return toast('当前浏览器不支持语音输入，请使用文字回答。');
 const target=document.getElementById(targetId);const recognition=new Recognition();state.voice=recognition;recognition.lang='en-US';recognition.interimResults=true;recognition.continuous=false;
 const initial=target?.value.trim()||'';state.voiceActive=true;state.inputMode='voice';renderVoiceButton();
 recognition.onresult=event=>{let text='';for(let i=event.resultIndex;i<event.results.length;i++)text+=event.results[i][0].transcript;const current=document.getElementById(targetId);if(current)current.value=[initial,text.trim()].filter(Boolean).join(initial?' ':'')};
 recognition.onerror=event=>{toast(event.error==='not-allowed'?'麦克风权限未开启，请改用文字回答。':'语音识别失败，请重试或使用文字。')};
 recognition.onend=()=>{state.voiceActive=false;state.voice=null;renderVoiceButton()};
 try{recognition.start()}catch{state.voiceActive=false;toast('语音输入暂时不可用，请使用文字回答。');renderVoiceButton()}
};
function renderVoiceButton(){const button=$('#voiceButton');if(button){button.classList.toggle('recording',state.voiceActive);button.querySelector('span').textContent=state.voiceActive?'停止录音':'语音回答'}}

window.readQuestion=()=>{if(!('speechSynthesis'in window))return toast('当前浏览器不支持朗读。');speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(state.session?.question||'');utterance.lang='en-US';speechSynthesis.speak(utterance)};

window.openCoreDrawer=id=>{
 const index=DATA.core.findIndex(item=>Number(item['#'])===Number(id));const item=DATA.core[index];if(!item)return;
 const root=$('#drawerRoot');root.innerHTML=`<div class="drawer-backdrop" onclick="closeCoreDrawer()"></div><aside class="core-drawer" role="dialog" aria-modal="true" aria-labelledby="drawerTitle"><div class="drawer-head"><div><span>#${item['#']} · ${esc(GROUPS.find(group=>group.id===groupFor(item))?.label)}</span><h2 id="drawerTitle">${esc(item.Function)} · ${esc(item['中文'])}</h2></div><button onclick="closeCoreDrawer()" aria-label="关闭">×</button></div><div class="drawer-content">
  <div class="drawer-lead"><small>CORE QUESTION</small><b>${esc(item['Core Question'])}</b><code>${esc(item['Core Answer Pattern'])}</code></div>
  ${[['Expansion Patterns',item['Expansion Patterns']],['Corresponding Questions',item['对应疑问句']],['Alternative Questions',item['Alternative Questions']],['Natural Follow-up',item['Natural Follow-up']],['Core Use',item['Core Use']],['Scenarios',item['高频场景']],['Statement Example',item['陈述例句']],['Question Example',item['疑问例句']],['Q&A Example',`${item['Example Question']} → ${item['Example Answer']}`],['Full Speaking Loop',`${item['Core Question']} → ${item['Core Answer Pattern']} → ${item['Natural Follow-up']} → expanded answer → precision upgrade`]].map(([label,value])=>`<section><small>${label}</small><p>${esc(value)}</p></section>`).join('')}
 </div><footer class="drawer-actions"><button class="btn ghost" onclick="openCoreDrawer(${DATA.core[(index-1+DATA.core.length)%DATA.core.length]['#']})">← Previous</button><button class="btn primary" onclick="trainFromCore(${item['#']})">用这个结构训练</button><button class="btn ghost" onclick="openCoreDrawer(${DATA.core[(index+1)%DATA.core.length]['#']})">Next →</button></footer></aside>`;
 root.classList.add('open');setTimeout(()=>root.querySelector('.core-drawer button')?.focus(),0);
};
window.closeCoreDrawer=()=>{const root=$('#drawerRoot');if(root){root.classList.remove('open');root.innerHTML=''}};
window.trainFromCore=id=>{state.forcedStructure=id;state.session=null;window.closeCoreDrawer();go('train')};

window.exportCSV=()=>{
 if(!state.records.length)return toast('No records');const headers=['Date','Function','Topic','Scenario','Original Answer','Revised Answer','Score','Improvement','Status'];
 const rows=state.records.map(row=>[row.date,row.function,row.topic||'',row.scenario||'',row.originalAnswer||row.answer||'',row.revisedAnswer||row.answer2||'',row.score,row.improvement||'',row.status||'']);
 const csv=[headers,...rows].map(row=>row.map(value=>`"${String(value??'').replace(/"/g,'""')}"`).join(',')).join('\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='sentence_training_log.csv';link.click();URL.revokeObjectURL(link.href);
};
window.clearLog=async()=>{if(!confirm('删除账号下的全部训练记录？请先导出 CSV 备份。'))return;try{await window.cloud.clear();state.records=[];render()}catch(error){toast('删除失败：'+error.message)}};

document.querySelectorAll('[data-page]').forEach(button=>button.addEventListener('click',()=>go(button.dataset.page)));
document.addEventListener('keydown',event=>{if(event.key==='Escape')window.closeCoreDrawer()});
window.addEventListener('hashchange',()=>{state.page=legacyPage(location.hash);render()});
window.appToast=toast;
render();
if(restoredSession)setTimeout(()=>toast('已恢复上次未完成的训练。'),250);
