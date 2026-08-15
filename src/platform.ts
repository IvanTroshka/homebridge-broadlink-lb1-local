import type { API, Characteristic, DynamicPlatformPlugin, Logging, PlatformAccessory, PlatformConfig, Service } from 'homebridge';

import { normalizeConfig, type BroadlinkLB1PlatformConfig, type ConfiguredDevice, type NormalizedConfig } from './config.js';
import { DEFAULT_PORT, LB1_DEVTYPE } from './broadlink/constants.js';
import { discoverLB1Devices } from './broadlink/discovery.js';
import type { DiscoveredDevice } from './broadlink/types.js';
import { BroadlinkLB1PlatformAccessory, type LB1AccessoryContext } from './platformAccessory.js';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';

export interface PlatformDevice {
  name: string;
  host: string;
  port: number;
  mac: string;
  devtype: number;
  isLocked: boolean;
}

export class BroadlinkLB1LocalPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;
  public readonly accessories = new Map<string, PlatformAccessory<LB1AccessoryContext>>();
  public readonly configValues: NormalizedConfig;
  private readonly handlers: BroadlinkLB1PlatformAccessory[] = [];

  public constructor(
    public readonly log: Logging,
    config: PlatformConfig,
    public readonly api: API,
  ) {
    this.Service = api.hap.Service;
    this.Characteristic = api.hap.Characteristic;
    this.configValues = normalizeConfig(config as BroadlinkLB1PlatformConfig);

    this.api.on('didFinishLaunching', () => {
      void this.discoverDevices();
    });

    this.api.on('shutdown', () => {
      for (const handler of this.handlers) {
        handler.dispose();
      }
    });
  }

  public configureAccessory(accessory: PlatformAccessory): void {
    this.log.info('[LB1] Loading accessory from cache:', accessory.displayName);
    this.accessories.set(accessory.UUID, accessory as PlatformAccessory<LB1AccessoryContext>);
  }

  private normalizeManualDevice(device: ConfiguredDevice): PlatformDevice | undefined {
    if (!device.host || !device.mac) {
      this.log.warn('[LB1] Ignoring configured device without host or mac');
      return undefined;
    }
    return {
      name: device.name ?? `LB1 ${device.mac}`,
      host: device.host,
      port: device.port ?? DEFAULT_PORT,
      mac: device.mac.toLowerCase(),
      devtype: device.devtype ?? LB1_DEVTYPE,
      isLocked: false,
    };
  }

  private normalizeDiscoveredDevice(device: DiscoveredDevice): PlatformDevice {
    return {
      name: device.name || `LB1 ${device.mac}`,
      host: device.host,
      port: device.port || DEFAULT_PORT,
      mac: device.mac.toLowerCase(),
      devtype: device.devtype,
      isLocked: device.isLocked,
    };
  }

  private async discoverDevices(): Promise<void> {
    const devices = new Map<string, PlatformDevice>();
    for (const configured of this.configValues.devices) {
      const normalized = this.normalizeManualDevice(configured);
      if (normalized) {
        devices.set(normalized.mac, normalized);
      }
    }

    if (this.configValues.discovery) {
      try {
        const discovered = await discoverLB1Devices(this.configValues.discoveryTimeoutMs);
        for (const device of discovered) {
          const normalized = this.normalizeDiscoveredDevice(device);
          const existing = devices.get(normalized.mac);
          devices.set(normalized.mac, { ...normalized, ...existing, host: existing?.host ?? normalized.host });
          this.log.info(`[LB1] Discovered ${normalized.name} at ${normalized.host} (${normalized.mac}, 0x${normalized.devtype.toString(16).toUpperCase()})`);
        }
      } catch (error) {
        this.log.warn(`[LB1] Discovery failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    for (const device of devices.values()) {
      this.registerDevice(device);
    }
  }

  private registerDevice(device: PlatformDevice): void {
    const uuid = this.api.hap.uuid.generate(`broadlink-lb1:${device.mac}`);
    const existingAccessory = this.accessories.get(uuid);

    if (device.isLocked) {
      this.log.error(`[LB1] ${device.name} is LAN-locked. Reset/re-provision or unlock it before Homebridge can control it.`);
    }

    if (existingAccessory) {
      existingAccessory.context.device = device;
      this.api.updatePlatformAccessories([existingAccessory]);
      this.handlers.push(new BroadlinkLB1PlatformAccessory(this, existingAccessory));
      this.log.info(`[LB1] Restored HomeKit accessory: ${existingAccessory.displayName}`);
      return;
    }

    const accessory = new this.api.platformAccessory<LB1AccessoryContext>(device.name, uuid);
    accessory.context.device = device;
    this.handlers.push(new BroadlinkLB1PlatformAccessory(this, accessory));
    this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
    this.accessories.set(uuid, accessory);
    this.log.info(`[LB1] Registered HomeKit accessory: ${device.name}`);
  }
}
