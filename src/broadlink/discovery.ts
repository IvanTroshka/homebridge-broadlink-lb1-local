import dgram from 'node:dgram';
import os from 'node:os';

import { broadlinkChecksum } from './checksum.js';
import { DEFAULT_PORT, LB1_SUPPORTED_DEVTYPES } from './constants.js';
import type { DiscoveredDevice } from './types.js';

const macFromBroadlinkBytes = (bytes: Buffer): string => [...bytes].reverse().map(byte => byte.toString(16).padStart(2, '0')).join(':');

const getLocalIPv4 = (): string => {
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        return entry.address;
      }
    }
  }
  return '0.0.0.0';
};

const writeIPv4Reversed = (packet: Buffer, offset: number, ip: string): void => {
  const parts = ip.split('.').map(part => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) {
    return;
  }
  packet[offset] = parts[3];
  packet[offset + 1] = parts[2];
  packet[offset + 2] = parts[1];
  packet[offset + 3] = parts[0];
};

export const buildDiscoveryPacket = (localIp = getLocalIPv4(), localPort = 0, now = new Date()): Buffer => {
  const packet = Buffer.alloc(0x30);
  const timezoneHours = -new Date().getTimezoneOffset() / 60;
  packet.writeInt32LE(timezoneHours, 0x08);
  packet.writeUInt16LE(now.getFullYear(), 0x0c);
  packet[0x0e] = now.getSeconds();
  packet[0x0f] = now.getMinutes();
  packet[0x10] = now.getHours();
  packet[0x11] = now.getDay() === 0 ? 7 : now.getDay();
  packet[0x12] = now.getDate();
  packet[0x13] = now.getMonth() + 1;
  writeIPv4Reversed(packet, 0x18, localIp);
  packet.writeUInt16LE(localPort, 0x1c);
  packet[0x26] = 0x06;
  packet.writeUInt16LE(broadlinkChecksum(packet), 0x20);
  return packet;
};

export const parseDiscoveryResponse = (response: Buffer, remoteHost: string, remotePort = DEFAULT_PORT): DiscoveredDevice | undefined => {
  if (response.length < 0x40) {
    return undefined;
  }
  const devtype = response.readUInt16LE(0x34);
  if (!LB1_SUPPORTED_DEVTYPES.has(devtype)) {
    return undefined;
  }
  const name = response.subarray(0x40).toString('utf8').split('\0')[0] || 'Smart Bulb';
  return {
    devtype,
    host: remoteHost,
    port: remotePort,
    mac: macFromBroadlinkBytes(response.subarray(0x3a, 0x40)),
    name,
    isLocked: Boolean(response[0x7f]),
  };
};

export const discoverLB1Devices = async (timeoutMs: number, targetHost = '255.255.255.255'): Promise<DiscoveredDevice[]> => {
  const socket = dgram.createSocket('udp4');
  const found = new Map<string, DiscoveredDevice>();

  await new Promise<void>((resolve, reject) => {
    socket.once('error', reject);
    socket.bind(0, () => {
      socket.setBroadcast(true);
      resolve();
    });
  });

  const local = socket.address();
  const localPort = typeof local === 'object' ? local.port : 0;
  const packet = buildDiscoveryPacket(getLocalIPv4(), localPort);

  return await new Promise<DiscoveredDevice[]>((resolve) => {
    const timer = setTimeout(() => {
      socket.close();
      resolve([...found.values()]);
    }, timeoutMs);

    socket.on('message', (message, rinfo) => {
      const device = parseDiscoveryResponse(message, rinfo.address, rinfo.port);
      if (device) {
        found.set(device.mac.toLowerCase(), device);
      }
    });

    socket.send(packet, DEFAULT_PORT, targetHost, error => {
      if (error) {
        clearTimeout(timer);
        socket.close();
        resolve([...found.values()]);
      }
    });
  });
};

export const pingWatchdog = async (host: string, port = DEFAULT_PORT): Promise<void> => {
  const socket = dgram.createSocket('udp4');
  const packet = Buffer.alloc(0x30);
  packet[0x26] = 0x01;
  await new Promise<void>((resolve, reject) => {
    socket.send(packet, port, host, error => {
      socket.close();
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
};
