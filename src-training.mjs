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

const clean=value=>String(value??'').trim();
const normalized=value=>clean(value).toLowerCase().replace(/[\s.,!?;:'"’]+/g,' ').trim();
const unique=values=>new Set(values.map(normalized)).size===values.length;

export function selectConstructionType(records=[]){
 const previous=[...records].reverse().find(record=>['fill','reorder'].includes(record.questionType));
 return previous?.questionType==='fill'?'reorder':'fill';
}

export function validateExercisePack(input,structures,constructionType='fill'){
 if(!input||!Array.isArray(input.rounds)||input.rounds.length!==3||structures.length!==3)throw Error('The AI exercise pack is incomplete. Please retry.');
 const [choice,construction,production]=input.rounds;
 if(choice?.type!=='choice'||!clean(choice.prompt)||!Array.isArray(choice.options)||choice.options.length!==4||choice.options.some(option=>!clean(option))||!unique(choice.options)||!Number.isInteger(choice.correctIndex)||choice.correctIndex<0||choice.correctIndex>3||!clean(choice.hint)||!clean(choice.explanation))throw Error('The multiple-choice exercise is invalid. Please retry.');
 if(construction?.type!==constructionType||!clean(construction.prompt)||!clean(construction.hint)||!clean(construction.explanation))throw Error('The sentence-building exercise is invalid. Please retry.');
 let normalizedConstruction;
 if(constructionType==='fill'){
  if((construction.prompt.match(/___/g)||[]).length!==1||!Array.isArray(construction.wordBank)||construction.wordBank.length!==4||construction.wordBank.some(word=>!clean(word))||!unique(construction.wordBank)||!Number.isInteger(construction.correctIndex)||construction.correctIndex<0||construction.correctIndex>3)throw Error('The fill-in exercise has no unique answer. Please retry.');
  normalizedConstruction={...construction,wordBank:construction.wordBank.map(clean),correctAnswer:clean(construction.wordBank[construction.correctIndex])};
 }else{
  if(!Array.isArray(construction.tokens)||construction.tokens.length<3||construction.tokens.length>12||construction.tokens.some(token=>!clean(token))||!unique(construction.tokens)||!Array.isArray(construction.correctOrder)||construction.correctOrder.length!==construction.tokens.length||!unique(construction.correctOrder))throw Error('The sentence-order exercise is invalid. Please retry.');
  const tokenSet=new Set(construction.tokens.map(normalized));
  if(construction.correctOrder.some(token=>!tokenSet.has(normalized(token))))throw Error('The sentence-order answer is invalid. Please retry.');
  normalizedConstruction={...construction,tokens:construction.tokens.map(clean),correctOrder:construction.correctOrder.map(clean),correctAnswer:construction.correctOrder.map(clean).join(' ')};
 }
 if(production?.type!=='production'||!clean(production.question))throw Error('The speaking exercise is invalid. Please retry.');
 return {rounds:[
  {...choice,options:choice.options.map(clean),correctAnswer:clean(choice.options[choice.correctIndex]),structureId:structures[0]['#']},
  {...normalizedConstruction,structureId:structures[1]['#']},
  {...production,question:clean(production.question),structureId:structures[2]['#']}
 ]};
}

export function objectiveAnswerText(exercise,answer){
 if(exercise.type==='choice')return clean(exercise.options[Number(answer)]);
 if(exercise.type==='fill')return clean(answer);
 if(exercise.type==='reorder')return Array.isArray(answer)?answer.map(clean).join(' '):clean(answer);
 return clean(answer);
}

export function gradeObjective(exercise,answer){
 if(!exercise||!['choice','fill','reorder'].includes(exercise.type))return false;
 return normalized(objectiveAnswerText(exercise,answer))===normalized(exercise.correctAnswer);
}

export function objectiveScore(isCorrect,attemptCount){
 if(!isCorrect)return 2;
 return attemptCount<=1?5:4;
}
