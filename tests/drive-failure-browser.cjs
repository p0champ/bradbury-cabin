const assert = require('node:assert/strict');
// Critic item 2: Drive and Google failures read as short, calm notes, never
// raw errors, and the next tap really retries.
module.exports = async (browser,{BASE_URL,passed}) => {
  const p=await browser.newPage(), errors=[];let gsiReachable=false, driveDown=true, writes=0;
  p.on('pageerror',e=>errors.push(e.message));
  await p.route('https://accounts.google.com/gsi/client',route=>gsiReachable
    ? route.fulfill({contentType:'text/javascript',body:'window.google={accounts:{oauth2:{initTokenClient:o=>({requestAccessToken:()=>setTimeout(()=>o.callback({access_token:"fake-token",expires_in:3600}),10)})}}};'})
    : route.abort());
  await p.route('https://www.googleapis.com/**',route=>{
    const req=route.request(),url=new URL(req.url());
    if(driveDown)return route.fulfill({status:503,body:'<html>Service Unavailable</html>'});
    const json=b=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(b)});
    if(req.method()!=='GET'){writes++;return json({id:'P'});}
    const q=url.searchParams.get('q')||'';
    if(q.includes("name = 'Bradbury Cabin'"))return json({files:[{id:'F',name:'Bradbury Cabin'}]});
    return json({files:[]});
  });
  await p.goto(BASE_URL);
  const status=()=>p.locator('#status').textContent();
  const sync=async()=>{await p.locator('#drive-sync:not([disabled])').click();await p.waitForFunction(()=>!document.querySelector('#drive-sync').disabled&&!/Syncing/.test(document.querySelector('#drive-sync').textContent));};
  const raw=/not defined|Google Drive error|\b\d{3}\b|TypeError|Failed to fetch|undefined/;
  // 1. Google sign-in cannot load.
  await sync();
  assert.match(await status(),/Couldn't reach Google sign-in/);
  assert.doesNotMatch(await status(),raw);
  // 2. Sign-in loads on the next tap, but Drive answers with a server error.
  gsiReachable=true;
  await sync();
  assert.match(await status(),/Google Drive didn't accept the request just now/,'the retry really loaded sign-in');
  assert.doesNotMatch(await status(),raw);
  assert.match(await status(),/Your readings are all here/);
  // 3. Drive is back: the same button now syncs.
  driveDown=false;
  await sync();
  assert.ok(writes>=1,'progress saved once Drive answers');
  assert.match(await status(),/Ask Claude for today's three|Today's three are ready/);
  assert.equal(await p.locator('#enter').isVisible(),true,'the entrance stays usable throughout');
  assert.deepEqual(errors,[]);await p.close();
  passed('Google sign-in and Drive failures show calm notes, keep reading available and retry on the next tap');
};
