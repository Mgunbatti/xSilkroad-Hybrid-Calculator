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
