# Shared-ride matching (planned, Module 6)
Matching uses coordinates, not city names: pickup and drop must be within the search radius of points on the driver route, in the right order. Score = route overlap 55%, pickup/drop proximity 25%, departure-time fit 20%. Thresholds come from `pricing_settings`. Seats are booked inside one transaction with a row lock on the shared ride.
