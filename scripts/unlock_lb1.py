#!/usr/bin/env python3

"""Disable the BroadLink device lock and verify LAN authentication.

This helper is only for initial bulb preparation. The Homebridge plugin itself
does not use Python and does not depend on python-broadlink at runtime.
"""

from __future__ import annotations

import argparse
import sys
import time

import broadlink


EXPECTED_DEVTYPE = 0x60C8


def parse_args() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Unlock a BroadLink LB1 and verify LAN authentication.",
    )
    parser.add_argument(
        "--ip",
        required=True,
        help="Bulb IP address after it has joined your Wi-Fi network.",
    )
    parser.add_argument(
        "--expected-devtype",
        default=f"0x{EXPECTED_DEVTYPE:04X}",
        help="Expected BroadLink product ID. Default: 0x60C8.",
    )
    return parser.parse_args()


def parse_devtype(value: str) -> int:
    """Parse decimal or 0x-prefixed device type."""
    return int(value, 0)


def print_device(device: object) -> None:
    """Print basic BroadLink device information."""
    print(f"IP:           {device.host}")
    print(f"Class:        {device.__class__.__name__}")
    print(f"Product ID:   0x{device.devtype:04X}")
    print(f"Name:         {device.name!r}")
    print(f"Model:        {device.model!r}")
    print(f"Manufacturer: {device.manufacturer!r}")
    print(f"Locked:       {device.is_locked}")


def main() -> int:
    """Unlock the bulb and verify the result using a fresh discovery."""
    args = parse_args()
    expected_devtype = parse_devtype(args.expected_devtype)

    print(f"Connecting to BroadLink device at {args.ip}...\n")

    try:
        device = broadlink.hello(args.ip)
    except Exception as exc:
        print(f"ERROR: discovery failed: {exc!r}")
        return 1

    print("Device before change:")
    print_device(device)

    if device.devtype != expected_devtype:
        print()
        print(
            "WARNING: expected product ID "
            f"0x{expected_devtype:04X}, got 0x{device.devtype:04X}."
        )

    print("\nAuthenticating...")

    try:
        device.auth()
    except Exception as exc:
        print(f"ERROR: authentication failed: {exc!r}")
        return 2

    print("Authentication: OK")
    print("\nExplicitly setting lock=False...")

    try:
        device.set_lock(False)
    except Exception as exc:
        print(f"ERROR: set_lock(False) failed: {exc!r}")
        return 3

    print("set_lock(False): command accepted")

    # Do not trust only device.is_locked because set_lock() also updates
    # the Python object's local field. Ask the physical device again.
    time.sleep(1)

    print("\nPerforming fresh discovery to verify persistent lock state...")

    try:
        fresh_device = broadlink.hello(args.ip)
    except Exception as exc:
        print(f"ERROR: fresh discovery failed: {exc!r}")
        return 4

    print("\nDevice after change:")
    print_device(fresh_device)

    if fresh_device.is_locked:
        print("\nERROR: device reports Locked=True after set_lock(False).")
        return 5

    print("\nTesting authentication with a completely fresh object...")

    try:
        fresh_device.auth()
    except Exception as exc:
        print(f"ERROR: fresh authentication failed: {exc!r}")
        return 6

    print("Fresh authentication: OK")

    try:
        state = fresh_device.get_state()
    except Exception as exc:
        print(f"ERROR: get_state() failed: {exc!r}")
        return 7

    print("\nCurrent bulb state:")
    for key, value in state.items():
        if key == "bulb_scenes":
            continue
        print(f"  {key}: {value}")

    print("\nSUCCESS")
    print("The bulb is unlocked and accepts fresh LAN authentication.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
