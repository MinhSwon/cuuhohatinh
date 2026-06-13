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
const DB_CONNECT_RETRIES = Number(process.env.DB_CONNECT_RETRIES || 8);
const DB_CONNECT_RETRY_DELAY_MS = Number(process.env.DB_CONNECT_RETRY_DELAY_MS || 3000);
const DB_FILE = process.env.DB_FILE ? path.resolve(process.env.DB_FILE) : path.join(__dirname, 'db.json');
const DIST_DIR = path.join(__dirname, 'dist');
const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};
const BCRYPT_ROUNDS = parsePositiveInt(process.env.BCRYPT_ROUNDS, 10);
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
const sseClients = new Map();

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
  IS_DEPLOYED_RUNTIME ? 300 : 300
);
const ESMS_API_KEY = process.env.ESMS_API_KEY || '';
const ESMS_SECRET_KEY = process.env.ESMS_SECRET_KEY || '';
const ESMS_BRANDNAME = process.env.ESMS_BRANDNAME || '';
const ESMS_SANDBOX = process.env.ESMS_SANDBOX ?? (IS_DEPLOYED_RUNTIME ? '0' : '1');
const ESMS_CALLBACK_URL = process.env.ESMS_CALLBACK_URL || '';
const ESMS_CALLBACK_TOKEN = process.env.ESMS_CALLBACK_TOKEN || '';
const ESMS_SMS_ENDPOINT = 'https://rest.esms.vn/MainService.svc/json/SendMultipleMessage_V4_post_json/';
const ESMS_MULTI_CHANNEL_ENDPOINT = 'https://rest.esms.vn/MainService.svc/json/MultiChannelMessage/';
const ZALO_OA_ID = process.env.ZALO_OA_ID || '';
const ZALO_ZNS_TEMPLATE_SOS = process.env.ZALO_ZNS_TEMPLATE_SOS || '';
const ZALO_ZNS_TEMPLATE_ASSIGNED = process.env.ZALO_ZNS_TEMPLATE_ASSIGNED || '';
const RESCUE_COORDINATOR_PHONES = (process.env.RESCUE_COORDINATOR_PHONES || '')
  .split(',')
  .map(phone => phone.trim())
  .filter(Boolean);

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
const TEST_SAFE_ZONE_NAME_PATTERN = /\b(test|fake|stress|demo|sample|dummy)\b/i;
const WARNING_FIELDS = ['title', 'content', 'level', 'status', 'area_id', 'area_name', 'start_time', 'end_time'];
const RESCUE_REQUEST_PUBLIC_FIELDS = [
  'full_name', 'phone', 'area_id', 'area_name', 'address_detail', 'description', 'note',
  'number_of_people', 'emergency_level', 'latitude', 'longitude', 'has_elderly',
  'has_children', 'has_disabled', 'has_medical_case', 'need_food_water', 'sos_mode',
  'requester_type', 'reporter_name', 'reporter_phone', 'reporter_relationship',
  'reporter_latitude', 'reporter_longitude', 'victim_name', 'victim_phone',
  'victim_area_id', 'victim_area_name', 'victim_address_detail', 'victim_latitude',
  'victim_longitude',
];
const RESCUE_REQUEST_UPDATE_FIELDS = [
  ...RESCUE_REQUEST_PUBLIC_FIELDS, 'status', 'assigned_team_id', 'assigned_team_name',
  'accepted_at', 'completed_at', 'verification_status', 'priority_score',
  'duplicate_group_id', 'cluster_id', 'nearby_active_mission_id',
  'nearby_active_team_name', 'coordination_note',
];
const TEAM_FIELDS = [
  'team_name', 'name', 'phone', 'leader_user_id', 'leader_id', 'leader_name',
  'status', 'latitude', 'longitude', 'member_count', 'memberCount', 'vehicle_type', 'note', 'notes', 'area_id', 'area_name',
  'max_active_missions', 'current_active_missions', 'max_people_per_trip',
  'vehicle_capacity', 'service_radius_km', 'equipment_tags',
];
const SAFE_ZONE_FIELDS = [
  'name', 'address', 'area_id', 'area_name', 'capacity', 'current_people', 'latitude',
  'longitude', 'contact_person', 'contact_phone', 'manager_name', 'manager_phone', 'notes', 'status',
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
const SMS_LOG_FIELDS = [
  'recipient', 'phone', 'message', 'status', 'provider', 'error', 'user_id',
  'flood_warning_id', 'floodAlertId', 'related_warning_id', 'related_request_id',
  'request_id', 'provider_message_id', 'channel', 'raw_response', 'cost',
  'sent_at', 'delivered_at',
];

function createId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function toPgTimestamp(value) {
  return value ? new Date(value) : null;
}

function toIsoString(value) {
  return value instanceof Date ? value.toISOString() : value || null;
}

function userRowToApi(row) {
  if (!row) return null;
  return {
    id: row.id,
    full_name: row.full_name,
    phone: row.phone,
    email: row.email,
    password_hash: row.password_hash,
    role: row.role,
    status: row.status,
    avatar: row.avatar,
    created_at: toIsoString(row.created_at),
    updated_at: toIsoString(row.updated_at),
  };
}

function citizenProfileRowToApi(row) {
  if (!row) return null;
  return {
    id: row.id,
    user_id: row.user_id,
    area_id: row.area_id,
    area_name: row.area_name,
    village_name: row.village_name || '',
    address_detail: row.address_detail,
    household_size: row.household_size,
    elderly_count: row.elderly_count,
    children_count: row.children_count,
    disabled_count: row.disabled_count,
    medical_note: row.medical_note || '',
    emergency_contact_name: row.emergency_contact_name || '',
    emergency_contact_phone: row.emergency_contact_phone || '',
    latitude: row.latitude,
    longitude: row.longitude,
    sms_opt_in: row.sms_opt_in,
    created_at: toIsoString(row.created_at),
    updated_at: toIsoString(row.updated_at),
  };
}

function rescueRequestRowToApi(row) {
  if (!row) return null;
  return {
    id: row.id,
    full_name: row.full_name,
    phone: row.phone,
    area_id: row.area_id,
    area_name: row.area_name,
    address_detail: row.address_detail,
    description: row.description,
    note: row.note,
    number_of_people: row.number_of_people,
    emergency_level: row.emergency_level,
    latitude: row.latitude,
    longitude: row.longitude,
    has_elderly: row.has_elderly,
    has_children: row.has_children,
    has_disabled: row.has_disabled,
    has_medical_case: row.has_medical_case,
    need_food_water: row.need_food_water,
    sos_mode: row.sos_mode,
    requester_type: row.requester_type,
    reporter_name: row.reporter_name,
    reporter_phone: row.reporter_phone,
    reporter_relationship: row.reporter_relationship,
    reporter_latitude: row.reporter_latitude,
    reporter_longitude: row.reporter_longitude,
    victim_name: row.victim_name,
    victim_phone: row.victim_phone,
    victim_area_id: row.victim_area_id,
    victim_area_name: row.victim_area_name,
    victim_address_detail: row.victim_address_detail,
    victim_latitude: row.victim_latitude,
    victim_longitude: row.victim_longitude,
    verification_status: row.verification_status,
    priority_score: row.priority_score,
    duplicate_group_id: row.duplicate_group_id,
    cluster_id: row.cluster_id,
    nearby_active_mission_id: row.nearby_active_mission_id,
    nearby_active_team_name: row.nearby_active_team_name,
    coordination_note: row.coordination_note,
    status: row.status,
    assigned_team_id: row.assigned_team_id,
    assigned_team_name: row.assigned_team_name,
    user_id: row.created_by_user_id,
    created_by_user_id: row.created_by_user_id,
    created_at: toIsoString(row.created_at),
    accepted_at: toIsoString(row.accepted_at),
    completed_at: toIsoString(row.completed_at),
    updated_at: toIsoString(row.updated_at),
  };
}

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

function toFiniteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

const ACTIVE_RESCUE_STATUSES = new Set([
  'ASSIGNED',
  'ACCEPTED',
  'MOVING',
  'NEAR_VICTIM',
  'ARRIVED_CONFIRMED',
  'RESCUING',
  'NEED_SUPPORT',
]);

function normalizeBoolean(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function toOptionalNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function getLatLng(item, latKeys = ['latitude', 'victim_latitude'], lngKeys = ['longitude', 'victim_longitude']) {
  for (const latKey of latKeys) {
    for (const lngKey of lngKeys) {
      const lat = toOptionalNumber(item?.[latKey]);
      const lng = toOptionalNumber(item?.[lngKey]);
      if (lat !== null && lng !== null) return { lat, lng };
    }
  }
  return null;
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const earthRadiusMeters = 6371000;
  const toRad = degrees => degrees * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calculatePriorityScore(data) {
  const levelScore = { LOW: 5, MEDIUM: 15, HIGH: 30, EMERGENCY: 50 }[data.emergency_level] || 20;
  const people = Math.max(1, Number.parseInt(data.number_of_people, 10) || 1);
  return levelScore +
    people * 2 +
    (normalizeBoolean(data.has_children) ? 9 : 0) +
    (normalizeBoolean(data.has_elderly) ? 9 : 0) +
    (normalizeBoolean(data.has_disabled) ? 12 : 0) +
    (normalizeBoolean(data.has_medical_case) ? 15 : 0) +
    (normalizeBoolean(data.need_food_water) ? 6 : 0);
}

function normalizeRescueRequestInput(rawData, user) {
  const data = { ...rawData };
  const requesterType = ['SELF', 'RELATIVE', 'WITNESS', 'OPERATOR'].includes(data.requester_type)
    ? data.requester_type
    : 'SELF';

  const victimName = data.victim_name || data.full_name || 'Nguoi can cuu ho';
  const victimPhone = data.victim_phone || data.phone || '';
  const victimAreaId = data.victim_area_id || data.area_id || '';
  const victimAreaName = data.victim_area_name || data.area_name || '';
  const victimAddress = data.victim_address_detail || data.address_detail || '';
  const victimLatitude = toOptionalNumber(data.victim_latitude ?? data.latitude);
  const victimLongitude = toOptionalNumber(data.victim_longitude ?? data.longitude);
  const reporterLatitude = toOptionalNumber(data.reporter_latitude);
  const reporterLongitude = toOptionalNumber(data.reporter_longitude);

  const verificationStatus = requesterType === 'SELF' || (victimLatitude !== null && victimLongitude !== null)
    ? 'VERIFIED'
    : 'NEEDS_VERIFICATION';

  return {
    ...data,
    user_id: user?.id || data.user_id || null,
    requester_type: requesterType,
    reporter_name: data.reporter_name || (requesterType === 'SELF' ? victimName : ''),
    reporter_phone: data.reporter_phone || (requesterType === 'SELF' ? victimPhone : ''),
    reporter_relationship: data.reporter_relationship || (requesterType === 'SELF' ? 'SELF' : ''),
    reporter_latitude: reporterLatitude,
    reporter_longitude: reporterLongitude,
    victim_name: victimName,
    victim_phone: victimPhone,
    victim_area_id: victimAreaId,
    victim_area_name: victimAreaName,
    victim_address_detail: victimAddress,
    victim_latitude: victimLatitude,
    victim_longitude: victimLongitude,
    full_name: victimName,
    phone: victimPhone,
    area_id: victimAreaId,
    area_name: victimAreaName,
    address_detail: victimAddress,
    latitude: victimLatitude,
    longitude: victimLongitude,
    has_elderly: normalizeBoolean(data.has_elderly),
    has_children: normalizeBoolean(data.has_children),
    has_disabled: normalizeBoolean(data.has_disabled),
    has_medical_case: normalizeBoolean(data.has_medical_case),
    need_food_water: normalizeBoolean(data.need_food_water),
    sos_mode: normalizeBoolean(data.sos_mode),
    number_of_people: Math.max(1, Number.parseInt(data.number_of_people, 10) || 1),
    emergency_level: ['LOW', 'MEDIUM', 'HIGH', 'EMERGENCY'].includes(data.emergency_level) ? data.emergency_level : 'HIGH',
    verification_status: data.verification_status || verificationStatus,
  };
}

function findNearbyActiveMissionForRequest(request, radiusMeters = 250) {
  const requestPos = getLatLng(request);
  if (!requestPos || !Array.isArray(db.rescueMissions)) return null;

  let closest = null;
  for (const mission of db.rescueMissions) {
    if (!ACTIVE_RESCUE_STATUSES.has(mission.status)) continue;
    const missionPos = getLatLng(mission, ['victim_latitude'], ['victim_longitude']);
    if (!missionPos) continue;
    const distance = haversineMeters(requestPos.lat, requestPos.lng, missionPos.lat, missionPos.lng);
    if (distance <= radiusMeters && (!closest || distance < closest.distance_meters)) {
      closest = {
        mission,
        distance_meters: Math.round(distance),
      };
    }
  }
  return closest;
}

function enrichRescueRequestCoordination(data) {
  const nearby = findNearbyActiveMissionForRequest(data);
  const priorityScore = calculatePriorityScore(data);
  const clusterSeed = data.area_id || data.area_name || 'unknown';

  return {
    ...data,
    priority_score: priorityScore,
    duplicate_group_id: nearby ? nearby.mission.rescue_request_id || nearby.mission.id : null,
    cluster_id: nearby ? nearby.mission.cluster_id || `cluster-${clusterSeed}` : `cluster-${clusterSeed}`,
    nearby_active_mission_id: nearby?.mission?.id || null,
    nearby_active_team_name: nearby?.mission?.team_name || null,
    coordination_note: nearby
      ? `Gan nhiem vu ${nearby.mission.id} cua ${nearby.mission.team_name} (${nearby.distance_meters}m). Nen gom cum hoac dieu doi ho tro.`
      : '',
  };
}

function getTeamActiveMissionCount(teamId) {
  if (!teamId || !Array.isArray(db.rescueMissions)) return 0;
  return db.rescueMissions.filter(mission =>
    mission.rescue_team_id === teamId && ACTIVE_RESCUE_STATUSES.has(mission.status)
  ).length;
}

function getTeamMaxActiveMissions(team) {
  const configured = Number.parseInt(team?.max_active_missions, 10);
  if (Number.isFinite(configured) && configured > 0) return configured;
  return team?.status === 'BUSY' ? 1 : 2;
}

function syncTeamLoad(teamId) {
  if (!teamId || !Array.isArray(db.rescueTeams)) return null;
  const team = db.rescueTeams.find(item => item.id === teamId);
  if (!team) return null;

  const activeCount = getTeamActiveMissionCount(teamId);
  const maxActive = getTeamMaxActiveMissions(team);
  team.current_active_missions = activeCount;

  if (!['OFFLINE', 'MAINTENANCE'].includes(team.status)) {
    team.status = activeCount >= maxActive ? 'BUSY' : 'AVAILABLE';
  }

  return team;
}

function getAssignmentWarnings(request, team) {
  const warnings = [];
  if (request?.nearby_active_mission_id) {
    warnings.push({
      type: 'NEARBY_ACTIVE_MISSION',
      message: `Khu vuc nay da co doi ${request.nearby_active_team_name || 'khac'} dang den. Nen xac minh de tranh nhieu doi cung den mot diem.`,
    });
  }

  if (!getLatLng(request)) {
    warnings.push({
      type: 'NEEDS_LOCATION_VERIFICATION',
      message: 'Yeu cau chua co toa do GPS cua nguoi can cuu. Can goi xac minh truoc khi dieu phoi.',
    });
  }

  if (team) {
    const activeCount = getTeamActiveMissionCount(team.id);
    const maxActive = getTeamMaxActiveMissions(team);
    if (activeCount >= maxActive) {
      warnings.push({
        type: 'TEAM_OVER_CAPACITY',
        message: `${team.team_name || team.name || 'Doi cuu ho'} da dat tai ${activeCount}/${maxActive} nhiem vu dang xu ly.`,
      });
    }
    if (['OFFLINE', 'MAINTENANCE'].includes(team.status)) {
      warnings.push({
        type: 'TEAM_UNAVAILABLE',
        message: `${team.team_name || team.name || 'Doi cuu ho'} dang o trang thai ${team.status}.`,
      });
    }
  }

  return warnings;
}

function normalizeVietnamPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('84')) return digits;
  if (digits.startsWith('0')) return `84${digits.slice(1)}`;
  return digits;
}

function maskPhone(phone) {
  const normalized = normalizeVietnamPhone(phone);
  if (normalized.length < 6) return normalized;
  return `${normalized.slice(0, 4)}***${normalized.slice(-3)}`;
}

function getEsmsCallbackUrl(requestId) {
  if (!ESMS_CALLBACK_URL) return undefined;
  try {
    const url = new URL(ESMS_CALLBACK_URL);
    if (ESMS_CALLBACK_TOKEN) url.searchParams.set('token', ESMS_CALLBACK_TOKEN);
    if (requestId) url.searchParams.set('request_id', requestId);
    return url.toString();
  } catch {
    return ESMS_CALLBACK_URL;
  }
}

function hasEsmsSmsConfig() {
  return Boolean(ESMS_API_KEY && ESMS_SECRET_KEY && ESMS_BRANDNAME);
}

function hasEsmsZaloConfig(templateId) {
  return Boolean(hasEsmsSmsConfig() && ZALO_OA_ID && templateId);
}

function createSmsLog(data) {
  return {
    id: createId('sms'),
    provider: data.provider || 'eSMS',
    channel: data.channel || 'sms',
    phone: normalizeVietnamPhone(data.phone),
    recipient: data.recipient || '',
    message: data.message || '',
    status: data.status || 'PENDING',
    error: data.error || '',
    request_id: data.request_id || null,
    provider_message_id: data.provider_message_id || null,
    related_warning_id: data.related_warning_id || data.flood_warning_id || data.floodAlertId || null,
    related_request_id: data.related_request_id || null,
    raw_response: data.raw_response || null,
    cost: Number(data.cost || 0),
    sent_at: data.sent_at || new Date().toISOString(),
    delivered_at: data.delivered_at || null,
  };
}

function addSmsLog(data, { persist = true, broadcast = true } = {}) {
  const log = createSmsLog(data);
  if (!Array.isArray(db.smsLogs)) db.smsLogs = [];
  db.smsLogs.unshift(log);
  if (persist) saveDb();
  if (broadcast) broadcastDbUpdate('sms-log:created', ['smsLogs']);
  return log;
}

function updateSmsLogByRequestId(requestId, patch) {
  if (!requestId || !Array.isArray(db.smsLogs)) return null;
  const idx = db.smsLogs.findIndex(log => log.request_id === requestId);
  if (idx === -1) return null;
  db.smsLogs[idx] = { ...db.smsLogs[idx], ...patch, raw_response: patch.raw_response || db.smsLogs[idx].raw_response };
  saveDb();
  broadcastDbUpdate('sms-log:updated', ['smsLogs']);
  return db.smsLogs[idx];
}

async function postJsonWithTimeout(url, body, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await response.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text };
    }
    return { ok: response.ok, status: response.status, data: json };
  } finally {
    clearTimeout(timeout);
  }
}

function getEsmsStatus(responseData) {
  const code = String(responseData?.CodeResult || responseData?.code || '');
  return code === '100' ? 'SENT' : 'FAILED';
}

async function sendEsmsSms({ phone, content, requestId, relatedWarningId, relatedRequestId, recipient }) {
  const normalizedPhone = normalizeVietnamPhone(phone);
  if (!normalizedPhone) {
    return addSmsLog({
      phone,
      recipient,
      message: content,
      status: 'FAILED',
      provider: 'eSMS',
      channel: 'sms',
      request_id: requestId,
      related_warning_id: relatedWarningId,
      related_request_id: relatedRequestId,
      error: 'Missing receiver phone',
    });
  }

  if (!hasEsmsSmsConfig()) {
    return addSmsLog({
      phone: normalizedPhone,
      recipient,
      message: content,
      status: 'FAILED',
      provider: 'eSMS',
      channel: 'sms',
      request_id: requestId,
      related_warning_id: relatedWarningId,
      related_request_id: relatedRequestId,
      error: 'eSMS is not configured. Set ESMS_API_KEY, ESMS_SECRET_KEY, ESMS_BRANDNAME.',
    });
  }

  const body = {
    ApiKey: ESMS_API_KEY,
    SecretKey: ESMS_SECRET_KEY,
    Brandname: ESMS_BRANDNAME,
    Phone: normalizedPhone,
    Content: content,
    SmsType: '2',
    IsUnicode: '1',
    Sandbox: ESMS_SANDBOX,
    RequestId: requestId,
  };
  const callbackUrl = getEsmsCallbackUrl(requestId);
  if (callbackUrl) body.CallbackUrl = callbackUrl;

  try {
    const response = await postJsonWithTimeout(ESMS_SMS_ENDPOINT, body);
    const status = response.ok ? getEsmsStatus(response.data) : 'FAILED';
    return addSmsLog({
      phone: normalizedPhone,
      recipient,
      message: content,
      status,
      provider: 'eSMS',
      channel: 'sms',
      request_id: requestId,
      provider_message_id: response.data?.SMSID || null,
      related_warning_id: relatedWarningId,
      related_request_id: relatedRequestId,
      error: status === 'FAILED' ? response.data?.ErrorMessage || `HTTP ${response.status}` : '',
      raw_response: response.data,
    });
  } catch (err) {
    return addSmsLog({
      phone: normalizedPhone,
      recipient,
      message: content,
      status: 'FAILED',
      provider: 'eSMS',
      channel: 'sms',
      request_id: requestId,
      related_warning_id: relatedWarningId,
      related_request_id: relatedRequestId,
      error: err?.message || 'eSMS request failed',
    });
  }
}

async function sendEsmsZaloThenSms({
  phone,
  templateId,
  params = [],
  smsContent,
  requestId,
  relatedWarningId,
  relatedRequestId,
  recipient,
}) {
  if (!hasEsmsZaloConfig(templateId)) {
    return sendEsmsSms({
      phone,
      content: smsContent,
      requestId: `${requestId}-sms`,
      relatedWarningId,
      relatedRequestId,
      recipient,
    });
  }

  const normalizedPhone = normalizeVietnamPhone(phone);
  const callbackUrl = getEsmsCallbackUrl(requestId);
  const body = {
    ApiKey: ESMS_API_KEY,
    SecretKey: ESMS_SECRET_KEY,
    Phone: normalizedPhone,
    Channels: ['zalo', 'sms'],
    Data: [
      {
        TempID: templateId,
        Params: params.map(value => String(value ?? '')),
        OAID: ZALO_OA_ID,
        RequestId: `${requestId}-zalo`,
        Sandbox: ESMS_SANDBOX,
        SendingMode: '1',
        ...(callbackUrl ? { CallbackUrl: callbackUrl } : {}),
      },
      {
        Content: smsContent,
        IsUnicode: '1',
        SmsType: '2',
        Brandname: ESMS_BRANDNAME,
        RequestId: `${requestId}-sms`,
        Sandbox: ESMS_SANDBOX,
        ...(callbackUrl ? { CallbackUrl: callbackUrl } : {}),
      },
    ],
  };

  try {
    const response = await postJsonWithTimeout(ESMS_MULTI_CHANNEL_ENDPOINT, body);
    const status = response.ok ? getEsmsStatus(response.data) : 'FAILED';
    return addSmsLog({
      phone: normalizedPhone,
      recipient,
      message: smsContent,
      status,
      provider: 'eSMS',
      channel: 'zalo_sms',
      request_id: requestId,
      provider_message_id: response.data?.SMSID || null,
      related_warning_id: relatedWarningId,
      related_request_id: relatedRequestId,
      error: status === 'FAILED' ? response.data?.ErrorMessage || `HTTP ${response.status}` : '',
      raw_response: response.data,
    });
  } catch (err) {
    return addSmsLog({
      phone: normalizedPhone,
      recipient,
      message: smsContent,
      status: 'FAILED',
      provider: 'eSMS',
      channel: 'zalo_sms',
      request_id: requestId,
      related_warning_id: relatedWarningId,
      related_request_id: relatedRequestId,
      error: err?.message || 'eSMS multi-channel request failed',
    });
  }
}

function getUserById(userId) {
  return Array.isArray(db.users) ? db.users.find(user => user.id === userId) : null;
}

function collectNotificationRecipients({ target = 'all', area_id = '' } = {}) {
  const recipients = new Map();
  const addRecipient = (phone, recipient = '', source = '') => {
    const normalizedPhone = normalizeVietnamPhone(phone);
    if (!normalizedPhone) return;
    recipients.set(normalizedPhone, { phone: normalizedPhone, recipient, source });
  };

  if (target === 'vulnerable') {
    for (const household of Array.isArray(db.vulnerableHouseholds) ? db.vulnerableHouseholds : []) {
      if (area_id && household.area_id !== area_id) continue;
      addRecipient(household.phone, household.full_name || household.head_name, 'vulnerable_household');
      addRecipient(household.emergency_contact_phone, household.emergency_contact_name, 'vulnerable_contact');
    }
  } else {
    for (const profile of Array.isArray(db.citizenProfiles) ? db.citizenProfiles : []) {
      if (profile.sms_opt_in === false) continue;
      if (target === 'area' && area_id && profile.area_id !== area_id) continue;
      const user = getUserById(profile.user_id);
      addRecipient(user?.phone, user?.full_name, 'citizen_profile');
      addRecipient(profile.emergency_contact_phone, profile.emergency_contact_name, 'emergency_contact');
    }
  }

  return Array.from(recipients.values());
}

async function sendBulkSms({ recipients, message, relatedWarningId = null, relatedRequestId = null, requestPrefix = 'bulk' }) {
  const logs = [];
  for (const [index, recipient] of recipients.entries()) {
    const requestId = `${requestPrefix}-${index + 1}-${Date.now()}`;
    // Sequential sending keeps provider throttling predictable for small MVP-to-production deployments.
    // If volume grows, replace this with a persistent queue worker.
    const log = await sendEsmsSms({
      phone: recipient.phone,
      content: message,
      requestId,
      recipient: recipient.recipient,
      relatedWarningId,
      relatedRequestId,
    });
    logs.push(log);
  }
  return logs;
}

function fireAndForgetNotification(task, label) {
  Promise.resolve()
    .then(task)
    .catch(err => console.error(`${label || 'Notification task'} failed:`, err));
}

async function notifyRescueRequestCreated(request) {
  const area = request.victim_area_name || request.area_name || 'chua xac dinh';
  const peopleCount = request.number_of_people || 1;
  const level = request.emergency_level || 'HIGH';
  const victimName = request.victim_name || request.full_name || 'Nguoi can cuu ho';
  const smsContent = `FLOODGUARD SOS: ${victimName} can cuu ho tai ${area}. So nguoi: ${peopleCount}. Muc do: ${level}.`;

  for (const phone of RESCUE_COORDINATOR_PHONES) {
    await sendEsmsSms({
      phone,
      content: smsContent,
      requestId: `${request.id}-coordinator-${normalizeVietnamPhone(phone)}`,
      relatedRequestId: request.id,
      recipient: 'Dieu phoi cuu ho',
    });
  }

  const reporterPhone = request.reporter_phone || request.phone;
  if (reporterPhone) {
    await sendEsmsZaloThenSms({
      phone: reporterPhone,
      templateId: ZALO_ZNS_TEMPLATE_SOS,
      params: [area, peopleCount, level],
      smsContent: `FLOODGUARD: Yeu cau cuu ho cua ban da duoc tiep nhan tai ${area}. Hay giu dien thoai de doi lien he.`,
      requestId: `${request.id}-reporter-confirm`,
      relatedRequestId: request.id,
      recipient: request.reporter_name || victimName,
    });
  }
}

async function notifyRescueAssigned(request, teamName) {
  const phone = request.reporter_phone || request.victim_phone || request.phone;
  if (!phone) return;

  const victimName = request.victim_name || request.full_name || 'nguoi can cuu';
  const area = request.victim_area_name || request.area_name || 'khu vuc cua ban';
  await sendEsmsZaloThenSms({
    phone,
    templateId: ZALO_ZNS_TEMPLATE_ASSIGNED,
    params: [victimName, teamName, area],
    smsContent: `FLOODGUARD: Doi ${teamName} da nhan cuu ho cho ${victimName} tai ${area}. Hay giu dien thoai va ra tin hieu khi thay doi.`,
    requestId: `${request.id}-assigned`,
    relatedRequestId: request.id,
    recipient: request.reporter_name || victimName,
  });
}

function normalizeSafeZone(safeZone) {
  const capacity = Math.max(0, Math.round(toFiniteNumber(safeZone?.capacity)));
  const currentPeople = Math.max(0, Math.round(toFiniteNumber(safeZone?.current_people)));

  return {
    ...safeZone,
    name: String(safeZone?.name || '').trim(),
    address: String(safeZone?.address || '').trim(),
    area_name: String(safeZone?.area_name || '').trim(),
    capacity,
    current_people: currentPeople,
    contact_person: String(safeZone?.contact_person || safeZone?.manager_name || '').trim(),
    contact_phone: String(safeZone?.contact_phone || safeZone?.manager_phone || '').trim(),
  };
}

function isVerifiedPublicSafeZone(safeZone) {
  const normalized = normalizeSafeZone(safeZone);
  return Boolean(
    normalized.name &&
    normalized.address &&
    normalized.capacity > 0 &&
    normalized.name.length > 1 &&
    !TEST_SAFE_ZONE_NAME_PATTERN.test(normalized.name)
  );
}

function getPublicSafeZones() {
  return Array.isArray(db.safeZones)
    ? db.safeZones.map(normalizeSafeZone).filter(isVerifiedPublicSafeZone)
    : [];
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
    floodWarnings: Array.isArray(db.floodWarnings)
      ? db.floodWarnings.filter(w => w.status === 'PUBLISHED')
      : [],
    safeZones: getPublicSafeZones(),
    dams: db.dams,
  };

  if (!user) {
    return sanitizeObject(publicDb);
  }

  const ownNotifications = Array.isArray(db.notifications)
    ? db.notifications.filter(n => !n.user_id || n.user_id === user.id)
    : [];

  if (ADMIN_ROLES.includes(user.role)) {
    return sanitizeObject({
      ...db,
      users: Array.isArray(db.users) ? db.users.map(safeUser) : [],
    });
  }

  if (RESCUE_ROLES.includes(user.role)) {
    const teams = Array.isArray(db.rescueTeams) ? db.rescueTeams : [];
    const visibleTeamIds = new Set(
      teams
        .filter(team => team.leader_user_id === user.id || team.leader_id === user.id || team.user_id === user.id)
        .map(team => team.id)
    );

    const missions = Array.isArray(db.rescueMissions)
      ? db.rescueMissions.filter(m => visibleTeamIds.size === 0 || visibleTeamIds.has(m.rescue_team_id))
      : [];
    const visibleRequestIds = new Set(missions.map(m => m.rescue_request_id));

    return sanitizeObject({
      ...publicDb,
      rescueTeams: teams,
      rescueRoutes: db.rescueRoutes,
      rescueMissions: missions,
      rescueRequests: Array.isArray(db.rescueRequests)
        ? db.rescueRequests.filter(r => visibleRequestIds.size === 0 || visibleRequestIds.has(r.id) || visibleTeamIds.has(r.assigned_team_id))
        : [],
      missionStatusLogs: Array.isArray(db.missionStatusLogs)
        ? db.missionStatusLogs.filter(log => missions.some(m => m.id === log.mission_id))
        : [],
      notifications: ownNotifications,
    });
  }

  const ownProfiles = Array.isArray(db.citizenProfiles)
    ? db.citizenProfiles.filter(profile => profile.user_id === user.id)
    : [];
  const ownProfileIds = new Set(ownProfiles.map(profile => profile.id));

  return sanitizeObject({
    ...publicDb,
    user: safeUser(findUserById(user.id)),
    citizenProfiles: ownProfiles,
    rescueRequests: Array.isArray(db.rescueRequests)
      ? db.rescueRequests.filter(r => r.user_id === user.id || r.citizen_id === user.id)
      : [],
    vulnerableHouseholds: Array.isArray(db.vulnerableHouseholds)
      ? db.vulnerableHouseholds.filter(h => ownProfileIds.has(h.citizen_profile_id) || h.user_id === user.id)
      : [],
    notifications: ownNotifications,
  });
}

async function sanitizeDbForUserFromPostgres(user) {
  const base = sanitizeDbForUser(user);
  if (!pool || !user) return base;

  const userResult = await pool.query(
    `SELECT id, full_name, phone, email, password_hash, role::text, status::text, avatar, created_at, updated_at
     FROM users
     WHERE id = $1`,
    [user.id]
  );
  const currentUser = userRowToApi(userResult.rows[0]) || user;

  if (ADMIN_ROLES.includes(currentUser.role)) {
    const [usersResult, profilesResult, requestsResult] = await Promise.all([
      pool.query(`SELECT id, full_name, phone, email, password_hash, role::text, status::text, avatar, created_at, updated_at FROM users ORDER BY created_at DESC`),
      pool.query(`SELECT * FROM citizen_profiles ORDER BY created_at DESC`),
      pool.query(`SELECT *, status::text, emergency_level::text FROM rescue_requests ORDER BY created_at DESC LIMIT 1000`),
    ]);

    return sanitizeObject({
      ...base,
      user: safeUser(currentUser),
      users: usersResult.rows.map(row => safeUser(userRowToApi(row))),
      citizenProfiles: profilesResult.rows.map(citizenProfileRowToApi),
      rescueRequests: requestsResult.rows.map(rescueRequestRowToApi),
    });
  }

  if (RESCUE_ROLES.includes(currentUser.role)) {
    const requestsResult = await pool.query(
      `SELECT *, status::text, emergency_level::text
       FROM rescue_requests
       ORDER BY created_at DESC
       LIMIT 1000`
    );

    return sanitizeObject({
      ...base,
      user: safeUser(currentUser),
      rescueRequests: requestsResult.rows.map(rescueRequestRowToApi),
    });
  }

  const [profilesResult, requestsResult] = await Promise.all([
    pool.query(`SELECT * FROM citizen_profiles WHERE user_id = $1 ORDER BY created_at DESC`, [currentUser.id]),
    pool.query(
      `SELECT *, status::text, emergency_level::text
       FROM rescue_requests
       WHERE created_by_user_id = $1
       ORDER BY created_at DESC`,
      [currentUser.id]
    ),
  ]);

  return sanitizeObject({
    ...base,
    user: safeUser(currentUser),
    citizenProfiles: profilesResult.rows.map(citizenProfileRowToApi),
    rescueRequests: requestsResult.rows.map(rescueRequestRowToApi),
  });
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

function getRequestToken(req) {
  const authHeader = req.get('authorization') || '';
  if (authHeader.startsWith('Bearer ')) return authHeader.slice(7);
  return typeof req.query?.token === 'string' ? req.query.token : '';
}

function authenticateOptional(req, res, next) {
  const token = getRequestToken(req);

  if (!token) return next();

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = findUserById(payload.sub);
    if (user && user.status !== 'BLOCKED') {
      req.user = safeUser(user);
    } else if (payload.sub && payload.role) {
      req.user = safeUser({
        id: payload.sub,
        full_name: payload.name || '',
        role: payload.role,
        status: 'ACTIVE',
      });
    }
  } catch {
    req.authError = true;
  }

  return next();
}

function writeSse(res, event, payload) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

async function getRealtimeStateForUser(user) {
  return pool ? sanitizeDbForUserFromPostgres(user) : sanitizeDbForUser(user);
}

function broadcastDbUpdate(reason, changedCollections = []) {
  if (sseClients.size === 0) return;

  for (const [clientId, client] of sseClients) {
    getRealtimeStateForUser(client.user)
      .then(data => {
        writeSse(client.res, 'db:update', {
          reason,
          changedCollections,
          timestamp: new Date().toISOString(),
          data,
        });
      })
      .catch(err => {
        console.error('Failed to broadcast realtime update:', err);
        sseClients.delete(clientId);
        client.res.end();
      });
  }
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
    user.password_hash = await bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
    saveDb();
  }
  return isLegacyMatch;
}

async function ensureRelationalTables() {
  if (!pool) return;

  await pool.query(`
    DO $$
    BEGIN
      CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'RESCUE_LEADER', 'RESCUE_MEMBER', 'CITIZEN');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$
    BEGIN
      CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$
    BEGIN
      CREATE TYPE "RescueRequestStatus" AS ENUM ('PENDING', 'ASSIGNED', 'ACCEPTED', 'MOVING', 'NEAR_VICTIM', 'ARRIVED_CONFIRMED', 'RESCUING', 'RESCUED', 'TRANSFERRED_SAFEZONE', 'UNREACHABLE', 'NEED_SUPPORT', 'CANCELLED');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$
    BEGIN
      CREATE TYPE "AlertLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'EMERGENCY');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      phone TEXT UNIQUE,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      role "UserRole" NOT NULL DEFAULT 'CITIZEN',
      status "UserStatus" NOT NULL DEFAULT 'ACTIVE',
      avatar TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS citizen_profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      area_id TEXT,
      area_name TEXT,
      village_name TEXT DEFAULT '',
      address_detail TEXT,
      household_size INTEGER NOT NULL DEFAULT 1,
      elderly_count INTEGER NOT NULL DEFAULT 0,
      children_count INTEGER NOT NULL DEFAULT 0,
      disabled_count INTEGER NOT NULL DEFAULT 0,
      medical_note TEXT DEFAULT '',
      emergency_contact_name TEXT DEFAULT '',
      emergency_contact_phone TEXT DEFAULT '',
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,
      sms_opt_in BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS rescue_requests (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      phone TEXT,
      area_id TEXT,
      area_name TEXT,
      address_detail TEXT,
      description TEXT,
      note TEXT,
      number_of_people INTEGER NOT NULL DEFAULT 1,
      emergency_level "AlertLevel" NOT NULL DEFAULT 'HIGH',
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,
      status "RescueRequestStatus" NOT NULL DEFAULT 'PENDING',
      assigned_team_id TEXT,
      assigned_team_name TEXT,
      created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      accepted_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE rescue_requests ADD COLUMN IF NOT EXISTS area_id TEXT;
    ALTER TABLE rescue_requests ADD COLUMN IF NOT EXISTS note TEXT;
    ALTER TABLE rescue_requests ADD COLUMN IF NOT EXISTS assigned_team_name TEXT;
    ALTER TABLE rescue_requests ADD COLUMN IF NOT EXISTS has_elderly BOOLEAN DEFAULT FALSE;
    ALTER TABLE rescue_requests ADD COLUMN IF NOT EXISTS has_children BOOLEAN DEFAULT FALSE;
    ALTER TABLE rescue_requests ADD COLUMN IF NOT EXISTS has_disabled BOOLEAN DEFAULT FALSE;
    ALTER TABLE rescue_requests ADD COLUMN IF NOT EXISTS has_medical_case BOOLEAN DEFAULT FALSE;
    ALTER TABLE rescue_requests ADD COLUMN IF NOT EXISTS need_food_water BOOLEAN DEFAULT FALSE;
    ALTER TABLE rescue_requests ADD COLUMN IF NOT EXISTS sos_mode BOOLEAN DEFAULT FALSE;
    ALTER TABLE rescue_requests ADD COLUMN IF NOT EXISTS requester_type TEXT DEFAULT 'SELF';
    ALTER TABLE rescue_requests ADD COLUMN IF NOT EXISTS reporter_name TEXT;
    ALTER TABLE rescue_requests ADD COLUMN IF NOT EXISTS reporter_phone TEXT;
    ALTER TABLE rescue_requests ADD COLUMN IF NOT EXISTS reporter_relationship TEXT;
    ALTER TABLE rescue_requests ADD COLUMN IF NOT EXISTS reporter_latitude DOUBLE PRECISION;
    ALTER TABLE rescue_requests ADD COLUMN IF NOT EXISTS reporter_longitude DOUBLE PRECISION;
    ALTER TABLE rescue_requests ADD COLUMN IF NOT EXISTS victim_name TEXT;
    ALTER TABLE rescue_requests ADD COLUMN IF NOT EXISTS victim_phone TEXT;
    ALTER TABLE rescue_requests ADD COLUMN IF NOT EXISTS victim_area_id TEXT;
    ALTER TABLE rescue_requests ADD COLUMN IF NOT EXISTS victim_area_name TEXT;
    ALTER TABLE rescue_requests ADD COLUMN IF NOT EXISTS victim_address_detail TEXT;
    ALTER TABLE rescue_requests ADD COLUMN IF NOT EXISTS victim_latitude DOUBLE PRECISION;
    ALTER TABLE rescue_requests ADD COLUMN IF NOT EXISTS victim_longitude DOUBLE PRECISION;
    ALTER TABLE rescue_requests ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'VERIFIED';
    ALTER TABLE rescue_requests ADD COLUMN IF NOT EXISTS priority_score INTEGER DEFAULT 0;
    ALTER TABLE rescue_requests ADD COLUMN IF NOT EXISTS duplicate_group_id TEXT;
    ALTER TABLE rescue_requests ADD COLUMN IF NOT EXISTS cluster_id TEXT;
    ALTER TABLE rescue_requests ADD COLUMN IF NOT EXISTS nearby_active_mission_id TEXT;
    ALTER TABLE rescue_requests ADD COLUMN IF NOT EXISTS nearby_active_team_name TEXT;
    ALTER TABLE rescue_requests ADD COLUMN IF NOT EXISTS coordination_note TEXT;
    CREATE INDEX IF NOT EXISTS citizen_profiles_user_id_idx ON citizen_profiles(user_id);
    CREATE INDEX IF NOT EXISTS rescue_requests_created_by_user_id_idx ON rescue_requests(created_by_user_id);
  `);
}

async function syncRelationalTablesFromState() {
  if (!pool) return;

  await ensureRelationalTables();
  const client = await pool.connect();
  try {
    for (const user of Array.isArray(db.users) ? db.users : []) {
      const passwordHash = user.password_hash || user.passwordHash;
      if (!user.id || !user.full_name || !passwordHash) continue;

      try {
        await client.query(
          `INSERT INTO users (id, full_name, phone, email, password_hash, role, status, avatar, created_at, updated_at)
           VALUES ($1, $2, NULLIF($3, ''), NULLIF($4, ''), $5, $6::"UserRole", $7::"UserStatus", $8, COALESCE($9, NOW()), NOW())
           ON CONFLICT (id) DO UPDATE SET
             full_name = EXCLUDED.full_name,
             phone = COALESCE(users.phone, EXCLUDED.phone),
             email = COALESCE(users.email, EXCLUDED.email),
             password_hash = EXCLUDED.password_hash,
             role = EXCLUDED.role,
             status = EXCLUDED.status,
             avatar = EXCLUDED.avatar,
             updated_at = NOW()`,
          [
            user.id,
            user.full_name || user.fullName,
            user.phone || '',
            user.email || '',
            passwordHash,
            user.role || 'CITIZEN',
            user.status || 'ACTIVE',
            user.avatar || null,
            toPgTimestamp(user.created_at || user.createdAt),
          ]
        );
      } catch (err) {
        console.warn(`Skipped relational user backfill for ${user.id}: ${err.message}`);
      }
    }

    for (const profile of Array.isArray(db.citizenProfiles) ? db.citizenProfiles : []) {
      if (!profile.id || !profile.user_id) continue;

      try {
        await client.query(
          `INSERT INTO citizen_profiles (
             id, user_id, area_id, area_name, village_name, address_detail, household_size,
             elderly_count, children_count, disabled_count, medical_note, emergency_contact_name,
             emergency_contact_phone, latitude, longitude, sms_opt_in, created_at, updated_at
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW())
           ON CONFLICT (id) DO UPDATE SET
             area_id = EXCLUDED.area_id,
             area_name = EXCLUDED.area_name,
             village_name = EXCLUDED.village_name,
             address_detail = EXCLUDED.address_detail,
             household_size = EXCLUDED.household_size,
             elderly_count = EXCLUDED.elderly_count,
             children_count = EXCLUDED.children_count,
             disabled_count = EXCLUDED.disabled_count,
             medical_note = EXCLUDED.medical_note,
             emergency_contact_name = EXCLUDED.emergency_contact_name,
             emergency_contact_phone = EXCLUDED.emergency_contact_phone,
             latitude = EXCLUDED.latitude,
             longitude = EXCLUDED.longitude,
             sms_opt_in = EXCLUDED.sms_opt_in,
             updated_at = NOW()`,
          [
            profile.id,
            profile.user_id,
            profile.area_id || null,
            profile.area_name || null,
            profile.village_name || '',
            profile.address_detail || '',
            Number.parseInt(profile.household_size, 10) || 1,
            Number.parseInt(profile.elderly_count, 10) || 0,
            Number.parseInt(profile.children_count, 10) || 0,
            Number.parseInt(profile.disabled_count, 10) || 0,
            profile.medical_note || '',
            profile.emergency_contact_name || '',
            profile.emergency_contact_phone || '',
            Number.isFinite(Number(profile.latitude)) ? Number(profile.latitude) : null,
            Number.isFinite(Number(profile.longitude)) ? Number(profile.longitude) : null,
            profile.sms_opt_in !== false,
          ]
        );
      } catch (err) {
        console.warn(`Skipped relational citizen profile backfill for ${profile.id}: ${err.message}`);
      }
    }

  } catch (err) {
    throw err;
  } finally {
    client.release();
  }
}

async function initializePostgres() {
  if (!pool) return false;

  await ensureRelationalTables();

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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function initializePostgresWithRetry() {
  if (!pool) return false;

  const attempts = Number.isFinite(DB_CONNECT_RETRIES) && DB_CONNECT_RETRIES > 0
    ? Math.floor(DB_CONNECT_RETRIES)
    : 1;
  const delayMs = Number.isFinite(DB_CONNECT_RETRY_DELAY_MS) && DB_CONNECT_RETRY_DELAY_MS >= 0
    ? DB_CONNECT_RETRY_DELAY_MS
    : 3000;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await initializePostgres();
    } catch (err) {
      const isLastAttempt = attempt === attempts;
      console.error(`PostgreSQL initialization failed (attempt ${attempt}/${attempts}):`, err.message);

      if (isLastAttempt) {
        if (IS_DEPLOYED_RUNTIME) {
          throw err;
        }

        console.warn('Falling back to local JSON database because PostgreSQL is unavailable in development.');
        return false;
      }

      await sleep(delayMs * attempt);
    }
  }

  return false;
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
const usingPostgres = await initializePostgresWithRetry();

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

if (usingPostgres) {
  await syncRelationalTablesFromState();
}

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
app.get('/api/db', authenticateOptional, async (req, res) => {
  if (req.authError) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  try {
    const data = pool
      ? await sanitizeDbForUserFromPostgres(req.user)
      : sanitizeDbForUser(req.user);
    return res.json(data);
  } catch (err) {
    console.error('Database state route failed:', err);
    return res.status(500).json({ error: 'Database state unavailable' });
  }
});

app.get('/api/events', authenticateOptional, async (req, res) => {
  if (req.authError) {
    return res.status(401).end();
  }

  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();

  const clientId = createId('sse');
  sseClients.set(clientId, { res, user: req.user || null });

  writeSse(res, 'connected', {
    clientId,
    timestamp: new Date().toISOString(),
  });

  try {
    const data = await getRealtimeStateForUser(req.user || null);
    writeSse(res, 'db:update', {
      reason: 'initial',
      changedCollections: [],
      timestamp: new Date().toISOString(),
      data,
    });
  } catch (err) {
    console.error('Failed to send initial realtime state:', err);
  }

  const heartbeat = setInterval(() => {
    writeSse(res, 'ping', { timestamp: new Date().toISOString() });
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(clientId);
  });
});

// 2. AUTH LOGIN
app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const normalize = value => (typeof value === 'string' ? value.trim() : '');
    const { emailOrPhone, password } = req.body || {};
    const credential = normalize(emailOrPhone).toLowerCase();
    const phoneCredential = normalize(emailOrPhone).replace(/[\s.-]/g, '');
    const plainPassword = normalize(password);

    if (!credential || !plainPassword) {
      return res.status(400).json({
        success: false,
        message: 'Vui long nhap email/so dien thoai va mat khau'
      });
    }

    let user = null;
    let profile = null;

    if (pool) {
      const userResult = await pool.query(
        `SELECT id, full_name, phone, email, password_hash, role::text, status::text, avatar, created_at, updated_at
         FROM users
         WHERE lower(email) = $1 OR phone = $2
         LIMIT 1`,
        [credential, phoneCredential]
      );
      user = userRowToApi(userResult.rows[0]);
    } else {
      const users = Array.isArray(db.users) ? db.users : [];
      if (users.length === 0) {
        console.error('Login failed: users collection is empty or invalid');
        return res.status(503).json({
          success: false,
          message: 'Du lieu nguoi dung chua san sang, vui long thu lai'
        });
      }

      user = users.find(u => {
        const email = normalize(u?.email).toLowerCase();
        const phone = normalize(u?.phone).replace(/[\s.-]/g, '');
        return email === credential || phone === phoneCredential;
      });
    }

    if (!user || user.status === 'BLOCKED' || !(await verifyPassword(user, plainPassword))) {
      return res.status(401).json({
        success: false,
        message: 'Sai tai khoan hoac mat khau'
      });
    }

    if (pool) {
      await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [user.password_hash, user.id]);
      const profileResult = await pool.query('SELECT * FROM citizen_profiles WHERE user_id = $1 LIMIT 1', [user.id]);
      profile = citizenProfileRowToApi(profileResult.rows[0]);
    } else {
      const profiles = Array.isArray(db.citizenProfiles) ? db.citizenProfiles : [];
      profile = profiles.find(p => p.user_id === user.id);
    }

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
    const normalizePhone = value => normalize(value).replace(/[\s.-]/g, '');
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
    const cleanPhone = normalizePhone(phone);
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

    const area = (Array.isArray(db.areas) ? db.areas : []).find(item => item.id === area_id);
    const userId = createId('user');
    const profileId = createId('cp');
    const now = new Date().toISOString();
    const areaName = area?.old_name || area?.current_name || normalize(area_name);
    const passwordHash = await bcrypt.hash(cleanPassword, BCRYPT_ROUNDS);

    if (pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const duplicatedResult = await client.query(
          `SELECT phone, email
           FROM users
           WHERE phone = $1 OR ($2::text IS NOT NULL AND lower(email) = $2)
           LIMIT 1`,
          [cleanPhone, cleanEmail || null]
        );
        const duplicated = duplicatedResult.rows[0];
        if (duplicated?.phone === cleanPhone) {
          await client.query('ROLLBACK');
          return res.status(409).json({
            success: false,
            message: `So dien thoai ${cleanPhone} da duoc dang ky`
          });
        }
        if (duplicated?.email && cleanEmail && normalize(duplicated.email).toLowerCase() === cleanEmail) {
          await client.query('ROLLBACK');
          return res.status(409).json({
            success: false,
            message: `Email ${cleanEmail} da duoc dang ky`
          });
        }

        const userResult = await client.query(
          `INSERT INTO users (id, full_name, phone, email, password_hash, role, status, avatar, created_at, updated_at)
           VALUES ($1, $2, $3, NULLIF($4, ''), $5, 'CITIZEN', 'ACTIVE', NULL, NOW(), NOW())
           RETURNING id, full_name, phone, email, password_hash, role::text, status::text, avatar, created_at, updated_at`,
          [userId, cleanName, cleanPhone, cleanEmail, passwordHash]
        );

        const profileResult = await client.query(
          `INSERT INTO citizen_profiles (
             id, user_id, area_id, area_name, village_name, address_detail, household_size,
             elderly_count, children_count, disabled_count, medical_note, emergency_contact_name,
             emergency_contact_phone, latitude, longitude, sms_opt_in, created_at, updated_at
           )
           VALUES ($1, $2, $3, $4, '', $5, $6, $7, $8, $9, '', $10, $11, NULL, NULL, TRUE, NOW(), NOW())
           RETURNING *`,
          [
            profileId,
            userId,
            area_id,
            areaName,
            normalize(address_detail),
            Number.parseInt(household_size, 10) || 1,
            has_elderly ? 1 : 0,
            has_children ? 1 : 0,
            has_disabled ? 1 : 0,
            normalize(emergency_contact_name),
            normalize(emergency_contact_phone),
          ]
        );

        await client.query('COMMIT');

        const user = userRowToApi(userResult.rows[0]);
        const profile = citizenProfileRowToApi(profileResult.rows[0]);
        db.users.push(user);
        if (!Array.isArray(db.citizenProfiles)) db.citizenProfiles = [];
        db.citizenProfiles.push(profile);

        return res.status(201).json({
          success: true,
          user: safeUser(user),
          profile
        });
      } catch (err) {
        await client.query('ROLLBACK');
        if (err.code === '23505') {
          return res.status(409).json({
            success: false,
            message: 'So dien thoai hoac email da duoc dang ky'
          });
        }
        throw err;
      } finally {
        client.release();
      }
    }

    const users = Array.isArray(db.users) ? db.users : [];
    const duplicatedPhoneUser = users.find(user => normalizePhone(user?.phone) === cleanPhone);
    const duplicatedEmailUser = cleanEmail
      ? users.find(user => normalize(user?.email).toLowerCase() === cleanEmail)
      : null;

    if (duplicatedPhoneUser) {
      return res.status(409).json({
        success: false,
        message: `So dien thoai ${cleanPhone} da duoc dang ky`
      });
    }

    if (duplicatedEmailUser) {
      return res.status(409).json({
        success: false,
        message: `Email ${cleanEmail} da duoc dang ky`
      });
    }

    const user = {
      id: userId,
      full_name: cleanName,
      phone: cleanPhone,
      email: cleanEmail || null,
      password_hash: passwordHash,
      role: 'CITIZEN',
      status: 'ACTIVE',
      created_at: now,
      avatar: null,
    };
    const profile = {
      id: profileId,
      user_id: userId,
      area_id,
      area_name: areaName,
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
    id: createId('fw'),
    ...data,
    vector_embedding: getEmbedding(textToEmbed),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    sms_sent: false,
    sms_count: 0
  };
  db.floodWarnings.unshift(warning);
  saveDb();
  broadcastDbUpdate('warning:created', ['floodWarnings']);
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
  broadcastDbUpdate('warning:updated', ['floodWarnings']);
  res.json(updatedData);
});

app.delete('/api/warnings/:id', requireRoles(ADMIN_ROLES), (req, res) => {
  const { id } = req.params;
  db.floodWarnings = db.floodWarnings.filter(w => w.id !== id);
  saveDb();
  broadcastDbUpdate('warning:deleted', ['floodWarnings']);
  res.json({ success: true });
});

// 5. RESCUE REQUESTS & MISSIONS
app.post('/api/rescue-requests', publicWriteLimiter, authenticateOptional, async (req, res) => {
  try {
    const data = enrichRescueRequestCoordination(
      normalizeRescueRequestInput(pickAllowed(req.body, RESCUE_REQUEST_PUBLIC_FIELDS), req.user)
    );

    if (!data.full_name || !data.area_id || !data.address_detail) {
      return res.status(400).json({ error: 'Missing required rescue request fields' });
    }

    const requestId = createId('rr');
    const textToEmbed = `${data.full_name || ''} ${data.address_detail || ''} ${data.note || ''}`;

    if (pool) {
      const result = await pool.query(
        `INSERT INTO rescue_requests (
           id, full_name, phone, area_id, area_name, address_detail, description, note,
           number_of_people, emergency_level, latitude, longitude, status, assigned_team_id,
           assigned_team_name, created_by_user_id, has_elderly, has_children, has_disabled,
           has_medical_case, need_food_water, sos_mode, requester_type, reporter_name,
           reporter_phone, reporter_relationship, reporter_latitude, reporter_longitude,
           victim_name, victim_phone, victim_area_id, victim_area_name, victim_address_detail,
           victim_latitude, victim_longitude, verification_status, priority_score,
           duplicate_group_id, cluster_id, nearby_active_mission_id, nearby_active_team_name,
           coordination_note, accepted_at, completed_at, created_at, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::"AlertLevel", $11, $12, 'PENDING', NULL, NULL, $13,
           $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25,
           $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37,
           $38, $39, NULL, NULL, NOW(), NOW())
         RETURNING *, status::text, emergency_level::text`,
        [
          requestId,
          data.full_name,
          data.phone || null,
          data.area_id || null,
          data.area_name || null,
          data.address_detail || null,
          data.description || null,
          data.note || null,
          Number.parseInt(data.number_of_people, 10) || 1,
          ['LOW', 'MEDIUM', 'HIGH', 'EMERGENCY'].includes(data.emergency_level) ? data.emergency_level : 'HIGH',
          Number.isFinite(Number(data.latitude)) ? Number(data.latitude) : null,
          Number.isFinite(Number(data.longitude)) ? Number(data.longitude) : null,
          data.user_id || null,
          data.has_elderly,
          data.has_children,
          data.has_disabled,
          data.has_medical_case,
          data.need_food_water,
          data.sos_mode,
          data.requester_type,
          data.reporter_name || null,
          data.reporter_phone || null,
          data.reporter_relationship || null,
          data.reporter_latitude,
          data.reporter_longitude,
          data.victim_name || null,
          data.victim_phone || null,
          data.victim_area_id || null,
          data.victim_area_name || null,
          data.victim_address_detail || null,
          data.victim_latitude,
          data.victim_longitude,
          data.verification_status,
          data.priority_score,
          data.duplicate_group_id,
          data.cluster_id,
          data.nearby_active_mission_id,
          data.nearby_active_team_name,
          data.coordination_note,
        ]
      );
      const request = {
        ...rescueRequestRowToApi(result.rows[0]),
        vector_embedding: getEmbedding(textToEmbed),
      };
      db.rescueRequests.unshift(request);
      saveDb();
      broadcastDbUpdate('rescue-request:created', ['rescueRequests']);
      fireAndForgetNotification(() => notifyRescueRequestCreated(request), 'Rescue request notification');
      return res.status(201).json(request);
    }

    const request = {
      id: requestId,
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
    broadcastDbUpdate('rescue-request:created', ['rescueRequests']);
    fireAndForgetNotification(() => notifyRescueRequestCreated(request), 'Rescue request notification');
    return res.status(201).json(request);
  } catch (err) {
    console.error('Rescue request route failed:', err);
    return res.status(500).json({ error: 'Failed to create rescue request' });
  }
});

app.put('/api/rescue-requests/:id', requireRoles([...ADMIN_ROLES, ...RESCUE_ROLES]), (req, res) => {
  const { id } = req.params;
  const idx = db.rescueRequests.findIndex(r => r.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Request not found' });

  db.rescueRequests[idx] = { ...db.rescueRequests[idx], ...pickAllowed(req.body, RESCUE_REQUEST_UPDATE_FIELDS) };
  saveDb();
  broadcastDbUpdate('rescue-request:updated', ['rescueRequests']);
  res.json(db.rescueRequests[idx]);
});

app.post('/api/rescue-requests/:id/assign', requireRoles(ADMIN_ROLES), (req, res) => {
  const { id } = req.params;
  const { teamId, teamName } = pickAllowed(req.body, ['teamId', 'teamName']);
  const currentUser = req.user;
  
  const reqIdx = db.rescueRequests.findIndex(r => r.id === id);
  if (reqIdx === -1) return res.status(404).json({ error: 'Request not found' });

  const request = db.rescueRequests[reqIdx];
  const team = db.rescueTeams.find(t => t.id === teamId);
  const resolvedTeamName = teamName || team?.team_name || team?.name || 'Doi cuu ho';
  const assignmentWarnings = getAssignmentWarnings(request, team);
  request.status = 'ASSIGNED';
  request.assigned_team_id = teamId;
  request.assigned_team_name = resolvedTeamName;
  request.accepted_at = new Date().toISOString();
  request.updated_at = new Date().toISOString();
  if (pool) {
    pool.query(
      `UPDATE rescue_requests
       SET status = 'ASSIGNED'::"RescueRequestStatus",
           assigned_team_id = $1,
           assigned_team_name = $2,
           accepted_at = $3,
           updated_at = NOW()
       WHERE id = $4`,
      [teamId || null, resolvedTeamName, toPgTimestamp(request.accepted_at), id]
    ).catch(err => console.error('Failed to persist rescue assignment:', err));
  }

  // Create corresponding mission
  const mission = {
    id: createId('rm'),
    rescue_request_id: id,
    rescue_team_id: teamId,
    team_name: resolvedTeamName,
    mission_type: request.nearby_active_mission_id ? 'SUPPORT_OR_CLUSTER' : 'PRIMARY',
    cluster_id: request.cluster_id || null,
    linked_mission_id: request.nearby_active_mission_id || null,
    victim_name: request.victim_name || request.full_name,
    victim_phone: request.victim_phone || request.phone,
    victim_latitude: request.victim_latitude ?? request.latitude,
    victim_longitude: request.victim_longitude ?? request.longitude,
    victim_address: request.victim_address_detail || request.address_detail,
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
    area_id: request.victim_area_id || request.area_id,
    area_name: request.victim_area_name || request.area_name,
    assignment_warnings: assignmentWarnings,
    created_at: new Date().toISOString()
  };
  
  db.rescueMissions.unshift(mission);
  syncTeamLoad(teamId);

  // Add activity log
  const log = {
    id: createId('al'),
    user_id: currentUser?.id || null,
    user_name: currentUser?.full_name || 'Hệ thống',
    action: 'Phân công đội cứu hộ',
    table_name: 'rescue_requests',
    record_id: id,
    note: `Phân công ${teamName}`,
    created_at: new Date().toISOString()
  };
  log.user_name = currentUser?.full_name || 'He thong';
  log.action = 'Phan cong doi cuu ho';
  log.note = `Phan cong ${resolvedTeamName}${assignmentWarnings.length ? ` - ${assignmentWarnings.length} canh bao dieu phoi` : ''}`;
  db.activityLogs.unshift(log);

  // Add notification for team
  const notif = {
    id: createId('notif'),
    user_id: 'user-rescue-1', // Default lead
    title: 'Nhiệm vụ mới!',
    message: `Bạn được phân công cứu hộ ${request.full_name}`,
    type: 'MISSION_ASSIGNED',
    is_read: false,
    created_at: new Date().toISOString(),
    related_id: mission.id
  };
  notif.user_id = team?.leader_user_id || team?.leader_id || 'user-rescue-1';
  notif.title = 'Nhiem vu moi!';
  notif.message = `Ban duoc phan cong cuu ho ${request.victim_name || request.full_name}`;
  db.notifications.unshift(notif);

  if (request.user_id || request.created_by_user_id) {
    db.notifications.unshift({
      id: createId('notif'),
      user_id: request.user_id || request.created_by_user_id,
      title: 'Da co doi dang den',
      message: `${resolvedTeamName} da nhan yeu cau cuu ho. Hay giu dien thoai de doi lien he.`,
      type: 'RESCUE_REQUEST_ASSIGNED',
      is_read: false,
      created_at: new Date().toISOString(),
      related_id: request.id,
    });
  }

  saveDb();
  broadcastDbUpdate('rescue-request:assigned', ['rescueRequests', 'rescueMissions', 'rescueTeams', 'activityLogs', 'notifications']);
  fireAndForgetNotification(() => notifyRescueAssigned(request, resolvedTeamName), 'Rescue assignment notification');
  res.json({ success: true, request, mission, assignment_warnings: assignmentWarnings, rescueTeams: db.rescueTeams });
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
    id: createId('msl'),
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
    if (pool) {
      pool.query(
        `UPDATE rescue_requests
         SET status = $1::"RescueRequestStatus",
             completed_at = CASE WHEN $1::text IN ('RESCUED', 'TRANSFERRED_SAFEZONE') THEN NOW() ELSE completed_at END,
             updated_at = NOW()
         WHERE id = $2`,
        [newStatus, mission.rescue_request_id]
      ).catch(err => console.error('Failed to persist mission status:', err));
    }
  }
  syncTeamLoad(mission.rescue_team_id);

  saveDb();
  broadcastDbUpdate('mission:status-updated', ['rescueMissions', 'rescueRequests', 'rescueTeams', 'missionStatusLogs']);
  res.json({ success: true, mission: db.rescueMissions[missionIdx], rescueTeams: db.rescueTeams });
});

// 7. RESCUE TEAMS CRUD
app.post('/api/teams', requireRoles(ADMIN_ROLES), (req, res) => {
  const team = {
    id: createId('team'),
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
    id: createId('sz'),
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
    id: createId('route'),
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
    id: createId('dr'),
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
    id: createId('vh'),
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

app.get('/api/notifications/provider-status', requireRoles(ADMIN_ROLES), (req, res) => {
  res.json({
    provider: 'eSMS',
    sms_configured: hasEsmsSmsConfig(),
    zalo_configured: Boolean(hasEsmsSmsConfig() && ZALO_OA_ID),
    sandbox: ESMS_SANDBOX === '1',
    brandname_configured: Boolean(ESMS_BRANDNAME),
    callback_configured: Boolean(ESMS_CALLBACK_URL),
  });
});

app.post('/api/sms/send', requireRoles(ADMIN_ROLES), async (req, res) => {
  const data = sanitizeObject(req.body || {});
  const message = String(data.message || data.content || '').trim();
  if (!message) return res.status(400).json({ error: 'Message is required' });
  if (!hasEsmsSmsConfig()) {
    return res.status(503).json({
      error: 'eSMS is not configured',
      required_env: ['ESMS_API_KEY', 'ESMS_SECRET_KEY', 'ESMS_BRANDNAME'],
    });
  }

  const directPhones = Array.isArray(data.phones)
    ? data.phones.map(phone => ({ phone, recipient: '', source: 'manual' }))
    : [];
  const recipients = directPhones.length > 0
    ? directPhones
    : collectNotificationRecipients({ target: data.target || 'all', area_id: data.area_id || '' });

  if (recipients.length === 0) {
    return res.status(400).json({ error: 'No valid recipients found' });
  }

  const logs = await sendBulkSms({
    recipients,
    message,
    relatedWarningId: data.related_warning_id || data.flood_warning_id || null,
    relatedRequestId: data.related_request_id || null,
    requestPrefix: data.related_warning_id || data.related_request_id || 'manual-sms',
  });

  if (data.related_warning_id) {
    const warning = db.floodWarnings.find(item => item.id === data.related_warning_id);
    if (warning) {
      warning.sms_sent = logs.some(log => log.status === 'SENT');
      warning.sms_count = (warning.sms_count || 0) + logs.length;
      warning.updated_at = new Date().toISOString();
      saveDb();
      broadcastDbUpdate('warning:sms-sent', ['floodWarnings']);
    }
  }

  const sent = logs.filter(log => log.status === 'SENT').length;
  const failed = logs.filter(log => log.status === 'FAILED').length;
  res.json({ success: failed === 0, total: logs.length, sent, failed, logs });
});

app.post('/api/notifications/esms-callback', (req, res) => {
  if (ESMS_CALLBACK_TOKEN && req.query.token !== ESMS_CALLBACK_TOKEN) {
    return res.status(401).json({ error: 'Invalid callback token' });
  }

  const payload = sanitizeObject(req.body || {});
  const requestId = String(req.query.request_id || payload.RequestId || payload.RequestID || payload.request_id || '');
  const providerStatus = String(payload.Status || payload.SendStatus || payload.CodeResult || payload.status || '').toUpperCase();
  const isFailed = providerStatus.includes('FAIL') || ['101', '104', '124', '146', '789', '99'].includes(providerStatus);
  const status = isFailed ? 'FAILED' : 'SENT';

  const updated = updateSmsLogByRequestId(requestId, {
    status,
    provider_message_id: payload.SMSID || payload.SmsId || payload.MessageId || null,
    error: isFailed ? payload.ErrorMessage || payload.error || 'Provider callback failed' : '',
    raw_response: payload,
    delivered_at: status === 'SENT' ? new Date().toISOString() : null,
  });

  if (!updated) {
    addSmsLog({
      phone: payload.Phone || payload.phone || '',
      recipient: payload.Receiver || '',
      message: 'Provider callback without local request log',
      status,
      provider: 'eSMS',
      channel: 'callback',
      request_id: requestId || null,
      provider_message_id: payload.SMSID || payload.SmsId || payload.MessageId || null,
      error: isFailed ? payload.ErrorMessage || payload.error || 'Provider callback failed' : '',
      raw_response: payload,
    });
  }

  res.json({ success: true });
});

app.post('/api/sms-logs', requireRoles(ADMIN_ROLES), (req, res) => {
  const log = {
    id: createId('sms'),
    ...pickAllowed(req.body, SMS_LOG_FIELDS),
    sent_at: new Date().toISOString()
  };
  db.smsLogs.unshift(log);
  saveDb();
  broadcastDbUpdate('sms-log:created', ['smsLogs']);
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
    broadcastDbUpdate('notification:read', ['notifications']);
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
