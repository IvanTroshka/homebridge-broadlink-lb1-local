import { CHECKSUM_SEED } from './constants.js';

export const broadlinkChecksum = (data: Buffer | Uint8Array, seed = CHECKSUM_SEED): number => {
  let checksum = seed;
  for (const byte of data) {
    checksum = (checksum + byte) & 0xffff;
  }
  return checksum;
};
