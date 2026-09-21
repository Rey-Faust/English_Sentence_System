export const GROUPS=[
 {id:'meaning',label:'Meaning',cn:'构建含义',functions:['Define','Add','Clarify','Support']},
 {id:'reasoning',label:'Reasoning',cn:'解释与推理',functions:['Cause','Result','Condition','Purpose','Method']},
 {id:'organizing',label:'Organizing',cn:'比较与组织',functions:['Compare','Contrast','Sequence']},
 {id:'precision',label:'Precision',cn:'表达精度',functions:['Scope','Modality','Negation']}
];

export function escapeHtml(value=''){
 return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
}

export function structureStats(records,id){
 const rows=records.filter(record=>String(record.id)===String(id));
 const scores=rows.map(record=>Number(record.score)||0).filter(Boolean);
 return {count:rows.length,avg:scores.length?scores.reduce((sum,score)=>sum+score,0)/scores.length:0};
}

export function rankedStructures(core,records,excluded=[]){
 const excludedIds=new Set(excluded.map(String));
 return core
  .filter(item=>!excludedIds.has(String(item['#'])))
  .map(item=>{
   const stats=structureStats(records,item['#']);
   const weakness=stats.count===0?1000-item['#']:((5-stats.avg)*10)+(12/Math.sqrt(stats.count));
   return {...item,...stats,weakness};
  })
  .sort((a,b)=>b.weakness-a.weakness||a['#']-b['#']);
}

export function selectSessionStructures(core,records,forcedId=null){
 const selected=[];
 const forced=forcedId&&core.find(item=>String(item['#'])===String(forcedId));
 if(forced)selected.push(forced);
 const thought=rankedStructures(core.filter(item=>item.Layer==='Thought Building'),records,selected.map(item=>item['#']));
 while(selected.length<2&&thought.length)selected.push(thought.shift());
 if(selected.length<2){
  const fallback=rankedStructures(core,records,selected.map(item=>item['#']))[0];
  if(fallback)selected.push(fallback);
 }
 const precision=rankedStructures(core.filter(item=>item.Layer==='Precision'),records,selected.map(item=>item['#']))[0];
 if(precision)selected.push(precision);
 while(selected.length<3){
  const fallback=rankedStructures(core,records,selected.map(item=>item['#']))[0];
  if(!fallback)break;selected.push(fallback);
 }
 return selected.slice(0,3);
}

export function groupFor(item){
 return GROUPS.find(group=>group.functions.includes(item.Function))?.id||'meaning';
}

export function legacyPage(hash=''){
 const page=String(hash).replace(/^#/,'');
 if(page==='dashboard'||page==='practice'||!page)return 'train';
 return ['train','core','log','progress','grammar'].includes(page)?page:'train';
}

export function summarizeSession(results){
 if(!results.length)return {average:0,improvement:0,strongest:null,weakest:null};
 const sorted=[...results].sort((a,b)=>(b.score||0)-(a.score||0));
 return {
  average:results.reduce((sum,row)=>sum+(Number(row.score)||0),0)/results.length,
  improvement:results.reduce((sum,row)=>sum+(Number(row.improvement)||0),0)/results.length,
  strongest:sorted[0],
  weakest:sorted.at(-1)
 };
}
