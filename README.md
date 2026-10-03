# Cab Service App

A cross-platform cab service marketplace for **iOS and Android**, supporting both **personal cab bookings** and **shared/intercity cab journeys**.

The platform connects customers with verified drivers and allows passengers to reduce travel costs by sharing rides with other passengers travelling on the same or overlapping routes.

---

## 1. Project Overview

The application consists of three major systems:

* Customer Mobile App
* Driver Mobile App
* Admin Web Panel

The platform will support:

* Local cab bookings
* Intercity cab bookings
* Personal/private cab
* Shared cab
* Route-based passenger matching
* Driver verification
* Customer verification
* Live driver tracking
* Online payments
* Ratings and reviews
* Driver earnings
* Admin management

---

## 2. Core Business Concept

A customer can book an entire cab for a journey.

Example:

```text
Mohali → Delhi
Distance: 250 km
Minimum rate: ₹10/km

Estimated minimum fare:
250 × ₹10 = ₹2,500
```

If the customer considers the personal cab too expensive, they can choose:

```text
SHARE CAB
```

The customer can then find or publish a shared journey.

Example:

```text
Passenger A:
Mohali → Delhi

Passenger B:
Chandigarh → Delhi

Passenger C:
Ambala → Delhi
```

The system should identify overlapping routes and allow eligible passengers to share the journey.

---

# 3. Applications

## 3.1 Customer App

The customer can:

* Register/login
* Verify phone number
* Complete profile
* Complete required identity verification
* Select pickup
* Select destination
* Select date/time
* Choose Personal Cab
* Choose Shared Cab
* View fare
* Search available rides
* Book a cab
* Join a shared ride
* Track driver
* Contact driver
* Pay
* Cancel
* Rate driver
* View ride history
* View notifications

---

## 3.2 Driver App

The driver can:

* Register/login
* Verify phone
* Complete profile
* Submit identity verification
* Upload driving licence
* Upload vehicle documents
* Submit insurance/documentation as required
* Add vehicle
* Wait for admin approval
* Go online/offline
* Receive ride requests
* Accept/reject rides
* View passenger information
* Navigate to pickup
* Start trip
* Complete trip
* View earnings
* View completed rides
* Receive ratings

Only approved drivers can receive rides.

---

## 3.3 Admin Panel

The admin can manage:

* Customers
* Drivers
* Driver verification
* Vehicles
* Documents
* Bookings
* Active rides
* Shared rides
* Payments
* Refunds
* Driver earnings
* Ratings
* Complaints
* Pricing
* Notifications
* Reports
* Admin users
* Audit logs

---

# 4. Ride Types

## Personal Cab

```text
Customer
    ↓
Pickup
    ↓
Destination
    ↓
Personal Cab
    ↓
Fare Calculation
    ↓
Driver/Ride Selection
    ↓
Booking
    ↓
Payment
    ↓
Trip
    ↓
Rating
```

---

## Shared Cab

```text
Customer
    ↓
Pickup
    ↓
Destination
    ↓
Share Cab
    ↓
Search Existing Routes
    ↓
Route Matching
    ↓
Available Shared Rides
    ↓
Select Ride
    ↓
Reserve Seat
    ↓
Payment
    ↓
Trip
    ↓
Rating
```

---

# 5. Pricing

Pricing must be configurable from the Admin Panel.

Do not hard-code pricing inside the mobile application.

Initial minimum rate:

```text
₹10–₹11 per kilometre
```

Example:

```text
Distance = 250 km
Rate = ₹10/km

Minimum distance fare = ₹2,500
```

The system should support configurable:

* Base fare
* Per-kilometre rate
* Per-minute rate
* Minimum fare
* Platform fee
* Driver commission
* Waiting fee
* Cancellation fee
* Toll handling
* Shared ride pricing

---

# 6. Shared Ride Matching

Shared ride matching is a core feature.

The system must not match passengers only when their pickup and destination are identical.

It should evaluate:

* Pickup proximity
* Destination proximity
* Route overlap
* Departure time
* Available seats
* Detour distance
* Additional travel time

Example:

```text
Driver Route:

Mohali
  ↓
Chandigarh
  ↓
Ambala
  ↓
Kurukshetra
  ↓
Karnal
  ↓
Panipat
  ↓
Delhi
```

Possible passengers:

```text
Mohali → Delhi
Chandigarh → Delhi
Ambala → Delhi
Karnal → Delhi
```

The system should identify eligible route overlaps.

---

# 7. Route Matching Score

The backend should calculate a route compatibility score.

Example:

```text
Route Match: 92%
```

Possible categories:

```text
90–100% = Excellent Match
70–89%  = Good Match
50–69%  = Possible Match
Below 50% = Not Recommended
```

These thresholds must remain configurable.

The final matching algorithm should also consider:

* Maximum acceptable detour
* Maximum pickup distance
* Maximum destination deviation
* Time difference
* Vehicle capacity

---

# 8. Passenger Capacity

Example:

```text
Vehicle capacity = 4 seats

Passenger A = 2 seats

Remaining = 2 seats
```

The backend must prevent overbooking.

Two customers must never be able to reserve the same remaining seat simultaneously.

Use database transactions/constraints where appropriate.

---

# 9. Driver Verification

Driver verification may require:

* Phone verification
* Identity verification
* Driving licence
* Vehicle registration
* Insurance
* Other legally required documentation

Driver statuses:

```text
PENDING
UNDER_REVIEW
VERIFIED
REJECTED
SUSPENDED
```

Only:

```text
VERIFIED
```

drivers can receive rides.

Sensitive identity information must be protected and should not be unnecessarily stored.

---

# 10. Customer Verification

Customer verification should support:

* Phone verification
* Identity verification where required

Drivers must not receive unnecessary sensitive customer information.

---

# 11. Database

The initial relational database should contain:

```text
users
customers
drivers
driver_documents
vehicles
vehicle_documents
locations
rides
ride_requests
shared_rides
shared_ride_passengers
bookings
payments
payment_transactions
driver_earnings
ratings
reviews
notifications
messages
cancellations
complaints
pricing_settings
admin_users
audit_logs
```

---

# 12. Main Relationships

```text
USER
 ├── CUSTOMER
 └── DRIVER
       └── VEHICLE
```

```text
RIDE
 ├── DRIVER
 ├── BOOKING
 ├── BOOKING
 └── BOOKING
```

```text
SHARED_RIDE
 ├── DRIVER
 ├── PASSENGER
 ├── PASSENGER
 └── PASSENGER
```

---

# 13. Ride Status

Use controlled ride states:

```text
REQUESTED
ACCEPTED
DRIVER_EN_ROUTE
ARRIVED
TRIP_STARTED
TRIP_COMPLETED
CANCELLED
```

Invalid state transitions must be prevented.

---

# 14. Payment Status

Payment records should support:

```text
PENDING
PROCESSING
SUCCESS
FAILED
REFUNDED
PARTIALLY_REFUNDED
```

Never use only a simple:

```text
payment = true/false
```

field.

---

# 15. Maps & Location

The application requires a mapping/location provider.

Required features:

* Current location
* Pickup location
* Destination
* Route
* Distance
* ETA
* Driver live location
* Navigation
* Route matching

Location permissions must be implemented correctly for both iOS and Android.

---

# 16. Notifications

Push notifications are required for:

* OTP
* Verification
* Driver approval
* Driver rejection
* New ride request
* Ride acceptance
* Driver approaching
* Driver arrival
* Trip started
* Trip completed
* Payment
* Cancellation
* Shared ride match
* Shared ride confirmation
* Important announcements

---

# 17. Security

The application must implement:

* Authentication
* Role-based authorization
* Secure database access
* Secure file storage
* Private document access
* Server-side validation
* Payment security
* API key protection
* Audit logging
* Rate limiting where appropriate

Never expose private customer or driver documents publicly.

---

# 18. Recommended Technology

Initial MVP stack:

### Mobile

FlutterFlow / Flutter

### Backend

Supabase

### Database

PostgreSQL

### Maps

Google Maps Platform or another suitable mapping provider

### Notifications

Firebase Cloud Messaging or equivalent

### Payments

A supported Indian payment gateway

### Design

Figma

### Source Control

GitHub

---

# 19. Project Structure

A possible project structure:

```text
cab-service-app/
│
├── README.md
│
├── docs/
│   ├── product-requirements.md
│   ├── user-flows.md
│   ├── database-schema.md
│   ├── pricing-rules.md
│   ├── shared-ride-matching.md
│   ├── api-documentation.md
│   └── security.md
│
├── customer-app/
│
├── driver-app/
│
├── admin-panel/
│
├── backend/
│
└── database/
```

---

# 20. Development Phases

## Phase 1 — Planning

* Business requirements
* User roles
* User flows
* Pricing rules
* Shared ride rules
* Database design

## Phase 2 — UI/UX

Create Figma designs for:

* Customer app
* Driver app
* Admin panel

## Phase 3 — Authentication

Build:

* Signup
* Login
* OTP
* Roles
* Profiles

## Phase 4 — Customer Booking

Build:

* Pickup
* Destination
* Maps
* Fare calculation
* Personal cab booking

## Phase 5 — Driver System

Build:

* Driver registration
* Document upload
* Verification
* Vehicle
* Online/offline
* Ride requests

## Phase 6 — Admin

Build:

* Dashboard
* Driver approval
* Customer management
* Ride management
* Pricing management

## Phase 7 — Payments

Integrate payment gateway.

## Phase 8 — Shared Cab

Build:

* Shared ride publishing
* Route matching
* Seat availability
* Shared booking
* Shared pricing

## Phase 9 — Live Tracking

Implement:

* Driver location
* ETA
* Trip status

## Phase 10 — Testing

Test:

* Normal flow
* Cancellation
* Payment failure
* Network failure
* Location failure
* Duplicate booking
* Overbooking
* Shared ride conflicts
* Driver rejection
* Customer cancellation

## Phase 11 — Production

Prepare:

* Production database
* Security
* App signing
* iOS build
* Android build
* App Store submission
* Google Play submission
* Production monitoring

---

# 21. MVP

The first production-ready MVP should include:

### Customer

* Login
* Profile
* Verification
* Personal cab
* Shared cab
* Maps
* Fare
* Booking
* Payment
* Tracking
* Cancellation
* Rating
* History

### Driver

* Registration
* Verification
* Documents
* Vehicle
* Approval
* Online/offline
* Ride requests
* Accept/reject
* Start/end trip
* Earnings
* History

### Admin

* Dashboard
* Customers
* Drivers
* Verification
* Vehicles
* Bookings
* Rides
* Shared rides
* Payments
* Pricing
* Complaints
* Reports

---

# 22. Future Features

Do not build these in the first MVP unless required:

* Wallet
* Referral program
* Coupons
* Loyalty points
* Corporate accounts
* Subscriptions
* Driver bidding
* Multiple countries
* Multi-language
* AI assistant
* Advanced dynamic pricing

The architecture should allow these features to be added later.

---

# 23. Development Principle

Build the system module by module.

Do NOT generate the entire application as one large implementation.

Recommended order:

```text
Authentication
      ↓
Database
      ↓
Customer
      ↓
Driver
      ↓
Admin
      ↓
Personal Booking
      ↓
Payments
      ↓
Live Tracking
      ↓
Shared Ride
      ↓
Route Matching
      ↓
Testing
      ↓
Production
```

Every module must be tested before moving to the next module.

---

# 24. Success Criteria

The MVP is considered functional when:

1. A customer can register.
2. A driver can register.
3. Admin can verify the driver.
4. Customer can select pickup and destination.
5. System calculates distance.
6. System calculates fare.
7. Customer can request a personal cab.
8. Driver can receive and accept the request.
9. Customer can see driver status.
10. Driver can start the trip.
11. Driver can complete the trip.
12. Payment can be recorded.
13. Customer can rate the driver.
14. Customer can request a shared ride.
15. System can identify compatible routes.
16. Customer can join an available shared ride.
17. Seat availability is updated correctly.
18. Admin can manage pricing.
19. Admin can manage drivers.
20. Admin can monitor rides.

---

## Project Status

Current stage:

```text
PLANNING
```

Next milestone:

```text
PRODUCT REQUIREMENTS
        ↓
USER FLOWS
        ↓
FIGMA UI/UX
        ↓
DATABASE
        ↓
MVP DEVELOPMENT
```

---

## Important

This README is the high-level source of truth for the project.

Any future feature should be evaluated against:

* Business requirements
* User experience
* Database architecture
* Security
* Scalability
* Mobile compatibility
* Admin requirements
* Legal/compliance requirements

Do not add features only because they are technically possible.

Prioritize a reliable booking, driver, payment and shared-ride experience.
