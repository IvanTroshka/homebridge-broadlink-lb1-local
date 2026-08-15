import assert from 'node:assert/strict';
import test from 'node:test';

import { LB1ColorMode } from '../src/broadlink/constants.js';
import { mergeLB1State } from '../src/broadlink/lb1.js';

test('separate HomeKit hue and saturation updates can be merged into one LB1 RGB patch', () => {
  const first = mergeLB1State(undefined, { hue: 120, bulb_colormode: LB1ColorMode.RGB });
  const merged = mergeLB1State(first, { saturation: 80, bulb_colormode: LB1ColorMode.RGB });
  assert.deepEqual(merged, { hue: 120, bulb_colormode: LB1ColorMode.RGB, saturation: 80 });
});
