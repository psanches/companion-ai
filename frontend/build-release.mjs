import {DOCTORAL_RESEARCH} from '../companion-science/doctoral-research.mjs';
import {TOPICS,SOURCES,VERSION,CHECKED,searchTopics,normalize} from '../companion-science/catalog.mjs';
import {installScience} from '../companion-science/interface.mjs';
import {patchVoiceInput} from './voice-input.mjs';
import {BETA_FEEDBACK_FRONTEND} from '../lumi-beta/feedback-frontend.mjs';
import {EMERGENCY_CONTACT_FRONTEND} from './emergency-contact.mjs';
import {installLumiLanguage} from './language.mjs';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {patchCalendarApp} from '../lumi-calendar/calendar-frontend.mjs';
import {NEWS_SCRIPT,NEWS_CSS} from '../lumi-ativa-integration/health-news-ui-assets.mjs';
const hash=text=>createHash('sha256').update(text).digest('hex');
export function buildRelease(assets){
 const files={};
 const scienceScript=';(()=>{const normalize='+normalize.toString()+';('+installScience.toString()+')('+JSON.stringify({topics:TOPICS,sources:SOURCES,version:VERSION,checked:CHECKED,research:DOCTORAL_RESEARCH})+','+searchTopics.toString()+');})();';
 for(const [path,asset]of Object.entries(assets))if(path.startsWith('/lumi-original/')&&/\.(js|css)$/.test(path)&&!path.endsWith('/sw.js'))files[path.replace('/lumi-original','')]=asset;
 files['/app.js']={...files['/app.js'],content:patchVoiceInput(patchCalendarApp(files['/app.js'].content))+BETA_FEEDBACK_FRONTEND+EMERGENCY_CONTACT_FRONTEND};
 for(const [name,content,type]of [['/health-news-ui.js',NEWS_SCRIPT,'application/javascript; charset=utf-8'],['/health-news-ui.css',NEWS_CSS,'text/css; charset=utf-8'],['/experience.js',fs.readFileSync(new URL('./experience.js',import.meta.url),'utf8')+scienceScript,'application/javascript; charset=utf-8'],['/experience.css',fs.readFileSync(new URL('./experience.css',import.meta.url),'utf8')+'\n'+fs.readFileSync(new URL('../companion-science/style.css',import.meta.url),'utf8'),'text/css; charset=utf-8']])files[name]={content,type,encoding:'utf8'};
 files['/supabase.js']={content:fs.readFileSync(new URL('./vendor/supabase-2.118.0.js',import.meta.url),'utf8'),type:'application/javascript; charset=utf-8',encoding:'utf8'};
 const translations=JSON.parse(fs.readFileSync(new URL('./translations.json',import.meta.url),'utf8'));
 files['/language.js']={content:'('+installLumiLanguage.toString()+')('+JSON.stringify(translations)+');',type:'application/javascript; charset=utf-8',encoding:'utf8'};
 files['/language.css']={content:fs.readFileSync(new URL('./language.css',import.meta.url),'utf8'),type:'text/css; charset=utf-8',encoding:'utf8'};
 const routes={},immutable={};
 for(const [name,asset]of Object.entries(files)){const path='/_assets/'+hash(asset.content)+name;routes[name]=path;immutable[path]=asset;}
 const commit=process.env.GITHUB_SHA||process.env.LUMI_SOURCE_COMMIT||'local';
 const release=hash(JSON.stringify({assets,routes,commit}));
 const assetsSha256=hash('export default '+JSON.stringify(assets)+';\n');
 const result={release,commit,assetsSha256,routes,immutable};
 fs.writeFileSync(new URL('./release.generated.mjs',import.meta.url),'export default '+JSON.stringify(result)+';\n');
 fs.writeFileSync(new URL('./previous.generated.mjs',import.meta.url),'export default {};\n');
 return result;
}
