# API

All errors look like `{ "error": { "code": "...", "message": "..." } }`. Protected routes need `Authorization: Bearer <accessToken>`.

| Method | Path | Who | What |
|---|---|---|---|
| GET | /health | anyone | Server and database check |
| POST | /auth/send-otp | anyone | `{ phone, role: CUSTOMER or DRIVER }`. Max 5 per hour per number, 30 s between codes |
| POST | /auth/verify-otp | anyone | `{ phone, role, otp }`. Returns tokens, `isNewUser`, `user.role`. 5 wrong tries lock the code |
| POST | /auth/refresh | anyone | `{ refreshToken }`. New pair; the old refresh token stops working |
| POST | /auth/logout | anyone | `{ refreshToken }` |
| POST | /auth/admin/login | anyone | `{ email, password }`. Locks for 15 min after 5 failures |
| GET | /auth/me | logged in | Account info including `role` (apps use this to pick the right experience) |
| GET, PUT | /customers/profile | CUSTOMER | `{ fullName, email? }` |
| GET, PUT | /drivers/profile | DRIVER | `{ fullName, address }` |
| GET | /drivers/verification-status | DRIVER | Status, reason, `profileComplete`, driver and vehicle documents |
| POST | /drivers/online | DRIVER | `{ online: boolean }`. Only VERIFIED drivers can go online (403 `DRIVER_NOT_VERIFIED`) |
| GET | /drivers/summary | DRIVER | Earnings today / week / month, totals, rating |
| GET | /admin/stats | ADMIN | Dashboard numbers |
| GET | /admin/customers | ADMIN | `?limit=&offset=` |
| GET | /admin/drivers | ADMIN | `?status=&limit=&offset=` |
| PUT | /admin/drivers/:id/approve | ADMIN | From PENDING_VERIFICATION or SUSPENDED. Needs a completed profile |
| PUT | /admin/drivers/:id/reject | ADMIN | `{ reason }` (5+ characters). From PENDING_VERIFICATION |
| PUT | /admin/drivers/:id/suspend | ADMIN | `{ reason }`. Forces the driver offline |
| GET | /admin/pricing | ADMIN | Active price list |
| PUT | /admin/pricing | ADMIN | Any subset of fields, for example `{ "minimumPricePerKm": 11 }`. Creates a new version, keeps history |
| GET | /admin/pricing/history | ADMIN | Last 50 versions with who changed them |

Approve, reject, suspend and pricing changes write an audit log. Approve, reject and suspend also create a notification for the driver.

Known gap: approval currently checks only that the driver finished their profile. Checking uploaded and reviewed documents is added with the document-upload module.
