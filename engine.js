/* Ordinary player damage: docs/DAMAGE_FORMULA.md §§3 and 6.3.
 * Values are percentages except explicitly named direct multipliers/event.
 * No inferred item effects or hidden calibration coefficients.
 */
(function (root) {
  'use strict';
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const f32 = Math.fround;
  const nz = v => v === 0 ? 1 : v;
  // Default-skill DB percentages confirmed by the user's database checks.
  // No inferred values for other weapons; those require manual input.
  const basicSkills = Object.freeze({spear:117, glaive:117, sword:60, bow:84});
  function descriptorPercent(s, name) {
    return s.attackMode==='basic' && name==='physical'
      ? (basicSkills[s.weapon] ?? s.basicPercent) : s[name].skillPercent;
  }
  const defaults = () => ({
    attackMode:'basic', weapon:'spear', basicPercent:100,
    level: 3, maxLevel: 3, str: 28, int: 22, attackRate: 37, targetLevel: 1, parry: 100,
    targetRatio: 100,
    physical: {enabled:true, apMode:'displayed', min:24, max:29, skillMin:0, skillMax:0, mastery:3, skillPercent:100,
      defense:7, absorption:1, bonus:0, classBonus:0, partyBonus:0, targetCoefficient:1, event:0, attackerMultiplier:1, targetMultiplier:1},
    magical: {enabled:false, apMode:'displayed', min:0, max:0, skillMin:0, skillMax:0, mastery:0, skillPercent:100,
      defense:10, absorption:1, bonus:0, classBonus:0, partyBonus:0, targetCoefficient:1, event:0, attackerMultiplier:1, targetMultiplier:1}
  });
  function validate(s) {
    const finite = (v, name, min=0, max=Number.MAX_SAFE_INTEGER) => {
      if (!Number.isFinite(v) || v < min || v > max) throw new Error(`${name} must be between ${min} and ${max}.`);
    };
    if(!['basic','active'].includes(s.attackMode)) throw new Error('Select basic attack or active skill.');
    if(!(s.weapon in basicSkills) && s.weapon!=='custom') throw new Error('Select a known weapon or manual descriptor.');
    finite(s.basicPercent,'Manual basic attack percentage');
    for (const k of ['level','maxLevel','targetLevel']) {
      finite(s[k], k, 1, 255);
      if (!Number.isInteger(s[k])) throw new Error(`${k} must be a whole number.`);
    }
    if(s.maxLevel < s.level) throw new Error('Max level reached cannot be below current level.');
    for(const k of ['str','int','attackRate']) finite(s[k], k);
    finite(s.parry,'Parry rate', Number.MIN_VALUE);
    finite(s.targetRatio,'Target ratio',0,255);
    if(!Number.isInteger(s.targetRatio)) throw new Error('Target ratio must be a whole number.');
    for(const name of ['physical','magical']) {
      const c=s[name];
      if(!['displayed','raw'].includes(c.apMode)) throw new Error('AP mode must be displayed or raw.');
      if(typeof c.enabled !== 'boolean') throw new Error(`${name} channel must be enabled or disabled.`);
      for(const k of ['min','max','skillMin','skillMax','mastery','skillPercent','defense','absorption','bonus','targetCoefficient','attackerMultiplier','targetMultiplier']) finite(c[k],`${name} ${k}`);
      finite(c.classBonus,`${name} class bonus`);finite(c.partyBonus,`${name} party bonus`);
      finite(c.event,`${name} event`,-1);
      if(c.mastery>255 || !Number.isInteger(c.mastery)) throw new Error('Mastery must be a whole number from 0 to 255.');
      if(c.min>c.max || c.skillMin>c.skillMax) throw new Error(`${name}: minimum cannot exceed maximum.`);
    }
    return s;
  }
  function balances(s) {
    const q=s.maxLevel-1;
    return {
      physical:clamp(f32((s.str+16+q+q)/((q*7+56)*0.8571428656578064)),0,1.2000000476837158),
      magical:clamp(f32(s.int/((q*5+40)*0.80000001192092896)),0,1.2000000476837158)
    };
  }
  function levelBonus(s) {return clamp(f32((s.level-s.targetLevel)*0.029999999329447746),0,0.30000001192092896);}
  function ratio(s) {return clamp(f32(100*(f32(0.5*s.attackRate/s.parry)+levelBonus(s))),10,90);}
  // Every call models a uniform integer C rand result, inclusive 0..32767.
  function random15(rng) {
    const u=rng();
    if(!Number.isFinite(u) || u<0 || u>=1) throw new Error('Random source must return a number in [0,1).');
    return Math.floor(u*32768);
  }
  function roll(r, rand=()=>random15(Math.random)) {
    const draw=()=> {
      const n=rand();
      if(!Number.isInteger(n) || n<0 || n>32767) throw new Error('rand must return an integer from 0 to 32767.');
      return n;
    };
    const sample=()=>f32(f32(draw()/32767)*100);
    const u=Math.min(100,sample(),sample(),sample());
    const coin=draw()%2;
    return clamp(f32(coin===0?r-u:r+u),0,100);
  }
  function channel(s, name, t, critical=false) {
    const c=s[name];
    if(!c.enabled) return 0;
    // Raw mode follows §3.2 including the endpoint cap before mastery.
    // Displayed mode follows the user's C-screen mapping directly: AP already
    // includes mastery. Do not reverse it through an extra float conversion.
    const mastery=1+c.mastery/100;
    const basic=s.attackMode==='basic' && name==='physical';
    const skillMin=basic?0:c.skillMin,skillMax=basic?0:c.skillMax;
    const lo=c.apMode==='displayed'?f32(c.min+skillMin*mastery):f32(clamp(f32(c.min+skillMin),0,999999)*mastery);
    const hi=c.apMode==='displayed'?f32(c.max+skillMax*mastery):f32(clamp(f32(c.max+skillMax),0,999999)*mastery);
    const v=f32(lo+(hi-lo)*clamp(t,0,100)/100);
    let d=f32(Math.max(v/(1+c.absorption/100)-c.defense,0));
    d=f32(d*descriptorPercent(s,name)/100);
    // Conditional class-3 and party amounts use d0, before avatar percentage.
    const extra=f32(f32(d*c.classBonus/100)+f32(d*c.partyBonus/100));
    d=f32(d*(1+c.bonus/100));
    d=f32(d+extra);
    d=f32(d*nz(c.targetCoefficient));
    d=f32(d*(1+c.event));
    d=f32(d*(name==='physical' && critical?2:1));
    if(s.level>s.targetLevel) d=f32(d*(1+levelBonus(s)));
    d=f32(d*balances(s)[name]);
    d=f32(d*nz(c.attackerMultiplier));
    d=f32(d*nz(c.targetMultiplier));
    return Math.trunc(clamp(d,0,16777215));
  }
  function total(s,p,m) {
    // §6.3: low DWORD product before division by target ratio BYTE.
    return Math.trunc(((p+m)*s.targetRatio >>> 0)/100);
  }
  function hitAt(s, physicalT, magicalT) {
    const physical=channel(s,'physical',physicalT);
    const magical=channel(s,'magical',magicalT);
    const criticalPhysical=channel(s,'physical',physicalT,true);
    return {physical,magical,criticalPhysical,normal:total(s,physical,magical),critical:total(s,criticalPhysical,magical)};
  }
  function ranges(s) {
    validate(s);
    // Standard UI uses neutral target ratio. Non-neutral wrap can be non-monotone.
    const max=hitAt(s,100,100), min=hitAt(s,0,0);
    if((channel(s,'physical',100,true)+channel(s,'magical',100))*s.targetRatio>0xFFFFFFFF)
      throw new Error('Exact ranges with target-ratio DWORD overflow are not supported.');
    return {normal:{min:min.normal,max:max.normal},critical:{min:min.critical,max:max.critical}};
  }
  function sample(s,rng=Math.random) {
    const r=ratio(s),rand=()=>random15(rng);
    return hitAt(s,s.physical.enabled?roll(r,rand):0,s.magical.enabled?roll(r,rand):0);
  }
  function simulate(s,count=10000,rng=Math.random) {
    validate(s);
    if(!Number.isInteger(count)||count<1||count>1000000) throw new Error('Hit count must be between 1 and 1,000,000.');
    const histogram=new Map(); let sum=0,criticalSum=0,min=Infinity,max=-Infinity;
    for(let i=0;i<count;i++) {
      const h=sample(s,rng); sum+=h.normal; criticalSum+=h.critical;
      min=Math.min(min,h.normal);max=Math.max(max,h.normal);
      histogram.set(h.normal,(histogram.get(h.normal)||0)+1);
    }
    return {count,average:sum/count,criticalAverage:criticalSum/count,min,max,histogram:[...histogram].sort((a,b)=>a[0]-b[0])};
  }
  function seeded(seed=1) {
    return ()=>{ seed=(seed+0x6D2B79F5)|0; let t=Math.imul(seed^(seed>>>15),1|seed);
      t^=t+Math.imul(t^(t>>>7),61|t);return ((t^(t>>>14))>>>0)/4294967296; };
  }
  const api={basicSkills,descriptorPercent,defaults,validate,balances,levelBonus,ratio,roll,channel,total,hitAt,ranges,sample,simulate,seeded};
  if(typeof module==='object' && module.exports) module.exports=api;
  else root.DamageEngine=api;
})(globalThis);
