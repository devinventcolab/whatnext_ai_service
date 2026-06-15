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

  // Low-level transport failures (bad origin, payload too large, bad transport)
  // never reach the auth middleware, so log them here too.
  io.engine.on('connection_error', (err) => {
    vlog('gateway', 'engine connection_error', {
      code: err.code,
      message: err.message,
    });
  });

  io.use(async (socket, next) => {
    const hasToken = Boolean(
      socket.handshake.auth?.token || socket.handshake.headers.authorization,
    );
    // Always log the attempt BEFORE authenticating, so a hanging/failing auth
    // is visible even though io.on('connection') has not fired yet.
    vlog('gateway', 'handshake attempt', {
      address: socket.handshake.address,
      transport: socket.conn.transport.name,
      hasToken,
    });

    try {
      const token = String(
        socket.handshake.auth?.token ??
          socket.handshake.headers.authorization
            ?.toString()
            .replace('Bearer ', '') ??
          '',
      );
      socket.data.auth = await authService.authenticateToken(token);
      vlog('gateway', 'handshake authenticated', {
        user: socket.data.auth.user.id,
      });
      next();
    } catch (error) {
      vlog('gateway', 'handshake REJECTED', (error as Error).message);
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
      const transport = socket.conn.transport.name;
      vlog('gateway', 'voice:start -> new session', { transport });
      if (transport !== 'websocket') {
        vlog(
          'gateway',
          'WARNING: transport is "' +
            transport +
            '" not "websocket". Binary audio is unreliable over polling. Set the client to io(url, { transports: ["websocket"] }) and ensure any proxy forwards the WebSocket upgrade.',
        );
        socket.emit('voice:warning', {
          message:
            'Connected over ' +
            transport +
            ' transport. Use websocket for audio streaming.',
        });
      }
      audioChunks = 0;
      session = new VoiceSession(socket, socket.data.auth);
      session.start();
    });

    socket.on('voice:audio', (chunk: unknown) => {
      audioChunks += 1;

      // Diagnose the #1 mobile mistake: sending audio as a base64 STRING
      // instead of raw binary. The server would then feed garbage to Deepgram
      // and you'd get no transcript and no response.
      if (audioChunks === 1) {
        const kind =
          typeof chunk === 'string'
            ? 'string'
            : chunk instanceof ArrayBuffer
              ? 'ArrayBuffer'
              : Buffer.isBuffer(chunk)
                ? 'Buffer'
                : typeof chunk;
        const len =
          typeof chunk === 'string'
            ? chunk.length
            : Buffer.isBuffer(chunk)
              ? chunk.length
              : chunk instanceof ArrayBuffer
                ? chunk.byteLength
                : undefined;
        vlog('gateway', 'first voice:audio', { kind, len });
        if (typeof chunk === 'string') {
          vlog(
            'gateway',
            'WARNING: voice:audio is a STRING. Send BINARY PCM (linear16, 16kHz, mono), not base64. In RN: socket.emit("voice:audio", Buffer.from(base64,"base64")).',
          );
          socket.emit('voice:warning', {
            message:
              'Audio received as text (base64). Send raw binary PCM linear16 16kHz mono instead.',
          });
        }
      }

      // Throttle: chunks are tiny and frequent, so log every 50th.
      if (audioChunks % 50 === 0) {
        const len = Buffer.isBuffer(chunk)
          ? chunk.length
          : chunk instanceof ArrayBuffer
            ? chunk.byteLength
            : typeof chunk === 'string'
              ? chunk.length
              : 0;
        vlog('gateway', `voice:audio x${audioChunks}`, `${len} bytes`);
      }
      session?.audio(Buffer.from(chunk as Buffer));
    });

    socket.on('voice:commit', () => {
      vlog('gateway', 'voice:commit', { audioChunks });
      if (audioChunks === 0) {
        vlog(
          'gateway',
          'WARNING: voice:commit but 0 audio chunks were received. The app never sent voice:audio. Check: (1) recording actually started after voice:ready, (2) chunks are emitted as BINARY, (3) transport is websocket.',
        );
        socket.emit('voice:warning', {
          message:
            'No audio received. Stream binary voice:audio (PCM linear16, 16 kHz, mono) over the websocket transport before committing.',
        });
      }
      session?.commit();
    });
    socket.on('voice:stop', () => {
      vlog('gateway', 'voice:stop', { audioChunks });
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
