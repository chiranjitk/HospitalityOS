#!/bin/bash
# StaySuite — MikroTik CHR (Cloud Hosted Router) v7.18
# Runs via QEMU 9.2.0 TCG (software emulation)
#
# Port forwarding (host → CHR guest):
#   8080  → Hotspot (HTTP port 80)  |  8728  → RouterOS API
#   8291  → Winbox                  |  2222  → SSH
#   8729  → API-SSL                 |  8081  → REST API (port 81)
#
# Login: admin / staysuite2025
# Serial: socat - UNIX-CONNECT:/tmp/mikrotik-serial.sock

export LD_LIBRARY_PATH="/home/z/my-project:${LD_LIBRARY_PATH:-}"

# Socket files are placed in /tmp to avoid Turbopack scanning them
# (Turbopack tries to read .sock files as JS/CSS, causing server crash)
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
hostfwd=tcp::8081-:81,\
hostfwd=tcp::8729-:8729 \
  -device virtio-net-pci,netdev=net0 \
  -monitor unix:/tmp/mikrotik-monitor.sock,server,nowait \
  -serial unix:/tmp/mikrotik-serial.sock,server,nowait \
  -display none \
  -daemonize \
  -accel tcg,thread=multi
