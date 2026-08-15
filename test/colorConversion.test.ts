import assert from 'node:assert/strict';
import test from 'node:test';

import { kelvinToMired, miredToKelvin } from '../src/broadlink/lb1.js';

test('converts Kelvin and mired with LB1 clamping', () => {
  assert.equal(kelvinToMired(2700), 370);
  assert.equal(miredToKelvin(370), 2703);
  assert.equal(miredToKelvin(153), 6500);
  assert.equal(miredToKelvin(100), 6500);
  assert.equal(kelvinToMired(7000), 154);
});
