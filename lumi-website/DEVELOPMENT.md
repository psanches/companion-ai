# Institutional presentation in the development application

The existing application remains at https://lumi-develop.psanchesnle.workers.dev/.
The sidebar's **Sobre a Lumi** link opens Portuguese at `/sobre/pt/`; English is available at `/sobre/` with a visible language selector. Both institutional contact addresses are active and use the same mailbox.

The presentation source is copied from the independently reviewed institutional preview commit `f0249793f550d5a619a24d17f2565a3fd7311f6d`. The build prefixes all local resources with `/sobre/`. An exact-host wrapper serves only these development paths and delegates all application routes and scheduled handlers unchanged. It adds no bindings, secrets or authentication dependencies. Public pages revalidate; fingerprinted assets are immutable. There is no institutional service worker, form or analytics.

The protected application pipeline packages both bundles, checks their deployed bytes and tested commit, preserves existing modules/configuration and verifies production source remains unchanged. Institutional verification failures use the pipeline's existing automatic rollback. The prior development version is `f12481b1-5727-45e5-8775-b254af19a7e9`; restore that version through development Worker version history if manual recovery is needed. Do not run the production Wrangler configuration.

Validation: four institutional routing/resource/cache/delegation contracts supplement the existing regression suite. All five simulated desktop/mobile browser viewports now check the sidebar entry, both languages, email actions and overflow. These are Chromium simulations, not actual Android hardware or a real Google authentication round trip.

## Future public routing (not applied)

The owner selected `mylumicompanion.com` for this institutional site and `app.mylumicompanion.com` for the interactive application. Production publication requires separate explicit authorization. Before migration, validate the application at its new origin, authentication redirect allowlists and Google Calendar callbacks, account/history access, origin-specific sessions/storage, CORS, PWA/service worker scope and links. Capture current Worker version, custom-domain routing and configuration before any switch. Publish the application subdomain first, then the public site; retain the previous production version and domain configuration for rollback. Email DNS must remain untouched. This development integration changes neither public domain nor production Worker.
