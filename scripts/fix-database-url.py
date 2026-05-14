#!/usr/bin/env python3
"""
StaySuite - Fix corrupted DATABASE_URL in ecosystem.config.js
Run from project root: python3 scripts/fix-database-url.py
Run on production:   cd /opt/staysuite && python3 scripts/fix-database-url.py
"""
import re, sys, os

# Auto-detect: use arg if provided, else try common paths
if len(sys.argv) > 1:
    target_dir = sys.argv[1]
else:
    for d in ['/opt/staysuite', os.path.dirname(os.path.dirname(os.path.abspath(__file__)))]:
        if os.path.exists(os.path.join(d, 'ecosystem.config.js')):
            target_dir = d
            break
    else:
        print("ERROR: Cannot find ecosystem.config.js in /opt/staysuite or script parent dir")
        sys.exit(1)

os.chdir(target_dir)
print(f"Working directory: {os.getcwd()}")

fixed_files = []

# ── 1. Fix ecosystem.config.js ──────────────────────────────────────────────
ecosystem_file = 'ecosystem.config.js'
if os.path.exists(ecosystem_file):
    with open(ecosystem_file, 'r') as f:
        content = f.read()

    lines = content.split('\n')
    fixed = 0
    for i, line in enumerate(lines):
        if 'DATABASE_URL' in line and ('connect_timeout' in line or 'pool_timeout' in line or len(line) > 150):
            # Extract clean base URL
            match = re.search(r"postgresql://staysuite:[^'\"?\s]+", line)
            if match:
                clean_url = match.group(0)
                # Preserve DB name suffix (_staging, _dev, _prod)
                suffix_match = re.search(r"(staysuite)(_[a-zA-Z]+)?['\"]", line)
                if suffix_match and suffix_match.group(2):
                    clean_url += suffix_match.group(2)
                lines[i] = re.sub(
                    r"DATABASE_URL:\s*'[^\']*'",
                    f"DATABASE_URL: '{clean_url}'",
                    line
                )
                fixed += 1

    with open(ecosystem_file, 'w') as f:
        f.write('\n'.join(lines))

    if fixed > 0:
        fixed_files.append(f"{ecosystem_file} ({fixed} lines fixed)")
    else:
        # Check if any corruption remains
        with open(ecosystem_file, 'r') as f:
            if 'connect_timeout' in f.read() or 'pool_timeout' in f.read():
                fixed_files.append(f"{ecosystem_file} (WARNING: suspicious content remains)")
            else:
                fixed_files.append(f"{ecosystem_file} (already clean)")
else:
    print(f"ERROR: {ecosystem_file} not found!")
    sys.exit(1)

# ── 2. Fix .env file ────────────────────────────────────────────────────────
for env_file in ['.env', '.env.local', '.env.production', '.env.production.local']:
    if os.path.exists(env_file):
        with open(env_file, 'r') as f:
            lines = f.readlines()

        changed = False
        new_lines = []
        for line in lines:
            if line.startswith('DATABASE_URL=') or line.startswith('RADIUS_DATABASE_URL='):
                if '?' in line:
                    clean_url = line.split('=', 1)[1].strip().split('?')[0]
                    key = line.split('=', 1)[0]
                    new_lines.append(f"{key}={clean_url}\n")
                    changed = True
                else:
                    new_lines.append(line)
            else:
                new_lines.append(line)

        if changed:
            with open(env_file, 'w') as f:
                f.writelines(new_lines)
            fixed_files.append(f"{env_file} (stripped query params)")

# ── 3. Remove .env.production if it has __PLACEHOLDER__ ─────────────────────
if os.path.exists('.env.production'):
    with open('.env.production', 'r') as f:
        content = f.read()
    if '__' in content and ('DBPASS' in content or 'APP_URL' in content):
        os.rename('.env.production', '.env.production.template')
        fixed_files.append(".env.production → .env.production.template (had __PLACEHOLDER__ values)")
    else:
        fixed_files.append(".env.production (exists, no placeholders - kept)")

# ── 4. Summary ──────────────────────────────────────────────────────────────
print("=" * 60)
print("DATABASE_URL Fix Summary:")
print("=" * 60)
for f in fixed_files:
    print(f"  {f}")

# Verify
print("\n--- Verification ---")
for check_file in ['ecosystem.config.js', '.env']:
    if os.path.exists(check_file):
        with open(check_file, 'r') as f:
            for line in f:
                if 'DATABASE_URL' in line and not line.strip().startswith('#'):
                    clean = '?' not in line or 'sslmode' in line
                    status = "OK" if clean else "STILL BROKEN"
                    url = line.strip()[:100]
                    print(f"  [{status}] {check_file}: {url}")
                    break

print("\n--- PM2 Restart Required ---")
print("  pm2 delete all")
print("  pm2 start ecosystem.config.js")
print("  pm2 save")
print("  sleep 10 && pm2 logs staysuite-nextjs --lines 10 --nostream")
