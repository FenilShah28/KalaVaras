import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

let io: SocketIOServer | null = null;

/**
 * Initialize Socket.IO server attached to the HTTP server.
 *
 * Security:
 * - CORS restricted to FRONTEND_URL (same as REST API)
 * - Every socket connection authenticated via JWT in handshake auth header
 * - Unauthenticated connections rejected immediately
 * - Each user joined to a private room: `user:<userId>`
 *   so server can push events to a specific user only
 */
export function initSocket(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.FRONTEND_URL,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // ── Auth middleware ──────────────────────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as {
        userId: string;
        role: string;
      };

      // Attach user info to socket for use in event handlers
      (socket as any).userId = payload.userId;
      (socket as any).role = payload.role;

      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  // ── Connection handler ───────────────────────────────────────────
  io.on('connection', (socket) => {
    const userId = (socket as any).userId as string;

    // Join user-specific room — server pushes to `user:<id>` for IDOR safety
    socket.join(`user:${userId}`);

    logger.info('WebSocket connected', { userId, socketId: socket.id });

    // Client can subscribe to specific card's processing events
    socket.on('subscribe:card', (cardId: string) => {
      socket.join(`card:${cardId}`);
    });

    socket.on('unsubscribe:card', (cardId: string) => {
      socket.leave(`card:${cardId}`);
    });

    socket.on('disconnect', (reason) => {
      logger.info('WebSocket disconnected', { userId, reason });
    });

    socket.on('error', (err) => {
      logger.warn('WebSocket error', { userId, error: err.message });
    });
  });

  logger.info('Socket.IO server initialized');
  return io;
}

/**
 * Get the Socket.IO server instance.
 * Throws if called before initSocket().
 */
export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.IO not initialized — call initSocket() first');
  }
  return io;
}
