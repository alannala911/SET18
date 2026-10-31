# Østfold Husflidslag backend (local-development MVP)

## Run locally

Requires Node.js 20+ and npm. From this directory:

```sh
npm install
export ADMIN_EMAIL='admin@example.test'
export ADMIN_PASSWORD='use-a-long-unique-local-secret'
# Optional: set this to the exact browser origin(s), comma-separated.
export CORS_ORIGINS='http://localhost:5173,http://127.0.0.1:5173'
npm run check
npm start
```

`ADMIN_EMAIL` and `ADMIN_PASSWORD` seed the main administrator (`owner`) on first login; after that the password is stored hashed in the application store and is changed in the app or through the forgot-password flow. They have no defaults. `PORT` defaults to `3000`; `DATA_DIR` defaults to `./data` relative to the backend working directory; `PUBLIC_FRONTEND_URL` defaults to `http://localhost:5173` and controls activation and profile-change URLs. To enable profile-change and password-reset emails, set `SMTP_HOST`, `SMTP_FROM`, and optionally `SMTP_PORT` (default `587`), `SMTP_USER`, `SMTP_PASS`, and `SMTP_SECURE=true` when required by the provider. Port `465` uses TLS by default. Without SMTP configuration, the request endpoint reports that email delivery is unavailable. Use a persistent writable `DATA_DIR` for durable local storage. Do not expose it through a static file server. Uploaded files are private and are only retrievable by an authenticated admin.

The JSON store and private uploads are created under `DATA_DIR` and ignored by git. **Stored member and application personal information is unencrypted. Use test data only; this local-development MVP is not suitable for real member data or production.** Member passwords are hashed with Node's scrypt; session tokens are random, stored as hashes, and sent in HttpOnly, SameSite=Lax cookies. Set `NODE_ENV=production` to enable Secure cookies (HTTPS is then required). CORS is restricted to the configured origins; requests without an `Origin` header are supported for local command-line clients. The admin bootstrap credentials are environment-only. This MVP does not process payments; profile-change email is optional and requires SMTP configuration.

## API contract

All JSON responses use `{ "message": "..." }` for action results/errors; registration actions also return `{ "message", "id" }`. Validation errors may include `fields: string[]`. JSON request bodies are limited to 1 MiB.

### Activities

- `GET /api/activities` returns the current activity list. `GET /api/activities/:id` returns one activity.
- `POST /api/activities` creates and publishes an activity and requires an authenticated admin session. Send `multipart/form-data` with an `activity` JSON field containing title, date, location, optional time/category/HTML description, ticket capacity, and ticket types (`name`, `description`, `price`, `quantity`, and eligible `memberTypes`). An optional `image` field accepts one signature-checked PNG, JPEG, or WebP up to 5 MiB. Description HTML is sanitized to a small formatting allowlist before storage.
- `PUT /api/activities/:id` updates an existing activity in place and requires an authenticated admin session. It accepts the same multipart fields as create; omitting `image` keeps the current image, and activities without ticket types can remain without ticket types.
- `GET /api/activities/:id/orders` lists all orders and participants for an activity (admin only). Public activities include `remainingTickets` (`total` and `byType`). Activity edits cannot lower capacity or ticket quantity below sold tickets, and deleting an activity cancels its orders.
- Memberships are valid for one year (`validUntil`, computed from `createdAt` when missing). `POST /api/membership/me/renew` extends it by one year (dummy payment) and `PATCH /api/membership/me/consents` (`{ emailOffers, smsOffers }`) updates marketing consents. Expired members can log in and renew but cannot buy tickets.
- Admin: `GET /api/admin/members` (filters `search`, `type`, `status`, `region`, `expired`), `GET /api/admin/members/export` (CSV with the same filters) and `PATCH /api/admin/members/:id` (`status` active/suspended, `validUntil`, `localGroup`; suspending ends the member's sessions).
- `GET/POST /api/membership/orders` (member session) lists own orders or buys tickets with `{ "activityId", "ticketName", "quantity" }` (1–10). The server computes the price for the member's type including an active discount, checks per-type and total capacity atomically, and confirms immediately (dummy payment). `DELETE /api/membership/orders/:id` cancels an own upcoming order.
- Activities have a `status` (`published`, `draft`, `archived`); only published ones are public. Admins can send `status` in create/update and list everything with `GET /api/activities?scope=all`. `DELETE /api/activities/:id` (admin) archives the activity and cancels its orders; set `status` back to `published` to restore it.
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
- `POST /api/membership/login` accepts `{ "email", "password" }`; `GET /api/membership/me` returns the authenticated member's safe profile; `POST /api/membership/logout` ends that member session. Successful login uses an HttpOnly member-session cookie. Send browser requests with credentials enabled.
- `POST /api/membership/craft` requires `multipart/form-data` for a valid submission. Include an `application` field containing the JSON application object and repeated `files` attachment fields. Payload: `{ "business": { "name", "organizationNumber", "address": { "street", "postalCode", "city" }, "phone", "email", "website", "qualificationConfirmed": true }, "applicant": { "firstName", "middleName", "lastName", "gender", "email", "phone", "birthDate", "address": { "street", "postalCode", "city" } }, "craftType": "...", "admissionMethod": "certificate" | "jury", "jury": { ... }, "region": "...", "chapter": "...", "criteriaAccepted": true }`. Applicants must be 18 or older, with a syntactically valid phone number; existing members may apply. Qualification confirmation and criteria acceptance are mandatory. Maximum five files, 5 MiB each; only signature-checked PDF, PNG, and JPEG files are accepted. All craft applications start `pending_review`; only an admin can approve/reject. When an approved applicant has no existing member account, approval creates a pending husflidshåndverker account and returns a private, single-use setup URL. The applicant must first verify their registered email or phone, then verify the setup code, and finally choose a password. The email and any local chapter saved in the application are retained. The URL expires after 30 days.

### Admin authentication and configuration

- `POST /api/auth/login` accepts `{ "email", "password" }` for any stored administrator (the owner is seeded from `ADMIN_EMAIL`/`ADMIN_PASSWORD` on first login). `GET /api/auth/me` reports the admin session; `POST /api/auth/logout` revokes it. `POST /api/auth/me/password` (`{ currentPassword, newPassword }`) changes the admin's own password. The owner can use `GET/POST /api/auth/admins` (`{ email, password }`) and `DELETE /api/auth/admins/:id` to manage other administrators; they respond 403 for other roles.
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

### Member self-service

- `POST /api/membership/profile/change-request` requires a member session and emails a single-use profile-edit link to the member's current registered email. Links expire after 30 minutes. Requests are limited to one per minute per member. SMTP must be configured.
- `GET /api/membership/profile/change/:token` returns the profile associated with a valid link. `PUT` to the same route accepts `{ "profile": { ... } }`, validates required identity/contact fields and age restrictions, checks email/phone uniqueness, and preserves the existing `localGroup`. The link is invalidated after a successful update.
- `PATCH /api/membership/me/local-group` requires a member session and accepts `{ "region", "chapter" }`. The backend validates the selected chapter against the chosen region.

## Tests and storage

`npm test` runs `node --test` integration tests that start the server against a temporary `DATA_DIR`. Storage is still a single JSON file with serialized, atomic writes; it is fine for one backend process. Moving to a real database (for several processes or large volumes) is a separate migration and has not been done.
