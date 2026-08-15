import type { API } from 'homebridge';

import { BroadlinkLB1LocalPlatform } from './platform.js';
import { PLATFORM_NAME } from './settings.js';

export default (api: API): void => {
  api.registerPlatform(PLATFORM_NAME, BroadlinkLB1LocalPlatform);
};
