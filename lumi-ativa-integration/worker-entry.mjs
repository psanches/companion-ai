// LUMI_ATIVA_INTEGRATION_VERSION=1
import baseline from './ativa-baseline-preserved.mjs';
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
export default withFrontendVersion(withInstitutional(withConversationSidebar(withCalendar(withHealthNews(createLumiAtivaIntegration(baseline,assets,fetch,createLumiResearchHandler())))),institutional),release,previous);
