// LUMI_ATIVA_INTEGRATION_VERSION=1
import baseline from './ativa-baseline-preserved.mjs';
import assets from './ativa-assets.mjs';
import {createLumiAtivaIntegration} from './ativa-factory.mjs';
import {createLumiResearchHandler} from './lumi-research-handler.mjs';
export * from './ativa-baseline-preserved.mjs';
import {withHealthNews} from './health-news-worker.mjs';
export default withHealthNews(createLumiAtivaIntegration(baseline,assets,fetch,createLumiResearchHandler()));
