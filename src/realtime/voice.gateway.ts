import { Server } from 'http';
import { Server as SocketServer } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import { socketCorsOrigin } from '../config/cors';
import { VoiceSession } from './voice-session';

export function attachVoiceGateway(server: Server) {
  const authService = new AuthService();
  const io = new SocketServer(server, {
    cors: {
      origin: socketCorsOrigin(),
      credentials: true,
    },
    maxHttpBufferSize: 2 * 1024 * 1024,
  });

  io.use(async (socket, next) => {
    try {
      const token = String(
        socket.handshake.auth?.token ??
          socket.handshake.headers.authorization
            ?.toString()
            .replace('Bearer ', '') ??
          '',
      );
      socket.data.auth = await authService.authenticateToken(token);
      next();
    } catch (error) {
      next(error as Error);
    }
  });

  io.on('connection', (socket) => {
    let session: VoiceSession | undefined;

    socket.on('voice:ping', () => {
      socket.emit('voice:pong', { timestamp: new Date().toISOString() });
    });

    socket.on('voice:start', () => {
      session = new VoiceSession(socket, socket.data.auth);
      session.start();
    });

    socket.on('voice:audio', (chunk: Buffer) => {
      session?.audio(Buffer.from(chunk));
    });

    socket.on('voice:commit', () => session?.commit());
    socket.on('voice:stop', () => session?.stop());
    socket.on('voice:cancel', () => session?.stop());
    socket.on('disconnect', () => session?.stop());
  });

  return io;
}
