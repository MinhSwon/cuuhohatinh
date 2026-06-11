const target = (process.env.LOADTEST_TARGET || 'https://cuuhohatinh.onrender.com').replace(/\/$/, '');
const users = Number.parseInt(process.env.LOADTEST_USERS || '70', 10);
const requestTimeoutMs = Number.parseInt(process.env.LOADTEST_REQUEST_TIMEOUT_MS || '30000', 10);
const password = process.env.LOADTEST_PASSWORD || 'Test@123456';
const areaId = process.env.LOADTEST_AREA_ID || 'area-1';
const startedAt = new Date();
const batchId = startedAt.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))];
}

async function timedRequest(label, url, options) {
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
      error: error.message,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function makeUser(index) {
  const suffix = `${batchId}${String(index).padStart(3, '0')}`;
  return {
    full_name: `Load Test ${suffix}`,
    phone: `09${suffix.slice(-8)}`,
    email: `loadtest.${suffix}@example.com`,
    password,
    area_id: areaId,
    area_name: 'Load test area',
    address_detail: `Dia chi test ${index}`,
    household_size: 1,
    has_elderly: false,
    has_children: false,
    has_disabled: false,
    emergency_contact_name: '',
    emergency_contact_phone: '',
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
    minMs: Math.min(...durations),
    avgMs: Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length),
    p95Ms: percentile(durations, 95),
    maxMs: Math.max(...durations),
    sampleFailures: failures.slice(0, 10).map(item => ({
      label: item.label,
      status: item.status,
      ms: item.ms,
      message: item.body?.message || item.error || item.body,
    })),
  };
}

const health = await timedRequest('health', `${target}/api/health`);
if (!health.ok) {
  console.error(JSON.stringify({ target, health }, null, 2));
  process.exitCode = 1;
} else {
  const registrations = await Promise.all(
    Array.from({ length: users }, (_, index) => {
      const user = makeUser(index + 1);
      return timedRequest(`register-${index + 1}`, `${target}/api/auth/register`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(user),
      });
    })
  );

  const createdUsers = registrations
    .filter(item => item.ok && item.body?.user)
    .map(item => ({
      email: item.body.user.email,
      phone: item.body.user.phone,
      password,
    }));

  const logins = await Promise.all(
    createdUsers.map((user, index) =>
      timedRequest(`login-${index + 1}`, `${target}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          emailOrPhone: user.phone,
          password: user.password,
        }),
      })
    )
  );

  console.log(JSON.stringify({
    target,
    users,
    requestTimeoutMs,
    batchId,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    health,
    registration: summarize(registrations),
    login: summarize(logins),
    createdUsers,
  }, null, 2));

  if (registrations.some(item => item.status >= 500 || item.status === 0)) {
    process.exitCode = 1;
  }
}
