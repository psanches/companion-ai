import {generateWeeklyDigest,getWeeklyDigest,newsWeekActive} from './health-news-week.mjs';
import {withLocalLocationTest} from './location-test-worker.mjs';
import {withBetaFeedback} from './beta-feedback-worker.mjs';
// LUMI_ATIVA_INTEGRATION_VERSION=1
import baseline from './ativa-baseline-runtime.mjs';
import {withCompanionChat} from './companion-chat.mjs';
import assets from './ativa-assets.mjs';
import {createLumiAtivaIntegration} from './ativa-factory.mjs';
import {createLumiResearchHandler} from './lumi-research-handler.mjs';
export * from './ativa-baseline-preserved.mjs';
import {withHealthNews} from './health-news-worker.mjs';
import {withCalendar} from './calendar-worker.mjs';
import {withFrontendVersion} from './frontend-version.mjs';
import release from './frontend-release.mjs';
import previous from './frontend-previous.mjs';
import {withConversationSidebar} from './conversation-worker.mjs';
import {withInstitutional} from './institutional-worker.mjs';
import institutional from './institutional-bundle.mjs';
const integrated=createLumiAtivaIntegration(baseline,assets,fetch,createLumiResearchHandler());
const companion=withCompanionChat(withHealthNews(integrated,generateWeeklyDigest,getWeeklyDigest,{live:true,active:newsWeekActive}));
const application=withBetaFeedback(withConversationSidebar(withCalendar(companion)));
export default withLocalLocationTest(withFrontendVersion(withInstitutional(application,institutional),release,previous));

