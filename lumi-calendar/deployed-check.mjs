import assert from 'node:assert/strict';
const origin='https://lumi-develop.psanchesnle.workers.dev';
const request=path=>fetch(origin+path+'?_calendar='+Date.now(),{cache:'no-store',headers:{'cache-control':'no-cache'},redirect:'error'});
let script;for(let n=0;n<15;n++){const r=await request('/app.js');if(r.ok&&r.headers.get('x-lumi-calendar')==='confirmed-events-v5'){script=await r.text();break;}await new Promise(r=>setTimeout(r,1000));}
assert.ok(script,'Calendar frontend did not propagate');assert.match(script,/lumiCreateCalendarEvent/);assert.match(script,/lumiResumeCalendarEvent/);assert.match(script,/showPicker/);assert.match(script,/Escolher data/);assert.match(script,/DD\/MM\/AAAA HH:MM/);assert.match(script,/Confirmar e criar evento/);assert.match(script,/const calendarRequest/);assert.doesNotMatch(script,/const scheduleMatch/,'Old unconfirmed write parser is still served');
for(const path of ['/calendar/events','/api/calendar/events','/calendar/events/prepare','/calendar/events/confirm','/api/auth/google/start']){
 const r=await fetch(origin+path,{method:'POST',headers:{origin,'content-type':'application/json'},body:'{}',redirect:'error'});assert.equal(r.status,401,'Anonymous request not denied: '+path);assert.equal((await r.json()).code,'AUTH');
}
const denied=await fetch(origin+'/calendar/events',{method:'POST',headers:{origin:'https://foreign.example','content-type':'application/json'},body:'{}'});assert.equal(denied.status,403);
const callback=await request('/api/auth/google/callback');assert.equal(callback.status,400);assert.equal((await callback.json()).code,'OAUTH');
console.log(JSON.stringify({calendarFrontend:'confirmed-events-v5',anonymousWritesDenied:true,foreignOriginDenied:true,invalidOAuthDenied:true,liveCalendarWrites:0,authenticatedGoogleFlow:'requires account owner sign-in, Google consent if needed, and explicit event confirmation'}));
