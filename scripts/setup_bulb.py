#!/usr/bin/env python3

"""Provision a BroadLink-compatible bulb onto a local Wi-Fi network.

This helper is only for initial bulb setup. The Homebridge plugin itself does
not use Python and does not depend on python-broadlink at runtime.
"""

from __future__ import annotations

import argparse
import getpass
import sys
import time

import broadlink


SECURITY_MODES = {
    "open": 0,
    "wep": 1,
    "wpa": 2,
    "wpa2": 3,
    "wpa1/2": 4,
}


def parse_arguments() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Configure a BroadLink LB1 or compatible device while it is in AP mode.",
    )
    parser.add_argument("ssid", help="SSID of the Wi-Fi network the bulb should join.")
    parser.add_argument(
        "--password",
        help="Wi-Fi password. If omitted, the script prompts without echoing.",
    )
    parser.add_argument(
        "--security",
        choices=SECURITY_MODES,
        default="wpa2",
        help="Wi-Fi security mode. Default: wpa2.",
    )
    parser.add_argument(
        "--broadcast",
        default="255.255.255.255",
        help="Broadcast address used for provisioning. Default: 255.255.255.255.",
    )
    return parser.parse_args()


def main() -> int:
    """Provision the bulb."""
    args = parse_arguments()
    password = args.password if args.password is not None else getpass.getpass("Wi-Fi password: ")
    security_mode = SECURITY_MODES[args.security]

    print("BroadLink Wi-Fi provisioning")
    print("----------------------------")
    print(f"SSID:      {args.ssid}")
    print(f"Security:  {args.security}")
    print(f"Broadcast: {args.broadcast}")
    print()
    print("Make sure this computer is currently connected to the bulb's Wi-Fi access point.")
    print()

    try:
        broadlink.setup(
            args.ssid,
            password,
            security_mode,
            ip_address=args.broadcast,
        )
    except Exception as exc:
        print(f"Provisioning failed: {exc!r}")
        return 1

    print("Provisioning packet sent.")
    print()
    print("The bulb should now leave AP mode and connect to the configured Wi-Fi network.")
    time.sleep(2)
    return 0


if __name__ == "__main__":
    sys.exit(main())
