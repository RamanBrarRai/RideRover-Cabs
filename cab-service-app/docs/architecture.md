# Architecture

RR Cabs is an **outstation (city-to-city) cab marketplace** with personal and shared cabs.

| Part | Technology | Folder | Status |
|---|---|---|---|
| REST API | Node.js 20, TypeScript, Express | `backend/` | Module 1 done |
| Database | PostgreSQL 16, plain SQL migrations | `database/migrations/` | Full schema done |
| Customer app | Flutter (iOS + Android) | `apps/customer-app/` | Module 4 |
| Driver app | Flutter (iOS + Android) | `apps/driver-app/` | Module 5 |
| Admin panel | React + TypeScript | `apps/admin-panel/` | Module 6 |

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
