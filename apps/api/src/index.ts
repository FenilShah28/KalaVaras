import http from 'http';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { corsOptions } from './config/cors.js';
import { helmetMiddleware } from './middleware/helmet.js';
import { requestId } from './middleware/requestId.js';
import { readLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';
import { logger } from './utils/logger.js';
import { sendSuccess } from './utils/apiResponse.js';
import { initSocket } from './config/socket.js';
import { closeQueues } from './config/queue.js';
import authRoutes from './routes/auth.routes.js';
import cardRoutes from './routes/cards.routes.js';
import mediaRoutes from './routes/media.routes.js';
import practiceRoutes from './routes/practice.routes.js';
import syncRoutes from './routes/sync.routes.js';

// Import workers — side-effect import starts the BullMQ workers
import './workers/slitScan.worker.js';

const app = express();

// ==================================================================
// MIDDLEWARE STACK — order matters for security
// ==================================================================

// 1. Request tracing — adds X-Request-ID (uuid) to every response
app.use(requestId);

// 2. Security headers — CSP, HSTS (1yr), X-Frame-Options: DENY, nosniff
app.use(helmetMiddleware);

// 3. CORS — whitelist FRONTEND_URL only, never origin: *
app.use(cors(corsOptions));

// 4. HTTP Parameter Pollution prevention (Handled by Zod schema strict types)

// 5. Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// 6. Cookie parser — for httpOnly refresh token cookies
app.use(cookieParser());

// 7. Default rate limiter for general read endpoints
app.use(readLimiter);

// ==================================================================
// HTTPS ENFORCEMENT — redirect HTTP to HTTPS in production
// ==================================================================
if (env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] !== 'https') {
      res.redirect(301, `https://${req.headers.host}${req.url}`);
      return;
    }
    next();
  });
}

// ==================================================================
// ROUTES
// ==================================================================

app.get('/health', (_req, res) => {
  sendSuccess(res, {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

app.get('/api/v1', (_req, res) => {
  sendSuccess(res, {
    name: 'KalaVaras API',
    version: '1.0.0',
    description: 'Folk Art Motor Memory Platform',
  });
});

// Auth — register, login, refresh, logout, verify, reset
app.use('/api/v1/auth', authRoutes);

// Stroke card CRUD — RBAC + ownership enforced in service layer
app.use('/api/v1/cards', cardRoutes);

// Media upload — multer + EXIF stripping + R2 + BullMQ slit-scan
app.use('/api/v1/media', mediaRoutes);

// Practice sessions + progress dashboard + IST streak tracking
app.use('/api/v1/practice', practiceRoutes);

// Offline batch sync — sequential processing, replay-safe
app.use('/api/v1/sync', syncRoutes);

// ==================================================================
// ERROR HANDLING — must be last middleware
// ==================================================================
app.use(errorHandler);

// ==================================================================
// HTTP SERVER + SOCKET.IO
// Socket.IO must attach to the raw HTTP server, not Express directly
// ==================================================================
const httpServer = http.createServer(app);
initSocket(httpServer);

const PORT = env.API_PORT;

if (env.USE_LOCAL_MOCKS) {
  const { migrate } = await import('drizzle-orm/pglite/migrator');
  const { db } = await import('./config/database.js');
  const path = await import('path');
  logger.info('Applying PGLite migrations for local mock database...');
  await migrate(db, { migrationsFolder: path.resolve('src/db/migrations') });
  logger.info('Mock database ready.');
}

httpServer.listen(PORT, () => {
  logger.info('🚀 KalaVaras API server running', {
    environment: env.NODE_ENV,
    port: PORT,
    frontendUrl: env.FRONTEND_URL,
    websocket: 'enabled',
    workers: ['slit-scan'],
  });
});

// ==================================================================
// GRACEFUL SHUTDOWN
// ==================================================================
const shutdown = async (signal: string) => {
  logger.info(`${signal} received — shutting down gracefully`);

  httpServer.close(async () => {
    await closeQueues();
    logger.info('Server closed');
    process.exit(0);
  });

  // Force exit after 10 seconds if graceful shutdown hangs
  setTimeout(() => {
    logger.error('Graceful shutdown timed out — forcing exit');
    process.exit(1);
  }, 10_000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export { app, httpServer };
