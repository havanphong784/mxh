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
