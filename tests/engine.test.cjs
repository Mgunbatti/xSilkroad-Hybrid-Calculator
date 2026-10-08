const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('../engine.js');
const rawDefaults=()=>{const s=E.defaults();s.attackMode='active';s.parry=27;s.physical.absorption=s.magical.absorption=0;s.physical.apMode='raw';s.physical.skillPercent=100;s.magical.apMode='raw';return s;};
const near=(a,b,tolerance=1e-5)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
test('Raw AP regression with explicit 100% descriptor: neutral Manyang is 15–19',()=>{
  const s=rawDefaults();near(E.balances(s).physical,.8);near(E.balances(s).magical,.55);
  near(E.levelBonus(s),.06);near(E.ratio(s),74.5185185);
  assert.deepEqual(E.ranges(s),{normal:{min:15,max:19},critical:{min:30,max:38}});
  const run=E.simulate(s,200000,E.seeded(7));
  assert.ok(run.average>17.3 && run.average<18.3);
  assert.ok(run.histogram.filter(([d])=>d>=18).reduce((n,[,v])=>n+v,0)/run.count>.58);
});
test('RNG consumes three inclusive 15-bit rolls and one parity coin',()=>{
  let draws=[32767,16384,8192,0],i=0;const t=E.roll(50,()=>draws[i++]);
  assert.equal(i,4);near(t,24.999237);
  draws=[32767,32767,32767,0];i=0;assert.equal(E.roll(10,()=>draws[i++]),0);
  draws=[32767,32767,32767,1];i=0;assert.equal(E.roll(90,()=>draws[i++]),100);
  assert.throws(()=>E.roll(50,()=>32768));
});
test('Parry 266 → 520 shifts damage down and raises minimum-roll frequency',()=>{
  const a=E.defaults();a.level=a.targetLevel=a.maxLevel=51;a.str=147;a.int=147;a.attackRate=198;
  Object.assign(a.physical,{min:1800,max:2400,defense:690,mastery:0});a.parry=266;
  const b=structuredClone(a);b.parry=520;
  near(E.ratio(a),37.218045);near(E.ratio(b),19.038461);
  assert.deepEqual(E.ranges(a),E.ranges(b));
  const first=E.simulate(a,200000,E.seeded(12)),second=E.simulate(b,200000,E.seeded(12));
  assert.ok(second.average<first.average-40);
  assert.ok(second.histogram[0][1]>first.histogram[0][1]*1.8);
});
test('mastery applies to both full endpoints; absorption precedes defense and skill percent',()=>{
  const s=rawDefaults();s.level=s.targetLevel=3;s.str=40; // balance = 1
  Object.assign(s.physical,{min:100,max:200,skillMin:20,skillMax:40,mastery:50,absorption:50,defense:10,skillPercent:200});
  assert.equal(E.channel(s,'physical',0),220);
  assert.equal(E.channel(s,'physical',100),460);
});
test('additive bonuses, coefficient, event, critical, level, balance, direct multipliers',()=>{
  const s=rawDefaults();
  Object.assign(s.physical,{bonus:5+10+15,targetCoefficient:1.25,event:.2,attackerMultiplier:1.1,targetMultiplier:.9});
  // Independently evaluated ordered stages at t=0: ~29.008774 -> 29.
  assert.equal(E.channel(s,'physical',0),29);
  assert.equal(E.channel(s,'physical',0,true),58);
  s.physical.targetCoefficient=s.physical.attackerMultiplier=s.physical.targetMultiplier=0;
  assert.equal(E.channel(s,'physical',0),23); // NZ(0)=1, event is direct .2.
});
test('critical truncates after hit factor, does not double magical or truncated physical',()=>{
  const s=rawDefaults();s.magical.enabled=true;Object.assign(s.magical,{min:50,max:50});
  const h=E.hitAt(s,100,100);assert.equal(h.critical,h.criticalPhysical+h.magical);
  assert.equal(E.channel(s,'magical',100,true),h.magical);
  s.physical.min=s.physical.max=25;
  const fractional=E.hitAt(s,0,0);assert.equal(fractional.physical,15);assert.equal(fractional.criticalPhysical,31);
});
test('channel enable flags, floors, endpoint cap, core cap and final target ratio',()=>{
  const s=rawDefaults();s.physical.enabled=false;assert.equal(E.hitAt(s,0,0).normal,0);
  s.physical.enabled=true;s.physical.defense=1000;assert.equal(E.channel(s,'physical',100),0);
  Object.assign(s.physical,{defense:0,min:2e6,max:2e6,mastery:0,skillPercent:1e6});
  assert.equal(E.channel(s,'physical',100),16777215);
  assert.equal(E.total({...s,targetRatio:99},15,5),19);
  assert.equal(E.total({...s,targetRatio:255},16777215,16777215),42614123);
  s.magical.enabled=true;Object.assign(s.magical,{min:2e6,max:2e6,skillPercent:1e6});
  assert.throws(()=>E.ranges({...s,targetRatio:255}),/overflow/);
});
test('max level balance and clamps use GameServer values',()=>{
  const s=rawDefaults();s.maxLevel=51;s.str=297;s.int=147;
  near(E.balances(s).physical,1.186781597);near(E.balances(s).magical,.63362068);
  s.str=s.int=100000;assert.equal(E.balances(s).physical,1.2000000476837158);
  assert.equal(E.balances(s).magical,1.2000000476837158);
  s.level=51;assert.equal(E.levelBonus(s),.30000001192092896);s.attackRate=1e6;assert.equal(E.ratio(s),90);
  s.level=1;s.targetLevel=51;s.attackRate=0;assert.equal(E.levelBonus(s),0);assert.equal(E.ratio(s),10);
});
test('channels use independent four-call RNG sequences; all sample sizes work',()=>{
  const s=rawDefaults();s.magical.enabled=true;let calls=0;E.sample(s,()=>{calls++;return .5;});assert.equal(calls,8);
  for(const n of [100,1000,10000]){const r=E.simulate(s,n,E.seeded(2));assert.equal(r.histogram.reduce((a,[,b])=>a+b,0),n);}
  assert.throws(()=>E.simulate(s,100,()=>1));assert.throws(()=>E.validate({...s,parry:0}));
  assert.throws(()=>E.validate({...s,maxLevel:2}));
});
