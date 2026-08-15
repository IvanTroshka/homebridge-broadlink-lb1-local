export interface DiscoveredDevice {
  devtype: number;
  host: string;
  port: number;
  mac: string;
  name: string;
  isLocked: boolean;
}

export interface DeviceOptions {
  host: string;
  port: number;
  mac: string;
  devtype: number;
  name?: string;
  isLocked?: boolean;
  timeoutMs: number;
  retries: number;
}

export interface LB1State {
  pwr?: number;
  red?: number;
  green?: number;
  blue?: number;
  brightness?: number;
  colortemp?: number;
  hue?: number;
  saturation?: number;
  transitionduration?: number;
  maxworktime?: number;
  bulb_colormode?: number;
  bulb_scenes?: string;
  bulb_scene?: string;
  bulb_sceneidx?: number;
}
