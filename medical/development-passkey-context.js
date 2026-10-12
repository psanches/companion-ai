// Trusted development origins only. Production cannot enroll through this adapter.
const contexts=new Map([
  ["https://dev.mylumicompanion.com",{origin:"https://dev.mylumicompanion.com",rpID:"mylumicompanion.com"}],
  ["https://lumi-medical-security-staging.psanchesnle.workers.dev",{
    origin:"https://lumi-medical-security-staging.psanchesnle.workers.dev",
    rpID:"lumi-medical-security-staging.psanchesnle.workers.dev"
  }]
]);
export function getDevelopmentPasskeyContext(origin) {
  const context=contexts.get(origin);
  return context?{...context}:null;
}
