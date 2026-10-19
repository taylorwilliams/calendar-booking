# Cloudflare deployment

This guide separates ordinary settings from credentials. The commands are the same on macOS, Linux and Windows PowerShell unless noted.

Read the [prerequisites](../README.md#prerequisites) first. A working installation needs Cloudflare, Google and Microsoft accounts. Apple Calendar and Resend are optional.

## 1. Choose the public address and create the Cloudflare resources

1. Authenticate Wrangler with the Cloudflare account that will own the app: `npx wrangler login`.
2. Create a D1 database: `npx wrangler d1 create my-booking-calendar`.
3. Copy `wrangler.example.jsonc` to `wrangler.jsonc`.
4. Replace the Worker name and D1 database ID with your own values.
5. Choose one public HTTPS address:
   - **Free Cloudflare address:** leave `workers_dev` set to `true` and use `https://WORKER.ACCOUNT.workers.dev`, replacing the two names with your Worker name and Cloudflare Workers subdomain.
   - **Custom domain:** set `workers_dev` to `false`, uncomment `routes`, and replace `booking.example.com`. The domain and DNS zone must be available in the same Cloudflare account.
6. Create a [Turnstile widget](https://developers.cloudflare.com/turnstile/get-started/) for that hostname. Keep both the site key and secret key.
7. Run `npm run setup` and enter the exact deployed HTTPS address for `publicOrigin`, with no trailing slash.
8. Upload that configuration with `npm run config:push`.

`wrangler.jsonc`, `.booking-config.json`, `.dev.vars`, `.cloudflare-auth/` and `public/user/` are ignored by Git.

## 2. Create the Google OAuth app

1. Create or select a [Google Cloud project](https://console.cloud.google.com/projectcreate).
2. Enable the [Google Calendar API](https://console.cloud.google.com/apis/library/calendar-json.googleapis.com).
3. Configure the OAuth consent screen. Add `openid`, `email` and `https://www.googleapis.com/auth/calendar.events` to Data Access.
4. If the app is in Testing, add the Google account that will create Meet links as a test user.
5. Create an OAuth client with application type **Web application**.
6. Add the exact authorised redirect URI: `https://YOUR_HOST/api/integrations/google/callback`.
7. Keep the client ID and client secret for the next section.

An External Google OAuth app left in Testing issues a refresh token that expires after seven days when these Calendar permissions are used. Move the app to Production before relying on unattended bookings. A single-user installation may still show an unverified-app warning; only continue with an OAuth app that you created and control.

## 3. Create the Microsoft app registration

You need two separate things: the personal Outlook.com, Hotmail or Live account that owns the calendar, and access to your own Microsoft Entra tenant where the app registration lives. A personal account in the shared **Microsoft Services** tenant cannot create this registration; create or switch to a tenant you control first.

1. In the [Microsoft Entra admin centre](https://entra.microsoft.com/), open **App registrations** and create a registration.
2. Set **Supported account types** to **Personal Microsoft accounts only**, or another option that explicitly includes personal Microsoft accounts. Work-or-school-only registrations do not work with this app.
3. Add a **Web** redirect URI: `https://YOUR_HOST/api/integrations/microsoft/callback`.
4. Create a client secret and copy its **Value** when it is shown.
5. Under Microsoft Graph delegated permissions, add `User.Read` and `Calendars.ReadWrite`. The app also requests `offline_access` during sign-in so the connection can keep working.
6. Keep the application client ID, client secret and exact personal Microsoft email address for the next section.

Microsoft checks availability, writes the booking to this calendar and sends the attendee invitation. The Google event is used to create the Meet link; it does not send the invitation.

## 4. Add secrets

Use `npx wrangler secret put NAME --config wrangler.jsonc` for each value. Wrangler reads the value privately from the terminal.

Generate the two app-specific values locally. Run each command separately and store its output in a password manager:

```sh
node --input-type=module -e "import { randomBytes } from 'node:crypto'; console.log(randomBytes(32).toString('base64'))"
node --input-type=module -e "import { randomBytes } from 'node:crypto'; console.log(randomBytes(48).toString('base64'))"
```

Required for calendar connections:

- `CALENDAR_TOKEN_KEY` — the first generated value; it encrypts stored OAuth refresh tokens
- `CALENDAR_SETUP_KEY` — the second generated value; it protects the one-time connection pages

Google Meet creation:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Microsoft Outlook/Hotmail availability and invitations:

- `MICROSOFT_CLIENT_ID`
- `MICROSOFT_CLIENT_SECRET`
- `MICROSOFT_EXPECTED_ACCOUNT` — the one Microsoft email address allowed to connect

Apple/iCloud availability only:

- `APPLE_CALDAV_USERNAME`
- `APPLE_CALDAV_PASSWORD` — a revocable [Apple app-specific password](https://support.apple.com/en-gb/102654)

Apple is optional and read-only. Put the exact iCloud calendar display names in `appleCalendarNames`. Leave the Apple secrets unset if Apple availability is not needed.

Turnstile:

- `TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`

Optional Resend owner notification:

- `RESEND_API_KEY`
- `NOTIFICATION_FROM` — for example `Bookings <bookings@example.com>`
- `NOTIFICATION_TO`

Resend only sends a separate notification to the calendar owner. Microsoft sends the attendee invitation whether Resend is configured or not. The address or domain used by `NOTIFICATION_FROM` must be verified in Resend.

## 5. Migrate, verify, deploy and connect

```sh
npm run check
npm run db:migrate:cloudflare
npm run deploy:cloudflare
```

After the first deployment, visit each provider setup route on your public address and enter `CALENDAR_SETUP_KEY`:

- `/api/integrations/google/connect`
- `/api/integrations/microsoft/connect`

Sign in to the Google account that should create Meet links and the personal Microsoft account whose calendar should receive bookings. The Microsoft callback rejects any address other than `MICROSOFT_EXPECTED_ACCOUNT`.

Test availability, one complete booking, rescheduling and cancellation before sharing the URL.

## Updating safely

Run `npm audit --omit=dev` and `npm run check`, review migration files, take a D1 backup for schema changes, then deploy. Rotate any credential immediately if it is ever printed, pasted into an issue, or committed.
