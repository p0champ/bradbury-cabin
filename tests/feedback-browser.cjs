const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
module.exports=async(browser,{mock,BASE_URL,out,passed})=>{
 const {SOURCE_CATALOGUE:C}=await import(pathToFileURL(path.join(__dirname,'..','source-catalogue.js')).href);
 const excluded=['blake-sick-rose','whitman-astronomer','whitman-captain','ohenry-magi','chopin-desiree','bacon-studies','bacon-truth'];
 const works=['poem','story','essay'].map(k=>C.find(w=>w.kind===k&&!excluded.includes(w.id))),date='2026-10-30';
 const id=`today-${date}-poem-${works[0].id}`;
 const target=(p,id)=>p.evaluate(async id=>{await __aim(id,true);__pinch();__step(800);},id);
 async function setup(voice=false){
  const p=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await mock(p,'layer',false,{practised:true,headPointer:false,visits:4});await p.clock.setFixedTime(new Date(2026,9,30,20));
  await p.addInitScript(({works,date,voice})=>{
   if(!sessionStorage.getItem('feedback-seeded')){
    localStorage.setItem('cabin-today',JSON.stringify({version:2,date,picks:Object.fromEntries(works.map(w=>[w.kind,{catalogueId:w.id,selection:{mode:'explore'}}]))}));
    localStorage.setItem('cabin-progress',JSON.stringify({version:1,start:'2026-10-18',trackingSince:date,days:{[date]:{poem:true,ids:Object.fromEntries(works.map(w=>[w.kind,w.id])),picks:Object.fromEntries(works.map(w=>[w.kind,`${w.title} — ${w.author}`]))}},weeks:{},completedWorks:{[works[0].id]:'2026-10-30T10:00:00.000Z'}}));sessionStorage.setItem('feedback-seeded','1');
   }
   window.SpeechRecognition=undefined;window.webkitSpeechRecognition=undefined;
   if(voice)window.SpeechRecognition=class {constructor(){window.__speech=this;}start(){}stop(){this.onend?.();}abort(){this.aborted=true;}};
   window.__texts=[];const fill=CanvasRenderingContext2D.prototype.fillText;
   CanvasRenderingContext2D.prototype.fillText=function(t,...rest){if(this.canvas.id==='page')__texts.push(String(t));return fill.call(this,t,...rest);};
  },{works,date,voice});
  await p.goto(BASE_URL);await p.locator('#enter').click();await p.evaluate(()=>__center());return{p,errors};
 }
 {
  const {p,errors}=await setup();
  assert.ok(await p.evaluate(()=>__texts.some(t=>t.includes('introductory pick'))),'Why line rendered under picks');
  await p.locator('#page').screenshot({path:path.join(out,'personal-today.png')});
  await target(p,`home-feedback:${id}`);assert.equal(await p.locator('#page').getAttribute('data-menu-page'),'feedback');
  await target(p,'feedback-star:4');
  let saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('cabin-progress')));
  assert.equal(saved.feedback[works[0].id].stars.value,4);assert.equal(saved.feedback[works[1].id],undefined);
  await target(p,'feedback-speak');assert.ok(await p.evaluate(()=>__texts.some(t=>t.includes('Dictation is unavailable'))));
  await p.locator('#page').screenshot({path:path.join(out,'personal-closing-card.png')});
  await target(p,'feedback-type');await p.waitForFunction(()=>document.querySelector('#thought-editor').hidden===false);
  assert.match(await p.locator('#thought-title').textContent(),new RegExp(works[0].author));
  await p.locator('#thought-text').fill('I liked the quiet unease in this piece.');await p.locator('#thought-save').click();
  saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('cabin-progress')));assert.equal(saved.feedback[works[0].id].thought.value,'I liked the quiet unease in this piece.');
  await p.locator('#thought-editor').screenshot({path:path.join(out,'personal-browser-thought.png')});
  await p.reload();await p.locator('#enter').click();await p.evaluate(()=>__center());await target(p,`home-feedback:${id}`);
  assert.ok(await p.evaluate(()=>__texts.some(t=>t.includes('quiet unease'))));
  await target(p,'feedback-clear');saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('cabin-progress')));assert.equal(saved.feedback[works[0].id].thought.value,null);assert.equal(saved.feedback[works[0].id].stars.value,4);
  await target(p,'feedback-done');assert.equal(await p.locator('#page').getAttribute('data-menu-page'),'library');
  assert.deepEqual(errors,[]);passed('feedback: hand targets rate the exact work; unavailable voice leads to typed review, save, reload and removal');await p.close();
 }
 {
  const {p,errors}=await setup(true);await target(p,`home-feedback:${id}`);await target(p,'feedback-speak');
  await p.evaluate(()=>{__speech.onresult({results:[Object.assign([{transcript:'The final image stayed with me.'}],{isFinal:true})]});__speech.onend();});
  assert.equal(await p.evaluate(id=>JSON.parse(localStorage.getItem('cabin-progress')).feedback?.[id]?.thought,works[0].id),undefined,'speech must not save without approval');
  await target(p,'feedback-save');assert.equal(await p.evaluate(id=>JSON.parse(localStorage.getItem('cabin-progress')).feedback[id].thought.value,works[0].id),'The final image stayed with me.');
  await target(p,'feedback-star:5');
  await p.locator('#page').screenshot({path:path.join(out,'personal-thought-card.png')});
  await target(p,'feedback-speak');await target(p,'feedback-done');
  await p.evaluate(()=>__speech.onresult({results:[[{transcript:'late unwanted result'}]]}));
  assert.equal(await p.locator('#page').getAttribute('data-menu-page'),'library');
  assert.equal(await p.evaluate(id=>JSON.parse(localStorage.getItem('cabin-progress')).feedback[id].thought.value,works[0].id),'The final image stayed with me.');
  await target(p,`home-feedback:${id}`);await target(p,'feedback-speak');
  await p.evaluate(()=>{__texts=[];__speech.onresult({results:[Object.assign([{transcript:'W'.repeat(330)+' END.'}],{isFinal:true})]});__speech.onend();});
  assert.ok(await p.evaluate(()=>JSON.parse(document.querySelector('#page').dataset.buttons).some(b=>b.id==='feedback-next')),'a wide sentence must offer full transcript paging');
  assert.equal(await p.evaluate(()=>__texts.some(t=>t.includes('END.'))),false,'tail should be on the following thought page');
  for(let i=0;i<8;i++){
    if(!await p.evaluate(()=>JSON.parse(document.querySelector('#page').dataset.buttons).some(b=>b.id==='feedback-next')))break;
    await target(p,'feedback-next');
  }
  assert.ok(await p.evaluate(()=>__texts.some(t=>t.includes('END.'))),'tail of transcript must be available for review');
  await target(p,'feedback-save');assert.equal(await p.evaluate(id=>JSON.parse(localStorage.getItem('cabin-progress')).feedback[id].thought.value,works[0].id),'W'.repeat(330)+' END.');
  assert.deepEqual(errors,[]);passed('feedback: successful dictation requires explicit Save; closing the card cancels late results');await p.close();
 }
 {
  const p=await browser.newPage();await p.addInitScript(()=>{window.SpeechRecognition=undefined;window.webkitSpeechRecognition=undefined;});
  await p.goto(BASE_URL+'/voice-check.html');await p.locator('#dictate').click();assert.match(await p.locator('#dictation').textContent(),/unavailable/);assert.equal(await p.locator('#transcript').textContent(),'');
  passed('voice check: unsupported dictation is reported separately from microphone recording');await p.close();
 }
};
