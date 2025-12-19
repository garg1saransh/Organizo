// src/realtime/socket.ts
import { io, Socket } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL as string;

let socket: Socket | null = null;

export function connectSocket(token: string) {
  if (socket) return socket;

  socket = io(API_URL, {
    auth: { token },
    transports: ['websocket'],
    withCredentials: true,
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket() {
  return socket;
}