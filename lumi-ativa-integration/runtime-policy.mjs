// Only the model instructions are extended. Authentication, KV and tools retain
// their original implementation. Packaging refuses an unknown baseline shape.
export function applyRuntimePolicy(source){
 const marker=/\b(?:const|let|var) instructions\s*=\s*`/g;
 const matches=[...source.matchAll(marker)];
 if(matches.length!==1||!source.includes('async function askOpenAI('))throw Error('Unrecognized baseline model instructions; refusing deployment');
 const start=matches[0].index+matches[0][0].length;
 const end=source.indexOf('`.trim();',start);
 if(end<start)throw Error('Unrecognized baseline instruction boundary; refusing deployment');
 return "import {runtimeCompanionInstructions} from './companion-instructions.mjs';\n"+source.slice(0,end)+"`.trim() + '\\n\\n' + runtimeCompanionInstructions();"+source.slice(end+'`.trim();'.length);
}
