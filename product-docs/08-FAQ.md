# StaySuite FAQ
## Frequently Asked Questions

**Version**: 2.1  
**Last Updated**: May 2026

---

## General Questions

### What is StaySuite?

StaySuite is an All-in-One Hospitality Operating System that combines Property Management, Channel Management, Guest Experience, WiFi AAA (FreeRADIUS v3.2.7), Revenue Management, and 30+ modules into a single platform with 294 database models, 617 API routes, and 529 React components.

### How is StaySuite different from traditional PMS?

| Traditional PMS | StaySuite |
|-----------------|-----------|
| Property-focused | Guest journey-focused |
| Separate systems for channels | Built-in channel manager (46+ OTAs) |
| No WiFi integration | Native FreeRADIUS v3.2.7 with PostgreSQL |
| Manual pricing | AI-powered dynamic pricing |
| Multiple logins | Unified platform (30 modules) |
| Limited POS | Full Restaurant & POS (15 sub-features) |
| Basic housekeeping | 11 housekeeping sub-features |
| Separate IoT | Built-in Smart Hotel / IoT module |

### Is StaySuite cloud-based?

Yes, StaySuite is cloud-native SaaS with optional on-premise deployment for enterprise customers.

### How do I get started?

1. Contact sales@cryptsk.com
2. Sign up for a demo
3. Configure your property
4. Start using the platform

### What is the platform scale?

| Metric | Count |
|--------|-------|
| Database Models | 294 |
| API Routes | 617 |
| React Components | 529 |
| Component Directories | 44 |
| Navigation Modules | 30 |
| shadcn/ui Components | 51 |
| Supported Languages | 15 |

---

## Account & Access

### What are the demo credentials?

| Role | Email | Password |
|------|-------|----------|
| Property Admin | admin@royalstay.in | admin123 |
| Front Desk | frontdesk@royalstay.in | admin123 |
| Housekeeping | housekeeping@royalstay.in | admin123 |
| Platform Admin | platform@staysuite.com | admin123 |

### How do I reset my password?

1. Click "Forgot Password" on login page
2. Enter your email address
3. Receive reset link via email
4. Create new password

### How do I enable two-factor authentication?

1. Login to your account
2. Go to **Security Center → Two-Factor Auth**
3. Click **Enable 2FA**
4. Scan QR code with authenticator app
5. Enter verification code
6. Save backup codes

### What if I'm locked out of my account?

Contact your property administrator or email support@cryptsk.com.

---

## Bookings

### How do I create a new booking?

1. Navigate to **Bookings → Calendar View**
2. Click **New Booking**
3. Enter guest details, select room and dates
4. Choose rate plan
5. Click **Confirm**

### What booking states are supported?

Draft → Confirmed → Checked In → Checked Out → Cancelled

### Can I overbook rooms?

Yes. Configure overbooking thresholds in **PMS → Overbooking Settings**.

### How do group bookings work?

1. Navigate to **Bookings → Group Bookings**
2. Create group booking with multiple rooms
3. Set group rate, deposit, and block dates

---

## Guests

### Can I merge duplicate guest profiles?

Yes. Open one profile, click **Merge**, select duplicate, confirm.

### How does the loyalty program work?

Multi-tier loyalty system with point earning and redemption rules configured in **Guests → Loyalty & Points**.

---

## Front Desk

### What happens on check-in?

- WiFi account auto-provisioned (FreeRADIUS user created)
- Digital key generated (if enabled)
- Room status updated to occupied
- Housekeeping task created for departure prep

### What happens on check-out?

- WiFi access revoked
- Digital key deactivated
- Housekeeping task created
- Loyalty points awarded
- Feedback request sent

### Is there an express kiosk?

Yes. Navigate to **Front Desk → Express Kiosk** for self-service check-in/out with ID scanning and e-signature.

---

## WiFi Management

### How does WiFi integration work?

StaySuite uses FreeRADIUS v3.2.7 compiled from source with native PostgreSQL SQL module:

1. Guest checks in → WiFi user created in PostgreSQL
2. Guest connects to network → RADIUS auth via FreeRADIUS
3. Guest authenticated → Access granted per plan
4. Usage tracked in radacct table
5. Guest checks out → Access revoked

### What WiFi vendors are supported?

Cisco, MikroTik, Ruckus, Huawei, Juniper, Fortinet, Aruba, D-Link, Netgear, Grandstream, Ubiquiti (11+ vendors)

### How many WiFi plans are available?

6 plans: Free (2 Mbps), Basic (5 Mbps), Standard (10 Mbps), Premium (25 Mbps), Business (50 Mbps), Enterprise (100 Mbps)

### Does StaySuite include a captive portal?

Yes. The captive portal redirect service runs on port 8888 and redirects guests to the branded login page.

---

## Billing & Payments

### What payment gateways are supported?

Stripe, PayPal, Razorpay, Square, Adyen, Authorize.net, CCAvenue, PayU

### What is Night Audit?

Night Audit is a multi-step daily reconciliation process that verifies room charges, recalculates taxes, processes scheduled charges, posts commissions, and closes the business day. Navigate to **Billing → Night Audit** to run it.

### Is multi-currency supported?

Yes. Navigate to **Billing → Multi-Currency** to configure exchange rates and process in guest's preferred currency.

---

## Channel Manager

### What OTAs are supported?

46+ channels including Booking.com, Expedia, Airbnb, Agoda, MakeMyTrip, Goibibo, and more.

### How often does sync happen?

Real-time for booking events; every 5 minutes for inventory. Manual sync available anytime.

---

## Reports

### What reports are available?

Revenue, Occupancy, ADR/RevPAR, Guest Analytics, Staff Performance, Scheduled Reports — all exportable to PDF, Excel, CSV.

---

## New Features (v2.1)

### What is City Ledger?

City Ledger is an account-based billing system for corporate accounts and travel agents. It allows you to create invoices, add line items, track payments, and manage credit terms.

### How do Scheduled Charges work?

Scheduled Charges are recurring charges that automatically post to guest folios based on configurable rules (daily, per stay, custom frequency). You can pause/resume them and view execution history.

### What is Night Audit?

Night Audit is a multi-step daily reconciliation process that verifies room charges, recalculates taxes, processes scheduled charges, posts commissions, and closes the business day.

### How does the Commission system work?

You can configure commission rules (percentage, fixed, tiered) for travel agents. Commissions are automatically calculated when bookings are made through travel agents.

### What is the Posting Rules system?

Posting Rules allow automatic posting of charges to folios based on triggers (daily, check-in, check-out, booking, custom cron). Examples: daily room charges, resort fees, breakfast charges.

### How many mini-services does StaySuite use?

11 mini-services including Next.js, FreeRADIUS, Realtime WebSocket, Captive Portal Redirect, Availability Service, DHCP Server, DNS Resolver, DNS Parser, RADIUS Server, Conntrack Bridge, and SNI Parser.

---

## Integrations

### What door lock brands are supported?

Assa Abloy, dormakaba, Salto, ONITY, August

### Is there a REST API?

Yes. 617 API routes across 134 directories with OpenAPI documentation.

---

## Security

### Is my data secure?

- TLS 1.3 encryption in transit
- AES-256-GCM encryption at rest
- Custom session auth with httpOnly cookies
- Account lockout after 5 failed attempts
- Complete audit logging
- GDPR compliance tools

### Is StaySuite GDPR compliant?

Yes. Full GDPR compliance including data subject rights, consent management, data export/deletion, processing records.

---

## Technical

### What browsers are supported?

Chrome 90+, Firefox 88+, Safari 14+, Edge 90+

### What is the tech stack?

Next.js 16.1, React 19, PostgreSQL 17, FreeRADIUS v3.2.7, Tailwind CSS 4, Prisma 6, Zustand 5, TanStack Query 5

---

## More Questions?

- **Sales**: sales@cryptsk.com
- **Support**: support@cryptsk.com
- **Website**: www.staysuite.io

---

*© 2026 Cryptsk Pvt Ltd*
