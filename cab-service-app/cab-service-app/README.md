# RR Cabs: outstation cab marketplace

Personal and shared cabs between cities. This repository is built in modules. Each module leaves the project runnable.

**Done so far:**
- Backend: database (27 tables), phone + OTP login, refresh tokens, admin login, role-based access, driver online switch and earnings, driver approval, admin-editable pricing. 58 automated tests.
- **Customer app** (iOS / Android / web preview): onboarding, login, 5 persistent tabs (Home, Rides, Activity, Messages, Profile), booking entry screen.
- **Driver app**: login, verification dashboard until approved, then 5 persistent tabs (Home, Requests, Trips, Earnings, Profile), online/offline.
- **Admin web panel**: separate site with a sidebar of 17 sections. Customers, Drivers, Verification, Pricing and Dashboard use live data.

**Not built yet:** maps, fares and booking, payments, shared-ride matching, document upload, notifications, live tracking. Screens for these show honest empty states until their module is built. See `docs/architecture.md`.

## 1. Install these first (one time)
| Software | Version | Get it |
|---|---|---|
| Node.js | 20 or newer | https://nodejs.org (download the LTS version) |
| Docker Desktop | any recent | https://www.docker.com/products/docker-desktop (runs the database for you) |
| Git | any | https://git-scm.com |

Check Node works: open a terminal and type `node --version`.

## 2. Start the database
In a terminal, inside this project folder:

    docker compose up -d

(No Docker? Install PostgreSQL 16 yourself, create a database called `cab_dev` and change `DATABASE_URL` in step 3.)

## 3. Configure the backend
    cd backend
    cp ../.env.example .env

Open `backend/.env` in any text editor and fill in:
- `JWT_SECRET` and `JWT_REFRESH_SECRET`: two different long random strings. Create each with:
  `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
- `SEED_ADMIN_PASSWORD`: a password you choose (at least 10 characters) for the demo admin.

## 4. Install, create tables, add demo data, start

    npm install
    npm run migrate     # creates all tables
    npm run seed        # demo admin, customer and driver (development only)
    npm run dev         # starts the API on http://localhost:4000

Check it: open http://localhost:4000/health in a browser. You should see `{"ok":true}`.

## 5. Try logging in
With `SMS_PROVIDER=console`, the OTP appears in the terminal where the server is running (a line starting with `[DEV SMS]`).

    curl -X POST localhost:4000/auth/send-otp -H "content-type: application/json" -d '{"phone":"9000000001","role":"CUSTOMER"}'
    # read the 6-digit code from the server window, then:
    curl -X POST localhost:4000/auth/verify-otp -H "content-type: application/json" -d '{"phone":"9000000001","role":"CUSTOMER","otp":"123456"}'

The reply contains your `accessToken`. Use it as `Authorization: Bearer <token>` on `/customers/profile`.
Demo accounts: customer 9000000001, driver 9000000002, admin = the email and password in your `.env`. **They are for development only.**

## 6. Run the automated tests
Tests use their own database so they never touch your real data.

    docker compose exec db psql -U cab -d cab_dev -c "CREATE DATABASE cab_test;"
    cd backend && npm test          # 58 backend tests
    cd ../apps/admin-panel && npm test    # 9 admin panel tests
    cd ../mobile && npm test              # 17 app logic tests

(`npm test` erases and rebuilds `cab_test` every run. If your test database is somewhere else, set `TEST_DATABASE_URL`.)

## 7. Run the apps
Keep the backend from step 4 running. Open a **second** terminal for each app.

**Admin panel** (website):

    cd apps/admin-panel
    cp .env.example .env.local
    npm install
    npm run dev          # open http://localhost:5173/admin/login

Sign in with the demo admin email and password from your backend `.env`.

**Customer app** (first look in your browser, then on a phone):

    cd apps/mobile
    cp .env.example .env
    npm install
    npm run web:customer       # opens in your browser

**Driver app** (a second app built from the same folder):

    cd apps/mobile
    npm run web:driver         # opens on its own address, port 8082

Try it: log in as customer 9000000001, or driver 9000000002 (verified) or 9000000003 (waiting for approval). The code appears in the backend terminal. Approve driver 9000000003 in the admin panel, then pull down to refresh on the driver Home screen: the driver tabs change from Home / Documents / Trips / Profile to Home / Requests / Trips / Earnings / Profile.

**On a real phone:** install the free **Expo Go** app, run `npm run customer` (or `npm run driver`) and scan the QR code. Set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env` to `http://YOUR-COMPUTER-IP:4000` (phone and computer on the same Wi-Fi), then restart.
The app scripts clear the cache on purpose so you never get the customer app when you start the driver app.

## 8. Production build (backend)
    cd backend
    npm run build
    NODE_ENV=production node dist/server.js

In production you must use a managed PostgreSQL, set `SMS_PROVIDER=msg91` (with your MSG91 values), strong secrets, and `CORS_ORIGINS` to your admin website address. The server refuses to start with `SMS_PROVIDER=console` in production. Never run `npm run seed` in production (it refuses).

## Troubleshooting
| Problem | Fix |
|---|---|
| `Invalid environment configuration` | A value in `backend/.env` is missing or too short. The message lists which. |
| `ECONNREFUSED 5432` | The database is not running. Run `docker compose up -d`. |
| `database "cab_test" does not exist` | Run the `CREATE DATABASE cab_test` command in step 6. |
| `port 4000 already in use` | Change `PORT` in `.env`. |

## Folder map
    backend/     the API (TypeScript)         database/    SQL migrations and seed notes
    apps/mobile        customer and driver apps (one codebase, two apps)
    apps/admin-panel   admin website
    docs/        architecture, database, API
