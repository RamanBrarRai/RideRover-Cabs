-- RR Cabs: core schema (PostgreSQL 14+)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_role AS ENUM ('CUSTOMER','DRIVER','ADMIN');
CREATE TYPE account_status AS ENUM ('ACTIVE','SUSPENDED','DELETED');
CREATE TYPE driver_status AS ENUM ('DRAFT','PENDING_VERIFICATION','VERIFIED','REJECTED','SUSPENDED');
CREATE TYPE doc_status AS ENUM ('UPLOADED','APPROVED','REJECTED','REUPLOAD_REQUESTED');
CREATE TYPE ride_type AS ENUM ('PERSONAL','SHARED');
CREATE TYPE ride_status AS ENUM ('REQUESTED','ACCEPTED','DRIVER_EN_ROUTE','ARRIVED','TRIP_STARTED','TRIP_COMPLETED','CANCELLED');
CREATE TYPE request_status AS ENUM ('SENT','ACCEPTED','REJECTED','EXPIRED');
CREATE TYPE shared_ride_status AS ENUM ('OPEN','FULL','IN_PROGRESS','COMPLETED','CANCELLED');
CREATE TYPE passenger_status AS ENUM ('CONFIRMED','PICKED_UP','DROPPED','CANCELLED');
CREATE TYPE payment_status AS ENUM ('PENDING','PROCESSING','SUCCESS','FAILED','REFUNDED','PARTIALLY_REFUNDED');
CREATE TYPE txn_type AS ENUM ('CHARGE','REFUND');
CREATE TYPE complaint_status AS ENUM ('OPEN','IN_REVIEW','RESOLVED','REJECTED');

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$ LANGUAGE plpgsql;

-- ---------- identity ----------
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role          user_role NOT NULL,
  phone         text UNIQUE CHECK (phone ~ '^[6-9][0-9]{9}$'),
  email         text UNIQUE,
  status        account_status NOT NULL DEFAULT 'ACTIVE',
  last_login_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz,
  CONSTRAINT users_contact_chk CHECK (
    (role = 'ADMIN' AND email IS NOT NULL) OR (role <> 'ADMIN' AND phone IS NOT NULL))
);
CREATE TRIGGER trg_users_upd BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE customers (
  user_id         uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name       text,
  profile_photo_key text,
  kyc_status      text NOT NULL DEFAULT 'NOT_STARTED' CHECK (kyc_status IN ('NOT_STARTED','PENDING','VERIFIED','FAILED')),
  kyc_reference   text,
  rating_avg      numeric(3,2) NOT NULL DEFAULT 0,
  rating_count    integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_customers_upd BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE drivers (
  user_id         uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name       text,
  address         text,
  profile_photo_key text,
  status          driver_status NOT NULL DEFAULT 'DRAFT',
  status_reason   text,
  kyc_reference   text,
  is_online       boolean NOT NULL DEFAULT false,
  last_lat        double precision CHECK (last_lat BETWEEN -90 AND 90),
  last_lng        double precision CHECK (last_lng BETWEEN -180 AND 180),
  last_seen_at    timestamptz,
  rating_avg      numeric(3,2) NOT NULL DEFAULT 0,
  rating_count    integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT drivers_online_requires_verified CHECK (is_online = false OR status = 'VERIFIED')
);
CREATE INDEX idx_drivers_status ON drivers(status);
CREATE TRIGGER trg_drivers_upd BEFORE UPDATE ON drivers FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE admin_users (
  user_id       uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name     text NOT NULL,
  password_hash text NOT NULL,
  admin_role    text NOT NULL DEFAULT 'STAFF' CHECK (admin_role IN ('SUPER_ADMIN','STAFF','SUPPORT')),
  failed_logins integer NOT NULL DEFAULT 0,
  locked_until  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE otp_codes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       text NOT NULL,
  code_hash   text NOT NULL,
  attempts    integer NOT NULL DEFAULT 0,
  expires_at  timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_otp_phone_created ON otp_codes(phone, created_at DESC);

CREATE TABLE refresh_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  text NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_refresh_user ON refresh_tokens(user_id);

CREATE TABLE device_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fcm_token  text NOT NULL UNIQUE,
  platform   text NOT NULL CHECK (platform IN ('ios','android','web')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- vehicles & documents ----------
CREATE TABLE vehicles (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id     uuid NOT NULL REFERENCES drivers(user_id) ON DELETE CASCADE,
  category      text NOT NULL CHECK (category IN ('SEDAN','SUV')),
  make_model    text NOT NULL,
  reg_number    text NOT NULL UNIQUE,
  seats_total   integer NOT NULL CHECK (seats_total BETWEEN 2 AND 12),
  color         text,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);
CREATE INDEX idx_vehicles_driver ON vehicles(driver_id);
CREATE TRIGGER trg_vehicles_upd BEFORE UPDATE ON vehicles FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE driver_documents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id     uuid NOT NULL REFERENCES drivers(user_id) ON DELETE CASCADE,
  doc_type      text NOT NULL CHECK (doc_type IN ('IDENTITY','LICENCE','OTHER')),
  storage_key   text NOT NULL,
  mime_type     text NOT NULL,
  status        doc_status NOT NULL DEFAULT 'UPLOADED',
  review_note   text,
  reviewed_by   uuid REFERENCES users(id),
  reviewed_at   timestamptz,
  expires_on    date,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_driver_docs_driver ON driver_documents(driver_id, doc_type);

CREATE TABLE vehicle_documents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id    uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  doc_type      text NOT NULL CHECK (doc_type IN ('REGISTRATION','INSURANCE','PERMIT','OTHER')),
  storage_key   text NOT NULL,
  mime_type     text NOT NULL,
  status        doc_status NOT NULL DEFAULT 'UPLOADED',
  review_note   text,
  reviewed_by   uuid REFERENCES users(id),
  reviewed_at   timestamptz,
  expires_on    date,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_vehicle_docs_vehicle ON vehicle_documents(vehicle_id, doc_type);

-- ---------- places ----------
CREATE TABLE locations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label       text NOT NULL,
  city        text,
  address     text,
  lat         double precision NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng         double precision NOT NULL CHECK (lng BETWEEN -180 AND 180),
  place_id    text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_locations_latlng ON locations(lat, lng);

-- ---------- pricing ----------
CREATE TABLE pricing_settings (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_active               boolean NOT NULL DEFAULT false,
  minimum_price_per_km    numeric(8,2) NOT NULL CHECK (minimum_price_per_km > 0),
  base_fare               numeric(10,2) NOT NULL DEFAULT 0 CHECK (base_fare >= 0),
  per_minute_fare         numeric(8,2) NOT NULL DEFAULT 0 CHECK (per_minute_fare >= 0),
  minimum_fare            numeric(10,2) NOT NULL DEFAULT 0 CHECK (minimum_fare >= 0),
  maximum_fare            numeric(10,2) CHECK (maximum_fare IS NULL OR maximum_fare > 0),
  platform_fee            numeric(10,2) NOT NULL DEFAULT 0 CHECK (platform_fee >= 0),
  driver_commission_pct   numeric(5,2) NOT NULL DEFAULT 15 CHECK (driver_commission_pct BETWEEN 0 AND 100),
  waiting_fee_per_hour    numeric(10,2) NOT NULL DEFAULT 0 CHECK (waiting_fee_per_hour >= 0),
  cancellation_fee        numeric(10,2) NOT NULL DEFAULT 0 CHECK (cancellation_fee >= 0),
  toll_per_100km          numeric(10,2) NOT NULL DEFAULT 0 CHECK (toll_per_100km >= 0),
  suv_multiplier          numeric(5,2) NOT NULL DEFAULT 1.25 CHECK (suv_multiplier >= 1),
  shared_seat_factor      numeric(5,3) NOT NULL DEFAULT 0.3 CHECK (shared_seat_factor > 0 AND shared_seat_factor <= 1),
  min_seat_fare           numeric(10,2) NOT NULL DEFAULT 0 CHECK (min_seat_fare >= 0),
  match_excellent_score   integer NOT NULL DEFAULT 85 CHECK (match_excellent_score BETWEEN 1 AND 100),
  match_good_score        integer NOT NULL DEFAULT 70 CHECK (match_good_score BETWEEN 1 AND 100),
  match_min_score         integer NOT NULL DEFAULT 50 CHECK (match_min_score BETWEEN 1 AND 100),
  match_radius_km         numeric(6,2) NOT NULL DEFAULT 30 CHECK (match_radius_km > 0),
  match_time_window_min   integer NOT NULL DEFAULT 120 CHECK (match_time_window_min > 0),
  created_by              uuid REFERENCES users(id),
  created_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT match_scores_ordered CHECK (match_excellent_score >= match_good_score AND match_good_score >= match_min_score)
);
CREATE UNIQUE INDEX uq_pricing_one_active ON pricing_settings(is_active) WHERE is_active;

-- ---------- rides & bookings ----------
CREATE TABLE rides (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_type        ride_type NOT NULL DEFAULT 'PERSONAL',
  customer_id      uuid NOT NULL REFERENCES customers(user_id),
  driver_id        uuid REFERENCES drivers(user_id),
  vehicle_id       uuid REFERENCES vehicles(id),
  pickup_id        uuid NOT NULL REFERENCES locations(id),
  drop_id          uuid NOT NULL REFERENCES locations(id),
  scheduled_at     timestamptz NOT NULL,
  status           ride_status NOT NULL DEFAULT 'REQUESTED',
  vehicle_category text NOT NULL DEFAULT 'SEDAN' CHECK (vehicle_category IN ('SEDAN','SUV')),
  distance_km      numeric(8,2) NOT NULL CHECK (distance_km > 0),
  duration_min     integer NOT NULL CHECK (duration_min > 0),
  fare_total       numeric(10,2) NOT NULL CHECK (fare_total >= 0),
  fare_breakdown   jsonb NOT NULL,
  pricing_id       uuid NOT NULL REFERENCES pricing_settings(id),
  started_at       timestamptz,
  completed_at     timestamptz,
  cancelled_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rides_driver_when_accepted CHECK (status IN ('REQUESTED','CANCELLED') OR driver_id IS NOT NULL)
);
CREATE INDEX idx_rides_customer ON rides(customer_id, created_at DESC);
CREATE INDEX idx_rides_driver ON rides(driver_id, status);
CREATE INDEX idx_rides_status_sched ON rides(status, scheduled_at);
CREATE TRIGGER trg_rides_upd BEFORE UPDATE ON rides FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE ride_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id     uuid NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  driver_id   uuid NOT NULL REFERENCES drivers(user_id),
  status      request_status NOT NULL DEFAULT 'SENT',
  expires_at  timestamptz NOT NULL,
  responded_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ride_id, driver_id)
);
CREATE INDEX idx_ride_requests_driver ON ride_requests(driver_id, status);

CREATE TABLE shared_rides (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id        uuid NOT NULL REFERENCES drivers(user_id),
  vehicle_id       uuid NOT NULL REFERENCES vehicles(id),
  origin_id        uuid NOT NULL REFERENCES locations(id),
  destination_id   uuid NOT NULL REFERENCES locations(id),
  route_polyline   text,
  route_points     jsonb NOT NULL,
  distance_km      numeric(8,2) NOT NULL CHECK (distance_km > 0),
  duration_min     integer NOT NULL CHECK (duration_min > 0),
  departs_at       timestamptz NOT NULL,
  seats_total      integer NOT NULL CHECK (seats_total BETWEEN 1 AND 12),
  seats_available  integer NOT NULL,
  status           shared_ride_status NOT NULL DEFAULT 'OPEN',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shared_seats_valid CHECK (seats_available >= 0 AND seats_available <= seats_total)
);
CREATE INDEX idx_shared_rides_search ON shared_rides(status, departs_at);
CREATE TRIGGER trg_shared_upd BEFORE UPDATE ON shared_rides FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE bookings (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id      uuid NOT NULL REFERENCES customers(user_id),
  booking_type     ride_type NOT NULL,
  ride_id          uuid REFERENCES rides(id),
  shared_ride_id   uuid REFERENCES shared_rides(id),
  seats            integer NOT NULL DEFAULT 1 CHECK (seats BETWEEN 1 AND 12),
  status           ride_status NOT NULL DEFAULT 'REQUESTED',
  fare_total       numeric(10,2) NOT NULL CHECK (fare_total >= 0),
  platform_fee     numeric(10,2) NOT NULL DEFAULT 0,
  driver_payout    numeric(10,2) NOT NULL DEFAULT 0,
  idempotency_key  text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, idempotency_key),
  CONSTRAINT booking_target CHECK (
    (booking_type = 'PERSONAL' AND ride_id IS NOT NULL AND shared_ride_id IS NULL) OR
    (booking_type = 'SHARED'   AND shared_ride_id IS NOT NULL))
);
CREATE INDEX idx_bookings_customer ON bookings(customer_id, created_at DESC);
CREATE TRIGGER trg_bookings_upd BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE shared_ride_passengers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_ride_id  uuid NOT NULL REFERENCES shared_rides(id) ON DELETE CASCADE,
  booking_id      uuid NOT NULL UNIQUE REFERENCES bookings(id),
  customer_id     uuid NOT NULL REFERENCES customers(user_id),
  pickup_id       uuid NOT NULL REFERENCES locations(id),
  drop_id         uuid NOT NULL REFERENCES locations(id),
  seats           integer NOT NULL CHECK (seats BETWEEN 1 AND 12),
  distance_km     numeric(8,2) NOT NULL CHECK (distance_km > 0),
  match_score     integer CHECK (match_score BETWEEN 0 AND 100),
  fare_total      numeric(10,2) NOT NULL CHECK (fare_total >= 0),
  status          passenger_status NOT NULL DEFAULT 'CONFIRMED',
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_passenger_active ON shared_ride_passengers(shared_ride_id, customer_id) WHERE status <> 'CANCELLED';

CREATE TABLE cancellations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id    uuid NOT NULL REFERENCES bookings(id),
  cancelled_by  uuid NOT NULL REFERENCES users(id),
  reason        text,
  fee_charged   numeric(10,2) NOT NULL DEFAULT 0 CHECK (fee_charged >= 0),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ---------- payments ----------
CREATE TABLE payments (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id         uuid NOT NULL REFERENCES bookings(id),
  customer_id        uuid NOT NULL REFERENCES customers(user_id),
  amount             numeric(10,2) NOT NULL CHECK (amount > 0),
  currency           text NOT NULL DEFAULT 'INR',
  status             payment_status NOT NULL DEFAULT 'PENDING',
  gateway            text NOT NULL,
  gateway_order_id   text UNIQUE,
  gateway_payment_id text UNIQUE,
  refunded_amount    numeric(10,2) NOT NULL DEFAULT 0 CHECK (refunded_amount >= 0),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT refund_within_amount CHECK (refunded_amount <= amount)
);
CREATE INDEX idx_payments_booking ON payments(booking_id);
CREATE TRIGGER trg_payments_upd BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE payment_transactions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id       uuid NOT NULL REFERENCES payments(id),
  txn_type         txn_type NOT NULL,
  amount           numeric(10,2) NOT NULL CHECK (amount > 0),
  status           payment_status NOT NULL,
  gateway_event_id text UNIQUE,
  raw_event        jsonb,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payment_txn_payment ON payment_transactions(payment_id);

CREATE TABLE driver_earnings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id     uuid NOT NULL REFERENCES drivers(user_id),
  booking_id    uuid NOT NULL UNIQUE REFERENCES bookings(id),
  gross_amount  numeric(10,2) NOT NULL CHECK (gross_amount >= 0),
  commission    numeric(10,2) NOT NULL CHECK (commission >= 0),
  net_amount    numeric(10,2) NOT NULL CHECK (net_amount >= 0),
  paid_out_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_earnings_driver ON driver_earnings(driver_id, created_at DESC);

-- ---------- feedback & communication ----------
CREATE TABLE ratings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  uuid NOT NULL REFERENCES bookings(id),
  rater_id    uuid NOT NULL REFERENCES users(id),
  ratee_id    uuid NOT NULL REFERENCES users(id),
  stars       integer NOT NULL CHECK (stars BETWEEN 1 AND 5),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_id, rater_id),
  CHECK (rater_id <> ratee_id)
);

CREATE TABLE reviews (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rating_id   uuid NOT NULL UNIQUE REFERENCES ratings(id) ON DELETE CASCADE,
  body        text NOT NULL CHECK (char_length(body) <= 1000),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        text NOT NULL,
  title       text NOT NULL,
  body        text NOT NULL,
  data        jsonb,
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);

CREATE TABLE messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  sender_id   uuid NOT NULL REFERENCES users(id),
  body        text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_booking ON messages(booking_id, created_at);

CREATE TABLE complaints (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  uuid REFERENCES bookings(id),
  raised_by   uuid NOT NULL REFERENCES users(id),
  subject     text NOT NULL,
  details     text NOT NULL,
  status      complaint_status NOT NULL DEFAULT 'OPEN',
  resolution  text,
  handled_by  uuid REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_complaints_upd BEFORE UPDATE ON complaints FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE audit_logs (
  id          bigserial PRIMARY KEY,
  actor_id    uuid REFERENCES users(id),
  actor_role  user_role,
  action      text NOT NULL,
  entity      text,
  entity_id   text,
  details     jsonb,
  ip          text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_entity ON audit_logs(entity, entity_id);
