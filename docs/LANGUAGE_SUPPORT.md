# Portuguese and English in Lumi Develop

The language selector appears in the app header before and after login and on
standalone app modules. Portuguese is the default. The choice is stored only in
this browser and applies across pages and subsequent visits on this origin.

Interface text uses a local translation dictionary with no translation API.
Main controls, sign-in, settings, caregiver SOS, feedback, calendar, voice status,
and Mind and Body activities support Portuguese and English. Dynamic controls
are translated without reloading or discarding drafts. Conversation history,
user-written reports, contact names, event titles, editable values and source
article content are preserved. News article text remains in its original
language and is described as such. Fictional medical sample record content
retains its original language; no real medical-data feature is unlocked.

The preference is passed as a whitelisted language header on existing
authenticated requests. The existing companion and research calls use it as a
default response-language instruction; an explicit request from the user can
override the response language. The preference is request scoped and does not
add a stored conversation message, change credentials, or create another AI
request. Existing API credentials and limits remain in use.

Dictation starts in pt-BR or en-US. Changing language stops ongoing dictation
without submitting text. Speech output uses the chosen language and available
device voices. Audio remains off by default. Availability of browser speech
recognition and installed voices depends on the device.

Caregiver messages are prepared in the chosen language. The SAMU action remains
the Brazilian service at tel:192 in both languages. Language does not change
emergency jurisdiction, time zone, or the established 24-hour calendar format.

This change is limited to the development application. The institutional site
has its own English and Portuguese pages and selector.
