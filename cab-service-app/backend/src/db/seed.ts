// DEVELOPMENT / DEMO DATA ONLY. Refuses to run in production.
import { env } from '../config/env';
import { migrate } from './migrate';
import { pool, tx } from './pool';
import { hashPassword } from '../utils/crypto';

async function main() {
  if (env.NODE_ENV === 'production') throw new Error('Seeding is disabled in production.');
  if (!env.SEED_ADMIN_EMAIL || !env.SEED_ADMIN_PASSWORD)
    throw new Error('Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (min 10 characters) in your .env first.');
  await migrate(false);

  await tx(async (c) => {
    // Demo admin
    const a = await c.query(`INSERT INTO users(role,email) VALUES ('ADMIN',$1) ON CONFLICT (email) DO UPDATE SET email=EXCLUDED.email RETURNING id`, [env.SEED_ADMIN_EMAIL!.toLowerCase()]);
    await c.query(`INSERT INTO admin_users(user_id,full_name,password_hash,admin_role) VALUES ($1,'Demo Admin',$2,'SUPER_ADMIN')
                   ON CONFLICT (user_id) DO UPDATE SET password_hash=EXCLUDED.password_hash`, [a.rows[0].id, hashPassword(env.SEED_ADMIN_PASSWORD!)]);

    // Demo customer (phone 9000000001)
    const cu = await c.query(`INSERT INTO users(role,phone) VALUES ('CUSTOMER','9000000001') ON CONFLICT (phone) DO UPDATE SET phone=EXCLUDED.phone RETURNING id`);
    await c.query(`INSERT INTO customers(user_id,full_name) VALUES ($1,'Demo Customer') ON CONFLICT (user_id) DO NOTHING`, [cu.rows[0].id]);

    // Demo verified driver (phone 9000000002) with a vehicle
    const dr = await c.query(`INSERT INTO users(role,phone) VALUES ('DRIVER','9000000002') ON CONFLICT (phone) DO UPDATE SET phone=EXCLUDED.phone RETURNING id`);
    await c.query(`INSERT INTO drivers(user_id,full_name,address,status) VALUES ($1,'Demo Driver','Sector 70, Mohali','VERIFIED') ON CONFLICT (user_id) DO NOTHING`, [dr.rows[0].id]);
    await c.query(`INSERT INTO vehicles(driver_id,category,make_model,reg_number,seats_total,color) VALUES ($1,'SEDAN','Maruti Dzire (demo)','PB65DEMO0001',4,'White') ON CONFLICT (reg_number) DO NOTHING`, [dr.rows[0].id]);
  });
  console.log('Demo data ready. Demo customer 9000000001, demo driver 9000000002 (log in with an OTP from the server window), demo admin from your .env.');
}
main().then(() => pool.end()).catch((e) => { console.error(e.message); process.exit(1); });
