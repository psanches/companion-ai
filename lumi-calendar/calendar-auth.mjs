// Calendar-specific error classification. Identity always comes from Supabase Auth.
export class CalendarAuthError extends Error{constructor(code,reason){super(code);this.code=code;this.reason=reason;}}
const reject=(code,reason)=>{throw new CalendarAuthError(code,reason);};
export function calendarAuthConfig(env){
 const url=typeof env?.SUPABASE_URL==='string'?env.SUPABASE_URL.trim().replace(/\/+$/,''):'',key=typeof env?.SUPABASE_PUBLISHABLE_KEY==='string'?env.SUPABASE_PUBLISHABLE_KEY.trim():'';
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url))reject('AUTH_CONFIG','PROJECT_URL');
 let keyKind='publishable';
 if(!key.startsWith('sb_publishable_')){try{const parts=key.split('.');if(parts.length!==3)throw Error();const payload=JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/')));if(payload.role!=='anon')throw Error();keyKind='legacy-anon';}catch{reject('AUTH_CONFIG','PUBLIC_KEY_FORMAT');}}
 return {url,key,keyKind};
}
export function createCalendarVerifier({fetcher=fetch}={}){
 return async(token,env)=>{
  if(typeof token!=='string'||token.length<10||token.length>8192)return null;
  const {url,key,keyKind}=calendarAuthConfig(env);let response;
  try{response=await fetcher(url+'/auth/v1/user',{method:'GET',headers:{apikey:key,authorization:'Bearer '+token},redirect:'error',signal:AbortSignal.timeout(7000)});}catch{reject('AUTH_SERVICE','CONNECTION');}
  if(!response.ok){let data={};try{data=await response.json();}catch{}
   // Do not return upstream messages, tokens, e-mail addresses or key values.
   if(/invalid api key|no api key|api key.*(?:invalid|revoked|missing)/i.test(String(data.message||data.msg||data.error_description||'')))reject('AUTH_CONFIG','PUBLIC_KEY_REJECTED');
   if(response.status===429||response.status>=500)reject('AUTH_SERVICE','UPSTREAM_UNAVAILABLE');
   if([401,403].includes(response.status))reject('AUTH',keyKind==='legacy-anon'?'SESSION_REJECTED_LEGACY_PUBLIC_KEY':'SESSION_REJECTED_PUBLISHABLE_KEY');
   reject('AUTH_SERVICE','UPSTREAM_RESPONSE');
  }
  let user;try{user=await response.json();}catch{reject('AUTH_SERVICE','INVALID_RESPONSE');}
  if(typeof user?.id!=='string'||!user.id)reject('AUTH_SERVICE','MISSING_VERIFIED_USER');
  return {id:user.id};
 };
}
