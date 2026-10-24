# SOS — development version

Authorized by Pedro on 2026-10-24 for lumi-develop only.

The sidebar entry **SOS · Contato de emergência** opens a dialog containing
name/phone registration and editing. A saved contact exposes a WhatsApp link
with the fixed message “Preciso de ajuda. Por favor, entre em contato comigo.”,
a telephone link, and native sharing when supported.

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
