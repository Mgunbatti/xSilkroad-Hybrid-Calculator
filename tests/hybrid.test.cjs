const {test}=require('node:test');
const assert=require('node:assert/strict');
const H=require('../hybrid-engine.js');
const D=require('../engine.js');

test('level 1 defaults, devil multiplies both HP and MP without changing balance',()=>{
 const s=H.defaults();s.level=1;s.maxLevelReached=1;s.allocatedSTR=0;s.unspentPoints=0;
 const normal=H.calculate(s);assert.equal(normal.stats.HP,200);assert.equal(normal.stats.MP,200);
 s.devilRate=20;const devil=H.calculate(s);
 assert.equal(devil.stats.HP,240);assert.equal(devil.stats.MP,240);
 assert.equal(normal.stats.physicalBalance,devil.stats.physicalBalance);
 assert.equal(normal.stats.magicalBalance,devil.stats.magicalBalance);
});
test('custom Devil rate supports high and fractional server percentages on HP and MP',()=>{
 const s=H.defaults();s.level=1;s.maxLevelReached=1;s.allocatedSTR=0;s.unspentPoints=0;
 const zero=H.calculate(s);
 s.devilRate=250;const high=H.calculate(s);
 assert.equal(high.stats.HP,700);
 assert.equal(high.stats.MP,700);
 assert.equal(high.stats.physicalBalance,zero.stats.physicalBalance);
 assert.equal(high.stats.magicalBalance,zero.stats.magicalBalance);
 s.devilRate=12.5;const fractional=H.calculate(s);
 assert.equal(fractional.stats.HP,225);
 assert.equal(fractional.stats.MP,225);
 for(const invalid of [-1,Infinity,1000001,NaN]){
   s.devilRate=invalid;
   assert.throws(()=>H.calculate(s),/Devil HP\/MP rate/);
 }
});

test('original Lv8 +5 STR and +5 INT produce observed 57 HP and 57 MP increments',()=>{
 const s=H.defaults();s.level=8;s.maxLevelReached=8;s.unspentPoints=21;s.allocatedSTR=0;
 s.bonusSTR=84;s.bonusINT=84;
 const before=H.stats(s);assert.equal(before.STR,111);assert.equal(before.INT,111);
 s.bonusSTR+=5;const afterSTR=H.stats(s);
 assert.equal(afterSTR.baseHP-before.baseHP,57);
 assert.equal(afterSTR.baseMP,before.baseMP);
 s.bonusINT+=5;const afterINT=H.stats(s);
 assert.equal(afterINT.baseMP-afterSTR.baseMP,57);
 assert.equal(afterINT.baseHP,afterSTR.baseHP);
});
test('magical AP tooltip reinforcement matches Lv8 111/116 INT screenshots',()=>{
 const s=H.defaults();s.level=8;s.maxLevelReached=8;s.unspentPoints=21;s.allocatedSTR=0;
 s.bonusSTR=84;s.bonusINT=84;
 const before=H.attackPower(s,H.stats(s));
 assert.deepEqual(before.magical,[232,262]);
 s.bonusINT=89;const after=H.attackPower(s,H.stats(s));
 assert.deepEqual(after.magical,[236,267]);
});
test('build comparisons preserve weapon and only move stat points',()=>{
 const s=H.defaults(),c=H.compare(s);
 assert.equal(c.fullSTR.stats.allocatedINT,0);
 assert.equal(c.fullINT.stats.allocatedSTR,0);
 assert.equal(c.selected.stats.allocatedSTR,s.allocatedSTR);
 assert.equal(c.fullSTR.stats.STR + c.fullSTR.stats.INT,c.fullINT.stats.STR+c.fullINT.stats.INT);
 assert.ok(c.fullSTR.stats.HP>c.fullINT.stats.HP);
 assert.ok(c.fullINT.stats.MP>c.fullSTR.stats.MP);
 assert.ok(c.fullSTR.stats.physicalBalance>=c.fullINT.stats.physicalBalance);
});
test('normal physical uses verified default skill descriptor not active skill rate',()=>{
 const s=H.defaults();s.level=8;s.maxLevelReached=8;s.unspentPoints=21;s.allocatedSTR=0;
 s.bonusSTR=84;s.bonusINT=84;s.weapon.key='sword';
 const x=H.calculate(s);
 const d=D.defaults();d.attackMode='basic';d.weapon='sword';
 assert.equal(D.descriptorPercent(d,'physical'),60);
 assert.equal(x.physical.normal.max>0,true);
 s.physicalSkill.enabled=true;s.physicalSkill.rate=280;
 const y=H.calculate(s);
 assert.notDeepEqual(y.physical.normal,x.physical.normal);
});
test('optional nuke and imbue results exist only when enabled',()=>{
 const s=H.defaults();
 assert.equal(H.calculate(s).nuke,null);
 assert.equal(H.calculate(s).physicalImbue,null);
 s.nuke.enabled=true;s.nuke.min=200;s.nuke.max=300;s.nuke.rate=280;
 s.imbue.enabled=true;s.imbue.min=10;s.imbue.max=20;s.imbue.rate=100;
 const result=H.calculate(s);
 assert.ok(result.nuke.normal.max>=1);
 assert.ok(result.physicalImbue.critical.max>=result.physicalImbue.normal.max);
});
test('prevents invalid or unverified build weapon descriptors',()=>{
 const s=H.defaults();s.weapon.key='blade';
 assert.throws(()=>H.calculate(s),/Unverified/);
 s.weapon.key='custom';s.weapon.basicPercent=90;assert.doesNotThrow(()=>H.calculate(s));
 s.allocatedSTR=999999;assert.throws(()=>H.calculate(s),/Allocated STR/);
});
