require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const csrf = require('csurf');
const rateLimit = require('express-rate-limit');
const DOMPurify = require('isomorphic-dompurify');
const marked = require('marked');
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const lunr = require('lunr');

const app = express();
const PORT = process.env.PORT || 3456;
const DATA_DIR = path.join(__dirname, process.env.DATA_DIR || './data');
const GEOCODE_REGION = process.env.GEOCODE_REGION || '';
const NEIGHBOURS_DIR = path.join(DATA_DIR, 'neighbours');
const SEARCH_INDEX_FILE = path.join(DATA_DIR, 'search-index.json');

// Ensure directories exist
[DATA_DIR, NEIGHBOURS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// --- STARTUP CHECKS ---
// 6. Fail if SESSION_SECRET is not set
if (!process.env.SESSION_SECRET) {
  console.error('ERROR: SESSION_SECRET environment variable is not set. Aborting startup.');
  console.error('Set it in your .env file: SESSION_SECRET=<a-long-random-string>');
  process.exit(1);
}

// --- MIDDLEWARE ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Cookie parser is required for csurf double-submit cookie pattern
app.use(cookieParser());

// Session config with secure cookie flags (issue #1)
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    secure: true,
    sameSite: 'strict'
  }
}));

// CSRF protection using double-submit cookie pattern (issue #2)
const csrfProtection = csrf({ cookie: true });

// Rate limiting on login endpoint (issue #5)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,                   // 5 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' }
});

// Auth middleware
function requireAuth(req, res, next) {
  if (!process.env.AUTH_PASSWORD) return next(); // No auth set up
  if (req.session.authenticated) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

// --- AUTH ---
// POST /api/auth/login — rate limited
app.post('/api/auth/login', loginLimiter, (req, res) => {
  const { password } = req.body;
  if (password === process.env.AUTH_PASSWORD) {
    req.session.authenticated = true;
    res.json({ ok: true });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

app.post('/api/auth/logout', csrfProtection, (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

app.get('/api/auth/check', (req, res) => {
  res.json({ authenticated: !!req.session.authenticated || !process.env.AUTH_PASSWORD });
});

// GET /api/auth/csrf-token — returns CSRF token for client use
app.get('/api/auth/csrf-token', csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// --- HELPERS ---

// Strip HTML tags from a string (used to sanitize names before embedding in markdown)
function sanitizeName(str) {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/<[^>]*>/g, '').trim();
}

// 4. Sanitize resident and pet name fields before embedding in markdown
function sanitizeMarkdownString(str) {
  if (!str || typeof str !== 'string') return '';
  // Escape potential markdown/HTML special chars to prevent injection
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function parseNeighbourFile(filepath) {
  const content = fs.readFileSync(filepath, 'utf-8');
  const parsed = matter(content);
  return {
    id: parsed.data.id || path.basename(filepath, '.md'),
    address: parsed.data.address || '',
    coordinates: parsed.data.coordinates || null,
    dateAdded: parsed.data.dateAdded || null,
    tags: parsed.data.tags || [],
    content: parsed.content,
    raw: content
  };
}

function getAllNeighbours() {
  if (!fs.existsSync(NEIGHBOURS_DIR)) return [];
  const files = fs.readdirSync(NEIGHBOURS_DIR).filter(f => f.endsWith('.md'));
  return files.map(f => parseNeighbourFile(path.join(NEIGHBOURS_DIR, f)));
}

function buildSearchIndex() {
  const neighbours = getAllNeighbours();
  const idx = lunr(function() {
    this.ref('id');
    this.field('address', { boost: 10 });
    this.field('residents');
    this.field('pets');
    this.field('notes');
    this.field('tags');

    neighbours.forEach(n => {
      // Extract names from content
      const lines = n.content.split('\n');
      let residents = '', pets = '', notes = '';
      let section = '';
      let currentIndent = 0;
      lines.forEach(line => {
        if (line.startsWith('## Residents')) {
          section = 'Residents'; currentIndent = 0;
        } else if (line.startsWith('## Pets')) {
          section = 'Pets'; currentIndent = 0;
        } else if (line.startsWith('## Notes')) {
          section = 'Notes'; currentIndent = 0;
        } else if (line.startsWith('#') || line.startsWith('##')) {
          section = ''; currentIndent = 0;
        } else if (section === 'Residents') {
          const indent = line.match(/^(\s*)/)[1].length;
          if (indent === 0) {
            residents += ' ' + line.replace(/^-\s*\*?\*?[^*]+\*?:?/, '');
          } else {
            residents += ' ' + line.replace(/^-\s+/, '').replace(/: /, ' ');
          }
        } else if (section === 'Pets') {
          pets += ' ' + line.replace(/^-\s*/, '');
        } else if (section === 'Notes') {
          notes += ' ' + line;
        }
      });

      this.add({
        id: n.id || 'unknown',
        address: n.address || '',
        residents: residents || '',
        pets: pets || '',
        notes: notes || '',
        tags: (n.tags || []).join(' ') || ''
      });
    });
  });
  return idx.toJSON();
}

// 3. Sanitize markdown — returns sanitized HTML string
function sanitizeMarkdown(content) {
  if (!content) return '';
  try {
    const html = marked.parse(content);
    return DOMPurify.sanitize(html);
  } catch (e) {
    return DOMPurify.sanitize(content);
  }
}

// --- NEIGHBOURS CRUD ---
app.get('/api/neighbours', requireAuth, (req, res) => {
  try {
    const neighbours = getAllNeighbours();
    const list = neighbours.map(n => ({
      id: n.id,
      address: n.address,
      coordinates: n.coordinates,
      dateAdded: n.dateAdded,
      tags: n.tags,
      summary: extractSummary(n.content)
    }));
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/neighbours/:id', requireAuth, (req, res) => {
  try {
    const filepath = path.join(NEIGHBOURS_DIR, req.params.id + '.md');
    if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'Not found' });
    const n = parseNeighbourFile(filepath);
    // 3. Sanitize markdown content before sending to client
    n.content = sanitizeMarkdown(n.content);
    res.json(n);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/neighbours', requireAuth, csrfProtection, (req, res) => {
  try {
    const { address, residents, pets, notes, coordinates, tags, dateAdded } = req.body;
    if (!address) return res.status(400).json({ error: 'Address required' });

    const id = slugify(address);
    const date = dateAdded || new Date().toISOString().split('T')[0];
    let content = `---\nid: ${id}\naddress: "${address}"\ncoordinates: ${JSON.stringify(coordinates || [])}\ndateAdded: ${date}\ntags:\n${(tags || []).map(t => `  - ${t}`).join('\n')}\n---\n\n# ${address}\n\n`;

    // 4. Sanitize resident names before embedding in markdown
    if (residents && residents.length) {
      const residentLines = residents.map(r => {
        const safeRole = sanitizeMarkdownString(r.role || '');
        const safeName = sanitizeMarkdownString(r.name || '');
        let line = `- **${safeRole}:** ${safeName}`;
        if (r.phone) line += `\n  - Phone: ${r.phone}`;
        if (r.email) line += `\n  - Email: ${r.email}`;
        return line;
      });
      content += `## Residents\n${residentLines.join('\n')}\n\n`;
    }
    // 4. Sanitize pet names before embedding in markdown
    if (pets && pets.length) {
      content += `## Pets\n${pets.map(p => {
        const safeName = sanitizeMarkdownString(p.name || '');
        const safeType = sanitizeMarkdownString(p.type || 'pet');
        return `- ${safeName} (${safeType})`;
      }).join('\n')}\n\n`;
    }
    if (notes) {
      content += `## Notes\n${notes}\n`;
    }

    const filepath = path.join(NEIGHBOURS_DIR, id + '.md');
    fs.writeFileSync(filepath, content.trim() + '\n');
    rebuildSearchIndex();
    res.json({ id, ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/neighbours/:id', requireAuth, csrfProtection, (req, res) => {
  try {
    const { address, residents, pets, notes, coordinates, tags, dateAdded } = req.body;
    if (!address) return res.status(400).json({ error: 'Address required' });

    const id = req.params.id;
    const date = dateAdded || new Date().toISOString().split('T')[0];
    let content = `---\nid: ${id}\naddress: "${address}"\ncoordinates: ${JSON.stringify(coordinates || [])}\ndateAdded: ${date}\ntags:\n${(tags || []).map(t => `  - ${t}`).join('\n')}\n---\n\n# ${address}\n\n`;

    // 4. Sanitize resident names before embedding in markdown
    if (residents && residents.length) {
      const residentLines = residents.map(r => {
        const safeRole = sanitizeMarkdownString(r.role || '');
        const safeName = sanitizeMarkdownString(r.name || '');
        let line = `- **${safeRole}:** ${safeName}`;
        if (r.phone) line += `\n  - Phone: ${r.phone}`;
        if (r.email) line += `\n  - Email: ${r.email}`;
        return line;
      });
      content += `## Residents\n${residentLines.join('\n')}\n\n`;
    }
    // 4. Sanitize pet names before embedding in markdown
    if (pets && pets.length) {
      content += `## Pets\n${pets.map(p => {
        const safeName = sanitizeMarkdownString(p.name || '');
        const safeType = sanitizeMarkdownString(p.type || 'pet');
        return `- ${safeName} (${safeType})`;
      }).join('\n')}\n\n`;
    }
    if (notes) {
      content += `## Notes\n${notes}\n`;
    }

    const filepath = path.join(NEIGHBOURS_DIR, id + '.md');
    fs.writeFileSync(filepath, content.trim() + '\n');
    rebuildSearchIndex();
    res.json({ id, ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/neighbours/:id', requireAuth, csrfProtection, (req, res) => {
  try {
    const filepath = path.join(NEIGHBOURS_DIR, req.params.id + '.md');
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    rebuildSearchIndex();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- SEARCH ---
app.get('/api/search', requireAuth, (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);

    let index;
    if (fs.existsSync(SEARCH_INDEX_FILE)) {
      index = lunr.Index.load(JSON.parse(fs.readFileSync(SEARCH_INDEX_FILE, 'utf-8')));
    } else {
      rebuildSearchIndex();
      index = lunr.Index.load(JSON.parse(fs.readFileSync(SEARCH_INDEX_FILE, 'utf-8')));
    }

    const results = index.search(q);
    const neighbours = getAllNeighbours();
    const resultMap = {};
    neighbours.forEach(n => { resultMap[n.id] = n; });

    res.json(results.map(r => ({
      id: r.ref,
      address: resultMap[r.ref]?.address,
      coordinates: resultMap[r.ref]?.coordinates,
      score: r.score
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- GEOCODING ---
app.get('/api/geocode', requireAuth, async (req, res) => {
  try {
    const { address } = req.query;
    if (!address) return res.status(400).json({ error: 'Address required' });

    const query = encodeURIComponent(address + (GEOCODE_REGION ? ', ' + GEOCODE_REGION : ''));
    const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`;

    const response = await fetch(url, {
      headers: { 'User-Agent': 'NeighbourMap/1.0' }
    });
    const data = await response.json();

    if (data && data[0]) {
      res.json({
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon)
      });
    } else {
      res.json({ lat: null, lng: null });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- HELPER FUNCTIONS ---
function extractSummary(content) {
  const lines = content.split('\n');
  let section = '';
  let residents = [];
  let pets = [];

  lines.forEach(line => {
    if (line.startsWith('## Residents')) { section = 'residents'; }
    else if (line.startsWith('## Pets')) { section = 'pets'; }
    else if (line.startsWith('## Notes')) { section = 'notes'; }
    else if (line.startsWith('#') || line.startsWith('##')) { section = ''; }
    else if (section === 'residents' && line.trim().startsWith('-')) {
      const match = line.match(/- \*\*([^:]+):\*\* (.+)/);
      if (match) residents.push(match[2].trim());
    }
    else if (section === 'pets' && line.trim().startsWith('-')) {
      const match = line.match(/- ([^(]+)/);
      if (match) pets.push(match[1].trim());
    }
  });

  let summary = residents.slice(0, 3).join(', ');
  if (residents.length > 3) summary += ` +${residents.length - 3} more`;
  if (pets.length) summary += ` + ${pets.length} pet${pets.length > 1 ? 's' : ''}`;
  return summary || 'No details yet';
}

function rebuildSearchIndex() {
  const idx = buildSearchIndex();
  fs.writeFileSync(SEARCH_INDEX_FILE, JSON.stringify(idx));
}

// Rebuild index on startup
if (fs.existsSync(SEARCH_INDEX_FILE)) {
  try { lunr.Index.load(JSON.parse(fs.readFileSync(SEARCH_INDEX_FILE, 'utf-8'))); }
  catch (e) { rebuildSearchIndex(); }
} else {
  rebuildSearchIndex();
}

app.listen(PORT, () => {
  console.log(`Denizen running at http://localhost:${PORT}`);
});
