const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('../engine.js');
test('Lv3 / Manyang: displayed AP includes mastery and basic attack descriptor is 130%',()=>{
  const s=E.defaults();
  assert.equal(s.physical.apMode,'displayed');assert.equal(s.physical.skillPercent,130);
  // Mathematical support includes rare 18s. Do not falsely narrow it to the
  // observed 19–24 interval or insert a target multiplier to fit observations.
  assert.deepEqual(E.ranges(s).normal,{min:18,max:24});
  const run=E.simulate(s,100000,E.seeded(7));
  const mass=(lo,hi)=>run.histogram.filter(([d])=>d>=lo&&d<=hi).reduce((n,[,v])=>n+v,0)/run.count;
  assert.ok(mass(19,24)>.98);
  assert.ok(mass(23,24)>.44 && mass(23,24)<.49);
  assert.ok(mass(18,18)>.01 && mass(18,18)<.02);
  assert.ok(run.average>22 && run.average<22.4);
  // A repeatable short sample is compatible with the observed game interval.
  const short=E.simulate(s,30,E.seeded(7));
  assert.equal(short.min,19);assert.equal(short.max,24);
});
test('Displayed and raw AP modes agree after conversion, including skill mastery',()=>{
  const displayed=E.defaults(),raw=E.defaults();raw.physical.apMode='raw';
  raw.physical.min=24/1.03;raw.physical.max=29/1.03;
  displayed.physical.skillMin=raw.physical.skillMin=10;
  displayed.physical.skillMax=raw.physical.skillMax=20;
  for(const t of [0,10,50,74.52,100])assert.deepEqual(E.hitAt(displayed,t,0),E.hitAt(raw,t,0));
  const simple=E.defaults();simple.level=simple.targetLevel=3;simple.str=40;
  Object.assign(simple.physical,{min:100,max:200,mastery:50,skillMin:20,skillMax:40,skillPercent:100,defense:0});
  assert.equal(E.channel(simple,'physical',0),130);assert.equal(E.channel(simple,'physical',100),260);
});
