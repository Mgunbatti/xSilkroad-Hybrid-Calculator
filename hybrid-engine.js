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
      key: 'sword',
      physicalMin: 88, physicalMax: 96,
      magicalMin: 150, magicalMax: 167,
      physicalReinforceMin: 43.4, physicalReinforceMax: 49.3,
      magicalReinforceMin: 74.2, magicalReinforceMax: 86
    },
    // Leave these disabled until a user enters THEIR skill tooltip.
    physicalSkill: { enabled: false, min: 0, max: 0, rate: 100, mastery: 0 },
    imbue: { enabled: false, min: 0, max: 0, rate: 100, mastery: 0 },
    nuke: { enabled: false, min: 0, max: 0, rate: 100, mastery: 0 },
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
    if (w.key !== 'custom' && !(w.key in Damage.basicSkills))
      throw new Error('Unverified basic weapon: use manual rate / custom.');
    for (const key of [
      'physicalMin', 'physicalMax', 'magicalMin', 'magicalMax',
      'physicalReinforceMin', 'physicalReinforceMax',
      'magicalReinforceMin', 'magicalReinforceMax'
    ]) finite(w[key], key);
    if (w.physicalMin > w.physicalMax || w.magicalMin > w.magicalMax ||
      w.physicalReinforceMin > w.physicalReinforceMax ||
      w.magicalReinforceMin > w.magicalReinforceMax)
      throw new Error('Minimum weapon value cannot exceed maximum.');
    if (w.key === 'custom') finite(w.basicPercent, 'Manual basic descriptor');
    for (const key of ['physicalSkill', 'imbue', 'nuke']) {
      const skill = s[key];
      if (typeof skill.enabled !== 'boolean') throw new Error(key + ' enabled must be boolean.');
      for (const f of ['min', 'max', 'rate', 'mastery']) finite(skill[f], key + ' ' + f);
      if (skill.min > skill.max) throw new Error(key + ': min exceeds max.');
      integer(skill.mastery, key + ' mastery', 0, 255);
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
    d.weapon = s.weapon.key;
    d.basicPercent = s.weapon.key === 'custom' ? s.weapon.basicPercent : 100;

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

  function addSkill(channel, skill) {
    channel.enabled = true;
    channel.skillMin = skill.min;
    channel.skillMax = skill.max;
    channel.skillPercent = skill.rate;
    channel.mastery = skill.mastery;
  }

  function calculate(s) {
    verify(s);
    const stat = stats(s);
    const ap = attackPower(s, stat);
    const d = inputForDamage(s, stat, ap);

    // Physical attack: verified basic descriptor or user's physical skill.
    if (s.physicalSkill.enabled) {
      d.attackMode = 'active';
      addSkill(d.physical, s.physicalSkill);
    }
    const physical = Damage.ranges(d);

    // Physical + imbue shares physical crit rule; secondary imbue caller
    // semantics have not been independently validated in-game.
    let physicalImbue = null;
    if (s.imbue.enabled) {
      addSkill(d.magical, s.imbue);
      physicalImbue = Damage.ranges(d);
    }

    // Nuke is a standalone magical ACTIVE skill with user-entered tooltip stats.
    let nuke = null;
    if (s.nuke.enabled) {
      const n = inputForDamage(s, stat, ap);
      n.attackMode = 'active';
      n.physical.enabled = false;
      addSkill(n.magical, s.nuke);
      nuke = Damage.ranges(n);
    }

    return {stats: stat, ap, physical, physicalImbue, nuke};
  }

  function compare(s) {
    verify(s);
    const usable = (s.level - 1) * 3 - s.unspentPoints;
    const selected = calculate(s);
    return {
      selected,
      fullSTR: calculate(Object.assign({}, s, {allocatedSTR: usable})),
      fullINT: calculate(Object.assign({}, s, {allocatedSTR: 0}))
    };
  }

  const api = {defaults, verify, stats, attackPower, calculate, compare, pythonRound};
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HybridEngine = api;
})(globalThis);
