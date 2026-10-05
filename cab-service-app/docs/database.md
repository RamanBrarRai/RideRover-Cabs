# Database

27 tables, created by `database/migrations/001_init.sql`. Starting prices are in `002_default_pricing.sql`.

Groups: **identity** (users, customers, drivers, admin_users, otp_codes, refresh_tokens, device_tokens),
**vehicles** (vehicles, driver_documents, vehicle_documents), **places** (locations), **pricing** (pricing_settings),
**trips** (rides, ride_requests, shared_rides, shared_ride_passengers, bookings, cancellations),
**money** (payments, payment_transactions, driver_earnings), **feedback** (ratings, reviews, notifications, messages, complaints),
**security** (audit_logs).

## Rules enforced by the database itself
| Rule | How |
|---|---|
| Shared cab can never be overbooked | `CHECK (seats_available >= 0 AND seats_available <= seats_total)`; bookings will lock the row in a transaction (Module 6) |
| Duplicate bookings from retries / double taps | `UNIQUE (customer_id, idempotency_key)` |
| Same customer cannot hold two seats-bookings on one shared ride | partial unique index `uq_passenger_active` |
| Only verified drivers can be online | `CHECK drivers_online_requires_verified` |
| Exactly one active price list; every change is kept | partial unique index `uq_pricing_one_active`, new row per change |
| A webhook event is never applied twice | `UNIQUE gateway_event_id` on `payment_transactions` |
| A refund can never exceed the payment | `CHECK refund_within_amount` |
| One rating per person per trip | `UNIQUE (booking_id, rater_id)` |
| An accepted ride always has a driver | `CHECK rides_driver_when_accepted` |
| ID numbers are never stored | only `kyc_reference` from the KYC partner |
