import type { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';

import { DEFAULT_PORT, LB1ColorMode } from './broadlink/constants.js';
import { pingWatchdog } from './broadlink/discovery.js';
import { kelvinToMired, LB1Device, mergeLB1State, miredToKelvin } from './broadlink/lb1.js';
import type { LB1State } from './broadlink/types.js';
import type { PlatformDevice, BroadlinkLB1LocalPlatform } from './platform.js';

export interface LB1AccessoryContext {
  device: PlatformDevice;
}

export class BroadlinkLB1PlatformAccessory {
  private readonly service: Service;
  private readonly device: LB1Device;
  private pollTimer?: NodeJS.Timeout;
  private keepAliveTimer?: NodeJS.Timeout;
  private debounceTimer?: NodeJS.Timeout;
  private pendingPatch: LB1State = {};
  private cachedState?: LB1State;
  private consecutiveFailures = 0;

  public constructor(
    private readonly platform: BroadlinkLB1LocalPlatform,
    private readonly accessory: PlatformAccessory<LB1AccessoryContext>,
  ) {
    const definition = accessory.context.device;
    this.device = new LB1Device({
      host: definition.host,
      port: definition.port ?? DEFAULT_PORT,
      mac: definition.mac,
      devtype: definition.devtype,
      name: definition.name,
      isLocked: definition.isLocked,
      timeoutMs: platform.configValues.commandTimeoutMs,
      retries: platform.configValues.retries,
    });

    accessory.getService(platform.Service.AccessoryInformation)
      ?.setCharacteristic(platform.Characteristic.Manufacturer, 'Broadlink')
      .setCharacteristic(platform.Characteristic.Model, 'LB1')
      .setCharacteristic(platform.Characteristic.SerialNumber, definition.mac);

    this.service = accessory.getService(platform.Service.Lightbulb) ?? accessory.addService(platform.Service.Lightbulb);
    this.service.setCharacteristic(platform.Characteristic.Name, definition.name);

    this.service.getCharacteristic(platform.Characteristic.On)
      .onGet(() => this.cachedState?.pwr === 1)
      .onSet(value => this.queuePatch({ pwr: value ? 1 : 0 }));

    this.service.getCharacteristic(platform.Characteristic.Brightness)
      .onGet(() => this.cachedState?.brightness ?? 100)
      .onSet(value => this.queuePatch({ brightness: Number(value) }));

    this.service.getCharacteristic(platform.Characteristic.Hue)
      .onGet(() => this.cachedState?.hue ?? 0)
      .onSet(value => this.queuePatch({ hue: Number(value), bulb_colormode: LB1ColorMode.RGB }));

    this.service.getCharacteristic(platform.Characteristic.Saturation)
      .onGet(() => this.cachedState?.saturation ?? 0)
      .onSet(value => this.queuePatch({ saturation: Number(value), bulb_colormode: LB1ColorMode.RGB }));

    this.service.getCharacteristic(platform.Characteristic.ColorTemperature)
      .setProps({ minValue: 140, maxValue: 370 })
      .onGet(() => kelvinToMired(this.cachedState?.colortemp ?? 2700))
      .onSet(value => this.queuePatch({ colortemp: miredToKelvin(Number(value)), bulb_colormode: LB1ColorMode.WHITE }));

    void this.initialize();
  }

  public dispose(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
  }

  private async initialize(): Promise<void> {
    if (this.accessory.context.device.isLocked) {
      return;
    }
    try {
      await this.device.authenticate();
      this.platform.log.info(`[LB1] Authenticated ${this.accessory.displayName}`);
      await this.pollState();
    } catch (error) {
      this.platform.log.warn(`[LB1] ${this.accessory.displayName} initial connection failed: ${this.errorMessage(error)}`);
    }

    this.pollTimer = setInterval(() => void this.pollState(), this.platform.configValues.pollIntervalMs);
    if (this.platform.configValues.keepAliveIntervalMs > 0) {
      this.keepAliveTimer = setInterval(() => void this.keepAlive(), this.platform.configValues.keepAliveIntervalMs);
    }
  }

  private queuePatch(patch: LB1State): void {
    this.pendingPatch = { ...this.pendingPatch, ...patch };
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => void this.flushPatch(), this.platform.configValues.colorDebounceMs);
  }

  private async flushPatch(): Promise<void> {
    const patch = this.pendingPatch;
    this.pendingPatch = {};
    try {
      const state = await this.device.setState(patch);
      this.applyState(mergeLB1State(this.cachedState, Object.keys(state).length > 0 ? state : patch));
      this.consecutiveFailures = 0;
    } catch (error) {
      this.consecutiveFailures += 1;
      this.platform.log.warn(`[LB1] ${this.accessory.displayName} command failed: ${this.errorMessage(error)}`);
      if (this.consecutiveFailures >= 3) {
        await this.reauthenticate();
      }
    }
  }

  private async pollState(): Promise<void> {
    try {
      const state = await this.device.getState();
      this.applyState(state);
      this.consecutiveFailures = 0;
    } catch (error) {
      this.consecutiveFailures += 1;
      this.platform.log.warn(`[LB1] ${this.accessory.displayName} is offline, retrying on next poll: ${this.errorMessage(error)}`);
      if (this.consecutiveFailures >= 3) {
        await this.reauthenticate();
      }
    }
  }

  private async reauthenticate(): Promise<void> {
    try {
      this.platform.log.info(`[LB1] ${this.accessory.displayName} session expired; re-authenticating`);
      await this.device.authenticate();
      this.consecutiveFailures = 0;
    } catch (error) {
      this.platform.log.warn(`[LB1] ${this.accessory.displayName} re-authentication failed: ${this.errorMessage(error)}`);
    }
  }

  private async keepAlive(): Promise<void> {
    try {
      await pingWatchdog(this.accessory.context.device.host, this.accessory.context.device.port);
    } catch (error) {
      this.platform.log.debug(`[LB1] ${this.accessory.displayName} watchdog ping failed: ${this.errorMessage(error)}`);
    }
  }

  private applyState(state: LB1State): void {
    const previous = this.cachedState;
    this.cachedState = state;
    this.updateIfChanged(this.platform.Characteristic.On, previous?.pwr === 1, state.pwr === 1);
    this.updateIfChanged(this.platform.Characteristic.Brightness, previous?.brightness, state.brightness);
    this.updateIfChanged(this.platform.Characteristic.Hue, previous?.hue, state.hue);
    this.updateIfChanged(this.platform.Characteristic.Saturation, previous?.saturation, state.saturation);
    this.updateIfChanged(
      this.platform.Characteristic.ColorTemperature,
      previous?.colortemp === undefined ? undefined : kelvinToMired(previous.colortemp),
      state.colortemp === undefined ? undefined : kelvinToMired(state.colortemp),
    );
  }

  private updateIfChanged(characteristic: typeof this.platform.Characteristic.On, previous: CharacteristicValue | undefined, next: CharacteristicValue | undefined): void {
    if (next !== undefined && previous !== next) {
      this.service.updateCharacteristic(characteristic, next);
    }
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
