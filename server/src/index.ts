import 'dotenv/config';

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';

import authMiddleware from './middleware/auth';
import authRoutes from './routes/auth';
import recipeRoutes from './routes/recipes';
import substitutionRoutes from './routes/substitutions';
import cookLogRoutes from './routes/cookLogs';
import statsRoutes from './routes/stats';
import variationRoutes from './routes/variations';

const app = express();
const PORT = (process.env.PORT || 3000) as number;

// Ensure upload directories exist
const uploadsDir = path.join(__dirname, '../uploads/cook-logs');
fs.mkdirSync(uploadsDir, { recursive: true });

// Middleware
app.use(cors());
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files through authenticated route
app.use('/uploads', authMiddleware, express.static(path.join(__dirname, '../uploads')));

// Public routes
app.use('/api/auth', authRoutes);

// Protected routes
app.use('/api/recipes', authMiddleware, recipeRoutes);
app.use('/api/substitutions', authMiddleware, substitutionRoutes);
app.use('/api/cook-logs', authMiddleware, cookLogRoutes);
app.use('/api/stats', authMiddleware, statsRoutes);
app.use('/api/variations', authMiddleware, variationRoutes);

// Health check
app.get('/api/health', (_req: Request, res: Response): void => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Cleanup expired refresh tokens on startup
import db from './db/init';
const expired = db.prepare("DELETE FROM refresh_tokens WHERE expires_at < datetime('now')").run();
if (expired.changes > 0) {
  console.log(`Cleaned up ${expired.changes} expired refresh tokens`);
}

// Error handling
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Only start listener when run directly (not when imported for testing)
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`RecipeRiff backend running on port ${PORT}`);
  });
}

export default app;
