import { broadlinkChecksum } from './checksum.js';
import { COMMAND_DEVICE, LB1ColorMode, LB1_MAX_KELVIN, LB1_MIN_KELVIN } from './constants.js';
import { checkBroadlinkError } from './errors.js';
import { BroadlinkDevice } from './protocol.js';
import type { LB1State } from './types.js';

export const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, Math.round(value)));

export const kelvinToMired = (kelvin: number): number => clamp(1_000_000 / clamp(kelvin, LB1_MIN_KELVIN, LB1_MAX_KELVIN), 153, 370);
export const miredToKelvin = (mired: number): number => clamp(1_000_000 / clamp(mired, 153, 370), LB1_MIN_KELVIN, LB1_MAX_KELVIN);

export const encodeLB1Payload = (flag: 1 | 2, state: LB1State): Buffer => {
  const json = Buffer.from(JSON.stringify(state), 'utf8');
  const packet = Buffer.alloc(14);
  packet.writeUInt16LE(12 + json.length, 0x00);
  packet.writeUInt16LE(0xa5a5, 0x02);
  packet.writeUInt16LE(0x5a5a, 0x04);
  packet.writeUInt16LE(0, 0x06);
  packet[0x08] = flag;
  packet[0x09] = 0x0b;
  packet.writeUInt32LE(json.length, 0x0a);
  const full = Buffer.concat([packet, json]);
  full.writeUInt16LE(broadlinkChecksum(full.subarray(0x02)), 0x06);
  return full;
};

export const decodeLB1Payload = (payload: Buffer): LB1State => {
  const jsonLength = payload.readUInt32LE(0x0a);
  const jsonStart = 0x0e;
  const jsonEnd = jsonStart + jsonLength;
  return JSON.parse(payload.subarray(jsonStart, jsonEnd).toString('utf8')) as LB1State;
};

export const sanitizeLB1Patch = (state: LB1State): LB1State => {
  const patch: LB1State = {};
  if (state.pwr !== undefined) {
    patch.pwr = state.pwr ? 1 : 0;
  }
  if (state.brightness !== undefined) {
    patch.brightness = clamp(state.brightness, 0, 100);
  }
  if (state.red !== undefined) {
    patch.red = clamp(state.red, 0, 255);
  }
  if (state.green !== undefined) {
    patch.green = clamp(state.green, 0, 255);
  }
  if (state.blue !== undefined) {
    patch.blue = clamp(state.blue, 0, 255);
  }
  if (state.hue !== undefined) {
    patch.hue = clamp(state.hue, 0, 360);
  }
  if (state.saturation !== undefined) {
    patch.saturation = clamp(state.saturation, 0, 100);
  }
  if (state.colortemp !== undefined) {
    patch.colortemp = clamp(state.colortemp, LB1_MIN_KELVIN, LB1_MAX_KELVIN);
  }
  if (state.bulb_colormode !== undefined) {
    patch.bulb_colormode = clamp(state.bulb_colormode, LB1ColorMode.RGB, LB1ColorMode.SCENE);
  }
  return patch;
};

export const mergeLB1State = (current: LB1State | undefined, patch: LB1State): LB1State => ({
  ...(current ?? {}),
  ...patch,
});

export class LB1Device extends BroadlinkDevice {
  public async getState(): Promise<LB1State> {
    const response = await this.sendDeviceCommand(COMMAND_DEVICE, encodeLB1Payload(1, {}));
    checkBroadlinkError(response.subarray(0x22, 0x24));
    return decodeLB1Payload(this.decryptResponsePayload(response));
  }

  public async setState(state: LB1State): Promise<LB1State> {
    const response = await this.sendDeviceCommand(COMMAND_DEVICE, encodeLB1Payload(2, sanitizeLB1Patch(state)));
    checkBroadlinkError(response.subarray(0x22, 0x24));
    return decodeLB1Payload(this.decryptResponsePayload(response));
  }
}
