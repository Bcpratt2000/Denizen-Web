# Denizen — SPEC.md

## 1. Concept & Vision

A quiet, self-hosted neighborhood notebook. Add residents by address, see them on a map, search across everything. Data lives in markdown files you could theoretically edit by hand. Feels like a personal wiki crossed with a real map — not a CRM, not a spreadsheet. Warm, offline-capable, yours.

## 2. Design Language

**Aesthetic:** Warm paper + cartographic. Think field notebook meets neighborhood map table.

**Colors:**
- Background: `#FAF7F2` (warm off-white, paper-like)
- Surface: `#FFFFFF`
- Primary: `#2D6A4F` (forest green — map pin energy)
- Accent: `#E76F51` (terracotta — highlight, call to action)
- Text: `#1C1C1C`
- Muted: `#6B7280`
- Border: `#E5E0D8`

**Typography:**
- Headings: `Outfit` (clean, slightly playful geometric)
- Body: `Inter` (readable, neutral)
- Monospace/data: `JetBrains Mono` (for addresses, file paths)

**Spatial system:** 8px base unit. Generous whitespace. Cards with soft shadows.

**Motion:** Minimal — 150ms ease transitions on hover/focus. Map pins drop in with a subtle bounce.

**Visual assets:** Lucide icons. Leaflet.js + OpenStreetMap tiles.

## 3. Layout & Structure

```
┌─────────────────────────────────────────────────┐
│  Header: "Denizen" + search bar + add btn │
├────────────────────┬────────────────────────────┤
│                    │                            │
│   Sidebar list     │      Leaflet Map           │
│   (filterable)     │   (OSM, marker per entry)  │
│                    │                            │
│   - Address        │   Clicking marker → slide  │
│   - Name summary   │   in detail panel          │
│   - Pet icons      │                            │
│                    │                            │
└────────────────────┴────────────────────────────┘
```

- Sidebar: scrollable, searchable list of all neighbours
- Map: fills remaining space, markers clickable
- Detail panel: slides in from right on marker click (or list item click on mobile)
- Mobile: tabs toggle between List / Map views

## 4. Features & Interactions

### Data Model (Markdown + YAML frontmatter)

Each neighbour entry is a `.md` file in `data/neighbours/`:
```
---
id: 123-maple-street
address: "123 Maple Street"
coordinates: [40.5437, -111.7489]   # [lat, lng] — optional, geocoded or manually set
dateAdded: 2026-03-31
tags:
  - dog
---

# 123 Maple Street

## Residents
- **Name:** Jane Smith
- **Notes:** Friendly neighbour.

## Pets
- Max (dog)

## Notes
Great neighbour, always helpful.
```

Filename format: `{streetNumber}-{streetName}.md` — slugified, e.g. `123-maple-street.md`

### Search
- Real-time search across: address, all resident names, pet names, notes content, tags
- Results highlight matching text
- Empty state: "No neighbours found — add one?"

### Add / Edit
- Modal form for adding new neighbours
- Fields: Address (required), Residents (dynamic list), Pets (dynamic list), Notes (textarea), Coordinates (lat/lng inputs — optional, geocodes from address if blank)
- Edit same modal, pre-filled
- Delete with confirmation

### Map
- Leaflet + OSM tiles
- Markers: colored pins by street (or just green pins)
- Marker popup: shows name summary + "View details" link
- Clicking list item also opens detail panel + centers map

### Auth
- Single user, password in `.env` (`AUTH_PASSWORD`)
- Prompted on first load, sets a session cookie (24h)
- No registration, no account creation
- Password set on first run via environment variable

## 5. Component Inventory

### Header
- Logo/title left
- Search input center (expandable on mobile)
- "Add Neighbour" button right (terracotta accent)
- States: default, search active (input expanded)

### Neighbour Card (sidebar list)
- Address in monospace bold
- Resident names summary (e.g. "Jane, Sam + 2 pets")
- Pet icons (🐕🐈) inline if pets exist
- Tags as small pills
- Hover: subtle lift shadow
- Click: opens detail panel

### Detail Panel (slide-in)
- Full address header
- Residents list (name + role)
- Pets list (name + type)
- Notes section (markdown rendered)
- Edit / Delete buttons (top right)
- Close X button

### Add/Edit Modal
- Backdrop blur overlay
- Address input (with geocode button)
- Dynamic resident rows: [Name] [Role] [remove btn]
- Dynamic pet rows: [Name] [Type] [remove btn]
- Notes textarea
- Coordinates inputs (lat/lng, auto-filled from geocode)
- Save / Cancel buttons
- Validation: address required

### Map
- Full height of content area
- Custom marker icons (green, slightly larger than default)
- Popup on click: neighbour name summary + "Details →" link
- Zoom controls, scale bar

## 6. Technical Approach

**Stack:**
- Node.js + Express (backend API)
- Vanilla JS frontend (no framework — keeps it simple and fast)
- Leaflet.js for map
- Marked.js for markdown rendering
- Geocoding: Nominatim (OpenStreetMap) — free, no API key needed
- Session: express-session with cookie (password checked against `.env`)

**File Structure:**
```
denizen/
├── SPEC.md
├── README.md
├── .env.example
├── install.sh
├── denizen.service   # systemd unit file
├── package.json
├── server.js            # Express app
├── data/
│   └── neighbours/      # *.md files
│       └── .gitkeep
├── public/
│   ├── index.html
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   ├── app.js       # main frontend logic
│   │   ├── api.js       # fetch wrappers
│   │   ├── search.js     # client-side search
│   │   └── map.js       # Leaflet logic
│   └── assets/
│       └── icons/       # marker SVGs
└── search-index/        # built lunr index (regenerated on data change)
```

**API Endpoints:**
```
GET    /api/neighbours           → list all (id, address, coords, summary)
GET    /api/neighbours/:id       → full markdown content
POST   /api/neighbours           → create new from form data
PUT    /api/neighbours/:id       → update from form data
DELETE /api/neighbours/:id       → delete
GET    /api/search?q=             → search across all fields
POST   /api/geocode?address=      → geocode address via Nominatim
POST   /api/auth/login            → check password, set session
POST   /api/auth/logout           → clear session
GET    /api/auth/check            → check if authenticated
```

**Auth:** `.env` file with `AUTH_PASSWORD`. Session cookie. No registration.

**Search:** On every create/update/delete, rebuild a Lunr.js index from all markdown files. Search queries hit `/api/search` which uses the pre-built index.

**Installation:**
```bash
git clone <repo> /opt/denizen
cd /opt/denizen
cp .env.example .env
# edit .env with your password
npm install
sudo cp denizen.service /etc/systemd/system/
sudo systemctl enable denizen
sudo systemctl start denizen
```

**Port:** Default `3456` (configurable via `.env` → `PORT`)

**Name:** "Denizen" — a resident of a place.
