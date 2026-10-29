// Development-only changes are applied to a separate runtime copy. The recovered
// baseline remains byte-for-byte preserved; every patch requires its known shape.
export function applyRuntimePolicy(source){
 const marker=/\b(?:const|let|var) instructions\s*=\s*`/g;
 const matches=[...source.matchAll(marker)];
 if(matches.length!==1||!source.includes('async function askOpenAI('))throw Error('Unrecognized baseline model instructions; refusing deployment');
 const start=matches[0].index+matches[0][0].length;
 const end=source.indexOf('`.trim();',start);
 if(end<start)throw Error('Unrecognized baseline instruction boundary; refusing deployment');
 let runtime="import {budgetedModelFetch} from './model-budget.mjs';\nimport {runtimeCompanionInstructions} from './companion-instructions.mjs';\n"+source.slice(0,end)+"`.trim() + '\\n\\n' + runtimeCompanionInstructions(new Date(), env.LUMI_RESPONSE_LANGUAGE);"+source.slice(end+'`.trim();'.length);
 const retention=/(function cleanMessages\(messages\) \{[\s\S]*?)\.slice\(-12\);(\s*\})/;
 if(!retention.test(runtime)||!runtime.includes('const input = cleanMessages(messages).map'))throw Error('Unrecognized history/context boundary; refusing deployment');
 runtime=runtime.replace(retention,'$1;$2').replace('const input = cleanMessages(messages).map','const input = cleanMessages(messages).slice(-12).map');
 const api=runtime.indexOf('const response = await fetch(',runtime.indexOf('async function askOpenAI('));
 if(api<0)throw Error('Unrecognized Responses transport; refusing deployment');
 const tail=runtime.slice(api);
 if(!tail.includes('model: env.OPENAI_MODEL || "gpt-5-mini",')||!tail.includes('method: "POST",'))throw Error('Unrecognized Responses options; refusing deployment');
 runtime=runtime.slice(0,api)+tail.replace('const response = await fetch(', 'const response = await budgetedModelFetch(env,userId,').replace('method: "POST",','method: "POST", signal: AbortSignal.timeout(60000),').replace('model: env.OPENAI_MODEL || "gpt-5-mini",','model: env.OPENAI_MODEL || "gpt-5-mini", max_output_tokens: 3200, store: false, ...(/^gpt-5/.test(env.OPENAI_MODEL || "gpt-5-mini")?{reasoning:{effort:"low"}}:{}),');
 runtime=runtime.replace(/error:\s*"A Lumi não conseguiu responder agora\."/, 'error: error?.code?.startsWith("LUMI_MODEL_") ? error.message : "A Lumi não conseguiu responder agora."').replace(/(error: error\?\.code\?\.startsWith\("LUMI_MODEL_"\)[\s\S]*?\},\s*)500,/, '$1error.status || 500,');
 return runtime;
}
