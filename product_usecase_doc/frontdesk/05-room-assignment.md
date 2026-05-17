# Room Assignment

> **Section ID**: `frontdesk-room-assign`

## Purpose

The Room Assignment page provides intelligent and manual room allocation for guest check-ins. It combines an AI-powered auto-assignment engine that scores and ranks available rooms based on guest preferences, stay characteristics, and revenue optimization, with a manual override option for agents who need to pick a specific room. The system considers multiple factors — room features, floor preferences, stay duration, upgrade potential, and housekeeping readiness — to recommend the optimal room for each guest.

The page solves the business problem of making room assignment both fast and intelligent. Without auto-assignment, agents waste time manually searching for suitable rooms and may miss upgrade revenue opportunities. Without manual override, the system cannot accommodate special cases (guest requests, operational constraints) that the AI cannot evaluate.

## Key Features

- **AI Auto-Assignment**: One-click room assignment using a scoring algorithm that evaluates guest preferences, room features, stay duration, and revenue potential
- **Scoring Breakdown**: Transparent scoring display showing why each room was recommended — preference match, floor proximity, feature match, upgrade revenue, stay duration fit
- **Manual Override**: Select any available room from the list to override the AI suggestion, with a reason field for audit tracking
- **Room Preferences**: Display guest preferences (high floor, away from elevator, connecting rooms, specific view) and match against room features
- **Upgrade Suggestions**: Identify upgrade opportunities (guest booked Standard, Deluxe available) with incremental revenue display and one-click acceptance
- **Multi-Room Assignment**: For group bookings or guests requiring multiple rooms, assign all rooms in a single workflow with room proximity optimization
- **Availability Filter**: Filter assignable rooms by floor, room type, features, and housekeeping status (only inspected/available rooms shown)
- **Assignment History**: View the assignment audit trail — who assigned which room, when, and why (auto vs. manual)

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/frontdesk/auto-assign` | AI-powered automatic room assignment with scoring |
| `GET` | `/api/frontdesk/suggest-room` | Get room suggestions without committing (preview mode) |
| `GET` | `/api/rooms/available` | List all available rooms with filtering |
| `PUT` | `/api/bookings/[id]` | Apply room assignment to booking |
| `GET` | `/api/rooms/[id]` | Get detailed room information |

### Request Body (POST /api/frontdesk/auto-assign)

```json
{
  "bookingId": "uuid",
  "propertyId": "uuid",
  "roomTypeId": "uuid",
  "checkIn": "2025-01-15T15:00:00Z",
  "checkOut": "2025-01-18T11:00:00Z",
  "guestPreferences": {
    "preferredFloor": "high",
    "preferredView": "city",
    "bedType": "king",
    "awayFromElevator": true,
    "connectingRoom": false,
    "accessible": false
  },
  "allowUpgrade": true,
  "upgradeMaxCategory": "suite"
}
```

### Response (Auto-Assign with Scoring)

```json
{
  "bookingId": "uuid",
  "assignedRoom": {
    "roomId": "uuid",
    "roomNumber": "405",
    "floor": 4,
    "roomTypeId": "uuid",
    "roomTypeName": "Deluxe King",
    "roomTypeCategory": "deluxe",
    "features": ["city_view", "king_bed", "mini_bar", "bathtub"],
    "status": "available",
    "lastInspected": "2025-01-15T12:00:00Z"
  },
  "score": 0.93,
  "scoreBreakdown": {
    "preferenceMatch": 0.96,
    "floorProximity": 0.90,
    "stayDurationFit": 0.95,
    "featureMatch": 0.97,
    "upgradeRevenue": 0.85,
    "housekeepingReadiness": 1.00
  },
  "isUpgrade": true,
  "originalRoomType": "Standard Queen",
  "upgradeRevenuePerNight": 45.00,
  "totalUpgradeRevenue": 135.00,
  "alternatives": [
    {
      "roomId": "uuid",
      "roomNumber": "312",
      "roomTypeName": "Standard King",
      "score": 0.82,
      "isUpgrade": false
    },
    {
      "roomId": "uuid",
      "roomNumber": "501",
      "roomTypeName": "Deluxe King",
      "score": 0.88,
      "isUpgrade": true,
      "upgradeRevenuePerNight": 45.00
    }
  ]
}
```

## Scoring Algorithm

The auto-assignment engine scores each available room on a 0–1 scale across six dimensions:

| Dimension | Weight | Factors Evaluated |
|-----------|--------|-------------------|
| **Preference Match** | 30% | Guest preferred floor, view, bed type, features vs. room actual features |
| **Feature Match** | 20% | Room features (accessible, connecting, balcony, bathtub) vs. guest needs |
| **Floor Proximity** | 15% | Preferred floor zone (low/mid/high) vs. room floor; elevator proximity |
| **Stay Duration Fit** | 15% | Room suitability for stay length (longer stays get better-appointed rooms) |
| **Housekeeping Readiness** | 10% | How recently the room was inspected; time since last cleaning |
| **Upgrade Revenue** | 10% | Revenue potential from offering a room type upgrade (if allowed) |

### Upgrade Decision Logic

1. **Upgrade allowed**: Only if `allowUpgrade: true` in request and guest booking room type category is below the available room category
2. **Upgrade cap**: Will not suggest upgrades beyond `upgradeMaxCategory` (e.g., won't upgrade Standard → Presidential if max is Suite)
3. **VIP auto-upgrade**: Platinum/Gold VIP guests automatically get the highest available upgrade within their cap
4. **Revenue threshold**: Upgrade must generate at least $20/night additional revenue to be suggested (configurable per property)

## Business Logic

### Assignment Rules

| Rule | Description |
|------|-------------|
| **Same room type first** | Default behavior is to assign the best room within the booked room type |
| **Only inspected rooms** | Only rooms with status `available` (cleaned and inspected) are assignable |
| **No conflicting bookings** | Room must not have any overlapping confirmed bookings for the stay dates |
| **No maintenance blocks** | Room must not have active maintenance or out-of-order blocks |
| **Group proximity** | For group bookings, rooms on the same floor or adjacent are prioritized |
| **Long-stay priority** | Guests staying 5+ nights get rooms with kitchenettes or larger layouts when available |

### Manual Override

When an agent overrides the AI suggestion:
- A reason must be provided (guest request, operational need, maintenance, etc.)
- The override is logged in the assignment audit trail
- The system validates the selected room is available and suitable (occupancy, features)
- Override reasons are tracked for AI model improvement

## Cross-Module Dependencies

| Module | Dependency | Direction |
|--------|------------|-----------|
| **PMS — Rooms** | Room inventory, features, status, floor data | Read |
| **PMS — Room Types** | Room type categories, occupancy limits | Read |
| **Bookings** | Booking details, guest preferences, stay dates | Read |
| **Guests** | Guest preferences, loyalty tier, VIP status | Read |
| **Billing** | Upgrade revenue posted to folio | Write |
| **AI Engine** | Scoring algorithm, preference learning | Read/Write |

## User Flow

1. **Select Booking** — From the check-in flow, navigate to room assignment step
2. **Review Preferences** — System displays guest preferences (if available) and stay details
3. **Run Auto-Assign** — Click "Auto Assign" to get AI-powered room recommendation
4. **Review Score** — Examine the scoring breakdown and understand why the room was suggested
5. **Check Alternatives** — Browse alternative suggestions with scores below the top pick
6. **Accept or Override** — Click "Accept" to confirm assignment, or select a different room manually
7. **Handle Upgrade** — If upgrade suggested, review incremental cost; accept or decline
8. **Confirm Assignment** — Room is assigned to the booking; status transition queued for check-in

## User Roles & Permissions

| Role | Permission | Access |
|------|------------|--------|
| Admin | `admin.*` or `admin.frontdesk` | Auto-assign, manual override, upgrade approval, algorithm config |
| Manager | `frontdesk.manage` | Auto-assign, manual override, approve upgrades beyond threshold |
| Front Desk Agent | `frontdesk.manage` | Auto-assign, manual override within same room type; upgrades require approval |
| Reservationist | `bookings.view` | View suggestions only; cannot assign rooms |

## Error Scenarios

| Scenario | Error Code | Resolution |
|----------|------------|------------|
| No rooms available | `NO_ROOMS_AVAILABLE` | All rooms occupied or not inspected; check housekeeping queue |
| Room already assigned | `ROOM_ALREADY_ASSIGNED` | Booking already has a room; use room move instead |
| Upgrade requires approval | `UPGRADE_REQUIRES_APPROVAL` | Free upgrade exceeds agent authority; escalate to manager |
| Room type sold out | `ROOM_TYPE_SOLD_OUT` | No rooms of booked type available; suggest upgrade or alternative dates |
| Guest preferences incompatible | `NO_PREFERENCE_MATCH` | No room matches all guest preferences; show closest matches |
