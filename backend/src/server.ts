import { createApp } from './app';
import { env } from './config/env';
import { migrate } from './db/migrate';
import { pool } from './db/pool';

async function main() {
  await migrate(false); // keeps the database up to date every time the server starts
  const server = createApp().listen(env.PORT, () => console.log(`API running on http://localhost:${env.PORT}`));
  const stop = () => server.close(() => pool.end().then(() => process.exit(0)));
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
main().catch((e) => { console.error(e.message); process.exit(1); });
