# API (Module 1)

All errors look like `{ "error": { "code": "...", "message": "..." } }`. Protected routes need `Authorization: Bearer <accessToken>`.

| Method | Path | Who | What |
|---|---|---|---|
| GET | /health | anyone | Server and database check |
| POST | /auth/send-otp | anyone | `{ phone, role: CUSTOMER or DRIVER }`. Max 5 per hour per number, 30 s between codes |
| POST | /auth/verify-otp | anyone | `{ phone, role, otp }`. Returns `accessToken`, `refreshToken`, `isNewUser`. 5 wrong tries lock the code |
| POST | /auth/refresh | anyone | `{ refreshToken }`. Returns a new pair; the old refresh token stops working |
| POST | /auth/logout | anyone | `{ refreshToken }` |
| POST | /auth/admin/login | anyone | `{ email, password }`. Locks for 15 min after 5 failures |
| GET | /auth/me | any logged-in user | Basic account info |
| GET, PUT | /customers/profile | CUSTOMER | `{ fullName, email? }` |
| GET, PUT | /drivers/profile | DRIVER | `{ fullName, address }` |
| GET | /drivers/verification-status | DRIVER | Status and document list |
| GET | /admin/customers | ADMIN | `?limit=&offset=` |
| GET | /admin/drivers | ADMIN | `?status=&limit=&offset=` |

Coming in later modules: pricing, rides, shared rides, payments, ratings, admin approvals (see the project brief for the full list).
