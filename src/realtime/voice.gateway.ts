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
    let textSubmitted = false;
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
      textSubmitted = false;
      session = new VoiceSession(socket, socket.data.auth);
      session.start();
    });

    // Clients that do on-device speech-to-text send the final transcript here
    // instead of streaming audio (e.g. the React Native app using device STT).
    socket.on('voice:text', (payload: unknown) => {
      const text =
        typeof payload === 'string'
          ? payload
          : String((payload as { text?: unknown })?.text ?? '');
      textSubmitted = true;
      vlog('gateway', 'voice:text', { text: text.slice(0, 80) });
      if (!session) {
        vlog('gateway', 'voice:text before voice:start — starting session');
        session = new VoiceSession(socket, socket.data.auth);
        session.start();
      }
      session.submitText(text);
    });

    socket.on('voice:audio', (chunk: unknown) => {
      audioChunks += 1;

      // Accept binary (Buffer/ArrayBuffer/TypedArray) AND base64 strings, so
      // mobile clients can send whichever is easiest. Garbage in = no transcript.
      const buf = toAudioBuffer(chunk);

      if (audioChunks === 1) {
        vlog('gateway', 'first voice:audio', {
          kind: describeKind(chunk),
          bytes: buf?.length ?? 0,
        });
        if (!buf || buf.length === 0) {
          vlog(
            'gateway',
            'WARNING: first voice:audio decoded to 0 bytes. Send raw PCM (linear16, 16kHz, mono) as binary, or a base64 string of that PCM.',
          );
          socket.emit('voice:warning', {
            message:
              'Audio payload was empty/undecodable. Send PCM linear16 16kHz mono as binary or base64.',
          });
        }
      }

      // Throttle: chunks are tiny and frequent, so log every 50th.
      if (audioChunks % 50 === 0) {
        vlog(
          'gateway',
          `voice:audio x${audioChunks}`,
          `${buf?.length ?? 0} bytes`,
        );
      }

      if (buf && buf.length) session?.audio(buf);
    });

    socket.on('voice:commit', () => {
      vlog('gateway', 'voice:commit', { audioChunks, textSubmitted });
      // Only warn for audio-streaming clients. Device-STT clients send text via
      // voice:text, so a commit with 0 audio chunks is expected and fine.
      if (audioChunks === 0 && !textSubmitted) {
        vlog(
          'gateway',
          'WARNING: voice:commit but 0 audio chunks and no voice:text. The app sent nothing. Check recording/emit, or send the transcript via voice:text if you use on-device STT.',
        );
        socket.emit('voice:warning', {
          message:
            'No audio or text received. Stream voice:audio (PCM linear16 16kHz) or send a transcript via voice:text before committing.',
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

function describeKind(chunk: unknown): string {
  if (typeof chunk === 'string') return 'string(base64)';
  if (Buffer.isBuffer(chunk)) return 'Buffer';
  if (chunk instanceof ArrayBuffer) return 'ArrayBuffer';
  if (ArrayBuffer.isView(chunk)) return 'TypedArray';
  if (chunk && typeof chunk === 'object' && 'data' in chunk)
    return 'object{data}';
  return typeof chunk;
}

/**
 * Normalizes whatever the client emitted on voice:audio into a Node Buffer:
 * binary (Buffer/ArrayBuffer/TypedArray), a base64 string, or a serialized
 * { type: 'Buffer', data: [...] } object. Returns undefined if undecodable.
 */
function toAudioBuffer(chunk: unknown): Buffer | undefined {
  if (!chunk) return undefined;
  if (Buffer.isBuffer(chunk)) return chunk;
  if (typeof chunk === 'string') return Buffer.from(chunk, 'base64');
  if (chunk instanceof ArrayBuffer) return Buffer.from(chunk);
  if (ArrayBuffer.isView(chunk)) {
    const view = chunk as ArrayBufferView;
    return Buffer.from(view.buffer, view.byteOffset, view.byteLength);
  }
  if (
    typeof chunk === 'object' &&
    Array.isArray((chunk as { data?: unknown }).data)
  ) {
    return Buffer.from((chunk as { data: number[] }).data);
  }
  return undefined;
}
