import assert from 'node:assert/strict';
const origin='https://lumi-develop.psanchesnle.workers.dev';
const response=await fetch(origin+'/app.js',{cache:'no-store'});assert.equal(response.status,200);const script=await response.text();for(const term of ['lumiBetaFeedbackBtn','lumiOpenBetaFeedback','Relatar problema · Beta','Meus relatos'])assert.ok(script.includes(term),'Missing feedback UI: '+term);
for(const method of ['GET','POST']){const r=await fetch(origin+'/api/beta-feedback',{method,headers:{origin,'content-type':'application/json'},...(method==='POST'?{body:'{}'}:{})});assert.equal(r.status,401,'Feedback must require authentication');}
const foreign=await fetch(origin+'/api/beta-feedback',{method:'POST',headers:{origin:'https://foreign.example','content-type':'application/json'},body:'{}'});assert.equal(foreign.status,403);
console.log(JSON.stringify({betaFeedbackUI:true,anonymousReportsDenied:true,foreignOriginDenied:true,liveReportsCreated:0}));
