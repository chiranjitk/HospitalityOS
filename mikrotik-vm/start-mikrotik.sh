#!/bin/bash
# MikroTik RouterOS v7.17 CHR — QEMU Startup Script
# Starts MikroTik as a virtual machine on the sandbox
#
# Port Mappings:
#   3020 → Guest :80   (RouterOS WebFig / REST API)
#   3021 → Guest :443  (RouterOS WebFig HTTPS)
#   8728 → Guest :8728 (RouterOS API)
#   8729 → Guest :8729 (RouterOS API-SSL)
#   2222 → Guest :22   (RouterOS SSH)
#
# Default Login: admin / (no password)
# After first config: admin / admin

cd /home/z/my-project/mikrotik-vm

export LD_LIBRARY_PATH="/tmp/qemu-extract/usr/lib/x86_64-linux-gnu:/tmp/qemu-extract/lib/x86_64-linux-gnu:$LD_LIBRARY_PATH"
export PATH="/tmp/qemu-extract/usr/bin:$PATH"

exec qemu-system-x86_64 \
  -L /tmp/qemu-share \
  -machine type=pc,accel=tcg \
  -cpu qemu64 \
  -smp 2 \
  -m 512 \
  -drive file=/home/z/my-project/mikrotik-vm/mikrotik-disk.img,format=raw,if=virtio \
  -netdev user,id=wan,hostfwd=tcp::3020-:80,hostfwd=tcp::3021-:443,hostfwd=tcp::8728-:8728,hostfwd=tcp::8729-:8729,hostfwd=tcp::2222-:22 \
  -device virtio-net-pci,netdev=wan \
  -netdev user,id=lan,restrict=on \
  -device virtio-net-pci,netdev=lan \
  -display none \
  -serial file:/home/z/my-project/mikrotik-vm/serial.log \
  -monitor none \
  -daemonize \
  -pidfile /home/z/my-project/mikrotik-vm/mikrotik.pid \
  2>&1
