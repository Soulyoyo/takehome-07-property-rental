import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.routes.js';
import unitRoutes from './routes/unit.routes.js';
import maintenanceRoutes from './routes/maintenance.routes.js';
import rentRoutes from './routes/rent.routes.js';
import alertRoutes from './routes/alert.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';

export function createApp() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Health check
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'Apex Property Rental & Maintenance API', timestamp: new Date().toISOString() });
  });

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/units', unitRoutes);
  app.use('/api/maintenance', maintenanceRoutes);
  app.use('/api/rent', rentRoutes);
  app.use('/api/alerts', alertRoutes);
  app.use('/api/dashboard', dashboardRoutes);

  // Serve static client bundle if it exists (for single-server deployment)
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const clientDistPath = path.resolve(currentDir, '../../client/dist');
  if (fs.existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath));
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method === 'GET' && !req.path.startsWith('/api')) {
        return res.sendFile(path.join(clientDistPath, 'index.html'));
      }
      next();
    });
  }

  // 404 Handler for API
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api')) {
      res.status(404).json({ error: `Endpoint ${req.method} ${req.originalUrl} not found.` });
      return;
    }
    next();
  });

  // Global Error Handler
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('Unhandled server error:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Internal server error',
    });
  });

  return app;
}
