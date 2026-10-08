const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('../engine.js');
const fixtures=[
  ['A (calibration/reference)',51,297,1300,1550,1,7,1,2758,2757],
  ['B',51,227,1185,1410,1,7,1,2082,2082],
  ['C',51,227,1185,1410,10,22,10,1888,1888],
  ['D',52,301,1315,1568,45,221,45,1442,1441],
  ['E',52,301,1315,1568,1,7,1,2783,2782]
];
for(const [id,level,str,min,max,targetLevel,defense,absorption,observed,endpoint] of fixtures) {
  test(`${id}: theoretical max ${endpoint}; finite observed max ${observed}`,()=>{
    const s=E.defaults();Object.assign(s,{level,maxLevel:level,str,targetLevel});
    if(level===52)s.attackRate=199;
    Object.assign(s.physical,{min,max,defense,absorption});
    assert.equal(E.ranges(s).normal.max,endpoint);
    // Exact output regression, not a tolerance or fitted factor to force the observation.
    assert.equal(s.physical.bonus,0);
  });
}
test('weapon-specific normal descriptors and no invented rates for other weapons',()=>{
  const s=E.defaults();s.physical.skillPercent=999;s.physical.skillMin=1000;s.physical.skillMax=2000;
  for(const [weapon,percent] of Object.entries({spear:117,glaive:117,sword:60,bow:84})) {
    s.weapon=weapon;assert.equal(E.descriptorPercent(s,'physical'),percent);
  }
  s.weapon='custom';s.basicPercent=73;assert.equal(E.descriptorPercent(s,'physical'),73);
  assert.equal(E.basicSkills.blade,undefined);
  const withoutSkill=structuredClone(s);withoutSkill.physical.skillMin=withoutSkill.physical.skillMax=0;
  assert.deepEqual(E.ranges(s),E.ranges(withoutSkill));
  s.attackMode='active';s.physical.skillPercent=250;
  const first=E.ranges(s);s.weapon='spear';assert.deepEqual(E.ranges(s),first);
  assert.equal(E.descriptorPercent(s,'physical'),250);
  s.magical.skillPercent=180;assert.equal(E.descriptorPercent(s,'magical'),180);
});
test('displayed mastery applies only to added skill AP',()=>{
  const s=E.defaults();s.attackMode='active';s.level=s.targetLevel=3;s.str=40;
  Object.assign(s.physical,{min:100,max:200,mastery:50,skillMin:20,skillMax:40,skillPercent:100,defense:0,absorption:0});
  assert.equal(E.channel(s,'physical',0),130);assert.equal(E.channel(s,'physical',100),260);
  s.physical.skillMin=s.physical.skillMax=0;
  assert.equal(E.channel(s,'physical',100),200);
  s.physical.apMode='raw';assert.equal(E.channel(s,'physical',100),300);
});
test('conditional class and party additions use pre-avatar damage',()=>{
  const s=E.defaults();s.attackMode='active';s.level=s.targetLevel=3;s.str=40;
  Object.assign(s.physical,{min:100,max:100,mastery:0,defense:0,absorption:0,bonus:50,classBonus:20,partyBonus:10,targetCoefficient:2});
  assert.equal(E.channel(s,'physical',100),360);
});
test('Manyang DB absorption is one percent; ER is not silently used as parry',()=>{
  const s=E.defaults();assert.equal(s.physical.absorption,1);assert.equal(s.magical.absorption,1);
  assert.notEqual(s.parry,27);
  const a=E.ranges(s);s.parry=500;assert.deepEqual(E.ranges(s),a);
});

test('ordinary landed attacks floor the final total once; no channels stays zero',()=>{
  const s=E.defaults();s.physical.defense=s.magical.defense=1e6;
  for(const [physical,magical] of [[true,false],[false,true],[true,true],[false,false]]) {
    s.physical.enabled=physical;s.magical.enabled=magical;
    const h=E.hitAt(s,100,100),expected=physical||magical?1:0;
    assert.equal(h.physical,0);assert.equal(h.magical,0);
    assert.equal(h.normal,expected);assert.equal(h.critical,expected);
    assert.deepEqual(E.ranges(s).normal,{min:expected,max:expected});
    assert.equal(E.simulate(s,100,E.seeded(1)).average,expected);
  }
  s.physical.enabled=true;s.physical.defense=0;s.targetRatio=0;
  assert.equal(E.hitAt(s,100,100).normal,1);
});
test('hybrid truncates channels separately, applies ratio after sum and crit only to physical',()=>{
  const s=E.defaults();s.attackMode='active';s.level=s.targetLevel=s.maxLevel=3;s.str=40;s.int=40;
  s.magical.enabled=true;s.targetRatio=50;
  Object.assign(s.physical,{min:100.75,max:100.75,mastery:0,defense:0,absorption:0});
  Object.assign(s.magical,{min:50.75,max:50.75,mastery:0,defense:0,absorption:0});
  const h=E.hitAt(s,100,100);
  assert.deepEqual(h,{physical:100,magical:50,criticalPhysical:201,normal:75,critical:125});
  s.physical.defense=1e6;s.targetRatio=100;
  assert.equal(E.hitAt(s,100,100).normal,50); // zero physical must not add a phantom 1
});
