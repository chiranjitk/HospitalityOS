#!/usr/bin/env python3
"""
StaySuite-HospitalityOS Memory Consumption Analysis Report
Generated: 2026-05-20
"""
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch, mm
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily

# ── Font Registration ──
pdfmetrics.registerFont(TTFont('TimesNewRoman', '/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf'))
pdfmetrics.registerFont(TTFont('Calibri', '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans', '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'))
registerFontFamily('TimesNewRoman', normal='TimesNewRoman', bold='TimesNewRoman')
registerFontFamily('Calibri', normal='Calibri', bold='Calibri')
registerFontFamily('DejaVuSans', normal='DejaVuSans', bold='DejaVuSans')

# ── Color Palette ──
ACCENT = colors.HexColor('#c2410c')
ACCENT_LIGHT = colors.HexColor('#fed7aa')
ACCENT_DARK = colors.HexColor('#9a3412')
TEXT_PRIMARY = colors.HexColor('#1c1917')
TEXT_MUTED = colors.HexColor('#78716c')
TEXT_DARK = colors.HexColor('#292524')
BG_SURFACE = colors.HexColor('#f5f5f4')
BG_WARM = colors.HexColor('#fffbeb')
SEM_ERROR = colors.HexColor('#dc2626')
SEM_WARNING = colors.HexColor('#d97706')
SEM_SUCCESS = colors.HexColor('#16a34a')
SEM_INFO = colors.HexColor('#2563eb')
BORDER_LIGHT = colors.HexColor('#e7e5e4')
TABLE_HEADER_COLOR = colors.HexColor('#44403c')
TABLE_HEADER_TEXT = colors.white
TABLE_ROW_EVEN = colors.white
TABLE_ROW_ODD = colors.HexColor('#fafaf9')

# ── Page Setup ──
PAGE_W, PAGE_H = A4
LEFT_M = 0.85 * inch
RIGHT_M = 0.85 * inch
TOP_M = 0.75 * inch
BOTTOM_M = 0.75 * inch
AVAIL_W = PAGE_W - LEFT_M - RIGHT_M

# ── Styles ──
title_style = ParagraphStyle(
    name='Title', fontName='TimesNewRoman', fontSize=28,
    leading=34, textColor=TEXT_PRIMARY, alignment=TA_LEFT,
    spaceAfter=4
)
subtitle_style = ParagraphStyle(
    name='Subtitle', fontName='Calibri', fontSize=13,
    leading=18, textColor=TEXT_MUTED, alignment=TA_LEFT,
    spaceAfter=6
)
h1_style = ParagraphStyle(
    name='H1', fontName='TimesNewRoman', fontSize=18,
    leading=24, textColor=ACCENT_DARK, alignment=TA_LEFT,
    spaceBefore=18, spaceAfter=8
)
h2_style = ParagraphStyle(
    name='H2', fontName='TimesNewRoman', fontSize=14,
    leading=20, textColor=TEXT_DARK, alignment=TA_LEFT,
    spaceBefore=14, spaceAfter=6
)
h3_style = ParagraphStyle(
    name='H3', fontName='TimesNewRoman', fontSize=12,
    leading=17, textColor=TEXT_DARK, alignment=TA_LEFT,
    spaceBefore=10, spaceAfter=4
)
body_style = ParagraphStyle(
    name='Body', fontName='TimesNewRoman', fontSize=10.5,
    leading=16, textColor=TEXT_PRIMARY, alignment=TA_JUSTIFY,
    spaceAfter=6
)
body_left = ParagraphStyle(
    name='BodyLeft', fontName='TimesNewRoman', fontSize=10.5,
    leading=16, textColor=TEXT_PRIMARY, alignment=TA_LEFT,
    spaceAfter=4
)
bullet_style = ParagraphStyle(
    name='Bullet', fontName='TimesNewRoman', fontSize=10.5,
    leading=16, textColor=TEXT_PRIMARY, alignment=TA_LEFT,
    leftIndent=18, spaceAfter=3, bulletIndent=6
)
code_style = ParagraphStyle(
    name='Code', fontName='DejaVuSans', fontSize=8.5,
    leading=12, textColor=TEXT_DARK, alignment=TA_LEFT,
    leftIndent=12, spaceAfter=4, backColor=colors.HexColor('#f8f8f8')
)
caption_style = ParagraphStyle(
    name='Caption', fontName='Calibri', fontSize=9,
    leading=13, textColor=TEXT_MUTED, alignment=TA_CENTER,
    spaceBefore=3, spaceAfter=8
)
meta_style = ParagraphStyle(
    name='Meta', fontName='Calibri', fontSize=10,
    leading=14, textColor=TEXT_MUTED, alignment=TA_LEFT,
    spaceAfter=2
)
callout_style = ParagraphStyle(
    name='Callout', fontName='TimesNewRoman', fontSize=10,
    leading=15, textColor=TEXT_DARK, alignment=TA_LEFT,
    leftIndent=12, rightIndent=12, spaceBefore=6, spaceAfter=6,
    backColor=colors.HexColor('#fef3c7'), borderPadding=8,
    borderWidth=0, borderColor=SEM_WARNING
)
err_style = ParagraphStyle(
    name='Error', fontName='TimesNewRoman', fontSize=10,
    leading=15, textColor=colors.HexColor('#991b1b'), alignment=TA_LEFT,
    leftIndent=12, rightIndent=12, spaceBefore=6, spaceAfter=6,
    backColor=colors.HexColor('#fef2f2'), borderPadding=8
)

# Table styles
th_style = ParagraphStyle(
    name='TH', fontName='TimesNewRoman', fontSize=9.5,
    leading=13, textColor=TABLE_HEADER_TEXT, alignment=TA_CENTER
)
td_style = ParagraphStyle(
    name='TD', fontName='TimesNewRoman', fontSize=9,
    leading=13, textColor=TEXT_PRIMARY, alignment=TA_LEFT
)
td_center = ParagraphStyle(
    name='TDCenter', fontName='TimesNewRoman', fontSize=9,
    leading=13, textColor=TEXT_PRIMARY, alignment=TA_CENTER
)
td_muted = ParagraphStyle(
    name='TDMuted', fontName='Calibri', fontSize=8.5,
    leading=12, textColor=TEXT_MUTED, alignment=TA_LEFT
)

def make_table(headers, rows, col_widths=None):
    """Create a styled table with consistent styling."""
    if col_widths is None:
        col_widths = [AVAIL_W / len(headers)] * len(headers)
    
    data = [[Paragraph(f'<b>{h}</b>', th_style) for h in headers]]
    for row in rows:
        data.append([Paragraph(str(c), td_style) for c in row])
    
    t = Table(data, colWidths=col_widths, hAlign='CENTER')
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_COLOR),
        ('TEXTCOLOR', (0, 0), (-1, 0), TABLE_HEADER_TEXT),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_LIGHT),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]
    for i in range(1, len(data)):
        bg = TABLE_ROW_ODD if i % 2 == 0 else TABLE_ROW_EVEN
        style_cmds.append(('BACKGROUND', (0, i), (-1, i), bg))
    t.setStyle(TableStyle(style_cmds))
    return t

def section_divider():
    return HRFlowable(width="100%", thickness=0.5, color=BORDER_LIGHT, spaceAfter=10, spaceBefore=4)

def build_report():
    doc = SimpleDocTemplate(
        "/home/z/my-project/docs/StaySuite-Memory-Analysis.pdf",
        pagesize=A4,
        leftMargin=LEFT_M, rightMargin=RIGHT_M,
        topMargin=TOP_M, bottomMargin=BOTTOM_M,
        title="StaySuite-HospitalityOS Memory Analysis",
        author="Z.ai Technical Audit",
        subject="Memory consumption analysis and optimization roadmap"
    )
    
    story = []
    
    # ══════════════════════════════════════════
    # COVER SECTION
    # ══════════════════════════════════════════
    story.append(Spacer(1, 100))
    story.append(Paragraph("Memory Analysis Report", title_style))
    story.append(Spacer(1, 6))
    story.append(HRFlowable(width="30%", thickness=3, color=ACCENT, spaceAfter=12, spaceBefore=0, hAlign='LEFT'))
    story.append(Paragraph("StaySuite-HospitalityOS", subtitle_style))
    story.append(Spacer(1, 4))
    story.append(Paragraph("Comprehensive memory consumption audit, root cause analysis,<br/>and prioritized optimization roadmap", meta_style))
    story.append(Spacer(1, 30))
    
    meta_data = [
        [Paragraph('<b>Project</b>', td_style), Paragraph('StaySuite-HospitalityOS', td_style)],
        [Paragraph('<b>Stack</b>', td_style), Paragraph('Next.js 16.2.4 + Turbopack + React 19 + Prisma 6 + PostgreSQL', td_style)],
        [Paragraph('<b>Server</b>', td_style), Paragraph('4 vCPU / 8 GB RAM / Ubuntu Linux / Node.js 24.15.0', td_style)],
        [Paragraph('<b>Source Files</b>', td_style), Paragraph('1,870 TypeScript files (918 API routes, 187 pages)', td_style)],
        [Paragraph('<b>Dependencies</b>', td_style), Paragraph('107 packages (1.5 GB node_modules)', td_style)],
        [Paragraph('<b>Dev Build Cache</b>', td_style), Paragraph('2.6 GB (.next/dev/) with 2,599 JS chunks', td_style)],
        [Paragraph('<b>Date</b>', td_style), Paragraph('May 20, 2026', td_style)],
    ]
    meta_table = Table(meta_data, colWidths=[120, AVAIL_W - 120], hAlign='LEFT')
    meta_table.setStyle(TableStyle([
        ('GRID', (0, 0), (-1, -1), 0.3, BORDER_LIGHT),
        ('BACKGROUND', (0, 0), (0, -1), BG_SURFACE),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(meta_table)
    story.append(PageBreak())
    
    # ══════════════════════════════════════════
    # EXECUTIVE SUMMARY
    # ══════════════════════════════════════════
    story.append(Paragraph("<b>1. Executive Summary</b>", h1_style))
    story.append(section_divider())
    
    story.append(Paragraph(
        "The StaySuite-HospitalityOS application is running on an 8 GB RAM server with 4 vCPUs. "
        "The system has experienced repeated Out-Of-Memory (OOM) kills by the Linux kernel, causing the "
        "Next.js dev server to crash. At the time of analysis, the system had only 508 MB free memory "
        "and 767 MB in buffer/cache, with 6.9 GB actively used.",
        body_style
    ))
    story.append(Spacer(1, 4))
    
    story.append(Paragraph(
        "<b>OOM Kill Evidence (dmesg):</b> Kernel killed next-server "
        "process (PID 22587) with total-vm: 31,402 MB, anon-rss: 7,026 MB. A second kill "
        "(PID 31369) showed total-vm: 31,168 MB, anon-rss: 6,546 MB. "
        "The Turbopack dependency tracer consumed 4-5 GB during module analysis before being killed.",
        err_style
    ))
    story.append(Spacer(1, 4))
    
    story.append(Paragraph(
        "<b>Key Finding:</b> The primary OOM root cause is Turbopack static analysis of the scheduler "
        "dependency chain in instrumentation.ts. This single import "
        "chain pulls in crypto, net, child_process, twilio, node-cron, and the entire WiFi adapter tree, "
        "consuming 4-5 GB of memory during compilation. This has been partially mitigated by moving the "
        "scheduler to a separate PM2 process, but the 2.6 GB Turbopack dev cache and 1.5 GB node_modules "
        "continue to strain the 8 GB server.",
        callout_style
    ))
    
    # ══════════════════════════════════════════
    # SYSTEM OVERVIEW
    # ══════════════════════════════════════════
    story.append(Spacer(1, 12))
    story.append(Paragraph("<b>2. System Resource Overview</b>", h1_style))
    story.append(section_divider())
    
    story.append(Paragraph("<b>2.1 Current Memory State</b>", h2_style))
    
    sys_rows = [
        ["Total RAM", "8,082 MB", "Hard limit of the VM/container"],
        ["Used", "6,900 MB (85%)", "Critically high - near OOM threshold"],
        ["Free", "508 MB (6%)", "Insufficient for compilation spikes"],
        ["Buffer/Cache", "767 MB (10%)", "Can be reclaimed under pressure"],
        ["Swap", "0 MB", "No swap configured - no safety net"],
        ["Next.js Process", "77.7 MB", "Currently running (post-OOM restart)"],
        ["Scheduler Process", "44.9 MB", "Running separately via PM2"],
        ["PM2 Restarts", "9 restarts", "Indicates repeated OOM recovery"],
        ["Max Memory Limit", "3 GB", "PM2 max_memory_restart threshold"],
    ]
    story.append(Spacer(1, 6))
    story.append(make_table(
        ["Metric", "Value", "Notes"],
        sys_rows,
        [AVAIL_W * 0.25, AVAIL_W * 0.25, AVAIL_W * 0.50]
    ))
    story.append(Paragraph("Table 1: System memory state at time of analysis", caption_style))
    
    story.append(Paragraph("<b>2.2 Disk Usage Breakdown</b>", h2_style))
    
    disk_rows = [
        ["node_modules/", "1.5 GB", "107 packages including heavy deps (twilio, pg, ldapjs)"],
        [".next/dev/", "2.6 GB", "Turbopack dev cache - 2,599 compiled JS chunks (96 MB total)"],
        [".next/dev/static/chunks/", "283 MB", "Client-side compiled bundles"],
        [".next/dev/server/", "404 MB", "Server-side compiled chunks"],
        ["src/", "42 MB", "1,870 TypeScript source files"],
        ["public/images/", "2.3 MB", "Login slides and logo images"],
    ]
    story.append(Spacer(1, 6))
    story.append(make_table(
        ["Directory", "Size", "Description"],
        disk_rows,
        [AVAIL_W * 0.28, AVAIL_W * 0.12, AVAIL_W * 0.60]
    ))
    story.append(Paragraph("Table 2: Project disk usage breakdown", caption_style))
    
    # ══════════════════════════════════════════
    # ROOT CAUSE ANALYSIS
    # ══════════════════════════════════════════
    story.append(Spacer(1, 12))
    story.append(Paragraph("<b>3. Root Cause Analysis</b>", h1_style))
    story.append(section_divider())
    
    story.append(Paragraph("<b>3.1 Primary Cause: Turbopack Tracing Scheduler Dependencies</b>", h2_style))
    story.append(Paragraph(
        "The root cause of the OOM kills was identified in a previous session. The "
        "<font face='DejaVuSans' size=9>instrumentation.ts</font> file (which Next.js loads at server "
        "startup) previously imported the scheduler, which transitively pulled in the entire WiFi adapter "
        "tree, crypto, net, child_process, twilio, node-cron, and other heavy native modules. "
        "Turbopack statically analyzes ALL imports, even dynamic ones inside setTimeout blocks, and "
        "traces the full dependency graph. This consumed 4-5 GB of memory during compilation.",
        body_style
    ))
    story.append(Spacer(1, 4))
    
    story.append(Paragraph("<b>Dependency Chain (pre-fix):</b>", h3_style))
    story.append(Paragraph(
        "<font face='DejaVuSans' size=8.5>"
        "instrumentation.ts<br/>"
        "&nbsp;&nbsp;+-- scheduler.ts (node-cron, encryption)<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;+-- crypto (native binding, 3-5 MB)<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;+-- wifi/adapters/index.ts (15 vendor adapters)<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;+-- net (native binding, lazy but TRACED)<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;+-- session-engine.ts<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;+-- child_process (native binding)<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;+-- nftables-counters.ts<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;+-- child_process (native binding)<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;+-- nas-health-check.ts<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;+-- child_process + net + dgram (3 native bindings)<br/>"
        "&nbsp;&nbsp;+-- db.ts<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;+-- PrismaClient (20-40 MB per instance)<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;+-- pg connection pool<br/>"
        "&nbsp;&nbsp;+-- auth.ts<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;+-- next-auth (10-20 MB)<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;+-- bcryptjs (2 MB with WASM)"
        "</font>",
        code_style
    ))
    story.append(Spacer(1, 4))
    
    story.append(Paragraph("<b>3.2 Current Mitigation: PM2 Dual-Process Architecture</b>", h2_style))
    story.append(Paragraph(
        "The scheduler has been removed from instrumentation.ts and now runs as a separate "
        "PM2-managed process. This prevents Turbopack from tracing the scheduler dependency chain. "
        "The current architecture consists of two processes:",
        body_style
    ))
    
    pm2_rows = [
        ["staysuite-nextjs", "npx next dev --turbopack", "3 GB", "Port 3000", "9 restarts"],
        ["staysuite-scheduler", "npx tsx scripts/scheduler-runner.ts", "1.5 GB", "N/A", "0 restarts"],
    ]
    story.append(Spacer(1, 6))
    story.append(make_table(
        ["Process", "Command", "Max Memory", "Port", "Restarts"],
        pm2_rows,
        [AVAIL_W * 0.18, AVAIL_W * 0.32, AVAIL_W * 0.12, AVAIL_W * 0.12, AVAIL_W * 0.12]
    ))
    story.append(Paragraph("Table 3: PM2 process configuration", caption_style))
    
    # ══════════════════════════════════════════
    # ONGOING MEMORY ISSUES
    # ══════════════════════════════════════════
    story.append(Spacer(1, 12))
    story.append(Paragraph("<b>4. Ongoing Memory Pressure Points</b>", h1_style))
    story.append(section_divider())
    
    story.append(Paragraph("<b>4.1 Oversized Compiled Chunks (20 files over 1 MB)</b>", h2_style))
    story.append(Paragraph(
        "The Turbopack dev compiler generates 2,599 JavaScript chunks totaling 96 MB. "
        "Of these, 20 individual files exceed 1 MB each. The largest chunks contain dashboard widgets, "
        "WiFi portal pages, and heavy dependencies like hls.js (video streaming) and recharts.",
        body_style
    ))
    
    chunk_rows = [
        ["dashboard widgets (client)", "2.5 MB", "framer-motion + recharts + state"],
        ["dashboard widgets (server SSR)", "2.4 MB", "Duplicated server rendering bundle"],
        ["WiFi portal page (client)", "1.5 MB", "Complex form + WiFi config UI"],
        ["hls.js (client)", "1.5 MB", "Video streaming library - loaded on WiFi page"],
        ["WiFi reports page (client)", "1.2 MB", "recharts + xlsx parser"],
        ["Prisma WASM (edge)", "1.4 MB", "Edge runtime Prisma client"],
        ["twilio rest (edge)", "1.3 MB", "Twilio SDK in edge chunks (should be external)"],
        ["twilio account (edge)", "1.2 MB", "Twilio SDK sub-module in edge"],
        ["root-of-server (server)", "1.2 MB", "Core Next.js server bundle"],
        ["react-dom (client)", "1.1 MB", "React DOM runtime"],
        ["Next.js router (client)", "1.1 MB", "Client-side router"],
    ]
    story.append(Spacer(1, 6))
    story.append(make_table(
        ["Chunk", "Size", "Contents"],
        chunk_rows,
        [AVAIL_W * 0.32, AVAIL_W * 0.10, AVAIL_W * 0.58]
    ))
    story.append(Paragraph("Table 4: Largest compiled chunks (>1 MB each)", caption_style))
    
    story.append(Paragraph("<b>4.2 Client-Side Bundle Bloat</b>", h2_style))
    story.append(Paragraph(
        "The client bundle includes several heavy libraries that are loaded eagerly, "
        "significantly increasing browser memory usage and initial page load time:",
        body_style
    ))
    
    bundle_rows = [
        ["framer-motion", "95 files", "~150 KB gzipped", "Used for simple fade transitions; full library loaded"],
        ["recharts", "35 files", "~500 KB gzipped", "Heavy charting library; imported in dashboard, reports, revenue"],
        ["lucide-react", "554 imports (198 unique icons)", "Variable (tree-shaken)", "Massive import graph; 198 unique icons across codebase"],
        ["socket.io-client", "8 files", "~80 KB gzipped", "Two duplicate hooks (useSocket + useRealtime)"],
        ["hls.js", "1 file", "~1.5 MB", "Video player - loaded on WiFi portal page"],
        ["jspdf + autotable", "2 files", "~300 KB", "PDF generation - server-side only (OK)"],
    ]
    story.append(Spacer(1, 6))
    story.append(make_table(
        ["Library", "Import Count", "Estimated Size", "Issue"],
        bundle_rows,
        [AVAIL_W * 0.18, AVAIL_W * 0.18, AVAIL_W * 0.16, AVAIL_W * 0.48]
    ))
    story.append(Paragraph("Table 5: Client-side bundle analysis", caption_style))
    
    story.append(Paragraph("<b>4.3 Duplicate WebSocket Connections</b>", h2_style))
    story.append(Paragraph(
        "Two separate hooks, <font face='DejaVuSans' size=9>useRealtime</font> (653 lines) and "
        "<font face='DejaVuSans' size=9>useSocket</font> (382 lines), both create independent "
        "socket.io-client connections. If both are mounted simultaneously, that results in 2 parallel "
        "WebSocket connections per browser tab. The useRealtime hook auto-connects on every authenticated "
        "page and attempts 10 reconnection attempts with toast notifications on each failure.",
        body_style
    ))
    
    story.append(Paragraph("<b>4.4 Context Initialization Storm</b>", h2_style))
    story.append(Paragraph(
        "On application mount, 4 React contexts fire independent API calls simultaneously: "
        "AuthContext (session check), FeatureFlagsContext, CurrencyContext, and TimezoneContext. "
        "Additionally, CurrencyContext and TaxContext both independently fetch from the same "
        "<font face='DejaVuSans' size=9>/api/settings/tax-currency</font> endpoint, creating duplicate requests.",
        body_style
    ))
    
    ctx_rows = [
        ["AuthContext", "GET /api/auth/session", "User object + permissions", "Yes (session + retry)"],
        ["FeatureFlagsContext", "GET /api/settings/feature-flags", "enabledFeatures[] + plan", "Yes"],
        ["CurrencyContext", "GET /api/settings/tax-currency", "CurrencySettings", "Yes"],
        ["TimezoneContext", "GET /api/settings/general", "TimezoneSettings", "Yes"],
        ["TaxContext", "GET /api/settings/tax-currency", "Tax[] + TaxGroup[]", "Yes (DUPLICATE)"],
    ]
    story.append(Spacer(1, 6))
    story.append(make_table(
        ["Context", "Endpoint", "State Cached", "Fetches on Mount"],
        ctx_rows,
        [AVAIL_W * 0.20, AVAIL_W * 0.30, AVAIL_W * 0.22, AVAIL_W * 0.28]
    ))
    story.append(Paragraph("Table 6: Context initialization API calls", caption_style))
    
    story.append(Paragraph("<b>4.5 Aggressive Polling Intervals</b>", h2_style))
    story.append(Paragraph(
        "Multiple hooks run continuous polling intervals that consume memory and network bandwidth:",
        body_style
    ))
    
    poll_rows = [
        ["useDashboardData", "45 seconds", "GET /api/dashboard", "Ref-counted, deduped - well designed"],
        ["useLicenseCheck", "30 seconds", "GET /api/license/check", "Per-component instance, visibility API"],
        ["useRealtime", "Continuous", "WebSocket (socket.io)", "Auto-reconnect, 10 retries with toasts"],
    ]
    story.append(Spacer(1, 6))
    story.append(make_table(
        ["Hook", "Interval", "Method", "Notes"],
        poll_rows,
        [AVAIL_W * 0.22, AVAIL_W * 0.15, AVAIL_W * 0.25, AVAIL_W * 0.38]
    ))
    story.append(Paragraph("Table 7: Active polling intervals", caption_style))
    
    story.append(Paragraph("<b>4.6 NodePolyfillPlugin on Client Bundle</b>", h2_style))
    story.append(Paragraph(
        "The <font face='DejaVuSans' size=9>next.config.ts</font> adds "
        "<font face='DejaVuSans' size=9>NodePolyfillPlugin()</font> to the webpack client configuration, "
        "which injects polyfills for buffer, process, stream, and other Node.js built-ins into the "
        "client bundle. This adds approximately 200+ KB to every client-side page load for polyfills "
        "that are mostly unnecessary. The config also marks all Node.js built-ins (crypto, fs, net, etc.) "
        "as <font face='DejaVuSans' size=9>false</font> for the client, but the polyfill plugin "
        "contradicts this by providing them anyway.",
        body_style
    ))
    
    story.append(Paragraph("<b>4.7 Dead Configuration in next.config.ts</b>", h2_style))
    story.append(Paragraph(
        "Several entries in <font face='DejaVuSans' size=9>serverExternalPackages</font> are unused. "
        "The packages pg, pg-native, and twilio are listed but never imported anywhere in the source code. "
        "Additionally, <font face='DejaVuSans' size=9>ignoreBuildErrors: true</font> disables TypeScript "
        "checking to avoid OOM during build (the project has 1,870 files; tsc requires >2 GB). "
        "<font face='DejaVuSans' size=9>reactStrictMode: false</font> disables React strict mode, "
        "which would normally help detect memory leaks from double renders.",
        body_style
    ))
    
    story.append(Paragraph("<b>4.8 Unbounded Tenant PrismaClient Cache</b>", h2_style))
    story.append(Paragraph(
        "The <font face='DejaVuSans' size=9>db-tenant.ts</font> creates a new PrismaClient instance "
        "per tenant and caches it in a Map. There is no LRU eviction or TTL - tenants accumulate "
        "connection pools indefinitely. Each PrismaClient instance consumes 20-40 MB. With many tenants, "
        "this becomes a significant memory leak risk.",
        body_style
    ))
    
    # ══════════════════════════════════════════
    # PRIORITY SOLUTIONS
    # ══════════════════════════════════════════
    story.append(Spacer(1, 12))
    story.append(Paragraph("<b>5. Prioritized Solutions</b>", h1_style))
    story.append(section_divider())
    
    story.append(Paragraph("<b>5.1 Critical (Immediate Impact)</b>", h2_style))
    
    crit_rows = [
        ["P1", "Consolidate useSocket + useRealtime", "Eliminate duplicate WebSocket; single hook, single connection", "Reduces per-tab memory by ~80 KB and prevents connection spam"],
        ["P2", "Remove NodePolyfillPlugin from client", "Delete NodePolyfillPlugin() from webpack config", "Saves ~200 KB from every client page load"],
        ["P3", "Replace framer-motion with CSS transitions", "Use CSS transitions/animations on page.tsx shell", "Eliminates ~150 KB from initial bundle"],
        ["P4", "Lazy-load recharts components", "Use next/dynamic for chart components", "Defers ~500 KB until dashboard/reports pages load"],
    ]
    story.append(Spacer(1, 6))
    story.append(make_table(
        ["ID", "Action", "Details", "Impact"],
        crit_rows,
        [AVAIL_W * 0.05, AVAIL_W * 0.25, AVAIL_W * 0.40, AVAIL_W * 0.30]
    ))
    story.append(Paragraph("Table 8: Critical priority solutions", caption_style))
    
    story.append(Paragraph("<b>5.2 High Priority (Significant Impact)</b>", h2_style))
    
    high_rows = [
        ["P5", "Merge 4 context fetches into 1 API call", "Create /api/settings/bundle endpoint", "Reduces 4 concurrent requests to 1; faster mount"],
        ["P6", "Add LRU eviction to tenant PrismaClient cache", "Max 20 tenants, TTL 1 hour", "Prevents unbounded memory growth from tenant connections"],
        ["P7", "Remove dead serverExternalPackages", "Remove pg, pg-native, twilio from config", "Cleaner config; no runtime impact but reduces confusion"],
        ["P8", "Lazy-import bcryptjs in auth.ts", "Use await import('bcryptjs') in verify function", "Defers 2 MB WASM bundle until first password check"],
        ["P9", "Enable reactStrictMode", "Set reactStrictMode: true in config", "Helps detect memory leaks from effect cleanup issues"],
    ]
    story.append(Spacer(1, 6))
    story.append(make_table(
        ["ID", "Action", "Details", "Impact"],
        high_rows,
        [AVAIL_W * 0.05, AVAIL_W * 0.25, AVAIL_W * 0.40, AVAIL_W * 0.30]
    ))
    story.append(Paragraph("Table 9: High priority solutions", caption_style))
    
    story.append(Paragraph("<b>5.3 Medium Priority (Optimization)</b>", h2_style))
    
    med_rows = [
        ["P10", "Add swap space to the server", "Create 2 GB swap file", "Provides OOM safety net; prevents hard kills"],
        ["P11", "Clean Turbopack cache periodically", "Add cron job to clear .next/dev/ on idle", "Prevents 2.6 GB cache from consuming all disk"],
        ["P12", "Audit and remove unused packages", "Remove ldapjs, pg (if unused) from package.json", "Reduces node_modules from 1.5 GB"],
        ["P13", "Consolidate lucide-react icon imports", "Create centralized icon registry", "Reduces 554 import points to cleaner pattern"],
        ["P14", "Lazy-load hls.js on WiFi portal only", "Dynamic import when WiFi portal mounts", "Defers 1.5 MB until WiFi page is visited"],
    ]
    story.append(Spacer(1, 6))
    story.append(make_table(
        ["ID", "Action", "Details", "Impact"],
        med_rows,
        [AVAIL_W * 0.05, AVAIL_W * 0.25, AVAIL_W * 0.40, AVAIL_W * 0.30]
    ))
    story.append(Paragraph("Table 10: Medium priority solutions", caption_style))
    
    # ══════════════════════════════════════════
    # MEMORY BUDGET
    # ══════════════════════════════════════════
    story.append(Spacer(1, 12))
    story.append(Paragraph("<b>6. Memory Budget Projection</b>", h1_style))
    story.append(section_divider())
    
    story.append(Paragraph(
        "The following table estimates the memory usage before and after implementing the critical "
        "and high-priority solutions. The projection assumes typical dev-mode operation with "
        "Turbopack and multiple page compilations.",
        body_style
    ))
    
    budget_rows = [
        ["Next.js dev server (Turbopack)", "1,500 MB", "1,200 MB", "Smaller chunks from lazy loading"],
        ["Turbopack compilation spikes", "2,000 MB peak", "1,200 MB peak", "Fewer traced dependencies"],
        ["Scheduler process", "50 MB", "50 MB", "No change (already isolated)"],
        ["Prisma connection pools", "80 MB", "50 MB", "LRU eviction on tenant clients"],
        ["OS + Node.js runtime", "300 MB", "300 MB", "Fixed baseline"],
        ["Buffer/cache", "767 MB", "500 MB", "Less file caching needed"],
        ["Turbopack dev cache (.next)", "2,600 MB (disk)", "1,500 MB (disk)", "Periodic cleanup"],
        ["Total used (peak)", "~6,900 MB", "~4,800 MB", "30% reduction"],
        ["Free memory", "508 MB", "~2,600 MB", "5x improvement"],
    ]
    story.append(Spacer(1, 6))
    story.append(make_table(
        ["Component", "Current", "After Optimization", "Notes"],
        budget_rows,
        [AVAIL_W * 0.26, AVAIL_W * 0.16, AVAIL_W * 0.18, AVAIL_W * 0.40]
    ))
    story.append(Paragraph("Table 11: Memory budget before and after optimization", caption_style))
    
    # ══════════════════════════════════════════
    # RECOMMENDATIONS
    # ══════════════════════════════════════════
    story.append(Spacer(1, 12))
    story.append(Paragraph("<b>7. Recommendations Summary</b>", h1_style))
    story.append(section_divider())
    
    story.append(Paragraph(
        "The StaySuite-HospitalityOS project is a large-scale application with 1,870 source files, "
        "918 API routes, and 107 dependencies running on a constrained 8 GB server. The primary OOM "
        "issue has been mitigated by isolating the scheduler, but the system remains under significant "
        "memory pressure from Turbopack's compilation cache, oversized client bundles, and duplicate "
        "real-time connections.",
        body_style
    ))
    story.append(Spacer(1, 6))
    
    story.append(Paragraph("<b>Immediate Actions (This Week):</b>", h3_style))
    for item in [
        "Add 2 GB swap space to the server as an OOM safety net",
        "Consolidate useSocket and useRealtime into a single WebSocket hook",
        "Remove NodePolyfillPlugin from client webpack config",
        "Replace framer-motion animations on page.tsx with CSS transitions",
    ]:
        story.append(Paragraph(f"<bullet>&bull;</bullet> {item}", bullet_style))
    
    story.append(Paragraph("<b>Short-Term (Next Sprint):</b>", h3_style))
    for item in [
        "Lazy-load recharts components with next/dynamic",
        "Merge 4 context initialization fetches into /api/settings/bundle",
        "Add LRU eviction to db-tenant.ts PrismaClient cache",
        "Lazy-import bcryptjs in auth.ts",
    ]:
        story.append(Paragraph(f"<bullet>&bull;</bullet> {item}", bullet_style))
    
    story.append(Paragraph("<b>Long-Term (Next Quarter):</b>", h3_style))
    for item in [
        "Audit and remove unused packages (ldapjs, pg, xlsx if unused)",
        "Enable reactStrictMode and fix any detected memory leaks",
        "Set up periodic Turbopack cache cleanup",
        "Consider upgrading to a 16 GB server for production workloads",
        "Implement bundle analysis in CI/CD to catch future bloat",
    ]:
        story.append(Paragraph(f"<bullet>&bull;</bullet> {item}", bullet_style))
    
    story.append(Spacer(1, 20))
    story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER_LIGHT, spaceAfter=6, spaceBefore=6))
    story.append(Paragraph(
        "End of report. Generated by Z.ai Technical Audit on May 20, 2026.",
        meta_style
    ))
    
    doc.build(story)
    print("Report generated: /home/z/my-project/docs/StaySuite-Memory-Analysis.pdf")

if __name__ == '__main__':
    build_report()
