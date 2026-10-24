import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {normalizeEmergencyPhone,emergencyDestinations,EMERGENCY_CONTACT_FRONTEND} from './emergency-contact.mjs';

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
