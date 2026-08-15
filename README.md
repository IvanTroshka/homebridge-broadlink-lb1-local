# homebridge-broadlink-lb1-local

Homebridge dynamic platform plugin for BroadLink LB1 bulbs using local LAN UDP control only.

The plugin does not use BroadLink Cloud, Magic Home, account credentials, or Python at runtime. Optional Python helper scripts are included only for initial bulb Wi-Fi provisioning and LAN-unlock preparation.

## Supported Devices

The first supported device type is BroadLink LB1 product ID `0x60C8`.

## Known Compatible Lamp

![LB1-style smart LED bulb and package](docs/assets/lb1-style-smart-led-bulb.png)

This plugin was built and physically tested with a BroadLink LB1-style Wi-Fi smart LED bulb sold as a generic `LED Light Bulb` / `Smart LED Bulb` kit with E27 screw base, frosted A60 bulb shape, RGB + white support, and blue/white retail packaging.

The known-compatible packaging and bulb appearance are:

- cream/white box front with bright cyan-blue side and top panels;
- front text similar to `LED Light Bulb` with a Wi-Fi mark;
- three circular front icons for living lighting, grouping and timing;
- pale bulb silhouette printed on the front;
- vertical energy label graphic on the blue side panel;
- white A60 bulb body with frosted dome;
- metallic E27 screw base with a distinctive green plastic ring/cap at the tip.

The tested device identifies on the BroadLink LAN protocol as:

- Device class: `lb1`
- Model: `LB1`
- Manufacturer: `Broadlink`
- Product ID / devtype: `0x60C8`
- Control protocol: local BroadLink UDP on port `80`

Branding and box art vary by seller, so compatibility should be confirmed by discovery showing product ID `0x60C8` and device class `lb1`.

The image above is an original generated documentation render based on the known-compatible product appearance. It preserves the important visual identifiers but avoids copying vendor photo artifacts and real app-store trademarks.

## What This Plugin Exposes

- HomeKit `Lightbulb`
- On/off
- Brightness
- Hue and saturation
- Color temperature
- Local state polling
- Firmware watchdog UDP ping every 90 seconds by default

## Prepare A Bulb

The LB1 must be provisioned onto your Wi-Fi and left LAN-unlocked before Homebridge can control it locally.

The helper scripts use the `python-broadlink` package for the initial setup workflow. They are not used by Homebridge after the bulb is prepared.

### 1. Install Helper Dependencies

Use a temporary Python virtual environment:

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -r scripts/requirements.txt
```

### 2. Put The Bulb In AP Mode

Reset the bulb until it starts fast blinking and exposes its setup Wi-Fi access point. On many BroadLink bulbs the setup network is named similar to `BroadlinkProv`.

Do not add the bulb back to old third-party apps during this process if your goal is local LAN control. Some apps can provision devices into a LAN-locked state.

### 3. Connect To The Bulb Access Point

From the same computer that will run the setup script, join the bulb's temporary Wi-Fi access point.

At this moment the computer is usually disconnected from your normal network. That is expected.

### 4. Send Your Wi-Fi Credentials To The Bulb

Run:

```bash
python scripts/setup_bulb.py "Your Wi-Fi SSID"
```

The script prompts for the Wi-Fi password without echoing it to the terminal.

You can also pass the password explicitly if you are running in an environment where prompting is not practical:

```bash
python scripts/setup_bulb.py "Your Wi-Fi SSID" --password "your-wifi-password"
```

For non-WPA2 networks:

```bash
python scripts/setup_bulb.py "Your Wi-Fi SSID" --security wpa1/2
```

After the packet is sent, the bulb should leave AP mode and join your normal Wi-Fi network.

### 5. Find The Bulb IP Address

Find the new IP address in your router, DHCP leases, or with your preferred LAN scanner.

The plugin identity is based on the MAC address, not the IP address, so the IP can change later without creating duplicate HomeKit accessories.

### 6. Unlock Local LAN Control

Run the unlock helper with the bulb's current IP address:

```bash
python scripts/unlock_lb1.py --ip 192.168.1.50
```

Replace `192.168.1.50` with your bulb's actual address.

The script:

- sends a unicast BroadLink hello;
- authenticates locally;
- calls `set_lock(False)`;
- performs a fresh discovery;
- verifies that `Locked` is `False`;
- verifies that a fresh object can authenticate and read state.

The plugin never sets the device lock to `true`.

## Homebridge Configuration

Example:

```json
{
  "platform": "BroadlinkLB1Local",
  "name": "BroadLink LB1 Local",
  "discovery": true,
  "pollInterval": 10,
  "keepAliveInterval": 90,
  "devices": [
    {
      "name": "LB1 Lamp",
      "host": "192.168.1.50",
      "mac": "aa:bb:cc:dd:ee:ff"
    }
  ]
}
```

Manual devices and discovered devices are de-duplicated by MAC address. Accessory UUIDs are generated from MAC addresses, so IP address changes do not create duplicate HomeKit accessories.

You may also run discovery-only:

```json
{
  "platform": "BroadlinkLB1Local",
  "name": "BroadLink LB1 Local",
  "discovery": true,
  "devices": []
}
```

## Configuration Options

- `discovery`: enable startup LAN discovery. Default: `true`.
- `discoveryTimeout`: startup discovery timeout in seconds. Default: `5`.
- `pollInterval`: device state polling interval in seconds. Default: `10`.
- `keepAliveInterval`: firmware watchdog ping interval in seconds. Default: `90`. Set `0` to disable.
- `commandTimeout`: UDP command timeout in seconds. Default: `4`.
- `retries`: bounded UDP retries per command. Default: `2`.
- `colorDebounceMs`: coalescing window for close HomeKit color updates. Default: `100`.
- `devices`: manually configured devices with `host`, `mac`, optional `name`, `port`, and `devtype`.

## Development

```bash
npm install
npm run build
npm run lint
npm test
```

For local Homebridge development:

```bash
npm link
homebridge -D
```

## Publishing

Homebridge community plugins are normal npm packages with the `homebridge-plugin` keyword. The Homebridge UI discovers plugins from npm.

Before publishing:

```bash
npm run lint
npm test
npm pack --dry-run
```

Then publish to npm:

```bash
npm publish
```

To apply for Homebridge Verified status later, the source repository needs to be available on GitHub with issues enabled, the package must be published to npm, and releases should be tagged with release notes.

## Credits

The optional setup helpers in `scripts/` use [`python-broadlink`](https://github.com/mjg59/python-broadlink), a Python module and CLI for local BroadLink device control.

`python-broadlink` is MIT licensed. Its license credits Mike Ryan and Matthew Garrett; the project is maintained by Matthew Garrett and contributors.

The TypeScript Homebridge plugin in this repository ports only the minimum BroadLink/LB1 local protocol needed for HomeKit control and does not include `python-broadlink` at runtime.

## Notes

If discovery reports a bulb as LAN-locked, this plugin logs an error and will not repeatedly hammer authentication. Reset/re-provision or unlock the bulb first.

Color temperature is exposed to HomeKit in mired and sent to the LB1 in Kelvin. Outgoing values are clamped to a conservative `2700K..6500K` LB1 range.

The included unit tests do not require a real bulb. Full HomeKit behavior should be verified against a physical LB1 before publishing a stable release.
