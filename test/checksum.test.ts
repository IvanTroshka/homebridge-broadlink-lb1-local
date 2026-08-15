import assert from 'node:assert/strict';
import test from 'node:test';

import { broadlinkChecksum } from '../src/broadlink/checksum.js';

test('BroadLink checksum uses 0xBEAF seed and 16-bit wrapping', () => {
  assert.equal(broadlinkChecksum(Buffer.alloc(0)), 0xbeaf);
  assert.equal(broadlinkChecksum(Buffer.from([0x00, 0x01, 0x02, 0x03])), 0xbeb5);
  assert.equal(broadlinkChecksum(Buffer.from([0xff, 0xff, 0xff])), 0xc1ac);
});
