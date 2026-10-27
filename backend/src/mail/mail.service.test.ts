import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MailService } from './mail.service.js';

test('SMTP port 465 defaults to a secure transport when SMTP_SECURE is unset', (t) => {
  const previousPort = process.env.SMTP_PORT;
  const previousSecure = process.env.SMTP_SECURE;
  t.after(() => {
    if (previousPort === undefined) delete process.env.SMTP_PORT;
    else process.env.SMTP_PORT = previousPort;
    if (previousSecure === undefined) delete process.env.SMTP_SECURE;
    else process.env.SMTP_SECURE = previousSecure;
  });

  process.env.SMTP_PORT = '465';
  delete process.env.SMTP_SECURE;

  const service = new MailService();
  const options = (service as any).transporter.options;

  assert.equal(options.port, 465);
  assert.equal(options.secure, true);
});

test('a non-465 SMTP port defaults to a non-secure transport', (t) => {
  const previousPort = process.env.SMTP_PORT;
  const previousSecure = process.env.SMTP_SECURE;
  t.after(() => {
    if (previousPort === undefined) delete process.env.SMTP_PORT;
    else process.env.SMTP_PORT = previousPort;
    if (previousSecure === undefined) delete process.env.SMTP_SECURE;
    else process.env.SMTP_SECURE = previousSecure;
  });

  process.env.SMTP_PORT = '587';
  delete process.env.SMTP_SECURE;

  const service = new MailService();
  assert.equal((service as any).transporter.options.secure, false);
});

test('an explicit SMTP_SECURE value overrides the port-derived default', (t) => {
  const previousPort = process.env.SMTP_PORT;
  const previousSecure = process.env.SMTP_SECURE;
  t.after(() => {
    if (previousPort === undefined) delete process.env.SMTP_PORT;
    else process.env.SMTP_PORT = previousPort;
    if (previousSecure === undefined) delete process.env.SMTP_SECURE;
    else process.env.SMTP_SECURE = previousSecure;
  });

  process.env.SMTP_PORT = '465';
  process.env.SMTP_SECURE = 'false';
  const explicitlyInsecure = new MailService();

  process.env.SMTP_PORT = '587';
  process.env.SMTP_SECURE = 'true';
  const explicitlySecure = new MailService();

  assert.equal((explicitlyInsecure as any).transporter.options.secure, false);
  assert.equal((explicitlySecure as any).transporter.options.secure, true);
});

test('production refuses to start without SMTP credentials', (t) => {
  const previous = { nodeEnv: process.env.NODE_ENV, user: process.env.SMTP_USER, pass: process.env.SMTP_PASS };
  t.after(() => {
    for (const [key, value] of Object.entries({ NODE_ENV: previous.nodeEnv, SMTP_USER: previous.user, SMTP_PASS: previous.pass })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  process.env.NODE_ENV = 'production';
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;

  assert.throws(() => new MailService(), /SMTP/);
});

test('production refuses to start with example SMTP credentials', (t) => {
  const previous = { nodeEnv: process.env.NODE_ENV, user: process.env.SMTP_USER, pass: process.env.SMTP_PASS };
  t.after(() => {
    for (const [key, value] of Object.entries({ NODE_ENV: previous.nodeEnv, SMTP_USER: previous.user, SMTP_PASS: previous.pass })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  process.env.NODE_ENV = 'production';
  process.env.SMTP_USER = 'sender@example.test';
  process.env.SMTP_PASS = 'your-gmail-app-password';

  assert.throws(() => new MailService(), /SMTP/);
});

test('SMTP delivery failures never write the OTP to logs in production', async (t) => {
  const previous = { nodeEnv: process.env.NODE_ENV, user: process.env.SMTP_USER, pass: process.env.SMTP_PASS };
  t.after(() => {
    for (const [key, value] of Object.entries({ NODE_ENV: previous.nodeEnv, SMTP_USER: previous.user, SMTP_PASS: previous.pass })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  process.env.NODE_ENV = 'production';
  process.env.SMTP_USER = 'sender@example.test';
  process.env.SMTP_PASS = 'configured';
  const service = new MailService();
  (service as any).transporter.sendMail = async () => { throw new Error('SMTP unavailable'); };
  const messages: string[] = [];
  (service as any).logger.warn = (message: string) => messages.push(message);
  (service as any).logger.error = (message: string) => messages.push(message);

  assert.equal(await service.sendOtpEmail('user@example.test', '123456'), false);
  assert.equal(messages.join(' ').includes('123456'), false);
});
