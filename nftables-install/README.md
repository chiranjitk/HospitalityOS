# nftables v1.1.1 — StaySuite WiFi Test Environment

Compiled from source: https://git.netfilter.org/nftables (tag v1.1.1)

## Tools

| Command | Purpose |
|---------|---------|
| `nft-check -f rules.nft` | **Syntax validation only** — parses rules, reports syntax errors vs runtime warnings |
| `nft-exec -f rules.nft` | Apply ruleset in isolated namespace (fresh namespace each call) |
| `nft-batch rules.nft "list tables"` | Apply rules + run extra commands in same namespace |
| `nft --version` | Show version (nftables v1.1.1) |

## How It Works

- Uses `unshare --user --map-root-user --net` to create an isolated network namespace
- No root/sudo required — all operations run in user namespace
- Each `nft-exec` call gets a fresh namespace (no state persistence)
- Use `nft-batch` to apply rules AND query them in the same namespace

## Limitations

- Some kernel modules (conntrack, log, NAT masquerade) may not be available in the namespace
- Rules that require specific interfaces (e.g., `iif eth0`) will fail at apply time
- This is expected — syntax checking still works perfectly for those rules

## Example Usage

```bash
# Check syntax of a rules file
nft-check -f /path/to/rules.nft

# Apply and inspect chain priorities
nft-batch rules.nft "-j list ruleset" | python3 /tmp/nft-parse.py

# List tables after applying
nft-batch rules.nft "list tables"
```

## Dependencies (all locally extracted, no root needed)

- libmnl 1.0.5
- libnftnl 1.2.9
- libedit 3.1
- libjansson 2.14 (JSON support)
- bison 3.8.2
- flex 2.6.4
- libgmp 6.3.0
