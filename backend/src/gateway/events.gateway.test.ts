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
