const {test}=require('node:test');
const assert=require('node:assert/strict');
const H=require('../hybrid-engine.js');
const D=require('../engine.js');
function fixture(){
 const s=H.defaults();
 Object.assign(s,{level:52,maxLevelReached:52,allocatedSTR:153,bonusSTR:77,bonusINT:77});
 Object.assign(s.weapon,{key:'spear',apMode:'displayed',physicalMin:1315,physicalMax:1568,magicalMin:1041,magicalMax:1207});
 s.masteries={physical:52,imbue:52,nuke:40};
 Object.assign(s.imbue,{enabled:true,min:187,max:312});
 Object.assign(s.physicalSkill,{enabled:true,min:574,max:777,rate:350});
 Object.assign(s.nuke,{enabled:true,min:123,max:205,rate:250});
 return s;
}
function core(s){
 const d=D.defaults(),st=H.stats(s),ap=H.attackPower(s,st);
 Object.assign(d,{level:s.level,maxLevel:s.maxLevelReached,str:st.STR,int:st.INT,weapon:s.weapon.key,targetLevel:s.target.level});
 Object.assign(d.physical,{min:ap.physical[0],max:ap.physical[1],mastery:s.masteries.physical,defense:s.target.physicalDefense,absorption:s.target.physicalAbsorption});
 Object.assign(d.magical,{apMode:'raw',min:ap.magical[0],max:ap.magical[1],defense:s.target.magicalDefense,absorption:s.target.magicalAbsorption});
 return d;
}
test('blank defaults never calculate demo equipment or enabled skills',()=>{
 const s=H.defaults(),r=H.calculate(s);
 assert.equal(s.bonusSTR,0);assert.equal(s.bonusINT,0);assert.equal(r.ap,null);
 for(const k of ['normal','normalImbue','physicalSkill','physicalSkillImbue','nuke'])assert.equal(r[k],null);
 s.weapon.physicalMin=50;assert.doesNotThrow(()=>H.calculate(s));
});
test('five independent outputs; learned masteries map onto correct AP sources',()=>{
 const s=fixture(),r=H.calculate(s),d=core(s);
 assert.deepEqual([r.stats.STR,r.stats.INT],[301,148]);
 assert.deepEqual(r.normal,D.ranges(d));
 d.attackMode='active';Object.assign(d.physical,{skillMin:574,skillMax:777,skillPercent:350});
 assert.deepEqual(r.physicalSkill,D.ranges(d));
 d.physical.enabled=false;Object.assign(d.magical,{enabled:true,skillMin:123,skillMax:205,skillPercent:250,mastery:40});
 assert.deepEqual(r.nuke,D.ranges(d));assert.deepEqual(r.nuke.normal,r.nuke.critical);
 Object.assign(d.physical,{enabled:true});Object.assign(d.magical,{skillMin:187,skillMax:312,skillPercent:350,mastery:52});
 assert.deepEqual(r.physicalSkillImbue,D.ranges(d));
});
test('normal descriptors affect normal+imbue only; skills and nuke remain independent',()=>{
 const s=fixture(),before=H.calculate(s);
 for(const [key,rate] of Object.entries(D.basicSkills)){
  s.weapon.key=key;const r=H.calculate(s),d=core(s);
  assert.equal(D.descriptorPercent(d,'physical'),rate);
  assert.deepEqual(r.normal,D.ranges(d));
  assert.deepEqual(r.physicalSkill,before.physicalSkill);assert.deepEqual(r.nuke,before.nuke);
  assert.deepEqual(r.physicalSkillImbue,before.physicalSkillImbue);
  Object.assign(d.magical,{enabled:true,skillMin:187,skillMax:312,mastery:52,skillPercent:rate});
  assert.deepEqual(r.normalImbue,D.ranges(d));
 }
});
test('physical skill never replaces normal; disabled skills ignore stale incomplete fields',()=>{
 const s=fixture(),before=H.calculate(s);
 for(const k of ['physicalSkill','nuke','imbue'])Object.assign(s[k],{enabled:false,min:null,max:null,rate:null});
 const r=H.calculate(s);assert.deepEqual(r.normal,before.normal);
 for(const k of ['physicalSkill','nuke','normalImbue','physicalSkillImbue'])assert.equal(r[k],null);
});
test('mastery is separate from level; displayed physical AP is not mastered twice',()=>{
 const s=fixture(),a=H.calculate(s);s.masteries.physical=20;const b=H.calculate(s);
 assert.deepEqual(a.normal,b.normal);assert.notDeepEqual(a.physicalSkill,b.physicalSkill);
 assert.deepEqual(a.normalImbue,b.normalImbue);
 s.masteries.imbue=10;const c=H.calculate(s);
 assert.notDeepEqual(b.normalImbue,c.normalImbue);assert.deepEqual(b.nuke,c.nuke);
 for(const value of [53,1.5,-1,null,NaN]){s.masteries.imbue=value;assert.throws(()=>H.calculate(s),/mastery level/);}
});
test('Manyang live arrays retain candid endpoint discrepancies and critical sample',()=>{
 const s=fixture(),r=H.calculate(s);
 const off=[2655,2783,2721,2667,2729,2709,2783,2500,2783];
 const on=[4954,4666,4697,4658,4954,4717,4612,4954];
 assert.equal(r.normal.normal.max,2782);assert.equal(r.normalImbue.normal.max,4952);
 assert.equal(r.normalImbue.normal.max-r.normal.normal.max,2170);
 assert.equal(r.normal.normal.max-Math.max(...off),-1);
 assert.equal(r.normalImbue.normal.max-Math.max(...on),-2);
 assert.equal(r.normalImbue.critical.max,7734);
 assert.ok(7186>=r.normalImbue.critical.min && 7186<=r.normalImbue.critical.max);
 assert.equal(off.filter(x=>x>r.normal.normal.max).length,3);
 assert.equal(on.filter(x=>x>r.normalImbue.normal.max).length,3);
});
test('critical doubles only untruncated physical core, absorption and float stages preserved',()=>{
 const s=fixture(),d=core(s);
 Object.assign(d.magical,{enabled:true,skillMin:187,skillMax:312,mastery:52,skillPercent:117});
 const r=H.calculate(s),hit=D.hitAt(d,100,100);
 assert.equal(r.normalImbue.critical.max,hit.criticalPhysical+hit.magical);
 s.target.physicalAbsorption=45;s.target.magicalAbsorption=30;
 s.target.physicalDefense=221;s.target.magicalDefense=150;
 assert.ok(H.calculate(s).normalImbue.normal.max<r.normalImbue.normal.max);
 s.target.physicalDefense=s.target.magicalDefense=1e7;
 assert.equal(H.calculate(s).normalImbue.normal.max,1);
});
test('recovered secondary caller uses its own percentage after core truncation',()=>{
 const s=fixture();s.imbue.mode='secondary';
 assert.throws(()=>H.calculate(s),/secondary percentage/);
 s.weapon.secondaryPercent=117;s.physicalSkill.secondaryPercent=225;
 const r=H.calculate(s),d=core(s);
 Object.assign(d.magical,{enabled:true,skillMin:187,skillMax:312,mastery:52,skillPercent:100});
 const m=D.channel(d,'magical',100),p=D.channel(d,'physical',100);
 assert.equal(r.normalImbue.normal.max,p+Math.trunc(m*117/100));
 s.weapon.secondaryPercent=0;assert.deepEqual(H.calculate(s).normalImbue,H.calculate(s).normal);
 s.weapon.secondaryPercent=0xffffffff;assert.throws(()=>H.calculate(s),/overflow/);
});
test('recovered secondary mastery preserves unusual binary caller selection',()=>{
 for(const [p,m,result] of [[52,20,52],[52,100,52],[90,100,90],[91,52,90],[100,110,110]])assert.equal(H.secondaryMastery(p,m),result);
});
test('displayed AP comparison is unavailable rather than reusing AP across builds',()=>{
 const s=fixture(),r=H.compare(s);assert.equal(r.fullSTR,null);assert.equal(r.fullINT,null);
 s.weapon.apMode='tooltip';Object.assign(s.weapon,{physicalReinforceMin:43.4,physicalReinforceMax:49.3,magicalReinforceMin:74.2,magicalReinforceMax:86});
 const copy=structuredClone(s),c=H.compare(s);
 assert.equal(c.fullSTR.stats.allocatedINT,0);assert.equal(c.fullINT.stats.allocatedSTR,0);
 assert.ok(c.fullSTR.stats.HP>c.fullINT.stats.HP);assert.ok(c.fullINT.stats.MP>c.fullSTR.stats.MP);
 assert.deepEqual(s,copy);
});
test('historical HP/MP, reinforcement and Devil regressions',()=>{
 const s=H.defaults();Object.assign(s,{level:8,maxLevelReached:8,unspentPoints:21,allocatedSTR:0,bonusSTR:84,bonusINT:84});
 Object.assign(s.weapon,{physicalMin:88,physicalMax:96,magicalMin:150,magicalMax:167,physicalReinforceMin:43.4,physicalReinforceMax:49.3,magicalReinforceMin:74.2,magicalReinforceMax:86});
 const a=H.calculate(s);assert.deepEqual(a.ap.magical,[232,262]);
 s.bonusINT+=5;s.bonusSTR+=5;const b=H.calculate(s);
 assert.equal(b.stats.baseHP-a.stats.baseHP,57);assert.equal(b.stats.baseMP-a.stats.baseMP,57);assert.deepEqual(b.ap.magical,[236,267]);
 Object.assign(s,{level:1,maxLevelReached:1,unspentPoints:0,allocatedSTR:0,bonusSTR:0,bonusINT:0,devilRate:250});
 assert.equal(H.calculate(s).stats.HP,700);s.devilRate=12.5;assert.equal(H.calculate(s).stats.MP,225);
});
test('invalid data fails, disabled incomplete inputs and zero valid endpoints remain distinct',()=>{
 const s=fixture();s.physicalSkill.min=null;assert.throws(()=>H.calculate(s),/physicalSkill min/);
 s.physicalSkill.enabled=false;s.weapon.physicalMin=9999;assert.throws(()=>H.calculate(s),/Minimum weapon/);
 s.weapon.physicalMin=0;s.weapon.physicalMax=0;assert.equal(H.calculate(s).normal.normal.max,1);
});
