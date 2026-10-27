import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {normalizeEmergencyPhone,emergencyLocation,emergencyDestinations,EMERGENCY_CONTACT_FRONTEND} from './emergency-contact.mjs';

test('SOS accepts Brazilian DDD and explicit international numbers without guessing a foreign country',()=>{
 assert.equal(normalizeEmergencyPhone('(11) 99999-0000'),'5511999990000');
 assert.equal(normalizeEmergencyPhone('11 3333-0000'),'551133330000');
 assert.equal(normalizeEmergencyPhone('+55 (11) 99999-0000'),'5511999990000');
 assert.equal(normalizeEmergencyPhone('+44 20 7946 0000'),'442079460000');
 for(const value of ['',null,'99999-0000','011999990000','11999990000<script>','+5511+999990000','+0123456789','+1234567890123456','tel:5511999990000','11999990000?text=other'])assert.equal(normalizeEmergencyPhone(value),null,String(value));
});

test('SOS destinations use the selected contact and a fixed message, without chat or location data',()=>{
 const links=emergencyDestinations('5511999990000'),url=new URL(links.whatsapp);
 assert.equal(url.origin,'https://wa.me');assert.equal(url.pathname,'/5511999990000');
 assert.equal(url.searchParams.get('text'),'Preciso de ajuda. Por favor, entre em contato comigo.');
 assert.equal(links.call,'tel:+5511999990000');
 assert.throws(()=>emergencyDestinations('123?text=other'));
});

test('packaged SOS script parses as classic JS and requires no new API or medical storage routes',()=>{
 new vm.Script(EMERGENCY_CONTACT_FRONTEND);
 assert.doesNotMatch(EMERGENCY_CONTACT_FRONTEND,/\bfetch\s*\(|XMLHttpRequest|sendBeacon|\/medical\/|\/profile\/medical|OPENAI/);
});

test('optional location message includes timestamp, accuracy and fixed map link in both languages',()=>{
 const location=emergencyLocation({coords:{latitude:-22,longitude:-49,accuracy:15},timestamp:Date.now()});
 for(const english of [false,true]){
  const result=emergencyDestinations('5511999990000',english,location);
  assert.equal(new URL(result.whatsapp).searchParams.get('text'),result.message);
  assert.equal(new URL(result.whatsapp).origin,'https://api.whatsapp.com');
  assert.equal(new URL(result.whatsapp).searchParams.get('phone'),'5511999990000');
  assert.match(result.message,/query=-22%2C-49/);assert.match(result.message,/15 m/);
  assert.match(result.message,english?/not live tracking/:/não é acompanhamento ao vivo/);
  assert.equal(result.call,'tel:+5511999990000');
 }
 for(const patch of [{latitude:91},{longitude:-181},{latitude:NaN},{accuracy:-1}])assert.throws(()=>emergencyLocation({coords:{...location,...patch},timestamp:Date.now()}));
 assert.throws(()=>emergencyLocation({coords:location,timestamp:Date.now()-120001}));
 assert.throws(()=>emergencyLocation({coords:location,timestamp:Date.now()+60000}));
});

