import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync('public/index.html','utf8');
const data=JSON.parse(html.match(/const DATA=(.*);/)[1]);
test('all 15 complete source knowledge cards remain available',()=>{
 assert.equal(data.core.length,15);
 for(const card of data.core)for(const field of ['Core Pattern','Core Question','Expansion Patterns','对应疑问句','Alternative Questions','Natural Follow-up','Core Use','高频场景','陈述例句','疑问例句','Example Question','Example Answer'])assert.ok(card[field]?.trim(),`${card.Function}: ${field}`);
 assert.equal(data.core.filter(x=>x.Layer==='Thought Building').length,12);
 assert.equal(data.core.filter(x=>x.Layer==='Precision').length,3);
});
test('inline application JavaScript parses',()=>{
 for(const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(match[1]);
});
test('AI feedback containing quotes and markup stays text, not executable attributes',()=>{
 const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
 const nodes=new Map();
 const context={window:{},document:{querySelectorAll:()=>[],getElementById:id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:''});return nodes.get(id)}},setTimeout:()=>{},clearInterval:()=>{}};
 vm.createContext(context);vm.runInContext(script,context);
 const evil=`It's a \"test\" <img src=x onerror=alert(1)>`;
 context.payload=evil;
 vm.runInContext(`renderAIResult({overall_score:4,better_version:payload,follow_up_question:payload},payload,DATA.core[0],payload,'topic','scenario')`,context);
 const rendered=nodes.get('aiResult').innerHTML;
 assert.ok(!rendered.includes('<img'));assert.ok(!rendered.includes('onclick='));
 let packed;context.window.saveAIFeedback=x=>packed=JSON.parse(x);nodes.get('saveFeedback').onclick();assert.equal(packed.answer,evil);
});
