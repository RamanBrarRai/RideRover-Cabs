-- Starting prices. Admins change these from the admin panel (each change adds a new row).
INSERT INTO pricing_settings
  (is_active, minimum_price_per_km, base_fare, per_minute_fare, minimum_fare, platform_fee,
   driver_commission_pct, waiting_fee_per_hour, cancellation_fee, toll_per_100km, suv_multiplier,
   shared_seat_factor, min_seat_fare)
VALUES
  (true, 10.00, 0, 0, 1000, 49, 15, 150, 200, 60, 1.25, 0.30, 250);
