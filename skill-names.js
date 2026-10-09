(function(root){
 'use strict';
 const data=typeof module==='object'&&module.exports?require('./skill-names-data.js'):root.SilkroadSkillNameData;
 function resolve(nameKey,code,locale){
  const entry=data.entries[nameKey],names=entry?.names;
  if(names?.[locale])return {name:names[locale],locale,status:'client',entry};
  if(names?.en)return {name:names.en,locale:'en',status:locale==='en'?'client':'english',entry};
  return {name:code,locale:'en',status:'unverified'};
 }
 function label(nameKey,code,locale,t){
  const value=resolve(nameKey,code,locale);
  // Isolates keep Latin codes/readable English names intact in RTL menus.
  if(value.status==='unverified')return t('unverified',{code:'\u2068'+code+'\u2069'});
  return '\u2068'+value.name+'\u2069'+(value.status==='english'?' · '+t('englishName'):'');
 }
 const api={resolve,label};if(typeof module==='object'&&module.exports)module.exports=api;else root.SilkroadSkillNames=api;
})(globalThis);
