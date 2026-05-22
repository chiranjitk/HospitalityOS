#!/bin/bash
# StaySuite — MikroTik CHR (Cloud Hosted Router) v7.18
# Runs via QEMU 9.2.0 TCG (software emulation)
#
# Port forwarding (host → CHR guest):
#   8728  → RouterOS API       |  8291  → Winbox
#   2222  → SSH                |  8080  → WebFig (HTTP)
#   8729  → API-SSL
#
# Login: admin (no password on fresh CHR)
# Run: python3 configure-mikrotik.py  (after first boot)

export LD_LIBRARY_PATH="/home/z/my-project:${LD_LIBRARY_PATH:-}"

exec /home/z/my-project/qemu-system-x86_64 \
  -L /home/z/my-project/qemu-share \
  -m 256 \
  -smp 1 \
  -drive file=/home/z/my-project/mikrotik-chr.img,format=raw,if=virtio \
  -netdev user,id=net0,hostname=mikrotik-chr,\
hostfwd=tcp::8728-:8728,\
hostfwd=tcp::8291-:8291,\
hostfwd=tcp::2222-:22,\
hostfwd=tcp::8080-:80,\
hostfwd=tcp::8729-:8729 \
  -device virtio-net-pci,netdev=net0 \
  -nographic \
  -no-reboot \
  -accel tcg,thread=multi
