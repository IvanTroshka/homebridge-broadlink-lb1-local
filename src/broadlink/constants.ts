export const DEFAULT_PORT = 80;
export const CHECKSUM_SEED = 0xbeaf;
export const INIT_AES_KEY = Buffer.from('097628343fe99e23765c1513accf8b02', 'hex');
export const INIT_AES_IV = Buffer.from('562e17996d093d28ddb3ba695a2e6f58', 'hex');
export const PACKET_MAGIC = Buffer.from('5aa5aa555aa5aa55', 'hex');
export const COMMAND_AUTH = 0x65;
export const COMMAND_DEVICE = 0x6a;
export const LB1_DEVTYPE = 0x60c8;
export const LB1_SUPPORTED_DEVTYPES = new Set<number>([LB1_DEVTYPE]);

export enum LB1ColorMode {
  RGB = 0,
  WHITE = 1,
  SCENE = 2,
}

export const LB1_MIN_KELVIN = 2700;
export const LB1_MAX_KELVIN = 6500;
