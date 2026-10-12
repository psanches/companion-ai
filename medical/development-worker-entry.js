import baseline from "./recovered-development-baseline.js";
import {createDevelopmentMedicalWorker} from "./development-worker-integration.js";
export {MedicalPasskeyStore} from "./development-worker-integration.js";
export default createDevelopmentMedicalWorker(baseline);
