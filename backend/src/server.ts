import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import config from './config/environment';
import { initDatabase } from './config/database';
import { corsMiddleware } from './middleware/cors.middleware';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import logger from './utils/logger';

// Import routes
import userRoutes from './routes/user.routes';
import bookRoutes from './routes/book.routes';
import progressRoutes from './routes/progress.routes';
import bookmarkRoutes from './routes/bookmark.routes';
import settingsRoutes from './routes/settings.routes';

const ensureDirectories = () => {
  const dirs = [
    config.storage.booksDir,
    config.storage.coversDir,
    path.dirname(config.database.path),
    'logs',
  ];

  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.info(`Created directory: ${dir}`);
    }
  });
};

const app = express();
const server = http.createServer(app);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(corsMiddleware);

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.env,
  });
});

// API info
app.get('/api', (_req, res) => {
  res.json({
    message: 'Ebook Reader API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      users: '/api/users',
      books: '/api/books',
      progress: '/api/users/:userId/progress',
    },
  });
});

// Routes
app.use('/api', userRoutes);
app.use('/api', bookRoutes);
app.use('/api', progressRoutes);
app.use('/api', bookmarkRoutes);
app.use('/api', settingsRoutes);

// Error handlers
app.use(notFoundHandler);
app.use(errorHandler);

const startServer = () => {
  try {
    ensureDirectories();

    console.log('Initializing database...');
    initDatabase();

    server.listen(config.port, '0.0.0.0', () => {
      console.log(`Server is listening on port ${config.port}`);
      logger.info(`Server running on port ${config.port}`);
      logger.info(`Environment: ${config.env}`);
    });

    server.on('error', (error: NodeJS.ErrnoException) => {
      console.error('Server error:', error);
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${config.port} is already in use`);
      }
      logger.error('Server error:', error);
      process.exit(1);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    console.error('Server startup error:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

startServer();

export { app };
