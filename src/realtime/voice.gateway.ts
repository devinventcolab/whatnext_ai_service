import { Server } from 'http';
import { Server as SocketServer } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import { socketCorsOrigin } from '../config/cors';
import { vlog } from '../shared/debug';
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
      vlog('gateway', 'auth rejected', (error as Error).message);
      next(error as Error);
    }
  });

  io.on('connection', (socket) => {
    let session: VoiceSession | undefined;
    let audioChunks = 0;
    vlog('gateway', 'connection', {
      id: socket.id,
      user: socket.data.auth?.user?.id,
    });

    socket.on('voice:ping', () => {
      vlog('gateway', 'voice:ping');
      socket.emit('voice:pong', { timestamp: new Date().toISOString() });
    });

    socket.on('voice:start', () => {
      vlog('gateway', 'voice:start -> new session');
      audioChunks = 0;
      session = new VoiceSession(socket, socket.data.auth);
      session.start();
    });

    socket.on('voice:audio', (chunk: Buffer) => {
      audioChunks += 1;
      // Throttle: chunks are tiny and frequent, so log every 50th.
      if (audioChunks % 50 === 0) {
        vlog('gateway', `voice:audio x${audioChunks}`, `${chunk.length} bytes`);
      }
      session?.audio(Buffer.from(chunk));
    });

    socket.on('voice:commit', () => {
      vlog('gateway', 'voice:commit');
      session?.commit();
    });
    socket.on('voice:stop', () => {
      vlog('gateway', 'voice:stop');
      session?.stop();
    });
    socket.on('voice:cancel', () => {
      vlog('gateway', 'voice:cancel');
      session?.stop();
    });
    socket.on('disconnect', (reason) => {
      vlog('gateway', 'disconnect', reason);
      session?.stop();
    });
  });

  return io;
}
