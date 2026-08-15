# homebridge-broadlink-lb1-local

**English** | [Русский](README.ru.md)

Local-only Homebridge plugin for BroadLink LB1 smart bulbs.

It controls compatible bulbs directly over the local network using the BroadLink UDP protocol. Normal operation does **not** require BroadLink Cloud, Magic Home, an account, or Python.

> Python is only used by the optional helper scripts for initial Wi-Fi provisioning and LAN unlock.

## Compatibility

![Known compatible LB1-style smart bulb and packaging](docs/assets/lb1-style-smart-led-bulb.png)

The plugin was physically tested with the bulb shown above.

Confirmed device identification:

| Property | Value |
|---|---|
| Device class | `lb1` |
| Model | `LB1` |
| Manufacturer | `Broadlink` |
| Product ID / devtype | `0x60C8` |
| Tested firmware | `57231` |
| Protocol | BroadLink UDP, port `80` |

Packaging may vary between sellers. The definitive compatibility check is discovery reporting **device class `lb1` and devtype `0x60C8`**.

## Features

- HomeKit `Lightbulb` accessory
- On / off
- Brightness
- Hue and saturation
- Color temperature
- Local state polling
- Automatic LAN discovery
- Manual device configuration
- Stable accessory identity based on MAC address
- Automatic re-authentication after connection/session failures
- Firmware watchdog keepalive ping
- Multiple bulbs supported
- No cloud dependency during normal operation

## Installation

Install it from the Homebridge UI by searching for:

```text
homebridge-broadlink-lb1-local
```

or install it from the command line:

```bash
npm install -g homebridge-broadlink-lb1-local
```

Then restart Homebridge.

## Prepare a Bulb

The bulb must be connected to your Wi-Fi and left LAN-unlocked before Homebridge can control it.

The helper scripts in `scripts/` use [`python-broadlink`](https://github.com/mjg59/python-broadlink) only for the initial preparation process.

### 1. Install helper dependencies

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -r scripts/requirements.txt
```

### 2. Put the bulb into setup mode

Factory-reset the bulb and put it into its Wi-Fi setup state.

On the tested LB1, setup mode is indicated by fast blinking.

If the bulb exposes a temporary setup Wi-Fi access point, connect the computer running the setup script to that network before continuing.

Avoid adding the bulb back to old third-party applications if your goal is direct LAN control. The tested bulb was previously provisioned by an old Magic Home application in a LAN-locked state.

### 3. Provision Wi-Fi

Run:

```bash
python scripts/setup_bulb.py "Your Wi-Fi SSID"
```

The script prompts for the Wi-Fi password without echoing it.

You can also provide the password explicitly:

```bash
python scripts/setup_bulb.py "Your Wi-Fi SSID" --password "your-wifi-password"
```

For a different supported security mode:

```bash
python scripts/setup_bulb.py "Your Wi-Fi SSID" --security wpa1/2
```

After successful provisioning, the bulb should leave setup mode and join your normal Wi-Fi network.

### 4. Find the bulb IP address

Find the bulb in your router/DHCP leases or with your preferred LAN scanner.

The Homebridge accessory identity is based on the bulb MAC address, not its IP address, so later DHCP address changes do not create duplicate accessories.

### 5. Unlock local LAN control

Run:

```bash
python scripts/unlock_lb1.py --ip 192.168.1.50
```

Replace `192.168.1.50` with the bulb's actual address.

The helper:

- discovers the bulb;
- authenticates locally;
- calls `set_lock(False)`;
- performs a fresh discovery;
- verifies that `Locked` is `False`;
- verifies that a fresh session can authenticate and read state.

The Homebridge plugin never intentionally sets the device lock to `true`.

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

Manual and discovered devices are de-duplicated by MAC address.

You can also use discovery only:

```json
{
  "platform": "BroadlinkLB1Local",
  "name": "BroadLink LB1 Local",
  "discovery": true,
  "devices": []
}
```

## Configuration Options

| Option | Default | Description |
|---|---:|---|
| `discovery` | `true` | Enable LAN discovery on startup |
| `discoveryTimeout` | `5` | Discovery timeout in seconds |
| `pollInterval` | `10` | State polling interval in seconds |
| `keepAliveInterval` | `90` | Firmware watchdog ping interval in seconds; `0` disables it |
| `commandTimeout` | `4` | UDP command timeout in seconds |
| `retries` | `2` | Maximum bounded retries per command |
| `colorDebounceMs` | `100` | Coalescing delay for nearby HomeKit color updates |
| `devices` | `[]` | Manually configured bulbs |

Manual device entries support:

```json
{
  "name": "LB1 Lamp",
  "host": "192.168.1.50",
  "mac": "aa:bb:cc:dd:ee:ff"
}
```

Optional device fields may include `port` and `devtype`.

## Troubleshooting

### The bulb is discovered but reports `Locked: True`

The plugin cannot authenticate to a LAN-locked bulb.

Reset/re-provision the bulb and run:

```bash
python scripts/unlock_lb1.py --ip YOUR_BULB_IP
```

### The bulb is not discovered

Check that Homebridge and the bulb are on the same LAN/VLAN and that UDP broadcast traffic is allowed.

You can also configure the bulb manually with its IP and MAC address.

### The bulb works but later becomes unreachable

The plugin automatically retries communication and re-authenticates when needed.

For firmware that uses the BroadLink watchdog, keepalive ping is enabled by default every 90 seconds.

### Color temperature

HomeKit uses mired values while the LB1 protocol uses Kelvin. The plugin performs the conversion internally.

The current implementation clamps outgoing color temperature to `2700K..6500K`.

## Development

Use Node.js 22 LTS for development and publishing. Node.js 24 is also supported by Homebridge, but Node.js 26 is not supported by Homebridge at the time of this release.

If you use `nvm`:

```bash
nvm install
nvm use
```

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

## Credits

The optional setup helpers use [`python-broadlink`](https://github.com/mjg59/python-broadlink), an MIT-licensed project for local BroadLink device control.

The Homebridge plugin itself communicates with the bulb directly from Node.js/TypeScript and does not require `python-broadlink` at runtime.

## Tested Hardware

Current physical validation:

```text
BroadLink LB1
devtype:  0x60C8
firmware: 57231
```

Support for additional BroadLink bulb revisions should be considered unverified until tested on real hardware.
