#!/usr/bin/env python3
"""
StaySuite — MikroTik CHR Configuration Script

Configures a freshly booted MikroTik CHR via the RouterOS API.
Run this after starting the QEMU VM: pm2 start ecosystem-mikrotik.cjs

Default configuration:
  - IP: 10.0.2.15/24 on ether1
  - Gateway: 10.0.2.2 (QEMU user-mode NAT)
  - DNS: 8.8.8.8
  - Services: API (8728), SSH (22), Winbox (8291), WebFig (80)

Usage:
  python3 configure-mikrotik.py [--host 127.0.0.1] [--port 8728]
"""
import socket, sys, time

def encode_word(word):
    """Encode a word in MikroTik API format (length-prefixed)"""
    encoded = word.encode('utf-8')
    length = len(encoded)
    if length < 0x80:
        return bytes([length]) + encoded
    elif length < 0x4000:
        return bytes([(length >> 8) | 0x80, length & 0xFF]) + encoded
    elif length < 0x200000:
        return bytes([(length >> 16) | 0xC0, (length >> 8) & 0xFF, length & 0xFF]) + encoded
    else:
        return bytes([0xF0, (length >> 24) & 0xFF, (length >> 16) & 0xFF, (length >> 8) & 0xFF, length & 0xFF]) + encoded

def encode_sentence(words):
    """Encode a sentence (list of words) with end marker"""
    result = b''
    for word in words:
        result += encode_word(word)
    result += b'\x00'  # End of sentence
    return result

def read_response(sock, timeout=10):
    """Read and parse MikroTik API response"""
    data = b''
    start = time.time()
    while time.time() - start < timeout:
        sock.settimeout(2)
        try:
            chunk = sock.recv(4096)
            if not chunk:
                break
            data += chunk
            if b'!done' in data:
                break
        except socket.timeout:
            if b'!done' in data:
                break
            continue
    
    # Parse into sentences
    sentences = []
    current = []
    word_buf = b''
    i = 0
    while i < len(data):
        if data[i] == 0:  # End of sentence
            if word_buf:
                current.append(word_buf.decode('utf-8', errors='replace'))
                word_buf = b''
            if current:
                sentences.append(current)
                current = []
            i += 1
            continue
        
        # Read length
        length = data[i]
        if length < 0x80:
            i += 1
        elif length < 0xC0:
            length = ((length & 0x3F) << 8) | data[i+1]
            i += 2
        elif length < 0xE0:
            length = ((length & 0x3F) << 16) | (data[i+1] << 8) | data[i+2]
            i += 3
        else:
            length = ((length & 0x1F) << 24) | (data[i+1] << 16) | (data[i+2] << 8) | data[i+3]
            i += 4
        
        word_buf = data[i:i+length]
        i += length
    
    return sentences

def send_command(sock, words, timeout=10):
    """Send a command and return the response"""
    sock.sendall(encode_sentence(words))
    return read_response(sock, timeout)

def main():
    host = '127.0.0.1'
    port = 8728
    
    # Parse args
    args = sys.argv[1:]
    i = 0
    while i < len(args):
        if args[i] == '--host' and i+1 < len(args):
            host = args[i+1]; i += 2
        elif args[i] == '--port' and i+1 < len(args):
            port = int(args[i+1]); i += 2
        else:
            i += 1
    
    print(f"Connecting to MikroTik API at {host}:{port}...")
    
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        sock.connect((host, port))
    except ConnectionRefusedError:
        print("ERROR: Cannot connect. Is the QEMU VM running?")
        print("Start it with: pm2 start ecosystem-mikrotik.cjs")
        sys.exit(1)
    
    # Login
    print("Logging in as admin...")
    resp = send_command(sock, ['/login', '=name=admin', '=password='])
    if any('!done' in w for s in resp for w in s):
        print("✓ Logged in!")
    else:
        print("✗ Login failed:", resp)
        sys.exit(1)
    
    # Configure
    commands = [
        (['/ip/address/add', '=address=10.0.2.15/24', '=interface=ether1'], "Setting IP address"),
        (['/ip/route/add', '=gateway=10.0.2.2'], "Setting default gateway"),
        (['/ip/dns/set', '=servers=8.8.8.8', '=allow-remote-requests=yes'], "Setting DNS"),
        (['/ip/service/enable', '=numbers=api'], "Enabling API service"),
        (['/ip/service/enable', '=numbers=ssh'], "Enabling SSH service"),
        (['/ip/service/enable', '=numbers=www'], "Enabling WebFig service"),
        (['/ip/service/enable', '=numbers=winbox'], "Enabling Winbox service"),
    ]
    
    for cmd, desc in commands:
        print(f"  {desc}...", end=" ")
        resp = send_command(sock, cmd)
        if any('!done' in w for s in resp for w in s):
            print("✓")
        elif any('!trap' in w for s in resp for w in s):
            # Error - might already exist
            error_msg = str(resp)
            if 'already' in error_msg.lower() or 'exists' in error_msg.lower():
                print("⚠ (already configured)")
            else:
                print(f"⚠ {resp}")
        else:
            print(f"? {resp}")
    
    # Verify
    print("\n=== Verification ===")
    
    # System info
    resp = send_command(sock, ['/system/resource/print'])
    for sentence in resp:
        for word in sentence:
            if word.startswith('='):
                key, val = word.split('=', 1)[1].split('=', 1) if '=' in word[1:] else (word[1:], '')
                if key in ('version', 'uptime', 'board-name', 'cpu', 'cpu-load', 'free-memory', 'total-memory'):
                    print(f"  {key}: {val}")
    
    # IP addresses
    resp = send_command(sock, ['/ip/address/print'])
    print("  IP Addresses:")
    for sentence in resp:
        for word in sentence:
            if word.startswith('=address='):
                print(f"    {word[1:]}")
    
    # Services
    resp = send_command(sock, ['/ip/service/print'])
    print("  Services:")
    for sentence in resp:
        name = val = port_val = disabled = ''
        for word in sentence:
            if word.startswith('=name='): name = word.split('=')[-1]
            elif word.startswith('=port='): port_val = word.split('=')[-1]
            elif word.startswith('=disabled='): disabled = word.split('=')[-1]
        if name:
            status = '✓' if disabled == 'false' else '✗'
            print(f"    {status} {name} (port {port_val})")
    
    sock.close()
    print("\n✓ MikroTik CHR configured successfully!")
    print("\nAccess points:")
    print("  API:     127.0.0.1:8728")
    print("  Winbox:  127.0.0.1:8291")
    print("  SSH:     127.0.0.1:2222  (ssh admin@127.0.0.1 -p 2222)")
    print("  WebFig:  http://127.0.0.1:8080")
    print("  API-SSL: 127.0.0.1:8729")

if __name__ == '__main__':
    main()
