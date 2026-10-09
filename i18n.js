/* Presentation only. Calculation inputs, IDs and catalogue data are never localized. */
(function(root){
 'use strict';
 const locales={en:'English',tr:'Türkçe',ar:'العربية',fa:'فارسی',vi:'Tiếng Việt',th:'ไทย',id:'Bahasa Indonesia',ru:'Русский','pt-BR':'Português (Brasil)',es:'Español',de:'Deutsch',fr:'Français',pl:'Polski',ro:'Română',ko:'한국어','zh-CN':'简体中文'};
 const english=typeof module==='object'&&module.exports?require('./locales/en.json'):root.SilkroadEnglish;
 const cache={en:english};let locale='en',messages=english,sequence=0;
 const has=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
 function t(key,params={}){
  const template=has(messages,key)&&typeof messages[key]==='string'?messages[key]:has(english,key)?english[key]:String(key);
  return template.replace(/\{(\w+)\}/g,(match,name)=>has(params,name)?String(params[name]):match);
 }
 function number(value){return Number(value).toLocaleString(locale==='en'?'en-US':locale,{maximumFractionDigits:2});}
 function direction(code){return ['ar','fa'].includes(code)?'rtl':'ltr';}
 function apply(){
  document.documentElement.lang=locale;document.documentElement.dir=direction(locale);
  document.querySelectorAll('[data-i18n]').forEach(el=>{el.textContent=t(el.dataset.i18n);});
  document.querySelectorAll('[data-i18n-aria]').forEach(el=>el.setAttribute('aria-label',t(el.dataset.i18nAria)));
  document.title='xSilkroad · '+t('brand');
  document.querySelector('meta[name="description"]').content=t('intro');
  document.getElementById('language').value=locale;
  root.dispatchEvent(new Event('languagechange'));
 }
 async function setLocale(code,{persist=true}={}){
  const request=++sequence;code=has(locales,code)?code:'en';
  let failed=false;
  try{
   if(!cache[code]){
    const response=await fetch('locales/'+code+'.json');if(!response.ok)throw Error('locale');
    const data=await response.json();if(!data||Array.isArray(data)||typeof data!=='object')throw Error('locale');
    cache[code]=data;
   }
  }catch(_){code='en';failed=true;}
  if(request!==sequence)return false;
  locale=code;messages=cache[code];apply();
  if(persist&&!failed){try{localStorage.setItem('xsilkroad.locale',code);}catch(_){/* Private browsing can disable storage. */}}
  const status=document.getElementById('language-status');
  status.textContent=failed?t('loadingError'):'';status.hidden=!failed;
  return !failed;
 }
 function init(){
  const select=document.getElementById('language');
  for(const [code,label]of Object.entries(locales)){const o=document.createElement('option');o.value=code;o.lang=code;o.textContent=label;select.append(o);}
  const status=document.createElement('p');status.id='language-status';status.setAttribute('role','status');status.hidden=true;select.parentElement.append(status);
  select.addEventListener('change',()=>setLocale(select.value));
  let saved='en';try{saved=localStorage.getItem('xsilkroad.locale')||'en';}catch(_){}
  apply();return setLocale(saved,{persist:false});
 }
 const fieldAliases={Level:'level','Unspent points':'unspentPoints','Allocated STR points':'allocatedSTR','Devil HP/MP rate':'devilRate','physical mastery level':'physicalMastery','imbue mastery level':'imbueMastery','nuke mastery level':'nukeMastery','physical damage bonus':'physicalBonus','magical damage bonus':'magicalBonus'};
 function fieldName(name){
  if(has(fieldAliases,name))return t(fieldAliases[name]);
  if(has(english,name))return t(name);
  const key=Object.keys(english).find(key=>english[key]===name);if(key)return t(key);
  const m=name.match(/^(physicalSkill|imbue|nuke) (min|max|rate)$/);
  return m?t(m[1])+' · '+t({min:'skillMin',max:'skillMax',rate:'skillRate'}[m[2]]):name;
 }
 function error(message){
  let m=message.match(/^(.+) must be between (.+) and (.+)\.$/);
  if(m)return t('rangeError',{field:fieldName(m[1]),low:number(m[2]),high:number(m[3])});
  m=message.match(/^(.+) must be a whole number\.$/);if(m)return t('integerError',{field:fieldName(m[1])});
  m=message.match(/^(physicalSkill|imbue|nuke): min exceeds max\.$/);
  if(m)return t('minMaxError',{field:t(m[1])});
  if(message==='Minimum weapon value cannot exceed maximum.')return t('minMaxError',{field:t('weaponAP')});
  // Unexpected internal errors get a localized actionable message, not raw implementation text.
  return locale==='en'?message:t('invalid');
 }
 const api={t,number,direction,error,init,setLocale,locales,get locale(){return locale;},english};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.SilkroadI18n=api;
})(globalThis);
