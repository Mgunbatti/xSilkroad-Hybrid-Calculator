const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const I=require('../i18n.js'),N=require('../skill-names.js'),D=require('../skill-names-data.js');
const root=path.join(__dirname,'..');
test('every shipped locale covers English messages and preserves interpolation parameters',()=>{
 const params=s=>[...s.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort();
 for(const locale of Object.keys(I.locales)){
  const pack=JSON.parse(fs.readFileSync(path.join(root,'locales',locale+'.json')));
  assert.deepEqual(Object.keys(pack).sort(),Object.keys(I.english).sort(),locale);
  for(const [key,value]of Object.entries(pack)){assert.equal(typeof value,'string');assert.ok(value.trim(),locale+': '+key);assert.deepEqual(params(value),params(I.english[key]),locale+': '+key);}
 }
 assert.deepEqual(I.english,require('../locales/en.json'));
 assert.deepEqual(I.english,require('../i18n-en.js'));
 assert.equal(I.direction('ar'),'rtl');assert.equal(I.direction('fa'),'rtl');assert.equal(I.direction('tr'),'ltr');
 assert.equal(I.t('available',{available:1,total:3}),'1 points available · 3 earned in total');
});
test('client names use exact catalogue name keys with explicit English and code fallback',()=>{
 assert.equal(N.resolve('SN_SKILL_CH_FIRE_GIGONGTA_E','ignored','en').name,'Cloud Fire force');
 assert.equal(N.resolve('SN_SKILL_CH_FIRE_GIGONGTA_E','ignored','vi').name,'Hỏa Viêm Quyết');
 assert.equal(N.resolve('SN_SKILL_CH_BOW_POWER_D','ignored','ko').name,'강궁시 의');
 assert.equal(N.resolve('SN_SKILL_CH_BOW_POWER_D','ignored','tr').status,'english');
 assert.equal(N.resolve('xxx','SKILL_UNVERIFIED','tr').name,'SKILL_UNVERIFIED');
 assert.equal(N.resolve('xxx','SKILL_UNVERIFIED','tr').status,'unverified');
 for(const entry of Object.values(D.entries)){
  assert.ok(D.source.sha256[entry.file]);assert.ok(entry.line>0);
  assert.ok(Object.values(entry.names).every(n=>n&&n!=='0'));
 }
 for(const file of ['chinese-skills.json','chinese-skills-vsro.json']){
  const catalogue=JSON.parse(fs.readFileSync(path.join(root,'data',file)));
  for(const [code,g]of Object.entries(catalogue.groups)){
   const result=N.resolve(g.nameKey,code,'en');
   assert.ok(result.name);assert.ok(result.entry||result.status==='unverified');
  }
 }
});
