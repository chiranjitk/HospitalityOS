#!/bin/bash
# Start OpenWrt x86_64 VM in QEMU
# OpenWrt - Lightweight gateway for captive portal testing
# Ports: 3040→HTTP, 3041→HTTPS, 3042→SSH

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OPENWRT_DIR="$SCRIPT_DIR/openwrt"
PIDFILE="$OPENWRT_DIR/openwrt.pid"
IMAGE="$OPENWRT_DIR/openwrt-resized.img"

if [ -f "$PIDFILE" ]; then
    OLD_PID=$(cat "$PIDFILE")
    if kill -0 "$OLD_PID" 2>/dev/null; then
        echo "OpenWrt VM already running (PID: $OLD_PID)"
        exit 0
    fi
    rm -f "$PIDFILE"
fi

QEMU_BIN=$(which qemu-system-x86_64 2>/dev/null || ls /tmp/qemu-extract/qemu-system-x86_64 2>/dev/null || ls /home/z/qemu-system-x86_64 2>/dev/null)
if [ -z "$QEMU_BIN" ]; then
    echo "ERROR: qemu-system-x86_64 not found"
    exit 1
fi

$QEMU_BIN \
    -L /tmp/qemu-share \
    -machine type=pc,accel=tcg \
    -cpu qemu64 \
    -smp 1 \
    -m 256 \
    -drive file="$IMAGE",format=raw,if=virtio \
    -netdev user,id=wan,hostfwd=tcp::3040-:80,hostfwd=tcp::3041-:443,hostfwd=tcp::3042-:22 \
    -device virtio-net-pci,netdev=wan \
    -display none \
    -serial file:"$OPENWRT_DIR/serial.log" \
    -monitor none \
    -daemonize \
    -pidfile "$PIDFILE"

echo "OpenWrt VM started (PID: $(cat "$PIDFILE"))"
echo "  HTTP:  http://localhost:3040 (LuCI)"
echo "  HTTPS: https://localhost:3041"
echo "  SSH:   ssh root@localhost -p 3042"
