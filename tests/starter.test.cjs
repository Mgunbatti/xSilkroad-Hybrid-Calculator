const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const C=require('../skill-catalog.js');
const H=require('../hybrid-engine.js');
const data=require('../data/chinese-skills-vsro.json');

test('Lv100 starter loadout comes from vSRO skill descriptor rows',()=>{
 const bow=C.select(data,'SKILL_CH_BOW_POWER_D',100);
 const fire=C.select(data,'SKILL_CH_FIRE_GIGONGTA_E',100);
 const nuke=C.select(data,'SKILL_CH_FIRE_GIGONGSUL_F',100);
 assert.deepEqual([bow.skillLevel,bow.requiredMasteryLevel,bow.primaryDamagePercent,bow.powerMin,bow.powerMax],[2,100,350,772,1045]);
 assert.deepEqual([fire.skillLevel,fire.requiredMasteryLevel,fire.primaryDamagePercent,fire.powerMin,fire.powerMax],[2,100,100,912,1520]);
 assert.deepEqual([nuke.skillLevel,nuke.requiredMasteryLevel,nuke.primaryDamagePercent,nuke.secondaryPercent],[3,100,330,110]);
 assert.equal(C.select(data,'SKILL_CH_BOW_POWER_D',99).skillLevel,1);
 assert.equal(C.select(data,'SKILL_CH_FIRE_GIGONGTA_E',99).skillLevel,1);
 assert.equal(C.select(data,'SKILL_CH_FIRE_GIGONGSUL_F',99).skillLevel,2);
});

test('all 3 attack and matching imbue combinations produce nonempty demo ranges',()=>{
 const bow=C.select(data,'SKILL_CH_BOW_POWER_D',100);
 const fire=C.select(data,'SKILL_CH_FIRE_GIGONGTA_E',100);
 const nuke=C.select(data,'SKILL_CH_FIRE_GIGONGSUL_F',100);
 const s=H.defaults();
 Object.assign(s,{level:100,maxLevelReached:100,unspentPoints:0,allocatedSTR:297,bonusSTR:26,bonusINT:56});
 Object.assign(s.weapon,{key:'bow',apMode:'displayed',physicalMin:3012,physicalMax:3012,magicalMin:2638,magicalMax:2638,basicPercent:84});
 s.masteries={physical:100,imbue:100,nuke:100};
 Object.assign(s.physicalSkill,{enabled:true,min:bow.powerMin,max:bow.powerMax,rate:bow.primaryDamagePercent});
 Object.assign(s.imbue,{enabled:true,min:fire.powerMin,max:fire.powerMax,rate:fire.primaryDamagePercent,mode:'attack'});
 Object.assign(s.nuke,{enabled:true,min:nuke.powerMin,max:nuke.powerMax,rate:nuke.primaryDamagePercent,secondaryPercent:nuke.secondaryPercent});
 const calc=H.calculate(s);
 assert.deepEqual([calc.stats.STR,calc.stats.INT],[442,175]);
 for(const key of ['normal','normalImbue','physicalSkill','physicalSkillImbue','nuke','nukeImbue']){
  assert.ok(calc[key]?.normal?.max>0,key+' should render on startup');
 }
 assert.ok(calc.normalImbue.normal.max>calc.normal.normal.max);
 assert.ok(calc.physicalSkillImbue.normal.max>calc.physicalSkill.normal.max);
 assert.ok(calc.nukeImbue.normal.max>calc.nuke.normal.max);
 assert.deepEqual(calc.nukeImbue.critical,calc.nukeImbue.normal);
});

test('damage cards are ordered in adjacent comparison pairs',()=>{
 const app=readFileSync(join(__dirname,'../hybrid-app.js'),'utf8');
 const html=readFileSync(join(__dirname,'../index.html'),'utf8');
 const css=readFileSync(join(__dirname,'../hybrid.css'),'utf8');
 assert.match(app,/\['normal','normal'\],\['normalImbue','normalImbue'\]/);
 assert.match(app,/\['physicalSkill','physicalSkill'\],\['physicalSkillImbue','physicalSkillImbue'\]/);
 assert.match(app,/\['nuke','nuke'\],\['nukeImbue','nukeImbue'\]/);
 assert.match(css,/\.quick-results\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(html,/<option value="bow" selected[^>]*>/);
 assert.match(html,/<option value="vsro" selected[^>]*>/);
 assert.match(html,/id="strPoints"[^>]*value="297"/);
 assert.match(html,/id="bonusSTR"[^>]*value="26"/);
 assert.match(html,/id="bonusINT"[^>]*value="56"/);
 assert.match(app,/starterSeries=\{/);
});
