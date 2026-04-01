# 📍 Denizen

A self-hosted web service for tracking neighbours by address — names, pets, notes, and a map view.

**Features:**
- 📝 Markdown-based storage (edit by hand if you want)
- 🗺️ Map view with clickable markers per address
- 🔍 Full-text search across all neighbour data
- 🔒 Single-user with password auth
- 📱 Responsive (sidebar/list on mobile)
- 🚀 Easy install: git clone + systemctl

## Quick Start

```bash
# Clone the repo
git clone <your-repo-url>
cd denizen

# Install
chmod +x install.sh
./install.sh

# Edit password
nano .env

# Run
npm start
```

Then open **http://localhost:3456**

## Install as a Service (systemd)

```bash
sudo cp denizen.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable denizen
sudo systemctl start denizen
```

Check status: `systemctl status denizen`
Logs: `journalctl -u denizen -f`

## Data Storage

All data lives in `data/neighbours/*.md` — plain markdown files with YAML frontmatter:

```markdown
---
id: 123-main-street
address: "123 Main Street"
coordinates: [40.5437, -111.7489]
dateAdded: 2026-03-31
tags:
  - dog
---

# 123 Main Street

## Residents
- **Name:** John Doe
- **Notes:** Friendly neighbour.

## Pets
- Max (dog)

## Notes
Great neighbour, always helpful.
```

You can edit these files directly — the app reads them on every request.

## Adding Neighbours

1. Click **+ Add Neighbour** in the header
2. Enter the address (required)
3. Optionally click **📍 Geocode** to look up lat/lng automatically
4. Add residents, pets, notes, and tags
5. Click **Save**

The map will automatically show a marker. If coordinates aren't set, the neighbour won't appear on the map (but will show in the sidebar list and search results).

## Configuration

Edit `.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3456` | HTTP port |
| `AUTH_PASSWORD` | *(none)* | Password for access |
| `SESSION_SECRET` | *(none)* | Random string for session encryption |
| `DATA_DIR` | `./data` | Where neighbour files are stored |

**Important:** Set `AUTH_PASSWORD` before first use — otherwise anyone can access your neighbour data.

## Backup

Since data is just markdown files in `data/neighbours/`, back them up with:

```bash
tar -czf denizen-backup.tar.gz data/
```

## Uninstall

```bash
# Stop and disable service
sudo systemctl stop denizen
sudo systemctl disable denizen
sudo rm /etc/systemd/system/denizen.service

# Remove the app
rm -rf /path/to/denizen
```

## Tech Stack

- Node.js + Express
- Leaflet.js + OpenStreetMap (map)
- Lunr.js (search)
- Marked.js (markdown rendering)
- Gray-Matter (YAML frontmatter parsing)

No database, no build step, no framework — just files.
