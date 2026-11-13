'use client';

import { io, Socket } from 'socket.io-client';
import { getAuthToken, getBackendSocketUrl } from './backend-auth';

export interface BackendRealtimeHandlers {
  onConnect?: () => void;
  onDisconnect?: (reason: string) => void;
  onConnectError?: (err: Error) => void;
  onMessageNew?: (payload: any) => void;
  onMessageUpdated?: (payload: any) => void;
  onMessageDeleted?: (payload: { id: string; conversationId: string }) => void;
  onMessageRead?: (payload: any) => void;
  onConversationCreated?: (payload: any) => void;
  onConversationUpdated?: (payload: any) => void;
  onTypingUpdate?: (payload: {
    conversationId: string;
    userId: string;
    userName: string;
    isTyping: boolean;
  }) => void;
  onPresenceUpdate?: (payload: { userId: string; status: 'online' | 'away' | 'offline' }) => void;
}

export interface BackendRealtimeClient {
  socket: Socket;
  joinConversation: (conversationId: string) => void;
  leaveConversation: (conversationId: string) => void;
  sendTyping: (conversationId: string, isTyping: boolean) => void;
  markRead: (conversationId: string) => void;
  disconnect: () => void;
}

export function createBackendRealtimeClient(
  handlers: BackendRealtimeHandlers,
  explicitToken?: string | null
): BackendRealtimeClient | null {
  if (typeof window === 'undefined') return null;
  if (process.env.NEXT_PUBLIC_REALTIME_ENABLED === 'false') return null;
  const token = explicitToken ?? getAuthToken();
  if (!token) return null;

  const socketBaseUrl = getBackendSocketUrl();
  if (!socketBaseUrl) return null;

  const socket = io(`${socketBaseUrl}/realtime`, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 4,
    reconnectionDelay: 2000,
  });

  if (handlers.onConnect) {
    socket.on('connect', handlers.onConnect);
  }
  if (handlers.onDisconnect) {
    socket.on('disconnect', handlers.onDisconnect);
  }
  if (handlers.onConnectError) {
    socket.on('connect_error', handlers.onConnectError);
  }
  if (handlers.onMessageNew) {
    socket.on('message:new', handlers.onMessageNew);
  }
  if (handlers.onMessageUpdated) {
    socket.on('message:updated', handlers.onMessageUpdated);
  }
  if (handlers.onMessageDeleted) {
    socket.on('message:deleted', handlers.onMessageDeleted);
  }
  if (handlers.onMessageRead) {
    socket.on('message:read', handlers.onMessageRead);
  }
  if (handlers.onConversationCreated) {
    socket.on('conversation:created', handlers.onConversationCreated);
  }
  if (handlers.onConversationUpdated) {
    socket.on('conversation:updated', handlers.onConversationUpdated);
  }
  if (handlers.onTypingUpdate) {
    socket.on('typing:update', handlers.onTypingUpdate);
  }
  if (handlers.onPresenceUpdate) {
    socket.on('presence:update', handlers.onPresenceUpdate);
  }

  return {
    socket,
    joinConversation: (conversationId: string) => {
      if (conversationId) {
        socket.emit('conversation:join', { conversationId });
      }
    },
    leaveConversation: (conversationId: string) => {
      if (conversationId) {
        socket.emit('conversation:leave', { conversationId });
      }
    },
    sendTyping: (conversationId: string, isTyping: boolean) => {
      if (!conversationId) return;
      socket.emit(isTyping ? 'typing:start' : 'typing:stop', { conversationId });
    },
    markRead: (conversationId: string) => {
      if (conversationId) {
        socket.emit('message:read', { conversationId });
      }
    },
    disconnect: () => {
      socket.removeAllListeners();
      socket.disconnect();
    },
  };
}

