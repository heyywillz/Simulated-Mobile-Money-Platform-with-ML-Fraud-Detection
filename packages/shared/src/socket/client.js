/**
 * Real Socket.io client connecting to Express backend on http://localhost:5000
 * with MockSocket fallback if socket server is unreachable.
 */

import { io } from 'socket.io-client';
import { simEvents } from '../api/store';

export class MockSocket {
  constructor() {
    this.listeners = {};
    this.domListeners = {};
  }

  on(event, fn) {
    const ev = String(event);
    if (!this.listeners[ev]) this.listeners[ev] = [];
    this.listeners[ev].push(fn);

    simEvents.on(ev, fn);

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      const domHandler = (e) => {
        try {
          fn(e.detail);
        } catch {}
      };
      this.domListeners[`${ev}_${this.listeners[ev].length}`] = domHandler;
      window.addEventListener(`momo_sim:${ev}`, domHandler);
    }
    return this;
  }

  off(event, fn) {
    const ev = String(event);
    if (this.listeners[ev]) {
      this.listeners[ev] = this.listeners[ev].filter((l) => l !== fn);
    }
    simEvents.off(ev, fn);
    return this;
  }

  emit(event, ...args) {
    simEvents.emit(event, ...args);
    return this;
  }

  disconnect() {
    if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
      Object.entries(this.domListeners).forEach(([key, handler]) => {
        const eventName = key.substring(0, key.lastIndexOf('_'));
        window.removeEventListener(`momo_sim:${eventName}`, handler);
      });
      this.domListeners = {};
    }
    this.listeners = {};
  }
}

function resolveWsUrl() {
  if (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_SOCKET_URL) {
    return process.env.EXPO_PUBLIC_SOCKET_URL;
  }
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SOCKET_URL) {
      return import.meta.env.VITE_SOCKET_URL;
    }
  } catch {}
  return 'http://localhost:5000';
}

const BACKEND_WS_URL = resolveWsUrl();

let adminSocketInstance = null;

/**
 * Create or get socket connection for the admin portal.
 */
export function createAdminSocket(token, wsUrl = BACKEND_WS_URL) {
  try {
    if (!adminSocketInstance || !adminSocketInstance.connected) {
      adminSocketInstance = io(wsUrl, {
        transports: ['websocket', 'polling'],
        withCredentials: true,
        auth: { token },
      });
      console.log('[Socket] Connected admin socket to:', wsUrl);
    }
    return adminSocketInstance;
  } catch (err) {
    console.warn('[Socket] Connection failed, using fallback:', err);
    return new MockSocket();
  }
}

let userSocketInstance = null;

/**
 * Create socket connection for user clients.
 */
export function createUserSocket(token, sessionId, wsUrl = BACKEND_WS_URL) {
  try {
    if (!userSocketInstance || !userSocketInstance.connected) {
      userSocketInstance = io(wsUrl, {
        transports: ['websocket', 'polling'],
        withCredentials: true,
        auth: { token, sessionId },
      });
    }
    return userSocketInstance;
  } catch (err) {
    return new MockSocket();
  }
}
