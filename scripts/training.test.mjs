import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {escapeHtml,legacyPage,rankedStructures,selectSessionStructures,summarizeSession} from '../src-training.mjs';
const html=readFileSync('public/index.html','utf8');
const core=JSON.parse(html.match(/const DATA=(.*);window\.DATA/)[1]).core;

test('legacy dashboard and practice links open AI training',()=>{
 for(const hash of ['', '#dashboard','#practice','#train'])assert.equal(legacyPage(hash),'train');
});

test('adaptive session keeps structures unique and uses Precision in round three',()=>{
 const selected=selectSessionStructures(core,[]);
 assert.equal(selected.length,3);
 assert.equal(new Set(selected.map(item=>item['#'])).size,3);
 assert.equal(selected[2].Layer,'Precision');
});

test('a Core 15 selection locks the first round without repetition',()=>{
 const selected=selectSessionStructures(core,[],14);
 assert.equal(selected[0]['#'],14);
 assert.equal(new Set(selected.map(item=>item['#'])).size,3);
});

test('unseen structures rank before repeatedly high-scoring structures',()=>{
 const records=Array.from({length:5},()=>({id:1,score:5}));
 assert.notEqual(rankedStructures(core,records)[0]['#'],1);
});

test('session summary calculates scores and strongest and weakest rounds',()=>{
 const result=summarizeSession([{id:1,function:'Define',score:5,improvement:1},{id:2,function:'Add',score:3,improvement:2}]);
 assert.equal(result.average,4);assert.equal(result.improvement,1.5);
 assert.equal(result.strongest.function,'Define');assert.equal(result.weakest.function,'Add');
});

test('dynamic AI and user content is escaped',()=>{
 assert.equal(escapeHtml(`<img src=x onerror="alert(1)">`),'&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
});

test('voice input has progressive enhancement and text fallbacks',()=>{
 const app=readFileSync('src-app.js','utf8');
 assert.match(app,/SpeechRecognition\|\|window\.webkitSpeechRecognition/);
 assert.match(app,/不支持语音输入，请使用文字回答/);
 assert.match(app,/麦克风权限未开启，请改用文字回答/);
});
