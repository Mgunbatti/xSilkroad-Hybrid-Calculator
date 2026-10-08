'use strict';
const H=globalThis.HybridEngine;
const $=id=>document.getElementById(id);
const fmt=n=>Number(n).toLocaleString('en-US',{maximumFractionDigits:2});
const defaults=H.defaults();
function field(parent,id,label,value,min=0,step='any'){
  const wrap=document.createElement('div');wrap.className='field';
  const lab=document.createElement('label');lab.htmlFor=id;lab.textContent=label;
  const input=document.createElement('input');
  Object.assign(input,{id,type:'number',value:String(value),min:String(min),step,required:true});
  wrap.append(lab,input);parent.append(wrap);
}
for (const [key,label] of [
 ['physicalMin','Physical weapon AP min'],['physicalMax','Physical weapon AP max'],
 ['magicalMin','Magical weapon AP min'],['magicalMax','Magical weapon AP max'],
 ['physicalReinforceMin','Physical reinforce min %'],['physicalReinforceMax','Physical reinforce max %'],
 ['magicalReinforceMin','Magical reinforce min %'],['magicalReinforceMax','Magical reinforce max %']
]) field($('weapon-fields'),key,label,defaults.weapon[key]);
for (const [key,label] of [['physicalSkill','Physical skill'],['imbue','Imbue'],['nuke','Nuke']]) {
 const x=defaults[key];
 for(const [fieldName,caption] of [['min','Skill AP min'],['max','Skill AP max'],['rate','Damage rate %'],['mastery','Mastery %']])
   field($(key+'-fields'),key+'-'+fieldName,caption,x[fieldName],0,fieldName==='mastery'?'1':'any');
}
for(const [key,label,value] of [
 ['targetLevel','Target level',1],['parry','Target parry (assumed)',100],
 ['physicalDefense','Physical defense',7],['magicalDefense','Magical defense',10],
 ['physicalAbsorption','Physical absorption %',1],['magicalAbsorption','Magical absorption %',1],
 ['physicalBonus','Physical damage bonus %',0],['magicalBonus','Magical damage bonus %',0]
]) field($('target-fields'),key,label,value,key==='targetLevel'||key==='parry'?1:0,key==='targetLevel'?'1':'any');
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
 $('available-note').textContent=n+' points available · '+(Number($('level').value)-1)*3+' earned in total';
 $('str-alloc').textContent='STR '+slider.value+' pts';
 $('int-alloc').textContent='INT '+(n-Number(slider.value))+' pts';
}
function read(){
 const s=H.defaults();
 const val=id=>{const input=$(id);return input.value.trim()===''?NaN:input.valueAsNumber;};
 s.level=val('level');s.maxLevelReached=Math.max(s.level,val('maxLevelReached'));
 s.unspentPoints=val('unspentPoints');s.allocatedSTR=val('strPoints');
 for(const k of ['bonusSTR','bonusINT','extraHP','extraMP','devilRate','attackRate'])s[k]=val(k);
 s.weapon.key=$('weapon').value;
 s.weapon.basicPercent=val('basicPercent');
 for(const k of ['physicalMin','physicalMax','magicalMin','magicalMax','physicalReinforceMin','physicalReinforceMax','magicalReinforceMin','magicalReinforceMax'])s.weapon[k]=val(k);
 for(const k of ['physicalSkill','imbue','nuke']){
   s[k].enabled=$(k+'-enabled').checked;
   for(const f of ['min','max','rate','mastery'])s[k][f]=val(k+'-'+f);
 }
 s.target.level=val('targetLevel');s.target.parry=val('parry');
 for(const f of ['physicalDefense','magicalDefense','physicalAbsorption','magicalAbsorption'])s.target[f]=val(f);
 s.damageBonuses.physical=val('physicalBonus');s.damageBonuses.magical=val('magicalBonus');
 return H.verify(s);
}
function row(name,value,description=''){
 const div=document.createElement('div');div.className='build-row';
 const lab=document.createElement('span');lab.textContent=name;
 const strong=document.createElement('strong');strong.textContent=value;
 div.append(lab,strong);
 if(description){const small=document.createElement('small');small.textContent=description;div.append(small);}
 return div;
}
function damageRange(r,crit=false){
 if(!r)return '—';
 const d=crit?r.critical:r.normal;
 return fmt(d.min)+' – '+fmt(d.max);
}
function quickCard(label, value, note=''){
 const c=document.createElement('div');c.className='quick-card';
 const heading=document.createElement('span');heading.textContent=label;
 const number=document.createElement('strong');number.textContent=value;
 c.append(heading,number);
 if(note){const small=document.createElement('small');small.textContent=note;c.append(small);}
 return c;
}
function renderQuick(result, status='') {
 const s=result.stats;
 const cards=[
  quickCard('STR / INT',fmt(s.STR)+' / '+fmt(s.INT)),
  quickCard('Maximum HP',fmt(s.HP)),
  quickCard('Maximum MP',fmt(s.MP)),
  quickCard('Physical Balance',fmt(s.physicalBalance)+'%'),
  quickCard('Magical Balance',fmt(s.magicalBalance)+'%'),
  quickCard('Physical Attack',damageRange(result.physical)),
  quickCard('Physical Critical',damageRange(result.physical,true)),
  quickCard('Physical + Imbue',damageRange(result.physicalImbue),'Demo magical contribution; imbue caller not verified'),
  quickCard('Physical + Imbue Critical',damageRange(result.physicalImbue,true)),
  quickCard('Magical Nuke',damageRange(result.nuke),'Lv1 demo; editable')
 ];
 $('quick-results').replaceChildren(...cards);
}
function column(title,result,selected=false){
 const c=document.createElement('div');c.className='build-col'+(selected?' selected':'');
 const h=document.createElement('h3');h.textContent=title;c.append(h);
 const sub=document.createElement('div');sub.className='sub';sub.textContent=result.stats.allocatedSTR+' STR pts / '+result.stats.allocatedINT+' INT pts';c.append(sub);
 const st=result.stats,ap=result.ap;
 c.append(row('STR / INT',fmt(st.STR)+' / '+fmt(st.INT)));
 c.append(row('HP / MP',fmt(st.HP)+' / '+fmt(st.MP)));
 c.append(row('Physical Balance',fmt(st.physicalBalance)+'%'));
 c.append(row('Magical Balance',fmt(st.magicalBalance)+'%'));
 c.append(row('Physical AP (estimated)',ap.physical.map(fmt).join(' – ')));
 c.append(row('Magical AP (estimated)',ap.magical.map(fmt).join(' – ')));
 c.append(row('Physical hit',damageRange(result.physical)));
 c.append(row('Physical critical',damageRange(result.physical,true)));
 if(result.physicalImbue){
  c.append(row('Physical + imbue',damageRange(result.physicalImbue),'Secondary imbue stage provisional'));
  c.append(row('Physical + imbue critical',damageRange(result.physicalImbue,true)));
 }
 if(result.nuke)c.append(row('Nuke',damageRange(result.nuke)));
 return c;
}

const weaponNames={
 sword:'Bicheon · Sword',blade:'Bicheon · Blade',
 spear:'Heuksal · Spear',glaive:'Heuksal · Glaive',
 bow:'Pacheon · Bow',custom:'Custom weapon'
};
let timer,previousWeapon='sword',previousUsable=usable(),previousLevel=Number($('level').value);
function rawStats(s){
 const st=H.stats(s);
 $('quick-results').replaceChildren(
  quickCard('STR / INT',fmt(st.STR)+' / '+fmt(st.INT)),
  quickCard('Maximum HP',fmt(st.HP)),
  quickCard('Maximum MP',fmt(st.MP)),
  quickCard('Physical Balance',fmt(st.physicalBalance)+'%'),
  quickCard('Magical Balance',fmt(st.magicalBalance)+'%'),
  quickCard('Physical Attack','—','Enter weapon stats to calculate'),
  quickCard('Physical Critical','—','Enter weapon stats to calculate'),
  quickCard('Physical + Imbue','—','Enter weapon stats to calculate'),
  quickCard('Magical Nuke','—','Enter weapon stats to calculate')
 );
}
function refreshWeapon(){
 const key=$('weapon').value;
 const provisional=key==='blade'||key==='custom';
 $('manual-rate-wrap').hidden=!provisional;
 $('setup-label').textContent=weaponNames[key]+(key==='sword'?' (+7 demo)':'')+' · Manyang Lv1';
 if(provisional) {
  $('weapon-warning').textContent=key==='blade'
    ? 'Blade default attack % has not been verified. Enter your server percentage and Blade tooltip values.'
    : 'Enter your weapon basic attack % and tooltip values.';
 } else if(key!=='sword'){
  $('weapon-warning').textContent='Enter '+weaponNames[key]+' tooltip values. Copper Sword values are not reused.';
 }else{
  $('weapon-warning').textContent='Sample: Copper Sword (+7). Your server may use different values.';
 }
}
function update(){
 clearTimeout(timer);syncPoints();refreshWeapon();
 try {
  const s=read(),results=H.compare(s);
  renderQuick(results.selected);
  $('comparison').replaceChildren(
    column('Full STR',results.fullSTR),
    column('Your Build',results.selected,true),
    column('Full INT',results.fullINT)
  );
  $('error').hidden=true;
 } catch(e) {
  $('comparison').replaceChildren();
  try { rawStats(readStats()); }
  catch(_) { $('quick-results').replaceChildren(); }
  $('error').hidden=false;
  $('error').textContent=e.message;
 }
}
function readStats(){
 const s=H.defaults(),v=id=>$(id).value.trim()===''?NaN:$(id).valueAsNumber;
 s.level=v('level');
 s.maxLevelReached=Math.max(s.level,v('maxLevelReached'));
 s.unspentPoints=v('unspentPoints');
 s.allocatedSTR=v('strPoints');
 for(const k of ['bonusSTR','bonusINT','extraHP','extraMP','devilRate'])s[k]=v(k);
 return s;
}
function clearWeaponDemo(key){
 if(key==='sword'){
  const w=defaults.weapon;
  for(const f of ['physicalMin','physicalMax','magicalMin','magicalMax','physicalReinforceMin','physicalReinforceMax','magicalReinforceMin','magicalReinforceMax'])
    $(f).value=String(w[f]);
  $('bonusSTR').value=String(defaults.bonusSTR);
  $('bonusINT').value=String(defaults.bonusINT);
 }else {
  for(const f of ['physicalMin','physicalMax','magicalMin','magicalMax','physicalReinforceMin','physicalReinforceMax','magicalReinforceMin','magicalReinforceMax'])
    $(f).value='';
  $('bonusSTR').value='0';$('bonusINT').value='0';
 }
 $('basicPercent').value='';
 previousWeapon=key;
 refreshWeapon();
}
$('hybrid-form').addEventListener('submit',e=>e.preventDefault());
$('hybrid-form').addEventListener('input',e=>{
 if(e.target.id==='level'||e.target.id==='unspentPoints'){
  if(e.target.id==='level'){
   if(Number($('maxLevelReached').value)===previousLevel)$('maxLevelReached').value=e.target.value;
   previousLevel=Number(e.target.value);
  }
  syncPoints(true);
 }
 if(e.target.id==='weapon' && $('weapon').value!==previousWeapon)clearWeaponDemo($('weapon').value);
 clearTimeout(timer);timer=setTimeout(update,90);
});
$('weapon').addEventListener('change',()=>{
 if($('weapon').value!==previousWeapon)clearWeaponDemo($('weapon').value);
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
 previousWeapon='sword';
 previousUsable=usable();previousLevel=Number($('level').value);
 syncPoints();update();
});
syncPoints();update();
