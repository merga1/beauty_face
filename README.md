# Beauty Face

Beauty Face is an Ethiopia-focused cosmetics storefront and skin-safety platform. This repository starts the web MVP with **React**, **Node.js/Express**, and **PostgreSQL**. The interface is responsive and designed for mobile-first use.

## What is in the first build

- Browse and filter a sample cosmetics catalog.
- Add items to a browser-session cart and submit an order.
- Initiate Chapa hosted checkout from the server when a Chapa test key is configured.
- Verify payment server-side and accept signed, idempotent Chapa payment webhooks.
- Request a consultation callback using encrypted contact details. This is a pilot waitlist, not a live medical service.
- Manage products, suppliers, clinicians, riders, orders, customers, callback requests, safety reports, articles, delivery settings, and administrator accounts from a protected `/admin` workspace.
- Review administrator actions in an audit log. Customer contact, delivery details, rider phone numbers, license numbers, callback contacts, and safety reports are encrypted before storage.
- Review the product requirements, system design, API list, AI plan, MVP roadmap, safety risks, and Addis Ababa/Adama launch plan in `docs/`.

The catalog rows are illustrative demo listings. They are not endorsements, EFDA approvals, or verified stock. Camera analysis, diagnosis, prescription, live chat/video, a rider-facing app, and customer sign-in are not implemented. Admin order fulfillment and rider assignment are available in the admin workspace.

## Requirements

- Node.js 22.12 or newer (or 20.19 or newer) and npm.
- PostgreSQL 15 or newer.
- A 32-byte base64 key for encrypting customer contact and delivery details.
- Optional Chapa **test** private key and webhook secret for checkout integration.

## Local setup (PowerShell)

1. Create a local PostgreSQL database named `beauty_face`.
2. Copy `.env.example` to `.env` and set `DATABASE_URL`, `PII_ENCRYPTION_KEY`, and `WEB_ORIGIN`. Keep `.env` out of source control.
3. Apply both database migrations in order. The first creates the store tables and sample catalog; the second adds the admin console, customer records, delivery settings, rider assignments, articles, and safety reports.

   ```powershell
   Get-Content .\database\migrations\001_initial_schema.sql | psql $env:DATABASE_URL
   Get-Content .\database\migrations\002_admin_console.sql | psql $env:DATABASE_URL
   ```

4. Set `ADMIN_BOOTSTRAP_EMAIL`, `ADMIN_BOOTSTRAP_NAME`, and a unique `ADMIN_BOOTSTRAP_PASSWORD` of at least 14 characters in the server environment. Create the first administrator once, then remove the bootstrap password from that environment:

   ```powershell
   npm run admin:bootstrap
   ```

   Sign in at `http://localhost:5173/admin`. Every active administrator has full access. Existing administrators can add or deactivate other admin accounts from the dashboard.

5. Install dependencies and run the app:

   ```powershell
   npm install
   npm run dev
   ```

The React app is served on `http://localhost:5173` and the API on `http://localhost:4000`. Keep the app and API on the same origin, or put them behind a same-origin reverse proxy, so the secure admin session cookie works. Configure a valid public HTTPS webhook URL ending in `/api/webhooks/chapa` in Chapa before relying on payment notifications. The app also checks payment status after the hosted checkout redirects back.

Generate a local encryption key with Node.js:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Use a managed secret store and a managed PostgreSQL service configured for encryption at rest and TLS before handling real users. Never put a live Chapa key in the frontend.

## MVP status

This is a scaffold for product review and integration work, not a production-ready medical or commerce service. Admin accounts currently share full privileges; there are no fine-grained roles. Payment state remains read-only and must come from Chapa verification. Refund processing, customer sign-in, rider self-service, and clinical workflows are not implemented. Consult `docs/product-plan.md` and `docs/system-design.md` before enabling live orders, medical consultations, image collection, or real payments.
