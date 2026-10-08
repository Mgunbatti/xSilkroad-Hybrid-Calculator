'use strict';
const E=globalThis.DamageEngine;
const $=id=>document.getElementById(id);
const format=n=>n.toLocaleString('en-US');
const fields=[];
function field(parent,id,label,value,min=0,max=1000000000,step='any',hint='') {
  const div=document.createElement('div');div.className='field';
  const lab=document.createElement('label');lab.htmlFor=id;lab.textContent=label;
  const input=document.createElement('input');Object.assign(input,{id,type:'number',value:String(value),min:String(min),max:String(max),step,required:true});
  if(hint) input.title=hint;
  div.append(lab,input);parent.append(div);fields.push(id);
}
const initial=E.defaults();
field($('basic-fields'),'basicPercent','Manual basic descriptor % (provisional)',100);
field($('advanced-fields'),'targetRatio','Final target ratio %',100,0,255,'1');
for(const name of ['physical','magical']) {
  for(const [key,label,value,min] of [
    ['classBonus','Applicable class-3 bonus %',0,0],['partyBonus','Applicable party bonus %',0,0],
    ['targetCoefficient','Target coefficient (direct)',1,0],['event','Event value (1 + value)',0,-1],
    ['attackerMultiplier','Attacker multiplier (direct)',1,0],['targetMultiplier','Target multiplier (direct)',1,0]
  ]) field($('advanced-fields'),name+'-'+key,`${name}: ${label}`,value,min);
}
for(const [key,label,min,max,hint] of [
  ['level','Current level',1,255,'Current character level.'],
  ['maxLevel','Max level reached',1,255,'Highest level reached by this character, not the server level cap.'],
  ['str','STR',0,1000000,'Strength from your character window.'],
  ['int','INT',0,1000000,'Intelligence from your character window.'],
  ['attackRate','Attack rate',0,1000000,'Attack / hit rate from your character window.']
]) field($('attacker-fields'),key,label,initial[key],min,max,'1',hint);
for(const name of ['physical','magical']) {
  const modeLabel=document.createElement('label');modeLabel.htmlFor=name+'-apMode';modeLabel.textContent='AP source';
  const mode=document.createElement('select');mode.id=name+'-apMode';
  for(const [value,text] of [['displayed','Character window (mastery included)'],['raw','Raw AP (mastery not included)']]){const option=document.createElement('option');option.value=value;option.textContent=text;mode.append(option);}
  $(name+'-fields').before(modeLabel,mode);
  mode.style.marginBottom='18px';
  for(const [key,label] of [['min','AP min'],['max','AP max'],['skillMin','Skill AP min'],['skillMax','Skill AP max'],['mastery','Mastery %'],['skillPercent','Skill damage %']])
    field($(name+'-fields'),name+'-'+key,label,initial[name][key],0,key==='mastery'?255:1000000,key==='mastery'?'1':'any');
}
for(const [key,label,value,min,max] of [
  ['targetLevel','Level',1,1,255],['parry','Parry rate (assumed; enter known value)',100,1,1000000],
  ['physical-defense','Physical defense',7,0,1000000],['magical-defense','Magical defense',10,0,1000000],
  ['physical-absorption','Physical absorption %',1,0,1000000],['magical-absorption','Magical absorption %',1,0,1000000]
]) field($('target-fields'),key,label,value,min,max,key==='targetLevel'?'1':'any');
const bonusNames=['Dress / Avatar','Premium','Devil','Balloon','Scroll','Other'];
bonusNames.forEach((name,i)=>{
  const row=document.createElement('div');row.className='bonus-row';
  const label=document.createElement('span');label.textContent=name;row.append(label);
  for(const channel of ['physical','magical']) {
    const wrapper=document.createElement('div');wrapper.className='field';
    const input=document.createElement('input');Object.assign(input,{id:`bonus-${channel}-${i}`,type:'number',min:'0',max:'1000000',step:'any',value:'0',required:true});
    input.setAttribute('aria-label',`${name} ${channel} bonus %`);wrapper.append(input);row.append(wrapper);fields.push(input.id);
  }
  $('bonus-fields').append(row);
});
function read() {
  if(!$('build').checkValidity()) throw new Error('Enter valid values in the highlighted fields.');
  const s=E.defaults(),v=id=>$(id).valueAsNumber;
  s.attackMode=$('attack-mode').value;s.weapon=$('weapon').value;s.basicPercent=v('basicPercent');s.targetRatio=v('targetRatio');
  for(const k of ['level','maxLevel','str','int','attackRate','targetLevel','parry'])s[k]=v(k);
  for(const name of ['physical','magical']) {
    s[name].enabled=$(name+'-enabled').checked;
    s[name].apMode=$(name+'-apMode').value;
    for(const k of ['min','max','skillMin','skillMax','mastery','skillPercent','defense','absorption']) s[name][k]=v(name+'-'+k);
    s[name].bonus=bonusNames.reduce((sum,_,i)=>sum+v(`bonus-${name}-${i}`),0);
    for(const k of ['classBonus','partyBonus','targetCoefficient','event','attackerMultiplier','targetMultiplier'])s[name][k]=v(name+'-'+k);
  }
  return E.validate(s);
}
function svg(tag,attrs,text) {const e=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;return e;}
function chart(result) {
  const el=$('chart');el.replaceChildren();
  const title=svg('title',{},`Normal damage distribution from ${format(result.count)} hits. Observed ${result.min} to ${result.max}.`);el.append(title);
  const binWidth=Math.max(1,Math.ceil((result.max-result.min+1)/45)),bins=new Map();
  for(const [damage,count] of result.histogram){const bin=Math.floor((damage-result.min)/binWidth);bins.set(bin,(bins.get(bin)||0)+count);}
  const numberOfBins=Math.floor((result.max-result.min)/binWidth)+1, peak=Math.max(...bins.values()),width=900/numberOfBins;
  for(let i=0;i<=4;i++){const y=230-i*48;el.append(svg('line',{x1:65,x2:965,y1:y,y2:y,stroke:'#343d31'}));el.append(svg('text',{x:55,y:y+4,'text-anchor':'end'},(peak/result.count*100*i/4).toFixed(1)+'%'));}
  for(const [i,count] of bins){const height=count/peak*192;const rect=svg('rect',{x:65+i*width+2,y:230-height,width:Math.max(1,width-4),height,rx:3,fill:'#d9b774'});const lo=result.min+i*binWidth,hi=Math.min(result.max,lo+binWidth-1);rect.append(svg('title',{},`${lo===hi?lo:lo+'–'+hi}: ${count} hits (${(count/result.count*100).toFixed(2)}%)`));el.append(rect);}
  const ticks=[...new Set([0,Math.floor((numberOfBins-1)/2),numberOfBins-1])];
  for(const i of ticks) el.append(svg('text',{x:65+(i+.5)*width,y:256,'text-anchor':'middle'},format(result.min+i*binWidth)));
  el.append(svg('text',{x:965,y:277,'text-anchor':'end'},'Normal damage'));
}
let count=10000,timer;
function syncAttack() {
  const basic=$('attack-mode').value==='basic';
  $('weapon').disabled=!basic;
  $('basicPercent').disabled=!basic || $('weapon').value!=='custom';
  for(const k of ['skillMin','skillMax','skillPercent'])$('physical-'+k).disabled=basic;
  const percent=E.basicSkills[$('weapon').value];
  $('attack-note').textContent=basic
    ? (percent===undefined?'Manual basic descriptor: provisional until verified against your default skill record.':`Normal attack descriptor: ${percent}% (user-confirmed DB record).`)
    : 'Active skill: uses your skill percentage only; no basic-attack multiplier.';
}
function update() {
  clearTimeout(timer);
  syncAttack();
  try {
    const s=read(),ranges=E.ranges(s),result=E.simulate(s,count);
    const b=E.balances(s);
    $('balance').textContent=`Physical balance ${(b.physical*100).toFixed(2)}% · Magical balance ${(b.magical*100).toFixed(2)}%`;
    $('bonus-total').textContent=`Total: physical +${s.physical.bonus}% · magical +${s.magical.bonus}%`;
    $('normal').textContent=`${format(ranges.normal.min)} – ${format(ranges.normal.max)}`;
    $('critical').textContent=`${format(ranges.critical.min)} – ${format(ranges.critical.max)}`;
    $('average').textContent=result.average.toFixed(2);
    $('average-note').textContent=`Normal hits · ${format(count)}-hit sample mean`;
    $('sample-note').textContent=`${format(count)} hits · observed ${format(result.min)}–${format(result.max)}`;
    chart(result);$('error').hidden=true;
    document.querySelectorAll('[data-count]').forEach(e=>{e.disabled=false;e.classList.toggle('active',Number(e.dataset.count)===count);e.setAttribute('aria-pressed',String(Number(e.dataset.count)===count));});
  } catch(error) {
    $('error').hidden=false;$('error').textContent=error.message;
    for(const id of ['normal','critical','average'])$(id).textContent='—';
    $('chart').replaceChildren();$('sample-note').textContent='';
    document.querySelectorAll('[data-count]').forEach(e=>e.disabled=true);
  }
}
$('build').addEventListener('submit',e=>e.preventDefault());
$('build').addEventListener('input',e=>{
  if($('target-fields').contains(e.target))$('target').value='custom';
  clearTimeout(timer);timer=setTimeout(update,120);
});
$('target').addEventListener('change',()=>{
  if($('target').value==='manyang') {
    for(const [key,value] of Object.entries({targetLevel:1,parry:100,'physical-defense':7,'magical-defense':10,'physical-absorption':1,'magical-absorption':1}))$(key).value=value;
  }else $('target-details').open=true;
  update();
});
document.querySelectorAll('[data-count]').forEach(button=>button.addEventListener('click',()=>{count=Number(button.dataset.count);update();}));
const resetValues=Object.fromEntries(fields.map(id=>[id,$(id).value]));
$('reset').addEventListener('click',()=>{for(const [id,value] of Object.entries(resetValues))$(id).value=value;for(const name of ['physical','magical'])$(name+'-apMode').value='displayed';$('attack-mode').value='basic';$('weapon').value='spear';$('physical-enabled').checked=true;$('magical-enabled').checked=false;$('target').value='manyang';$('target-details').open=false;count=10000;update();});
update();
