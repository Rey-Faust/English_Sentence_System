import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {escapeHtml,gradeObjective,legacyPage,objectiveAnswerText,objectiveScore,rankedStructures,selectConstructionType,selectSessionStructures,summarizeSession,validateExercisePack} from '../src-training.mjs';
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

const structures=[{...core[0]},{...core[1]},{...core[12]}];
const fillPack={rounds:[
 {type:'choice',prompt:'Which answer defines the issue?',options:['It is a delay.','It adds a delay.','It causes a delay.','It may delay.'],correctIndex:0,hint:'Use is to define something.',explanation:'A definition states what something is.'},
 {type:'fill',prompt:'We need approval, ___ we also need the drawing.',wordBank:['and','because','if','but'],correctIndex:0,hint:'Add one related point.',explanation:'And adds information.'},
 {type:'production',question:'How certain are you about the schedule?'}
]};

test('valid exercise packs preserve the three cognitive stages',()=>{
 const pack=validateExercisePack(fillPack,structures,'fill');
 assert.deepEqual(pack.rounds.map(round=>round.type),['choice','fill','production']);
 assert.equal(pack.rounds[1].correctAnswer,'and');
 assert.equal(pack.rounds[2].structureId,13);
});

test('exercise pack validation rejects duplicate choices and ambiguous fill banks',()=>{
 const duplicate=structuredClone(fillPack);duplicate.rounds[0].options[3]=duplicate.rounds[0].options[0];
 assert.throws(()=>validateExercisePack(duplicate,structures,'fill'),/multiple-choice/);
 const ambiguous=structuredClone(fillPack);ambiguous.rounds[1].wordBank[3]='and';
 assert.throws(()=>validateExercisePack(ambiguous,structures,'fill'),/unique answer/);
});

test('choice, fill, and reorder answers grade locally',()=>{
 const pack=validateExercisePack(fillPack,structures,'fill');
 assert.equal(gradeObjective(pack.rounds[0],0),true);
 assert.equal(gradeObjective(pack.rounds[0],1),false);
 assert.equal(gradeObjective(pack.rounds[1],'AND!'),true);
 const reorder={type:'reorder',correctAnswer:'First approve it then start work'};
 assert.equal(gradeObjective(reorder,['First approve it','then start work']),true);
 assert.equal(objectiveAnswerText(reorder,['then start work','First approve it']),'then start work First approve it');
});

test('objective scoring allows one retry and construction type alternates',()=>{
 assert.equal(objectiveScore(true,1),5);assert.equal(objectiveScore(true,2),4);assert.equal(objectiveScore(false,2),2);
 assert.equal(selectConstructionType([]),'fill');
 assert.equal(selectConstructionType([{questionType:'fill'}]),'reorder');
 assert.equal(selectConstructionType([{questionType:'reorder'}]),'fill');
});
