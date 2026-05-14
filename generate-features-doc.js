const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  TableOfContents, PageBreak, AlignmentType, HeadingLevel, BorderStyle,
  WidthType, ShadingType, TableLayoutType, SectionType, NumberFormat,
  PageNumber, Footer, Header,
} = require("docx");

// ────────────────────────────────────────────────────────
// PALETTE: DM-1 Deep Cyan (tech/SaaS product)
// ────────────────────────────────────────────────────────
const palette = {
  bg: "162235",
  primary: "FFFFFF",
  accent: "37DCF2",
  cover: {
    titleColor: "FFFFFF",
    subtitleColor: "B0B8C0",
    metaColor: "90989F",
    footerColor: "687078",
  },
  table: {
    headerBg: "1B6B7A",
    headerText: "FFFFFF",
    accentLine: "1B6B7A",
    innerLine: "C8DDE2",
    surface: "EDF3F5",
  },
};

const P = palette.cover;
const T = palette.table;

// ────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────
const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };

const FONT = { ascii: "Calibri", eastAsia: "Calibri" };
const BODY_SIZE = 24;
const H1_SIZE = 36;
const H2_SIZE = 30;
const LINE_SPACING = 312;

// Color constants for body text
const BODY_COLOR = "1C2A3D";
const PRIMARY_DARK = "0D1B2A";
const ACCENT_TEAL = "1B6B7A";
const SECONDARY_GRAY = "5B6B7D";
const MUTED = "7A8A9A";

// Table cell helper
function makeCell(text, opts = {}) {
  const { bold = false, bg, textColor, width, alignment = AlignmentType.LEFT, fontSize = 20 } = opts;
  const cellOpts = {
    children: [
      new Paragraph({
        alignment,
        spacing: { before: 40, after: 40 },
        children: [
          new TextRun({
            text,
            bold,
            size: fontSize,
            color: textColor || (bg === T.headerBg ? T.headerText : BODY_COLOR),
            font: FONT,
          }),
        ],
      }),
    ],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: T.innerLine },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: T.innerLine },
      left: { style: BorderStyle.SINGLE, size: 1, color: T.innerLine },
      right: { style: BorderStyle.SINGLE, size: 1, color: T.innerLine },
    },
    margins: { top: 60, bottom: 60, left: 120, right: 120 },
  };
  if (bg) cellOpts.shading = { type: ShadingType.CLEAR, fill: bg };
  if (width) cellOpts.width = { size: width, type: WidthType.PERCENTAGE };
  return new TableCell(cellOpts);
}

function makeInfoTable(section) {
  const categoryLabel = section.category === "base" ? "Base Module" : "Add-on Module";
  const numItems = section.items.length;
  const numApis = section.items.reduce((sum, item) => sum + item.apis.length, 0);
  const numFeatures = section.items.reduce((sum, item) => sum + item.features.length, 0);

  const rows = [
    new TableRow({
      children: [
        makeCell("Category", { bold: true, bg: T.headerBg, width: 25 }),
        makeCell(categoryLabel, { width: 75 }),
      ],
    }),
    new TableRow({
      children: [
        makeCell("Menu Items", { bold: true, bg: T.surface, width: 25 }),
        makeCell(`${numItems}`, { width: 75 }),
      ],
    }),
    new TableRow({
      children: [
        makeCell("Total Features", { bold: true, bg: T.surface, width: 25 }),
        makeCell(`${numFeatures}`, { width: 75 }),
      ],
    }),
    new TableRow({
      children: [
        makeCell("API Endpoints", { bold: true, bg: T.surface, width: 25 }),
        makeCell(`${numApis}`, { width: 75 }),
      ],
    }),
  ];

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows,
  });
}

function makeBulletList(items, indent = 720) {
  return items.map(
    (item) =>
      new Paragraph({
        indent: { left: indent, hanging: 260 },
        spacing: { before: 40, after: 40, line: LINE_SPACING },
        children: [
          new TextRun({ text: "\u2022 ", size: BODY_SIZE, color: ACCENT_TEAL, font: FONT }),
          new TextRun({ text: item, size: BODY_SIZE, color: BODY_COLOR, font: FONT }),
        ],
      })
  );
}

function makeSectionBody(section) {
  const children = [];

  // H1 heading
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 360, after: 200, line: LINE_SPACING },
      children: [
        new TextRun({
          text: section.title,
          bold: true,
          size: H1_SIZE,
          color: PRIMARY_DARK,
          font: FONT,
        }),
      ],
    })
  );

  // Section description
  children.push(
    new Paragraph({
      spacing: { before: 80, after: 200, line: LINE_SPACING },
      indent: { firstLine: 480 },
      children: [
        new TextRun({
          text: section.description,
          size: BODY_SIZE,
          color: BODY_COLOR,
          font: FONT,
        }),
      ],
    })
  );

  // Info table
  children.push(makeInfoTable(section));

  // Spacer
  children.push(new Paragraph({ spacing: { before: 200, after: 100 } }));

  // Items
  for (const item of section.items) {
    // H2 heading
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 120, line: LINE_SPACING },
        children: [
          new TextRun({
            text: item.title,
            bold: true,
            size: H2_SIZE,
            color: ACCENT_TEAL,
            font: FONT,
          }),
        ],
      })
    );

    // Description paragraph
    children.push(
      new Paragraph({
        spacing: { before: 60, after: 120, line: LINE_SPACING },
        indent: { firstLine: 480 },
        children: [
          new TextRun({
            text: item.description,
            size: BODY_SIZE,
            color: BODY_COLOR,
            font: FONT,
          }),
        ],
      })
    );

    // Tabs (if any)
    if (item.tabs && item.tabs.length > 0) {
      children.push(
        new Paragraph({
          spacing: { before: 80, after: 60, line: LINE_SPACING },
          children: [
            new TextRun({ text: "Tabs: ", bold: true, size: BODY_SIZE, color: PRIMARY_DARK, font: FONT }),
          ],
        })
      );
      children.push(...makeBulletList(item.tabs, 720));
    }

    // Key Features
    children.push(
      new Paragraph({
        spacing: { before: 120, after: 60, line: LINE_SPACING },
        children: [
          new TextRun({ text: "Key Features: ", bold: true, size: BODY_SIZE, color: PRIMARY_DARK, font: FONT }),
        ],
      })
    );
    children.push(...makeBulletList(item.features, 720));

    // API Routes (if any)
    if (item.apis && item.apis.length > 0) {
      children.push(
        new Paragraph({
          spacing: { before: 120, after: 60, line: LINE_SPACING },
          children: [
            new TextRun({ text: "API Routes: ", bold: true, size: BODY_SIZE, color: PRIMARY_DARK, font: FONT }),
          ],
        })
      );
      children.push(...makeBulletList(item.apis, 720));
    }
  }

  return children;
}

// ────────────────────────────────────────────────────────
// COVER TITLE LAYOUT CALCULATION (R1 recipe)
// ────────────────────────────────────────────────────────
function calcTitleLayout(title, maxWidthTwips, preferredPt = 40, minPt = 24) {
  const charWidth = (pt) => pt * 12; // English chars are narrower
  const charsPerLine = (pt) => Math.floor(maxWidthTwips / charWidth(pt));

  let titlePt = preferredPt;
  let lines;
  while (titlePt >= minPt) {
    const cpl = charsPerLine(titlePt);
    if (cpl < 2) { titlePt -= 2; continue; }
    lines = splitTitleLines(title, cpl);
    if (lines.length <= 3) break;
    titlePt -= 2;
  }
  if (!lines || lines.length > 3) {
    const cpl = charsPerLine(minPt);
    lines = splitTitleLines(title, cpl);
    titlePt = minPt;
  }
  return { titlePt, titleLines: lines };
}

function splitTitleLines(title, charsPerLine) {
  if (title.length <= charsPerLine) return [title];
  const breakAfter = new Set([...' \t', ...'-_—–·/']);
  const lines = [];
  let remaining = title;
  while (remaining.length > charsPerLine) {
    let breakAt = -1;
    for (let i = charsPerLine; i >= Math.floor(charsPerLine * 0.6); i--) {
      if (i < remaining.length && breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
    }
    if (breakAt === -1) {
      const limit = Math.min(remaining.length, Math.ceil(charsPerLine * 1.3));
      for (let i = charsPerLine + 1; i < limit; i++) {
        if (breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
      }
    }
    if (breakAt === -1) breakAt = charsPerLine;
    lines.push(remaining.slice(0, breakAt).trim());
    remaining = remaining.slice(breakAt).trim();
  }
  if (remaining) lines.push(remaining);
  if (lines.length > 1 && lines[lines.length - 1].length <= 2) {
    const last = lines.pop();
    lines[lines.length - 1] += last;
  }
  return lines;
}

function calcCoverSpacing(params) {
  const {
    titleLineCount = 1, titlePt = 36, hasSubtitle = false,
    hasEnglishLabel = false, metaLineCount = 0,
    fixedHeight = 800, pageHeight = 16838,
    marginTop = 0, marginBottom = 0,
  } = params;
  const SAFETY = 1200;
  const usableHeight = pageHeight - marginTop - marginBottom - SAFETY;
  const titleHeight = titleLineCount * (titlePt * 23 + 200);
  const subtitleHeight = hasSubtitle ? (12 * 23 + 600) : 0;
  const englishLabelHeight = hasEnglishLabel ? (9 * 23 + 600) : 0;
  const metaHeight = metaLineCount * (10 * 23 + 100);
  const implicitParaHeight = 3 * 300;
  const contentHeight = titleHeight + subtitleHeight + englishLabelHeight + metaHeight + fixedHeight + implicitParaHeight;
  const remainingSpace = usableHeight - contentHeight;
  const safeRemaining = Math.max(remainingSpace, 400);
  const FOOTER_MIN = 800;
  const rawTop = Math.floor(safeRemaining * 0.45);
  const rawBottom = Math.floor(safeRemaining * 0.45);
  const bottomSpacing = Math.max(rawBottom, FOOTER_MIN);
  const topSpacing = Math.max(rawTop - Math.max(0, FOOTER_MIN - rawBottom), 400);
  const midSpacing = Math.max(safeRemaining - topSpacing - bottomSpacing, 0);
  return { topSpacing, midSpacing, bottomSpacing };
}

// ────────────────────────────────────────────────────────
// R1 COVER BUILDER
// ────────────────────────────────────────────────────────
function buildCoverR1(config) {
  const PC = config.palette;
  const padL = 1200;
  const padR = 800;
  const availableWidth = 11906 - padL - padR - 300;
  const { titlePt, titleLines } = calcTitleLayout(config.title, availableWidth, 40, 24);
  const titleSize = titlePt * 2;

  const spacing = calcCoverSpacing({
    titleLineCount: titleLines.length,
    titlePt,
    hasSubtitle: !!config.subtitle,
    hasEnglishLabel: !!config.englishLabel,
    metaLineCount: (config.metaLines || []).length,
    fixedHeight: 400,
  });

  const accentLeft = { style: BorderStyle.SINGLE, size: 8, color: PC.accent, space: 12 };
  const children = [];

  // 1. Top whitespace
  children.push(new Paragraph({ spacing: { before: spacing.topSpacing } }));

  // 2. English label with accent bottom border
  if (config.englishLabel) {
    children.push(
      new Paragraph({
        indent: { left: padL, right: padR },
        spacing: { after: 500 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: PC.accent, space: 8 } },
        children: [
          new TextRun({
            text: config.englishLabel.split("").join("  "),
            size: 18,
            color: PC.accent,
            font: { ascii: "Calibri" },
            characterSpacing: 40,
          }),
        ],
      })
    );
  }

  // 3. Main title
  for (let i = 0; i < titleLines.length; i++) {
    children.push(
      new Paragraph({
        indent: { left: padL },
        spacing: { after: i < titleLines.length - 1 ? 100 : 300, line: Math.ceil(titlePt * 23), lineRule: "atLeast" },
        children: [
          new TextRun({
            text: titleLines[i],
            size: titleSize,
            bold: true,
            color: PC.titleColor,
            font: { ascii: "Calibri" },
          }),
        ],
      })
    );
  }

  // 4. Subtitle
  if (config.subtitle) {
    children.push(
      new Paragraph({
        indent: { left: padL },
        spacing: { after: 800 },
        children: [
          new TextRun({
            text: config.subtitle,
            size: 24,
            color: PC.subtitleColor,
            font: { ascii: "Calibri" },
          }),
        ],
      })
    );
  }

  // 5. Meta info lines with left accent border
  for (const line of config.metaLines || []) {
    children.push(
      new Paragraph({
        indent: { left: padL + 200 },
        spacing: { after: 80 },
        border: { left: accentLeft },
        children: [
          new TextRun({
            text: line,
            size: 24,
            color: PC.metaColor,
            font: { ascii: "Calibri" },
          }),
        ],
      })
    );
  }

  // 6. Bottom whitespace
  children.push(new Paragraph({ spacing: { before: spacing.bottomSpacing } }));

  // 7. Footer
  children.push(
    new Paragraph({
      indent: { left: padL, right: padR },
      border: { top: { style: BorderStyle.SINGLE, size: 2, color: PC.accent, space: 8 } },
      spacing: { before: 200 },
      children: [
        new TextRun({ text: config.footerLeft || "", size: 16, color: PC.footerColor, font: { ascii: "Calibri" } }),
        new TextRun({ text: "                              " }),
        new TextRun({ text: config.footerRight || "", size: 16, color: PC.footerColor, font: { ascii: "Calibri" } }),
      ],
    })
  );

  return [
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      borders: allNoBorders,
      rows: [
        new TableRow({
          height: { value: 16838, rule: "exact" },
          children: [
            new TableCell({
              shading: { type: ShadingType.CLEAR, fill: PC.bg },
              borders: noBorders,
              verticalAlign: "top",
              children,
            }),
          ],
        }),
      ],
    }),
  ];
}

// ────────────────────────────────────────────────────────
// PAGE NUMBER FOOTER HELPER
// ────────────────────────────────────────────────────────
function pageNumFooter(formatType) {
  const formatText = formatType === "roman" ? 'PAGE \\* ROMAN \\** MERGEFORMAT' : 'PAGE \\* arabic \\** MERGEFORMAT';
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ children: [PageNumber.CURRENT], size: 18, color: SECONDARY_GRAY, font: { ascii: "Calibri" } }),
        ],
      }),
    ],
  });
}

// ────────────────────────────────────────────────────────
// COMPLETE SECTION DATA
// ────────────────────────────────────────────────────────
const sections = [
  {
    id: "dashboard", title: "Dashboard", icon: "LayoutDashboard",
    category: "base",
    description: "Central command center providing real-time operational visibility. Displays KPIs, alerts, property status, and quick actions for hotel staff to monitor and manage daily operations at a glance.",
    items: [
      { id: "dashboard-overview", title: "Overview", description: "Main dashboard with financial KPIs, occupancy metrics, and operational summary. Provides quick-action cards for common tasks like creating bookings and processing check-ins.", tabs: [], features: ["KPI summary cards (Occupancy, Active Guests, Available Rooms, Revenue)", "Quick-action cards (New Booking, Check-in Guest, Service Request)", "Calendar widget with today's schedule", "Revenue trend chart", "Alerts and notifications summary", "Recent bookings list"], apis: ["/api/dashboard", "/api/dashboard/quick-stats", "/api/dashboard/revenue-trend"] },
      { id: "dashboard-command-center", title: "Command Center", description: "Real-time command center displaying live KPIs including room availability, guest satisfaction scores, WiFi connected users, and pending service requests.", tabs: [], features: ["Live KPI cards (Available Rooms, Average Rating, WiFi Users, Service Requests)", "Real-time operational metrics", "Quick navigation to critical areas", "Status indicators across departments"], apis: ["/api/dashboard"] },
      { id: "dashboard-alerts", title: "Alerts & Notifications", description: "Unified notification center with categorized alerts for bookings, system events, payments, and WiFi.", tabs: ["All", "Bookings", "Alerts", "System", "Payments", "WiFi"], features: ["Category-based tab filtering", "Read/unread notification state", "Notification search and filter", "Real-time notification feed"], apis: ["/api/notifications/list", "/api/notifications/send"] },
      { id: "dashboard-kpi", title: "KPI Cards", description: "Enhanced KPI dashboard with detailed performance metrics across revenue, operations, and guest satisfaction dimensions.", tabs: ["Overview", "Revenue", "Operations", "Performance"], features: ["Multi-dimensional KPI view", "Revenue metrics (ADR, RevPAR, Total Revenue)", "Operational metrics (Check-ins, Check-outs, Occupancy)", "Performance trend charts"], apis: ["/api/dashboard/quick-stats"] },
    ]
  },
  {
    id: "pms", title: "PMS - Property Management", icon: "Building2",
    category: "base",
    description: "Core property management module for managing hotel properties, room inventory, room types, rate plans, pricing, floor plans, and package configurations.",
    items: [
      { id: "pms-properties", title: "Properties", description: "Complete property management with multi-property support. Configure hotel details, facilities, policies, media, billing integration, and room setup.", tabs: [], features: ["Property CRUD with multi-section dialog", "Property type selection", "Timezone, currency, and tax configuration", "Facilities and amenities management", "Policy configuration", "Media and photo management", "Billing integration setup", "Room count and type mapping", "Bulk operations (export, import)", "Search and filter"], apis: ["/api/properties", "/api/properties/:id"] },
      { id: "pms-room-types", title: "Room Types", description: "Room type management with amenity assignment and rate configuration.", tabs: [], features: ["Room type CRUD", "Amenity assignment", "Rate configuration per room type", "Occupancy settings", "Status management", "Bulk export", "Search and filter"], apis: ["/api/room-types", "/api/room-types/:id"] },
      { id: "pms-rooms", title: "Rooms", description: "Individual room inventory management with status tracking and room-level configuration.", tabs: [], features: ["Room inventory CRUD", "Room status management (Available, Occupied, Maintenance, OOO)", "Room type assignment", "Floor and wing assignment", "Amenity configuration per room", "Bulk operations (status update, export)", "Search and filter"], apis: ["/api/rooms", "/api/rooms/:id"] },
      { id: "pms-inventory-calendar", title: "Inventory Calendar", description: "Calendar-based inventory management showing availability across room types and dates.", tabs: [], features: ["Calendar-based availability view", "Date-range selection", "Room-type-level inventory editing", "Availability adjustments", "Visual occupancy indicators"], apis: ["/api/availability", "/api/inventory-lock"] },
      { id: "pms-availability", title: "Availability Control", description: "Fine-grained availability control with room-type-level management and restriction settings.", tabs: [], features: ["Availability control grid/calendar", "Room-type-level management", "Restriction settings", "Bulk availability updates", "Date-range selection"], apis: ["/api/availability", "/api/rooms/available"] },
      { id: "pms-locking", title: "Inventory Locking", description: "Inventory lock management for reserving room inventory without creating bookings.", tabs: [], features: ["Inventory lock/unlock management", "Date-range selection", "Bulk lock operations", "Lock reason tracking", "Room-type-based locking", "Lock status indicators"], apis: ["/api/inventory-lock"] },
      { id: "pms-rate-plans-pricing", title: "Rate Plans & Pricing", description: "Comprehensive rate plan and pricing management with visual pricing calendar, rate plan CRUD, and pricing rules.", tabs: ["Calendar", "Rate Plans", "Pricing Rules"], features: ["Visual pricing calendar", "Rate plan CRUD (create, edit, delete)", "Seasonal and promotional pricing", "Pricing rule configuration", "Rate plan templates", "Bulk price updates"], apis: ["/api/rate-plans", "/api/rate-plans/:id", "/api/rate-plans/bulk-rates", "/api/price-overrides"] },
      { id: "pms-overbooking", title: "Overbooking Settings", description: "Overbooking threshold configuration per room type to maximize occupancy.", tabs: [], features: ["Overbooking threshold per room type", "Percentage and fixed count settings", "Auto-adjustment rules", "Safety limit configuration"], apis: ["/api/rooms"] },
      { id: "pms-floor-plans", title: "Floor Plans", description: "Visual floor plan editor for room placement and property layout management.", tabs: [], features: ["Visual floor plan editor", "Room placement on grid", "Floor and wing management", "Room position editing", "Export floor plans"], apis: ["/api/floor-plans", "/api/floor-plans/:id", "/api/floor-plans/:id/rooms"] },
      { id: "room-rate-calendar", title: "Room Rate Calendar", description: "Visual rate calendar displaying rates per room type across dates.", tabs: [], features: ["Visual rate calendar per room type", "Date-range rate viewing", "Rate comparison across room types", "Bulk rate updates", "Seasonal rate indicators"], apis: ["/api/rate-plans"] },
      { id: "room-out-of-order", title: "Room Out-of-Order", description: "Out-of-order room scheduling with reason tracking and date range management.", tabs: [], features: ["OOO room scheduling", "Reason tracking (maintenance, deep clean, renovation)", "Date range management", "Automatic availability updates", "OOO history"], apis: ["/api/rooms", "/api/maintenance/work-orders"] },
      { id: "pms-package-plans", title: "Package Plans", description: "Package plan management with inclusions/exclusions configuration.", tabs: [], features: ["Package plan CRUD", "Inclusions and exclusions management", "Rate configuration", "Validity period settings", "Search and filter"], apis: ["/api/packages", "/api/packages/:id", "/api/packages/:id/components", "/api/packages/rates"] },
      { id: "pms-room-type-change", title: "Room Type Change", description: "Room type change request and approval workflow.", tabs: ["Requests", "History"], features: ["Room type change request creation", "Approval workflow", "Request history tracking", "Status management", "Reason tracking"], apis: ["/api/pms/room-type-change", "/api/pms/room-type-change/:id"] },
    ]
  },
  {
    id: "bookings", title: "Bookings", icon: "CalendarDays",
    category: "base",
    description: "Comprehensive booking management with calendar view, group bookings, waitlist management, conflict detection, and no-show automation.",
    items: [
      { id: "bookings-calendar", title: "Calendar View", description: "Calendar-based booking overview with drag interactions and comprehensive filtering.", tabs: [], features: ["Calendar view of bookings", "Drag interactions", "Filter by status (Draft, Confirmed, Checked In, Checked Out, Cancelled)", "Filter by source (Direct, Booking.com, Expedia, etc.)", "KPI summary cards", "Booking detail dialog", "CSV import/export"], apis: ["/api/bookings", "/api/bookings/:id"] },
      { id: "bookings-groups", title: "Group Bookings", description: "Group booking management with room block allocation and group member list.", tabs: [], features: ["Group booking creation (Existing Guest / New Guest)", "Room block allocation", "Group member list management", "Group rate configuration", "Contract terms", "Status tracking"], apis: ["/api/group-bookings", "/api/group-bookings/:id", "/api/group-bookings/book-rooms"] },
      { id: "bookings-waitlist", title: "Waitlist", description: "Waitlist queue management with auto-notify on availability.", tabs: [], features: ["Waitlist queue management", "Auto-notify on availability", "Priority management", "Date flexibility tracking", "Manual/auto processing"], apis: ["/api/waitlist", "/api/waitlist/auto-process"] },
      { id: "bookings-conflicts", title: "Conflicts", description: "Booking conflict detection and resolution interface.", tabs: [], features: ["Conflict detection engine", "Conflict resolution suggestions", "Manual override options", "Conflict history"], apis: ["/api/bookings/conflicts"] },
      { id: "bookings-no-show", title: "No-Show Automation", description: "No-show automation rules with auto-cancellation workflows.", tabs: [], features: ["No-show automation rule configuration", "Auto-cancellation workflows", "Grace period settings", "Notification triggers", "KPI tracking"], apis: ["/api/no-show/settings"] },
      { id: "bookings-audit", title: "Audit Logs", description: "Read-only audit trail of all booking modifications.", tabs: [], features: ["Read-only audit trail", "Filterable by action type", "User attribution", "Timestamp tracking", "Change diff viewing"], apis: ["/api/bookings/audit-logs"] },
    ]
  },
  {
    id: "frontDesk", title: "Front Desk", icon: "ConciergeBell",
    category: "base",
    description: "Front desk operations module covering check-in, check-out, walk-in bookings, room assignment, registration cards, self-service kiosk, and room moves.",
    items: [
      { id: "frontdesk-checkin", title: "Check-in", description: "Guest check-in form with ID verification, room assignment, and payment collection.", tabs: [], features: ["Guest check-in form", "ID verification (Passport, National ID, Driving License)", "Room assignment", "Payment collection", "Key card issuance", "Registration card auto-generation"], apis: ["/api/bookings", "/api/frontdesk/kiosk-checkin"] },
      { id: "frontdesk-checkout", title: "Check-out", description: "Checkout process with folio review, payment processing, and reason selection.", tabs: [], features: ["Checkout process workflow", "Folio review and settlement", "Payment processing", "Room status auto-update", "Key card deactivation", "Check-out reason selection"], apis: ["/api/bookings"] },
      { id: "frontdesk-walkin", title: "Walk-in Booking", description: "Walk-in guest creation with room availability check and direct booking.", tabs: [], features: ["Walk-in guest creation", "Real-time room availability check", "Direct booking", "Room type selection", "Rate display", "ID type selection (Passport, National ID, etc.)"], apis: ["/api/bookings", "/api/rooms/available"] },
      { id: "frontdesk-room-grid", title: "Room Grid", description: "Visual room grid with real-time status and color-coded rooms.", tabs: ["Available", "Occupied", "Dirty", "Maintenance", "Out of Order"], features: ["Visual room grid with real-time status", "Color-coded room indicators", "Room type and floor grouping", "Quick status updates", "Room details on click"], apis: ["/api/rooms", "/api/dashboard/room-status"] },
      { id: "frontdesk-assignment", title: "Room Assignment", description: "Dual-panel room assignment with drag-drop functionality.", tabs: ["Unassigned Bookings", "Available Rooms"], features: ["Dual-panel assignment interface", "Drag-and-drop room assignment", "Unassigned booking queue", "Available rooms list", "Auto-assignment button", "Preference-based suggestions"], apis: ["/api/frontdesk/auto-assign"] },
      { id: "registration-card", title: "Registration Card", description: "Registration card generation with printable format and guest data.", tabs: [], features: ["Registration card generation", "Printable format (A4)", "Guest data auto-fill", "Multi-language support", "Batch printing"], apis: ["/api/folio/registration-card"] },
      { id: "express-kiosk", title: "Express Kiosk", description: "Self-service kiosk interface for express check-in and check-out.", tabs: [], features: ["Self-service check-in/out", "ID document scanning", "Digital signature capture", "Key card encoding", "Receipt printing", "Multi-language support"], apis: ["/api/frontdesk/kiosk-checkin", "/api/frontdesk/kiosk-checkout", "/api/frontdesk/kiosk-session", "/api/kiosk/public-settings"] },
      { id: "kiosk-settings", title: "Kiosk Settings", description: "Kiosk configuration including branding and available features.", tabs: [], features: ["Kiosk branding configuration", "Available features toggle", "Language settings", "Check-in/check-out flow customization", "Terms and conditions", "Receipt template selection"], apis: ["/api/frontdesk/kiosk-settings"] },
      { id: "room-move", title: "Room Move", description: "Room move request with available room search and reason tracking.", tabs: [], features: ["Room move request creation", "Available room search", "Reason tracking", "Folio transfer option", "Room status auto-update"], apis: ["/api/bookings/room-move", "/api/bookings/room-move/history"] },
    ]
  },
  {
    id: "guests", title: "Guests", icon: "Users",
    category: "base",
    description: "Guest management module including guest profiles, KYC documents, preferences, stay history, loyalty programs, journey mapping, and VIP recognition.",
    items: [
      { id: "guests-list", title: "Guest List", description: "Comprehensive guest directory with loyalty tier badges and VIP flags.", tabs: [], features: ["Guest directory with search", "Loyalty tier badges (Bronze, Silver, Gold, Platinum)", "Booking source indicators", "VIP flag", "Quick profile access", "Bulk operations (export)", "Advanced filtering"], apis: ["/api/guests", "/api/guests/:id"] },
      { id: "guests-kyc", title: "KYC / Documents", description: "Document upload and verification with KYC status tracking.", tabs: [], features: ["Document upload (Passport, ID, Visa)", "Document verification workflow", "KYC status tracking", "Document expiry alerts", "Multiple document types", "Approval workflow"], apis: ["/api/guests/:id/documents"] },
      { id: "guests-preferences", title: "Preferences", description: "Guest preference profile management across room, dietary, amenities, and communication.", tabs: [], features: ["Room preferences (floor, view, bed type, pillow)", "Dietary preferences (vegetarian, vegan, allergies)", "Amenity preferences (extra towels, crib, etc.)", "Communication preferences (email, SMS, WhatsApp)", "Preference history"], apis: ["/api/guests/:id"] },
      { id: "guests-history", title: "Stay History", description: "Guest stay history with spending analytics and visit patterns.", tabs: [], features: ["Complete stay history", "Spending analytics per stay", "Visit patterns and frequency", "Average stay duration", "Revenue per guest", "Export history"], apis: ["/api/guests/:id/stays", "/api/guests/:id/journey"] },
      { id: "guests-loyalty", title: "Loyalty & Points", description: "Loyalty program management with points tracking and tier progression.", tabs: [], features: ["Points balance and history", "Tier progression tracking (Bronze, Silver, Gold, Platinum)", "Points earning rules", "Points redemption options", "Tier benefits display"], apis: ["/api/loyalty/points", "/api/loyalty/tiers", "/api/loyalty/programs/:id/earn", "/api/loyalty/redemptions", "/api/loyalty/rewards"] },
      { id: "guests-profile", title: "Guest Profile", description: "Comprehensive guest profile with tabbed sections.", tabs: ["Overview", "Journey", "KYC", "Preferences", "History", "Loyalty"], features: ["Comprehensive profile view", "Contact information", "Stay statistics", "Loyalty status", "Communication history", "Document gallery", "Preference summary"], apis: ["/api/guests/:id"] },
      { id: "guests-journey", title: "Journey Map", description: "Visual guest journey timeline with phase-based tracking.", tabs: [], features: ["Visual journey timeline", "Phase tracking (Pre-Arrival, Arrival, In-Stay, Departure, Post-Stay)", "Touchpoint logging", "Communication history per phase", "Satisfaction scores per phase"], apis: ["/api/guests/:id/journey"] },
      { id: "guests-vip-alerts", title: "VIP Recognition", description: "VIP recognition dashboard with tier configuration and automated alert rules.", tabs: [], features: ["VIP tier configuration", "Automated alert rules", "Alert history log", "VIP guest dashboard", "Recognition preferences", "Special service flags"], apis: ["/api/guests/vip", "/api/guests/vip-alerts", "/api/guests/vip/rules"] },
    ]
  },
  {
    id: "housekeeping", title: "Housekeeping", icon: "Brush",
    category: "base",
    description: "Housekeeping operations module including task management, kanban board, room status, maintenance requests, asset management, inspections, automation, lost & found, minibar, and laundry.",
    items: [
      { id: "housekeeping-tasks", title: "Tasks", description: "Task list with type/status filters and assignment management.", tabs: [], features: ["Task list with type/status filters", "Assignment management", "Priority levels (Low, Medium, High, Urgent)", "Due date tracking", "Photo evidence attachment", "Completion confirmation"], apis: ["/api/tasks", "/api/tasks/:id"] },
      { id: "housekeeping-kanban", title: "Kanban Board", description: "Kanban board for room/task status with drag-drop workflow.", tabs: [], features: ["Visual Kanban board", "Drag-and-drop status updates", "Column customization", "Task cards with details", "Workload indicators per column"], apis: ["/api/housekeeping/dashboard", "/api/housekeeping/workload"] },
      { id: "housekeeping-status", title: "Room Status", description: "Room status dashboard with batch status updates.", tabs: [], features: ["Room status dashboard", "Status filters (Available, Occupied, Dirty, Cleaning, Inspected)", "Batch status updates", "Room status indicators", "Room-type grouping"], apis: ["/api/housekeeping/routes", "/api/rooms"] },
      { id: "housekeeping-maintenance", title: "Maintenance Requests", description: "Maintenance request management with preventive maintenance scheduling.", tabs: ["Maintenance Requests", "Preventive Maintenance"], features: ["Maintenance request CRUD", "Preventive maintenance scheduling", "Priority tracking", "Assignment management", "Cost estimation", "Completion verification", "Photo evidence"], apis: ["/api/maintenance/work-orders", "/api/maintenance/work-orders/:id", "/api/preventive-maintenance", "/api/preventive-maintenance/:id"] },
      { id: "housekeeping-preventive", title: "Preventive Maintenance", description: "Preventive maintenance scheduling and tracking.", tabs: [], features: ["Preventive maintenance scheduling", "Equipment tracking", "Maintenance calendar", "Service history", "Cost tracking"], apis: ["/api/preventive-maintenance", "/api/preventive-maintenance/:id"] },
      { id: "housekeeping-assets", title: "Asset Management", description: "Asset registry with category management and depreciation tracking.", tabs: [], features: ["Asset registry CRUD", "Category management", "Depreciation tracking", "Maintenance history per asset", "Location tracking", "Photo documentation"], apis: ["/api/assets", "/api/assets/:id"] },
      { id: "housekeeping-inspections", title: "Inspection Checklists", description: "Inspection checklists with scoring and completion tracking.", tabs: [], features: ["Inspection checklist CRUD", "Room-type-specific checklists", "Scoring and rating", "Completion tracking", "Inspector assignment", "Photo evidence", "PDF export"], apis: ["/api/inspections", "/api/inspections/:id", "/api/inspection-templates"] },
      { id: "housekeeping-automation", title: "Automation Rules", description: "Housekeeping automation rule builder with manual triggers.", tabs: ["Automation Rules", "Manual Triggers", "Checkout Workflow"], features: ["Automation rule builder", "Manual trigger buttons", "Checkout workflow configuration", "Auto-task assignment rules", "Priority escalation", "Notification triggers"], apis: ["/api/automation/rules", "/api/automation/execution-logs"] },
      { id: "housekeeping-lost-found", title: "Lost & Found", description: "Lost & found item tracking with matching and photo evidence.", tabs: ["All Items", "Lost", "Found", "Matched", "Returned"], features: ["Item registration (Lost/Found)", "Photo evidence", "Item matching algorithm", "Return tracking", "Guest notification", "Storage location management"], apis: ["/api/lost-found"] },
      { id: "housekeeping-minibar", title: "Minibar", description: "Minibar inventory per room with consumption logging and restock alerts.", tabs: [], features: ["Minibar inventory per room", "Consumption logging", "Auto-restock alerts", "Item pricing", "Category management", "Stock level indicators"], apis: ["/api/minibar/consumption", "/api/minibar/setup", "/api/minibar/items"] },
      { id: "housekeeping-laundry", title: "Laundry", description: "Laundry order management with pickup/delivery tracking.", tabs: [], features: ["Laundry order management", "Pickup/delivery tracking", "Service type management (wash, dry clean, iron)", "Item-level tracking", "Status workflow", "KPI metrics"], apis: ["/api/laundry/orders", "/api/laundry/orders/:id", "/api/laundry/items"] },
    ]
  },
  {
    id: "billing", title: "Billing & Invoicing", icon: "Receipt",
    category: "base",
    description: "Comprehensive billing and invoicing module including folios, invoices, payments, refunds, discounts, cancellation policies, night audit, GST compliance, financial reporting, and more.",
    items: [
      { id: "billing-folios", title: "Folios", description: "Guest folio management with charge posting, payment application, and balance tracking.", tabs: [], features: ["Guest folio management", "Charge posting (room, F&B, minibar, laundry, etc.)", "Payment application", "Balance tracking", "Folio split capability", "Folio transfer between guests", "Folio audit trail"], apis: ["/api/folios", "/api/folios/:id", "/api/folios/:id/line-items", "/api/folios/:id/split", "/api/folio/transfer"] },
      { id: "billing-invoices", title: "Invoices", description: "Invoice generation with multi-currency support and print/PDF export.", tabs: [], features: ["Invoice generation from folio", "Multi-currency support", "Line item management", "Tax calculation", "Print/PDF export", "Email delivery", "Proforma invoices", "Credit notes", "Recurring invoices", "Status tracking (Draft, Sent, Paid, Overdue)"], apis: ["/api/invoices", "/api/invoices/:id", "/api/invoices/:id/pdf", "/api/invoices/:id/send", "/api/invoices/recurring"] },
      { id: "billing-payments", title: "Payments", description: "Payment processing with multi-currency and multi-method support.", tabs: [], features: ["Multi-method payment processing (Cash, Card, Bank Transfer, UPI, Wallet)", "Multi-currency support", "Partial payment support", "Payment authorization and capture", "Payment void and refund", "Receipt generation", "Split payments"], apis: ["/api/payments", "/api/payments/:id", "/api/payments/:id/capture", "/api/payments/:id/void", "/api/payments/split", "/api/payments/authorize"] },
      { id: "billing-refunds", title: "Refunds", description: "Refund request processing with approval workflow and partial refunds.", tabs: [], features: ["Refund request processing", "Approval workflow", "Partial refund support", "Multi-method refund", "Reason tracking", "Refund status tracking"], apis: ["/api/payments"] },
      { id: "billing-discounts", title: "Discounts", description: "Discount rule management with percentage/fixed types and applicability rules.", tabs: [], features: ["Discount rule CRUD", "Percentage and fixed amount types", "Applicability rules (room type, channel, guest segment)", "Validity period settings", "Stacking rules", "Usage analytics"], apis: ["/api/discounts"] },
      { id: "billing-cancellation-policies", title: "Cancellation Policies", description: "Cancellation policy management with penalty tiers and deadline rules.", tabs: [], features: ["Cancellation policy CRUD", "Penalty tiers (percentage-based)", "Deadline rules (hours/days before check-in)", "Policy assignment to rate plans", "Free cancellation windows", "No-show penalty rules"], apis: ["/api/cancellation-policies", "/api/cancellation-policies/:id"] },
      { id: "folio-transfer", title: "Folio Transfer", description: "Inter-folio transfer with transfer history tracking.", tabs: [], features: ["Inter-folio transfer", "Transfer history", "Partial amount transfer", "Transfer reason tracking", "Multi-currency transfer support"], apis: ["/api/folio/transfer", "/api/folio/transfer/history"] },
      { id: "payment-plans", title: "Payment Plans", description: "Installment plan configuration with payment schedules.", tabs: [], features: ["Installment plan configuration", "Payment schedule management", "Auto-charge rules", "Plan templates", "Installment tracking"], apis: ["/api/billing/financing", "/api/billing/deposits"] },
      { id: "credit-notes", title: "Credit Notes", description: "Credit note generation with printing and folio application.", tabs: [], features: ["Credit note generation", "Line item management", "Print/PDF support", "Application to folios", "Credit note cancellation", "Reason tracking"], apis: ["/api/folio/credit-notes", "/api/folio/credit-notes/:id/cancel", "/api/folio/credit-notes/:id/apply", "/api/folio/credit-notes/:id/pdf"] },
      { id: "multi-currency", title: "Multi-Currency", description: "Exchange rate management with currency conversion and multi-currency folios.", tabs: [], features: ["Exchange rate management", "Currency conversion calculator", "Multi-currency folio support", "Automatic rate updates", "Historical rate tracking", "Currency symbols and formatting"], apis: ["/api/exchange-rates", "/api/billing/exchange-rates/convert", "/api/channels/currency"] },
      { id: "billing-night-audit", title: "Night Audit", description: "End-of-day audit with revenue verification and posting verification.", tabs: [], features: ["End-of-day audit checklist", "Revenue verification", "Posting verification", "Room revenue reconciliation", "Tax calculation verification", "Audit completion timestamp", "Auto-posting of end-of-day charges"], apis: ["/api/night-audit", "/api/night-audit/:id", "/api/night-audit/:id/execute-step"] },
      { id: "billing-city-ledger", title: "City Ledger", description: "City ledger (accounts receivable) with invoice management.", tabs: [], features: ["City ledger account management", "Invoice generation and tracking", "Payment terms configuration", "Aging report", "Account statement generation", "Payment application", "Status tracking"], apis: ["/api/city-ledger", "/api/city-ledger/:id", "/api/city-ledger/:id/items"] },
      { id: "billing-commissions", title: "Commissions", description: "Commission tracking per agent/channel with payment status.", tabs: [], features: ["Commission tracking per agent/channel", "Commission rule configuration", "Payment status tracking", "Commission calculation", "Commission payment processing", "Historical commission reports"], apis: ["/api/commissions/rules", "/api/commissions/records", "/api/commissions/payments"] },
      { id: "billing-posting-rules", title: "Posting Rules", description: "Posting rule configuration for auto-charge rules and department mapping.", tabs: [], features: ["Auto-charge posting rules", "Department mapping", "Revenue account mapping", "Tax configuration per posting", "Scheduled posting", "Conditional posting rules"], apis: ["/api/posting-rules", "/api/posting-rules/:id"] },
      { id: "billing-scheduled-charges", title: "Scheduled Charges", description: "Recurring charge scheduling with automated posting.", tabs: [], features: ["Recurring charge scheduling", "Automated posting engine", "Frequency configuration (daily, weekly, monthly)", "Charge amount and type", "Start/end date management", "Pause/resume capability", "Execution history"], apis: ["/api/scheduled-charges", "/api/scheduled-charges/:id", "/api/scheduled-charges/:id/pause", "/api/scheduled-charges/:id/resume", "/api/scheduled-charges/:id/execute"] },
      { id: "billing-tax-settings", title: "Tax Settings", description: "Tax configuration with SAC codes, TCS/TDS setup, and reverse charge.", tabs: ["General", "SAC Codes", "TCS/TDS", "Reverse Charge"], features: ["Tax rate configuration", "SAC code management", "TCS/TDS setup", "Reverse charge configuration", "Tax grouping", "Compound tax rules", "Tax-exempt categories"], apis: ["/api/tax/settings", "/api/tax/settings/:id", "/api/tax/sac-codes", "/api/tax/tcs", "/api/tax/tds"] },
      { id: "billing-gst-invoicing", title: "GST e-Invoicing", description: "GST-compliant invoicing with bulk generation and tax breakdown.", tabs: [], features: ["GST-compliant invoice generation", "Bulk invoice generation", "GSTIN validation", "HSN/SAC code mapping", "Tax breakdown (CGST, SGST, IGST)", "IRN generation", "E-invoice JSON upload to GST portal", "QR code generation"], apis: ["/api/tax/e-invoices", "/api/tax/e-invoices/:id", "/api/tax/e-invoices/:id/generate"] },
      { id: "billing-gst-returns", title: "GST Returns", description: "GSTR-1 and GSTR-3B filing with tax period selection.", tabs: ["GSTR-1", "GSTR-3B"], features: ["GSTR-1 filing (Outward Supplies)", "GSTR-3B filing (Summary Return)", "Tax period selection", "Auto-population from invoices", "JSON generation for upload", "Filing status tracking", "Historical returns"], apis: ["/api/tax/returns/gstr1", "/api/tax/returns/gstr3b"] },
      { id: "billing-tcs-tds", title: "TCS/TDS", description: "TCS/TDS tracking with certificate management.", tabs: ["TCS Collections", "TDS Deductions"], features: ["TCS collection tracking", "TDS deduction management", "Section-wise configuration", "Threshold monitoring", "Certificate generation", "Challan payment tracking", "Quarterly return filing"], apis: ["/api/tax/tcs", "/api/tax/tds"] },
      { id: "billing-ap-workflow", title: "AP Workflow", description: "Accounts payable workflow with approval chain and vendor payments.", tabs: [], features: ["Invoice receipt and matching", "Approval chain management", "Vendor payment processing", "Three-way matching (PO, Invoice, Receipt)", "Payment scheduling", "Expense categorization", "Print checks"], apis: ["/api/billing/ap-workflow", "/api/invoice-matching", "/api/invoice-matching/:id"] },
      { id: "billing-profit-loss", title: "P&L Statement", description: "Profit & Loss statement with revenue vs expense breakdown and export.", tabs: [], features: ["P&L statement generation", "Revenue vs expense breakdown", "Department-wise analysis", "Date range selection", "Comparison with prior periods", "Export (CSV, PDF)"], apis: ["/api/financials/profit-loss", "/api/financials/profit-loss/export"] },
      { id: "billing-cash-flow", title: "Cash Flow Forecast", description: "Cash flow forecasting with actual vs projected tracking.", tabs: [], features: ["Cash flow forecasting", "Actual vs projected tracking", "Inflow/outflow analysis", "Date range projection", "Category-wise breakdown", "Variance analysis"], apis: ["/api/financials/cash-flow"] },
      { id: "billing-budget", title: "Budget Management", description: "Budget planning with variance analysis and department-level budgets.", tabs: [], features: ["Budget planning and creation", "Department-level budgets", "Variance analysis (budget vs actual)", "Budget allocation", "Period-wise tracking", "Budget approval workflow", "Export reports"], apis: ["/api/financials/budgets", "/api/financials/budgets/:id"] },
      { id: "billing-deposits", title: "Deposit Schedules", description: "Deposit schedule management with installment tracking.", tabs: [], features: ["Deposit schedule creation", "Installment tracking", "Payment status monitoring", "Due date alerts", "Auto-charge configuration", "Deposit refund management"], apis: ["/api/billing/deposits", "/api/billing/financing/installments"] },
      { id: "billing-financing", title: "BNPL / Financing", description: "Guest financing options with payment plan management.", tabs: [], features: ["BNPL (Buy Now Pay Later) options", "Payment plan creation", "Installment scheduling", "Interest rate configuration", "Eligibility rules", "Plan status tracking"], apis: ["/api/billing/financing", "/api/billing/financing/installments"] },
    ]
  },
  {
    id: "experience", title: "Guest Experience", icon: "Sparkles",
    category: "addons",
    description: "Guest experience module covering service requests, unified inbox, guest chat, in-room portal, digital keys, experience catalog, bookings, pricing, vendors, revenue analytics, feedback, spa & wellness, and golf course.",
    items: [
      { id: "experience-requests", title: "Service Requests", description: "Service request management with multi-category and priority-based routing.", tabs: [], features: ["Multi-category service requests (Housekeeping, Maintenance, F&B, Transport)", "Priority-based routing (Low, Medium, High, Urgent)", "Status workflow (New, In Progress, Completed)", "Photo evidence attachment", "Guest notification", "SLA tracking", "Assignment management"], apis: ["/api/service-requests"] },
      { id: "experience-inbox", title: "Unified Inbox", description: "Unified communication inbox across App, WhatsApp, Email, SMS, and OTA.", tabs: [], features: ["Multi-channel inbox (App, WhatsApp, Email, SMS, OTA)", "Priority and status filtering", "Conversation threading", "Quick reply templates", "Guest profile sidebar", "Read/unread status", "Assignment management"], apis: ["/api/communication/conversations", "/api/communication/conversations/:id/messages"] },
      { id: "experience-chat", title: "Guest Chat", description: "Real-time guest chat with conversation history.", tabs: [], features: ["Real-time chat messaging", "Conversation history", "File and image sharing", "Chat transfer between staff", "Quick reply templates", "Typing indicators", "Read receipts"], apis: ["/api/chat-conversations", "/api/chat-conversations/:id/messages", "/api/chat-conversations/:id/attachments"] },
      { id: "experience-portal", title: "In-Room Portal", description: "In-room tablet/web portal configuration with service categories.", tabs: [], features: ["In-room portal configuration", "Service category management", "Branding and theming", "Content management", "Multi-language support", "Guest authentication"], apis: ["/api/portal/in-room"] },
      { id: "experience-keys", title: "Digital Keys", description: "Digital key issuance with QR code and validity period management.", tabs: [], features: ["Digital key issuance", "QR code generation", "Validity period management", "Multiple key per guest", "Key revocation", "Access log tracking", "Bluetooth/NFC support"], apis: ["/api/digital-keys", "/api/digital-keys/:id/qr"] },
      { id: "experience-app-controls", title: "Guest App Controls", description: "Guest mobile app feature toggles and notification settings.", tabs: [], features: ["Feature toggle management", "Push notification settings", "App branding configuration", "Version management", "Device compatibility", "Guest-facing feature control"], apis: ["/api/guest-app"] },
      { id: "experiences", title: "Experience Catalog", description: "Experience catalog management with activity/amenity listing.", tabs: [], features: ["Experience/activity catalog CRUD", "Category management", "Image gallery", "Pricing tiers", "Availability calendar", "Booking integration", "Search and filter"], apis: ["/api/experiences"] },
      { id: "experience-bookings", title: "Experience Bookings", description: "Experience booking management with scheduling and confirmation.", tabs: [], features: ["Experience booking management", "Scheduling and availability", "Booking confirmation", "Payment processing", "Cancellation and modification", "Voucher support", "Notification triggers"], apis: ["/api/experience-bookings"] },
      { id: "experience-pricing", title: "Pricing & Availability", description: "Experience pricing tiers with seasonal/group/early-bird/last-minute rates.", tabs: [], features: ["Seasonal pricing", "Group pricing", "Early-bird discounts", "Last-minute deals", "Peak/off-peak rates", "Availability management", "Revenue optimization"], apis: ["/api/experience-availability"] },
      { id: "experience-vendors", title: "Vendor Management", description: "Vendor directory with service provider management.", tabs: [], features: ["Vendor directory CRUD", "Service provider profiles", "Commission configuration", "Performance tracking", "Contract management", "Communication history"], apis: ["/api/experience-vendors", "/api/vendors"] },
      { id: "experience-revenue", title: "Revenue Analytics", description: "Experience revenue analytics with trend charts.", tabs: ["Revenue by Experience", "Revenue Trend", "Booking Status"], features: ["Revenue by experience type", "Revenue trend charts", "Booking status breakdown", "Commission tracking", "Vendor performance", "Date range filtering", "Export capabilities"], apis: ["/api/experience-revenue"] },
      { id: "experience-calendar", title: "Calendar", description: "Calendar view of all experiences with booking density.", tabs: [], features: ["Calendar view of all experiences", "Booking density indicators", "Availability overview", "Experience filtering", "Date navigation"], apis: ["/api/experience-calendar"] },
      { id: "experience-feedback", title: "Guest Feedback", description: "Guest feedback collection with rating management and response tracking.", tabs: [], features: ["Feedback collection form", "Star rating system", "Category-wise ratings", "Response tracking", "Sentiment analysis", "Feedback analytics"], apis: ["/api/experience-feedback", "/api/crm/feedback"] },
      { id: "experience-spa", title: "Spa & Wellness", description: "Spa appointment management with therapist scheduling and treatment menu.", tabs: [], features: ["Spa appointment scheduling", "Therapist management and scheduling", "Treatment menu management", "Duration and pricing", "Room/bed assignment", "Status tracking", "Revenue analytics"], apis: ["/api/experience/spa", "/api/experience/spa/treatments", "/api/experience/spa/therapists", "/api/experience/spa/appointments", "/api/experience/spa/revenue"] },
      { id: "experience-golf", title: "Golf Course", description: "Golf tee time management with course scheduling and membership tracking.", tabs: [], features: ["Tee time booking and management", "Course scheduling", "Membership management and tiers", "Player tracking", "Cart and equipment rental", "Weather integration", "Revenue tracking"], apis: ["/api/experience/golf", "/api/experience/golf/courses", "/api/experience/golf/tee-times", "/api/experience/golf/memberships"] },
    ]
  },
  {
    id: "pos", title: "Restaurant & POS", icon: "UtensilsCrossed",
    category: "addons",
    description: "Restaurant and Point of Sale module including orders, tables, kitchen display, menu management, room service, recipes, table layout, reservations, offline mode, and digital menu boards.",
    items: [
      { id: "pos-orders", title: "Orders", description: "Order creation with table selection and order type (dine-in/takeaway/delivery).", tabs: [], features: ["Order creation and management", "Table selection", "Order type (Dine-in, Takeaway, Delivery)", "Order status tracking", "Item customization (modifiers)", "Split bill capability", "Order timing"], apis: ["/api/orders", "/api/orders/:id"] },
      { id: "pos-tables", title: "Tables", description: "Restaurant table management with capacity and status.", tabs: [], features: ["Table CRUD", "Capacity management", "Table status (Available, Occupied, Reserved)", "Floor assignment", "Table merging", "Shape and position"], apis: ["/api/tables", "/api/tables/split", "/api/tables/merge"] },
      { id: "pos-kitchen", title: "Kitchen (KDS)", description: "Kitchen Display System with real-time order queue.", tabs: [], features: ["Real-time kitchen display", "Order queue management", "Preparation time tracking", "Item priority indicators", "Course-wise ordering", "Order completion marking", "Bump to next station"], apis: ["/api/orders"] },
      { id: "pos-menu", title: "Menu Management", description: "Menu item CRUD with modifiers, variants, categories, and image upload.", tabs: ["Basic", "Modifiers", "Variants"], features: ["Menu item CRUD", "Category management", "Modifier groups (size, temperature, extras)", "Variant management (size-based pricing)", "Image upload", "Allergen information", "Nutritional data", "Availability toggle"], apis: ["/api/menu-items", "/api/menu-categories", "/api/menu-modifiers", "/api/menu-variants"] },
      { id: "pos-billing", title: "Restaurant Billing", description: "POS billing interface with split bill and recent transactions.", tabs: [], features: ["Restaurant bill generation", "Split bill (equal, custom, item-wise)", "Tip management", "Discount application", "Multiple payment methods", "Receipt printing", "Recent transactions"], apis: ["/api/payments", "/api/orders"] },
      { id: "pos-room-service", title: "Room Service", description: "Room service order management with delivery tracking.", tabs: [], features: ["Room service order creation", "Room number selection", "Delivery tracking", "Order status updates", "Tray setup management", "Delivery confirmation"], apis: ["/api/room-service", "/api/room-service/rooms"] },
      { id: "pos-restaurant-reports", title: "Restaurant Reports", description: "Restaurant performance reports with analytics.", tabs: [], features: ["Sales analytics", "Popular items report", "Revenue by period", "Table turnover rate", "Average order value", "Kitchen performance", "Staff performance"], apis: ["/api/restaurant-reports"] },
      { id: "pos-recipes", title: "Recipes", description: "Recipe management with ingredients and cost calculation.", tabs: [], features: ["Recipe CRUD", "Ingredient list with quantities", "Cost calculation per dish", "Preparation instructions", "Allergen marking", "Recipe versioning", "Yield management"], apis: ["/api/recipes"] },
      { id: "pos-staff-assignment", title: "Staff Assignment", description: "Staff-to-section assignment with shift-based management.", tabs: [], features: ["Staff-to-section assignment", "Shift-based scheduling", "Role assignment (Server, Bartender, Host)", "Staff availability tracking", "Performance metrics per staff"], apis: ["/api/staff/channels"] },
      { id: "pos-receipt-templates", title: "Receipt Templates", description: "Receipt template designer with print configuration.", tabs: [], features: ["Receipt template designer", "Custom header/footer", "Logo placement", "Print format configuration", "Multiple template support", "Language-specific templates"], apis: ["/api/receipt-templates"] },
      { id: "pos-inventory", title: "Inventory", description: "F&B inventory management with stock tracking.", tabs: [], features: ["F&B stock item management", "Quantity tracking", "Low stock alerts", "Recipe-linked consumption", "Waste tracking", "Stock adjustment", "Purchase order integration"], apis: ["/api/pos-inventory", "/api/pos-inventory/:id/adjust"] },
      { id: "pos-modifiers", title: "Menu Modifiers", description: "Menu modifier groups (size, temperature, extras).", tabs: [], features: ["Modifier group CRUD", "Option management per group", "Price impact configuration", "Multi-select support", "Required/optional options", "Sort order management"], apis: ["/api/menu-modifiers"] },
      { id: "pos-variants", title: "Menu Variants", description: "Menu variant management with size-based pricing.", tabs: [], features: ["Variant group CRUD", "Size-based pricing", "SKU management", "Default variant selection", "Availability per variant", "Image per variant"], apis: ["/api/menu-variants"] },
      { id: "pos-table-layout", title: "Table Layout", description: "Visual table layout editor with drag-drop positioning.", tabs: [], features: ["Visual table layout editor", "Drag-and-drop positioning", "Floor plan creation", "Table shape customization", "Zone assignment", "Print layout"], apis: ["/api/tables/batch-layout"] },
      { id: "pos-reservations", title: "Reservations", description: "Restaurant reservation management with time slot booking.", tabs: [], features: ["Reservation creation", "Time slot management", "Guest information", "Special requests", "Table pre-assignment", "Confirmation and cancellation", "No-show tracking", "Waitlist management"], apis: ["/api/pos-reservations"] },
      { id: "pos-offline", title: "Offline Mode", description: "Offline POS mode with sync queue and conflict resolution.", tabs: [], features: ["Offline order creation", "Sync queue management", "Conflict resolution", "Automatic sync on reconnection", "Local data persistence", "Queue status monitoring"], apis: ["/api/pos/offline", "/api/pos/offline/sync", "/api/pos/offline/orders"] },
      { id: "pos-menu-boards", title: "Digital Menu Boards", description: "Digital menu board management with screen assignment and analytics.", tabs: ["Menu Boards", "Item Management", "Screen Assignment", "Analytics"], features: ["Menu board creation and design", "Item assignment per board", "Screen/device assignment", "Display analytics", "Template library", "Auto-refresh scheduling"], apis: ["/api/pos/menu-boards", "/api/pos/menu-boards/:id", "/api/pos/menu-boards/:id/items"] },
    ]
  },
  {
    id: "inventory", title: "Inventory", icon: "Package",
    category: "addons",
    description: "Inventory management module with stock items, consumption logs, low stock alerts, vendors, purchase orders, requisitions, and invoice matching.",
    items: [
      { id: "inventory-stock", title: "Stock Items", description: "Stock item management with quantity tracking and low-stock alerts.", tabs: [], features: ["Stock item CRUD", "Quantity tracking", "Low stock threshold alerts", "Category management", "Unit of measure", "Location tracking", "Search and filter"], apis: ["/api/inventory/stock"] },
      { id: "inventory-consumption", title: "Consumption Logs", description: "Consumption logging with usage history and department tracking.", tabs: [], features: ["Consumption logging", "Usage history", "Department-wise tracking", "Date range filtering", "Export capability", "Trend analysis"], apis: ["/api/inventory/consumption"] },
      { id: "inventory-alerts", title: "Low Stock Alerts", description: "Low stock alert dashboard with threshold configuration.", tabs: [], features: ["Low stock alert dashboard", "Threshold configuration per item", "Alert history", "Auto-reorder suggestions", "Notification settings"], apis: ["/api/inventory/stock"] },
      { id: "inventory-vendors", title: "Vendors", description: "Vendor directory with contact management and performance ratings.", tabs: [], features: ["Vendor directory CRUD", "Contact management", "Performance ratings", "Payment terms", "Supply history", "Category filtering"], apis: ["/api/inventory/vendors", "/api/vendors"] },
      { id: "inventory-po", title: "Purchase Orders", description: "Purchase order management with approval workflow.", tabs: [], features: ["Purchase order creation", "Approval workflow", "PO status tracking (Draft, Sent, Partial, Received)", "Line item management", "Goods receipt", "Three-way matching", "PO history"], apis: ["/api/inventory/purchase-orders"] },
      { id: "inventory-purchase-requisition", title: "Purchase Requisitions", description: "Purchase requisition workflow with 3-way matching.", tabs: ["Requisitions", "3-Way Matching", "Auto-Requisition Rules", "Analytics"], features: ["Requisition creation and submission", "Approval workflow", "3-way matching (PO, Invoice, Receipt)", "Auto-requisition rules", "Requisition analytics", "Department-wise tracking"], apis: ["/api/inventory/requisitions", "/api/inventory/requisitions/:id/approve"] },
      { id: "inventory-invoice-matching", title: "Invoice Matching", description: "Invoice-to-PO matching with discrepancy detection.", tabs: [], features: ["Invoice-to-PO matching", "Discrepancy detection", "Price variance alerts", "Quantity variance alerts", "Match approval workflow", "Audit trail"], apis: ["/api/invoice-matching", "/api/invoice-matching/:id"] },
    ]
  },
  {
    id: "facilities", title: "Facilities", icon: "PartyPopper",
    category: "addons",
    description: "Facility management module covering parking, events/MICE, and resort operations (timeshare and casino).",
    items: [
      { id: "parking-slots", title: "Parking Slots", description: "Parking slot management with status tracking.", tabs: [], features: ["Parking slot CRUD", "Status tracking (Available, Occupied, Reserved)", "Zone/floor assignment", "Slot type (Standard, VIP, EV Charging)", "Pricing configuration"], apis: ["/api/parking"] },
      { id: "parking-tracking", title: "Vehicle Tracking", description: "Vehicle check-in/out with duration tracking and billing.", tabs: [], features: ["Vehicle check-in/out", "Duration tracking", "Automatic billing", "License plate recognition", "Guest-room association", "Overstay alerts"], apis: ["/api/vehicles", "/api/parking/billing", "/api/parking/passes"] },
      { id: "parking-billing", title: "Parking Billing", description: "Parking billing with rate configuration.", tabs: [], features: ["Rate configuration per slot type", "Hourly/daily/monthly rates", "Guest room charge posting", "Payment processing", "Billing history", "Reports"], apis: ["/api/parking/billing"] },
      { id: "events-spaces", title: "Event Spaces", description: "Event space/venue CRUD with capacity and amenities.", tabs: [], features: ["Event space/venue CRUD", "Capacity management", "Amenity configuration", "Availability calendar", "Pricing tiers", "Layout configuration", "Photo gallery"], apis: ["/api/events/spaces", "/api/events/spaces/:id"] },
      { id: "events-calendar", title: "Event Calendar", description: "Event calendar with drag-drop scheduling.", tabs: [], features: ["Event calendar view", "Drag-and-drop scheduling", "Multi-space view", "Conflict detection", "Booking density indicators", "Filter by space/type"], apis: ["/api/events", "/api/events/conflicts"] },
      { id: "events-booking", title: "Event Bookings", description: "Event booking management with contracts and print.", tabs: [], features: ["Event booking CRUD", "Contract management", "Deposit tracking", "BEO reference", "Print support", "Status workflow", "Guest information"], apis: ["/api/events/:id", "/api/events/:id/resources"] },
      { id: "events-resources", title: "Event Resources", description: "Event resource/equipment management.", tabs: [], features: ["Resource/equipment CRUD", "Availability tracking", "Booking assignment", "Category management", "Pricing per resource", "Maintenance scheduling"], apis: ["/api/events/:id/resources"] },
      { id: "events-beo", title: "BEO Management", description: "Banquet Event Order management with approval workflow.", tabs: [], features: ["BEO creation and management", "Food & beverage planning", "Equipment requirements", "Setup instructions", "Approval workflow", "Timeline management", "Print support"], apis: ["/api/events/beo", "/api/events/beo/:id", "/api/events/beo/:id/approve"] },
      { id: "resort-timeshare", title: "Timeshare & Ownership", description: "Timeshare ownership management with interval scheduling.", tabs: [], features: ["Ownership record management", "Interval scheduling", "Usage tracking", "Exchange program", "Maintenance fee tracking", "Owner portal", "Contract management"], apis: ["/api/resort/timeshare/units", "/api/resort/timeshare/ownerships"] },
      { id: "resort-casino", title: "Casino & Gaming", description: "Casino operations tracking with gaming analytics.", tabs: [], features: ["Table game tracking", "Transaction logging", "Revenue analytics", "Pit boss operations", "Chip management", "Player tracking", "Compliance reporting"], apis: ["/api/resort/casino/tables", "/api/resort/casino/transactions"] },
    ]
  },
  {
    id: "wifi", title: "WiFi & Network", icon: "Wifi",
    category: "addons",
    description: "Comprehensive WiFi and network management module covering access, RADIUS, network infrastructure, DHCP, DNS, captive portal, firewall, content filter, diagnostics, reports, health monitoring, pre-arrival delivery, device management, identity verification, GDPR consent, bandwidth upsell, revenue analytics, surveys, and SLA monitoring.",
    items: [
      { id: "wifi-access", title: "WiFi Access", description: "Central WiFi access page with session, voucher, and plan management.", tabs: [], features: ["Live session monitoring", "User session management", "Voucher creation and management", "WiFi plan configuration", "Authentication log viewing", "Guest device management"], apis: ["/api/wifi/sessions", "/api/wifi/vouchers", "/api/wifi/plans", "/api/wifi/users"] },
      { id: "wifi-gateway-radius", title: "RADIUS & Gateway", description: "RADIUS server and WiFi controller configuration.", tabs: [], features: ["RADIUS server configuration", "AAA settings (Auth, Acct, Auth+Acct)", "WiFi controller management", "NAS health monitoring", "Provisioning logs", "CoA (Change of Authorization) support"], apis: ["/api/wifi/radius", "/api/wifi/aaa", "/api/wifi/nas-health"] },
      { id: "wifi-network", title: "Network", description: "Network infrastructure configuration including interfaces, VLANs, bridges, and routes.", tabs: ["Interfaces", "VLANs", "Bridges", "Routes", "Multi-WAN"], features: ["Network interface configuration", "VLAN management", "Bridge configuration", "Routing tables", "Multi-WAN failover", "WAN bond management", "Interface role assignment", "Network aliases"], apis: ["/api/wifi/network/interfaces", "/api/wifi/network/vlans", "/api/wifi/network/bridges", "/api/wifi/network/routes", "/api/wifi/network/multiwan", "/api/wifi/network/bonds", "/api/wifi/network/wan-failover"] },
      { id: "wifi-dhcp", title: "DHCP Server", description: "Full DHCP server management with subnets, reservations, leases, and options.", tabs: [], features: ["DHCP subnet management", "Static reservations (MAC-IP binding)", "Lease monitoring", "DHCP options configuration", "Lease scripts", "Hostname filters", "Blacklist management", "Service start/stop/restart", "Status dashboard"], apis: ["/api/wifi/dhcp/subnets", "/api/wifi/dhcp/reservations", "/api/wifi/dhcp/leases", "/api/wifi/dhcp/options"] },
      { id: "wifi-dns", title: "DNS Server", description: "DNS management with zones, records, redirects, and cache.", tabs: [], features: ["DNS server configuration", "DNS zone management", "A/AAAA/CNAME/MX/TXT record management", "DNS redirects", "Cache management", "Upstream DNS configuration"], apis: ["/api/wifi/portal/dns-zones", "/api/wifi/portal/dns-records"] },
      { id: "wifi-portal", title: "Captive Portal", description: "Captive portal designer with templates, layout, theming, and analytics.", tabs: ["Portal Instances", "Pool Mappings", "Designer", "Analytics"], features: ["Multi-portal instance support", "Zone-based pool mapping", "Portal designer (Templates, Layout, Background, Typography, Form, Content, Fields, Advanced)", "Portal analytics", "Authentication method configuration", "Voucher integration", "Walled garden", "Custom pages", "Print card support"], apis: ["/api/wifi/portal/instances", "/api/wifi/portal/templates", "/api/wifi/portal/mappings", "/api/wifi/portal/analytics"] },
      { id: "wifi-firewall", title: "Firewall & Bandwidth", description: "Comprehensive firewall management with rules, port forwarding, rate limiting, and schedules.", tabs: [], features: ["Firewall rules management", "Port forwarding", "Rate limiting per user/session", "Bandwidth pools", "Schedule-based rules", "Content filtering", "MAC filtering", "Quick blocks", "Bandwidth usage monitoring", "Rule counters", "Zone management", "Apply/revert configuration"], apis: ["/api/wifi/firewall/rules", "/api/wifi/firewall/port-forwards", "/api/wifi/firewall/rate-limits", "/api/wifi/firewall/bandwidth-pools", "/api/wifi/firewall/schedules"] },
      { id: "wifi-content-filter", title: "Content Filter", description: "Category-based web content filtering with schedules.", tabs: [], features: ["Category-based filtering", "Custom block/allow lists", "Schedule-based rules", "Per-user/zone policies", "Bulk import", "Sync management", "Filter statistics"], apis: ["/api/wifi/content-filter", "/api/wifi/firewall/content-filter"] },
      { id: "wifi-diagnostics", title: "Gateway Diagnostics", description: "Network diagnostic tools for troubleshooting.", tabs: [], features: ["Ping", "Traceroute", "DNS Lookup", "ARP Table", "Network Scan", "Packet Capture", "Speed Test", "Port Check", "Active Connections", "Route Table", "Interface Status", "Console"], apis: ["/api/wifi/diagnostics"] },
      { id: "wifi-reports", title: "Reports", description: "WiFi analytics dashboard with usage and performance reports.", tabs: ["Overview", "Interfaces", "Resources", "Active Users", "Pool BW", "Alerts"], features: ["Usage analytics", "Bandwidth reports", "Surfing reports", "Health reports", "Voucher reports", "User bandwidth reports", "NAT logs", "Syslog viewer", "Data export"], apis: ["/api/wifi/reports/*"] },
      { id: "wifi-health-alerts", title: "Health Alerts", description: "Network health monitoring with alerts for AP down, high latency, and capacity.", tabs: [], features: ["AP down detection", "High latency alerts", "Capacity alerts", "Custom alert thresholds", "Alert history", "Notification channels", "Alert statistics dashboard"], apis: ["/api/wifi/alerts"] },
      { id: "wifi-pre-arrival", title: "Pre-Arrival Delivery", description: "Auto-provision WiFi credentials before guest arrival.", tabs: [], features: ["Auto-provisioning based on reservation data", "Delivery log tracking", "Timing configuration", "Guest notification", "Credential format customization", "Bulk provisioning", "Failure handling"], apis: ["/api/wifi/pre-arrival", "/api/wifi/pre-arrival/delivery-logs"] },
      { id: "wifi-device-management", title: "Multi-Device Registration", description: "Multi-device guest registration and management.", tabs: [], features: ["Multi-device registration", "Device limits per guest", "Device type detection", "Guest device group management", "Auto-cleanup policies"], apis: ["/api/wifi/devices"] },
      { id: "wifi-identity-verification", title: "Identity Verification", description: "Guest identity verification for WiFi access using multiple methods.", tabs: [], features: ["Room-based verification", "OTP SMS verification", "OTP Email verification", "Government ID verification", "Selfie verification", "Verification settings per portal", "Audit log"], apis: ["/api/wifi/identity-logs"] },
      { id: "wifi-consent-management", title: "GDPR Consent", description: "GDPR consent management for WiFi access.", tabs: [], features: ["Consent collection forms", "Consent log storage", "Consent statistics", "Settings per portal", "Guest data export", "Right to deletion support", "Compliance reporting"], apis: ["/api/wifi/consent-logs"] },
      { id: "wifi-bandwidth-upsell", title: "Bandwidth Upsell", description: "Bandwidth upsell monetization with upgrade paths.", tabs: [], features: ["Bandwidth upgrade tiers", "Payment integration", "Upgrade path configuration", "Transaction history", "Analytics dashboard", "Promotional offers", "Free trial support"], apis: ["/api/wifi/bandwidth-upgrade"] },
      { id: "wifi-revenue-dashboard", title: "Revenue Analytics", description: "WiFi revenue tracking and analytics.", tabs: [], features: ["Revenue tracking dashboard", "Upsell revenue breakdown", "Voucher revenue", "Plan revenue", "Trend analysis", "Property comparison"], apis: ["/api/wifi/revenue-dashboard"] },
      { id: "wifi-satisfaction-surveys", title: "Guest Surveys", description: "Guest satisfaction surveys for WiFi quality.", tabs: [], features: ["Survey creation and management", "Auto-trigger after session", "Rating scales", "Comment collection", "Survey analytics", "Response statistics"], apis: ["/api/wifi/satisfaction"] },
      { id: "wifi-sla-monitoring", title: "SLA Monitoring", description: "WiFi service level agreement monitoring.", tabs: [], features: ["SLA configuration per property", "Compliance percentage tracking", "Breach detection and alerting", "SLA metrics (uptime, latency, throughput)", "Available properties management", "Per-metric SLA tracking"], apis: ["/api/wifi/sla", "/api/wifi/sla/compliance"] },
    ]
  },
  {
    id: "revenue", title: "Revenue Management", icon: "TrendingUp",
    category: "addons",
    description: "Revenue management module with dynamic pricing, demand forecasting, competitor pricing, AI suggestions, and rate shopping.",
    items: [
      { id: "revenue-pricing", title: "Dynamic Pricing", description: "Dynamic pricing rule management.", tabs: [], features: ["Dynamic pricing rules", "Rule activation/scheduling", "Rate adjustment triggers", "A/B testing support", "Rate floor/ceiling", "Override capabilities"], apis: ["/api/revenue/pricing-rules"] },
      { id: "revenue-forecasting", title: "Demand Forecasting", description: "AI-powered demand forecasting with seasonal analysis.", tabs: ["Forecast Chart", "Seasonal Trends", "Event Impact", "AI Insights"], features: ["AI-powered demand forecasting", "Seasonal trend analysis", "Event impact modeling", "Historical data analysis", "Confidence intervals", "Export capability"], apis: ["/api/revenue/demand-forecast"] },
      { id: "revenue-competitor", title: "Competitor Pricing", description: "Competitor rate comparison and compset analysis.", tabs: [], features: ["Competitor rate comparison", "Compset (competitive set) management", "Rate parity checking", "Market positioning analysis", "Historical trend data", "Alert on rate changes"], apis: ["/api/revenue/competitor-pricing", "/api/revenue/competitors/sync"] },
      { id: "revenue-ai", title: "AI Suggestions", description: "AI-generated pricing and operational suggestions.", tabs: ["All", "Pricing", "Marketing", "Operations"], features: ["AI pricing recommendations", "Marketing suggestions", "Operational optimization", "Revenue optimization tips", "Actionable insights with confidence scores", "Historical accuracy tracking"], apis: ["/api/revenue/ai-suggestions"] },
      { id: "revenue-rate-shopping", title: "Rate Shopping", description: "Rate shopping across OTAs with market rate comparison.", tabs: [], features: ["OTA rate comparison", "Market rate analysis", "Rate shopping schedules", "Competitor monitoring", "Rate positioning recommendations", "Historical rate data"], apis: ["/api/revenue/rate-shopping", "/api/revenue/rate-shopping/results"] },
    ]
  },
  {
    id: "channels", title: "Channel Manager", icon: "Globe",
    category: "addons",
    description: "Channel manager module with OTA connections, inventory sync, rate sync, booking sync, restrictions, allocations, mapping, parity monitoring, and extensive channel configuration.",
    items: [
      { id: "channel-analytics", title: "Channel Analytics", description: "Channel analytics dashboard with performance, revenue, and commission data.", tabs: [], features: ["Channel performance dashboard", "Revenue by channel", "Commission tracking", "Booking volume analysis", "Conversion rates", "Market share analysis"], apis: ["/api/channels/analytics"] },
      { id: "channel-ota", title: "OTA Connections", description: "OTA connection management with 200+ vendor presets.", tabs: ["Connected", "Marketplace"], features: ["OTA connection management", "200+ vendor presets (Booking.com, Expedia, Airbnb, etc.)", "Connection status monitoring", "API key management", "Channel onboarding wizard", "Connection testing"], apis: ["/api/channels/connections"] },
      { id: "channel-inventory", title: "Inventory Sync", description: "Calendar-based inventory sync with channels.", tabs: [], features: ["Calendar-based inventory sync", "Per-channel allotment", "Bulk sync operations", "Sync status indicators", "Conflict resolution"], apis: ["/api/channels/inventory-sync", "/api/channels/allotment-release"] },
      { id: "channel-rate", title: "Rate Sync", description: "Rate synchronization across all connected channels.", tabs: [], features: ["Multi-channel rate sync", "Rate parity enforcement", "Currency conversion", "Seasonal rate push", "Rate override capability", "Sync scheduling"], apis: ["/api/channels/rate-sync"] },
      { id: "channel-booking", title: "Booking Sync", description: "Booking sync from channels with conflict detection.", tabs: ["All Bookings", "Pending"], features: ["Two-way booking sync", "Conflict detection and resolution", "Booking modification sync", "New booking import", "Status synchronization"], apis: ["/api/channels/booking-sync"] },
      { id: "channel-booking-modifications", title: "Booking Modifications", description: "Modification tracking from channels.", tabs: [], features: ["Modification request tracking", "Auto-accept/reject rules", "Modification history", "Guest notification", "Audit trail"], apis: ["/api/channels/booking-modifications"] },
      { id: "channel-restrictions", title: "Restrictions", description: "Calendar-based restriction management.", tabs: [], features: ["Minimum/maximum stay restrictions", "Closed to arrival/departure", "Length of stay constraints", "Calendar-based management", "Bulk restriction application"], apis: ["/api/channels/restrictions", "/api/channels/stop-sell", "/api/channels/booking-limits"] },
      { id: "channel-stop-sell", title: "Bulk Stop-Sell", description: "Bulk stop-sell across channels.", tabs: [], features: ["Bulk stop-sell by dates and channels", "Quick stop-sell toggle", "Calendar view", "Scheduled stop-sell", "Stop-sell history"], apis: ["/api/channels/stop-sell"] },
      { id: "channel-allocations", title: "Allocations", description: "Room allocation per channel with charts.", tabs: [], features: ["Per-channel room allocation", "Allocation calendar view", "Utilization tracking", "Reallocation capability", "Allocation analytics"], apis: ["/api/channels/allocations", "/api/channels/inventory-pool"] },
      { id: "channel-mapping", title: "Channel Mapping", description: "Room type and rate plan mapping CRUD.", tabs: [], features: ["Room type mapping CRUD", "Rate plan mapping", "Amenity mapping", "Photo mapping", "Bulk mapping import", "Mapping validation"], apis: ["/api/channels/mapping"] },
      { id: "channel-parity", title: "Rate Parity", description: "Rate parity monitoring across channels.", tabs: [], features: ["Rate parity monitoring dashboard", "Parity violation alerts", "Auto-correction rules", "Historical parity data", "Competitor parity check"], apis: ["/api/channel-manager/parity"] },
      { id: "channel-logs", title: "Sync Logs", description: "Sync log viewer with export capability.", tabs: [], features: ["Sync log viewer", "Filter by type/status/channel", "Error log details", "Retry failed syncs", "Export logs", "Timestamp tracking"], apis: ["/api/channels/sync-logs"] },
      { id: "channel-health", title: "Channel Health", description: "Channel health status dashboard.", tabs: [], features: ["Channel connection health", "API response time tracking", "Error rate monitoring", "Last sync timestamp", "Health score calculation", "Alert configuration"], apis: ["/api/channels/health"] },
      { id: "channel-crs", title: "CRS", description: "Central Reservation System connectivity.", tabs: [], features: ["CRS connection management", "Real-time availability push", "Booking retrieval", "Rate distribution", "Inventory updates"], apis: ["/api/channels/crs"] },
      { id: "channel-gds", title: "GDS Connectivity", description: "GDS (Amadeus, Sabre, Galileo) connectivity.", tabs: [], features: ["GDS connection management", "Rate code management", "Booking retrieval", "Inventory distribution", "Multi-GDS support", "Booking pace monitoring"], apis: ["/api/channels/gds", "/api/channels/gds/rate-codes", "/api/channels/gds/bookings"] },
      { id: "channel-rate-derivation", title: "Rate Derivation", description: "Rate derivation rules management.", tabs: [], features: ["Derived rate plan creation", "Parent-child rate relationships", "Markup/markdown rules", "Seasonal adjustments", "Automatic rate calculation"], apis: ["/api/channels/rate-derivation", "/api/channels/derived-rate-plans"] },
      { id: "channel-rate-overrides", title: "Rate Overrides", description: "Rate override management per channel.", tabs: [], features: ["Per-channel rate overrides", "Date-specific overrides", "Override scheduling", "Bulk override operations", "Override history"], apis: ["/api/channels/rate-overrides"] },
      { id: "channel-content-sync", title: "Content Sync", description: "Content sync (photos, descriptions) to channels.", tabs: [], features: ["Hotel information sync", "Photo/media sync", "Room description sync", "Facility sync", "Content scheduling", "Sync status dashboard"], apis: ["/api/channels/content-sync"] },
      { id: "channel-tax-mapping", title: "Tax Mapping", description: "Tax mapping per channel with bulk operations.", tabs: [], features: ["Per-channel tax mapping", "Tax code mapping", "Inclusive/exclusive tax handling", "Bulk tax mapping", "Tax group synchronization"], apis: ["/api/channels/tax-mapping"] },
      { id: "channel-meal-plan", title: "Meal Plan Mapping", description: "Meal plan mapping per channel.", tabs: [], features: ["Meal plan mapping per channel", "Board basis codes (BB, HB, FB, AI)", "Bulk mapping operations", "Channel-specific meal plan codes"], apis: ["/api/channels/meal-plan-mapping"] },
      { id: "channel-virtual-inventory", title: "Virtual Inventory", description: "Virtual inventory pool management.", tabs: [], features: ["Virtual inventory pool creation", "Shared inventory allocation", "Oversell protection", "Pool utilization tracking", "Revenue optimization"], apis: ["/api/channels/virtual-inventory", "/api/channels/inventory-pool"] },
      { id: "channel-currency", title: "Currency Config", description: "Currency configuration per channel.", tabs: [], features: ["Per-channel currency settings", "Exchange rate configuration", "Multi-currency support", "Currency display format"], apis: ["/api/channels/currency"] },
      { id: "channel-settlement", title: "Settlements", description: "Settlement tracking and reconciliation.", tabs: ["All", "Pending", "Received", "Partial", "Disputed"], features: ["Settlement tracking", "Payment reconciliation", "Dispute management", "Settlement history", "Automated settlement matching"], apis: ["/api/channels/settlement"] },
      { id: "channel-allotment-release", title: "Allotment Release", description: "Allotment and release management.", tabs: [], features: ["Allotment management", "Scheduled release rules", "Release calendar", "Utilization tracking", "Reallocation capability"], apis: ["/api/channels/allotment-release"] },
      { id: "channel-promo-codes", title: "Promo Codes", description: "Promotional code management for channels.", tabs: [], features: ["Promo code CRUD", "Discount configuration", "Validity period", "Usage limits", "Channel-specific codes", "Performance tracking"], apis: ["/api/channels/promo-codes"] },
      { id: "channel-booking-pace", title: "Booking Pace", description: "Booking pace analysis with charts.", tabs: [], features: ["Booking pace analysis", "Pace vs prior year comparison", "Pick-up charts", "Forecast accuracy", "Channel-wise breakdown", "Date range analysis"], apis: ["/api/channels/booking-pace"] },
      { id: "channel-priority", title: "Channel Priority", description: "Channel priority and preferred channels configuration.", tabs: [], features: ["Channel priority ranking", "Preferred channel settings", "Auto-routing rules", "Priority-based allocation", "Weight configuration"], apis: ["/api/channels/priority"] },
      { id: "channel-inventory-pool", title: "Inventory Pooling", description: "Pooled inventory across channels.", tabs: [], features: ["Inventory pool creation", "Cross-channel pooling", "Allocation strategy", "Utilization analytics", "Revenue optimization"], apis: ["/api/channels/inventory-pool"] },
      { id: "channel-derived-rates", title: "Derived Rate Plans", description: "Derived rate plan management with rate generator.", tabs: ["Derived Plans", "Rate Generator", "Rate Snapshots"], features: ["Derived rate plan creation", "Automatic rate generation", "Rate snapshot management", "Parent-child relationships", "Markup configuration"], apis: ["/api/channels/derived-rates"] },
      { id: "channel-commission-config", title: "Commission Config", description: "OTA commission rate configuration.", tabs: [], features: ["Per-channel commission rates", "Commission structure (percentage, flat)", "Negotiated rates", "Commission calculation", "Payment tracking"], apis: ["/api/channels/commission-config"] },
      { id: "channel-guest-rates", title: "Guest Rates", description: "Guest-specific rate management.", tabs: [], features: ["Guest-specific rate plans", "Corporate/negotiated rates", "Rate code management", "Guest segment targeting", "Validity configuration"], apis: ["/api/channels/guest-rates"] },
      { id: "channel-booking-limits", title: "Booking Limits", description: "Booking limit rules per channel with bulk operations.", tabs: [], features: ["Per-channel booking limits", "Maximum length of stay", "Maximum advance booking", "Minimum advance booking", "Bulk limit configuration", "Limit scheduling"], apis: ["/api/channels/booking-limits"] },
    ]
  },
  {
    id: "crmMarketing", title: "CRM & Marketing", icon: "Megaphone",
    category: "addons",
    description: "CRM and marketing module covering guest segments, campaigns, loyalty programs, feedback, retention analytics, reputation dashboard, direct booking engine, promotions, upsell, journey campaigns, and abandoned booking recovery.",
    items: [
      { id: "crm-segments", title: "Guest Segments", description: "Guest segmentation builder with multi-condition rules.", tabs: [], features: ["Segment builder with condition operators", "Multi-condition rules (Equals, Greater Than, Between, Contains)", "Dynamic segment population", "Segment analytics", "Export capability", "Campaign targeting integration"], apis: ["/api/segments"] },
      { id: "crm-campaigns", title: "Campaigns", description: "Multi-channel campaign management with performance tracking.", tabs: [], features: ["Multi-channel campaigns (Email, SMS, Push, WhatsApp)", "Campaign creation and scheduling", "Audience targeting from segments", "A/B testing", "Performance analytics (open rate, click rate, conversion)", "Template library", "Campaign cloning"], apis: ["/api/campaigns"] },
      { id: "crm-loyalty", title: "Loyalty Programs", description: "Loyalty program configuration with points management and tier rules.", tabs: ["Tier Levels", "Points Ledger", "Redemption Options", "Top Members"], features: ["Loyalty program configuration", "Tier level management (Bronze, Silver, Gold, Platinum)", "Points earning rules", "Points redemption catalog", "Top members leaderboard", "Tier upgrade/downgrade rules", "Expiry management"], apis: ["/api/loyalty/programs", "/api/loyalty/tiers", "/api/loyalty/points"] },
      { id: "crm-feedback", title: "Feedback & Reviews", description: "Review management and guest feedback tracking.", tabs: ["Reviews", "Guest Feedback"], features: ["Review aggregation from platforms", "Guest feedback collection", "Response management", "Sentiment analysis", "Rating trend charts", "Review response templates"], apis: ["/api/crm/feedback", "/api/reputation/reviews", "/api/reputation/sentiment"] },
      { id: "crm-retention", title: "Retention Analytics", description: "Retention analytics with cohort analysis and LTV calculation.", tabs: ["Overview", "Cohort Analysis", "At-Risk Guests", "Lifetime Value"], features: ["Guest retention rate tracking", "Cohort analysis", "Churn prediction", "Lifetime value (LTV) calculation", "At-risk guest identification", "Retention strategy recommendations"], apis: [] },
      { id: "marketing-reputation", title: "Reputation Dashboard", description: "Reputation score tracking with review aggregation.", tabs: [], features: ["Reputation score tracking", "Multi-platform review aggregation", "Rating trends", "Response rate monitoring", "Competitor comparison", "Review volume analytics"], apis: ["/api/reputation/reviews", "/api/reputation/aggregation"] },
      { id: "marketing-sources", title: "Review Sources", description: "Review source management with platform integration.", tabs: [], features: ["Review source CRUD", "Platform integration (Google, TripAdvisor, Booking.com)", "Source credibility scoring", "Review import scheduling", "Source performance metrics"], apis: ["/api/reputation/reviews"] },
      { id: "marketing-booking-engine", title: "Direct Booking Engine", description: "Direct booking engine configuration with widget customization.", tabs: ["Overview", "Settings", "Appearance", "Integration"], features: ["Booking engine widget customization", "Property selection integration", "Rate display", "Availability calendar", "Booking form design", "Payment integration", "Analytics dashboard", "SEO optimization"], apis: ["/api/booking-engine/*"] },
      { id: "marketing-promotions", title: "Promotions & Offers", description: "Promotion management with scheduling and status tracking.", tabs: ["All Promotions", "Active", "Scheduled", "Expired"], features: ["Promotion CRUD", "Scheduling", "Status tracking", "Discount configuration", "Applicability rules", "Performance analytics", "Promo code generation"], apis: ["/api/marketing/promotions"] },
      { id: "marketing-upsell", title: "Upsell Engine", description: "Upsell offer management with conversion tracking.", tabs: [], features: ["Upsell offer creation", "Pre-arrival upsell", "In-stay upsell", "Conversion tracking", "Revenue attribution", "A/B testing", "Offer scheduling"], apis: ["/api/marketing/upsell/offers", "/api/marketing/upsell/campaigns"] },
      { id: "marketing-journey-campaigns", title: "Journey Campaigns", description: "Journey-based campaign management.", tabs: [], features: ["Journey campaign creation", "Multi-touchpoint campaigns", "Trigger-based automation", "Guest lifecycle journeys", "Performance tracking", "Campaign templates"], apis: ["/api/marketing/journeys"] },
      { id: "marketing-abandoned-bookings", title: "Abandoned Bookings", description: "Abandoned booking recovery with funnel visualization.", tabs: [], features: ["Abandoned booking detection", "Recovery email sequences", "Funnel visualization", "Conversion tracking", "Recovery rate analytics", "Auto-retry rules"], apis: ["/api/marketing/abandoned-bookings", "/api/marketing/abandoned-bookings/recover"] },
    ]
  },
  {
    id: "ads", title: "Digital Advertising", icon: "Volume2",
    category: "addons",
    description: "Digital advertising module with ad campaigns, Google Hotel Ads, performance tracking, and ROI analytics.",
    items: [
      { id: "ads-campaigns", title: "Ad Campaigns", description: "Ad campaign management across platforms (Google, Meta, TripAdvisor, Trivago).", tabs: [], features: ["Multi-platform ad campaigns", "Campaign creation and scheduling", "Budget management", "Targeting configuration", "Creative management", "Performance metrics", "Platform-specific optimization"], apis: ["/api/ads/campaigns"] },
      { id: "ads-google", title: "Google Hotel Ads", description: "Google Hotel Ads management.", tabs: [], features: ["Google Hotel Ads integration", "Hotel feed management", "Bid strategy configuration", "Performance metrics", "Budget optimization", "Campaign analytics"], apis: ["/api/ads/google"] },
      { id: "ads-performance", title: "Performance Tracking", description: "Ad performance analytics with trend and conversion views.", tabs: ["Trend", "Comparison", "Conversions"], features: ["Performance trend charts", "Cross-campaign comparison", "Conversion funnel analysis", "ROI metrics", "Cost per acquisition tracking", "Click-through rates"], apis: ["/api/ads/performance"] },
      { id: "ads-roi", title: "ROI Analytics", description: "ROI analytics with spend vs revenue and ROAS tracking.", tabs: [], features: ["Spend vs revenue analysis", "Return on ad spend (ROAS)", "Cost per booking", "Revenue per ad dollar", "Platform comparison", "Historical trend analysis"], apis: ["/api/ads/performance"] },
    ]
  },
  {
    id: "reports", title: "Reports & BI", icon: "BarChart3",
    category: "addons",
    description: "Reports and BI module with revenue, occupancy, ADR/RevPAR, guest analytics, staff performance, and scheduled reports.",
    items: [
      { id: "reports-revenue", title: "Revenue Reports", description: "Revenue reports with calendar view, charts, and export.", tabs: [], features: ["Revenue reports by period", "Revenue breakdown (room, F&B, spa, etc.)", "Calendar view", "Trend charts", "Comparison with prior periods", "Export (PDF, CSV)"], apis: ["/api/reports/revenue"] },
      { id: "reports-occupancy", title: "Occupancy Reports", description: "Occupancy reports with charts and export.", tabs: [], features: ["Occupancy rate reports", "Occupancy by room type", "Occupancy trend analysis", "Forecast vs actual", "Date range filtering", "Export"], apis: ["/api/reports/occupancy"] },
      { id: "reports-adr", title: "ADR / RevPAR", description: "ADR and RevPAR reports with charts and export.", tabs: [], features: ["Average Daily Rate (ADR) reports", "Revenue Per Available Room (RevPAR)", "Trend analysis", "Market comparison", "GOPPAR tracking", "Export"], apis: [] },
      { id: "reports-guests", title: "Guest Analytics", description: "Guest analytics with demographic and booking pattern analysis.", tabs: ["Overview", "Demographics", "Booking Patterns", "Revenue"], features: ["Guest demographics analysis", "Booking pattern analysis", "Revenue per guest", "Guest source analysis", "Loyalty impact", "Geographic distribution"], apis: [] },
      { id: "reports-staff", title: "Staff Performance", description: "Staff performance reports with metrics and export.", tabs: [], features: ["Staff performance metrics", "Productivity reports", "Task completion rates", "Attendance summaries", "Skill utilization", "Revenue attribution", "Export"], apis: ["/api/reports"] },
      { id: "reports-scheduled", title: "Scheduled Reports", description: "Scheduled report management with history.", tabs: ["Scheduled", "History"], features: ["Report scheduling (daily, weekly, monthly)", "Recipient management", "Report templates", "Delivery channels (email, download)", "Execution history", "Success/failure tracking", "Print support"], apis: ["/api/reports/scheduled"] },
    ]
  },
  {
    id: "staffManagement", title: "Staff Management", icon: "UserCog",
    category: "addons",
    description: "Staff management module with shift scheduling, attendance tracking, leave management, task assignment, internal communication, performance metrics, skills/certifications, and payroll.",
    items: [
      { id: "staff-shifts", title: "Shift Scheduling", description: "Shift scheduling calendar with attendance integration.", tabs: ["Schedule", "Attendance"], features: ["Shift scheduling calendar", "Shift template management", "Staff availability tracking", "Attendance integration", "Shift swap requests", "Overtime calculation", "Print schedules"], apis: ["/api/staff/shifts", "/api/staff/shifts/:id"] },
      { id: "staff-attendance", title: "Attendance Tracking", description: "Clock-in/out tracking with attendance history.", tabs: ["Today's Attendance", "History"], features: ["Clock-in/clock-out tracking", "Geolocation verification", "Attendance history", "Late arrival detection", "Early departure detection", "Export attendance data", "Daily summary"], apis: ["/api/staff/attendance"] },
      { id: "staff-leave", title: "Leave Management", description: "Leave request/approval workflow with leave calendar.", tabs: ["Leave Requests", "Calendar View"], features: ["Leave request creation", "Approval workflow", "Leave balance tracking", "Leave calendar view", "Leave type management (Casual, Sick, Vacation, etc.)", "Holiday calendar", "Overlapping leave prevention"], apis: ["/api/staff/leave"] },
      { id: "staff-tasks", title: "Task Assignment", description: "Task assignment and tracking with priority management.", tabs: ["All Tasks", "My Tasks", "Unassigned", "Overdue"], features: ["Task creation and assignment", "Priority management (Low, Medium, High, Urgent)", "Due date tracking", "Task status workflow", "Recurring tasks", "Task comments", "Completion verification"], apis: ["/api/staff/tasks", "/api/staff/tasks/:id"] },
      { id: "staff-communication", title: "Internal Communication", description: "Internal messaging and announcement board.", tabs: [], features: ["Staff messaging", "Announcement board", "Department channels", "File sharing", "Message search", "Read receipts", "Pinned messages"], apis: ["/api/staff/channels"] },
      { id: "staff-performance", title: "Performance Metrics", description: "Staff performance metrics with KPI tracking.", tabs: [], features: ["KPI tracking dashboard", "Performance trend charts", "Department comparison", "Individual scorecards", "Goal tracking", "Peer comparison", "Performance improvement suggestions"], apis: ["/api/staff/performance"] },
      { id: "staff-skills", title: "Skills & Certifications", description: "Staff skills matrix with certification tracking.", tabs: [], features: ["Skills matrix management", "Certification tracking", "Expiration alerts", "Training history", "Skill gap analysis", "Department-wise skills inventory", "Certification renewal reminders"], apis: ["/api/staff/skills"] },
      { id: "staff-payroll", title: "Payroll", description: "Full payroll management with salary structures, tax compliance, and payslip generation.", tabs: ["Payroll", "Salary Structure", "Attendance", "Compliance", "Calendar"], features: ["Payroll processing", "Salary structure management", "Attendance-based pay calculation", "Tax compliance (TDS, PF, ESI)", "Payslip generation", "Batch processing", "Statutory reports", "Print payslips", "Approval workflow"], apis: ["/api/staff/payroll", "/api/staff/payroll/process", "/api/staff/payroll/payslips/:id", "/api/staff/payroll/compliance"] },
    ]
  },
  {
    id: "securityIot", title: "Security & IoT", icon: "Shield",
    category: "addons",
    description: "Security and IoT module covering surveillance (cameras, live view, playback), IoT device management, room controls, energy dashboard, and security center (overview, audit logs, 2FA, sessions, SSO).",
    items: [
      { id: "security-cameras", title: "Camera Management", description: "Surveillance camera CRUD with status management.", tabs: [], features: ["Camera CRUD", "Camera group management", "Status monitoring", "PTZ control support", "Recording configuration", "Snapshot capture", "Multi-vendor support"], apis: ["/api/security/cameras", "/api/security/camera-groups"] },
      { id: "security-live", title: "Live Camera View", description: "Live camera feed with real-time monitoring.", tabs: [], features: ["Real-time camera feed", "Multi-camera grid view", "PTZ control", "Fullscreen mode", "Screenshot capture", "Audio support"], apis: ["/api/security/cameras/:id/recordings"] },
      { id: "security-playback", title: "Camera Playback", description: "Camera playback with timeline and export.", tabs: [], features: ["Timeline-based playback", "Date/time search", "Event marker navigation", "Video export (MP4)", "Speed control (0.5x to 16x)", "Snapshot export"], apis: ["/api/security/cameras/:id/recordings"] },
      { id: "security-alerts", title: "Event Alerts", description: "Security event log with filtering.", tabs: [], features: ["Security event logging", "Event type filtering", "Severity-based alerts", "Real-time alert stream", "Alert acknowledgment", "Alert history"], apis: ["/api/security/events"] },
      { id: "security-incidents", title: "Incident Logs", description: "Incident management CRUD.", tabs: [], features: ["Incident report creation", "Severity classification", "Investigation tracking", "Resolution workflow", "Evidence attachment", "Report generation", "Incident statistics"], apis: ["/api/security/incidents"] },
      { id: "surveillance-settings", title: "Surveillance Settings", description: "Surveillance system settings.", tabs: [], features: ["Camera default settings", "Recording policies", "Storage management", "Retention policies", "Alert thresholds", "System health monitoring"], apis: ["/api/security/surveillance-config"] },
      { id: "iot-devices", title: "Device Management", description: "IoT device registry with status monitoring.", tabs: [], features: ["IoT device registry CRUD", "Device status monitoring", "Device category management (thermostats, lights, locks, sensors)", "Firmware update tracking", "Battery level monitoring", "Offline detection", "Bulk operations"], apis: ["/api/iot/devices", "/api/iot/devices/realtime", "/api/iot/devices/:id"] },
      { id: "iot-controls", title: "Room Controls", description: "Room IoT control panel with device category tabs.", tabs: ["All Devices", "Climate", "Lighting", "Security", "Entertainment"], features: ["Temperature control", "Lighting control (scenes, dimmers)", "Smart lock control", "Entertainment system control", "Curtain/blind control", "Scene presets", "Real-time status updates", "Energy optimization"], apis: ["/api/iot/devices/:id/command"] },
      { id: "iot-energy", title: "Energy Dashboard", description: "Energy consumption analytics with cost tracking.", tabs: ["Consumption Trends", "Cost Breakdown", "By Property"], features: ["Energy consumption trends", "Cost breakdown analytics", "Property comparison", "Savings identification", "Carbon footprint tracking", "Peak demand analysis", "Export reports"], apis: ["/api/iot/energy"] },
      { id: "security-overview", title: "Security Overview", description: "Security status dashboard.", tabs: [], features: ["Security status dashboard", "Active alerts summary", "Camera status overview", "Incident statistics", "Compliance score", "Recent activity feed"], apis: ["/api/security/events"] },
      { id: "security-audit-logs", title: "Audit Logs", description: "Comprehensive audit log with charts, export, and pagination.", tabs: [], features: ["Comprehensive audit log", "User action tracking", "Filterable by action type/user/date", "Export capability", "Pagination", "Charts and visualization", "Compliance reporting"], apis: ["/api/audit-logs"] },
      { id: "security-2fa", title: "Two-Factor Auth", description: "Two-factor authentication setup and management.", tabs: [], features: ["2FA enrollment (TOTP)", "Backup codes generation", "2FA enforcement settings", "Recovery options", "Per-user 2FA configuration", "Authentication app integration"], apis: ["/api/auth/2fa/setup", "/api/auth/2fa/verify", "/api/auth/2fa/disable"] },
      { id: "security-sessions", title: "Device Sessions", description: "Active device session management with revoke capability.", tabs: [], features: ["Active session list", "Device information (browser, OS, IP)", "Session duration", "Remote session revoke", "Login history", "Suspicious session detection", "Concurrent session limits"], apis: ["/api/auth/sessions"] },
      { id: "security-sso", title: "SSO Configuration", description: "SSO provider configuration.", tabs: [], features: ["SSO provider configuration (Google, Microsoft, Okta, SAML, OIDC)", "Identity provider setup", "Attribute mapping", "Just-in-time provisioning", "Domain whitelist", "Login flow customization", "Connection testing"], apis: ["/api/auth/sso/connections", "/api/auth/sso/oidc/:connectionId/callback", "/api/auth/sso/saml/:connectionId/acs"] },
    ]
  },
  {
    id: "integrations", title: "Integrations", icon: "Plug",
    category: "addons",
    description: "Integrations module with payment gateways, SMS gateways, POS systems, smart locks, payment terminals, mobile app, hardware adapters, webhook events, delivery logs, and retry queue.",
    items: [
      { id: "integrations-payments", title: "Payment Gateways", description: "Payment gateway configuration (Stripe, PayPal, Razorpay, etc.).", tabs: [], features: ["Payment gateway configuration", "API key management", "Webhook endpoint setup", "Test mode support", "Multi-gateway support", "Connection testing", "Transaction history"], apis: ["/api/integrations/payment-gateways", "/api/webhooks/stripe", "/api/webhooks/razorpay", "/api/webhooks/paypal"] },
      { id: "integrations-sms", title: "SMS Gateways", description: "SMS gateway management with bulk messaging.", tabs: [], features: ["SMS gateway configuration", "Provider support (Twilio, Vonage, etc.)", "Template management", "Bulk messaging", "Delivery tracking", "Two-way messaging", "Message scheduling", "Delivery reports"], apis: ["/api/integrations/sms-gateways"] },
      { id: "integrations-pos", title: "POS Systems", description: "POS system integration configuration.", tabs: [], features: ["POS system integration", "Menu synchronization", "Order synchronization", "Payment posting", "Multi-POS support", "Connection testing", "Data mapping configuration"], apis: ["/api/integrations/pos-systems", "/api/integrations/pos-systems/:id/sync"] },
      { id: "integrations-apis", title: "Third-party APIs", description: "Third-party API management with category filtering.", tabs: [], features: ["Third-party API management", "Category-based organization (Mapping, Communication, Data, Payment, Analytics)", "API key management", "Request/response logging", "Usage tracking", "Rate limiting configuration"], apis: ["/api/integrations/third-party-apis"] },
      { id: "integrations-smart-locks", title: "Smart Locks", description: "Smart lock provider management.", tabs: ["Lock Providers", "Lock Status", "Access Logs", "Key Card Encoding"], features: ["Multi-provider support (ASSA ABLOY, SALTO KS, Dormakaba)", "Lock status monitoring", "Access log tracking", "Key card encoding", "Remote lock/unlock", "Battery level monitoring", "Offline access support"], apis: ["/api/integrations/smart-locks", "/api/integrations/smart-locks/locks", "/api/integrations/smart-locks/access-logs"] },
      { id: "integrations-terminals", title: "Payment Terminals", description: "Payment terminal management with P2PE compliance.", tabs: ["Terminal Registry", "Transactions", "P2PE Status", "Tokenization"], features: ["Terminal registry", "Transaction processing", "P2PE compliance monitoring", "Tokenization management", "Terminal health monitoring", "Receipt printing", "Batch operations"], apis: ["/api/integrations/terminals", "/api/integrations/terminals/terminals", "/api/integrations/terminals/transactions"] },
      { id: "integrations-mobile-app", title: "Mobile App", description: "Mobile app management with device registry.", tabs: ["Guest App", "Staff App", "Push Notifications", "App Versions"], features: ["Guest app management", "Staff app management", "Push notification configuration", "Device registry", "Version management", "Feature flags per platform", "Crash analytics integration"], apis: ["/api/integrations/mobile-app"] },
      { id: "integrations-hardware-adapters", title: "Hardware Adapters", description: "Hardware adapter management with multi-provider support.", tabs: ["Overview", "Lock Providers", "Terminal Providers", "Operation Logs", "Webhook Status"], features: ["Multi-provider adapter management", "Lock provider integration", "Terminal provider integration", "Operation log tracking", "Webhook status monitoring", "Health checks", "Auto-discovery"], apis: ["/api/hardware/adapters", "/api/hardware/health", "/api/hardware/webhooks/:providerId"] },
      { id: "webhooks-events", title: "Webhook Events", description: "Webhook event subscription management.", tabs: [], features: ["Event subscription management", "Event filtering", "Payload inspection", "Webhook endpoint configuration", "Event replay capability", "Delivery status tracking"], apis: ["/api/webhooks/events"] },
      { id: "webhooks-delivery", title: "Webhook Delivery Logs", description: "Webhook delivery log viewer.", tabs: [], features: ["Delivery log viewer", "Success/failure status", "Response code tracking", "Retry capability", "Timestamp filtering", "Detailed payload inspection"], apis: ["/api/webhooks/delivery"] },
      { id: "webhooks-retry", title: "Webhook Retry Queue", description: "Failed webhook retry queue management.", tabs: [], features: ["Failed webhook queue", "Manual retry", "Auto-retry configuration", "Retry history", "Retry limit settings", "Queue priority management"], apis: ["/api/webhooks/retry-queue"] },
    ]
  },
  {
    id: "automationAi", title: "Automation & AI", icon: "Bot",
    category: "addons",
    description: "Automation and AI module covering workflow builder, rules engine, templates, execution logs, AI copilot, AI insights, conversational analytics, and provider settings.",
    items: [
      { id: "automation-workflows", title: "Workflow Builder", description: "Visual workflow builder with trigger, condition, and action nodes.", tabs: [], features: ["Visual workflow builder (drag-and-drop nodes)", "Event triggers (Booking Created, Check-in, Check-out, etc.)", "Condition branching", "Action nodes (Send Email, SMS, Update Status, etc.)", "Workflow templates", "Execution scheduling", "Active/inactive toggle", "Execution monitoring"], apis: ["/api/automation/rules"] },
      { id: "automation-rules", title: "Rules Engine", description: "Automation rules engine with rule CRUD.", tabs: [], features: ["Rule creation and management", "Rule conditions (IF-THEN logic)", "Rule actions", "Rule scheduling", "Enable/disable toggle", "Execution counter", "Last execution timestamp"], apis: ["/api/automation/rules"] },
      { id: "automation-templates", title: "Templates", description: "Pre-built automation templates for one-click activation.", tabs: [], features: ["Pre-built template library", "One-click activation", "Template customization", "Category-based organization", "Template usage statistics", "Community templates"], apis: ["/api/automation/rules"] },
      { id: "automation-logs", title: "Execution Logs", description: "Automation execution history with status tracking.", tabs: [], features: ["Execution history log", "Status tracking (Success, Failed, Skipped)", "Error details", "Execution duration", "Filterable by rule/workflow/date", "Retry capability"], apis: ["/api/automation/execution-logs"] },
      { id: "ai-copilot", title: "AI Copilot", description: "AI assistant chat interface with conversation history.", tabs: [], features: ["AI chat interface", "Multi-turn conversations", "Context-aware responses", "Hotel operations knowledge", "Conversation history", "Suggested actions", "Quick action buttons"], apis: ["/api/ai/copilot", "/api/ai/conversations"] },
      { id: "ai-insights", title: "AI Insights", description: "AI-generated insights dashboard.", tabs: [], features: ["AI-generated operational insights", "Revenue optimization tips", "Guest satisfaction analysis", "Operational efficiency recommendations", "Trend prediction", "Anomaly detection"], apis: ["/api/ai/insights", "/api/ai/feedback"] },
      { id: "ai-conversational-analytics", title: "Conversational Analytics", description: "Natural language query interface for analytics.", tabs: ["Saved Queries", "Recent History", "Analytics Gallery"], features: ["Natural language query interface", "Query-to-chart conversion", "Saved queries library", "Query history", "Analytics gallery with templates", "Export results"], apis: ["/api/ai/analytics/query", "/api/ai/analytics/saved", "/api/ai/analytics"] },
      { id: "ai-settings", title: "Provider Settings", description: "AI provider configuration (API keys, model selection).", tabs: [], features: ["AI provider configuration (OpenAI, Google, Anthropic, etc.)", "API key management", "Model selection", "Temperature and token settings", "Usage limits", "Cost monitoring", "Provider testing", "Fallback provider configuration"], apis: ["/api/ai/provider-settings"] },
    ]
  },
  {
    id: "notifications", title: "Notifications", icon: "Bell",
    category: "addons",
    description: "Notifications module with templates, delivery logs, and channel settings.",
    items: [
      { id: "notifications-templates", title: "Templates", description: "Multi-channel notification template management.", tabs: ["All", "Email", "SMS", "Push", "In-App"], features: ["Multi-channel template management", "Visual template editor", "Variable substitution", "Template categories", "A/B testing", "Delivery analytics", "Template cloning", "Localization support"], apis: ["/api/notifications/templates"] },
      { id: "notifications-logs", title: "Delivery Logs", description: "Notification delivery log viewer.", tabs: [], features: ["Delivery log viewer", "Status tracking (Sent, Delivered, Failed, Bounced)", "Recipient information", "Timestamp tracking", "Error details", "Retry capability"], apis: ["/api/notifications/delivery-logs"] },
      { id: "notifications-settings", title: "Channel Settings", description: "Notification preferences configuration.", tabs: [], features: ["Channel preference configuration", "Per-guest notification settings", "Quiet hours setup", "Urgency-based routing", "Delivery rate optimization", "Bounce handling rules"], apis: ["/api/notifications/settings"] },
    ]
  },
  {
    id: "platformAdmin", title: "Platform Admin", icon: "Crown",
    category: "addons",
    description: "Platform administration module covering tenant management, lifecycle, roles/permissions, user management, usage tracking, revenue analytics, system health, SaaS plans/subscriptions, chain management (brands, dashboard, cross-property analytics), and platform settings (feature flags, license management, license keys).",
    items: [
      { id: "admin-tenants", title: "Tenant Management", description: "Multi-tenant management with CRUD operations.", tabs: [], features: ["Tenant CRUD", "Plan assignment", "Status management (Trial, Active, Suspended, Terminated)", "Usage limit configuration", "Contact information", "Tenant search and filter", "Bulk operations"], apis: ["/api/admin/tenants"] },
      { id: "admin-lifecycle", title: "Tenant Lifecycle", description: "Tenant lifecycle management (Trial > Active > Suspended).", tabs: [], features: ["Lifecycle stage tracking", "Automated stage transitions", "Trial-to-active conversion", "Suspension rules", "Reactivation workflow", "Deactivation and data retention", "Lifecycle analytics"], apis: ["/api/admin/tenants"] },
      { id: "admin-roles", title: "Roles & Permissions", description: "RBAC role and permission management.", tabs: [], features: ["Role CRUD", "Permission assignment per role", "Built-in role templates (Admin, Manager, Front Desk, Housekeeping, etc.)", "Custom role creation", "Permission group management", "Role assignment to users", "Audit trail"], apis: ["/api/roles"] },
      { id: "admin-users", title: "User Management", description: "User management with role assignment.", tabs: [], features: ["User CRUD", "Role assignment", "Status management (Active, Inactive, Suspended)", "Multi-property access", "Authentication method", "2FA enforcement", "Activity logging", "Bulk user operations"], apis: ["/api/users", "/api/users/:id"] },
      { id: "admin-usage", title: "Usage Tracking", description: "System usage analytics dashboard.", tabs: [], features: ["API usage metrics", "Resource consumption", "Per-tenant usage", "Usage trends", "Quota monitoring", "Capacity planning data", "Usage alerts"], apis: ["/api/admin/usage", "/api/admin/usage/init"] },
      { id: "admin-revenue", title: "Revenue Analytics", description: "Revenue analytics dashboard.", tabs: [], features: ["MRR and ARR tracking", "Revenue trends", "Churn analysis", "Revenue by plan", "Revenue by geography", "Expansion revenue", "Forecast accuracy"], apis: ["/api/admin/revenue"] },
      { id: "admin-health", title: "System Health", description: "System health monitoring with uptime tracking.", tabs: [], features: ["Uptime monitoring", "Response time tracking", "Error rate monitoring", "Service dependency status", "Database health", "Infrastructure metrics", "Alert rules", "Health score calculation"], apis: ["/api/admin/system-health", "/api/system-health"] },
      { id: "saas-plans", title: "SaaS Plans", description: "Subscription plan management with pricing tiers.", tabs: [], features: ["Plan CRUD", "Pricing tier configuration", "Feature inclusion per plan", "Billing cycle options", "Trial configuration", "Plan comparison matrix", "Plan migration support"], apis: ["/api/admin/plans", "/api/admin/billing/plans"] },
      { id: "saas-subscriptions", title: "SaaS Subscriptions", description: "Subscription management with plan upgrades/downgrades.", tabs: [], features: ["Subscription management", "Plan upgrade/downgrade", "Billing cycle management", "Payment method management", "Subscription history", "Auto-renewal configuration", "Cancellation workflow"], apis: ["/api/admin/billing/subscriptions"] },
      { id: "saas-usage", title: "SaaS Usage Billing", description: "Usage-based billing metrics.", tabs: ["API Breakdown", "Daily Usage", "Billing Details"], features: ["API usage metering", "Daily usage tracking", "Usage billing calculation", "Overage charges", "Usage trends", "Per-tenant breakdown", "Billing alerts"], apis: ["/api/admin/usage-billing"] },
      { id: "chain-brands", title: "Brand Management", description: "Brand management for multi-property chains.", tabs: [], features: ["Brand CRUD", "Logo and branding", "Brand standards", "Multi-property branding", "Brand guidelines", "Brand compliance monitoring"], apis: ["/api/brands", "/api/brands/:id"] },
      { id: "chain-dashboard", title: "Chain Dashboard", description: "Chain-level dashboard with multi-property overview.", tabs: [], features: ["Chain-level KPI dashboard", "Multi-property overview", "Property comparison", "Aggregate metrics", "Chain revenue summary", "Brand performance", "Occupancy overview"], apis: ["/api/chain/dashboard"] },
      { id: "chain-analytics", title: "Cross-Property Analytics", description: "Cross-property analytics with brand comparison.", tabs: ["Overview", "By Property", "By Brand", "Trends"], features: ["Cross-property revenue analytics", "Brand performance comparison", "Property ranking", "Trend analysis", "Market segment comparison", "Geographic analysis"], apis: ["/api/chain/analytics"] },
      { id: "settings-features", title: "Feature Flags", description: "Feature flag management for enabling/disabling modules.", tabs: ["All", "Base", "Addons"], features: ["Feature flag management", "Base module protection (cannot disable)", "Addon module toggling", "Per-tenant configuration", "Feature dependency management", "Feature usage analytics", "Plan-based defaults"], apis: ["/api/settings/feature-flags"] },
      { id: "settings-license", title: "License Management", description: "License management with usage tracking.", tabs: [], features: ["License overview", "Entitlement management with edit", "Usage history chart", "Base limits display (tenant)", "Enabled modules by subcategory", "Contact admin footer (tenant)", "Usage refresh"], apis: ["/api/license/overview", "/api/license/entitlements", "/api/license/usage/history", "/api/license/usage/refresh"] },
      { id: "settings-license-keys", title: "License Keys", description: "License key management with bulk operations.", tabs: [], features: ["License key CRUD", "Bulk operations", "Key generation", "Activation/deactivation", "Key expiration tracking", "Key transfer", "Assignment management", "Search and filter", "Export"], apis: ["/api/admin/license-keys", "/api/admin/license-keys/generate", "/api/admin/license-keys/:id"] },
    ]
  },
  {
    id: "settings", title: "Settings", icon: "Settings",
    category: "base",
    description: "System settings module with general settings, tax & currency, localization, GDPR compliance, security settings, and system integrations.",
    items: [
      { id: "settings-general", title: "General Settings", description: "General hotel/property settings.", tabs: [], features: ["Property name and contact details", "Address and timezone", "Language and currency defaults", "Business hours", "Logo and branding", "Notification preferences", "Default check-in/check-out times", "Property type configuration"], apis: ["/api/settings/general"] },
      { id: "settings-tax", title: "Tax & Currency", description: "Tax and currency configuration.", tabs: [], features: ["Tax rate configuration", "Currency selection", "Exchange rate management", "Tax grouping", "Tax-exempt categories", "Real-time exchange rate updates", "Multi-currency settings", "Fiscal year configuration"], apis: ["/api/settings/tax-currency"] },
      { id: "settings-localization", title: "Localization", description: "Language/locale settings with date/time formats.", tabs: [], features: ["Language selection (15+ languages)", "Date format configuration", "Time zone settings", "Number format (decimal separator, grouping, currency position)", "Calendar type (Gregorian, Islamic, etc.)", "Measurement system (Metric, Imperial)"], apis: ["/api/settings/localization"] },
      { id: "settings-gdpr", title: "GDPR Compliance", description: "GDPR compliance management with data subject requests.", tabs: ["Overview", "Requests", "Consent", "Actions"], features: ["GDPR overview dashboard", "Data subject request management (access, deletion, portability)", "Consent tracking", "Data processing records", "Data action audit trail", "Compliance reporting", "Auto-response rules", "DPO contact configuration"], apis: ["/api/gdpr/export", "/api/gdpr/consent", "/api/gdpr/delete", "/api/gdpr/anonymize", "/api/gdpr/status"] },
      { id: "settings-security", title: "Security Settings", description: "Security policy configuration.", tabs: [], features: ["Password policy (length, complexity, expiration)", "Session timeout settings", "IP whitelist", "Login attempt limits", "Two-factor authentication enforcement", "API rate limiting", "Audit log retention", "Encryption settings", "CORS configuration"], apis: ["/api/settings/security"] },
      { id: "settings-integrations", title: "System Integrations", description: "System integration configuration.", tabs: [], features: ["Integration registry", "Third-party service connections", "API key management", "Connection status monitoring", "Data flow configuration", "Integration documentation", "Health check endpoints", "Webhook configuration"], apis: ["/api/settings/integrations"] },
    ]
  },
  {
    id: "helpSupport", title: "Help & Support", icon: "GraduationCap",
    category: "base",
    description: "Help and support module with help center, articles library, and tutorial progress tracking.",
    items: [
      { id: "help-center", title: "Help Center", description: "Help center landing page with categories, search, and progress tracking.", tabs: [], features: ["Help center landing page", "Category browsing", "Search functionality", "Tutorial progress tracking", "Quick start guides", "FAQ section", "Contact support link"], apis: ["/api/help/articles"] },
      { id: "help-articles", title: "Articles", description: "Article library with categories, sorting, and CRUD.", tabs: [], features: ["Article library", "Category management", "Full-text search", "Article CRUD with rich text editor", "Version history", "Sorting (popularity, date, title)", "Status management (Draft, Published, Archived)"], apis: ["/api/help/articles", "/api/help/articles/:id"] },
      { id: "help-tutorials", title: "Tutorial Progress", description: "Tutorial progress tracking with completion analytics.", tabs: [], features: ["Tutorial catalog", "Progress tracking per tutorial", "Completion percentage", "Learning path recommendations", "Achievement badges", "Time spent tracking", "Export progress report"], apis: ["/api/tutorials/progress"] },
    ]
  },
];

// ────────────────────────────────────────────────────────
// BUILD DOCUMENT
// ────────────────────────────────────────────────────────
async function main() {
  const pgSize = { width: 11906, height: 16838 };
  const pgMargin = { top: 1440, bottom: 1440, left: 1440, right: 1440 };

  // ── SECTION 1: COVER (margin 0) ──
  const coverChildren = buildCoverR1({
    title: "StaySuite HospitalityOS",
    subtitle: "Product Features Document",
    englishLabel: "HOSPITALITY OPERATING SYSTEM",
    metaLines: ["Version 2.0 | Page-by-Page Feature Reference"],
    footerLeft: "Confidential",
    footerRight: "StaySuite Technologies",
    palette: {
      bg: palette.bg,
      titleColor: P.titleColor,
      subtitleColor: P.subtitleColor,
      metaColor: P.metaColor,
      footerColor: P.footerColor,
      accent: palette.accent,
    },
  });

  // ── SECTION 2: TOC (Roman page numbers) ──
  const tocChildren = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 480, after: 360 },
      children: [
        new TextRun({
          text: "Table of Contents",
          bold: true,
          size: 36,
          color: PRIMARY_DARK,
          font: { ascii: "Calibri", eastAsia: "Calibri" },
        }),
      ],
    }),
    new TableOfContents("Table of Contents", {
      hyperlink: true,
      headingStyleRange: "1-2",
    }),
    new Paragraph({
      spacing: { before: 200 },
      children: [
        new TextRun({
          text: 'Note: This Table of Contents is generated via field codes. To ensure page number accuracy after editing, please right-click the TOC and select "Update Field."',
          italics: true,
          size: 18,
          color: "888888",
          font: FONT,
        }),
      ],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  ];

  // ── SECTION 3: BODY (Arabic page numbers starting at 1) ──
  const bodyChildren = [];
  for (const section of sections) {
    bodyChildren.push(...makeSectionBody(section));
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: FONT,
            size: BODY_SIZE,
            color: BODY_COLOR,
          },
          paragraph: {
            spacing: { line: LINE_SPACING },
          },
        },
        heading1: {
          run: {
            font: FONT,
            size: H1_SIZE,
            bold: true,
            color: PRIMARY_DARK,
          },
          paragraph: {
            spacing: { before: 360, after: 200, line: LINE_SPACING },
            border: {
              bottom: { style: BorderStyle.SINGLE, size: 2, color: T.accentLine, space: 4 },
            },
          },
        },
        heading2: {
          run: {
            font: FONT,
            size: H2_SIZE,
            bold: true,
            color: ACCENT_TEAL,
          },
          paragraph: {
            spacing: { before: 300, after: 120, line: LINE_SPACING },
          },
        },
      },
    },
    sections: [
      // SECTION 1: Cover (no page numbers, margin 0)
      {
        properties: {
          page: {
            size: pgSize,
            margin: { top: 0, bottom: 0, left: 0, right: 0 },
          },
        },
        children: coverChildren,
      },
      // SECTION 2: TOC (Roman numerals)
      {
        properties: {
          type: SectionType.NEXT_PAGE,
          page: {
            size: pgSize,
            margin: pgMargin,
            pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN },
          },
        },
        footers: {
          default: pageNumFooter("roman"),
        },
        children: tocChildren,
      },
      // SECTION 3: Body (Arabic numerals starting at 1)
      {
        properties: {
          type: SectionType.NEXT_PAGE,
          page: {
            size: pgSize,
            margin: pgMargin,
            pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
          },
        },
        footers: {
          default: pageNumFooter("arabic"),
        },
        children: bodyChildren,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync("/home/z/my-project/StaySuite-Product-Features.docx", buffer);
  console.log("SUCCESS: Document generated at /home/z/my-project/StaySuite-Product-Features.docx");
}

main().catch((err) => {
  console.error("ERROR:", err);
  process.exit(1);
});
