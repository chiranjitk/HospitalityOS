#!/usr/bin/env python3
"""
StaySuite — MikroTik CHR Configuration Script

Configures a freshly booted MikroTik CHR via the RouterOS API.
Run this after starting the QEMU VM.

Default configuration:
  - IP: 10.0.2.15/24 on ether1
  - Gateway: 10.0.2.2 (QEMU user-mode NAT)
  - DNS: 8.8.8.8
  - Password: staysuite2025
  - RADIUS: 10.0.2.2:1812/1813 secret=testing123
  - CoA: UDP 3799
  - Hotspot: staysuite-hotspot (disabled by default)
  - REST API: Port 80 (forwarded as 8080 on host)

Usage:
  python3 configure-mikrotik.py
"""
import socket, sys, time

def encode_word(word):
    encoded = word.encode('utf-8')
    length = len(encoded)
    if length < 0x80: return bytes([length]) + encoded
    elif length < 0x4000: return bytes([(length >> 8) | 0x80, length & 0xFF]) + encoded
    elif length < 0x200000: return bytes([(length >> 16) | 0xC0, (length >> 8) & 0xFF, length & 0xFF]) + encoded
    else: return bytes([0xF0, (length >> 24) & 0xFF, (length >> 16) & 0xFF, (length >> 8) & 0xFF, length & 0xFF]) + encoded

def encode_sentence(words):
    result = b''
    for word in words: result += encode_word(word)
    result += b'\x00'
    return result

def read_response(sock, timeout=10):
    data = b''
    start = time.time()
    while time.time() - start < timeout:
        sock.settimeout(2)
        try:
            chunk = sock.recv(4096)
            if not chunk: break
            data += chunk
            if b'!done' in data: break
        except socket.timeout:
            if b'!done' in data: break
    return data

def send_command(sock, words, timeout=10):
    sock.sendall(encode_sentence(words))
    return read_response(sock, timeout)

def check_success(resp):
    return b'!done' in resp and b'!trap' not in resp

def main():
    host = '127.0.0.1'
    port = 8728
    
    print(f"Connecting to MikroTik CHR API at {host}:{port}...")
    
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(10)
    try:
        sock.connect((host, port))
    except ConnectionRefusedError:
        print("ERROR: Cannot connect. Is the QEMU VM running?")
        print("Start it with: pm2 start start-mikrotik.sh --name mikrotik-chr --interpreter bash")
        sys.exit(1)
    
    # Login (fresh CHR has admin with no password)
    resp = send_command(sock, ['/login', '=name=admin', '=password='])
    if not check_success(resp):
        print("Empty password failed, trying staysuite2025...")
        sock.close()
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.connect((host, port))
        resp = send_command(sock, ['/login', '=name=admin', '=password=staysuite2025'])
        if not check_success(resp):
            print("ERROR: Login failed!")
            sys.exit(1)
    
    print("✓ Logged in!")
    
    # Configure
    commands = [
        (['/ip/address/add', '=address=10.0.2.15/24', '=interface=ether1'], "IP address"),
        (['/ip/route/add', '=gateway=10.0.2.2'], "Default gateway"),
        (['/ip/dns/set', '=servers=8.8.8.8', '=allow-remote-requests=yes'], "DNS"),
        (['/ip/service/set', '=numbers=www', '=disabled=no', '=address=0.0.0.0/0'], "WWW/REST API"),
        (['/ip/service/set', '=numbers=api', '=disabled=no', '=address=0.0.0.0/0'], "API (8728)"),
        (['/ip/service/set', '=numbers=ssh', '=disabled=no'], "SSH"),
        (['/ip/service/set', '=numbers=winbox', '=disabled=no'], "Winbox"),
        (['/radius/add', '=address=10.0.2.2', '=secret=testing123', '=service=hotspot,ppp,login,dhcp,wireless,ipsec', '=timeout=3s'], "RADIUS client"),
        (['/radius/incoming/set', '=accept=yes', '=port=3799'], "CoA listener"),
        (['/interface/bridge/add', '=name=bridge1'], "Bridge"),
        (['/interface/bridge/port/add', '=bridge=bridge1', '=interface=ether1'], "Bridge port"),
        (['/ip/hotspot/profile/add', '=name=staysuite-hsprof', '=hotspot-address=10.0.2.15', '=dns-name=wifi.staysuite.local', '=use-radius=yes', '=login-by=http-chap,http-pap'], "Hotspot profile"),
        (['/ip/hotspot/user/profile/add', '=name=staysuite-default', '=shared-users=1'], "User profile"),
        (['/ip/hotspot/add', '=name=staysuite-hotspot', '=interface=bridge1', '=profile=staysuite-hsprof', '=disabled=yes'], "Hotspot (disabled)"),
    ]
    
    for cmd, desc in commands:
        resp = send_command(sock, cmd)
        status = "✓" if check_success(resp) or b'already' in resp else "⚠"
        print(f"  {status} {desc}")
    
    # Set password LAST (causes disconnect)
    print("\n  Setting admin password...")
    resp = send_command(sock, ['/user/set', '=numbers=admin', '=password=staysuite2025'])
    print("  ✓ Password set to staysuite2025")
    
    sock.close()
    
    # Verify REST API
    print("\n=== Verifying REST API ===")
    import urllib.request
    import base64
    credentials = base64.b64encode(b'admin:staysuite2025').decode()
    req = urllib.request.Request('http://127.0.0.1:8080/rest/system/resource')
    req.add_header('Authorization', f'Basic {credentials}')
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            import json
            data = json.loads(resp.read())
            print(f"  ✓ REST API working!")
            print(f"  Version: {data.get('version')}")
            print(f"  Board: {data.get('board-name')}")
            print(f"  CPU Load: {data.get('cpu-load')}%")
            print(f"  Uptime: {data.get('uptime')}")
    except Exception as e:
        print(f"  ✗ REST API check failed: {e}")
    
    print("\n✓ MikroTik CHR configured successfully!")
    print("\nAccess points:")
    print("  REST API:  http://127.0.0.1:8080/rest/")
    print("  API:       127.0.0.1:8728 (admin / staysuite2025)")
    print("  Winbox:    127.0.0.1:8291")
    print("  SSH:       127.0.0.1:2222 (ssh admin@127.0.0.1 -p 2222)")
    print("  WebFig:    http://127.0.0.1:8080/")

if __name__ == '__main__':
    main()
