const path = require('path');
const fs = require('fs');
const EmbeddedPostgres = require('embedded-postgres').default;

const DB_DIR  = path.join(__dirname, '.embedded-pg-data');
const PG_USER = 'postgres';
const PG_PASS = 'VectoLocalOnly2026!';
const PG_PORT = 5432;
const PG_DB   = 'postgres';

async function main() {
  console.log('Starting embedded PostgreSQL on port 5432...');
  const pg = new EmbeddedPostgres({
    databaseDir: DB_DIR,
    user:        PG_USER,
    password:    PG_PASS,
    port:        PG_PORT,
    persistent:  true,
  });

  const isInitialised = fs.existsSync(path.join(DB_DIR, 'PG_VERSION'));
  if (!isInitialised) {
    try {
      await pg.initialise();
    } catch (e) {
      console.log('Init skipped');
    }
  }

  await pg.start();
  console.log('Embedded PostgreSQL running on port ' + PG_PORT);

  try {
    await pg.createDatabase(PG_DB);
    console.log('Database created');
  } catch (e) {
    console.log('Database already exists');
  }

  process.on('SIGINT', async () => {
    console.log('Stopping PostgreSQL...');
    await pg.stop();
    process.exit(0);
  });
  process.on('SIGTERM', async () => {
    console.log('Stopping PostgreSQL...');
    await pg.stop();
    process.exit(0);
  });

  // Keep process alive
  setInterval(() => {}, 10000);
}

main().catch((err) => {
  console.error('Failed to start postgres:', err);
  process.exit(1);
});
