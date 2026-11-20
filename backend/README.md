# Østfold Husflidslag backend (local-development MVP)

## Run locally

Requires Node.js 20+ and npm. From this directory:

```sh
npm install
export ADMIN_EMAIL='admin@example.test'
export ADMIN_PASSWORD='use-a-long-unique-local-secret'
# Optional: use a hosted MySQL database instead of the local JSON store.
# Set MYSQL_SSL=true when the database provider requires TLS.
# export MYSQL_URL='mysql://user:password@host:3306/database'
# export MYSQL_SSL=true
# Optional: set this to the exact browser origin(s), comma-separated.
export CORS_ORIGINS='http://localhost:5173,http://127.0.0.1:5173'
npm run check
npm start
```

`ADMIN_EMAIL` and `ADMIN_PASSWORD` seed the main administrator (`owner`) on first login; after that the password is stored hashed in the application store and is changed in the app or through the forgot-password flow. They have no defaults. `PORT` defaults to `3000`; `DATA_DIR` defaults to `./data` relative to the backend working directory; `PUBLIC_FRONTEND_URL` defaults to `http://localhost:5173` and controls activation and profile-change URLs. To enable profile-change and password-reset emails, set `SMTP_HOST`, `SMTP_FROM`, and optionally `SMTP_PORT` (default `587`), `SMTP_USER`, `SMTP_PASS`, and `SMTP_SECURE=true` when required by the provider. Port `465` uses TLS by default. Without SMTP configuration, the request endpoint reports that email delivery is unavailable.

## Use a hosted MySQL database

To make the backend's database records available across devices, both the backend and frontend must be reachable over the internet, and the backend must connect to the same hosted MySQL database every time it starts.

1. Create a MySQL database with a cloud database provider. Copy its connection details: host, port, database name, username, and password. Make sure the database accepts connections from the backend hosting provider.
2. Deploy the `backend/` directory as a Node.js service. Set `NODE_ENV=production` and in that service's environment-variable settings, set:
   - `MYSQL_URL` to `mysql://USER:PASSWORD@HOST:PORT/DATABASE`. URL-encode special characters in the username or password.
   - `MYSQL_SSL=true` if the database provider requires TLS (follow that provider's connection instructions).
   - `ADMIN_EMAIL` and `ADMIN_PASSWORD` for the first owner/admin login. Use a unique password of at least 12 characters.
   - `CORS_ORIGINS` to the exact public frontend origin, such as `https://www.example.no` (no path or trailing slash).
   - `PUBLIC_FRONTEND_URL` to that same public frontend URL, for membership links sent by email.
3. Keep `MYSQL_URL` and `ADMIN_PASSWORD` only in the backend host's secret/environment settings. Do not put database credentials in frontend variables, source files, or Git.
4. Deploy the frontend and set its build-time variable `VITE_API_BASE_URL` to the backend's public API base URL, ending in `/api`, for example `https://api.example.no/api`. Rebuild/redeploy the frontend after changing this variable. Add the frontend's exact origin to backend `CORS_ORIGINS`. Prefer frontend and API hostnames under the same site/domain so browser member-session cookies work.
5. Restart/redeploy the backend and check `https://YOUR-BACKEND-HOST/api/health`. A successful production response contains `"status":"ok"` and `"storage":"mysql"`. Register a test membership and create a test activity, then open the frontend from another device and check that the same records appear.

When `MYSQL_URL` is present, the backend creates the `set18_application_state` and `set18_uploads` tables if needed. The MySQL user must have permission to create tables on the first startup, plus permission to read and write them; alternatively, have a database administrator create both tables first. Memberships, applications, activities, orders, settings, and audit records are saved in MySQL; new activity images and membership application files are also saved in MySQL. MySQL is authoritative after its state row exists, and updates from backend instances using that database are shared. In production the backend refuses to start without `MYSQL_URL`, and `/api/health` reports `storage: "mysql"` only when it can refresh state from the database. Do not set `MYSQL_URL` to a local database if the goal is cross-device availability.

On the first startup only, if the MySQL state table is empty, the backend seeds it from `DATA_DIR/application-store.json` when that file exists; otherwise it seeds the initial default data. This lets you move existing local records to MySQL. After the cloud database has been initialized, it is the source of truth; do not clear its state row to avoid re-importing the local file. Existing uploaded files in `DATA_DIR` are not copied automatically—new uploads are stored in MySQL. If you do not need old local records, ensure the deployed backend has no old `application-store.json` before its first MySQL startup. Without `MYSQL_URL`, the backend uses the local JSON store instead.

Without `MYSQL_URL`, uploads are stored under `DATA_DIR`. With MySQL enabled, new activity images and membership application files are stored in the `set18_uploads` table, so they are shared across backend instances. Existing local uploads are not migrated automatically; keep `DATA_DIR` available until those files have been migrated or replaced. Do not expose `DATA_DIR` through a static file server. Membership documents are private and are only retrievable by an authenticated admin. Member and application personal information is stored unencrypted in MySQL or the local JSON file; use a provider with encryption-at-rest and appropriate access controls before storing real member data. Member passwords are hashed with Node's scrypt; session tokens are random, stored as hashes, and sent in HttpOnly, SameSite=Lax cookies. Set `NODE_ENV=production` to enable Secure cookies (HTTPS is then required). CORS is restricted to the configured origins; requests without an `Origin` header are supported for local command-line clients. The admin bootstrap credentials are environment-only. This MVP does not process payments; profile-change email is optional and requires SMTP configuration.

## API contract

All JSON responses use `{ "message": "..." }` for action results/errors; registration actions also return `{ "message", "id" }`. Validation errors may include `fields: string[]`. JSON request bodies are limited to 1 MiB.

### Activities

- `GET /api/activities` returns the current activity list. `GET /api/activities/:id` returns one activity.
- `POST /api/activities` creates and publishes an activity and requires an authenticated admin session. Send `multipart/form-data` with an `activity` JSON field containing title, date, location, optional time/category/HTML description, ticket capacity, and ticket types (`name`, `description`, `price`, `quantity`, and eligible `memberTypes`). An optional `image` field accepts one signature-checked PNG, JPEG, or WebP up to 5 MiB. Description HTML is sanitized to a small formatting allowlist before storage.
- `PUT /api/activities/:id` updates an existing activity in place and requires an authenticated admin session. It accepts the same multipart fields as create; omitting `image` keeps the current image, and activities without ticket types can remain without ticket types.
- `GET /api/activities/:id/orders` lists all orders and participants for an activity (admin only). Public activities include `remainingTickets` (`total` and `byType`). Activity edits cannot lower capacity or ticket quantity below sold tickets, and deleting an activity cancels its orders.
- Memberships are valid for one year (`validUntil`, computed from `createdAt` when missing). `POST /api/membership/me/renew` extends it by one year (dummy payment) and `PATCH /api/membership/me/consents` (`{ emailOffers, smsOffers }`) updates marketing consents. Expired members can log in and renew but cannot buy tickets.
- News is stored with the application data. `GET /api/news` returns published news; administrators can use `GET /api/news?scope=all` to include drafts and archived news, `POST /api/news` to create a news item, and `PUT /api/news/:id` to edit one. Write routes require the admin cookie. News uses `title`, `category`, `summary` (the introduction), `text` (the article body), `date` (`YYYY-MM-DD`), optional `imageUrl`, and `status` (`published`, `draft`, or `archived`). Create and update accept JSON, or `multipart/form-data` with a `news` JSON field and optional `image` PNG, JPEG, or WebP up to 5 MiB. Uploaded images are signature-checked and stored with the application data. `DELETE /api/news/:id` archives a news item; update its status to `published` to restore it.
- `GET /api/contact/settings` returns public contact details and contact people. `PUT /api/contact/settings` updates the introduction, shared email/phone/address, and contact people; it requires an administrator session. `POST /api/contact` accepts `{ "name", "email", "topic", "message" }` and stores a submission in the application data. The endpoint accepts at most five messages per IP per hour. Administrators can read the inbox at `GET /api/contact/messages` and delete a message with `DELETE /api/contact/messages/:id`. The message's email link can be used to reply. Contact form messages are not delivered by email automatically.
- Admin: `GET /api/admin/members` (filters `search`, `type`, `status`, `region`, `expired`), `GET /api/admin/members/export` (CSV with the same filters) and `PATCH /api/admin/members/:id` (`status` active/suspended, `validUntil`, `localGroup`; suspending ends the member's sessions).
- Any authenticated administrator can view, grant administrator access to an active member account by email, and remove administrator access from **Min side**. The member's existing password and account are retained. The main owner account cannot be removed.
- `GET/POST /api/membership/orders` (member session) lists own orders or buys tickets with `{ "activityId", "ticketName", "quantity" }` (1–10). The server computes the price for the member's type including an active discount, checks per-type and total capacity atomically, and confirms immediately (dummy payment). `DELETE /api/membership/orders/:id` cancels an own upcoming order.
- Activities have a `status` (`published`, `draft`, `archived`); only published ones are public. Admins can send `status` in create/update and list everything with `GET /api/activities?scope=all`. `DELETE /api/activities/:id` (admin) archives the activity and cancels its orders. Published activities and courses are automatically archived the day after their date in Europe/Oslo; automatic archiving preserves existing orders. To republish, choose today or a later date and set `status` to `published`. Activity images for drafts and archived activities require an admin session.
- `GET /api/admin/audit-log` (admin) returns the latest 200 audit entries (activity create/update/archive, application review, member and admin changes, config updates).

### Public membership and member session

- `GET /api/membership/config` always includes these base properties:
  ```json
  {
    "membershipTypes": { "regular": true, "minor": true, "gift": true, "craft": true },
    "regions": [{ "name": "Region", "chapters": ["Chapter"] }],
    "addressLookupAvailable": false
  }
  ```
  The response also includes `fields`, `requiredFields`, `options`, and `craftShippingInstructions` for the configurable frontend forms. A sample Østfold region with Fredrikstad, Moss, and Sarpsborg chapters is included by default. Typed addresses are stored as supplied and are **not verified**. There is no address-provider integration; the frontend uses standard browser autofill attributes, which may suggest addresses saved in the user's browser. Availability and suggestions depend on the browser and the user's saved data.
- `POST /api/membership/regular` accepts JSON using the frontend's flat person fields:
  ```json
  {
    "birthDate": "1990-01-01",
    "firstName": "Example",
    "middleName": "",
    "lastName": "Member",
    "gender": "Annet",
    "email": "member@example.test",
    "phone": "+47 00000000",
    "password": "at-least-12-characters",
    "address": { "street": "Testgata 1", "postalCode": "1600", "city": "Fredrikstad" },
    "region": "Østfold",
    "chapter": "Fredrikstad"
  }
  ```
- `POST /api/membership/minor` accepts `{ "child": { "firstName", "middleName", "lastName", "gender", "email", "phone", "birthDate" }, "parents": [{ "firstName", "middleName", "lastName", "gender", "email", "phone" }], "address": { "street", "postalCode", "city" }, "region": "...", "chapter": "...", "consent": true }`. At least one parent/guardian is required. Child must be under 18. Guardian consent, child's email, and child's phone are required. The response includes a private, single-use password setup URL expiring after 30 days.
- `POST /api/membership/activation/lookup` accepts `{ "type": "gift" | "minor" | "craft", "identifier": "email-or-phone" }` and checks whether contact details match a pending activation. `POST /api/membership/activation/verify` accepts the same properties plus `"token"` to verify the private single-use code before showing credential setup.
- `POST /api/membership/minor/activate/:token` accepts `{ "identifier": "email-or-phone", "password": "..." }` for a valid setup URL. The contact value must match the email or phone collected on the minor membership form. The pending member becomes active after password setup.
- `POST /api/membership/gift` accepts:
  ```json
  {
    "purchaser": {
      "birthDate": "1980-01-01", "firstName": "Gift", "middleName": "",
      "lastName": "Buyer", "gender": "Annet", "email": "buyer@example.test",
      "phone": "+47 00000000",
      "address": { "street": "Testgata 1", "postalCode": "1600", "city": "Fredrikstad" }
    },
    "recipient": {
      "birthDate": "2014-01-01", "firstName": "Gift", "middleName": "",
      "lastName": "Recipient", "gender": "Annet", "email": "recipient@example.test",
      "phone": "+47 00000000",
      "address": { "street": "Testgata 2", "postalCode": "1600", "city": "Fredrikstad" }
    },
    "guardian": {
      "firstName": "Guardian", "middleName": "", "lastName": "Example",
      "gender": "Annet", "email": "guardian@example.test", "phone": "+47 11111111"
    },
    "consent": true,
    "region": "Østfold",
    "chapter": "Fredrikstad"
  }
  ```
  Purchasers must be at least 18, and a valid recipient birthdate is required. For recipients under 18, `guardian` and `consent: true` are mandatory; guardian requires first/last name, gender, valid email and phone (middle name is optional). Guardian fields are optional in admin defaults but are conditionally required by backend validation for minor recipients. On activation the member is created as type `minor` with the recipient under `profile.child`, guardian under `profile.parents[0]`, and consent recorded. Adult recipients do not need guardian details and activate as type `gift`. It records the gift only; it does not charge a payment method or send email. Its `activationUrl` is `${PUBLIC_FRONTEND_URL}/medlemskap?aktiver=<token>` (default `http://localhost:5173/medlemskap?aktiver=<token>`).
- `GET /api/membership/gift/activate/:token` validates the token and returns `{ "groupSelected": boolean, "localGroup": { "region", "chapter" } | null }`; it exposes no recipient information. `POST` to the same route accepts `{ "identifier": "email-or-phone", "password": "...", "region": "Østfold", "chapter": "Moss" }`. Group fields may be omitted if already selected on purchase (the purchase selection is retained) or when no group is configured; otherwise a valid pair is required. A group selected during purchase cannot be changed during activation. The created member profile contains `recipient` and `localGroup`. Activation tokens expire after 30 days and are single-use.
- Regular, minor/child, and activated gift member email addresses and primary phone numbers are unique. Phones are compared by digits, ignoring common formatting characters. Registration and gift recipient creation reject email/phone pairs already associated with another member or pending gift (409), preventing an existing email from being paired with a different phone or vice versa. Activation starts with contact lookup and still requires the private activation code before a password can be set.
- `POST /api/membership/login` accepts `{ "email", "password" }`; its response includes `hasAdminAccess` for member accounts linked to administrator access. The frontend uses this to open both sessions. `GET /api/membership/me` returns the authenticated member's safe profile; `POST /api/membership/logout` ends that member session. Successful login uses an HttpOnly member-session cookie. Send browser requests with credentials enabled.
- `POST /api/membership/craft` requires `multipart/form-data` for a valid submission. Include an `application` field containing the JSON application object and repeated `files` attachment fields. Payload: `{ "business": { "name", "organizationNumber", "address": { "street", "postalCode", "city" }, "phone", "email", "website", "qualificationConfirmed": true }, "applicant": { "firstName", "middleName", "lastName", "gender", "email", "phone", "birthDate", "address": { "street", "postalCode", "city" } }, "craftType": "...", "admissionMethod": "certificate" | "jury", "jury": { ... }, "region": "...", "chapter": "...", "criteriaAccepted": true }`. Applicants must be 18 or older, with a syntactically valid phone number; existing members may apply. Qualification confirmation and criteria acceptance are mandatory. Maximum five files, 5 MiB each; only signature-checked PDF, PNG, and JPEG files are accepted. All craft applications start `pending_review`; only an admin can approve/reject. When an approved applicant has no existing member account, approval creates a pending husflidshåndverker account and returns a private, single-use setup URL. The applicant must first verify their registered email or phone, then verify the setup code, and finally choose a password. The email and any local chapter saved in the application are retained. The URL expires after 30 days.

### Admin authentication and configuration

- `POST /api/auth/login` accepts `{ "email", "password" }` for any stored administrator (the owner is seeded from `ADMIN_EMAIL`/`ADMIN_PASSWORD` on first login). Administrators linked to a member account authenticate with that account's current password. `GET /api/auth/me` reports the admin session; `POST /api/auth/logout` revokes it. `POST /api/auth/me/password` (`{ currentPassword, newPassword }`) changes the linked member's password when applicable. The owner can use `GET/POST /api/auth/admins` (`{ email }`) and `DELETE /api/auth/admins/:id` to manage other administrators; new access can only be granted to an active member account, and the endpoints respond 403 for other roles.
- `POST /api/membership/password/forgot` (`{ email }`) always answers neutrally and e-mails a 30-minute link to `/min-side/nytt-passord?token=…` for members and administrators. `POST /api/membership/password/reset` (`{ token, password }`) sets the new password and ends all sessions for the account. `POST /api/membership/me/password` changes a member's own password and `DELETE /api/membership/me` (`{ password }`) deletes the membership and cancels upcoming orders. Registration, password and order endpoints are rate limited per IP.
- Admin routes require the admin cookie. Browser clients must send credentials.
- `GET /api/admin/config` returns the editable settings object. `PUT /api/admin/config` accepts partial updates for `membershipTypes`, `regions`, `fields`, `options`, and `craftShippingInstructions`; omitted properties are preserved. Field keys use the frontend's exact dotted IDs, e.g. `person.firstName`, `child.birthDate`, `parent.email`, `purchaser.address.street`, `business.qualificationConfirmed`, `applicant.phone`, `jury.education`, `localGroup.region`, and `files`. It accepts this shape:
  ```json
  {
    "membershipTypes": { "regular": true },
    "regions": [{ "name": "Østfold", "chapters": ["Fredrikstad", "Moss"] }],
    "fields": { "regular": { "person.firstName": { "visible": true, "required": true, "label": "Fornavn" } } },
    "options": { "regular": { "person.gender": ["Mann", "Kvinne", "Annet"] } },
    "craftShippingInstructions": "Instructions for sending craft samples."
  }
  ```
  `fields.<flow>` maps dotted field IDs to `{ "visible": boolean, "required": boolean, "label"?: string }`. Gift defaults include optional `guardian.firstName`, `guardian.middleName`, `guardian.lastName`, `guardian.gender`, `guardian.email`, `guardian.phone`, and `consent`; the server enforces them for a recipient under 18 regardless of admin flags. `requiredFields` is derived from these flags on every update; callers do not set it directly. Partial field updates retain omitted fields/metadata. `sections` lets admins edit titles and help text in preset form sections. `options` maps flow and dotted field IDs to arrays of strings. `additionalFields` stores extra admin-built fields and content sections for the built-in presets. `customForms` stores up to 25 fully custom forms; each can contain text, textarea, email, phone, date, select, checkbox, file, and content-section elements. Custom form submissions are saved as `pending_review` applications, visible to admins with uploaded attachments, and never create member accounts automatically. The server validates required fields, field types, select choices, and file signatures. Regions and chapters are validated against submitted selections when configured. `addressLookupAvailable` is always false and cannot be enabled through configuration.
- `GET /api/admin/applications` returns `{ "applications": [...] }` without activation hashes or upload storage paths. `PATCH /api/admin/applications/:id` accepts `{ "status": "pending_review" | "approved" | "rejected", "note"?: "..." }` for craft review. Approving a new craft member returns `activationUrl`; share it privately with the applicant. `POST /api/membership/craft/activate/:token` accepts `{ "identifier": "email-or-phone", "password": "..." }` after activation verification and activates the member account.
- `GET /api/admin/applications/:id/files/:fileId` streams an attachment after admin authentication; stored upload paths are never public.

Existing content and contact routes are preserved: `/api/health`, `/api/activities`, `/api/courses`, `/api/news`, `/api/municipalities`, and `/api/contact`.

Course content is stored with the application data. `GET /api/courses` and `GET /api/courses/:id` return published courses publicly. Administrators can use `GET /api/courses?scope=all` to include drafts and archived courses, `POST /api/courses` to create one, `PUT /api/courses/:id` to edit one, and `DELETE /api/courses/:id` to archive one. Write routes require the admin cookie. Course bodies contain `title`, `category`, `description`, `date` (`YYYY-MM-DD`), `time`, `place`, `price`, `symbol`, `color` (`basket`, `wool`, `sewing`, `embroidery`, `knitting`, or `christmas`), and `status` (`published`, `draft`, or `archived`).

### Member self-service

- `POST /api/membership/profile/change-request` requires a member session and emails a single-use profile-edit link to the member's current registered email. Links expire after 30 minutes. Requests are limited to one per minute per member. SMTP must be configured.
- `GET /api/membership/profile/change/:token` returns the profile associated with a valid link. `PUT` to the same route accepts `{ "profile": { ... } }`, validates required identity/contact fields and age restrictions, checks email/phone uniqueness, and preserves the existing `localGroup`. The link is invalidated after a successful update.
- `PATCH /api/membership/me/local-group` requires a member session and accepts `{ "region", "chapter" }`. The backend validates the selected chapter against the chosen region.

## Tests and storage

`npm test` runs `node --test` integration tests that start the server against a temporary `DATA_DIR`. Local JSON storage uses serialized, atomic writes; MySQL storage serializes writes through a database transaction.
