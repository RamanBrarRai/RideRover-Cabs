# Seed data

Demo data is created by the backend seed command (it needs to hash the admin password, which plain SQL cannot do safely):

    cd backend
    npm run seed

It creates a demo admin (email and password from your `.env`), a demo customer (9000000001), and a verified demo driver
with one vehicle (9000000002). Demo accounts are for development only. The command refuses to run when `NODE_ENV=production`.
