import fs from 'node:fs';
import {applyRuntimePolicy} from './runtime-policy.mjs';
const files = {
  'model-budget.mjs': './model-budget.mjs',
  'personal-memory.mjs': './personal-memory.mjs',
  'health-news-week.mjs': '../health-news-week.mjs',
  'health-news-preview.mjs': '../health-news-preview.mjs',
  'location-test-worker.mjs': './location-test-worker.mjs',
  'companion-instructions.mjs': './companion-instructions.mjs',
  'companion-chat.mjs': './companion-chat.mjs',
  'beta-feedback-worker.mjs': '../lumi-beta/feedback-worker.mjs',
  'worker.js': './worker-entry.mjs',
  'frontend-version.mjs': '../frontend/version-worker.mjs',
  'institutional-worker.mjs': '../lumi-website/development-wrapper.mjs',
  'institutional-bundle.mjs': '../lumi-website/bundle.generated.mjs',
  'conversation-worker.mjs': '../frontend/conversation-worker.mjs',
  'frontend-release.mjs': '../frontend/release.generated.mjs',
  'frontend-previous.mjs': '../frontend/previous.generated.mjs',
  'calendar-conversation.mjs': '../lumi-calendar/calendar-conversation.mjs',
  'calendar.mjs': '../lumi-calendar/calendar.mjs',
  'calendar-auth.mjs': '../lumi-calendar/calendar-auth.mjs',
  'calendar-conflicts.mjs': '../lumi-calendar/calendar-conflicts.mjs',
  'calendar-worker.mjs': '../lumi-calendar/calendar-worker.mjs',
  'calendar-frontend.mjs': '../lumi-calendar/calendar-frontend.mjs',
  'calendar-week-frontend.mjs': '../lumi-calendar/calendar-week-frontend.mjs',
  'ativa-factory.mjs': './factory.mjs',
  'ativa-assets.mjs': './assets.generated.mjs',
  'lumi-research-handler.mjs': '../lumi-research/handler.mjs',
  'route.mjs': '../lumi-research/route.mjs',
  'research.mjs': '../lumi-research/research.mjs',
  'weather-location.mjs': '../lumi-research/weather-location.mjs',
  'supabase-auth.mjs': '../lumi-research/supabase-auth.mjs',
  'health-news-worker.mjs': './health-news-worker.mjs',
  'health-news-ui-assets.mjs': './health-news-ui-assets.mjs',
  'health-news-daily.mjs': '../health-news-daily.mjs',
  'health-news-verification.mjs': '../health-news-verification.mjs'
};
export function packageWorker(original) {
  return [{name:'ativa-baseline-preserved.mjs',type:original.type,bytes:original.bytes},
    {name:'ativa-baseline-runtime.mjs',type:original.type,bytes:Buffer.from(applyRuntimePolicy(original.bytes.toString('utf8')))},
    ...Object.entries(files).map(([name,path]) => ({name,
      type:'application/javascript+module',bytes:name==='beta-feedback-worker.mjs'?Buffer.from(fs.readFileSync(new URL(path,import.meta.url),'utf8').replaceAll('../lumi-calendar/','./')):Buffer.from(fs.readFileSync(new URL(path,import.meta.url),'utf8').replaceAll('../lumi-ativa-integration/','./').replaceAll('../lumi-calendar/','./').replaceAll('../lumi-research/handler.mjs','./lumi-research-handler.mjs').replaceAll('../lumi-research/','./'))}))];
}


