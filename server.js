// Express.js Backend with Integrated Semantic Vector Database
// For FLOODGUARD HƯƠNG KHÊ

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

import { getEmbedding, searchCollection } from './vectorDb.js';
import {
  AREAS, USERS, CITIZEN_PROFILES, VULNERABLE_HOUSEHOLDS,
  FLOOD_WARNINGS, RESCUE_REQUESTS, RESCUE_MISSIONS, MISSION_STATUS_LOGS,
  RESCUE_TEAMS, SAFE_ZONES, RESCUE_ROUTES, DAMS, SMS_LOGS,
  DAMAGE_REPORTS, ACTIVITY_LOGS, NOTIFICATIONS
} from './src/data/mockData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;
const DATABASE_URL = process.env.DATABASE_URL || '';
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('base64url');
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';
const IS_DEPLOYED_RUNTIME = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
const DB_FILE = process.env.DB_FILE ? path.resolve(process.env.DB_FILE) : path.join(__dirname, 'db.json');
const DIST_DIR = path.join(__dirname, 'dist');
const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};
const allowedOrigins = (process.env.CLIENT_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
const defaultAllowedOrigins = [
  'https://cuuhohatinh.onrender.com',
  'https://cuuhohatinh.sonminh2709.workers.dev',
  'http://localhost:5173',
  'http://localhost:5000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5000',
];
const corsAllowedOrigins = new Set([...defaultAllowedOrigins, ...allowedOrigins]);
const { Pool } = pg;
const pool = DATABASE_URL
  ? new Pool({
      connectionString: DATABASE_URL,
      ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false
    })
  : null;
let writeQueue = Promise.resolve();

app.disable('x-powered-by');
app.set('trust proxy', 1);

if (IS_DEPLOYED_RUNTIME && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is required in production/Render');
}

if (!process.env.JWT_SECRET) {
  console.warn('JWT_SECRET is not set. Using a random development-only runtime secret.');
}

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'", ...Array.from(corsAllowedOrigins)],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({
  origin(origin, callback) {
    if (!origin || corsAllowedOrigins.has(origin)) {
      return callback(null, true);
    }

    console.warn(`CORS blocked origin: ${origin}`);
    return callback(null, false);
  },
}));
app.use(express.json({ limit: '1mb' }));

const apiRateLimit = parsePositiveInt(
  process.env.API_RATE_LIMIT,
  IS_DEPLOYED_RUNTIME ? 500 : 5000
);
const authRateLimit = parsePositiveInt(
  process.env.AUTH_RATE_LIMIT,
  IS_DEPLOYED_RUNTIME ? 10 : 100
);
const publicWriteRateLimit = parsePositiveInt(
  process.env.PUBLIC_WRITE_RATE_LIMIT,
  IS_DEPLOYED_RUNTIME ? 20 : 200
);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: apiRateLimit,
  standardHeaders: true,
  legacyHeaders: false,
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: authRateLimit,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { success: false, message: 'Qua nhieu lan thu, vui long thu lai sau' },
});
const publicWriteLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: publicWriteRateLimit,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', apiLimiter);

// In-memory representation of our JSON database
let db = {
  areas: AREAS,
  users: USERS,
  citizenProfiles: CITIZEN_PROFILES,
  vulnerableHouseholds: VULNERABLE_HOUSEHOLDS,
  floodWarnings: FLOOD_WARNINGS,
  rescueRequests: RESCUE_REQUESTS,
  rescueMissions: RESCUE_MISSIONS,
  missionStatusLogs: MISSION_STATUS_LOGS,
  rescueTeams: RESCUE_TEAMS,
  safeZones: SAFE_ZONES,
  rescueRoutes: RESCUE_ROUTES,
  dams: DAMS,
  smsLogs: SMS_LOGS,
  damageReports: DAMAGE_REPORTS,
  activityLogs: ACTIVITY_LOGS,
  notifications: NOTIFICATIONS
};
const COLLECTION_NAMES = Object.keys(db);
const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN'];
const RESCUE_ROLES = ['RESCUE_LEADER', 'RESCUE_MEMBER'];
const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const WARNING_FIELDS = ['title', 'content', 'level', 'status', 'area_id', 'area_name', 'start_time', 'end_time'];
const RESCUE_REQUEST_PUBLIC_FIELDS = [
  'full_name', 'phone', 'area_id', 'area_name', 'address_detail', 'description', 'note',
  'number_of_people', 'emergency_level', 'latitude', 'longitude', 'has_elderly',
  'has_children', 'has_disabled', 'has_medical_case', 'sos_mode',
];
const RESCUE_REQUEST_UPDATE_FIELDS = [
  ...RESCUE_REQUEST_PUBLIC_FIELDS, 'status', 'assigned_team_id', 'assigned_team_name',
  'accepted_at', 'completed_at',
];
const TEAM_FIELDS = [
  'team_name', 'name', 'phone', 'leader_user_id', 'leader_id', 'leader_name',
  'status', 'latitude', 'longitude', 'member_count', 'memberCount', 'notes', 'area_id', 'area_name',
];
const SAFE_ZONE_FIELDS = [
  'name', 'address', 'area_id', 'area_name', 'capacity', 'current_people', 'latitude',
  'longitude', 'manager_name', 'manager_phone', 'notes', 'status',
];
const ROUTE_FIELDS = [
  'name', 'from_location', 'to_location', 'area_id', 'area_name', 'distance_km',
  'estimated_minutes', 'difficulty', 'status', 'notes', 'waypoints',
];
const DAMAGE_REPORT_FIELDS = [
  'reporter_id', 'reporter_name', 'phone', 'area_id', 'area_name', 'address_detail',
  'damage_type', 'severity', 'description', 'estimated_loss', 'latitude', 'longitude', 'images',
];
const VULNERABLE_HOUSEHOLD_FIELDS = [
  'full_name', 'head_name', 'phone', 'area_id', 'area_name', 'address_detail',
  'household_size', 'elderly_count', 'children_count', 'disabled_count', 'medical_note',
  'emergency_contact_name', 'emergency_contact_phone', 'latitude', 'longitude', 'priority_level', 'notes',
];
const SMS_LOG_FIELDS = ['recipient', 'phone', 'message', 'status', 'provider', 'error', 'user_id', 'flood_warning_id', 'floodAlertId'];

function sanitizeObject(value) {
  if (Array.isArray(value)) {
    return value.map(sanitizeObject);
  }

  if (!value || typeof value !== 'object') {
    return typeof value === 'string' ? value.trim().slice(0, 2000) : value;
  }

  const clean = {};
  for (const [key, item] of Object.entries(value)) {
    if (!DANGEROUS_KEYS.has(key)) {
      clean[key] = sanitizeObject(item);
    }
  }
  return clean;
}

function pickAllowed(source, allowedKeys) {
  const cleanSource = sanitizeObject(source || {});
  return allowedKeys.reduce((result, key) => {
    if (Object.prototype.hasOwnProperty.call(cleanSource, key)) {
      result[key] = cleanSource[key];
    }
    return result;
  }, {});
}

function safeUser(user) {
  if (!user) return null;
  const safe = { ...user };
  delete safe.password_hash;
  delete safe.passwordHash;
  return sanitizeObject(safe);
}

function sanitizeDbForUser(user) {
  const publicDb = {
    areas: db.areas,
    floodWarnings: db.floodWarnings,
    safeZones: db.safeZones,
    dams: db.dams,
  };

  if (!user) {
    return publicDb;
  }

  const safeDb = {
    ...db,
    users: Array.isArray(db.users) ? db.users.map(safeUser) : [],
  };

  if (!ADMIN_ROLES.includes(user.role)) {
    delete safeDb.smsLogs;
    delete safeDb.activityLogs;
  }

  return sanitizeObject(safeDb);
}

function applySeedPasswords() {
  if (!Array.isArray(db.users)) return;

  const seedPasswords = {
    ADMIN: process.env.SEED_ADMIN_PASSWORD || '',
    SUPER_ADMIN: process.env.SEED_ADMIN_PASSWORD || '',
    RESCUE_LEADER: process.env.SEED_RESCUE_PASSWORD || '',
    RESCUE_MEMBER: process.env.SEED_RESCUE_PASSWORD || '',
    CITIZEN: process.env.SEED_CITIZEN_PASSWORD || '',
  };

  for (const user of db.users) {
    if (user.password_hash || user.passwordHash) continue;

    const seedPassword = seedPasswords[user.role];
    if (seedPassword) {
      user.password_hash = bcrypt.hashSync(seedPassword, 12);
    } else {
      user.status = 'BLOCKED';
      console.warn(`Seed user ${user.id} is blocked because no seed password was configured.`);
    }
  }
}

function hardenLegacyPasswords() {
  if (!Array.isArray(db.users)) return;

  let changed = false;
  for (const user of db.users) {
    const storedPassword = String(user.password_hash || user.passwordHash || '');
    const isBcryptHash = storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2b$') || storedPassword.startsWith('$2y$');
    if (storedPassword && !isBcryptHash) {
      user.password_hash = bcrypt.hashSync(storedPassword, 12);
      changed = true;
    }
  }

  if (changed) {
    saveDb();
    console.log('Legacy plaintext passwords were upgraded to bcrypt hashes.');
  }
}

function issueToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      name: user.full_name || user.fullName || '',
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function findUserById(id) {
  return (Array.isArray(db.users) ? db.users : []).find(user => user.id === id);
}

function authenticateOptional(req, res, next) {
  const authHeader = req.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token) return next();

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = findUserById(payload.sub);
    if (user && user.status !== 'BLOCKED') {
      req.user = safeUser(user);
    }
  } catch {
    req.authError = true;
  }

  return next();
}

function requireAuth(req, res, next) {
  authenticateOptional(req, res, () => {
    if (req.user) return next();
    return res.status(401).json({ error: 'Authentication required' });
  });
}

function requireRoles(roles) {
  return (req, res, next) => {
    requireAuth(req, res, () => {
      if (roles.includes(req.user.role)) return next();
      return res.status(403).json({ error: 'Permission denied' });
    });
  };
}

async function verifyPassword(user, plainPassword) {
  const storedPassword = String(user?.password_hash || user?.passwordHash || '');
  if (!storedPassword) return false;

  if (storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2b$') || storedPassword.startsWith('$2y$')) {
    return bcrypt.compare(plainPassword, storedPassword);
  }

  const isLegacyMatch = storedPassword === plainPassword;
  if (isLegacyMatch) {
    user.password_hash = await bcrypt.hash(plainPassword, 12);
    saveDb();
  }
  return isLegacyMatch;
}

async function initializePostgres() {
  if (!pool) return false;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_state (
      collection TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  for (const collection of COLLECTION_NAMES) {
    await pool.query(
      `INSERT INTO app_state (collection, data)
       VALUES ($1, $2::jsonb)
       ON CONFLICT (collection) DO NOTHING`,
      [collection, JSON.stringify(db[collection])]
    );
  }

  const result = await pool.query('SELECT collection, data FROM app_state');
  for (const row of result.rows) {
    if (COLLECTION_NAMES.includes(row.collection)) {
      db[row.collection] = row.data;
    }
  }

  console.log('Database loaded from PostgreSQL');
  return true;
}

// Helper function to save DB to file
function saveDb() {
  if (pool) {
    writeQueue = writeQueue
      .then(async () => {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          for (const collection of COLLECTION_NAMES) {
            await client.query(
              `INSERT INTO app_state (collection, data, updated_at)
               VALUES ($1, $2::jsonb, NOW())
               ON CONFLICT (collection)
               DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
              [collection, JSON.stringify(db[collection])]
            );
          }
          await client.query('COMMIT');
        } catch (err) {
          await client.query('ROLLBACK');
          console.error('Failed to write PostgreSQL app_state:', err);
        } finally {
          client.release();
        }
      })
      .catch(err => {
        console.error('PostgreSQL write queue failed:', err);
      });
    return;
  }

  try {
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
    const tempFile = `${DB_FILE}.${process.pid}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(db, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error('Failed to write db.json:', err);
  }
}

applySeedPasswords();

// Initialize database: load from db.json if it exists, otherwise seed it
const usingPostgres = await initializePostgres();

if (!usingPostgres && fs.existsSync(DB_FILE)) {
  try {
    const rawData = fs.readFileSync(DB_FILE, 'utf-8');
    db = JSON.parse(rawData);
    console.log('Database loaded from db.json');
  } catch (err) {
    console.error('Error reading db.json, fallback to mock data seed:', err);
  }
} else if (!usingPostgres) {
  console.log('No db.json found. Seeding database with mock data and generating vector embeddings...');
  
  // Seed vector embeddings for initial rescue requests
  db.rescueRequests = db.rescueRequests.map(r => {
    const textToEmbed = `${r.full_name || ''} ${r.address_detail || ''} ${r.note || ''}`;
    return { ...r, vector_embedding: getEmbedding(textToEmbed) };
  });

  // Seed vector embeddings for initial warnings
  db.floodWarnings = db.floodWarnings.map(w => {
    const textToEmbed = `${w.title || ''} ${w.content || ''} ${w.area_name || ''}`;
    return { ...w, vector_embedding: getEmbedding(textToEmbed) };
  });

  // Seed vector embeddings for initial safe zones
  db.safeZones = db.safeZones.map(s => {
    const textToEmbed = `${s.name || ''} ${s.address || ''} ${s.notes || ''}`;
    return { ...s, vector_embedding: getEmbedding(textToEmbed) };
  });

  saveDb();
  console.log('Database successfully seeded and saved to db.json');
}

hardenLegacyPasswords();

// ---------------------- API ROUTES ----------------------

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    database: pool ? 'postgresql' : 'json-file',
    dbFile: pool ? null : DB_FILE,
    timestamp: new Date().toISOString()
  });
});

// 1. GET ALL DATABASE STATE (Sync on page load)
app.get('/api/db', authenticateOptional, (req, res) => {
  if (req.authError) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  res.json(sanitizeDbForUser(req.user));
});

// 2. AUTH LOGIN
app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const normalize = value => (typeof value === 'string' ? value.trim() : '');
    const { emailOrPhone, password } = req.body || {};
    const credential = normalize(emailOrPhone).toLowerCase();
    const plainPassword = normalize(password);

    if (!credential || !plainPassword) {
      return res.status(400).json({
        success: false,
        message: 'Vui long nhap email/so dien thoai va mat khau'
      });
    }

    const users = Array.isArray(db.users) ? db.users : [];
    if (users.length === 0) {
      console.error('Login failed: users collection is empty or invalid');
      return res.status(503).json({
        success: false,
        message: 'Du lieu nguoi dung chua san sang, vui long thu lai'
      });
    }

    const user = users.find(u => {
      const email = normalize(u?.email).toLowerCase();
      const phone = normalize(u?.phone);
      return email === credential || phone === credential;
    });

    if (!user || user.status === 'BLOCKED' || !(await verifyPassword(user, plainPassword))) {
      return res.status(401).json({
        success: false,
        message: 'Sai tai khoan hoac mat khau'
      });
    }

    const profiles = Array.isArray(db.citizenProfiles) ? db.citizenProfiles : [];
    const profile = profiles.find(p => p.user_id === user.id);
    const userForClient = safeUser(user);
    const token = issueToken(user);

    return res.json({ success: true, user: userForClient, profile: profile || null, token });
  } catch (err) {
    console.error('Login route failed:', err);
    return res.status(500).json({
      success: false,
      message: 'May chu dang loi dang nhap, vui long thu lai'
    });
  }
});

app.post('/api/auth/register', publicWriteLimiter, async (req, res) => {
  try {
    const normalize = value => (typeof value === 'string' ? value.trim() : '');
    const {
      full_name,
      phone,
      email,
      password,
      area_id,
      area_name,
      address_detail,
      household_size,
      has_elderly,
      has_children,
      has_disabled,
      emergency_contact_name,
      emergency_contact_phone,
    } = sanitizeObject(req.body || {});

    const cleanName = normalize(full_name);
    const cleanPhone = normalize(phone);
    const cleanEmail = normalize(email).toLowerCase();
    const cleanPassword = normalize(password);

    if (!cleanName || !cleanPhone || !cleanPassword || !normalize(area_id)) {
      return res.status(400).json({
        success: false,
        message: 'Vui long nhap day du ho ten, so dien thoai, mat khau va khu vuc'
      });
    }

    if (cleanPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Mat khau phai co it nhat 6 ky tu'
      });
    }

    const users = Array.isArray(db.users) ? db.users : [];
    const duplicatedUser = users.find(user => {
      const userPhone = normalize(user?.phone);
      const userEmail = normalize(user?.email).toLowerCase();
      return userPhone === cleanPhone || (cleanEmail && userEmail === cleanEmail);
    });

    if (duplicatedUser) {
      return res.status(409).json({
        success: false,
        message: 'So dien thoai hoac email da duoc dang ky'
      });
    }

    const area = (Array.isArray(db.areas) ? db.areas : []).find(item => item.id === area_id);
    const userId = `user-${Date.now()}`;
    const profileId = `cp-${Date.now()}`;
    const now = new Date().toISOString();
    const user = {
      id: userId,
      full_name: cleanName,
      phone: cleanPhone,
      email: cleanEmail || null,
      password_hash: await bcrypt.hash(cleanPassword, 12),
      role: 'CITIZEN',
      status: 'ACTIVE',
      created_at: now,
      avatar: null,
    };
    const profile = {
      id: profileId,
      user_id: userId,
      area_id,
      area_name: area?.old_name || area?.current_name || normalize(area_name),
      village_name: '',
      address_detail: normalize(address_detail),
      household_size: Number.parseInt(household_size, 10) || 1,
      elderly_count: has_elderly ? 1 : 0,
      children_count: has_children ? 1 : 0,
      disabled_count: has_disabled ? 1 : 0,
      medical_note: '',
      emergency_contact_name: normalize(emergency_contact_name),
      emergency_contact_phone: normalize(emergency_contact_phone),
      latitude: null,
      longitude: null,
      sms_opt_in: true,
    };

    db.users.push(user);
    if (!Array.isArray(db.citizenProfiles)) db.citizenProfiles = [];
    db.citizenProfiles.push(profile);
    saveDb();

    return res.status(201).json({
      success: true,
      user: safeUser(user),
      profile
    });
  } catch (err) {
    console.error('Register route failed:', err);
    return res.status(500).json({
      success: false,
      message: 'May chu dang loi dang ky, vui long thu lai'
    });
  }
});

app.use('/api/auth/login-legacy', (req, res) => {
  res.status(410).json({ success: false, message: 'Legacy login endpoint has been disabled' });
});

// 3. SEMANTIC VECTOR SEARCH
app.get('/api/search', requireRoles([...ADMIN_ROLES, ...RESCUE_ROLES]), (req, res) => {
  const { q, type } = req.query;
  if (!q) {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }

  let collection;
  let extractTextFn;

  if (type === 'requests') {
    collection = db.rescueRequests;
    extractTextFn = (item) => `${item.full_name || ''} ${item.address_detail || ''} ${item.note || ''}`;
  } else if (type === 'warnings') {
    collection = db.floodWarnings;
    extractTextFn = (item) => `${item.title || ''} ${item.content || ''} ${item.area_name || ''}`;
  } else if (type === 'safezones') {
    collection = db.safeZones;
    extractTextFn = (item) => `${item.name || ''} ${item.address || ''} ${item.notes || ''}`;
  } else {
    return res.status(400).json({ error: 'Invalid or missing "type" parameter. Must be "requests", "warnings", or "safezones"' });
  }

  const results = searchCollection(collection, q, extractTextFn);
  res.json(results);
});

// 4. FLOOD WARNINGS CRUD
app.post('/api/warnings', requireRoles(ADMIN_ROLES), (req, res) => {
  const data = pickAllowed(req.body, WARNING_FIELDS);
  const textToEmbed = `${data.title || ''} ${data.content || ''} ${data.area_name || ''}`;
  const warning = {
    id: `fw-${Date.now()}`,
    ...data,
    vector_embedding: getEmbedding(textToEmbed),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    sms_sent: false,
    sms_count: 0
  };
  db.floodWarnings.unshift(warning);
  saveDb();
  res.status(201).json(warning);
});

app.put('/api/warnings/:id', requireRoles(ADMIN_ROLES), (req, res) => {
  const { id } = req.params;
  const idx = db.floodWarnings.findIndex(w => w.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Warning not found' });

  const updatedData = { ...db.floodWarnings[idx], ...pickAllowed(req.body, WARNING_FIELDS), updated_at: new Date().toISOString() };
  const textToEmbed = `${updatedData.title || ''} ${updatedData.content || ''} ${updatedData.area_name || ''}`;
  updatedData.vector_embedding = getEmbedding(textToEmbed);

  db.floodWarnings[idx] = updatedData;
  saveDb();
  res.json(updatedData);
});

app.delete('/api/warnings/:id', requireRoles(ADMIN_ROLES), (req, res) => {
  const { id } = req.params;
  db.floodWarnings = db.floodWarnings.filter(w => w.id !== id);
  saveDb();
  res.json({ success: true });
});

// 5. RESCUE REQUESTS & MISSIONS
app.post('/api/rescue-requests', publicWriteLimiter, authenticateOptional, (req, res) => {
  const data = pickAllowed(req.body, RESCUE_REQUEST_PUBLIC_FIELDS);
  if (req.user) {
    data.user_id = req.user.id;
  }
  const textToEmbed = `${data.full_name || ''} ${data.address_detail || ''} ${data.note || ''}`;
  const request = {
    id: `rr-${Date.now()}`,
    ...data,
    vector_embedding: getEmbedding(textToEmbed),
    status: 'PENDING',
    assigned_team_id: null,
    assigned_team_name: null,
    created_at: new Date().toISOString(),
    accepted_at: null,
    completed_at: null
  };
  db.rescueRequests.unshift(request);
  saveDb();
  res.status(201).json(request);
});

app.put('/api/rescue-requests/:id', requireRoles([...ADMIN_ROLES, ...RESCUE_ROLES]), (req, res) => {
  const { id } = req.params;
  const idx = db.rescueRequests.findIndex(r => r.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Request not found' });

  db.rescueRequests[idx] = { ...db.rescueRequests[idx], ...pickAllowed(req.body, RESCUE_REQUEST_UPDATE_FIELDS) };
  saveDb();
  res.json(db.rescueRequests[idx]);
});

app.post('/api/rescue-requests/:id/assign', requireRoles(ADMIN_ROLES), (req, res) => {
  const { id } = req.params;
  const { teamId, teamName } = pickAllowed(req.body, ['teamId', 'teamName']);
  const currentUser = req.user;
  
  const reqIdx = db.rescueRequests.findIndex(r => r.id === id);
  if (reqIdx === -1) return res.status(404).json({ error: 'Request not found' });

  const request = db.rescueRequests[reqIdx];
  request.status = 'ASSIGNED';
  request.assigned_team_id = teamId;
  request.assigned_team_name = teamName;
  request.accepted_at = new Date().toISOString();

  // Create corresponding mission
  const mission = {
    id: `rm-${Date.now()}`,
    rescue_request_id: id,
    rescue_team_id: teamId,
    team_name: teamName,
    victim_name: request.full_name,
    victim_phone: request.phone,
    victim_latitude: request.latitude,
    victim_longitude: request.longitude,
    victim_address: request.address_detail,
    current_rescuer_latitude: null,
    current_rescuer_longitude: null,
    checkin_radius_meters: 100,
    max_gps_accuracy_meters: 50,
    min_stay_seconds: 60,
    status: 'ASSIGNED',
    assigned_at: new Date().toISOString(),
    accepted_at: null,
    started_at: null,
    auto_arrival_detected: false,
    auto_arrival_time: null,
    auto_arrival_distance_meters: null,
    manual_arrival_confirmed: false,
    manual_arrival_time: null,
    manual_arrival_by: null,
    rescued_people_count: null,
    destination_safe_zone_id: null,
    completed_at: null,
    completion_note: '',
    area_id: request.area_id,
    area_name: request.area_name,
    created_at: new Date().toISOString()
  };
  
  db.rescueMissions.unshift(mission);

  // Add activity log
  const log = {
    id: `al-${Date.now()}`,
    user_id: currentUser?.id || null,
    user_name: currentUser?.full_name || 'Hệ thống',
    action: 'Phân công đội cứu hộ',
    table_name: 'rescue_requests',
    record_id: id,
    note: `Phân công ${teamName}`,
    created_at: new Date().toISOString()
  };
  db.activityLogs.unshift(log);

  // Add notification for team
  const notif = {
    id: `notif-${Date.now()}`,
    user_id: 'user-rescue-1', // Default lead
    title: 'Nhiệm vụ mới!',
    message: `Bạn được phân công cứu hộ ${request.full_name}`,
    type: 'MISSION_ASSIGNED',
    is_read: false,
    created_at: new Date().toISOString(),
    related_id: mission.id
  };
  db.notifications.unshift(notif);

  saveDb();
  res.json({ success: true, request, mission });
});

// 6. UPDATE MISSION STATUS (and link request status)
app.post('/api/missions/:id/status', requireRoles([...ADMIN_ROLES, ...RESCUE_ROLES]), (req, res) => {
  const { id } = req.params;
  const { newStatus, extraData, changedByType, note } = pickAllowed(req.body, ['newStatus', 'extraData', 'changedByType', 'note']);
  const changedByUser = req.user;

  const missionIdx = db.rescueMissions.findIndex(m => m.id === id);
  if (missionIdx === -1) return res.status(404).json({ error: 'Mission not found' });

  const mission = db.rescueMissions[missionIdx];
  const oldStatus = mission.status;

  // Update mission
  db.rescueMissions[missionIdx] = { ...mission, status: newStatus, ...sanitizeObject(extraData) };

  // Log status change
  const logEntry = {
    id: `msl-${Date.now()}`,
    mission_id: id,
    old_status: oldStatus,
    new_status: newStatus,
    changed_by_type: changedByType || 'RESCUE_TEAM',
    changed_by_user_id: changedByUser?.id || null,
    note: note || `Cập nhật trạng thái sang ${newStatus}`,
    created_at: new Date().toISOString()
  };
  db.missionStatusLogs.push(logEntry);

  // Update request status
  const reqIdx = db.rescueRequests.findIndex(r => r.id === mission.rescue_request_id);
  if (reqIdx !== -1) {
    db.rescueRequests[reqIdx].status = newStatus;
    if (newStatus === 'RESCUED' || newStatus === 'TRANSFERRED_SAFEZONE') {
      db.rescueRequests[reqIdx].completed_at = new Date().toISOString();
    }
  }

  saveDb();
  res.json({ success: true, mission: db.rescueMissions[missionIdx] });
});

// 7. RESCUE TEAMS CRUD
app.post('/api/teams', requireRoles(ADMIN_ROLES), (req, res) => {
  const team = {
    id: `team-${Date.now()}`,
    ...pickAllowed(req.body, TEAM_FIELDS),
    created_at: new Date().toISOString()
  };
  db.rescueTeams.push(team);
  saveDb();
  res.status(201).json(team);
});

app.put('/api/teams/:id', requireRoles(ADMIN_ROLES), (req, res) => {
  const { id } = req.params;
  const idx = db.rescueTeams.findIndex(t => t.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Team not found' });

  db.rescueTeams[idx] = { ...db.rescueTeams[idx], ...pickAllowed(req.body, TEAM_FIELDS) };
  saveDb();
  res.json(db.rescueTeams[idx]);
});

app.delete('/api/teams/:id', requireRoles(ADMIN_ROLES), (req, res) => {
  const { id } = req.params;
  db.rescueTeams = db.rescueTeams.filter(t => t.id !== id);
  saveDb();
  res.json({ success: true });
});

// 8. SAFE ZONES CRUD
app.post('/api/safe-zones', requireRoles(ADMIN_ROLES), (req, res) => {
  const data = pickAllowed(req.body, SAFE_ZONE_FIELDS);
  const textToEmbed = `${data.name || ''} ${data.address || ''} ${data.notes || ''}`;
  const sz = {
    id: `sz-${Date.now()}`,
    ...data,
    vector_embedding: getEmbedding(textToEmbed),
    created_at: new Date().toISOString()
  };
  db.safeZones.push(sz);
  saveDb();
  res.status(201).json(sz);
});

app.put('/api/safe-zones/:id', requireRoles(ADMIN_ROLES), (req, res) => {
  const { id } = req.params;
  const idx = db.safeZones.findIndex(s => s.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Safe zone not found' });

  const updated = { ...db.safeZones[idx], ...pickAllowed(req.body, SAFE_ZONE_FIELDS) };
  const textToEmbed = `${updated.name || ''} ${updated.address || ''} ${updated.notes || ''}`;
  updated.vector_embedding = getEmbedding(textToEmbed);

  db.safeZones[idx] = updated;
  saveDb();
  res.json(updated);
});

app.delete('/api/safe-zones/:id', requireRoles(ADMIN_ROLES), (req, res) => {
  const { id } = req.params;
  db.safeZones = db.safeZones.filter(s => s.id !== id);
  saveDb();
  res.json({ success: true });
});

// 9. RESCUE ROUTES CRUD
app.post('/api/routes', requireRoles(ADMIN_ROLES), (req, res) => {
  const route = {
    id: `route-${Date.now()}`,
    ...pickAllowed(req.body, ROUTE_FIELDS),
    created_at: new Date().toISOString()
  };
  db.rescueRoutes.push(route);
  saveDb();
  res.status(201).json(route);
});

app.put('/api/routes/:id', requireRoles(ADMIN_ROLES), (req, res) => {
  const { id } = req.params;
  const idx = db.rescueRoutes.findIndex(r => r.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Route not found' });

  db.rescueRoutes[idx] = { ...db.rescueRoutes[idx], ...pickAllowed(req.body, ROUTE_FIELDS) };
  saveDb();
  res.json(db.rescueRoutes[idx]);
});

app.delete('/api/routes/:id', requireRoles(ADMIN_ROLES), (req, res) => {
  const { id } = req.params;
  db.rescueRoutes = db.rescueRoutes.filter(r => r.id !== id);
  saveDb();
  res.json({ success: true });
});

// 10. ACTIVITY LOGS, DAMAGE REPORTS, SMS LOGS & VULNERABLE HOUSEHOLDS
app.post('/api/damage-reports', requireRoles(ADMIN_ROLES), (req, res) => {
  const dr = {
    id: `dr-${Date.now()}`,
    ...pickAllowed(req.body, DAMAGE_REPORT_FIELDS),
    status: 'PENDING',
    created_at: new Date().toISOString()
  };
  db.damageReports.unshift(dr);
  saveDb();
  res.status(201).json(dr);
});

app.post('/api/vulnerable-households', requireRoles(ADMIN_ROLES), (req, res) => {
  const vh = {
    id: `vh-${Date.now()}`,
    ...pickAllowed(req.body, VULNERABLE_HOUSEHOLD_FIELDS),
    created_at: new Date().toISOString()
  };
  db.vulnerableHouseholds.push(vh);
  saveDb();
  res.status(201).json(vh);
});

app.put('/api/vulnerable-households/:id', requireRoles(ADMIN_ROLES), (req, res) => {
  const { id } = req.params;
  const idx = db.vulnerableHouseholds.findIndex(v => v.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Vulnerable household not found' });

  db.vulnerableHouseholds[idx] = { ...db.vulnerableHouseholds[idx], ...pickAllowed(req.body, VULNERABLE_HOUSEHOLD_FIELDS) };
  saveDb();
  res.json(db.vulnerableHouseholds[idx]);
});

app.post('/api/sms-logs', requireRoles(ADMIN_ROLES), (req, res) => {
  const log = {
    id: `sms-${Date.now()}`,
    ...pickAllowed(req.body, SMS_LOG_FIELDS),
    sent_at: new Date().toISOString()
  };
  db.smsLogs.unshift(log);
  saveDb();
  res.status(201).json(log);
});

app.put('/api/notifications/:id/read', requireAuth, (req, res) => {
  const { id } = req.params;
  const idx = db.notifications.findIndex(n => n.id === id);
  if (idx !== -1) {
    const notification = db.notifications[idx];
    if (notification.user_id && notification.user_id !== req.user.id && !ADMIN_ROLES.includes(req.user.role)) {
      return res.status(403).json({ error: 'Permission denied' });
    }
    db.notifications[idx].is_read = true;
    saveDb();
  }
  res.json({ success: true });
});

// Serve the production React build from the same domain as the API.
if (fs.existsSync(DIST_DIR)) {
  app.use('/static-assets', express.static(path.join(DIST_DIR, 'static-assets'), {
    index: false,
    maxAge: 0,
    setHeaders(res) {
      res.setHeader('Cache-Control', 'no-store');
    },
  }));

  app.use('/assets', express.static(path.join(DIST_DIR, 'assets'), {
    index: false,
    maxAge: 0,
    setHeaders(res) {
      res.setHeader('Cache-Control', 'no-store');
    },
  }));

  app.use(express.static(DIST_DIR, {
    index: false,
    maxAge: 0,
    setHeaders(res, filePath) {
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-store');
      }
    },
  }));

  app.use('/assets', (req, res) => {
    res.status(404).type('text/plain').send('Asset not found');
  });

  app.use('/static-assets', (req, res) => {
    res.status(404).type('text/plain').send('Static asset not found');
  });

  app.get('*', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
} else {
  console.warn('dist directory not found. Run "npm run build" before starting production server.');
}

// Listen to port
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(pool ? 'Database: PostgreSQL' : `Database file: ${DB_FILE}`);
});
