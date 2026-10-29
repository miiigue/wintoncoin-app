'use strict';

const express = require('express');
const request = require('supertest');
const { rateLimit } = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const twilio = require('twilio');

function numericVersion(packageName) {
  let directory = path.dirname(require.resolve(packageName));
  let metadata;
  while (directory !== path.dirname(directory)) {
    const candidate = path.join(directory, 'package.json');
    if (fs.existsSync(candidate)) {
      const parsed = JSON.parse(fs.readFileSync(candidate, 'utf8'));
      if (parsed.name === packageName) {
        metadata = parsed;
        break;
      }
    }
    directory = path.dirname(directory);
  }
  if (!metadata) throw new Error(`No se encontró metadata para ${packageName}`);
  return metadata.version
    .split('.')
    .slice(0, 3)
    .map((part) => Number.parseInt(part, 10));
}

function atLeast(actual, expected) {
  for (let index = 0; index < expected.length; index += 1) {
    if ((actual[index] || 0) > expected[index]) return true;
    if ((actual[index] || 0) < expected[index]) return false;
  }
  return true;
}

describe('dependencias de seguridad usadas por Render', () => {
  test.each([
    ['proxy-addr', [2, 0, 8]],
    ['body-parser', [2, 4, 0]],
    ['ip-address', [10, 7, 4]],
    ['sharp', [0, 35, 5]],
    ['axios', [1, 20, 0]],
    ['follow-redirects', [1, 15, 12]],
  ])('%s no retrocede por debajo de la versión corregida', (packageName, minimum) => {
    expect(atLeast(numericVersion(packageName), minimum)).toBe(true);
  });

  test('un solo proxy confiable no permite que el cliente elija un salto anterior', async () => {
    const app = express();
    app.set('trust proxy', 1);
    app.use(rateLimit({ windowMs: 60_000, limit: 1, legacyHeaders: false }));
    app.get('/ip', (req, res) => res.json({ ip: req.ip }));

    const forwarded = '198.51.100.23, 203.0.113.9';
    const first = await request(app).get('/ip').set('X-Forwarded-For', forwarded);
    expect(first.status).toBe(200);
    expect(first.body.ip).toBe('203.0.113.9');

    const limited = await request(app).get('/ip').set('X-Forwarded-For', forwarded);
    expect(limited.status).toBe(429);
  });

  test('las actualizaciones conservan procesamiento de imágenes y cliente de mensajería', async () => {
    const image = await sharp({
      create: { width: 1, height: 1, channels: 4, background: '#00000000' },
    }).png().toBuffer();
    expect(image.length).toBeGreaterThan(0);

    const client = twilio(`AC${'0'.repeat(32)}`, 'token-de-prueba');
    expect(typeof client.messages.create).toBe('function');
  });
});
