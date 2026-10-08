/* RefSkill catalogue lookup, independent from the recovered damage core. */
(function(root){
 'use strict';
 const FIELDS=['id','skillLevel','requiredMasteryLevel','flags','primaryDamagePercent','powerMin','powerMax','secondaryPercent'];
 function sourceGroups(data){if(!data||data.schemaVersion!==1||!data.groups)throw new Error('Unsupported skill catalogue');return data.groups;}
 function availableLevels(data,group,masteryLevel){
  const g=sourceGroups(data)[group]; if(!g)return [];
  if(!Number.isInteger(masteryLevel)||masteryLevel<0) return [];
  return g.levels.filter(row=>row[2]<=masteryLevel).slice().sort((a,b)=>a[1]-b[1]);
 }
 function select(data,group,masteryLevel,skillLevel){
  const g=sourceGroups(data)[group],levels=availableLevels(data,group,masteryLevel);
  if(!g||!levels.length)return null;
  const row=skillLevel==null?levels[levels.length-1]:levels.find(r=>r[1]===Number(skillLevel));
  if(!row)return null;
  const fields=Object.fromEntries(FIELDS.map((key,i)=>[key,row[i]]));
  return {...fields,group,kind:g.kind,family:g.family};
 }
 function groups(data,kind,family,masteryLevel){
  return Object.entries(sourceGroups(data))
   .filter(([key,g])=>g.kind===kind&&(!family||g.family===family)&&availableLevels(data,key,masteryLevel).length>0)
   .map(([group,g])=>({group,kind:g.kind,family:g.family,groupId:g.groupId,
     max:select(data,group,masteryLevel)}))
   .sort((a,b)=>a.group.localeCompare(b.group));
 }
 const api={FIELDS,availableLevels,select,groups};
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.SilkroadSkillCatalog=api;
})(globalThis);
