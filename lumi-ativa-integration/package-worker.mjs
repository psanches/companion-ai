import fs from 'node:fs';
const files = {
  'worker.js': './worker-entry.mjs',
  'ativa-factory.mjs': './factory.mjs',
  'ativa-assets.mjs': './assets.generated.mjs',
  'lumi-research-handler.mjs': '../lumi-research/handler.mjs',
  'route.mjs': '../lumi-research/route.mjs',
  'research.mjs': '../lumi-research/research.mjs',
  'supabase-auth.mjs': '../lumi-research/supabase-auth.mjs',
  'health-news-worker.mjs': './health-news-worker.mjs',
  'health-news-daily.mjs': '../health-news-daily.mjs',
  'health-news-verification.mjs': '../health-news-verification.mjs'
};
export function packageWorker(original) {
  return [{name:'ativa-baseline-preserved.mjs',type:original.type,bytes:original.bytes},
    ...Object.entries(files).map(([name,path]) => ({name,
      type:'application/javascript+module',bytes:fs.readFileSync(new URL(path,import.meta.url))}))];
}
