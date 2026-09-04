import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  jwtSecret: process.env.JWT_SECRET || 'apex-property-management-secret-key-2026',
  jwtExpiresIn: '7d',
  dbPath: process.env.DB_PATH || path.resolve(process.cwd(), 'property_rental.db'),
  defaultGraceDays: parseInt(process.env.DEFAULT_GRACE_DAYS || '5', 10),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
};
