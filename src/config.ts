import type { PlatformConfig } from 'homebridge';

export interface ConfiguredDevice {
  name?: string;
  host: string;
  port?: number;
  mac: string;
  devtype?: number;
}

export interface BroadlinkLB1PlatformConfig extends PlatformConfig {
  name?: string;
  discovery?: boolean;
  discoveryTimeout?: number;
  pollInterval?: number;
  keepAliveInterval?: number;
  commandTimeout?: number;
  retries?: number;
  colorDebounceMs?: number;
  devices?: ConfiguredDevice[];
}

export interface NormalizedConfig {
  name: string;
  discovery: boolean;
  discoveryTimeoutMs: number;
  pollIntervalMs: number;
  keepAliveIntervalMs: number;
  commandTimeoutMs: number;
  retries: number;
  colorDebounceMs: number;
  devices: ConfiguredDevice[];
}

const seconds = (value: unknown, fallback: number, min: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min) {
    return fallback * 1000;
  }
  return Math.round(value * 1000);
};

const millis = (value: unknown, fallback: number, min: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min) {
    return fallback;
  }
  return Math.round(value);
};

export const normalizeConfig = (config: BroadlinkLB1PlatformConfig): NormalizedConfig => ({
  name: typeof config.name === 'string' && config.name.length > 0 ? config.name : 'BroadLink LB1 Local',
  discovery: config.discovery !== false,
  discoveryTimeoutMs: seconds(config.discoveryTimeout, 5, 1),
  pollIntervalMs: seconds(config.pollInterval, 10, 1),
  keepAliveIntervalMs: seconds(config.keepAliveInterval, 90, 0),
  commandTimeoutMs: seconds(config.commandTimeout, 4, 1),
  retries: typeof config.retries === 'number' && Number.isInteger(config.retries) && config.retries >= 0 ? config.retries : 2,
  colorDebounceMs: millis(config.colorDebounceMs, 100, 10),
  devices: Array.isArray(config.devices) ? config.devices : [],
});
