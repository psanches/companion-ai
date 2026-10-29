const encoder=new TextEncoder(),json=(body,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store'}});
export async function internalBudget(request,env){
 if(request.method!=='POST'||!env.BUDGET||typeof env.LUMI_INTERNAL_BUDGET_SECRET!=='string'||env.LUMI_INTERNAL_BUDGET_SECRET.length<32)return json({allowed:false},503);
 const length=Number(request.headers.get('content-length')||0);if(length>1024)return json({allowed:false},413);
 let raw='';try{const reader=request.body.getReader();let size=0;for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1024){await reader.cancel();return json({allowed:false},413);}raw+=new TextDecoder().decode(value);} }catch{return json({allowed:false},400);}
 const sig=request.headers.get('x-lumi-budget-signature')||'';if(!/^[a-f0-9]{64}$/.test(sig))return json({allowed:false},401);
 const key=await crypto.subtle.importKey('raw',encoder.encode(env.LUMI_INTERNAL_BUDGET_SECRET),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 if(!await crypto.subtle.verify('HMAC',key,Uint8Array.from(sig.match(/../g),x=>parseInt(x,16)),encoder.encode(raw)))return json({allowed:false},401);
 let body;try{body=JSON.parse(raw);}catch{return json({allowed:false},400);}
 if(!Number.isFinite(body.timestamp)||Math.abs(Date.now()-body.timestamp)>30000)return json({allowed:false},401);
 if(body.kind==='health')return json({allowed:true,service:'lumi-model-budget-v1'});
 if(!/^[a-f0-9]{64}$/.test(body.owner||'')||! /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(body.id||'')||!Number.isSafeInteger(body.tokens)||body.tokens<1||body.tokens>68736)return json({allowed:false},400);
 return env.BUDGET.get(env.BUDGET.idFromName('lumi-interactive-model-budget')).fetch(new Request('https://budget.internal',{method:'POST',body:JSON.stringify({...body,kind:'interactive-model'})}));
}
export async function reserveInteractiveBudget(state,body,now=Date.now()){
 const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now)),minute=Math.floor(now/60000);let allowed=false,reason='';
 await state.storage.transaction(async tx=>{
  const previous=await tx.get('interactive-budget'),current=previous?.day===day?previous:{day,tokens:0,calls:0,owners:{},requests:{}};
  if(current.requests[body.id]){allowed=true;return;}
  const user=current.owners[body.owner]||{calls:0,minute,count:0};if(user.minute!==minute){user.minute=minute;user.count=0;}
  if(current.tokens+body.tokens>1000000)reason='daily-tokens';else if(current.calls>=200)reason='daily-global-calls';else if(user.calls>=100)reason='daily-user-calls';else if(user.count>=15)reason='minute-user-calls';else{
   current.tokens+=body.tokens;current.calls++;user.calls++;user.count++;current.owners[body.owner]=user;current.requests[body.id]=true;await tx.put('interactive-budget',current);allowed=true;
  }
 });
 return json({allowed,...(reason?{reason}:{})},allowed?200:429);
}
