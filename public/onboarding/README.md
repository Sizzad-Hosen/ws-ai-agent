# Onboarding screenshots

The connect wizard renders a labelled placeholder box wherever one of these
belongs, so the page is laid out for the real images from the first commit and
nothing shifts when they arrive.

Drop a PNG in with the exact name below and swap `ScreenshotSlot` for `next/image`
in `src/features/tenant-whatsapp/components/wizard/wizard-shell.tsx`.

| File | What it should show |
| --- | --- |
| `02-create-app.png` | developers.facebook.com, My Apps, the Create App button |
| `02-use-case.png` | The use case chooser, with "Connect with customers through WhatsApp" selected |
| `03-api-setup.png` | WhatsApp > API Setup, with Phone number ID and WhatsApp Business Account ID visible |
| `04-webhook-fields.png` | WhatsApp > Configuration, Webhook fields, the Subscribe button beside `messages` |

Blur or replace any real token, phone number or business name before committing
one of these.
