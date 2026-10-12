import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";
const branch=execFileSync("git",["branch","--show-current"],{encoding:"utf8"}).trim();
// Verify the actual checked-out branch, never a browser-supplied label.
const ref=branch;
if(ref!=="feature/medical-security-gates-20261012")
  throw Error("Deployment refused: exact medical security branch required");
const config=JSON.parse(readFileSync(new URL("./wrangler.staging.jsonc",import.meta.url),"utf8"));
if(config.name!=="lumi-medical-security-staging" || config.routes.length ||
   config.main!=="cloudflare-staging-entry.js")
  throw Error("Deployment refused: isolated staging target required");
