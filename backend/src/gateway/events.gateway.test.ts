import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EventsGateway } from './events.gateway.js';

test('WebSocket CORS uses the configured HTTP origin instead of a wildcard', () => {
  const options = Reflect.getMetadata(
    'websockets:gateway_options',
    EventsGateway,
  );

  assert.equal(
    options.cors.origin,
    process.env.CORS_ORIGIN || 'http://localhost:3000',
  );
  assert.equal(options.cors.credentials, true);
});

test('revoking a session disconnects only its WebSocket connections', () => {
  const disconnected: string[] = [];
  const sockets = new Map<string, any>();
  const addSocket = (id: string, userId: string, sessionId: string) => {
    sockets.set(id, {
      data: { userId, sessionId },
      disconnect: () => { disconnected.push(id); sockets.delete(id); },
    });
  };
  addSocket('old', 'user-1', 'old-session');
  addSocket('another', 'user-1', 'another-session');
  addSocket('current', 'user-1', 'current-session');
  addSocket('other', 'user-2', 'other-session');
  const gateway = new EventsGateway({} as any);
  (gateway as any).server = { sockets };

  gateway.handleSessionRevoked({ sessionId: 'old-session' } as any);
  gateway.handleUserSessionsRevoked({ userId: 'user-1', exceptSessionId: 'current-session' } as any);

  assert.deepEqual(disconnected, ['old', 'another']);
});
