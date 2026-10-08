/* xSilkroad Hybrid Calculator — build engine.
 * HP/MP: historic hybrid formula. Balances and damage: verified shared
 * GameServer engine.js. No independent or approximate damage equation.
 * AP-from-tooltip is an estimate until native item rounding is verified.
 */
(function (root) {
  'use strict';

  const Damage = typeof module === 'object' && module.exports
    ? require('./engine.js') : root.DamageEngine;

  if (!Damage) throw new Error('Load engine.js before hybrid-engine.js.');

  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const finite = (value, name, low = 0, high = 100000000) => {
    if (!Number.isFinite(value) || value < low || value > high)
      throw new Error(name + ' must be between ' + low + ' and ' + high + '.');
    return value;
  };
  const integer = (value, name, low, high) => {
    finite(value, name, low, high);
    if (!Number.isInteger(value)) throw new Error(name + ' must be a whole number.');
    return value;
  };
  function pythonRound(value) {
    const n = Math.floor(value), f = value - n;
    if (f < .5) return n;
    if (f > .5) return n + 1;
    return n % 2 === 0 ? n : n + 1;
  }

  const defaults = () => ({
    level: 100,
    maxLevelReached: 100,
    unspentPoints: 0,
    allocatedSTR: 264,           // 8:1, at Lv100: 297 points total
    bonusSTR: 0,
    bonusINT: 0,
    extraHP: 0,
    extraMP: 0,
    devilRate: 0,
    attackRate: 100,            // distribution only; extrema do not depend on it
    weapon: {
      key: 'sword', basicPercent: 60, apMode: 'tooltip', secondaryPercent: null,
      physicalMin: null, physicalMax: null,
      magicalMin: null, magicalMax: null,
      physicalReinforceMin: null, physicalReinforceMax: null,
      magicalReinforceMin: null, magicalReinforceMax: null
    },
    // Historical Lv1 Fire skill tooltip sample: editable, not server-verified.
    masteries: { physical: 0, imbue: 0, nuke: 0 },
    physicalSkill: { enabled: false, min: null, max: null, rate: null, secondaryPercent: null },
    imbue: { enabled: false, min: null, max: null, rate: 100, mode: 'attack' },
    nuke: { enabled: false, min: null, max: null, rate: null, secondaryPercent: null },
    target: {
      level: 1, parry: 100, physicalDefense: 7, magicalDefense: 10,
      physicalAbsorption: 1, magicalAbsorption: 1
    },
    damageBonuses: { physical: 0, magical: 0 }
  });

  function verify(s) {
    integer(s.level, 'Level', 1, 255);
    integer(s.maxLevelReached, 'Maximum level reached', s.level, 255);
    const allPoints = (s.level - 1) * 3;
    integer(s.unspentPoints, 'Unspent points', 0, allPoints);
    integer(s.allocatedSTR, 'Allocated STR points', 0, allPoints - s.unspentPoints);
    for (const key of ['bonusSTR', 'bonusINT', 'extraHP', 'extraMP'])
      integer(s[key], key, 0, 100000000);
    finite(s.devilRate, 'Devil HP/MP rate', 0, 1000000);
    finite(s.attackRate, 'Attack rate');
    const w = s.weapon;
    if (!['tooltip', 'displayed'].includes(w.apMode)) throw new Error('Select an AP input mode.');
    for (const key of ['physical', 'imbue', 'nuke'])
      integer(s.masteries[key], key + ' mastery level', 0, s.level);
    if (!['attack', 'secondary'].includes(s.imbue.mode)) throw new Error('Select an imbue calculation mode.');
    if (w.key !== 'custom' && !(w.key in Damage.basicSkills))
      throw new Error('Unsupported weapon choice.');
    for (const key of [
      'physicalMin', 'physicalMax', 'magicalMin', 'magicalMax',
      'physicalReinforceMin', 'physicalReinforceMax',
      'magicalReinforceMin', 'magicalReinforceMax'
    ]) { if (w[key] !== null) finite(w[key], key); }
    if ([['physicalMin','physicalMax'],['magicalMin','magicalMax'],
      ['physicalReinforceMin','physicalReinforceMax'],['magicalReinforceMin','magicalReinforceMax']]
      .some(([lo,hi]) => w[lo] !== null && w[hi] !== null && w[lo] > w[hi]))
      throw new Error('Minimum weapon value cannot exceed maximum.');
    finite(w.basicPercent, 'Basic attack damage rate', Number.MIN_VALUE);
    for (const key of ['physicalSkill', 'imbue', 'nuke']) {
      const skill = s[key];
      if (typeof skill.enabled !== 'boolean') throw new Error(key + ' enabled must be boolean.');
      if (!skill.enabled) continue;
      for (const f of ['min', 'max', 'rate']) finite(skill[f], key + ' ' + f);
      if (skill.min > skill.max) throw new Error(key + ': min exceeds max.');
    }
    if (s.imbue.enabled && s.imbue.mode === 'secondary') {
      integer(w.secondaryPercent, 'Normal attack secondary percentage', 0, 4294967295);
      if (s.physicalSkill.enabled)
        integer(s.physicalSkill.secondaryPercent, 'Physical skill secondary percentage', 0, 4294967295);
    }
    integer(s.target.level, 'Target level', 1, 255);
    finite(s.target.parry, 'Target parry', Number.MIN_VALUE);
    for (const key of ['physicalDefense', 'magicalDefense', 'physicalAbsorption', 'magicalAbsorption'])
      finite(s.target[key], key);
    for (const key of ['physical', 'magical'])
      finite(s.damageBonuses[key], key + ' damage bonus');
    return s;
  }

  function stats(s) {
    const totalPoints = (s.level - 1) * 3;
    const allocatedINT = totalPoints - s.unspentPoints - s.allocatedSTR;
    const STR = 20 + (s.level - 1) + s.allocatedSTR + s.bonusSTR;
    const INT = 20 + (s.level - 1) + allocatedINT + s.bonusINT;
    const levelFactor = Math.pow(1.02, s.level - 1);
    const baseHP = pythonRound(levelFactor * STR * 10) + s.extraHP;
    const baseMP = pythonRound(levelFactor * INT * 10) + s.extraMP;
    const mult = 1 + s.devilRate / 100;
    const balances = Damage.balances({maxLevel: s.maxLevelReached, str: STR, int: INT});
    return {
      totalPoints, allocatedSTR: s.allocatedSTR, allocatedINT, unspentPoints: s.unspentPoints,
      STR, INT, baseHP, baseMP, HP: baseHP * mult, MP: baseMP * mult,
      physicalBalance: balances.physical * 100,
      magicalBalance: balances.magical * 100
    };
  }

  // Original tooltip reinforcement model, observed in +5 STR/INT tests.
  // Tooltips are rounded and may differ by ~1 AP from hidden item values.
  function attackPower(s, stat) {
    const w = s.weapon;
    const endpoints = ['physicalMin', 'physicalMax', 'magicalMin', 'magicalMax'];
    const reinforcements = ['physicalReinforceMin', 'physicalReinforceMax', 'magicalReinforceMin', 'magicalReinforceMax'];
    if ([...endpoints, ...(w.apMode === 'tooltip' ? reinforcements : [])].some(k => w[k] === null)) return null;
    if (w.apMode === 'displayed') return {physical:[w.physicalMin,w.physicalMax],magical:[w.magicalMin,w.magicalMax]};
    const physical = [
      w.physicalMin + stat.STR * w.physicalReinforceMin / 100,
      w.physicalMax + stat.STR * w.physicalReinforceMax / 100
    ];
    const magical = [
      w.magicalMin + stat.INT * w.magicalReinforceMin / 100,
      w.magicalMax + stat.INT * w.magicalReinforceMax / 100
    ];
    return {
      physical: physical.map(Math.round),
      magical: magical.map(Math.round),
      rawPhysical: physical,
      rawMagical: magical
    };
  }

  function inputForDamage(s, stat, ap) {
    const d = Damage.defaults();
    d.level = s.level;
    d.maxLevel = s.maxLevelReached;
    d.str = stat.STR;
    d.int = stat.INT;
    d.attackRate = s.attackRate;
    d.parry = s.target.parry;
    d.targetLevel = s.target.level;
    // User's server rate overrides the published DB default, not the core formula.
    d.weapon = 'custom';
    d.basicPercent = Damage.basicSkills[s.weapon.key] ?? s.weapon.basicPercent;

    Object.assign(d.physical, {
      enabled: true, apMode: 'displayed', min: ap.physical[0], max: ap.physical[1],
      defense: s.target.physicalDefense, absorption: s.target.physicalAbsorption,
      skillMin: 0, skillMax: 0, mastery: 0,
      skillPercent: 100, bonus: s.damageBonuses.physical
    });
    Object.assign(d.magical, {
      enabled: false, apMode: 'displayed', min: ap.magical[0], max: ap.magical[1],
      defense: s.target.magicalDefense, absorption: s.target.magicalAbsorption,
      skillMin: 0, skillMax: 0, mastery: 0,
      skillPercent: 100, bonus: s.damageBonuses.magical
    });
    return d;
  }

  function addSkill(channel, skill, mastery) {
    channel.enabled = true;
    channel.skillMin = skill.min;
    channel.skillMax = skill.max;
    channel.skillPercent = skill.rate;
    channel.mastery = mastery;
  }

  function calculate(s) {
    verify(s);
    const stat = stats(s);
    const ap = attackPower(s, stat);
    if (!ap) return {stats:stat, ap:null, normal:null, physicalSkill:null, normalImbue:null, physicalSkillImbue:null, nuke:null, nukeImbue:null};
    const d = inputForDamage(s, stat, ap);
    const normal = Damage.ranges(d);
    let physicalSkill = null, physicalSkillImbue = null;
    const normalImbue = s.imbue.enabled ? withImbue(s, d, d.basicPercent, s.weapon.secondaryPercent) : null;
    if (s.physicalSkill.enabled) {
      d.attackMode = 'active';
      addSkill(d.physical, s.physicalSkill, s.masteries.physical);
      physicalSkill = Damage.ranges(d);
      if (s.imbue.enabled) physicalSkillImbue = withImbue(s, d, s.physicalSkill.rate, s.physicalSkill.secondaryPercent);
    }

    // Nuke primary and its secondary Imbue run on separate magical cores.
    // The primary descriptor's +0x10 is not its main SkillRate.
    let nuke = null, nukeImbue = null;
    if (s.nuke.enabled) {
      const n = inputForDamage(s, stat, ap);
      n.attackMode = 'active';
      n.physical.enabled = false;
      addSkill(n.magical, s.nuke, s.masteries.nuke);
      n.magical.apMode = 'raw';
      nuke = Damage.ranges(n);
      if (s.imbue.enabled && s.nuke.secondaryPercent != null) {
        const secondary = inputForDamage(s, stat, ap);
        secondary.attackMode = 'active';
        secondary.physical.enabled = false;
        addSkill(secondary.magical, s.imbue, secondaryMastery(s.masteries.nuke, s.masteries.imbue));
        secondary.magical.apMode = 'raw';
        const p=Number(s.nuke.secondaryPercent);
        if (!Number.isInteger(p)||p<0||p>4294967295)throw new Error('Nuke secondary percentage must be an unsigned integer.');
        const endpoint=t=>{
          const primaryCore=Damage.channel(n,'magical',t);
          const secondaryCore=Damage.channel(secondary,'magical',t);
          if(secondaryCore*p>0xFFFFFFFF)throw new Error('Nuke secondary DWORD overflow is not supported.');
          return Damage.total(n,0,primaryCore+Math.trunc((secondaryCore*p>>>0)/100));
        };
        nukeImbue={normal:{min:endpoint(0),max:endpoint(100)}};
        nukeImbue.critical={...nukeImbue.normal};
      }
    }

    return {stats: stat, ap, normal, physicalSkill, normalImbue, physicalSkillImbue, nuke, nukeImbue};
  }

  // User's historical mapping: elemental mastery covers magical AP + skill AP.
  // The recovered binary caller is a separate, explicit mode (§6.2), never
  // inferred from the primary +0x04 SkillRate or the monster's level.
  function secondaryMastery(primary, secondary) {
    return primary > 90 ? (secondary > 90 ? secondary : 90) : primary;
  }
  function withImbue(s, primary, attackRate, secondaryPercent) {
    const d = structuredClone(primary);
    addSkill(d.magical, s.imbue, s.masteries.imbue);
    d.magical.apMode = 'raw';
    if (s.imbue.mode === 'attack') {
      d.magical.skillPercent = attackRate;
      return Damage.ranges(d);
    }
    d.magical.mastery = secondaryMastery(s.masteries.physical, s.masteries.imbue);
    const endpoint = (t, crit) => {
      const p = Damage.channel(d, 'physical', t, crit);
      const secondary = Damage.channel(d, 'magical', t);
      // Reject non-monotone DWORD overflow for endpoint ranges, as core does.
      if (secondary * secondaryPercent > 0xFFFFFFFF)
        throw new Error('Secondary DWORD overflow ranges are not supported.');
      const m = Math.trunc((secondary * secondaryPercent >>> 0) / 100);
      if ((p + m) * d.targetRatio > 0xFFFFFFFF)
        throw new Error('Final DWORD overflow ranges are not supported.');
      return Damage.total(d, p, m);
    };
    return {normal:{min:endpoint(0,false),max:endpoint(100,false)},
      critical:{min:endpoint(0,true),max:endpoint(100,true)}};
  }

  function compare(s) {
    verify(s);
    const usable = (s.level - 1) * 3 - s.unspentPoints;
    const selected = calculate(s);
    // Displayed character AP belongs to this build; it cannot predict other
    // stat allocations without the equipment reinforcement values.
    if (s.weapon.apMode === 'displayed') return {selected, fullSTR:null, fullINT:null};
    return {
      selected,
      fullSTR: calculate(Object.assign({}, s, {allocatedSTR: usable})),
      fullINT: calculate(Object.assign({}, s, {allocatedSTR: 0}))
    };
  }

  const api = {defaults, verify, stats, attackPower, calculate, compare, pythonRound, secondaryMastery};
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HybridEngine = api;
})(globalThis);
