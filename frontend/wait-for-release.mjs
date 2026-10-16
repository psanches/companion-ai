/** Poll release identity while Cloudflare converges; never accept an older UI. */
export async function waitForRelease(probe,{commit,release,attempts=45,pause=()=>new Promise(resolve=>setTimeout(resolve,1000))}){
 let last=null;
 for(let attempt=0;attempt<attempts;attempt++){
  try{last=await probe();if(last?.ok&&last.commit===commit&&last.release===release&&last.homeCommit===commit&&last.homeRelease===release)return last;}catch{last={ok:false};}
  if(attempt+1<attempts)await pause();
 }
 throw Error('Development release did not converge to the tested commit and asset manifest; rollback required. Last public identity: '+JSON.stringify(last));
}
