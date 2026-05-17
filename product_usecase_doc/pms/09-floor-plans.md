# Floor Plans

## Purpose

Floor Plans provides a visual, drag-and-drop interface for mapping rooms onto floor layouts. Each floor of a property can have its own floor plan with rooms placed at specific x,y coordinates and dimensions. This visual representation is essential for housekeeping task routing, front desk room assignment, maintenance planning, and emergency response.

This page solves the business problem of spatial awareness — knowing not just WHICH rooms exist, but WHERE they are physically located within the building.

## Features

- **Create Floor Plan**: Define a new floor plan per property per floor
- **Visual Editor**: Upload background image or SVG, set canvas dimensions and grid size
- **Room Placement**: Drag-and-drop rooms onto the floor plan with x,y coordinates and dimensions
- **Room Management**: View placed rooms, unplaced rooms, and floor plan room data
- **Delete Floor Plan**: Remove floor plan and all associated room placements (cascade delete)
- **Grid Snapping**: Configurable grid size for precise room positioning (default 20px)
- **Background Images**: Upload floor plan blueprint or architectural drawing as reference

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/floor-plans` | List all floor plans (filterable by `propertyId`) |
| `POST` | `/api/floor-plans` | Create a new floor plan |
| `GET` | `/api/floor-plans/[id]` | Get single floor plan with room placements |
| `PUT` | `/api/floor-plans/[id]` | Update floor plan details |
| `DELETE` | `/api/floor-plans/[id]` | Delete floor plan (cascades to room placements) |
| `GET` | `/api/floor-plans/[id]/rooms` | Get all rooms placed on this floor plan |
| `POST` | `/api/floor-plans/[id]/rooms/[roomId]` | Place or update a room's position on the floor plan |
| `PUT` | `/api/floor-plans/[id]/rooms/[roomId]` | Update room position/dimensions |
| `DELETE` | `/api/floor-plans/[id]/rooms/[roomId]` | Remove a room from the floor plan |

## Data Model

### `FloorPlan` Table

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | `UUID` | Auto | — | Primary key |
| `tenantId` | `UUID` | Auto | — | Tenant ownership |
| `propertyId` | `UUID` | **Yes** | — | FK to Property |
| `floor` | `number` | **Yes** | — | Floor number |
| `name` | `string` | **Yes** | — | Display name (e.g., "Ground Floor", "Level 1") |
| `imageUrl` | `string` | No | — | URL to background image (blueprint/photo) |
| `svgData` | `string` | No | — | SVG floor plan data (for custom drawings) |
| `width` | `number` | No | `800` | Canvas width in pixels |
| `height` | `number` | No | `600` | Canvas height in pixels |
| `gridSize` | `number` | No | `20` | Grid cell size for snapping (pixels) |
| `createdAt` | `datetime` | Auto | `now()` | Creation timestamp |
| `updatedAt` | `datetime` | Auto | `now()` | Last update timestamp |

### `FloorPlanRoom` Table

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | `UUID` | Auto | — | Primary key |
| `floorPlanId` | `UUID` | **Yes** | — | FK to FloorPlan |
| `roomId` | `UUID` | **Yes** | — | FK to Room |
| `x` | `number` | **Yes** | — | X coordinate on canvas |
| `y` | `number` | **Yes** | — | Y coordinate on canvas |
| `width` | `number` | **Yes** | — | Room rectangle width (pixels) |
| `height` | `number` | **Yes** | — | Room rectangle height (pixels) |

### Computed Response Fields (GET Single Floor Plan)

| Field | Type | Description |
|-------|------|-------------|
| `placedRooms` | `FloorPlanRoom[]` | Rooms currently placed on this floor plan with positions |
| `unplacedRooms` | `Room[]` | Rooms belonging to this floor that are NOT placed on any floor plan |
| `floorPlanRooms` | `object[]` | Combined data: room details + placement coordinates |

## Business Logic

### Creation Rules

1. **Required fields**: `propertyId`, `floor`, `name` are mandatory.
2. **Unique per property + floor**: Each property can have only ONE floor plan per floor number. Attempting to create a second floor plan for the same property+floor combination is rejected.
3. **Floor number**: Can be any integer (including negative for basements, e.g., `-1` for basement level).

### Canvas Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `width` | `800` | Canvas width in pixels. Higher values allow more horizontal space. |
| `height` | `600` | Canvas height in pixels. Higher values allow more vertical space. |
| `gridSize` | `20` | Snap-to-grid cell size. Smaller values allow finer positioning. |

### Room Placement

1. Only rooms belonging to the floor plan's property can be placed.
2. A room can only be placed on ONE floor plan at a time. If a room is already placed on Floor Plan A and placed on Floor Plan B, it is removed from Floor Plan A.
3. Room placement requires: `x`, `y`, `width`, `height` coordinates.
4. The `width` and `height` here refer to the visual representation size on the canvas, NOT the physical room dimensions.

### Unplaced Rooms

- The `unplacedRooms` computed field returns rooms that:
  - Belong to the property of this floor plan
  - Have `Room.floor` matching this floor plan's `floor` number
  - Are NOT referenced in ANY `FloorPlanRoom` record

### Cascade Delete

- Deleting a floor plan automatically removes ALL `FloorPlanRoom` entries associated with it.
- The rooms themselves are NOT deleted — only their placement data is removed.
- This is irreversible; placement data is lost when the floor plan is deleted.

### Background Images & SVG

- `imageUrl`: An uploaded image URL displayed as the floor plan background (e.g., architectural blueprint).
- `svgData`: Raw SVG markup for custom-drawn floor plans. Can be used instead of or in addition to `imageUrl`.
- Both are optional — a floor plan can operate with just the grid and room placements.

## Cross-Module Dependencies

| Module | Dependency |
|--------|------------|
| **Rooms** | Rooms are placed on floor plans. `Room.floor` groups rooms by floor for initial placement. |
| **Housekeeping** | Housekeeping uses floor plans for efficient task routing — assign tasks by floor proximity. Visual layout helps staff find rooms quickly. |
| **Front Desk** | Room grid references floor plan positions. Visual room assignment helps front desk staff select nearby rooms for guests. |
| **Maintenance** | Maintenance teams use floor plans to locate rooms and plan work routes. |
| **Room Status** | Room status is displayed on floor plan room blocks (color-coded: green=available, red=occupied, yellow=dirty, etc.). |
| **Emergency Management** | Floor plans can be used for emergency evacuation planning and room location reference. |

## User Flow

1. **Navigate to PMS → Floor Plans** from the main navigation sidebar
2. The page lists all floor plans for the current property
3. Click **"New Floor Plan"** to open the creation form
4. Fill in: **Floor Number** (e.g., 1), **Name** (e.g., "First Floor - Main Wing")
5. Optionally upload a **Background Image** (architectural blueprint) or provide **SVG Data**
6. Set **Canvas Dimensions**: width and height (default 800×600)
7. Adjust **Grid Size** for snapping precision (default 20px)
8. Click **"Create Floor Plan"** — the visual editor opens
9. The editor shows the floor plan canvas with the background image (if provided)
10. **Unplaced rooms** for this floor appear in a sidebar/panel
11. **Drag rooms** from the sidebar onto the canvas — they snap to the grid
12. **Resize rooms** by dragging handles to match the layout
13. **Position rooms** at their physical locations on the blueprint
14. Click **"Save Layout"** to persist all room positions
15. To remove a room from the plan: drag it off the canvas or click the remove button
16. To delete the entire floor plan: click **"Delete Floor Plan"** → confirm → all placement data is removed
