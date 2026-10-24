# SOS — development version

Authorized by Pedro on 2026-10-24 for lumi-develop only.

The main screen has two independent actions beneath the header. **Cuidador / SOS** opens a dialog containing
name/phone registration and editing. A saved contact exposes a WhatsApp link
with the fixed message “Preciso de ajuda. Por favor, entre em contato comigo.”,
a telephone link, and native sharing when supported.

The independent **SAMU · 192** link (`tel:192`) is directly on the main screen,
outside the caregiver dialog, and is available without caregiver registration
or signing in. Its accessible name identifies a call to SAMU 192 and its title
identifies the service as a medical emergency service in Brazil. The user completes the call in
the phone app; no automated call or WhatsApp to SAMU is made. The number and
free 24-hour service were checked on 2026-10-24 at the Ministry of Health:
https://www.gov.br/saude/pt-br/composicao/saes/samu-192

The user completes sending in the destination app. Lumi does not claim delivery,
read receipts, completed calls or caregiver acknowledgement. Opening SOS alone
does not contact anyone. Generic native sharing asks the user to choose the
recipient; the WhatsApp link targets the saved phone number.

Contact data stays in browser localStorage under a per-account key. It is not
sent to the Lumi server, AI, calendar, medical storage or analytics and is not
synchronized between devices. The dialog closes on sign-out or account change.
The device owner can still inspect local browser storage. Medical routes remain
blocked. No location or chat data is included in the message.

There is no new paid service, background task, automatic message, SMS, WhatsApp
Business API or AI call for this feature. Existing phone/data charges can apply.
No medication reminders are included in this deployment.

Validation: phone parsing and destination checks; DOM tests for account isolation,
sign-out, blocked storage and safe text rendering; existing integration/security
suites; browser flows at desktop and Android-sized viewports through the existing
deployment workflow. Browser tests inspect destinations without sending a message
or making a call. Real WhatsApp/phone handoff still requires testing on a device.
