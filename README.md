# Personal Booking Calendar

A self-hosted booking page that checks multiple calendars, creates a video meeting, sends calendar invitations, and gives attendees private reschedule and cancellation links.

One person can run it without an admin dashboard. Settings live in one ignored JSON file, credentials stay in Cloudflare secrets, and the public repository contains only safe example values.

## Why this exists

Most booking services charge a monthly fee. This project covers the simpler case: one person needs a booking page, calendar checks, video links and private rescheduling.

The app itself can cost £0 to run within each provider’s free allowances:

- [Cloudflare Workers](https://developers.cloudflare.com/workers/platform/pricing/) hosts the app and [Cloudflare D1](https://developers.cloudflare.com/d1/platform/pricing/) stores bookings. Their free plans are ample for a small personal calendar.
- A personal Google account can create Meet links. [Google’s free meeting limits](https://support.google.com/meet/answer/7317473?hl=en-uk) allow one-to-one calls for up to 24 hours and group calls with three or more people for up to 60 minutes, so the included 30- and 60-minute meeting types fit within the free service.
- Microsoft Graph and Apple CalDAV check the calendars you already use. Microsoft also sends the calendar invitation.
- Resend owner notifications are optional. The booking and calendar invitation still work without them.

You still need the relevant provider accounts, and a custom domain has its own registration cost. Free-service limits and terms can change, so check them before deploying a high-traffic calendar.

## What it does

- 30- and 60-minute booking links, including fixed `/30` and `/60` routes
- browser-local time display with scheduling rules in your configured timezone
- Microsoft Outlook/Hotmail calendar availability and invitations
- Google Meet creation through Google Calendar
- optional Apple/iCloud availability across selected calendars
- private cancellation and rescheduling links
- Cloudflare Turnstile bot protection and D1 storage
- optional Resend notifications to the calendar owner
- configurable working hours, notice period, rates, branding and social preview

## Quick start

Requirements: Node.js 22+, npm, a Cloudflare account and Wrangler authentication.

```sh
npm ci
npm run setup
npm run dev
```

`npm run setup` asks a few plain-English questions and creates two private files:

- `.booking-config.json` — the reusable settings for your booking page
- `.dev.vars` — the local runtime copy

Both files are ignored by Git. A safe example is available in [`booking.config.example.json`](booking.config.example.json).

## Deploying

The app runs on Cloudflare Workers with D1. Copy `wrangler.example.jsonc` to `wrangler.jsonc`, add your own account/database/domain details, then follow [the deployment guide](docs/DEPLOYMENT.md).

The short version is:

```sh
npm run config:push
npm run db:migrate:cloudflare
npm run deploy:cloudflare
```

Never put OAuth secrets, app-specific passwords, encryption keys or API keys into the JSON config or `wrangler.jsonc`. Add them as encrypted Worker secrets.

## Configuration

These are the main settings:

| Setting | Purpose |
| --- | --- |
| `name`, `firstName` | Names shown on the public and management pages |
| `publicOrigin` | The exact HTTPS URL of the deployed site |
| `timezone`, `timezoneLabel` | Scheduling timezone and visitor-facing label |
| `workingDays`, `workingHours` | When bookings may start |
| `minimumNoticeMinutes` | How soon someone may book |
| `maximumAdvanceDays` | How far ahead the calendar opens |
| `meetingDurations` | Available lengths and labels |
| `appleCalendarNames` | iCloud calendars used for availability only |
| `rates` | Optional informational rates shown with `?rates=true` |
| `branding` | Local paths for the avatar, social image and favicon |

Put personal artwork under `public/user/`; that folder is ignored. Point your private configuration to paths such as `/user/avatar.png`. The repository ships with a neutral placeholder.

## Security

The public availability API returns timestamps only. Calendar titles and event details stay server-side. OAuth refresh tokens are encrypted before D1 storage, booking-management tokens are stored as hashes, calendar failures fail closed, and booking writes require same-origin requests plus Turnstile.

Run the complete local verification before deploying:

```sh
npm run check
npm audit --omit=dev
```

See [SECURITY.md](SECURITY.md) for deployment responsibilities and private vulnerability reporting.

Product copy follows the [clear operational language guide](docs/CONTENT_STYLE.md).

## Licence

MIT — see [LICENSE](LICENSE).
