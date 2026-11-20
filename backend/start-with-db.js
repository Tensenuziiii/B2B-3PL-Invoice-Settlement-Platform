/**
 * start-with-db.js
 * Boots an embedded PostgreSQL instance, runs Prisma migrations + seed,
 * then starts the NestJS backend — all in one command.
 *
 * Usage: node start-with-db.js
 */

const path = require('path');
const { execSync, spawn } = require('child_process');
const EmbeddedPostgres = require('embedded-postgres').default;

const DB_DIR  = path.join(__dirname, '.embedded-pg-data');
const PG_USER = 'postgres';
const PG_PASS = 'VectoLocalOnly2026!';
const PG_PORT = 5432;
const PG_DB   = 'postgres';

async function main() {
  console.log('\n🐘 Starting embedded PostgreSQL...');

  const pg = new EmbeddedPostgres({
    databaseDir: DB_DIR,
    user:        PG_USER,
    password:    PG_PASS,
    port:        PG_PORT,
    persistent:  true,   // keeps data between restarts
  });

  // initialise only creates the data directory on first run
  await pg.initialise();
  await pg.start();
  console.log(`✅ PostgreSQL running on port ${PG_PORT}`);

  // Create the database if it doesn't already exist
  try {
    await pg.createDatabase(PG_DB);
    console.log(`✅ Database "${PG_DB}" created`);
  } catch (e) {
    // already exists — that's fine
    console.log(`ℹ️  Database "${PG_DB}" already exists`);
  }

  // Run Prisma migrations
  console.log('\n⚙️  Running Prisma migrations...');
  execSync('npx prisma migrate deploy', { stdio: 'inherit', cwd: __dirname });
  console.log('✅ Migrations applied');

  // Seed demo data (ignore error if already seeded)
  console.log('\n🌱 Seeding demo data...');
  try {
    execSync('npx ts-node prisma/seed.ts', { stdio: 'inherit', cwd: __dirname });
    console.log('✅ Seed complete');
  } catch (e) {
    console.log('ℹ️  Seed skipped (may already be seeded)');
  }

  // Start NestJS in watch mode
  console.log('\n🚀 Starting NestJS backend...\n');
  const nest = spawn('npx', ['nest', 'start', '--watch'], {
    stdio: 'inherit',
    cwd: __dirname,
    shell: true,
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n⏹ Stopping NestJS and PostgreSQL...');
    nest.kill();
    await pg.stop();
    console.log('✅ Shutdown complete');
    process.exit(0);
  };

  process.on('SIGINT',  shutdown);
  process.on('SIGTERM', shutdown);

  nest.on('exit', async (code) => {
    console.log(`NestJS exited with code ${code}`);
    await pg.stop();
    process.exit(code ?? 0);
  });
}

main().catch(async (err) => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});
