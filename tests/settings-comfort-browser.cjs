const assert = require('node:assert/strict');
const path = require('node:path');
// Critic 7: "Move page here" and Comfort are on the first Settings page.
// Comfort's Back returns to where it was opened; leaving stays on the ✕.
module.exports = async (browser,{mock,BASE_URL,out,passed}) => {
  const p=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await mock(p,'layer',false,{practised:true,headPointer:true,visits:4});
  const page=()=>p.locator('#page').getAttribute('data-menu-page');
  const ids=()=>p.evaluate(()=>JSON.parse(document.querySelector('#page').dataset.buttons).map(b=>b.id));
  const target=id=>p.evaluate(async id=>{await __aim(id);__pinch();__step(800);},id);
  await p.goto(BASE_URL);await p.locator('#enter:not([disabled])').click();await p.evaluate(()=>__center());
  if(await p.locator('#page').getAttribute('data-view')==='reading')await p.evaluate(()=>__hold());
  await p.evaluate(()=>__step(700));
  await target('home-settings');
  assert.equal(await page(),'settings');
  const first=await ids();
  assert.ok(first.includes('settings-move')&&first.includes('settings-comfort')&&first.includes('settings-more'),'one pinch to Move page here and Comfort: '+first);
  assert.ok(first.includes('global-exit'),'the corner ✕ still leaves the cabin');
  await p.locator('#page').screenshot({path:path.join(out,'settings-first-page.png')});
  await target('settings-comfort');
  assert.equal(await page(),'comfort');
  assert.ok((await ids()).includes('settings-dim'),'focus dim is on Comfort');
  await target('settings-back');
  assert.equal(await page(),'settings','Back from Comfort returns to the first page it came from');
  await target('settings-more');await target('settings-comfort');await target('settings-back');
  assert.equal(await page(),'more','Back from Comfort opened in More returns to More');
  await target('settings-back');
  assert.equal(await page(),'settings');
  const placed=await p.evaluate(()=>__mock.placed.length);
  await target('settings-move');
  await p.evaluate(()=>__step(1500));
  assert.ok(await p.evaluate(n=>__mock.placed.length>n,placed),'Move page here re-places the page from the first Settings page');
  assert.deepEqual(errors,[]);await p.close();
  passed('Settings first page reaches Move page here and Comfort in one pinch; Back returns where it came from');
};
