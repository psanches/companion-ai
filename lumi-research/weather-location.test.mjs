import test from 'node:test';
import assert from 'node:assert/strict';
import {rememberedCity,requestedWeatherCity,resolveWeatherCity,weatherSearchLocation,hasCitySource} from './weather-location.mjs';
import {researchNow} from './research.mjs';

test('city memory handles natural language and common formats without including unrelated details',()=>{
 for(const memory of ['Cidade: Bauru, SP\nPRIVATE HEALTH','Moro em Bauru, SP. PRIVATE HEALTH','Localização registrada como Bauru, SP.','Location: Bauru, SP, Brazil','Cidade: Bauru (SP)'])assert.equal(rememberedCity(memory),'Bauru, SP',memory);
 assert.equal(rememberedCity('Localização da dor: braço. PRIVATE HEALTH'),null);
});
test('the observed residence-memory format resolves Bauru and excludes alternative future destinations',()=>{
 const memory='Local de residência: Bauru, São Paulo, Brasil\nOutras cidades mencionadas: Santos e Curitiba.';
 assert.equal(rememberedCity(memory),'Bauru, SP');
 const preference='So apresentar clima para esta cidade ou se for pedida outra cidade';
 assert.equal(requestedWeatherCity(preference),null);
 assert.equal(resolveWeatherCity(preference,[],memory),'Bauru, SP');
 assert.equal(resolveWeatherCity('Vai chover hoje?',[{role:'user',content:preference}],memory),'Bauru, SP');
});
test('the requested city overrides history and memory; user location history beats model suggestions',()=>{
 const history=[{role:'user',content:'Qual o clima em Bauru hoje?'},{role:'assistant',content:'São Paulo, Rio de Janeiro e Curitiba.'}];
 assert.equal(resolveWeatherCity('Vai chover hoje?',history,null),'Bauru');
 assert.equal(resolveWeatherCity('Vai chover em Santos amanhã?',history,'Cidade: Bauru, SP'),'Santos');
 assert.equal(resolveWeatherCity('Vai chover hoje?',[],'Cidade: Bauru, SP'),'Bauru, SP');
 assert.equal(resolveWeatherCity('Vai chover hoje?',[{role:'assistant',content:'Cidade: São Paulo, SP'}],null),null);
 assert.equal(requestedWeatherCity('Cidade da previsão: Bauru, SP\nPergunta anterior: Vai chover hoje?\nPergunta atual: Sim'),'Bauru, SP');
});
test('search receives the resolved city as structured location, without an assumed country for foreign places',()=>{
 assert.deepEqual(weatherSearchLocation('Bauru, SP'),{type:'approximate',city:'Bauru',region:'SP',country:'BR'});
 assert.deepEqual(weatherSearchLocation('London'),{type:'approximate',city:'London'});
 assert.equal(hasCitySource([{url:'https://example.org/bauruzinho',title:'Other'}],'Bauru'),false);
 assert.equal(hasCitySource([{url:'https://example.org/forecast/sao-paulo'}],'Bauru'),false);
 assert.equal(hasCitySource([{url:'https://example.org/forecast/558',title:'Previsão de Bauru, SP'}],'Bauru'),true);
});
test('other cities cannot pass as the requested Bauru forecast even with valid HTTPS citations',async()=>{
 for(const [text,sourceUrl] of [['São Paulo: chuva. Rio de Janeiro: sol.','https://example.org/forecast/sao-paulo'],['Bauru: chuva.','https://example.org/forecast/sao-paulo'],['Bauru: chuva.\n## Clima em Curitiba:\nSol.','https://example.org/forecast/bauru']]){
  let calls=0;
  const result=await researchNow({question:'Cidade da previsão: Bauru, SP\nVai chover hoje?',authorized:true,apiKey:'test',fetcher:async(url,options)=>{
   calls++;assert.deepEqual(JSON.parse(options.body).tools[0].user_location,{type:'approximate',city:'Bauru',region:'SP',country:'BR'});
   return Response.json({status:'completed',output:[{type:'web_search_call',status:'completed'},{content:[{type:'output_text',text,annotations:[{type:'url_citation',url:sourceUrl}]}]}]});
  }});
  assert.equal(calls,2);assert.equal(result.status,'unverified');assert.deepEqual(result.citations,[]);
 }
});
