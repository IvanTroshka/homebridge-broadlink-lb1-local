import { createCipheriv, createDecipheriv } from 'node:crypto';

import { INIT_AES_IV } from './constants.js';

export const zeroPad16 = (payload: Buffer): Buffer => {
  const padding = (16 - (payload.length % 16)) % 16;
  return padding === 0 ? Buffer.from(payload) : Buffer.concat([payload, Buffer.alloc(padding)]);
};

export const aesCbcEncrypt = (payload: Buffer, key: Buffer, iv = INIT_AES_IV): Buffer => {
  const cipher = createCipheriv('aes-128-cbc', key, iv);
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(zeroPad16(payload)), cipher.final()]);
};

export const aesCbcDecrypt = (payload: Buffer, key: Buffer, iv = INIT_AES_IV): Buffer => {
  const decipher = createDecipheriv('aes-128-cbc', key, iv);
  decipher.setAutoPadding(false);
  return Buffer.concat([decipher.update(payload), decipher.final()]);
};
