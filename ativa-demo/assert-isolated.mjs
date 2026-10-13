import fs from 'node:fs';
import assert from 'node:assert/strict';
const c=JSON.parse(fs.readFileSync(new URL('./wrangler.jsonc',import.meta.url)));
assert.equal(c.name,'lumi-ativa-medical-demo');assert.equal(c.main,'worker.js');assert.equal(c.assets.directory,'./public');assert.equal(c.vars.DEMO_MODE,'synthetic-only');
for(const k of ['routes','kv_namespaces','r2_buckets','services'])assert.equal(c[k],undefined);
console.log('Isolated demo configuration verified.');
