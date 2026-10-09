'use strict';
const H=globalThis.HybridEngine;
const $=id=>document.getElementById(id);
const I=globalThis.SilkroadI18n, t=(key,params)=>I.t(key,params);
const fmt=n=>I.number(n);
const defaults=H.defaults();

/* Database-backed selectors; the optional manual fields remain available. */
let skillDatabase=null;
let catalogueFailed=false;
const kindFor={physicalSkill:'physical',imbue:'imbue',nuke:'nuke'};
const skillNames=globalThis.SilkroadSkillNames;
function skillLabel(g){
 return skillNames.label(skillDatabase?.groups[g]?.nameKey,g,I.locale,t);
}
// Starting loadout uses actual skill records, never fabricated skill damage.
// If a series is unavailable after lowering level, use an eligible earlier
// book in the same skill family. All these choices remain user-editable.
const starterSeries={
 physicalSkill:'SKILL_CH_BOW_POWER_D',
 imbue:'SKILL_CH_FIRE_GIGONGTA_E',
 nuke:'SKILL_CH_FIRE_GIGONGSUL_F'
};
let applyStarterSkills=true;
const autoSeries={physicalSkill:true,imbue:true,nuke:true};
function pickEligibleFamilyGroup(k,preferred){
 const all=listFor(k);
 if(all.some(x=>x.group===preferred))return preferred;
 const parent=preferred.slice(0,preferred.lastIndexOf('_')+1);
 const books=all.filter(x=>x.group.startsWith(parent));
 if(!books.length){
  // E.g. player switches from Bow to Heuksal: use strongest eligible
  // physical skill in the new weapon tree instead of stale Bow data.
  if(k!=='physicalSkill'||!all.length)return '';
  return all.sort((a,b)=>
    b.max.requiredMasteryLevel-a.max.requiredMasteryLevel ||
    b.max.skillLevel-a.max.skillLevel)[0].group;
 }
 return books.sort((a,b)=>
   b.max.requiredMasteryLevel-a.max.requiredMasteryLevel ||
   b.max.skillLevel-a.max.skillLevel)[0].group;
}
function selectStarterSkills(){
 if(!skillDatabase)return;
 for(const [k,preferred] of Object.entries(starterSeries)){
  if(!autoSeries[k])continue;
  const selection=pickEligibleFamilyGroup(k,preferred);
  if(selection)$(k+'-group').value=selection;
 }
 refreshSkillSelectors();
}


function masterFor(k){return Number($('mastery-'+({physicalSkill:'physical',imbue:'imbue',nuke:'nuke'}[k])).value);}
function listFor(k){
 const family=k==='physicalSkill'?({sword:'SWORD',spear:'SPEAR',bow:'BOW'}[$('weapon').value]):null;
 const C=globalThis.SilkroadSkillCatalog;
 const regular=C.groups(skillDatabase,kindFor[k],family,masterFor(k));
 if(k!=='nuke')return regular;
 // Lightning's CHUNDUNG ("Shock Lion Shout") is a magical offensive skill,
 // not a STORM-family nuke. It belongs in the magical-skill selector too.
 return [...regular,...C.groups(skillDatabase,'magical',null,masterFor(k))]
   .sort((a,b)=>a.group.localeCompare(b.group));
}
function option(value,label){const o=document.createElement('option');o.value=value;o.textContent=label;return o;}
function refreshSkillSelectors(){
 if(!skillDatabase)return;
 for(const k of Object.keys(kindFor)){
  const select=$(k+'-group'),previous=select.value;
  const choices=listFor(k);
  select.replaceChildren(option('',t('manual')),...choices.map(x=>option(x.group,skillLabel(x.group))));
  const stillAvailable=choices.some(c=>c.group===previous);
  if(stillAvailable)select.value=previous;
  else if(previous) {
   // Move down the same skill-tree series when mastery decreases.
   const fallback=pickEligibleFamilyGroup(k,previous);
   if(fallback)select.value=fallback;
   else for(const field of ['min','max','rate'])$(k+'-'+field).value='';
  }
  const lvl=$(k+'-skillLevel'),old=lvl.value;
  lvl.replaceChildren(option('',t('auto')));
  const group=select.value;
  if(group){
   const list=globalThis.SilkroadSkillCatalog.availableLevels(skillDatabase,group,masterFor(k));
   for(const rec of list)lvl.append(option(String(rec[1]),t('skillLevel',{level:fmt(rec[1]),mastery:fmt(rec[2])})));
   if(list.some(rec=>String(rec[1])===old))lvl.value=old;
  }
  const row=selectedSkill(k);
  const autoNote=$(k+'-auto-note');
  $(k+'-fields').hidden=Boolean(row);
  lvl.parentElement.hidden=!group;
  autoNote.hidden=!row;
  if(row){
   $(k+'-min').value=String(row.powerMin);
   $(k+'-max').value=String(row.powerMax);
   $(k+'-rate').value=String(row.primaryDamagePercent);
   autoNote.textContent=t('loaded',{level:fmt(row.skillLevel)});
  }
 }
}
function selectedSkill(k){
 if(!skillDatabase)return null;
 return globalThis.SilkroadSkillCatalog.select(skillDatabase,$(k+'-group').value,masterFor(k),$(k+'-skillLevel').value||null);
}
const skillProfiles={};
const profileSources={
 original:'data/chinese-skills.json',
 vsro:'data/chinese-skills-vsro.json'
};
async function loadSkillProfile(which,sequence){
 if(!Object.prototype.hasOwnProperty.call(profileSources,which))
   throw new Error('Unknown skill data profile.');
 if(!skillProfiles[which]){
  const response=await fetch(profileSources[which]);
  if(!response.ok)throw new Error('Skill catalogue HTTP '+response.status);
  const data=await response.json();
  if(data.schemaVersion!==1||!data.groups)throw new Error('Invalid skill catalogue');
  skillProfiles[which]=data;
 }
 if(sequence!==profileLoadSequence)return;
 skillDatabase=skillProfiles[which];catalogueFailed=false;
 refreshSkillSelectors();
 if(applyStarterSkills){
  selectStarterSkills();
  applyStarterSkills=false;
 }
 update();
}
let profileLoadSequence=0;
function switchSkillProfile(){
 const selected=$('skillProfile').value,sequence=++profileLoadSequence;
 skillDatabase=null;catalogueFailed=false;
 loadSkillProfile(selected,sequence).catch(err=>{
  if(sequence!==profileLoadSequence)return;
  catalogueFailed=true;
  const e=$('error');e.hidden=false;
  e.textContent=t('catalogError');
 });
}
switchSkillProfile();

function field(parent,id,label,value,min=0,step='any'){
  const wrap=document.createElement('div');wrap.className='field';
  const lab=document.createElement('label');lab.htmlFor=id;lab.dataset.i18n=label;lab.textContent=t(label);
  const input=document.createElement('input');
  Object.assign(input,{id,type:'number',value:value===null?'':String(value),min:String(min),step,required:true});
  wrap.append(lab,input);parent.append(wrap);
}
// This is an explicitly labeled, historical single-value example, not
// fabricated C-screen min/max data. Replace it with a real character's AP.
const demoAP={physicalMin:3012,physicalMax:3012,magicalMin:2638,magicalMax:2638};
for (const [key,label] of [
 ['physicalMin','physicalMin'],['physicalMax','physicalMax'],
 ['magicalMin','magicalMin'],['magicalMax','magicalMax']
]) field($('weapon-fields'),key,label,demoAP[key]);
for (const [key,label] of [
 ['physicalReinforceMin','physicalReinforceMin'],['physicalReinforceMax','physicalReinforceMax'],
 ['magicalReinforceMin','magicalReinforceMin'],['magicalReinforceMax','magicalReinforceMax']
]) field($('reinforcement-fields'),key,label,defaults.weapon[key]);
for (const [key,label] of [['physicalSkill','physicalSkill'],['imbue','imbue'],['nuke','nuke']]) {
 const x=defaults[key];
 for(const [fieldName,caption] of [['min','skillMin'],['max','skillMax'],['rate','skillRate']])
   field($(key+'-fields'),key+'-'+fieldName,caption,x[fieldName],0,'any');
}
for(const [key,label,value] of [
 ['targetLevel','targetLevel',1],
 ['physicalDefense','physicalDefense',7],['magicalDefense','magicalDefense',10],
 ['physicalAbsorption','physicalAbsorption',1],['magicalAbsorption','magicalAbsorption',1],
 ['physicalBonus','physicalBonus',0],['magicalBonus','magicalBonus',0]
]) field($('target-fields'),key,label,value,key==='targetLevel'||key==='parry'?1:0,key==='targetLevel'?'1':'any');
for(const [key,label] of [
 ['physical','physicalMastery'],['imbue','imbueMastery'],['nuke','nukeMastery']
]) field($('mastery-fields'),'mastery-'+key,label,Number($('level').value),0,'1');
const ids=[...document.querySelectorAll('#hybrid-form input, #hybrid-form select')].map(e=>e.id);
const initialValues=Object.fromEntries(ids.map(id=>[id,$(id).type==='checkbox'?$(id).checked:$(id).value]));
function usable(){
 const lv=Number($('level').value);
 const total=Math.max(0,(lv-1)*3);
 const unspent=Math.min(total,Math.max(0,Number($('unspentPoints').value)||0));
 return Math.max(0,total-unspent);
}
function syncPoints(rescale=false){
 const n=usable(), slider=$('strPoints');
 const prior=Number(slider.value);
 let next=prior;
 if(rescale && previousUsable>0) next=Math.round(prior/previousUsable*n);
 slider.max=String(n);slider.value=String(Math.max(0,Math.min(n,next)));
 previousUsable=n;
 $('available-note').textContent=t('available',{available:fmt(n),total:fmt((Number($('level').value)-1)*3)});
 $('str-alloc').textContent=t('strAllocation',{points:fmt(slider.value)});
 $('int-alloc').textContent=t('intAllocation',{points:fmt(n-Number(slider.value))});
}
function read(){
 const s=H.defaults();
 const val=id=>{const input=$(id);return input.value.trim()===''?null:input.valueAsNumber;};
 s.level=val('level');s.maxLevelReached=val('maxLevelReached');
 s.unspentPoints=val('unspentPoints');s.allocatedSTR=val('strPoints');
 for(const k of ['bonusSTR','bonusINT','extraHP','extraMP','devilRate'])s[k]=val(k);
 s.weapon.key=$('weapon').value;s.weapon.apMode=$('apMode').value;
 for(const k of ['physical','imbue','nuke'])s.masteries[k]=val('mastery-'+k);
 // Keep recovered math inside the engine; no player-facing calculator mode.
 s.imbue.mode='attack';
 s.weapon.basicPercent=({sword:60,spear:117,bow:84})[s.weapon.key];
 for(const k of ['physicalMin','physicalMax','magicalMin','magicalMax','physicalReinforceMin','physicalReinforceMax','magicalReinforceMin','magicalReinforceMax'])s.weapon[k]=val(k);
 for(const k of ['physicalSkill','imbue','nuke']){
   for(const f of ['min','max','rate'])s[k][f]=val(k+'-'+f);
   // A selected database skill is active automatically. For manual mode
   // all three entered fields activate the skill; incomplete data does not.
   s[k].enabled=['min','max','rate'].every(f=>s[k][f]!==null);
 }

 for(const k of Object.keys(kindFor)){const chosen=selectedSkill(k);if(chosen){
  s[k].enabled=true;s[k].min=chosen.powerMin;s[k].max=chosen.powerMax;
  s[k].rate=chosen.primaryDamagePercent;
  if(k==='nuke')s.nuke.secondaryPercent=chosen.secondaryPercent;
 }}
 s.target.level=val('targetLevel');
 for(const f of ['physicalDefense','magicalDefense','physicalAbsorption','magicalAbsorption'])s.target[f]=val(f);
 s.damageBonuses.physical=val('physicalBonus');s.damageBonuses.magical=val('magicalBonus');
 return H.verify(s);
}
function row(name,value,description=''){
 const div=document.createElement('div');div.className='build-row';
 const lab=document.createElement('span');lab.textContent=t(name);
 const strong=document.createElement('strong');strong.textContent=t(value);
 div.append(lab,strong);
 if(description){const small=document.createElement('small');small.textContent=t(description);div.append(small);}
 return div;
}
function damageRange(r,crit=false){
 if(!r)return '—';
 const d=crit?r.critical:r.normal;
 return '\u2066'+fmt(d.min)+' – '+fmt(d.max)+'\u2069';
}
function quickCard(label, value, note='',icon='activity',kind='stat'){
 const c=document.createElement('div');c.className='quick-card '+kind;
 const heading=document.createElement('span');heading.textContent=t(label);
 const number=document.createElement('strong');number.textContent=value;
 const glyph=document.createElement('span');glyph.className='mini-icon';glyph.setAttribute('aria-hidden','true');glyph.textContent=({heart:'♡',droplet:'♧',swords:'⚔',flame:'♨',sword:'⚔',target:'◎',spark:'✦',activity:'◈'})[icon]||'◈';c.append(glyph,heading,number);
 if(note){const small=document.createElement('small');small.textContent=note;c.append(small);}
 return c;
}
const damageOutputs=[
 ['normal','normal'],['normalImbue','normalImbue'],
 ['physicalSkill','physicalSkill'],['physicalSkillImbue','physicalSkillImbue'],
 ['nuke','nuke'],['nukeImbue','nukeImbue']
];
const hasPhysicalCritical=key=>!['nuke','nukeImbue'].includes(key);
function renderQuick(result){
 const st=result.stats;
 const cards=[quickCard('HP',fmt(st.HP)),quickCard('MP',fmt(st.MP)),quickCard('physicalBalance',fmt(st.physicalBalance)+'%'),quickCard('magicalBalance',fmt(st.magicalBalance)+'%')];
 for(const [key,label] of damageOutputs){
  cards.push(quickCard(label,damageRange(result[key]),hasPhysicalCritical(key)?t('critical',{value:damageRange(result[key],true)}):'','activity','damage'));
 }
 $('quick-results').replaceChildren(...cards);
}
function column(title,result,selected=false){
 const c=document.createElement('div');c.className='build-col'+(selected?' selected':'');
 const h=document.createElement('h3');h.textContent=t(title);c.append(h);
 const sub=document.createElement('div');sub.className='sub';sub.textContent=t('allocation',{str:fmt(result.stats.allocatedSTR),int:fmt(result.stats.allocatedINT)});c.append(sub);
 const st=result.stats,ap=result.ap;
 c.append(row('STR / INT',fmt(st.STR)+' / '+fmt(st.INT)));
 c.append(row('HP / MP',fmt(st.HP)+' / '+fmt(st.MP)));
 c.append(row('physicalBalance',fmt(st.physicalBalance)+'%'));
 c.append(row('magicalBalance',fmt(st.magicalBalance)+'%'));
 c.append(row(($('apMode').value==='tooltip'?t('estimated',{label:t('physicalAP')}):t('physicalAP')),ap?ap.physical.map(fmt).join(' – '):'—'));
 c.append(row(($('apMode').value==='tooltip'?t('estimated',{label:t('magicalAP')}):t('magicalAP')),ap?ap.magical.map(fmt).join(' – '):'—'));
 for(const [key,label] of damageOutputs){
  c.append(row(label,damageRange(result[key])));
  if(hasPhysicalCritical(key))c.append(row(t('criticalLabel',{label:t(label)}),damageRange(result[key],true)));
 }
 return c;
}

const weaponNames={sword:'Bicheon',spear:'Heuksal',bow:'Pacheon'};
let timer,previousWeapon='bow',previousUsable=usable(),previousLevel=Number($('level').value);
function rawStats(s){
 H.verify(s);
 renderQuick({stats:H.stats(s)});
}
function refreshWeapon(){
 const key=$('weapon').value;
 $('setup-label').textContent=weaponNames[key]+' · '+(Number($('targetLevel').value)===1?'Manyang · ':'')+t('targetSummary',{level:fmt($('targetLevel').value)});
}
function update(){
 clearTimeout(timer);syncPoints();refreshWeapon();refreshSkillSelectors();
 for(const k of ['physical','imbue','nuke'])$('mastery-'+k).max=$('level').value;
 $('character-ap-heading').textContent=t($('apMode').value==='displayed'?'characterAP':'weaponAP');
 $('ap-source-note').textContent=t($('apMode').value==='displayed'?'cScreen':'tooltip');
 $('ap-demo-note').hidden=$('apMode').value!=='displayed' ||
  !Object.entries(demoAP).every(([field,value])=>Number($(field).value)===value);
 for(const k of ['physicalMin','physicalMax','magicalMin','magicalMax'])document.querySelector('label[for="'+k+'"]').textContent=t(k);
 $('reinforcement-fields').hidden=$('apMode').value==='displayed';
 try {
  const s=read(),results=H.compare(s);
  renderQuick(results.selected);
  $('comparison').replaceChildren(...(results.fullSTR ? [
    column('fullSTR',results.fullSTR), column('yourBuild',results.selected,true), column('fullINT',results.fullINT)
  ] : [column('yourBuild',results.selected,true), row('comparison','comparisonHelp')]));
  $('error').hidden=!catalogueFailed;
  if(catalogueFailed)$('error').textContent=t('catalogError');
 } catch(e) {
  $('comparison').replaceChildren();
  try { rawStats(readStats()); }
  catch(_) { $('quick-results').replaceChildren(); }
  $('error').hidden=false;
  $('error').textContent=I.error(e.message);
 }
}
function readStats(){
 const s=H.defaults(),v=id=>$(id).value.trim()===''?NaN:$(id).valueAsNumber;
 s.level=v('level');
 s.maxLevelReached=v('maxLevelReached');
 s.unspentPoints=v('unspentPoints');
 s.allocatedSTR=v('strPoints');
 for(const k of ['bonusSTR','bonusINT','extraHP','extraMP','devilRate'])s[k]=v(k);
 return s;
}
function selectWeapon(key){previousWeapon=key;refreshWeapon();}
$('hybrid-form').addEventListener('submit',e=>e.preventDefault());
$('hybrid-form').addEventListener('input',e=>{
 if(e.target.id==='level'||e.target.id==='unspentPoints'){
  if(e.target.id==='level'){
   const currentLevel=Number(e.target.value);
   if(Number($('maxLevelReached').value)===previousLevel)$('maxLevelReached').value=e.target.value;
   // Default: every mastery follows character level. A deliberately
   // lowered mastery stays lowered, except that it can never exceed level.
   for(const k of ['physical','imbue','nuke']){
    const control=$('mastery-'+k),mastery=Number(control.value);
    if(mastery===previousLevel||mastery>currentLevel)control.value=e.target.value;
   }
   previousLevel=currentLevel;
  }
  syncPoints(true);
 }
 if(e.target.id==='weapon' && $('weapon').value!==previousWeapon)selectWeapon($('weapon').value);
 if(e.target.id==='skillProfile'){switchSkillProfile();return;}
 for(const k of Object.keys(kindFor)){
  if(e.target.id===k+'-group'||e.target.id===k+'-skillLevel')autoSeries[k]=false;
  if(e.target.id===k+'-group' && !$(k+'-group').value){
   // Selecting Manual values is an explicit reset, not an instruction
   // to keep the hidden, previously database-filled AP and percentage.
   for(const field of ['min','max','rate'])$(k+'-'+field).value='';
  }
 }
 // When the level or learned mastery changes, auto-picked skills follow the
 // strongest unlocked book; user-selected skills/levels remain untouched.
 if(e.target.id==='level'||e.target.id==='weapon'||e.target.id.startsWith('mastery-'))
  selectStarterSkills();
 clearTimeout(timer);timer=setTimeout(update,90);
});
$('weapon').addEventListener('change',()=>{
 if($('weapon').value!==previousWeapon)selectWeapon($('weapon').value);
 update();
});
document.querySelectorAll('[data-ratio]').forEach(button=>button.addEventListener('click',()=>{
 $('strPoints').value=String(Math.round(usable()*Number(button.dataset.ratio)));update();
}));
$('open-customize').addEventListener('click',()=>{
 $('customize').open=true;
 $('customize').scrollIntoView({behavior:'smooth',block:'start'});
});
$('reset').addEventListener('click',()=>{
 for(const [id,value] of Object.entries(initialValues)){
  const el=$(id);
  if(el.type==='checkbox')el.checked=value;else el.value=value;
 }
 previousWeapon='bow';
 previousUsable=usable();previousLevel=Number($('level').value);
 for(const k of Object.keys(autoSeries))autoSeries[k]=true;
 applyStarterSkills=true;
 syncPoints();switchSkillProfile();
});
globalThis.addEventListener('languagechange',()=>update());
I.init();
syncPoints();update();
