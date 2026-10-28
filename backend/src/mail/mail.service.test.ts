import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MailService } from './mail.service.js';
import type { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../config/env.validation.js';

function mockConfigService(overrides: Partial<EnvironmentVariables> = {}): ConfigService<EnvironmentVariables, true> {
  const env: Partial<EnvironmentVariables> = {
    NODE_ENV: 'development',
    SMTP_HOST: 'smtp.gmail.com',
    SMTP_USER: 'test@test.com',
    SMTP_PASS: 'test-pass',
    EMAIL_FROM: 'no-reply@mxh.local',
    ...overrides,
  };
  return {
    get(key: string, _opts?: any) { return (env as any)[key]; },
    getOrThrow(key: string, _opts?: any) {
      const v = (env as any)[key];
      if (v === undefined) throw new Error(`Missing ${key}`);
      return v;
    },
  } as any;
}

test('SMTP port 465 defaults to a secure transport when SMTP_SECURE is unset', () => {
  const service = new MailService(mockConfigService({ SMTP_PORT: 465 }));
  const options = (service as any).transporter.options;

  assert.equal(options.port, 465);
  assert.equal(options.secure, true);
});

test('a non-465 SMTP port defaults to a non-secure transport', () => {
  const service = new MailService(mockConfigService({ SMTP_PORT: 587 }));
  assert.equal((service as any).transporter.options.secure, false);
});

test('an explicit SMTP_SECURE value overrides the port-derived default', () => {
  const explicitlyInsecure = new MailService(mockConfigService({ SMTP_PORT: 465, SMTP_SECURE: false }));
  const explicitlySecure = new MailService(mockConfigService({ SMTP_PORT: 587, SMTP_SECURE: true }));

  assert.equal((explicitlyInsecure as any).transporter.options.secure, false);
  assert.equal((explicitlySecure as any).transporter.options.secure, true);
});

test('production refuses to start without SMTP credentials', () => {
  assert.throws(
    () => new MailService(mockConfigService({ NODE_ENV: 'production', SMTP_USER: undefined as any, SMTP_PASS: undefined as any })),
    /SMTP/,
  );
});

test('production refuses to start with example SMTP credentials', () => {
  assert.throws(
    () => new MailService(mockConfigService({ NODE_ENV: 'production', SMTP_USER: 'sender@example.test', SMTP_PASS: 'your-gmail-app-password' })),
    /SMTP/,
  );
});

test('SMTP delivery failures never write the OTP to logs in production', async () => {
  const service = new MailService(mockConfigService({
    NODE_ENV: 'production',
    SMTP_USER: 'sender@example.test',
    SMTP_PASS: 'configured',
  }));
  (service as any).transporter.sendMail = async () => { throw new Error('SMTP unavailable'); };
  const messages: string[] = [];
  (service as any).logger.warn = (message: string) => messages.push(message);
  (service as any).logger.error = (message: string) => messages.push(message);

  assert.equal(await service.sendOtpEmail('user@example.test', '123456'), false);
  assert.equal(messages.join(' ').includes('123456'), false);
});
