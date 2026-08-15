const ERROR_MESSAGES = new Map<number, string>([
  [-1, 'Authentication failed'],
  [-2, 'You have been logged out'],
  [-3, 'The device is offline'],
  [-4, 'Command not supported'],
  [-5, 'The device storage is full'],
  [-6, 'Structure is abnormal'],
  [-7, 'Control key is expired'],
  [-8, 'Send error'],
  [-9, 'Write error'],
  [-10, 'Read error'],
  [-11, 'SSID could not be found in AP configuration'],
  [-2040, 'Device information is not intact'],
  [-4000, 'Network timeout'],
  [-4007, 'Received data packet length error'],
  [-4008, 'Received data packet check error'],
  [-4010, 'Received encrypted data packet length error'],
  [-4011, 'Received encrypted data packet check error'],
  [-4012, 'Device control ID error'],
]);

export class BroadlinkError extends Error {
  public constructor(public readonly code: number, message?: string) {
    super(`[${code}] ${message ?? ERROR_MESSAGES.get(code) ?? 'Unknown BroadLink error'}`);
    this.name = 'BroadlinkError';
  }
}

export class NetworkTimeoutError extends BroadlinkError {
  public constructor(message = 'Network timeout') {
    super(-4000, message);
    this.name = 'NetworkTimeoutError';
  }
}

export class DataValidationError extends BroadlinkError {
  public constructor(code: number, message: string) {
    super(code, message);
    this.name = 'DataValidationError';
  }
}

export const checkBroadlinkError = (bytes: Buffer): void => {
  const code = bytes.readInt16LE(0);
  if (code !== 0) {
    throw new BroadlinkError(code);
  }
};
