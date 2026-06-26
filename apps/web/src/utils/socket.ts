import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';
import { logger } from './logger';

/**
 * Processing status event from the server.
 * Emitted at 10%, 70%, and 100% of slit-scan pipeline.
 */
export interface ProcessingStatus {
  assetId: string;
  strokeCardId: string;
  status: 'processing' | 'complete' | 'failed';
  progress?: number;
  slitScanUrl?: string | null;
  rhythmWaveformUrl?: string | null;
  error?: string;
}

type StatusHandler = (status: ProcessingStatus) => void;

let socketInstance: Socket | null = null;

/**
 * Get (or create) the singleton Socket.IO connection.
 * Connects with the access token from the Zustand store.
 * Returns null if unauthenticated.
 */
function getSocket(accessToken: string): Socket {
  if (socketInstance?.connected) return socketInstance;

  socketInstance = io(import.meta.env.VITE_API_URL ?? 'http://localhost:4000', {
    auth: { token: accessToken },
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  });

  socketInstance.on('connect', () => {
    logger.info('WebSocket connected');
  });

  socketInstance.on('connect_error', (err) => {
    logger.warn('WebSocket connection error', err.message);
  });

  socketInstance.on('disconnect', (reason) => {
    logger.info('WebSocket disconnected', reason);
  });

  return socketInstance;
}

/**
 * Disconnect and clear the singleton socket.
 * Called on logout.
 */
export function disconnectSocket() {
  socketInstance?.disconnect();
  socketInstance = null;
}

// =====================================================================
// useProcessingStatus hook
// =====================================================================

/**
 * Subscribe to real-time processing status events for a specific asset.
 *
 * Usage:
 * ```tsx
 * const { status, progress } = useProcessingStatus(assetId, cardId, (s) => {
 *   if (s.status === 'complete') refetchMedia();
 * });
 * ```
 */
export function useProcessingStatus(
  assetId: string | null,
  strokeCardId: string | null,
  onUpdate: StatusHandler,
) {
  const accessToken = useAuthStore(s => s.accessToken);
  const handlerRef = useRef(onUpdate);
  handlerRef.current = onUpdate; // Always use latest handler without re-subscribing

  useEffect(() => {
    if (!assetId || !strokeCardId || !accessToken) return;

    const socket = getSocket(accessToken);

    // Subscribe to card-specific room
    socket.emit('subscribe:card', strokeCardId);

    const handleStatus = (data: ProcessingStatus) => {
      if (data.assetId === assetId) {
        handlerRef.current(data);
      }
    };

    socket.on('processing:status', handleStatus);

    return () => {
      socket.off('processing:status', handleStatus);
      socket.emit('unsubscribe:card', strokeCardId);
    };
  }, [assetId, strokeCardId, accessToken]);
}
