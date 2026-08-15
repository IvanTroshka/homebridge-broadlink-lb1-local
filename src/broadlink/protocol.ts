import dgram from 'node:dgram';

import { broadlinkChecksum } from './checksum.js';
import { aesCbcDecrypt, aesCbcEncrypt } from './crypto.js';
import { COMMAND_AUTH, INIT_AES_KEY, PACKET_MAGIC } from './constants.js';
import { checkBroadlinkError, DataValidationError, NetworkTimeoutError } from './errors.js';
import type { DeviceOptions } from './types.js';

const macToBuffer = (mac: string): Buffer => {
  const bytes = mac.split(':').map(part => Number.parseInt(part, 16));
  if (bytes.length !== 6 || bytes.some(byte => !Number.isInteger(byte) || byte < 0 || byte > 255)) {
    throw new Error(`Invalid MAC address: ${mac}`);
  }
  return Buffer.from(bytes);
};

interface BuiltPacket {
  packet: Buffer;
  count: number;
  payloadChecksum: number;
  packetChecksum: number;
}

export class BroadlinkDevice {
  private count = Math.floor(Math.random() * 0x8000) | 0x8000;
  private deviceId = 0;
  private aesKey = Buffer.from(INIT_AES_KEY);
  private queue: Promise<unknown> = Promise.resolve();

  public readonly mac: Buffer;
  public name: string;
  public isLocked: boolean;

  public constructor(private readonly options: DeviceOptions) {
    this.mac = macToBuffer(options.mac);
    this.name = options.name ?? 'Smart Bulb';
    this.isLocked = options.isLocked ?? false;
  }

  public get host(): string {
    return this.options.host;
  }

  public get port(): number {
    return this.options.port;
  }

  public get devtype(): number {
    return this.options.devtype;
  }

  public get macAddress(): string {
    return [...this.mac].map(byte => byte.toString(16).padStart(2, '0')).join(':');
  }

  public async authenticate(): Promise<void> {
    this.deviceId = 0;
    this.aesKey = Buffer.from(INIT_AES_KEY);
    const payload = Buffer.alloc(0x50);
    payload.fill(0x31, 0x04, 0x14);
    payload[0x1e] = 0x01;
    payload[0x2d] = 0x01;
    payload.write('Test 1', 0x30, 'ascii');
    const response = await this.sendPacket(COMMAND_AUTH, payload);
    checkBroadlinkError(response.subarray(0x22, 0x24));
    const decrypted = this.decryptResponsePayload(response);
    this.deviceId = decrypted.readUInt32LE(0);
    this.aesKey = Buffer.from(decrypted.subarray(0x04, 0x14));
  }

  public async sendDeviceCommand(command: number, payload: Buffer): Promise<Buffer> {
    return await this.enqueue(async () => {
      try {
        return await this.sendPacket(command, payload);
      } catch (error) {
        if (error instanceof NetworkTimeoutError || (error instanceof Error && error.message.includes('logged out'))) {
          await this.authenticate();
          return await this.sendPacket(command, payload);
        }
        throw error;
      }
    });
  }

  public decryptResponsePayload(response: Buffer): Buffer {
    return aesCbcDecrypt(response.subarray(0x38), this.aesKey);
  }

  public buildPacketForTest(command: number, payload: Buffer): BuiltPacket {
    return this.buildPacket(command, payload);
  }

  private async enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => undefined);
    return await run;
  }

  private buildPacket(command: number, payload: Buffer): BuiltPacket {
    this.count = ((this.count + 1) | 0x8000) & 0xffff;
    const header = Buffer.alloc(0x38);
    PACKET_MAGIC.copy(header, 0);
    header.writeUInt16LE(this.devtype, 0x24);
    header.writeUInt16LE(command, 0x26);
    header.writeUInt16LE(this.count, 0x28);
    Buffer.from(this.mac).reverse().copy(header, 0x2a);
    header.writeUInt32LE(this.deviceId, 0x30);

    const payloadChecksum = broadlinkChecksum(payload);
    header.writeUInt16LE(payloadChecksum, 0x34);
    const packet = Buffer.concat([header, aesCbcEncrypt(payload, this.aesKey)]);
    const packetChecksum = broadlinkChecksum(packet);
    packet.writeUInt16LE(packetChecksum, 0x20);
    return { packet, count: this.count, payloadChecksum, packetChecksum };
  }

  private async sendPacket(command: number, payload: Buffer): Promise<Buffer> {
    const { packet } = this.buildPacket(command, payload);
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.options.retries; attempt += 1) {
      try {
        const response = await this.sendUdp(packet);
        this.validateResponse(response);
        return response;
      } catch (error) {
        lastError = error;
      }
    }
    if (lastError instanceof Error) {
      throw lastError;
    }
    throw new NetworkTimeoutError();
  }

  private async sendUdp(packet: Buffer): Promise<Buffer> {
    const socket = dgram.createSocket('udp4');
    return await new Promise<Buffer>((resolve, reject) => {
      const timer = setTimeout(() => {
        socket.close();
        reject(new NetworkTimeoutError(`No response received within ${this.options.timeoutMs}ms`));
      }, this.options.timeoutMs);

      socket.once('message', message => {
        clearTimeout(timer);
        socket.close();
        resolve(message);
      });
      socket.once('error', error => {
        clearTimeout(timer);
        socket.close();
        reject(error);
      });
      socket.send(packet, this.options.port, this.options.host, error => {
        if (error) {
          clearTimeout(timer);
          socket.close();
          reject(error);
        }
      });
    });
  }

  private validateResponse(response: Buffer): void {
    if (response.length < 0x38) {
      throw new DataValidationError(-4007, `Expected at least 56 bytes and received ${response.length}`);
    }
    const nominal = response.readUInt16LE(0x20);
    const checksumBytes = response.readUInt16LE(0x20);
    const real = (broadlinkChecksum(response) - (checksumBytes & 0xff) - (checksumBytes >> 8)) & 0xffff;
    if (nominal !== real) {
      throw new DataValidationError(-4008, `Expected response checksum ${nominal} and calculated ${real}`);
    }
  }
}
