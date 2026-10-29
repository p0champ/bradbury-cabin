const assert=require('node:assert/strict');
const path=require('node:path');
module.exports=async function volumeChecks(browser,{mock,BASE_URL,out,passed}){
 for(const lying of (process.env.CABIN_AUDIO_ONLY ? [] : [false,true])){
  const p=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await mock(p,'layer',lying,{practised:true,headPointer:true,ambience:'rain',ambienceVolume:.75});
  await p.addInitScript(()=>{
   window.__ambienceNodes=[];
   const create=AudioContext.prototype.createBufferSource;
   AudioContext.prototype.createBufferSource=function(...args){
    const source=create.apply(this,args),connect=source.connect;
    source.connect=function(node,...rest){if(this.loop)__ambienceNodes.push({source:this,gain:node});return connect.call(this,node,...rest);};
    return source;
   };
  });
  await p.goto(BASE_URL);
  const slider=p.locator('#ambience-volume');
  assert.equal(await slider.inputValue(),'75');
  await slider.fill('37');await slider.dispatchEvent('input');
  assert.equal(await p.locator('#ambience-volume-value').textContent(),'37%');
  assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('cabin-controls')).ambienceVolume),.37);
  await p.locator('#enter:not([disabled])').click();await p.evaluate(()=>__center());
  await p.waitForFunction(()=>__ambienceNodes.length===1);
  const choose=async id=>{await p.evaluate(async id=>__navigate(id),id);await p.evaluate(()=>__pinch());};
  await p.evaluate(()=>__hold());await choose('volume');
  assert.equal(await p.locator('#page').getAttribute('data-menu-page'),'volume');
  // An immediate second native pinch must not change a level after opening.
  await p.evaluate(async()=>{await __aim('settings-volume:0');__hand(.05);__step(480);__hand(.012);__native('selectstart');__step(40);__hand(.05);__native('select');__native('selectend');__step(16);});
  assert.equal(await slider.inputValue(),'37','opening repeat guard');
  if(process.env.CABIN_GUARD_ONLY){await p.close();passed('valid repeat pinch inside 600ms cannot change volume');return;}
  await choose('settings-volume:25');
  assert.equal(await slider.inputValue(),'25');
  await p.waitForTimeout(250);
  assert.ok(Math.abs(await p.evaluate(()=>__ambienceNodes[0].gain.gain.value)-.25)<.001);
  await choose('settings-volume:0');await p.waitForTimeout(250);
  assert.equal(await p.locator('#ambience-volume-value').textContent(),'Off');
  assert.ok(Math.abs(await p.evaluate(()=>__ambienceNodes[0].gain.gain.value))<.00001);
  await choose('settings-volume:100');await p.waitForTimeout(250);
  assert.ok(Math.abs(await p.evaluate(()=>__ambienceNodes[0].gain.gain.value)-1)<.001);
  await choose('settings-volume:50');await choose('settings-volume:75');
  assert.equal(await p.evaluate(()=>__ambienceNodes.length),1,'volume never replaces the looping source');
  await p.locator('#page').screenshot({path:path.join(out,`volume-menu${lying?'-lying':''}.png`)});
  await p.evaluate(()=>{__step();__welcomeScene();});
  await p.locator('#welcome-scene').screenshot({path:path.join(out,`volume-native-${lying?'lying':'front'}.png`)});
  await p.evaluate(()=>{__mock.offsetX=.25;__step();__welcomeScene();});
  await p.locator('#welcome-scene').screenshot({path:path.join(out,`volume-native-${lying?'lying':'front'}-side.png`)});
  await p.evaluate(()=>{__mock.offsetX=0;__step();});
  await choose('settings-back');
  assert.equal(await p.locator('#page').getAttribute('data-menu-page'),'sound');
  await choose('settings-ambience:fire');
  await p.waitForFunction(()=>__ambienceNodes.length===2);
  await p.waitForTimeout(2100);
  assert.ok(Math.abs(await p.evaluate(()=>__ambienceNodes[1].gain.gain.value)-.75)<.001,'new sound uses remembered level');
  await choose('settings-ambience:room');await p.waitForFunction(()=>__ambienceNodes.length===3);
  await slider.fill('0');await slider.dispatchEvent('input');await p.waitForTimeout(250);
  assert.ok(Math.abs(await p.evaluate(()=>__ambienceNodes[2].gain.gain.value))<.00001);
  await slider.fill('50');await slider.dispatchEvent('input');await p.waitForTimeout(250);
  assert.ok(Math.abs(await p.evaluate(()=>__ambienceNodes[2].gain.gain.value)-.5)<.001);
  assert.equal(await p.evaluate(()=>__ambienceNodes.length),3);
  await p.evaluate(()=>__mock.session.end());
  await p.reload();
  assert.equal(await slider.inputValue(),'50');
  assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('cabin-controls')).ambience),'room');
  await p.locator('#enter:not([disabled])').click();await p.evaluate(()=>__center());
  await p.waitForFunction(()=>__ambienceNodes.length===1);await p.waitForTimeout(2100);
  assert.ok(Math.abs(await p.evaluate(()=>__ambienceNodes[0].gain.gain.value)-.5)<.001);
  assert.deepEqual(errors,[]);await p.close();
  passed('volume steps and slider apply live to all sounds without restarting; mute and reload preserve selection'+(lying?' lying':''));
 }
 {
  const p=await browser.newPage();await p.goto(BASE_URL);
  const ratios=await p.evaluate(async()=>{
   const {Ambience}=await import('./ambience.js?v=47');
   async function render(level){
    const context=new OfflineAudioContext(1,4*22050,22050),a=new Ambience();a.kind='rain';a.start(context,'rain');
    const suspension=context.suspend(2.5);const rendering=context.startRendering();
    await suspension;a.setVolume(context,level);await context.resume();
    return (await rendering).getChannelData(0);
   }
   const full=await render(1),quarter=await render(.25),muted=await render(0);
   let a=0,b=0,c=0;for(let i=3*22050;i<full.length;i++){a+=full[i]**2;b+=quarter[i]**2;c+=muted[i]**2;}
   // Gain must remain continuous at the scheduled mid-loop adjustment.
   let previous=null,maxChange=0,maxInfo=null;
   for(let i=2.45*22050|0;i<2.75*22050;i++)if(Math.abs(full[i])>.0001){const ratio=quarter[i]/full[i];if(previous!==null && Math.abs(ratio-previous)>maxChange){maxChange=Math.abs(ratio-previous);maxInfo={i,ratio,previous,full:full[i],quarter:quarter[i]};}previous=ratio;}
   return {quarter:Math.sqrt(b/a),muted:Math.sqrt(c/a),maxChange,maxInfo,samples:[2.45,2.49,2.5,2.51,2.6,2.68,2.75].map(t=>{const i=t*22050|0;return[t,quarter[i]/full[i]];})};
  });
  assert.ok(Math.abs(ratios.quarter-.25)<.0001,JSON.stringify(ratios));
  assert.equal(ratios.muted,0);
  assert.ok(ratios.maxChange<.01,'rendered envelope has no abrupt jump: '+JSON.stringify(ratios));
  await p.close();passed('real offline audio renders quarter amplitude, silence at Off and continuous gain changes');
 }
 {
  const p=await browser.newPage({viewport:{width:360,height:800}});await p.goto(BASE_URL);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await p.locator('#ambience-volume').focus();await p.keyboard.press('Home');
  assert.equal(await p.locator('#ambience-volume-value').textContent(),'Off');
  await p.keyboard.press('End');assert.equal(await p.locator('#ambience-volume-value').textContent(),'100%');
  await p.screenshot({path:path.join(out,'volume-start-mobile.png'),fullPage:true});
  await p.close();passed('start-page volume slider is keyboard accessible and fits mobile width');
 }
};
