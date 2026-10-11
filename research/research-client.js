// Add to the authenticated development frontend; no automatic calls.
async function lumiResearch(question){
 const response=await authFetch(`${WORKER_URL}research`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question})});
 const data=await response.json();
 if(!response.ok)throw Error(data.error||'Pesquisa indisponível.');
 return data;
}
