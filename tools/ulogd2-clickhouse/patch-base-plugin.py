#!/usr/bin/env python3
"""
Patch ulogd_raw2packet_BASE.c to pass through raw.pkt to downstream plugins.

Three changes:
1. Add KEY_RAW_PKT to output_keys enum (after KEY_SCTP_CSUM)
2. Add raw.pkt entry to iphdr_rets[]
3. Copy raw.pkt from input to output in _interp_pkt()

ROOT CAUSE of previous patch failure:
  okey_set_ptr() only sets ptr + VALID flag, NOT key->len.
  JSON plugin checks key->len > 0 before hex conversion.
  Without len, the condition fails and raw.pkt is silently dropped.

FIX: Explicitly set ret[KEY_RAW_PKT].len = raw_src->len

Usage:
  python3 patch-base-plugin.py <path/to/ulogd_raw2packet_BASE.c>
"""
import sys
import re


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 patch-base-plugin.py <base.c>", file=sys.stderr)
        sys.exit(1)

    filepath = sys.argv[1]

    with open(filepath, 'r') as f:
        lines = f.readlines()

    changes = 0

    # ── Change 1: Add KEY_RAW_PKT to output_keys enum ──────────────────────
    # Find the line "	KEY_SCTP_CSUM," followed by blank line and "};"
    for i, line in enumerate(lines):
        if re.match(r'\tKEY_SCTP_CSUM,\s*$', line):
            if i + 2 < len(lines) and lines[i + 1].strip() == '' and lines[i + 2].strip() == '};':
                if 'KEY_RAW_PKT' not in line:
                    lines.insert(i + 1, '\tKEY_RAW_PKT,\n')
                    changes += 1
                    print(f"  [1/3] line {i+2}: Added KEY_RAW_PKT to output_keys enum")
                else:
                    print("  [1/3] KEY_RAW_PKT already in enum")
                    changes += 1
                break
    else:
        print("  [1/3] ERROR: Could not find KEY_SCTP_CSUM in enum", file=sys.stderr)
        sys.exit(1)

    # ── Change 2: Add raw.pkt entry to iphdr_rets[] ───────────────────────
    # Find [KEY_SCTP_CSUM] entry, then the closing "};" of the array
    for i, line in enumerate(lines):
        if re.match(r'\t\[KEY_SCTP_CSUM\]', line):
            j = i
            while j < len(lines) and not re.match(r'\};', lines[j]):
                j += 1
            if j < len(lines):
                block = ''.join(lines[i:j])
                if 'KEY_RAW_PKT' not in block:
                    insert_lines = [
                        '\t[KEY_RAW_PKT] = {\n',
                        '\t\t.type = ULOGD_RET_RAW,\n',
                        '\t\t.flags = ULOGD_RETF_NONE,\n',
                        '\t\t.name = "raw.pkt",\n',
                        '\t},\n',
                    ]
                    for k, ins in enumerate(insert_lines):
                        lines.insert(j + k, ins)
                    changes += 1
                    print(f"  [2/3] line {j+1}: Added raw.pkt entry to iphdr_rets[]")
                else:
                    print("  [2/3] raw.pkt entry already in iphdr_rets[]")
                    changes += 1
            break
    else:
        print("  [2/3] ERROR: Could not find [KEY_SCTP_CSUM] in iphdr_rets[]", file=sys.stderr)
        sys.exit(1)

    # ── Change 3: Copy raw.pkt in _interp_pkt() ────────────────────────────
    # Find "okey_set_u16(&ret[KEY_OOB_PROTOCOL]," then insert after the statement
    for i, line in enumerate(lines):
        if 'okey_set_u16(&ret[KEY_OOB_PROTOCOL]' in line:
            j = i
            while j < len(lines) and ');' not in lines[j]:
                j += 1
            if j < len(lines):
                block = ''.join(lines[i:j + 1])
                if 'raw_src' not in block:
                    insert_lines = [
                        '\n',
                        '\t/* Pass through raw.pkt for TLS SNI extraction */\n',
                        '\t{\n',
                        '\t\tstruct ulogd_key *raw_src = pi->input.keys[INKEY_RAW_PCKT].u.source;\n',
                        '\t\tif (raw_src && (raw_src->flags & ULOGD_RETF_VALID)) {\n',
                        '\t\t\tret[KEY_RAW_PKT].u.value.ptr = raw_src->u.value.ptr;\n',
                        '\t\t\tret[KEY_RAW_PKT].len = raw_src->len;\n',
                        '\t\t\tret[KEY_RAW_PKT].flags |= ULOGD_RETF_VALID;\n',
                        '\t\t}\n',
                        '\t}\n',
                    ]
                    for k, ins in enumerate(insert_lines):
                        lines.insert(j + 1 + k, ins)
                    changes += 1
                    print(f"  [3/3] line {j+2}: Added raw.pkt copy in _interp_pkt() with len field")
                else:
                    print("  [3/3] raw.pkt copy already in _interp_pkt()")
                    changes += 1
            break
    else:
        print("  [3/3] ERROR: Could not find okey_set_u16 in _interp_pkt()", file=sys.stderr)
        sys.exit(1)

    if changes >= 3:
        with open(filepath, 'w') as f:
            f.writelines(lines)
        print(f"\n  All {changes} changes applied successfully!")
    else:
        print(f"\n  ERROR: Only {changes}/3 changes applied", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
