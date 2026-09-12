# Connecting this platform to Meta

Everything the platform operator does **once**, by hand, in Meta's dashboards.
Nothing here is per tenant: this platform is a Meta **Tech Provider**, so there
is one Meta app, one app secret and one webhook URL for every tenant that will
ever connect. A tenant is connected by subscribing this app to their WhatsApp
Business Account, never by giving them a webhook of their own.

Work through it in order. Steps 1 and 2 can take days and block everything
after them, so start them first.

---

## What you end up with

Five values, which go in `.env`:

| Variable | Where it comes from | Secret? |
| --- | --- | --- |
| `META_APP_ID` | Step 3 | No — the browser needs it |
| `META_APP_SECRET` | Step 3 | **Yes** |
| `META_WEBHOOK_VERIFY_TOKEN` | You choose it, step 5 | **Yes** |
| `META_CONFIG_ID` | Step 6 | No — the browser needs it |
| `WHATSAPP_TOKEN_ENCRYPTION_KEY` | You generate it, step 8 | **Yes** |

---

## 1. A Business Manager, verified

**business.facebook.com** → create a Business portfolio if you have none.

Then **Business settings → Business info → Start verification**. Meta asks for
documents proving the business exists: a certificate of incorporation, a
utility bill, a bank statement. The name and address must match the documents
exactly.

**This takes days, sometimes weeks.** Nothing below works without it, and a
tenant trying to connect an unverified business hits error `131005`, which the
connect screen explains as "Finish business verification in Meta Business
Settings".

## 2. Add a payment method

**Business settings → Payments → Add payment method.**

Conversations are charged to whoever owns the WABA. Without a payment method a
tenant's messages stop once the free tier is used, and they see error `131042`.

## 3. Create the app

**developers.facebook.com/apps → Create app.**

- Use case: **Other**
- Type: **Business**
- Business portfolio: the one from step 1

Then **App settings → Basic**:

- Copy **App ID** → `META_APP_ID`
- Click **Show** beside **App Secret**, copy it → `META_APP_SECRET`

> The app secret signs every webhook delivery. Anyone holding it can forge
> messages that this platform will accept as genuine. It goes in `.env` and
> nowhere else — never in the repository, never in the browser.

## 4. Add the WhatsApp product

**App dashboard → Add product → WhatsApp → Set up.**

Link it to the Business portfolio from step 1 when asked.

## 5. Point the webhook here

**App → WhatsApp → Configuration → Webhook → Edit.**

- **Callback URL**: `https://<your-host>/api/webhooks/whatsapp`
- **Verify token**: any string you choose. Put the same value in
  `META_WEBHOOK_VERIFY_TOKEN` **before** clicking Verify and save — Meta calls
  the URL immediately and the app must already know the token.

Meta sends a `GET` with `hub.challenge`; the route echoes it. A failure here is
almost always a token that does not match, or a URL that is not reachable from
the internet.

Then **Manage** the webhook fields and subscribe to:

| Field | Why |
| --- | --- |
| `messages` | Inbound customer messages **and** delivery receipts |
| `message_template_status_update` | Meta approving or rejecting a template |
| `account_update` | How a tenant learns their number was restricted or banned |

### Local development needs HTTPS

Meta refuses `FB.login` from an `http://` page and throws rather than calling
back, so the Connect button cannot work against plain `localhost:3000`. Run the
dev server with a self-signed certificate instead:

```bash
npm run dev:https        # https://localhost:3000
```

The first run downloads mkcert and generates the certificate; your browser will
warn about it once and let you proceed. The connect screen checks the protocol
before opening the popup and says this if you are on http.

Add `https://localhost:3000` to **App Domains** and **Valid OAuth Redirect
URIs** (step 6) or the popup will refuse to open.

### Testing before you have a public URL

The callback must be reachable from Meta. In development, tunnel it:

```bash
npx localtunnel --port 3000        # or ngrok http 3000
```

Use the tunnel's HTTPS URL as the callback. Or skip Meta entirely and drive the
endpoint yourself:

```bash
npm run whatsapp:simulate -- --verify        # the GET handshake
npm run whatsapp:simulate                    # a signed text message
npm run whatsapp:simulate -- --kind batch    # several entries and changes
npm run whatsapp:simulate -- --kind unsigned # a bad signature
```

The simulator signs with `META_APP_SECRET` exactly as Meta does, so a delivery
it sends is one Meta would have produced.

## 6. Embedded Signup

**App → Facebook Login for Business → Configurations → Create configuration.**

- Login variant: **WhatsApp Embedded Signup**
- Assets: WhatsApp Business Accounts and phone numbers
- Permissions: `whatsapp_business_management`, `whatsapp_business_messaging`

Copy the **Configuration ID** → `META_CONFIG_ID`.

Then **App settings → Basic → App Domains**, and under **Facebook Login for
Business → Settings**, add your host to **Valid OAuth Redirect URIs**. The
popup refuses to open from a domain Meta does not know.

## 7. Permissions and Tech Provider status

**App Review → Permissions and features**, request:

- `whatsapp_business_management`
- `whatsapp_business_messaging`
- `business_management`

Then **App → WhatsApp → Overview** and apply for **Tech Provider**. Until it is
granted you can connect your own test numbers but not other businesses'.

## 8. The token encryption key

Access tokens are stored encrypted. Generate a key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Put it in `WHATSAPP_TOKEN_ENCRYPTION_KEY` and **back it up somewhere other than
this repository**. Losing it makes every stored token unreadable and every
tenant has to reconnect.

Watch the file format: each variable must be on its own line. Appending with
`echo >>` to a file whose last line has no newline silently joins two values
together, and a joined value is then served wherever the first one is used.

## 9. Check it

```bash
npm run dev:https                     # Meta requires HTTPS for its popup
npm run dev:session -- northwind      # prints a cookie to paste in the console
```

Open **WhatsApp** in the workspace sidebar. With the five values set you should
see **Connect WhatsApp**; clicking it opens Meta's popup.

```bash
npm run verify:onboarding             # nonce minting, single use, tenant scoping
npm run db:diff                       # schema matches docs/db/master-db.sql
```

---

## What a tenant does

Nothing in this document. They open **WhatsApp** in their workspace, click
**Connect WhatsApp**, sign in to Meta in the popup, pick their business and
number, and enter their six-digit two-step PIN. The platform then exchanges the
code, verifies with Meta which account the token actually grants, registers the
number, subscribes this app to their WABA, and **reads that subscription back**
before calling the connection live.

That read-back is the difference between a tenant who thinks they are connected
and one who is.

## When it goes wrong

The connect screen turns Meta's error codes into sentences with an action. The
codes worth recognising:

| Code | Means |
| --- | --- |
| `131005` | Business verification is not finished — step 1 |
| `131042` | No payment method on the Meta account — step 2 |
| `133000` | The number is registered to another account already |
| `133005` | The two-step PIN did not match |
| `133010` | The number was never verified with Meta |
| `200` | The person connecting is not an admin of that WABA |
| `10` / `3` | App Review has not granted the permission — step 7 |

Anything unrecognised shows a plain fallback with the code kept visible, so
support has something to act on.
