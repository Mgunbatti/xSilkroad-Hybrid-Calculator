const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createServer}=require('node:http');
const {createReadStream}=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const artifactDir=process.env.UI_ARTIFACT_DIR||require('node:os').tmpdir();
const root=path.resolve(__dirname,'../..');
// Serve JSON catalogues over HTTP: browsers don't allow file:// fetch().
async function startFixtureServer(){
 const server=createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost/').pathname;
  const safe=path.resolve(root,'.'+decodeURIComponent(pathname));
  if(!safe.startsWith(root+path.sep)&&safe!==root){res.writeHead(403).end();return;}
  const file=safe===root?path.join(root,'index.html'):safe;
  const ext=path.extname(file);
  res.setHeader('Content-Type',({'.json':'application/json','.js':'text/javascript','.css':'text/css','.html':'text/html'})[ext]||'application/octet-stream');
  const stream=createReadStream(file);
  stream.on('error',()=>{if(!res.headersSent)res.writeHead(404);res.end();});
  stream.pipe(res);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 return {server,url:'http://127.0.0.1:'+server.address().port+'/'};
}
test('browser: five results, preserved manual inputs, mastery errors, reset and mobile layout',async()=>{
 const fixture=await startFixtureServer();
 const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'chrome'});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(fixture.url);
  await page.waitForFunction(()=>document.querySelector('#physicalSkill-group')?.value==='SKILL_CH_BOW_POWER_D' && document.querySelector('#imbue-group')?.value==='SKILL_CH_FIRE_GIGONGTA_E');
  await page.locator('#customize').evaluate(e=>e.open=true);
  await page.locator('#weapon-details').evaluate(e=>e.open=true);
  assert.equal(await page.locator('#physicalMin').inputValue(),'3012');
  assert.equal(await page.locator('#physicalMax').inputValue(),'3012');
  assert.equal(await page.locator('#magicalMin').inputValue(),'2638');
  assert.equal(await page.locator('#magicalMax').inputValue(),'2638');
  assert.equal(await page.locator('#nuke-group').inputValue(),'SKILL_CH_FIRE_GIGONGSUL_F');
  assert.match(await page.locator('#quick-results').innerText(),/Normal \+ Imbue/);
  assert.equal(await page.locator('#error').isVisible(),false);
  assert.equal(await page.locator('#quick-results .damage').count(),6);
  // Visible character inputs appear in natural user order, not buried in Advanced.
  assert.equal(await page.locator('#bonusSTR').count(),1);
  assert.equal(await page.locator('#bonusINT').count(),1);
  assert.equal(await page.locator('#character-ap-heading').innerText(),'Character Attack Power');
  assert.equal(await page.locator('#apMode').inputValue(),'displayed');
  assert.equal(await page.locator('#mastery-physical').inputValue(),'100');
  assert.equal(await page.locator('#mastery-imbue').inputValue(),'100');
  assert.equal(await page.locator('#mastery-nuke').inputValue(),'100');
  assert.equal(await page.locator('#imbueMode').count(),0);
  assert.equal(await page.locator('#normalSecondary').count(),0);
  assert.equal(await page.locator('#skillSecondary').count(),0);
  assert.equal(await page.locator('#secondary-fields').count(),0);
  const inputsInOrder=await page.evaluate(()=>{
   const ids=['strPoints','bonusSTR','bonusINT','physicalMin','physicalMax','magicalMin','magicalMax'];
   const fields=ids.map(id=>document.getElementById(id));
   return fields.every((el,i)=>i===0||Boolean(fields[i-1].compareDocumentPosition(el)&Node.DOCUMENT_POSITION_FOLLOWING));
  });
  assert.equal(inputsInOrder,true);

  // Magical-only nuke cards never have a physical critical component.
  assert.equal(await page.locator('#quick-results .damage').filter({hasText:'Nuke + Imbue'}).locator('small').count(),0);
  assert.equal(await page.locator('#quick-results .damage').filter({hasText:'Nuke'}).locator('small').count(),0);
  assert.equal(await page.locator('body').innerText().then(s=>/Mastery %|Attack rate \(distribution\)|Target parry|Copper Sword|Normal attack multiplier/.test(s)),false);
  await page.locator('#level').fill('52');
  for(const k of ['physical','imbue','nuke'])assert.equal(await page.locator('#mastery-'+k).inputValue(),'52');
  // A deliberately lower learned mastery is preserved on level changes;
  // otherwise it tracks the character level automatically.
  await page.locator('#mastery-imbue').fill('40');
  await page.locator('#level').fill('53');
  assert.equal(await page.locator('#mastery-physical').inputValue(),'53');
  assert.equal(await page.locator('#mastery-nuke').inputValue(),'53');
  assert.equal(await page.locator('#mastery-imbue').inputValue(),'40');
  await page.locator('#level').fill('52');
  await page.locator('#mastery-imbue').fill('52');
  await page.locator('[data-ratio="1"]').click();
  await page.locator('#apMode').selectOption('displayed');
  await page.locator('#weapon').selectOption('spear');
  // Switch from catalogue selection to explicit manual testing.
  for(const k of ['physicalSkill','imbue','nuke'])await page.locator('#'+k+'-group').selectOption('');
  for(const [id,value] of Object.entries({bonusSTR:77,bonusINT:77,physicalMin:1315,physicalMax:1568,magicalMin:1041,magicalMax:1207,'mastery-physical':52,'mastery-imbue':52,'mastery-nuke':40,'imbue-min':187,'imbue-max':312,'physicalSkill-min':574,'physicalSkill-max':777,'physicalSkill-rate':350,'nuke-min':123,'nuke-max':205,'nuke-rate':250}))await page.locator('#'+id).fill(String(value));
  // Skills are included automatically when configured; no Include checkboxes.
  for(const key of ['imbue','physicalSkill','nuke'])assert.equal(await page.locator('#'+key+'-enabled').count(),0);
  await page.waitForFunction(()=>document.querySelector('#quick-results').textContent.includes('4,952'));
  assert.equal(await page.locator('#error').isVisible(),false);
  const results=await page.locator('#quick-results').innerText();
  assert.match(results,/2,782/);assert.match(results,/4,952/);assert.match(results,/7,734/);
  assert.equal(await page.locator('#quick-results .damage').filter({hasText:'Nuke + Imbue'}).locator('small').count(),0);
  assert.equal(await page.locator('#quick-results .damage').filter({hasText:'Nuke'}).locator('small').count(),0);
  const compareText=await page.locator('#comparison').innerText();
  assert.doesNotMatch(compareText,/Nuke(?: \+ Imbue)? critical/i);
  const values=await page.locator('#hybrid-form input').evaluateAll(es=>es.map(e=>[e.id,e.value,e.checked]));
  for(const weapon of ['bow','sword','spear'])await page.locator('#weapon').selectOption(weapon);
  assert.deepEqual(await page.locator('#hybrid-form input').evaluateAll(es=>es.map(e=>[e.id,e.value,e.checked])),values);
  await page.locator('#mastery-imbue').fill('53');
  await page.waitForFunction(()=>!document.querySelector('#error').hidden);
  assert.match(await page.locator('#error').innerText(),/mastery level/);
  await page.locator('#mastery-imbue').fill('52');
  await page.waitForFunction(()=>document.querySelector('#error').hidden);
  await page.screenshot({path:path.join(artifactDir,'hybrid-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:path.join(artifactDir,'hybrid-mobile.png'),fullPage:true});
  await page.locator('#reset').click();
  assert.equal(await page.locator('#physicalMin').inputValue(),'3012');
  await page.waitForFunction(()=>document.querySelector('#imbue-group')?.value==='SKILL_CH_FIRE_GIGONGTA_E');
  assert.equal(await page.locator('#imbue-max').inputValue(),'1520');
  assert.equal(await page.locator('#mastery-nuke').inputValue(),'100');
  assert.equal(await page.locator('#error').isVisible(),false);
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise(resolve=>fixture.server.close(resolve));}
});
