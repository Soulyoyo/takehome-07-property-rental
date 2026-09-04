import { createApp } from './app.js';
import { config } from './config.js';
import { getDb, closeDb } from './db/database.js';
import { seedDatabase } from './db/seed.js';

async function bootstrap() {
  const db = getDb();

  // Auto-seed if users table is empty
  const userCount = db.prepare(`SELECT COUNT(*) as count FROM users`).get() as { count: number };
  if (!userCount || userCount.count === 0) {
    console.log('Database empty. Running seed...');
    seedDatabase(db);
  }

  const app = createApp();

  const server = app.listen(config.port, () => {
    console.log(`🚀 Apex Property Rental Server listening on port ${config.port}`);
    console.log(`📊 Health check: http://localhost:${config.port}/api/health`);
  });

  const shutdown = () => {
    console.log('Stopping server gracefully...');
    server.close(() => {
      closeDb();
      console.log('Server closed and database disconnected.');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch(err => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
