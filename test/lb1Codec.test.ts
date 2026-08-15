import assert from 'node:assert/strict';
import test from 'node:test';

import { broadlinkChecksum } from '../src/broadlink/checksum.js';
import { encodeLB1Payload, decodeLB1Payload } from '../src/broadlink/lb1.js';

test('LB1 encoder writes header, JSON length and checksum', () => {
  const state = { pwr: 1, brightness: 50, bulb_colormode: 1, colortemp: 2700 };
  const payload = encodeLB1Payload(2, state);
  const json = Buffer.from(JSON.stringify(state), 'utf8');

  assert.equal(payload.readUInt16LE(0x00), 12 + json.length);
  assert.equal(payload.readUInt16LE(0x02), 0xa5a5);
  assert.equal(payload.readUInt16LE(0x04), 0x5a5a);
  assert.equal(payload[0x08], 2);
  assert.equal(payload[0x09], 0x0b);
  assert.equal(payload.readUInt32LE(0x0a), json.length);
  assert.equal(payload.subarray(0x0e).toString('utf8'), json.toString('utf8'));
  const checksumInput = Buffer.from(payload.subarray(0x02));
  checksumInput.writeUInt16LE(0, 0x04);
  assert.equal(payload.readUInt16LE(0x06), broadlinkChecksum(checksumInput));
});

test('LB1 decoder reads representative decrypted response payload', () => {
  const state = { red: 255, green: 0, blue: 0, pwr: 1, brightness: 100, colortemp: 2700, hue: 0, saturation: 100 };
  const payload = encodeLB1Payload(1, state);
  assert.deepEqual(decodeLB1Payload(payload), state);
});
