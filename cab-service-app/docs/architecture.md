# Architecture

RR Cabs is an **outstation (city-to-city) cab marketplace** with personal and shared cabs.

| Part | Technology | Folder | Status |
|---|---|---|---|
| REST API | Node.js 20, TypeScript, Express | `backend/` | Module 1 done |
| Database | PostgreSQL 16, plain SQL migrations | `database/migrations/` | Full schema done |
| Customer app | React Native (Expo) + TypeScript, iOS / Android / web | `apps/mobile` (customer build) | Shell, login, 5 tabs done |
| Driver app | React Native (Expo) + TypeScript | `apps/mobile` (driver build) | Shell, verification, 5 tabs done |
| Admin panel | React + Vite + TypeScript | `apps/admin-panel/` | Shell and 5 live pages done |

## Why Expo (React Native) instead of Flutter
The first brief preferred Flutter. I used Expo because it can be built, bundled and tested in the environment this project was written in, and your earlier RR Cabs plan used it. One codebase produces two separate apps (`EXPO_PUBLIC_APP_ROLE=CUSTOMER` or `DRIVER`), each with its own name, bundle id and tabs. Switching to Flutter later would mean rewriting only the screens; the backend does not change.

## How roles reach the right app
`resolveGate()` in `apps/mobile/src/navigation/guards.ts` is the single rule: not logged in goes to onboarding or login; a logged-in user whose role does not match the app sees a "wrong app" screen; a customer enters the customer shell; a verified driver enters the driver shell; an unverified driver enters the verification shell. The shell is mounted once and stays mounted. Admins never appear in the mobile apps, and the admin site accepts only admin accounts.

## Why these choices
- **Plain SQL migrations + `pg`** instead of an ORM: the safety rules (no overbooking, one active price, valid payment states) live in the database as constraints, and the SQL is easy to read and audit.
- **Phone + OTP** for customers and drivers; **email + password (scrypt)** for admins, with lockout.
- **Short access tokens (15 min) + rotating refresh tokens (30 days).** Refresh tokens are stored only as hashes. If an old one is replayed, all sessions for that user end.
- **The role comes from the database on every request**, not from the token, so suspending a user takes effect at once.
- **Money logic is server-side only.** Apps display what the API returns.

## Module plan (each module leaves the project runnable)
1. Setup, database, authentication, profiles  **(done)**
2. Pricing service + admin pricing API + Maps (distance, route, ETA)
3. Personal-cab booking + ride state machine
4. Driver documents (private storage) + verification APIs
5. Payments (Razorpay) with webhook verification
6. Shared rides: route matching, seat booking with row locks
7. Notifications (FCM), ratings, complaints
8. Live tracking
9. Admin panel (React)
10. Customer app (Flutter), Driver app (Flutter)
11. Production hardening, deployment guide
