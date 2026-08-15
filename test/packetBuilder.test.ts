import assert from 'node:assert/strict';
import test from 'node:test';

import { broadlinkChecksum } from '../src/broadlink/checksum.js';
import { COMMAND_DEVICE, LB1_DEVTYPE, PACKET_MAGIC } from '../src/broadlink/constants.js';
import { BroadlinkDevice } from '../src/broadlink/protocol.js';

test('generic packet builder writes BroadLink header and encrypted payload metadata', () => {
  const device = new BroadlinkDevice({
    host: '192.168.1.50',
    port: 80,
    mac: 'aa:bb:cc:dd:ee:ff',
    devtype: LB1_DEVTYPE,
    timeoutMs: 1000,
    retries: 0,
  });
  const payload = Buffer.from([0x01, 0x02, 0x03]);
  const built = device.buildPacketForTest(COMMAND_DEVICE, payload);
  const packet = built.packet;

  assert.deepEqual(packet.subarray(0, 8), PACKET_MAGIC);
  assert.equal(packet.readUInt16LE(0x24), LB1_DEVTYPE);
  assert.equal(packet.readUInt16LE(0x26), COMMAND_DEVICE);
  assert.equal(packet.readUInt16LE(0x28), built.count);
  assert.equal(packet.subarray(0x2a, 0x30).toString('hex'), 'ffeeddccbbaa');
  assert.equal(packet.readUInt32LE(0x30), 0);
  assert.equal(packet.readUInt16LE(0x34), broadlinkChecksum(payload));
  assert.equal(packet.subarray(0x38).length % 16, 0);

  const packetChecksumBytes = packet.readUInt16LE(0x20);
  const recalculated = (broadlinkChecksum(packet) - (packetChecksumBytes & 0xff) - (packetChecksumBytes >> 8)) & 0xffff;
  assert.equal(packet.readUInt16LE(0x20), recalculated);
});
