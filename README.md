# Farm Manager

Family farm records in Zambian kwacha (ZMW), with independent email/password accounts, a shared PostgreSQL database, and offline entries that sync while the app is open.

## What is included

- Sales, customer balances, stock receipts/usage/spoilage, and automatic stock deductions
- Animal health records and follow-up dates
- Expenses, workers, tasks, attendance, and wages linked to expenses
- Owner account plus single-use family invitations (24-hour expiry)
- Device-local pending entries, duplicate-operation protection, and explicit conflict review
- JSON backups, with restore into an empty shared farm only

All invited members can view and add farm records. Only the owner can create invitations or restore a backup. There is no public registration or dependency on a ChatGPT login.

## Deploy on Render — free testing setup

1. Sign in to [Render](https://dashboard.render.com).
2. Select **New → Blueprint** and connect `salimupashi20-ai/Farm-Management-System`, branch `main`.
3. Review `render.yaml`. It creates a **free Node web service** and a **free PostgreSQL database**, both in Frankfurt. Confirm both plans are Free before deploying.
4. When the service is live, open its `onrender.com` address.
5. In the Render web service's Environment settings, reveal the generated `SETUP_KEY`. Keep it private; do not paste it into GitHub, chat, or an issue.
6. Use **First-time setup** in the farm app. Enter that key and create your own owner email/password account. Owner setup can only succeed once.
7. In **Account**, create a separate invitation for each parent. Give each parent the site address and their invitation code. They select **Use invitation** and create their own password.

Render's free database expires after 30 days, and free web services sleep after 15 minutes without traffic. This configuration is for testing, not permanent farm records. Export backups and upgrade or migrate before the database expires. See [Render's free-plan documentation](https://render.com/docs/free).

No secrets are committed. Render supplies `DATABASE_URL` using its database binding and generates `SETUP_KEY`. `APP_ORIGIN` may optionally be set to the exact public origin (for example `https://your-service.onrender.com`, without a trailing slash) if you use a custom domain. Production requires HTTPS and uses Secure, HttpOnly, SameSite cookies.

The `.openai/hosting.json` file is retained only to identify the older Sites prototype. Render ignores it. The old hosted prototype has not been updated by these changes.

## Run on the iMac for development

Requires Node 24. In this directory:

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:3000`. The local development database is in `.local-data/database`; the first-time setup key is in `.local-data/setup-key`. Both are excluded from Git. This development server binds only to the local computer and is not a family-wide hosting service.

Production uses a real PostgreSQL service:

```sh
npm ci --omit=dev
npm start
```

Set `DATABASE_URL`, `SETUP_KEY` (32+ characters), and `NODE_ENV=production` in your hosting environment. `PORT` is provided by Render. The schema is created automatically on startup.

## Offline use and syncing

Open the app and sign in while online before relying on it offline. Each device stores its last shared snapshot and pending entries in IndexedDB. The app shell is cached by a service worker. Sync runs on reconnect, every 30 seconds while visible, or with **Sync now**.

A pending sale is provisional. The server checks the latest shared stock in a transaction. If two devices sell more than remains, the later sale is flagged for review; it does not overwrite stock or silently disappear. Export a backup before discarding a rejected pending entry, then re-enter any corrected record. Retrying the same operation does not count it twice. Task edits also detect stale values.

Use offline access only on trusted personal devices: browser storage is not encrypted by the app and an offline copy cannot be remotely revoked. Signing out requires pending entries to be resolved and an online connection, then clears this app's local workspace. Browser data clearing can destroy unsynced entries. Do not rely on background sync while the app is closed. Modern Safari/Chrome with IndexedDB, service workers, and Web Locks are required.

On iPhone, open the deployed HTTPS site in Safari and use Share → Add to Home Screen after signing in. Real iPhone and Android installation/offline tests remain to be done; desktop-browser offline reload and reconnect have been checked.

## Backups and migration

Use **Export backup** regularly. Export from the old prototype before switching: a new domain cannot read its browser storage. The owner can use **Restore into empty farm** to import the old version-1 export or a fully synced version-2 backup. Restore refuses to replace a farm that already has shared entries. Pending version-2 entries must be synced on their original device before restoration. Keep all original backup files; restored legacy snapshots retain record balances but do not reconstruct the original audit trail of payments.

There is no self-service forgotten-password email or member-removal screen yet. Keep the owner password in a password manager. Password changes are available in Account and invalidate that user's existing sessions. Recovery or revocation currently requires the database administrator; do not use this trial for sensitive production personnel records until those administration flows are added.

## Verification

```sh
npm test
```

Tests run the server and SQL schema against PGlite (embedded PostgreSQL) and check access control, owner bootstrap, one-time invitations, duplicate operations, stock conflicts, payment limits, task conflicts, wages, logout, and backup validation. Deployment to Render and hardware-specific mobile testing must be verified separately.
