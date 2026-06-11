const target = (process.env.LOADTEST_TARGET || 'https://cuuhohatinh.onrender.com').replace(/\/$/, '');
const users = Number.parseInt(process.env.LOADTEST_USERS || '70', 10);
const setupConcurrency = Number.parseInt(process.env.LOADTEST_SETUP_CONCURRENCY || '5', 10);
const requestTimeoutMs = Number.parseInt(process.env.LOADTEST_REQUEST_TIMEOUT_MS || '30000', 10);
const password = process.env.LOADTEST_PASSWORD || 'Test@123456';
const areaId = process.env.LOADTEST_AREA_ID || 'area-1';
const areaName = process.env.LOADTEST_AREA_NAME || 'Thi tran Huong Khe';
const startedAt = new Date();
const batchId = startedAt.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))];
}

async function timedRequest(label, url, options = {}) {
  const start = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    let body = null;

    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }

    return {
      label,
      ok: response.ok,
      status: response.status,
      ms: Math.round(performance.now() - start),
      body,
    };
  } catch (error) {
    return {
      label,
      ok: false,
      status: 0,
      ms: Math.round(performance.now() - start),
      error: error.name === 'AbortError' ? `Timeout after ${requestTimeoutMs}ms` : error.message,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker())
  );

  return results;
}

function makeUser(index) {
  const suffix = `${batchId}${String(index).padStart(3, '0')}`;
  return {
    full_name: `Load Action ${suffix}`,
    phone: `08${suffix.slice(-8)}`,
    email: `loadaction.${suffix}@example.com`,
    password,
    area_id: areaId,
    area_name: areaName,
    address_detail: `Dia chi user action ${index}`,
    household_size: 2,
    has_elderly: index % 10 === 0,
    has_children: index % 3 === 0,
    has_disabled: false,
    emergency_contact_name: 'Nguoi than test',
    emergency_contact_phone: `07${suffix.slice(-8)}`,
  };
}

function rescuePayload(user, index) {
  return {
    full_name: user.full_name,
    phone: user.phone,
    area_id: user.area_id,
    area_name: user.area_name,
    address_detail: `${user.address_detail} - yeu cau cuu ho test ${index}`,
    description: `Load test 70 users simultaneous action ${batchId}`,
    note: 'Du lieu test tai dong thoi, co the xoa sau khi kiem thu.',
    number_of_people: 2,
    emergency_level: index % 5 === 0 ? 'EMERGENCY' : 'HIGH',
    latitude: 18.1833 + index * 0.0001,
    longitude: 105.7333 + index * 0.0001,
    has_elderly: user.has_elderly,
    has_children: user.has_children,
    has_disabled: false,
    has_medical_case: false,
    need_food_water: index % 2 === 0,
  };
}

function summarize(results) {
  const byStatus = results.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});
  const durations = results.map(item => item.ms);
  const failures = results.filter(item => !item.ok);

  return {
    total: results.length,
    ok: results.filter(item => item.ok).length,
    failed: failures.length,
    byStatus,
    minMs: durations.length ? Math.min(...durations) : 0,
    avgMs: durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : 0,
    p95Ms: percentile(durations, 95),
    maxMs: durations.length ? Math.max(...durations) : 0,
    sampleFailures: failures.slice(0, 10).map(item => ({
      label: item.label,
      status: item.status,
      ms: item.ms,
      message: item.body?.message || item.error || item.body,
    })),
  };
}

async function registerUser(user, index) {
  const register = await timedRequest(`setup-register-${index + 1}`, `${target}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(user),
  });

  return {
    user,
    register,
    ready: register.ok || register.status === 409,
  };
}

async function runUserJourney(setup, index) {
  const login = await timedRequest(`login-${index + 1}`, `${target}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      emailOrPhone: setup.user.phone,
      password: setup.user.password,
    }),
  });

  const token = login.body?.token;
  const headers = token ? { authorization: `Bearer ${token}` } : {};

  const home = await timedRequest(`home-${index + 1}`, `${target}/`);
  const db = await timedRequest(`db-${index + 1}`, `${target}/api/db`, { headers });
  const rescue = await timedRequest(`rescue-${index + 1}`, `${target}/api/rescue-requests`, {
    method: 'POST',
    headers: {
      ...headers,
      'content-type': 'application/json',
    },
    body: JSON.stringify(rescuePayload(setup.user, index + 1)),
  });

  return {
    login,
    home,
    db,
    rescue,
    ok: login.ok && home.ok && db.ok && rescue.ok,
  };
}

const healthBefore = await timedRequest('health-before', `${target}/api/health`);
const testUsers = Array.from({ length: users }, (_, index) => makeUser(index + 1));
const setup = healthBefore.ok
  ? await mapWithConcurrency(testUsers, setupConcurrency, registerUser)
  : [];
const readyUsers = setup.filter(item => item.ready);
const journeys = readyUsers.length
  ? await Promise.all(readyUsers.map(runUserJourney))
  : [];
const healthAfter = await timedRequest('health-after', `${target}/api/health`);

const output = {
  target,
  users,
  setupConcurrency,
  requestTimeoutMs,
  batchId,
  startedAt: startedAt.toISOString(),
  finishedAt: new Date().toISOString(),
  healthBefore,
  setup: summarize(setup.map(item => item.register)),
  readyUsers: readyUsers.length,
  concurrentActions: {
    journeys: {
      total: journeys.length,
      ok: journeys.filter(item => item.ok).length,
      failed: journeys.filter(item => !item.ok).length,
    },
    login: summarize(journeys.map(item => item.login)),
    home: summarize(journeys.map(item => item.home)),
    db: summarize(journeys.map(item => item.db)),
    rescue: summarize(journeys.map(item => item.rescue)),
  },
  healthAfter,
};

console.log(JSON.stringify(output, null, 2));

if (!healthBefore.ok || !healthAfter.ok || journeys.some(item => !item.ok)) {
  process.exitCode = 1;
}
