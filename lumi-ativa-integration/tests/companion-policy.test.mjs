import test from 'node:test';
import assert from 'node:assert/strict';
import {LUMI_COMPANION_INSTRUCTIONS as p} from '../companion-instructions.mjs';
test('professional warmth without small talk',()=>{assert.match(p,/warm but professional/i);assert.match(p,/No water-cooler talk/i)});
test('facts and genuine memory',()=>{assert.match(p,/Facts first/i);assert.match(p,/Never invent facts, memories/i)});
test('news threshold and exclusions',()=>{assert.match(p,/7\/10/);assert.match(p,/Exclude tabloids/i)});
test('fictional medical separation',()=>assert.match(p,/fictional demonstration records/i));
