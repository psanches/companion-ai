using Workerd = import "/workerd/workerd.capnp";
const config :Workerd.Config = (
 services = [(name = "news-validation", worker = (
  compatibilityDate = "2026-10-06",
  modules = [
   (name = "runtime-test.mjs", esModule = embed "runtime-test.mjs"),
   (name = "runtime-fixtures.mjs", esModule = embed "runtime-fixtures.mjs"),
   (name = "health-news-verification.mjs", esModule = embed "health-news-verification.mjs"),
   (name = "health-news-daily.mjs", esModule = embed "health-news-daily.mjs"),
   (name = "health-news-worker.mjs", esModule = embed "health-news-worker.mjs"),
   (name = "health-news-ui-assets.mjs", esModule = embed "health-news-ui-assets.mjs")
  ]
 ))]
);
