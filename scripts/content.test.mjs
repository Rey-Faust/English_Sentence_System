import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync('public/index.html','utf8');
const match=html.match(/const DATA=(.*);window\.DATA/);
assert.ok(match,'Core data remains embedded in the static shell');
const data=JSON.parse(match[1]);

test('all 15 complete source knowledge cards remain available',()=>{
 assert.equal(data.core.length,15);
 for(const card of data.core)for(const field of ['Core Pattern','Core Question','Expansion Patterns','对应疑问句','Alternative Questions','Natural Follow-up','Core Use','高频场景','陈述例句','疑问例句','Example Question','Example Answer'])assert.ok(card[field]?.trim(),`${card.Function}: ${field}`);
 assert.equal(data.core.filter(x=>x.Layer==='Thought Building').length,12);
 assert.equal(data.core.filter(x=>x.Layer==='Precision').length,3);
});

test('inline application data JavaScript parses',()=>{
 for(const script of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(script[1]);
});

test('new navigation has five destinations and removes old dashboard and practice buttons',()=>{
 const desktop=html.match(/<nav class="nav-stack"[\s\S]*?<\/nav>/)?.[0]||'';
 assert.deepEqual([...desktop.matchAll(/data-page="([^"]+)"/g)].map(x=>x[1]),['train','core','progress','log','grammar']);
 assert.doesNotMatch(desktop,/dashboard|practice/);
});

test('account and Core drawer roots are available before deferred scripts',()=>{
 assert.match(html,/id="accountRoot"/);assert.match(html,/id="drawerRoot"/);
 assert.ok(html.indexOf('id="accountRoot"')<html.indexOf('src="cloud.js'));
});
