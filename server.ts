import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import crypto from 'crypto';
import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '1mb' }));

const PORT = Number(process.env.PORT) || 3000;
const ALLOWED_VOICES = new Set(['Kore', 'Puck', 'Charon', 'Aoede', 'Fenrir', 'Zephyr']);

// Ephemeral fallback ensures tokens cannot be forged with a predictable static secret
const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const ADMIN_AUTH_DIR = path.resolve(__dirname, '.data');
const ADMIN_AUTH_FILE = path.join(ADMIN_AUTH_DIR, 'admin_auth.json');
const MAX_ADMIN_FAILURES = 3;
const ADMIN_LOCKOUT_MS = 30_000;
const ADMIN_TOKEN_TTL_MS = 8 * 60 * 60 * 1000;

interface StoredAdminCredential {
  adminId: string;
  salt: string;
  passwordHash: string;
  updatedAt: string;
}

interface LockoutRecord {
  failedAttempts: number;
  lockedUntilMs: number;
}

const adminLockouts = new Map<string, LockoutRecord>();

function normalizeAdminId(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().toUpperCase() : '';
}

function getClientLockKey(req: express.Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  const ip =
    typeof forwarded === 'string'
      ? forwarded.split(',')[0].trim()
      : req.socket.remoteAddress || 'local';
  return `admin:${ip}`;
}

function getLockState(req: express.Request): LockoutRecord {
  const key = getClientLockKey(req);
  const current = adminLockouts.get(key) || { failedAttempts: 0, lockedUntilMs: 0 };
  if (current.lockedUntilMs > 0 && Date.now() >= current.lockedUntilMs) {
    const reset = { failedAttempts: 0, lockedUntilMs: 0 };
    adminLockouts.set(key, reset);
    return reset;
  }
  return current;
}

function recordFailedAttempt(req: express.Request): LockoutRecord {
  const key = getClientLockKey(req);
  const current = getLockState(req);
  const nextFailures = current.failedAttempts + 1;
  const nextRecord: LockoutRecord =
    nextFailures >= MAX_ADMIN_FAILURES
      ? { failedAttempts: nextFailures, lockedUntilMs: Date.now() + ADMIN_LOCKOUT_MS }
      : { failedAttempts: nextFailures, lockedUntilMs: 0 };
  adminLockouts.set(key, nextRecord);
  return nextRecord;
}

function clearLockState(req: express.Request) {
  adminLockouts.delete(getClientLockKey(req));
}

function timingSafeEqualString(a: string, b: string): boolean {
  const digestA = crypto.createHash('sha256').update(a).digest();
  const digestB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(digestA, digestB);
}

function hashAdminPassword(password: string, existingSalt?: string): { salt: string; passwordHash: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, passwordHash: derived };
}

function verifyAdminPassword(password: string, salt: string, expectedHash: string): boolean {
  const derived = crypto.scryptSync(password, salt, 64);
  const expectedBuf = Buffer.from(expectedHash, 'hex');
  if (derived.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(derived, expectedBuf);
}

function hasEnvAdminOverride(): boolean {
  return Boolean(process.env.ADMIN_ID?.trim() && process.env.ADMIN_PASSWORD);
}

function readStoredAdminCredential(): StoredAdminCredential | null {
  try {
    if (!fs.existsSync(ADMIN_AUTH_FILE)) return null;
    const raw = fs.readFileSync(ADMIN_AUTH_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<StoredAdminCredential>;
    if (
      typeof parsed.adminId === 'string' &&
      typeof parsed.salt === 'string' &&
      typeof parsed.passwordHash === 'string' &&
      parsed.adminId.trim().length > 0
    ) {
      return {
        adminId: normalizeAdminId(parsed.adminId),
        salt: parsed.salt,
        passwordHash: parsed.passwordHash,
        updatedAt: parsed.updatedAt || new Date().toISOString(),
      };
    }
    return null;
  } catch {
    return null;
  }
}

async function writeStoredAdminCredential(record: StoredAdminCredential): Promise<void> {
  fs.mkdirSync(ADMIN_AUTH_DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(ADMIN_AUTH_FILE, JSON.stringify(record, null, 2), { mode: 0o600 });
}

function verifySubmittedAdminCredentials(adminIdInput: string, passwordInput: string): {
  ok: boolean;
  resolvedAdminId?: string;
} {
  const cleanId = normalizeAdminId(adminIdInput);
  if (!cleanId || !passwordInput) return { ok: false };

  if (hasEnvAdminOverride()) {
    const envId = normalizeAdminId(process.env.ADMIN_ID);
    const envPass = process.env.ADMIN_PASSWORD || '';
    if (timingSafeEqualString(cleanId, envId) && timingSafeEqualString(passwordInput, envPass)) {
      return { ok: true, resolvedAdminId: envId };
    }
    return { ok: false };
  }

  const stored = readStoredAdminCredential();
  if (!stored) return { ok: false };
  if (
    timingSafeEqualString(cleanId, stored.adminId) &&
    verifyAdminPassword(passwordInput, stored.salt, stored.passwordHash)
  ) {
    return { ok: true, resolvedAdminId: stored.adminId };
  }
  return { ok: false };
}

function issueAdminBearerToken(adminId: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      sub: normalizeAdminId(adminId),
      role: 'admin',
      exp: Date.now() + ADMIN_TOKEN_TTL_MS,
      jti: crypto.randomBytes(12).toString('hex'),
    })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyAdminBearerToken(token: string): { valid: boolean; adminId?: string } {
  const parts = token.split('.');
  if (parts.length !== 2) return { valid: false };
  const [payloadB64, sigB64] = parts;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payloadB64)
    .digest('base64url');
  if (!timingSafeEqualString(sigB64, expectedSig)) {
    return { valid: false };
  }
  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as {
      sub?: string;
      role?: string;
      exp?: number;
    };
    if (parsed.role !== 'admin' || !parsed.sub || typeof parsed.exp !== 'number') {
      return { valid: false };
    }
    if (Date.now() > parsed.exp) return { valid: false };
    return { valid: true, adminId: parsed.sub };
  } catch {
    return { valid: false };
  }
}

function isValidAdminIdFormat(adminId: string): boolean {
  return /^[A-Z0-9_-]{4,32}$/.test(adminId);
}

app.get('/api/admin/auth/status', (req, res) => {
  const lock = getLockState(req);
  const envOverride = hasEnvAdminOverride();
  const configured = envOverride || Boolean(readStoredAdminCredential());
  res.json({
    configured,
    envOverride,
    lockedUntilMs: lock.lockedUntilMs,
    failedAttempts: lock.failedAttempts,
    maxAttempts: MAX_ADMIN_FAILURES,
  });
});

app.post('/api/admin/auth/setup', async (req, res) => {
  if (hasEnvAdminOverride() || readStoredAdminCredential()) {
    res.status(409).json({
      error: 'Admin credentials are already initialized. Sign in with your Unique Admin ID and Password.',
    });
    return;
  }

  const { adminId, password } = req.body as { adminId?: string; password?: string };
  const cleanId = normalizeAdminId(adminId);
  const cleanPassword = typeof password === 'string' ? password : '';

  if (!isValidAdminIdFormat(cleanId)) {
    res.status(400).json({
      error: 'Unique Admin ID must be 4–32 characters using A-Z, 0-9, "-" or "_".',
    });
    return;
  }
  if (cleanPassword.length < 8 || cleanPassword.length > 128) {
    res.status(400).json({
      error: 'Admin Password must be at least 8 characters long.',
    });
    return;
  }

  const { salt, passwordHash } = hashAdminPassword(cleanPassword);
  const record: StoredAdminCredential = {
    adminId: cleanId,
    salt,
    passwordHash,
    updatedAt: new Date().toISOString(),
  };

  try {
    await writeStoredAdminCredential(record);
    clearLockState(req);
    const token = issueAdminBearerToken(cleanId);
    res.status(201).json({
      ok: true,
      adminId: cleanId,
      token,
      configured: true,
      envOverride: false,
    });
  } catch {
    res.status(500).json({ error: 'Failed to store Admin credentials securely.' });
  }
});

app.post('/api/admin/auth/login', (req, res) => {
  const lock = getLockState(req);
  if (lock.lockedUntilMs > Date.now()) {
    const retryAfterSec = Math.max(1, Math.ceil((lock.lockedUntilMs - Date.now()) / 1000));
    res.status(429).json({
      error: `Too many failed attempts. Locked for ${retryAfterSec}s`,
      lockedUntilMs: lock.lockedUntilMs,
      failedAttempts: lock.failedAttempts,
      maxAttempts: MAX_ADMIN_FAILURES,
    });
    return;
  }

  const envOverride = hasEnvAdminOverride();
  const configured = envOverride || Boolean(readStoredAdminCredential());
  if (!configured) {
    res.status(409).json({
      configured: false,
      error: 'Chief Editor credentials have not been set up yet. Complete first-run setup first.',
    });
    return;
  }

  const { adminId, password } = req.body as { adminId?: string; password?: string };
  const cleanId = normalizeAdminId(adminId);
  const cleanPassword = typeof password === 'string' ? password : '';

  const verification = verifySubmittedAdminCredentials(cleanId, cleanPassword);
  if (!verification.ok || !verification.resolvedAdminId) {
    const nextLock = recordFailedAttempt(req);
    if (nextLock.lockedUntilMs > Date.now()) {
      const retryAfterSec = Math.max(1, Math.ceil((nextLock.lockedUntilMs - Date.now()) / 1000));
      res.status(429).json({
        error: `Too many failed attempts. Locked for ${retryAfterSec}s`,
        lockedUntilMs: nextLock.lockedUntilMs,
        failedAttempts: nextLock.failedAttempts,
        maxAttempts: MAX_ADMIN_FAILURES,
      });
      return;
    }

    res.status(401).json({
      error: `Invalid Unique Admin ID or Password. (${nextLock.failedAttempts}/${MAX_ADMIN_FAILURES} attempts)`,
      lockedUntilMs: 0,
      failedAttempts: nextLock.failedAttempts,
      maxAttempts: MAX_ADMIN_FAILURES,
    });
    return;
  }

  clearLockState(req);
  const token = issueAdminBearerToken(verification.resolvedAdminId);
  res.json({
    ok: true,
    adminId: verification.resolvedAdminId,
    token,
    lockedUntilMs: 0,
    failedAttempts: 0,
    maxAttempts: MAX_ADMIN_FAILURES,
  });
});

app.post('/api/admin/auth/change-credentials', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const tokenCheck = verifyAdminBearerToken(bearerToken);
  if (!tokenCheck.valid || !tokenCheck.adminId) {
    res.status(401).json({ error: 'Admin session expired or unauthorized. Please log in again.' });
    return;
  }

  if (hasEnvAdminOverride()) {
    res.status(409).json({
      error:
        'Admin credentials are managed via Settings > Secrets (ADMIN_ID / ADMIN_PASSWORD). Update those secrets to rotate credentials.',
    });
    return;
  }

  const { currentPassword, newAdminId, newPassword } = req.body as {
    currentPassword?: string;
    newAdminId?: string;
    newPassword?: string;
  };

  const cleanCurrentPassword = typeof currentPassword === 'string' ? currentPassword : '';
  const cleanNewId = normalizeAdminId(newAdminId);
  const cleanNewPassword = typeof newPassword === 'string' ? newPassword : '';

  const currentCheck = verifySubmittedAdminCredentials(tokenCheck.adminId, cleanCurrentPassword);
  if (!currentCheck.ok) {
    res.status(401).json({ error: 'Current Admin Password is incorrect.' });
    return;
  }

  if (!isValidAdminIdFormat(cleanNewId)) {
    res.status(400).json({
      error: 'New Unique Admin ID must be 4–32 characters using A-Z, 0-9, "-" or "_".',
    });
    return;
  }
  if (cleanNewPassword.length < 8 || cleanNewPassword.length > 128) {
    res.status(400).json({
      error: 'New Admin Password must be at least 8 characters long.',
    });
    return;
  }

  const { salt, passwordHash } = hashAdminPassword(cleanNewPassword);
  const updatedRecord: StoredAdminCredential = {
    adminId: cleanNewId,
    salt,
    passwordHash,
    updatedAt: new Date().toISOString(),
  };

  try {
    await writeStoredAdminCredential(updatedRecord);
    const nextToken = issueAdminBearerToken(cleanNewId);
    res.json({
      ok: true,
      adminId: cleanNewId,
      token: nextToken,
    });
  } catch {
    res.status(500).json({ error: 'Failed to save updated Admin credentials.' });
  }
});

interface PublicReporterPayload {
  id: string;
  name: string;
  name3: string;
  birthYear: string;
  district3: string;
  district: string;
  status: 'active' | 'pending' | 'suspended';
  createdAt: string;
  approvedCount: number;
  perNewsRate?: number;
}

function getFirebaseRtdbBase(): string | null {
  const raw = process.env.FIREBASE_DATABASE_URL?.trim().replace(/\/+$/, '');
  return raw ? raw : null;
}

app.get('/api/reporters', async (_req, res) => {
  const rtdbBase = getFirebaseRtdbBase();
  if (!rtdbBase) {
    res.json({ synced: false, reporters: [] });
    return;
  }
  try {
    const resp = await fetch(`${rtdbBase}/reporters.json`);
    if (!resp.ok) {
      res.json({ synced: false, reporters: [] });
      return;
    }
    const raw = (await resp.json()) as Record<string, Partial<PublicReporterPayload>> | null;
    if (!raw || typeof raw !== 'object') {
      res.json({ synced: true, reporters: [] });
      return;
    }
    const list: PublicReporterPayload[] = Object.entries(raw)
      .filter(([, val]) => val && typeof val.name === 'string' && typeof val.birthYear === 'string')
      .map(([key, val]) => {
        const cleanName = String(val.name).trim();
        const derivedName3 =
          typeof val.name3 === 'string' && /^[A-Z]{3}$/.test(val.name3.toUpperCase())
            ? val.name3.toUpperCase()
            : cleanName.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase();
        const cleanDistrict = String(val.district || 'Muzaffarpur');
        const derivedDist3 =
          typeof val.district3 === 'string' && /^[A-Z]{3}$/.test(val.district3.toUpperCase())
            ? val.district3.toUpperCase()
            : cleanDistrict.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase();
        return {
          id: val.id || key,
          name: cleanName,
          name3: derivedName3,
          birthYear: String(val.birthYear).trim(),
          district3: derivedDist3,
          district: cleanDistrict,
          status:
            val.status === 'active' || val.status === 'suspended' ? val.status : 'pending',
          createdAt: val.createdAt || new Date().toISOString(),
          approvedCount: typeof val.approvedCount === 'number' ? val.approvedCount : 0,
          ...(typeof val.perNewsRate === 'number' &&
          Number.isFinite(val.perNewsRate) &&
          val.perNewsRate >= 0
            ? { perNewsRate: Math.round(val.perNewsRate) }
            : {}),
        };
      });
    res.json({ synced: true, reporters: list });
  } catch {
    res.json({ synced: false, reporters: [] });
  }
});

app.post('/api/reporters/register', async (req, res) => {
  const { name, district, birthYear } = req.body as {
    name?: string;
    district?: string;
    birthYear?: string;
  };

  const cleanName = typeof name === 'string' ? name.trim() : '';
  const name3 = cleanName.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase();
  const cleanYear = typeof birthYear === 'string' ? birthYear.trim() : '';
  const cleanDistrict =
    typeof district === 'string' && district.trim() ? district.trim() : 'Muzaffarpur';
  const district3 = cleanDistrict.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase();
  const yearNum = Number(cleanYear);

  if (!cleanName || name3.length < 3) {
    res.status(400).json({ error: 'Full Name must contain at least 3 English letters.' });
    return;
  }
  if (!/^\d{4}$/.test(cleanYear) || yearNum < 1960 || yearNum > 2008) {
    res.status(400).json({ error: 'Year of Birth must be between 1960 and 2008.' });
    return;
  }

  const record: PublicReporterPayload = {
    id: `REP-${district3}-${name3}${cleanYear}`,
    name: cleanName,
    name3,
    birthYear: cleanYear,
    district3,
    district: cleanDistrict,
    status: 'pending',
    createdAt: new Date().toISOString(),
    approvedCount: 0,
  };

  const rtdbBase = getFirebaseRtdbBase();
  if (rtdbBase) {
    try {
      await fetch(`${rtdbBase}/reporters/${encodeURIComponent(record.id)}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record),
      });
    } catch {
      // Ignore RTDB write failure; client localStorage remains active
    }
  }

  res.status(201).json({ ok: true, synced: Boolean(rtdbBase), reporter: record });
});

app.patch('/api/reporters/:id/status', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const tokenCheck = verifyAdminBearerToken(bearerToken);
  if (!tokenCheck.valid) {
    res.status(401).json({ error: 'Chief Editor authorization required.' });
    return;
  }

  const { status, reporter } = req.body as {
    status?: string;
    reporter?: Partial<PublicReporterPayload>;
  };
  if (status !== 'active' && status !== 'pending' && status !== 'suspended') {
    res.status(400).json({ error: 'Invalid reporter status.' });
    return;
  }

  const reporterId = req.params.id;
  const rtdbBase = getFirebaseRtdbBase();
  let rtdbSynced = false;
  if (rtdbBase) {
    try {
      // Fetch existing RTDB node first so PUT/PATCH always preserves required validate fields
      const existingResp = await fetch(
        `${rtdbBase}/reporters/${encodeURIComponent(reporterId)}.json`
      );
      const existing = existingResp.ok
        ? ((await existingResp.json()) as Partial<PublicReporterPayload> | null)
        : null;
      const mergedName = (existing?.name || reporter?.name || '').trim();
      const mergedName3 = (
        existing?.name3 ||
        reporter?.name3 ||
        mergedName.replace(/[^a-zA-Z]/g, '').slice(0, 3)
      )
        .trim()
        .toUpperCase();
      const mergedBirthYear = String(existing?.birthYear || reporter?.birthYear || '').trim();
      const mergedDistrict = String(existing?.district || reporter?.district || '').trim();
      const mergedDist3 = (
        existing?.district3 ||
        reporter?.district3 ||
        mergedDistrict.replace(/[^a-zA-Z]/g, '').slice(0, 3)
      )
        .trim()
        .toUpperCase();

      if (
        mergedName &&
        mergedName3.length === 3 &&
        mergedBirthYear.length === 4 &&
        mergedDistrict
      ) {
        const writeResp = await fetch(
          `${rtdbBase}/reporters/${encodeURIComponent(reporterId)}.json`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: reporterId,
              name: mergedName,
              name3: mergedName3,
              birthYear: mergedBirthYear,
              district3: mergedDist3,
              district: mergedDistrict,
              status,
              createdAt:
                existing?.createdAt || reporter?.createdAt || new Date().toISOString(),
              approvedCount:
                typeof existing?.approvedCount === 'number'
                  ? existing.approvedCount
                  : typeof reporter?.approvedCount === 'number'
                  ? reporter.approvedCount
                  : 0,
              ...(typeof existing?.perNewsRate === 'number' &&
              Number.isFinite(existing.perNewsRate) &&
              existing.perNewsRate >= 0
                ? { perNewsRate: Math.round(existing.perNewsRate) }
                : typeof reporter?.perNewsRate === 'number' &&
                  Number.isFinite(reporter.perNewsRate) &&
                  reporter.perNewsRate >= 0
                ? { perNewsRate: Math.round(reporter.perNewsRate) }
                : {}),
            }),
          }
        );
        rtdbSynced = writeResp.ok;
      }
    } catch {
      // Ignore RTDB sync failure
    }
  }

  res.json({ ok: true, synced: rtdbSynced, id: reporterId, status });
});

interface PendingNewsRtdbRecord {
  id: string;
  title: string;
  headline: string;
  district: string;
  scope?: 'local' | 'national' | 'international';
  script: string;
  reporterName: string;
  reporterId: string;
  ward: string;
  category: string;
  imageUrl: string;
  videoUrl?: string;
  hasOriginalAudio: boolean;
  isBreaking: boolean;
  status: 'pending';
  submittedAt: string;
}

interface LiveNewsRtdbRecord {
  id: string;
  title: string;
  headline: string;
  district: string;
  scope?: 'local' | 'national' | 'international';
  script: string;
  ward: string;
  category: string;
  reporterName: string;
  reporterId: string;
  imageUrl: string;
  videoUrl?: string;
  audioUrl?: string;
  hasOriginalAudio: boolean;
  isBreaking: boolean;
  earnedAmount?: number;
  publishedAt: string;
}

function sanitizeHostedAudioUrl(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 4_000_000) return undefined;
  if (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('/api/hosted-audio/') ||
    trimmed.startsWith('data:audio/')
  ) {
    return trimmed;
  }
  return undefined;
}

function normalizeNewsScope(raw: unknown): 'local' | 'national' | 'international' {
  if (raw === 'national' || raw === 'international') return raw;
  return 'local';
}

app.get('/api/news/sync', async (_req, res) => {
  const rtdbBase = getFirebaseRtdbBase();
  if (!rtdbBase) {
    res.json({ synced: false, pendingNews: [], liveNews: [] });
    return;
  }

  try {
    const [pendingResp, liveResp] = await Promise.all([
      fetch(`${rtdbBase}/pending_news.json`),
      fetch(`${rtdbBase}/live_news.json`),
    ]);

    if (!pendingResp.ok && !liveResp.ok) {
      res.json({ synced: false, pendingNews: [], liveNews: [] });
      return;
    }

    const pendingRaw = pendingResp.ok
      ? ((await pendingResp.json()) as Record<string, Partial<PendingNewsRtdbRecord>> | null)
      : null;
    const liveRaw = liveResp.ok
      ? ((await liveResp.json()) as Record<
          string,
          Record<string, Partial<LiveNewsRtdbRecord>>
        > | null)
      : null;

    const pendingNews: PendingNewsRtdbRecord[] = [];
    if (pendingRaw && typeof pendingRaw === 'object') {
      for (const [key, item] of Object.entries(pendingRaw)) {
        if (
          item &&
          typeof item.title === 'string' &&
          typeof item.district === 'string' &&
          typeof item.script === 'string' &&
          typeof item.reporterName === 'string'
        ) {
          pendingNews.push({
            id: item.id || key,
            title: item.title,
            headline: item.headline || item.title,
            district: item.district,
            scope: normalizeNewsScope(item.scope),
            script: item.script,
            reporterName: item.reporterName,
            reporterId: item.reporterId || 'REP-FIELD',
            ward: item.ward || 'District Headquarters',
            category: item.category || 'Breaking',
            imageUrl: item.imageUrl || '/src/assets/images/reel_muzaffarpur_bridge_1795283609462.jpg',
            videoUrl: typeof item.videoUrl === 'string' ? item.videoUrl : undefined,
            hasOriginalAudio: Boolean(item.hasOriginalAudio),
            isBreaking: Boolean(item.isBreaking),
            status: 'pending',
            submittedAt: item.submittedAt || new Date().toISOString(),
          });
        }
      }
    }

    const liveNews: LiveNewsRtdbRecord[] = [];
    if (liveRaw && typeof liveRaw === 'object') {
      for (const [districtKey, districtMap] of Object.entries(liveRaw)) {
        if (!districtMap || typeof districtMap !== 'object') continue;
        for (const [newsId, item] of Object.entries(districtMap)) {
          if (
            item &&
            typeof item.title === 'string' &&
            typeof item.district === 'string' &&
            typeof item.script === 'string'
          ) {
            liveNews.push({
              id: item.id || newsId,
              title: item.title,
              headline: item.headline || item.title,
              district: item.district || districtKey,
              scope: normalizeNewsScope(item.scope),
              script: item.script,
              ward: item.ward || 'District Headquarters',
              category: item.category || 'Breaking',
              reporterName: item.reporterName || 'Verified Reporter',
              reporterId: item.reporterId || 'REP-VERIFIED',
              imageUrl: item.imageUrl || '/src/assets/images/reel_muzaffarpur_bridge_1795283609462.jpg',
              videoUrl: typeof item.videoUrl === 'string' ? item.videoUrl : undefined,
              ...(sanitizeHostedAudioUrl(item.audioUrl)
                ? { audioUrl: sanitizeHostedAudioUrl(item.audioUrl) }
                : {}),
              hasOriginalAudio: Boolean(item.hasOriginalAudio),
              isBreaking: Boolean(item.isBreaking),
              ...(typeof item.earnedAmount === 'number' &&
              Number.isFinite(item.earnedAmount) &&
              item.earnedAmount >= 0
                ? { earnedAmount: Math.round(item.earnedAmount) }
                : {}),
              publishedAt: item.publishedAt || new Date().toISOString(),
            });
          }
        }
      }
    }

    res.json({ synced: true, pendingNews, liveNews });
  } catch {
    res.json({ synced: false, pendingNews: [], liveNews: [] });
  }
});

function decodeXmlEntities(input: string): string {
  if (!input) return '';
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_m, dec) => {
      const code = Number(dec);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : '';
    })
    .trim();
}

function extractXmlTag(block: string, tagName: string): string {
  const match = block.match(new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, 'i'));
  return match ? decodeXmlEntities(match[1]) : '';
}

function cleanNewsTextServer(rawHtml: string): string {
  if (!rawHtml) return '';
  let text = decodeXmlEntities(rawHtml);
  text = text.replace(/<[^>]*>/g, ' ');
  text = decodeXmlEntities(text);
  return text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

interface GeminiNewsStoryRaw {
  headlineHi?: string;
  headlineEn?: string;
  captionHi?: string;
  scriptSentencesHi?: string[];
  category?: string;
  wardOrZone?: string;
  sourceName?: string;
  sourceUrl?: string;
  publishedAgo?: string;
}

interface GeminiGroundingSource {
  title: string;
  uri: string;
}

interface GeminiSearchPayload {
  ok: true;
  engine: 'gemini-google-search';
  fetchedAt: string;
  groundingSources: GeminiGroundingSource[];
  local: GeminiNewsStoryRaw[];
  national: GeminiNewsStoryRaw[];
  international: GeminiNewsStoryRaw[];
}

const GEMINI_NEWS_CACHE_TTL_MS = 4 * 60 * 1000;
const geminiNewsCache = new Map<string, { fetchedAtMs: number; payload: GeminiSearchPayload }>();
let geminiSearchCooldownUntil = 0;

function extractJsonObjectFromModelText(rawText: string): Record<string, unknown> | null {
  if (!rawText) return null;
  const cleaned = rawText
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  try {
    const direct = JSON.parse(cleaned);
    if (direct && typeof direct === 'object' && !Array.isArray(direct)) {
      return direct as Record<string, unknown>;
    }
  } catch {
    // Try extracting outermost JSON object
  }

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      const sliced = cleaned.slice(firstBrace, lastBrace + 1);
      const parsed = JSON.parse(sliced);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  return null;
}

function sanitizeGeminiNewsArray(
  rawList: unknown,
  groundingSources: GeminiGroundingSource[],
  offsetSeed: number
): GeminiNewsStoryRaw[] {
  if (!Array.isArray(rawList)) return [];
  const results: GeminiNewsStoryRaw[] = [];

  for (let i = 0; i < rawList.length; i += 1) {
    const entry = rawList[i] as Record<string, unknown> | null;
    if (!entry || typeof entry !== 'object') continue;

    const headlineHi =
      typeof entry.headlineHi === 'string'
        ? entry.headlineHi.trim()
        : typeof entry.headline === 'string'
        ? entry.headline.trim()
        : '';
    const headlineEn =
      typeof entry.headlineEn === 'string' ? entry.headlineEn.trim() : headlineHi;

    if (!headlineHi || headlineHi.length < 8) continue;

    const captionHi =
      typeof entry.captionHi === 'string' && entry.captionHi.trim()
        ? entry.captionHi.trim()
        : headlineHi;

    const rawSentences = Array.isArray(entry.scriptSentencesHi)
      ? entry.scriptSentencesHi
          .filter((s): s is string => typeof s === 'string' && s.trim().length >= 10)
          .map((s) => s.trim())
          .slice(0, 4)
      : [];

    const fallbackSource =
      groundingSources.length > 0
        ? groundingSources[(i + offsetSeed) % groundingSources.length]
        : undefined;

    const rawSourceUrl =
      typeof entry.sourceUrl === 'string' && /^https?:\/\//i.test(entry.sourceUrl.trim())
        ? entry.sourceUrl.trim()
        : fallbackSource?.uri || '';

    const rawSourceName =
      typeof entry.sourceName === 'string' && entry.sourceName.trim()
        ? entry.sourceName.trim()
        : fallbackSource?.title || 'Google Search News Desk';

    results.push({
      headlineHi,
      headlineEn: headlineEn || headlineHi,
      captionHi,
      scriptSentencesHi:
        rawSentences.length >= 2
          ? rawSentences
          : [headlineHi, captionHi],
      category: typeof entry.category === 'string' ? entry.category.trim() : 'Breaking',
      wardOrZone: typeof entry.wardOrZone === 'string' ? entry.wardOrZone.trim() : '',
      sourceName: rawSourceName,
      sourceUrl: rawSourceUrl,
      publishedAgo:
        typeof entry.publishedAgo === 'string' && entry.publishedAgo.trim()
          ? entry.publishedAgo.trim()
          : 'Live • Today',
    });
  }

  return results.slice(0, 6);
}

app.get('/api/news/gemini-search', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  const rawScope = typeof req.query.scope === 'string' ? req.query.scope.trim().toLowerCase() : 'all';
  const scope: 'local' | 'national' | 'international' | 'all' =
    rawScope === 'local' || rawScope === 'national' || rawScope === 'international'
      ? rawScope
      : 'all';

  const rawDistrict = typeof req.query.district === 'string' ? req.query.district : 'Muzaffarpur';
  const rawState = typeof req.query.state === 'string' ? req.query.state : 'Bihar';
  const cleanDistrict =
    rawDistrict.replace(/[^\p{L}\p{N}\s-]/gu, '').trim().slice(0, 64) || 'Muzaffarpur';
  const cleanState =
    rawState.replace(/[^\p{L}\p{N}\s-]/gu, '').trim().slice(0, 48) || 'Bihar';
  const forceRefresh = req.query.force === '1';

  const cacheKey = `${scope}:${cleanDistrict.toLowerCase()}:${cleanState.toLowerCase()}`;
  const cachedEntry = geminiNewsCache.get(cacheKey);
  if (
    !forceRefresh &&
    cachedEntry &&
    Date.now() - cachedEntry.fetchedAtMs < GEMINI_NEWS_CACHE_TTL_MS
  ) {
    res.json(cachedEntry.payload);
    return;
  }

  if (Date.now() < geminiSearchCooldownUntil) {
    res.status(429).json({
      ok: false,
      available: false,
      quotaExhausted: true,
      error: 'Gemini Search Grounding quota cooldown active; using live RSS backup engine.',
    });
    return;
  }

  const ai = getGeminiClient();
  if (!ai) {
    res.status(503).json({
      ok: false,
      available: false,
      error: 'GEMINI_API_KEY is not configured in Settings > Secrets.',
    });
    return;
  }

  const todayDisplay = new Date().toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const requestedSections: string[] = [];
  if (scope === 'local' || scope === 'all') {
    requestedSections.push(
      `"local": 3 to 4 fresh today's news stories strictly about ${cleanDistrict} (${cleanState}), India`
    );
  }
  if (scope === 'national' || scope === 'all') {
    requestedSections.push(`"national": 3 to 4 fresh today's top India national news stories`);
  }
  if (scope === 'international' || scope === 'all') {
    requestedSections.push(
      `"international": 3 to 4 fresh today's top global/international news stories`
    );
  }

  const prompt = `Use Google Search right now to find today's (${todayDisplay}) freshest verified news headlines for:
${requestedSections.map((s, idx) => `${idx + 1}. ${s}`).join('\n')}

Return ONLY a valid raw JSON object (no markdown fences, no commentary) with keys ${
    scope === 'all' ? '"local", "national", "international"' : `"${scope}"`
  }. Each key must map to an array of objects with exact fields:
{
  "headlineHi": "Crisp Hindi broadcast news headline",
  "headlineEn": "Crisp English translation of headline",
  "captionHi": "1-sentence Hindi broadcast summary",
  "scriptSentencesHi": [
    "Sentence 1 in fluent Hindi TV news anchor style",
    "Sentence 2 with concrete today facts/locations",
    "Sentence 3 closing desk line"
  ],
  "category": "One of: Breaking, Crime, Education, Weather, Administration, Infrastructure, Transit, Clean Energy, Environment, Citizen Dispatch",
  "wardOrZone": "Specific locality, city, or bureau",
  "sourceName": "Verified publisher name",
  "sourceUrl": "Article URL from search results if known",
  "publishedAgo": "Live • Today"
}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });

    const rawChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const groundingSources: GeminiGroundingSource[] = [];
    const seenUris = new Set<string>();
    for (const chunk of rawChunks) {
      const web = chunk?.web;
      if (web?.uri && /^https?:\/\//i.test(web.uri) && !seenUris.has(web.uri)) {
        seenUris.add(web.uri);
        groundingSources.push({
          title: (web.title || 'Google Search Source').trim(),
          uri: web.uri.trim(),
        });
      }
    }

    const parsedJson = extractJsonObjectFromModelText(response.text ?? '');
    if (!parsedJson) {
      res.status(502).json({
        ok: false,
        available: true,
        error: 'Gemini search response did not contain valid JSON news items.',
      });
      return;
    }

    const local =
      scope === 'local' || scope === 'all'
        ? sanitizeGeminiNewsArray(parsedJson.local, groundingSources, 0)
        : [];
    const national =
      scope === 'national' || scope === 'all'
        ? sanitizeGeminiNewsArray(parsedJson.national, groundingSources, 3)
        : [];
    const international =
      scope === 'international' || scope === 'all'
        ? sanitizeGeminiNewsArray(parsedJson.international, groundingSources, 6)
        : [];

    if (local.length === 0 && national.length === 0 && international.length === 0) {
      res.status(502).json({
        ok: false,
        available: true,
        error: 'Gemini search returned zero live news items.',
      });
      return;
    }

    const payload: GeminiSearchPayload = {
      ok: true,
      engine: 'gemini-google-search',
      fetchedAt: new Date().toISOString(),
      groundingSources,
      local,
      national,
      international,
    };

    if (geminiNewsCache.size >= 40) {
      const oldest = geminiNewsCache.keys().next().value;
      if (oldest) geminiNewsCache.delete(oldest);
    }
    geminiNewsCache.set(cacheKey, { fetchedAtMs: Date.now(), payload });

    res.json(payload);
  } catch (err) {
    const rawMessage = err instanceof Error ? err.message : 'Gemini live search failed';
    const isQuotaError =
      rawMessage.includes('429') ||
      rawMessage.includes('RESOURCE_EXHAUSTED') ||
      rawMessage.toLowerCase().includes('quota');

    if (isQuotaError) {
      geminiSearchCooldownUntil = Date.now() + 5 * 60 * 1000;
      res.status(429).json({
        ok: false,
        available: false,
        quotaExhausted: true,
        error: 'Gemini API quota reached; cooling down for 5 minutes.',
      });
      return;
    }

    console.warn('Gemini Google Search Grounding warning:', rawMessage);
    res.status(502).json({ ok: false, available: true, error: rawMessage });
  }
});

app.get('/api/news/live-rss', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  const rawScope = typeof req.query.scope === 'string' ? req.query.scope.trim().toLowerCase() : 'local';
  const scope: 'local' | 'national' | 'international' =
    rawScope === 'national' || rawScope === 'international' ? rawScope : 'local';

  const rawDistrict = typeof req.query.district === 'string' ? req.query.district : 'Muzaffarpur';
  const rawState = typeof req.query.state === 'string' ? req.query.state : 'Bihar';
  const cleanDistrict = rawDistrict.replace(/[^\p{L}\p{N}\s-]/gu, '').trim().slice(0, 64) || 'Muzaffarpur';
  const cleanState = rawState.replace(/[^\p{L}\p{N}\s-]/gu, '').trim().slice(0, 48) || 'Bihar';

  // Strictly construct allowlisted news.google.com RSS URLs (never accept arbitrary user URLs)
  let rssUrl: string;
  if (scope === 'national') {
    rssUrl = 'https://news.google.com/rss/headlines/section/topic/NATION.hi_in?hl=hi&gl=IN&ceid=IN:hi';
  } else if (scope === 'international') {
    rssUrl = 'https://news.google.com/rss/headlines/section/topic/WORLD.hi_in?hl=hi&gl=IN&ceid=IN:hi';
  } else {
    const queryRegion = cleanState.toLowerCase() === 'bihar' ? 'Bihar' : cleanState;
    rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(
      `${cleanDistrict} ${queryRegion} news`
    )}&hl=hi&gl=IN&ceid=IN:hi`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);

  try {
    const response = await fetch(rssUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; KhabarNamaNewsDesk/1.0)',
        Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
      },
    });

    if (!response.ok) {
      res.status(502).json({ ok: false, scope, items: [] });
      return;
    }

    const xml = await response.text();
    const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
    const items = itemMatches.slice(0, 12).map((itemXml) => {
      const title = cleanNewsTextServer(extractXmlTag(itemXml, 'title'));
      const link = extractXmlTag(itemXml, 'link');
      const pubDate = extractXmlTag(itemXml, 'pubDate');
      const description = cleanNewsTextServer(extractXmlTag(itemXml, 'description'));
      const source = cleanNewsTextServer(extractXmlTag(itemXml, 'source'));
      return {
        title,
        link,
        pubDate,
        description,
        author: source,
      };
    }).filter((item) => item.title.length > 8);

    res.json({
      ok: true,
      scope,
      fetchedAt: new Date().toISOString(),
      items,
    });
  } catch {
    res.status(502).json({ ok: false, scope, items: [] });
  } finally {
    clearTimeout(timeout);
  }
});

app.post('/api/news/pending', async (req, res) => {
  const body = req.body as Partial<PendingNewsRtdbRecord>;
  const cleanTitle = typeof body.title === 'string' ? body.title.trim() : '';
  const cleanScript = typeof body.script === 'string' ? body.script.trim() : '';
  const cleanDistrict = typeof body.district === 'string' ? body.district.trim() : '';
  const cleanReporterName =
    typeof body.reporterName === 'string' ? body.reporterName.trim() : '';

  if (cleanTitle.length < 5) {
    res.status(400).json({ error: 'Headline (title) must be at least 5 characters long.' });
    return;
  }
  if (cleanScript.length < 15) {
    res.status(400).json({ error: 'News script must be at least 15 characters long.' });
    return;
  }
  if (!cleanDistrict || !cleanReporterName) {
    res.status(400).json({ error: 'District and reporter name are required.' });
    return;
  }

  const newsId =
    typeof body.id === 'string' && /^[a-zA-Z0-9_-]{3,80}$/.test(body.id)
      ? body.id
      : `sub-${Date.now()}`;

  const record: PendingNewsRtdbRecord = {
    id: newsId,
    title: cleanTitle,
    headline: cleanTitle,
    district: cleanDistrict,
    scope: normalizeNewsScope(body.scope),
    script: cleanScript,
    reporterName: cleanReporterName,
    reporterId: typeof body.reporterId === 'string' ? body.reporterId : 'REP-FIELD',
    ward: typeof body.ward === 'string' && body.ward.trim() ? body.ward.trim() : 'District HQ',
    category: typeof body.category === 'string' ? body.category : 'Breaking',
    imageUrl: typeof body.imageUrl === 'string' ? body.imageUrl : '/src/assets/images/reel_muzaffarpur_bridge_1795283609462.jpg',
    ...(typeof body.videoUrl === 'string' && !body.videoUrl.startsWith('blob:')
      ? { videoUrl: body.videoUrl }
      : {}),
    hasOriginalAudio: Boolean(body.hasOriginalAudio),
    isBreaking: Boolean(body.isBreaking),
    status: 'pending',
    submittedAt: body.submittedAt || new Date().toISOString(),
  };

  const rtdbBase = getFirebaseRtdbBase();
  let rtdbSynced = false;
  if (rtdbBase) {
    try {
      const writeResp = await fetch(
        `${rtdbBase}/pending_news/${encodeURIComponent(newsId)}.json`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(record),
        }
      );
      rtdbSynced = writeResp.ok;
    } catch {
      // Ignore RTDB write failure; client localStorage remains active
    }
  }

  res.status(201).json({ ok: true, synced: rtdbSynced, story: record });
});

app.post('/api/news/approve', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const tokenCheck = verifyAdminBearerToken(bearerToken);
  if (!tokenCheck.valid) {
    res.status(401).json({ error: 'Chief Editor authorization required.' });
    return;
  }

  const body = req.body as Partial<LiveNewsRtdbRecord> & { pendingStoryId?: string };
  const cleanTitle = typeof body.title === 'string' ? body.title.trim() : '';
  const cleanScript = typeof body.script === 'string' ? body.script.trim() : '';
  const cleanDistrict = typeof body.district === 'string' ? body.district.trim() : '';

  if (cleanTitle.length < 5 || cleanScript.length < 15 || !cleanDistrict) {
    res.status(400).json({ error: 'Valid title, district, and script are required.' });
    return;
  }

  const newsId =
    typeof body.id === 'string' && /^[a-zA-Z0-9_-]{3,80}$/.test(body.id)
      ? body.id
      : `live-${Date.now()}`;

  const liveRecord: LiveNewsRtdbRecord = {
    id: newsId,
    title: cleanTitle,
    headline: cleanTitle,
    district: cleanDistrict,
    scope: normalizeNewsScope(body.scope),
    script: cleanScript,
    ward: typeof body.ward === 'string' && body.ward.trim() ? body.ward.trim() : 'District HQ',
    category: typeof body.category === 'string' ? body.category : 'Breaking',
    reporterName:
      typeof body.reporterName === 'string' ? body.reporterName : 'Verified Reporter',
    reporterId: typeof body.reporterId === 'string' ? body.reporterId : 'REP-VERIFIED',
    imageUrl: typeof body.imageUrl === 'string' ? body.imageUrl : '/src/assets/images/reel_muzaffarpur_bridge_1795283609462.jpg',
    ...(typeof body.videoUrl === 'string' && !body.videoUrl.startsWith('blob:')
      ? { videoUrl: body.videoUrl }
      : {}),
    ...(sanitizeHostedAudioUrl(body.audioUrl)
      ? { audioUrl: sanitizeHostedAudioUrl(body.audioUrl) }
      : {}),
    hasOriginalAudio: Boolean(body.hasOriginalAudio),
    isBreaking: Boolean(body.isBreaking),
    ...(typeof body.earnedAmount === 'number' &&
    Number.isFinite(body.earnedAmount) &&
    body.earnedAmount >= 0
      ? { earnedAmount: Math.round(body.earnedAmount) }
      : {}),
    publishedAt: body.publishedAt || new Date().toISOString(),
  };

  const rtdbBase = getFirebaseRtdbBase();
  let rtdbSynced = false;
  if (rtdbBase) {
    try {
      const liveResp = await fetch(
        `${rtdbBase}/live_news/${encodeURIComponent(cleanDistrict)}/${encodeURIComponent(newsId)}.json`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(liveRecord),
        }
      );
      if (body.pendingStoryId) {
        await fetch(
          `${rtdbBase}/pending_news/${encodeURIComponent(body.pendingStoryId)}.json`,
          { method: 'DELETE' }
        );
        if (liveRecord.reporterId && liveRecord.reporterId !== 'REP-VERIFIED') {
          try {
            const repUrl = `${rtdbBase}/reporters/${encodeURIComponent(liveRecord.reporterId)}.json`;
            const repResp = await fetch(repUrl);
            const existingRep = repResp.ok
              ? ((await repResp.json()) as Partial<PublicReporterPayload> | null)
              : null;
            if (
              existingRep &&
              typeof existingRep.name === 'string' &&
              typeof existingRep.name3 === 'string' &&
              typeof existingRep.birthYear === 'string' &&
              typeof existingRep.district === 'string'
            ) {
              await fetch(repUrl, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  ...existingRep,
                  id: existingRep.id || liveRecord.reporterId,
                  approvedCount:
                    (typeof existingRep.approvedCount === 'number'
                      ? existingRep.approvedCount
                      : 0) + 1,
                }),
              });
            }
          } catch {
            // Best-effort reporter approvedCount sync
          }
        }
      }
      rtdbSynced = liveResp.ok;
    } catch {
      // Ignore RTDB write failure
    }
  }

  res.json({ ok: true, synced: rtdbSynced, liveNews: liveRecord });
});

app.put('/api/news/live/:district/:id', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const tokenCheck = verifyAdminBearerToken(bearerToken);
  if (!tokenCheck.valid) {
    res.status(401).json({ error: 'Chief Editor authorization required.' });
    return;
  }

  const districtParam = req.params.district.trim();
  const newsId = req.params.id.trim();
  const body = req.body as Partial<LiveNewsRtdbRecord>;
  const cleanTitle = typeof body.title === 'string' ? body.title.trim() : '';
  const cleanScript = typeof body.script === 'string' ? body.script.trim() : '';

  if (!districtParam || !newsId || cleanTitle.length < 5 || cleanScript.length < 15) {
    res.status(400).json({ error: 'District, title, and script are required for live_news.' });
    return;
  }

  const liveRecord: LiveNewsRtdbRecord = {
    id: newsId,
    title: cleanTitle,
    headline: cleanTitle,
    district: districtParam,
    scope: normalizeNewsScope(body.scope),
    script: cleanScript,
    ward: typeof body.ward === 'string' && body.ward.trim() ? body.ward.trim() : 'District HQ',
    category: typeof body.category === 'string' ? body.category : 'Breaking',
    reporterName:
      typeof body.reporterName === 'string' ? body.reporterName : 'Verified Reporter',
    reporterId: typeof body.reporterId === 'string' ? body.reporterId : 'REP-VERIFIED',
    imageUrl: typeof body.imageUrl === 'string' ? body.imageUrl : '/src/assets/images/reel_muzaffarpur_bridge_1795283609462.jpg',
    ...(typeof body.videoUrl === 'string' && !body.videoUrl.startsWith('blob:')
      ? { videoUrl: body.videoUrl }
      : {}),
    ...(sanitizeHostedAudioUrl(body.audioUrl)
      ? { audioUrl: sanitizeHostedAudioUrl(body.audioUrl) }
      : {}),
    hasOriginalAudio: Boolean(body.hasOriginalAudio),
    isBreaking: Boolean(body.isBreaking),
    publishedAt: body.publishedAt || new Date().toISOString(),
  };

  const rtdbBase = getFirebaseRtdbBase();
  let rtdbSynced = false;
  if (rtdbBase) {
    try {
      const writeResp = await fetch(
        `${rtdbBase}/live_news/${encodeURIComponent(districtParam)}/${encodeURIComponent(newsId)}.json`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(liveRecord),
        }
      );
      rtdbSynced = writeResp.ok;
    } catch {
      // Ignore RTDB write failure
    }
  }

  res.json({ ok: true, synced: rtdbSynced, liveNews: liveRecord });
});

app.delete('/api/news/pending/:id', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const tokenCheck = verifyAdminBearerToken(bearerToken);
  if (!tokenCheck.valid) {
    res.status(401).json({ error: 'Chief Editor authorization required.' });
    return;
  }

  const storyId = req.params.id;
  const rtdbBase = getFirebaseRtdbBase();
  let rtdbSynced = false;
  if (rtdbBase) {
    try {
      const delResp = await fetch(
        `${rtdbBase}/pending_news/${encodeURIComponent(storyId)}.json`,
        { method: 'DELETE' }
      );
      rtdbSynced = delResp.ok;
    } catch {
      // Ignore RTDB delete failure
    }
  }

  res.json({ ok: true, synced: rtdbSynced, id: storyId });
});

interface LiveTvChannelRtdbRecord {
  id: string;
  name: string;
  category: 'local' | 'national' | 'international';
  district: string;
  type: 'hls' | 'youtube';
  regionLabel: string;
  languageLabel: string;
  youtubeChannelId?: string;
  streamUrl: string;
  backupStreamUrl?: string;
  backupType?: 'hls' | 'youtube';
  watchUrl: string;
  isCustom: boolean;
  addedAt: string;
}

interface PendingTvChannelRtdbRecord {
  id: string;
  name: string;
  district: string;
  category: 'local' | 'national' | 'international';
  type: 'hls' | 'youtube';
  regionLabel: string;
  languageLabel: string;
  youtubeChannelId?: string;
  streamUrl: string;
  backupStreamUrl?: string;
  backupType?: 'hls' | 'youtube';
  watchUrl: string;
  reporterId: string;
  reporterName: string;
  status: 'pending';
  submittedAt: string;
}

function normalizeLiveTvRecord(
  key: string,
  item: Partial<LiveTvChannelRtdbRecord>,
  fallbackDistrict?: string
): LiveTvChannelRtdbRecord | null {
  if (
    !item ||
    typeof item.name !== 'string' ||
    typeof item.streamUrl !== 'string' ||
    (item.category !== 'local' &&
      item.category !== 'national' &&
      item.category !== 'international')
  ) {
    return null;
  }
  const cleanUrl = String(item.streamUrl).trim();
  const inferredType: 'hls' | 'youtube' =
    item.type === 'hls' || item.type === 'youtube'
      ? item.type
      : /\.m3u8(\?.*)?$/i.test(cleanUrl)
      ? 'hls'
      : 'youtube';
  const resolvedDistrict =
    typeof item.district === 'string' && item.district.trim()
      ? item.district.trim()
      : fallbackDistrict ||
        (item.category === 'local'
          ? 'ALL_BIHAR'
          : item.category === 'national'
          ? 'NATIONAL'
          : 'INTERNATIONAL');
  return {
    id: item.id || key,
    name: String(item.name).trim(),
    category: item.category,
    district: resolvedDistrict,
    type: inferredType,
    regionLabel:
      typeof item.regionLabel === 'string' && item.regionLabel.trim()
        ? item.regionLabel.trim()
        : item.category === 'local'
        ? resolvedDistrict === 'ALL_BIHAR'
          ? 'All Bihar Regional Desk'
          : `${resolvedDistrict} Local Cable & Web TV`
        : item.category === 'national'
        ? 'India 24x7'
        : 'Global News',
    languageLabel:
      typeof item.languageLabel === 'string' && item.languageLabel.trim()
        ? item.languageLabel.trim()
        : item.category === 'international'
        ? 'English'
        : 'Hindi',
    ...(typeof item.youtubeChannelId === 'string' && item.youtubeChannelId.trim()
      ? { youtubeChannelId: item.youtubeChannelId.trim() }
      : {}),
    streamUrl: cleanUrl,
    ...(typeof item.backupStreamUrl === 'string' && item.backupStreamUrl.trim()
      ? {
          backupStreamUrl: item.backupStreamUrl.trim(),
          backupType:
            item.backupType === 'hls' || item.backupType === 'youtube'
              ? item.backupType
              : /\.m3u8(\?.*)?$/i.test(item.backupStreamUrl.trim())
              ? 'hls'
              : 'youtube',
        }
      : {}),
    watchUrl:
      typeof item.watchUrl === 'string' && item.watchUrl.trim()
        ? item.watchUrl.trim()
        : cleanUrl,
    isCustom: true,
    addedAt: item.addedAt || new Date().toISOString(),
  };
}

app.get('/api/live-tv', async (_req, res) => {
  const rtdbBase = getFirebaseRtdbBase();
  if (!rtdbBase) {
    res.json({ synced: false, channels: [] });
    return;
  }

  try {
    const [globalResp, districtResp] = await Promise.all([
      fetch(`${rtdbBase}/live_tv_channels.json`),
      fetch(`${rtdbBase}/district_tv_channels.json`),
    ]);
    if (!globalResp.ok && !districtResp.ok) {
      res.json({ synced: false, channels: [] });
      return;
    }

    const merged = new Map<string, LiveTvChannelRtdbRecord>();

    if (globalResp.ok) {
      const globalRaw = (await globalResp.json()) as Record<
        string,
        Partial<LiveTvChannelRtdbRecord>
      > | null;
      if (globalRaw && typeof globalRaw === 'object') {
        for (const [key, item] of Object.entries(globalRaw)) {
          const normalized = normalizeLiveTvRecord(key, item);
          if (normalized) merged.set(normalized.id, normalized);
        }
      }
    }

    if (districtResp.ok) {
      const distRaw = (await districtResp.json()) as Record<
        string,
        Record<string, Partial<LiveTvChannelRtdbRecord>>
      > | null;
      if (distRaw && typeof distRaw === 'object') {
        for (const [districtKey, channelMap] of Object.entries(distRaw)) {
          if (!channelMap || typeof channelMap !== 'object') continue;
          for (const [key, item] of Object.entries(channelMap)) {
            const normalized = normalizeLiveTvRecord(key, item, districtKey);
            if (normalized) merged.set(normalized.id, normalized);
          }
        }
      }
    }

    res.json({ synced: true, channels: Array.from(merged.values()) });
  } catch {
    res.json({ synced: false, channels: [] });
  }
});

app.post('/api/live-tv', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const tokenCheck = verifyAdminBearerToken(bearerToken);
  if (!tokenCheck.valid) {
    res.status(401).json({ error: 'Chief Editor authorization required.' });
    return;
  }

  const body = req.body as Partial<LiveTvChannelRtdbRecord>;
  const cleanName = typeof body.name === 'string' ? body.name.trim() : '';
  const cleanStreamUrl = typeof body.streamUrl === 'string' ? body.streamUrl.trim() : '';
  const cleanBackupUrl =
    typeof body.backupStreamUrl === 'string' ? body.backupStreamUrl.trim() : '';
  const cleanWatchUrl =
    typeof body.watchUrl === 'string' && body.watchUrl.trim()
      ? body.watchUrl.trim()
      : cleanStreamUrl;
  const category = body.category;
  const targetDistrict =
    typeof body.district === 'string' && body.district.trim()
      ? body.district.trim()
      : category === 'local'
      ? 'ALL_BIHAR'
      : category === 'national'
      ? 'NATIONAL'
      : 'INTERNATIONAL';

  if (!cleanName || cleanName.length < 2) {
    res.status(400).json({ error: 'Channel name must be at least 2 characters.' });
    return;
  }
  if (category !== 'local' && category !== 'national' && category !== 'international') {
    res.status(400).json({ error: 'Category must be local, national, or international.' });
    return;
  }
  if (!/^https?:\/\//i.test(cleanStreamUrl)) {
    res.status(400).json({ error: 'A valid http(s) stream embed URL is required.' });
    return;
  }

  const channelId =
    typeof body.id === 'string' && /^[a-zA-Z0-9_-]{3,80}$/.test(body.id)
      ? body.id
      : `tv-custom-${Date.now()}`;

  const resolvedType: 'hls' | 'youtube' =
    body.type === 'hls' || body.type === 'youtube'
      ? body.type
      : /\.m3u8(\?.*)?$/i.test(cleanStreamUrl)
      ? 'hls'
      : 'youtube';

  const record: LiveTvChannelRtdbRecord = {
    id: channelId,
    name: cleanName,
    category,
    district: targetDistrict,
    type: resolvedType,
    regionLabel:
      typeof body.regionLabel === 'string' && body.regionLabel.trim()
        ? body.regionLabel.trim()
        : category === 'local'
        ? targetDistrict === 'ALL_BIHAR'
          ? 'All Bihar Regional Desk'
          : `${targetDistrict} Local Cable & Web TV`
        : category === 'national'
        ? 'India 24x7'
        : 'Global News',
    languageLabel:
      typeof body.languageLabel === 'string' && body.languageLabel.trim()
        ? body.languageLabel.trim()
        : category === 'international'
        ? 'English'
        : 'Hindi',
    ...(typeof body.youtubeChannelId === 'string' && body.youtubeChannelId.trim()
      ? { youtubeChannelId: body.youtubeChannelId.trim() }
      : {}),
    streamUrl: cleanStreamUrl,
    ...(cleanBackupUrl && /^https?:\/\//i.test(cleanBackupUrl)
      ? {
          backupStreamUrl: cleanBackupUrl,
          backupType:
            body.backupType === 'hls' || body.backupType === 'youtube'
              ? body.backupType
              : /\.m3u8(\?.*)?$/i.test(cleanBackupUrl)
              ? 'hls'
              : 'youtube',
        }
      : {}),
    watchUrl: cleanWatchUrl,
    isCustom: true,
    addedAt: body.addedAt || new Date().toISOString(),
  };

  const rtdbBase = getFirebaseRtdbBase();
  let rtdbSynced = false;
  if (rtdbBase) {
    try {
      const targetUrl =
        category === 'local'
          ? `${rtdbBase}/district_tv_channels/${encodeURIComponent(targetDistrict)}/${encodeURIComponent(channelId)}.json`
          : `${rtdbBase}/live_tv_channels/${encodeURIComponent(channelId)}.json`;
      const writeResp = await fetch(targetUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record),
      });
      rtdbSynced = writeResp.ok;
    } catch {
      // Ignore RTDB write failure; localStorage remains active
    }
  }

  res.status(201).json({ ok: true, synced: rtdbSynced, channel: record });
});

app.delete('/api/live-tv/:id', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const tokenCheck = verifyAdminBearerToken(bearerToken);
  if (!tokenCheck.valid) {
    res.status(401).json({ error: 'Chief Editor authorization required.' });
    return;
  }

  const channelId = req.params.id;
  const districtQuery =
    typeof req.query.district === 'string' && req.query.district.trim()
      ? req.query.district.trim()
      : '';
  const rtdbBase = getFirebaseRtdbBase();
  let rtdbSynced = false;
  if (rtdbBase) {
    try {
      const delOps: Array<Promise<Response>> = [
        fetch(`${rtdbBase}/live_tv_channels/${encodeURIComponent(channelId)}.json`, {
          method: 'DELETE',
        }),
      ];
      if (districtQuery) {
        delOps.push(
          fetch(
            `${rtdbBase}/district_tv_channels/${encodeURIComponent(districtQuery)}/${encodeURIComponent(channelId)}.json`,
            { method: 'DELETE' }
          )
        );
      }
      const results = await Promise.all(delOps);
      rtdbSynced = results.some((r) => r.ok);
    } catch {
      // Ignore RTDB delete failure
    }
  }

  res.json({ ok: true, synced: rtdbSynced, id: channelId });
});

app.get('/api/tv-submissions', async (_req, res) => {
  const rtdbBase = getFirebaseRtdbBase();
  if (!rtdbBase) {
    res.json({ synced: false, submissions: [] });
    return;
  }

  try {
    const resp = await fetch(`${rtdbBase}/pending_tv_channels.json`);
    if (!resp.ok) {
      res.json({ synced: false, submissions: [] });
      return;
    }
    const raw = (await resp.json()) as Record<string, Partial<PendingTvChannelRtdbRecord>> | null;
    if (!raw || typeof raw !== 'object') {
      res.json({ synced: true, submissions: [] });
      return;
    }

    const submissions: PendingTvChannelRtdbRecord[] = Object.entries(raw)
      .filter(
        ([, item]) =>
          item &&
          typeof item.name === 'string' &&
          typeof item.district === 'string' &&
          typeof item.streamUrl === 'string'
      )
      .map(([key, item]) => ({
        id: item.id || key,
        name: String(item.name).trim(),
        district: String(item.district).trim(),
        category:
          item.category === 'national' || item.category === 'international'
            ? item.category
            : 'local',
        type:
          item.type === 'hls' || item.type === 'youtube'
            ? item.type
            : /\.m3u8(\?.*)?$/i.test(String(item.streamUrl))
            ? 'hls'
            : 'youtube',
        regionLabel:
          typeof item.regionLabel === 'string' && item.regionLabel.trim()
            ? item.regionLabel.trim()
            : `${String(item.district).trim()} Local Cable & Web TV`,
        languageLabel:
          typeof item.languageLabel === 'string' && item.languageLabel.trim()
            ? item.languageLabel.trim()
            : 'Hindi',
        ...(typeof item.youtubeChannelId === 'string' && item.youtubeChannelId.trim()
          ? { youtubeChannelId: item.youtubeChannelId.trim() }
          : {}),
        streamUrl: String(item.streamUrl).trim(),
        ...(typeof item.backupStreamUrl === 'string' && item.backupStreamUrl.trim()
          ? {
              backupStreamUrl: item.backupStreamUrl.trim(),
              backupType:
                item.backupType === 'hls' || item.backupType === 'youtube'
                  ? item.backupType
                  : 'youtube',
            }
          : {}),
        watchUrl:
          typeof item.watchUrl === 'string' && item.watchUrl.trim()
            ? item.watchUrl.trim()
            : String(item.streamUrl).trim(),
        reporterId: typeof item.reporterId === 'string' ? item.reporterId : 'REP-FIELD',
        reporterName: typeof item.reporterName === 'string' ? item.reporterName : 'District Reporter',
        status: 'pending',
        submittedAt: item.submittedAt || new Date().toISOString(),
      }));

    res.json({ synced: true, submissions });
  } catch {
    res.json({ synced: false, submissions: [] });
  }
});

app.post('/api/tv-submissions', async (req, res) => {
  const body = req.body as Partial<PendingTvChannelRtdbRecord>;
  const cleanName = typeof body.name === 'string' ? body.name.trim() : '';
  const cleanDistrict = typeof body.district === 'string' ? body.district.trim() : '';
  const cleanStreamUrl = typeof body.streamUrl === 'string' ? body.streamUrl.trim() : '';
  const cleanReporterName =
    typeof body.reporterName === 'string' ? body.reporterName.trim() : '';

  if (cleanName.length < 2) {
    res.status(400).json({ error: 'Channel name must be at least 2 characters.' });
    return;
  }
  if (!cleanDistrict || !cleanReporterName) {
    res.status(400).json({ error: 'District and reporter name are required.' });
    return;
  }
  if (!/^https?:\/\//i.test(cleanStreamUrl)) {
    res.status(400).json({ error: 'A valid stream URL (.m3u8 or YouTube) is required.' });
    return;
  }

  const subId =
    typeof body.id === 'string' && /^[a-zA-Z0-9_-]{3,80}$/.test(body.id)
      ? body.id
      : `tvsub-${Date.now()}`;

  const record: PendingTvChannelRtdbRecord = {
    id: subId,
    name: cleanName,
    district: cleanDistrict,
    category:
      body.category === 'national' || body.category === 'international'
        ? body.category
        : 'local',
    type:
      body.type === 'hls' || body.type === 'youtube'
        ? body.type
        : /\.m3u8(\?.*)?$/i.test(cleanStreamUrl)
        ? 'hls'
        : 'youtube',
    regionLabel:
      typeof body.regionLabel === 'string' && body.regionLabel.trim()
        ? body.regionLabel.trim()
        : `${cleanDistrict} Local Cable & Web TV`,
    languageLabel:
      typeof body.languageLabel === 'string' && body.languageLabel.trim()
        ? body.languageLabel.trim()
        : 'Hindi',
    ...(typeof body.youtubeChannelId === 'string' && body.youtubeChannelId.trim()
      ? { youtubeChannelId: body.youtubeChannelId.trim() }
      : {}),
    streamUrl: cleanStreamUrl,
    ...(typeof body.backupStreamUrl === 'string' && /^https?:\/\//i.test(body.backupStreamUrl.trim())
      ? {
          backupStreamUrl: body.backupStreamUrl.trim(),
          backupType:
            body.backupType === 'hls' || body.backupType === 'youtube'
              ? body.backupType
              : /\.m3u8(\?.*)?$/i.test(body.backupStreamUrl.trim())
              ? 'hls'
              : 'youtube',
        }
      : {}),
    watchUrl:
      typeof body.watchUrl === 'string' && body.watchUrl.trim()
        ? body.watchUrl.trim()
        : cleanStreamUrl,
    reporterId: typeof body.reporterId === 'string' ? body.reporterId : 'REP-FIELD',
    reporterName: cleanReporterName,
    status: 'pending',
    submittedAt: body.submittedAt || new Date().toISOString(),
  };

  const rtdbBase = getFirebaseRtdbBase();
  let rtdbSynced = false;
  if (rtdbBase) {
    try {
      const writeResp = await fetch(
        `${rtdbBase}/pending_tv_channels/${encodeURIComponent(subId)}.json`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(record),
        }
      );
      rtdbSynced = writeResp.ok;
    } catch {
      // Ignore RTDB write failure
    }
  }

  res.status(201).json({ ok: true, synced: rtdbSynced, submission: record });
});

app.post('/api/tv-submissions/:id/approve', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const tokenCheck = verifyAdminBearerToken(bearerToken);
  if (!tokenCheck.valid) {
    res.status(401).json({ error: 'Chief Editor authorization required.' });
    return;
  }

  const subId = req.params.id;
  const body = req.body as Partial<PendingTvChannelRtdbRecord>;
  const cleanName = typeof body.name === 'string' ? body.name.trim() : '';
  const cleanDistrict = typeof body.district === 'string' ? body.district.trim() : 'ALL_BIHAR';
  const cleanStreamUrl = typeof body.streamUrl === 'string' ? body.streamUrl.trim() : '';
  const category =
    body.category === 'national' || body.category === 'international' ? body.category : 'local';

  if (!cleanName || !/^https?:\/\//i.test(cleanStreamUrl)) {
    res.status(400).json({ error: 'Valid channel details are required to approve.' });
    return;
  }

  const channelId = `tv-${cleanDistrict.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;
  const liveRecord: LiveTvChannelRtdbRecord = {
    id: channelId,
    name: cleanName,
    category,
    district: cleanDistrict,
    type:
      body.type === 'hls' || body.type === 'youtube'
        ? body.type
        : /\.m3u8(\?.*)?$/i.test(cleanStreamUrl)
        ? 'hls'
        : 'youtube',
    regionLabel:
      typeof body.regionLabel === 'string' && body.regionLabel.trim()
        ? body.regionLabel.trim()
        : `${cleanDistrict} Local Cable & Web TV`,
    languageLabel:
      typeof body.languageLabel === 'string' && body.languageLabel.trim()
        ? body.languageLabel.trim()
        : 'Hindi',
    ...(typeof body.youtubeChannelId === 'string' && body.youtubeChannelId.trim()
      ? { youtubeChannelId: body.youtubeChannelId.trim() }
      : {}),
    streamUrl: cleanStreamUrl,
    ...(typeof body.backupStreamUrl === 'string' && /^https?:\/\//i.test(body.backupStreamUrl.trim())
      ? {
          backupStreamUrl: body.backupStreamUrl.trim(),
          backupType:
            body.backupType === 'hls' || body.backupType === 'youtube'
              ? body.backupType
              : 'youtube',
        }
      : {}),
    watchUrl:
      typeof body.watchUrl === 'string' && body.watchUrl.trim()
        ? body.watchUrl.trim()
        : cleanStreamUrl,
    isCustom: true,
    addedAt: new Date().toISOString(),
  };

  const rtdbBase = getFirebaseRtdbBase();
  let rtdbSynced = false;
  if (rtdbBase) {
    try {
      const targetUrl =
        category === 'local'
          ? `${rtdbBase}/district_tv_channels/${encodeURIComponent(cleanDistrict)}/${encodeURIComponent(channelId)}.json`
          : `${rtdbBase}/live_tv_channels/${encodeURIComponent(channelId)}.json`;
      const writeResp = await fetch(targetUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(liveRecord),
      });
      await fetch(`${rtdbBase}/pending_tv_channels/${encodeURIComponent(subId)}.json`, {
        method: 'DELETE',
      });
      rtdbSynced = writeResp.ok;
    } catch {
      // Ignore RTDB error
    }
  }

  res.json({ ok: true, synced: rtdbSynced, channel: liveRecord });
});

app.delete('/api/tv-submissions/:id', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const tokenCheck = verifyAdminBearerToken(bearerToken);
  if (!tokenCheck.valid) {
    res.status(401).json({ error: 'Chief Editor authorization required.' });
    return;
  }

  const subId = req.params.id;
  const rtdbBase = getFirebaseRtdbBase();
  let rtdbSynced = false;
  if (rtdbBase) {
    try {
      const delResp = await fetch(
        `${rtdbBase}/pending_tv_channels/${encodeURIComponent(subId)}.json`,
        { method: 'DELETE' }
      );
      rtdbSynced = delResp.ok;
    } catch {
      // Ignore RTDB error
    }
  }

  res.json({ ok: true, synced: rtdbSynced, id: subId });
});

interface LocalAdRtdbRecord {
  id: string;
  district: string;
  format: 'banner' | 'reel';
  businessName: string;
  tagline: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  phone: string;
  whatsapp: string;
  active: boolean;
  impressions: number;
  clicks: number;
  createdAt: string;
}

interface AdNetworkConfigRtdbRecord {
  enabled: boolean;
  adsensePublisherId: string;
  adsenseBannerSlotId: string;
  admobUnitId: string;
  updatedAt?: string;
}

app.get('/api/ads/sync', async (_req, res) => {
  const rtdbBase = getFirebaseRtdbBase();
  if (!rtdbBase) {
    res.json({ synced: false, localAds: [], adNetworkConfig: null });
    return;
  }

  try {
    const [adsResp, configResp] = await Promise.all([
      fetch(`${rtdbBase}/local_ads.json`),
      fetch(`${rtdbBase}/ad_network_config.json`),
    ]);

    if (!adsResp.ok && !configResp.ok) {
      res.json({ synced: false, localAds: [], adNetworkConfig: null });
      return;
    }

    const adsRaw = adsResp.ok
      ? ((await adsResp.json()) as Record<
          string,
          Record<string, Partial<LocalAdRtdbRecord>>
        > | null)
      : null;
    const configRaw = configResp.ok
      ? ((await configResp.json()) as Partial<AdNetworkConfigRtdbRecord> | null)
      : null;

    const localAds: LocalAdRtdbRecord[] = [];
    if (adsRaw && typeof adsRaw === 'object') {
      for (const [districtKey, districtMap] of Object.entries(adsRaw)) {
        if (!districtMap || typeof districtMap !== 'object') continue;
        for (const [adId, item] of Object.entries(districtMap)) {
          if (item && typeof item.businessName === 'string') {
            localAds.push({
              id: item.id || adId,
              district: item.district || districtKey,
              format: item.format === 'reel' ? 'reel' : 'banner',
              businessName: item.businessName,
              tagline: typeof item.tagline === 'string' ? item.tagline : '',
              mediaUrl: typeof item.mediaUrl === 'string' ? item.mediaUrl : '',
              mediaType: item.mediaType === 'video' ? 'video' : 'image',
              phone: typeof item.phone === 'string' ? item.phone : '',
              whatsapp: typeof item.whatsapp === 'string' ? item.whatsapp : '',
              active: item.active !== false,
              impressions: typeof item.impressions === 'number' ? item.impressions : 0,
              clicks: typeof item.clicks === 'number' ? item.clicks : 0,
              createdAt: item.createdAt || new Date().toISOString(),
            });
          }
        }
      }
    }

    const adNetworkConfig: AdNetworkConfigRtdbRecord | null =
      configRaw && typeof configRaw === 'object'
        ? {
            enabled: Boolean(configRaw.enabled),
            adsensePublisherId:
              typeof configRaw.adsensePublisherId === 'string'
                ? configRaw.adsensePublisherId
                : '',
            adsenseBannerSlotId:
              typeof configRaw.adsenseBannerSlotId === 'string'
                ? configRaw.adsenseBannerSlotId
                : '',
            admobUnitId:
              typeof configRaw.admobUnitId === 'string' ? configRaw.admobUnitId : '',
            updatedAt: configRaw.updatedAt,
          }
        : null;

    res.json({ synced: true, localAds, adNetworkConfig });
  } catch {
    res.json({ synced: false, localAds: [], adNetworkConfig: null });
  }
});

app.post('/api/ads/local', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const tokenCheck = verifyAdminBearerToken(bearerToken);
  if (!tokenCheck.valid) {
    res.status(401).json({ error: 'Chief Editor authorization required.' });
    return;
  }

  const body = req.body as Partial<LocalAdRtdbRecord>;
  const cleanBusinessName =
    typeof body.businessName === 'string' ? body.businessName.trim() : '';
  const cleanDistrict = typeof body.district === 'string' ? body.district.trim() : '';
  const cleanTagline = typeof body.tagline === 'string' ? body.tagline.trim() : '';
  const format = body.format === 'reel' ? 'reel' : 'banner';

  if (cleanBusinessName.length < 2) {
    res.status(400).json({ error: 'Business Name must be at least 2 characters.' });
    return;
  }
  if (!cleanDistrict) {
    res.status(400).json({ error: 'Target District is required.' });
    return;
  }

  const adId =
    typeof body.id === 'string' && /^[a-zA-Z0-9_-]{3,80}$/.test(body.id)
      ? body.id
      : `ad-${Date.now()}`;

  const record: LocalAdRtdbRecord = {
    id: adId,
    district: cleanDistrict,
    format,
    businessName: cleanBusinessName,
    tagline: cleanTagline || `Special Offer from ${cleanBusinessName}`,
    mediaUrl: typeof body.mediaUrl === 'string' ? body.mediaUrl.trim() : '',
    mediaType: body.mediaType === 'video' ? 'video' : 'image',
    phone: typeof body.phone === 'string' ? body.phone.trim() : '',
    whatsapp: typeof body.whatsapp === 'string' ? body.whatsapp.trim() : '',
    active: body.active !== false,
    impressions: typeof body.impressions === 'number' ? body.impressions : 0,
    clicks: typeof body.clicks === 'number' ? body.clicks : 0,
    createdAt: body.createdAt || new Date().toISOString(),
  };

  const rtdbBase = getFirebaseRtdbBase();
  let rtdbSynced = false;
  if (rtdbBase) {
    try {
      const writeResp = await fetch(
        `${rtdbBase}/local_ads/${encodeURIComponent(cleanDistrict)}/${encodeURIComponent(adId)}.json`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(record),
        }
      );
      rtdbSynced = writeResp.ok;
    } catch {
      // Ignore RTDB write failure
    }
  }

  res.status(201).json({ ok: true, synced: rtdbSynced, ad: record });
});

app.patch('/api/ads/local/:district/:id', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const tokenCheck = verifyAdminBearerToken(bearerToken);
  if (!tokenCheck.valid) {
    res.status(401).json({ error: 'Chief Editor authorization required.' });
    return;
  }

  const districtParam = req.params.district.trim();
  const adId = req.params.id.trim();
  const { active, ad } = req.body as { active?: boolean; ad?: Partial<LocalAdRtdbRecord> };
  if (typeof active !== 'boolean') {
    res.status(400).json({ error: 'Boolean active status is required.' });
    return;
  }

  const rtdbBase = getFirebaseRtdbBase();
  let rtdbSynced = false;
  if (rtdbBase) {
    try {
      const existingResp = await fetch(
        `${rtdbBase}/local_ads/${encodeURIComponent(districtParam)}/${encodeURIComponent(adId)}.json`
      );
      const existing = existingResp.ok
        ? ((await existingResp.json()) as Partial<LocalAdRtdbRecord> | null)
        : null;
      const mergedBusiness = (existing?.businessName || ad?.businessName || '').trim();
      if (mergedBusiness) {
        const writeResp = await fetch(
          `${rtdbBase}/local_ads/${encodeURIComponent(districtParam)}/${encodeURIComponent(adId)}.json`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: adId,
              district: districtParam,
              format: existing?.format || ad?.format || 'banner',
              businessName: mergedBusiness,
              tagline: existing?.tagline ?? ad?.tagline ?? '',
              mediaUrl: existing?.mediaUrl ?? ad?.mediaUrl ?? '',
              mediaType: existing?.mediaType || ad?.mediaType || 'image',
              phone: existing?.phone ?? ad?.phone ?? '',
              whatsapp: existing?.whatsapp ?? ad?.whatsapp ?? '',
              active,
              impressions:
                typeof existing?.impressions === 'number'
                  ? existing.impressions
                  : typeof ad?.impressions === 'number'
                  ? ad.impressions
                  : 0,
              clicks:
                typeof existing?.clicks === 'number'
                  ? existing.clicks
                  : typeof ad?.clicks === 'number'
                  ? ad.clicks
                  : 0,
              createdAt: existing?.createdAt || ad?.createdAt || new Date().toISOString(),
            }),
          }
        );
        rtdbSynced = writeResp.ok;
      }
    } catch {
      // Ignore RTDB write failure
    }
  }

  res.json({ ok: true, synced: rtdbSynced, id: adId, active });
});

app.delete('/api/ads/local/:district/:id', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const tokenCheck = verifyAdminBearerToken(bearerToken);
  if (!tokenCheck.valid) {
    res.status(401).json({ error: 'Chief Editor authorization required.' });
    return;
  }

  const districtParam = req.params.district.trim();
  const adId = req.params.id.trim();
  const rtdbBase = getFirebaseRtdbBase();
  let rtdbSynced = false;
  if (rtdbBase) {
    try {
      const delResp = await fetch(
        `${rtdbBase}/local_ads/${encodeURIComponent(districtParam)}/${encodeURIComponent(adId)}.json`,
        { method: 'DELETE' }
      );
      rtdbSynced = delResp.ok;
    } catch {
      // Ignore RTDB delete failure
    }
  }

  res.json({ ok: true, synced: rtdbSynced, id: adId });
});

app.post('/api/ads/local/:district/:id/track', async (req, res) => {
  const districtParam = req.params.district.trim();
  const adId = req.params.id.trim();
  const { eventType, ad } = req.body as {
    eventType?: 'impression' | 'click';
    ad?: Partial<LocalAdRtdbRecord>;
  };

  if (eventType !== 'impression' && eventType !== 'click') {
    res.status(400).json({ error: 'Invalid ad tracking event type.' });
    return;
  }

  const rtdbBase = getFirebaseRtdbBase();
  let rtdbSynced = false;
  if (rtdbBase) {
    try {
      const url = `${rtdbBase}/local_ads/${encodeURIComponent(districtParam)}/${encodeURIComponent(adId)}.json`;
      const existingResp = await fetch(url);
      const existing = existingResp.ok
        ? ((await existingResp.json()) as Partial<LocalAdRtdbRecord> | null)
        : null;
      const mergedBusiness = (existing?.businessName || ad?.businessName || '').trim();
      if (mergedBusiness) {
        const curImp =
          typeof existing?.impressions === 'number'
            ? existing.impressions
            : typeof ad?.impressions === 'number'
            ? ad.impressions
            : 0;
        const curClicks =
          typeof existing?.clicks === 'number'
            ? existing.clicks
            : typeof ad?.clicks === 'number'
            ? ad.clicks
            : 0;

        const writeResp = await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: adId,
            district: districtParam,
            format: existing?.format || ad?.format || 'banner',
            businessName: mergedBusiness,
            tagline: existing?.tagline ?? ad?.tagline ?? '',
            mediaUrl: existing?.mediaUrl ?? ad?.mediaUrl ?? '',
            mediaType: existing?.mediaType || ad?.mediaType || 'image',
            phone: existing?.phone ?? ad?.phone ?? '',
            whatsapp: existing?.whatsapp ?? ad?.whatsapp ?? '',
            active: existing?.active !== undefined ? existing.active : ad?.active !== false,
            impressions: eventType === 'impression' ? curImp + 1 : curImp,
            clicks: eventType === 'click' ? curClicks + 1 : curClicks,
            createdAt: existing?.createdAt || ad?.createdAt || new Date().toISOString(),
          }),
        });
        rtdbSynced = writeResp.ok;
      }
    } catch {
      // Ignore RTDB tracking error
    }
  }

  res.json({ ok: true, synced: rtdbSynced });
});

app.put('/api/ads/config', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const tokenCheck = verifyAdminBearerToken(bearerToken);
  if (!tokenCheck.valid) {
    res.status(401).json({ error: 'Chief Editor authorization required.' });
    return;
  }

  const body = req.body as Partial<AdNetworkConfigRtdbRecord>;
  const record: AdNetworkConfigRtdbRecord = {
    enabled: Boolean(body.enabled),
    adsensePublisherId:
      typeof body.adsensePublisherId === 'string' ? body.adsensePublisherId.trim() : '',
    adsenseBannerSlotId:
      typeof body.adsenseBannerSlotId === 'string' ? body.adsenseBannerSlotId.trim() : '',
    admobUnitId: typeof body.admobUnitId === 'string' ? body.admobUnitId.trim() : '',
    updatedAt: new Date().toISOString(),
  };

  const rtdbBase = getFirebaseRtdbBase();
  let rtdbSynced = false;
  if (rtdbBase) {
    try {
      const writeResp = await fetch(`${rtdbBase}/ad_network_config.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record),
      });
      rtdbSynced = writeResp.ok;
    } catch {
      // Ignore RTDB write failure
    }
  }

  res.json({ ok: true, synced: rtdbSynced, adNetworkConfig: record });
});

interface PayoutRequestRtdbRecord {
  id: string;
  reporterId: string;
  reporterName: string;
  district: string;
  upiId: string;
  amount: number;
  status: 'pending' | 'paid';
  requestedAt: string;
  paidAt?: string;
}

app.get('/api/payouts/sync', async (_req, res) => {
  const rtdbBase = getFirebaseRtdbBase();
  if (!rtdbBase) {
    res.json({ synced: false, defaultNewsRate: null, payoutRequests: [] });
    return;
  }

  try {
    const [rateResp, payoutsResp] = await Promise.all([
      fetch(`${rtdbBase}/app_settings/defaultNewsRate.json`),
      fetch(`${rtdbBase}/payout_requests.json`),
    ]);

    if (!rateResp.ok && !payoutsResp.ok) {
      res.json({ synced: false, defaultNewsRate: null, payoutRequests: [] });
      return;
    }

    const rateRaw = rateResp.ok ? ((await rateResp.json()) as unknown) : null;
    const defaultNewsRate =
      typeof rateRaw === 'number' && Number.isFinite(rateRaw) && rateRaw >= 0
        ? Math.round(rateRaw)
        : null;

    const payoutsRaw = payoutsResp.ok
      ? ((await payoutsResp.json()) as Record<string, Partial<PayoutRequestRtdbRecord>> | null)
      : null;

    const payoutRequests: PayoutRequestRtdbRecord[] = [];
    if (payoutsRaw && typeof payoutsRaw === 'object') {
      for (const [key, item] of Object.entries(payoutsRaw)) {
        if (
          item &&
          typeof item.reporterId === 'string' &&
          typeof item.upiId === 'string' &&
          typeof item.amount === 'number' &&
          Number.isFinite(item.amount) &&
          item.amount > 0
        ) {
          payoutRequests.push({
            id: item.id || key,
            reporterId: item.reporterId,
            reporterName:
              typeof item.reporterName === 'string' ? item.reporterName : item.reporterId,
            district: typeof item.district === 'string' ? item.district : 'Bihar',
            upiId: item.upiId,
            amount: Math.round(item.amount),
            status: item.status === 'paid' ? 'paid' : 'pending',
            requestedAt: item.requestedAt || new Date().toISOString(),
            ...(typeof item.paidAt === 'string' && item.paidAt ? { paidAt: item.paidAt } : {}),
          });
        }
      }
    }

    payoutRequests.sort(
      (a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
    );

    res.json({ synced: true, defaultNewsRate, payoutRequests });
  } catch {
    res.json({ synced: false, defaultNewsRate: null, payoutRequests: [] });
  }
});

app.put('/api/settings/default-news-rate', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const tokenCheck = verifyAdminBearerToken(bearerToken);
  if (!tokenCheck.valid) {
    res.status(401).json({ error: 'Chief Editor authorization required.' });
    return;
  }

  const rawRate = (req.body as { defaultNewsRate?: unknown })?.defaultNewsRate;
  const parsedRate = Number(rawRate);
  if (!Number.isFinite(parsedRate) || parsedRate < 0 || parsedRate > 50000) {
    res.status(400).json({ error: 'Default per-news rate must be between ₹0 and ₹50,000.' });
    return;
  }
  const cleanRate = Math.round(parsedRate);

  const rtdbBase = getFirebaseRtdbBase();
  let rtdbSynced = false;
  if (rtdbBase) {
    try {
      const writeResp = await fetch(`${rtdbBase}/app_settings/defaultNewsRate.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanRate),
      });
      rtdbSynced = writeResp.ok;
    } catch {
      // Ignore RTDB write failure
    }
  }

  res.json({ ok: true, synced: rtdbSynced, defaultNewsRate: cleanRate });
});

app.patch('/api/reporters/:id/rate', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const tokenCheck = verifyAdminBearerToken(bearerToken);
  if (!tokenCheck.valid) {
    res.status(401).json({ error: 'Chief Editor authorization required.' });
    return;
  }

  const { perNewsRate, reporter } = req.body as {
    perNewsRate?: number | null;
    reporter?: Partial<PublicReporterPayload>;
  };

  let cleanRate: number | null = null;
  if (perNewsRate !== null && perNewsRate !== undefined) {
    const parsed = Number(perNewsRate);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 50000) {
      res.status(400).json({ error: 'Custom per-news rate must be between ₹0 and ₹50,000.' });
      return;
    }
    cleanRate = Math.round(parsed);
  }

  const reporterId = req.params.id;
  const rtdbBase = getFirebaseRtdbBase();
  let rtdbSynced = false;
  if (rtdbBase) {
    try {
      const existingResp = await fetch(
        `${rtdbBase}/reporters/${encodeURIComponent(reporterId)}.json`
      );
      const existing = existingResp.ok
        ? ((await existingResp.json()) as Partial<PublicReporterPayload> | null)
        : null;

      const mergedName = (existing?.name || reporter?.name || '').trim();
      const mergedName3 = (
        existing?.name3 ||
        reporter?.name3 ||
        mergedName.replace(/[^a-zA-Z]/g, '').slice(0, 3)
      )
        .trim()
        .toUpperCase();
      const mergedBirthYear = String(existing?.birthYear || reporter?.birthYear || '').trim();
      const mergedDistrict = String(existing?.district || reporter?.district || '').trim();
      const mergedDist3 = (
        existing?.district3 ||
        reporter?.district3 ||
        mergedDistrict.replace(/[^a-zA-Z]/g, '').slice(0, 3)
      )
        .trim()
        .toUpperCase();

      if (
        mergedName &&
        mergedName3.length === 3 &&
        mergedBirthYear.length === 4 &&
        mergedDistrict
      ) {
        const payload: PublicReporterPayload = {
          id: reporterId,
          name: mergedName,
          name3: mergedName3,
          birthYear: mergedBirthYear,
          district3: mergedDist3,
          district: mergedDistrict,
          status: existing?.status || reporter?.status || 'active',
          createdAt: existing?.createdAt || reporter?.createdAt || new Date().toISOString(),
          approvedCount:
            typeof existing?.approvedCount === 'number'
              ? existing.approvedCount
              : typeof reporter?.approvedCount === 'number'
              ? reporter.approvedCount
              : 0,
          ...(cleanRate !== null ? { perNewsRate: cleanRate } : {}),
        };

        const writeResp = await fetch(
          `${rtdbBase}/reporters/${encodeURIComponent(reporterId)}.json`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }
        );
        rtdbSynced = writeResp.ok;
      }
    } catch {
      // Ignore RTDB write failure
    }
  }

  res.json({ ok: true, synced: rtdbSynced, id: reporterId, perNewsRate: cleanRate });
});

app.post('/api/payouts/request', async (req, res) => {
  const body = req.body as Partial<PayoutRequestRtdbRecord>;
  const reporterId = typeof body.reporterId === 'string' ? body.reporterId.trim() : '';
  const reporterName = typeof body.reporterName === 'string' ? body.reporterName.trim() : '';
  const district = typeof body.district === 'string' ? body.district.trim() : 'Bihar';
  const upiId = typeof body.upiId === 'string' ? body.upiId.trim() : '';
  const amount = Number(body.amount);

  if (!reporterId || !reporterName) {
    res.status(400).json({ error: 'Reporter account identity is required.' });
    return;
  }
  if (!/^[a-zA-Z0-9._-]{2,}@[a-zA-Z0-9]{2,}$/.test(upiId)) {
    res.status(400).json({ error: 'Enter a valid UPI ID (e.g. rahul@upi or 98350xxxxx@ybl).' });
    return;
  }
  if (!Number.isFinite(amount) || amount < 1 || amount > 500000) {
    res.status(400).json({ error: 'Withdrawal amount must be at least ₹1.' });
    return;
  }

  const payoutId =
    typeof body.id === 'string' && /^[a-zA-Z0-9_-]{4,80}$/.test(body.id)
      ? body.id
      : `pay-${Date.now()}`;

  const record: PayoutRequestRtdbRecord = {
    id: payoutId,
    reporterId,
    reporterName,
    district,
    upiId,
    amount: Math.round(amount),
    status: 'pending',
    requestedAt: new Date().toISOString(),
  };

  const rtdbBase = getFirebaseRtdbBase();
  let rtdbSynced = false;
  if (rtdbBase) {
    try {
      const writeResp = await fetch(
        `${rtdbBase}/payout_requests/${encodeURIComponent(payoutId)}.json`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(record),
        }
      );
      rtdbSynced = writeResp.ok;
    } catch {
      // Ignore RTDB write failure
    }
  }

  res.status(201).json({ ok: true, synced: rtdbSynced, payout: record });
});

app.patch('/api/payouts/:id/mark-paid', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const tokenCheck = verifyAdminBearerToken(bearerToken);
  if (!tokenCheck.valid) {
    res.status(401).json({ error: 'Chief Editor authorization required.' });
    return;
  }

  const payoutId = req.params.id.trim();
  const fallback = (req.body as { payout?: Partial<PayoutRequestRtdbRecord> })?.payout;
  const paidAt = new Date().toISOString();

  const rtdbBase = getFirebaseRtdbBase();
  let rtdbSynced = false;
  let updatedRecord: PayoutRequestRtdbRecord | null = null;

  if (rtdbBase) {
    try {
      const url = `${rtdbBase}/payout_requests/${encodeURIComponent(payoutId)}.json`;
      const existingResp = await fetch(url);
      const existing = existingResp.ok
        ? ((await existingResp.json()) as Partial<PayoutRequestRtdbRecord> | null)
        : null;

      const reporterId = existing?.reporterId || fallback?.reporterId || '';
      const upiId = existing?.upiId || fallback?.upiId || '';
      const amount =
        typeof existing?.amount === 'number'
          ? existing.amount
          : typeof fallback?.amount === 'number'
          ? fallback.amount
          : 0;

      if (reporterId && upiId && amount > 0) {
        updatedRecord = {
          id: payoutId,
          reporterId,
          reporterName: existing?.reporterName || fallback?.reporterName || reporterId,
          district: existing?.district || fallback?.district || 'Bihar',
          upiId,
          amount: Math.round(amount),
          status: 'paid',
          requestedAt: existing?.requestedAt || fallback?.requestedAt || paidAt,
          paidAt,
        };

        const writeResp = await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedRecord),
        });
        rtdbSynced = writeResp.ok;
      }
    } catch {
      // Ignore RTDB write failure
    }
  }

  res.json({
    ok: true,
    synced: rtdbSynced,
    id: payoutId,
    paidAt,
    payout: updatedRecord,
  });
});

// Lightweight in-memory LRU cache for synthesized TTS clips
const ttsCache = new Map<string, string>();
const MAX_CACHE_ENTRIES = 120;
let geminiQuotaCooldownUntil = 0;
let geminiQuotaCooldownStatus: 429 | 403 = 429;

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    apiVersion: 'v1beta',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

app.post('/api/tts', async (req, res) => {
  const { text, language = 'hi', voiceName = 'Kore' } = req.body as {
    text?: string;
    language?: string;
    voiceName?: string;
  };

  const cleanText = typeof text === 'string' ? text.trim() : '';
  if (!cleanText || cleanText.length > 4000) {
    res.status(400).json({ error: 'Invalid or oversized text payload.' });
    return;
  }

  const safeVoice = ALLOWED_VOICES.has(voiceName) ? voiceName : 'Kore';
  const cacheKey = `${language}::${safeVoice}::${cleanText}`;
  const cached = ttsCache.get(cacheKey);
  if (cached) {
    res.json({ audioBase64: cached, mimeType: 'audio/wav', cached: true });
    return;
  }

  if (Date.now() < geminiQuotaCooldownUntil) {
    res.status(geminiQuotaCooldownStatus).json({
      quotaExhausted: true,
      error: 'Free AI Voice Limit Reached Today — Reading Mode Active',
    });
    return;
  }

  const ai = getGeminiClient();
  if (!ai) {
    res.status(503).json({
      error: 'GEMINI_API_KEY is not configured in Settings > Secrets.',
    });
    return;
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Read this local Indian TV news bulletin in an authoritative, fluent, natural broadcast news anchor tone:\n\n${cleanText}`,
              speechMetadata: {
                style:
                  'Authoritative, fluent, natural Indian television broadcast news anchor',
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: safeVoice },
          },
        },
      },
    });

    const inlineAudio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    const base64Audio = inlineAudio?.data;
    const mimeType = inlineAudio?.mimeType || 'audio/wav';

    if (!base64Audio) {
      res.status(502).json({
        error: 'Gemini TTS model returned no audio data.',
      });
      return;
    }

    if (ttsCache.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = ttsCache.keys().next().value;
      if (oldestKey) ttsCache.delete(oldestKey);
    }
    ttsCache.set(cacheKey, base64Audio);

    res.json({ audioBase64: base64Audio, mimeType });
  } catch (err) {
    const rawMessage = err instanceof Error ? err.message : 'Gemini TTS generation failed';
    const errObj = err as { status?: number; code?: number } | null;
    const statusCode = Number(errObj?.status ?? errObj?.code ?? 0);
    const lowerMsg = rawMessage.toLowerCase();

    const isForbiddenOrQuota403 =
      statusCode === 403 ||
      rawMessage.includes('403') ||
      rawMessage.includes('PERMISSION_DENIED') ||
      lowerMsg.includes('permission_denied') ||
      lowerMsg.includes('billing');
    const isQuota429 =
      statusCode === 429 ||
      rawMessage.includes('429') ||
      rawMessage.includes('RESOURCE_EXHAUSTED') ||
      lowerMsg.includes('quota') ||
      lowerMsg.includes('rate limit');

    if (isQuota429 || isForbiddenOrQuota403) {
      geminiQuotaCooldownStatus = isForbiddenOrQuota403 && !isQuota429 ? 403 : 429;
      geminiQuotaCooldownUntil = Date.now() + 5 * 60 * 1000;
      console.warn(
        `Gemini TTS limit reached (HTTP ${geminiQuotaCooldownStatus}); cooling down for 5 minutes.`
      );
      res.status(geminiQuotaCooldownStatus).json({
        quotaExhausted: true,
        error: 'Free AI Voice Limit Reached Today — Reading Mode Active',
      });
      return;
    }

    console.warn('Gemini TTS warning:', rawMessage);
    res.status(500).json({ error: rawMessage });
  }
});

// ============================================================================
// ADMIN CLOUD AUDIO CONFIG & ONE-SHOT GEMINI AUDIO HOSTING (CLOUDINARY / DISK)
// ============================================================================
const CLOUD_CONFIG_FILE = path.join(ADMIN_AUTH_DIR, 'cloud_config.json');
const HOSTED_AUDIO_DIR = path.resolve(ADMIN_AUTH_DIR, 'audio');

interface StoredCloudAudioConfig {
  cloudName: string;
  uploadPreset: string;
  updatedAt?: string;
}

function isValidCloudSlug(raw: unknown, maxLen: number): raw is string {
  return typeof raw === 'string' && /^[a-zA-Z0-9_-]{2,}$/.test(raw.trim()) && raw.trim().length <= maxLen;
}

function readStoredCloudConfig(): StoredCloudAudioConfig {
  try {
    if (!fs.existsSync(CLOUD_CONFIG_FILE)) {
      return { cloudName: '', uploadPreset: '' };
    }
    const raw = fs.readFileSync(CLOUD_CONFIG_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<StoredCloudAudioConfig>;
    return {
      cloudName: isValidCloudSlug(parsed.cloudName, 64) ? parsed.cloudName.trim() : '',
      uploadPreset: isValidCloudSlug(parsed.uploadPreset, 80) ? parsed.uploadPreset.trim() : '',
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : undefined,
    };
  } catch {
    return { cloudName: '', uploadPreset: '' };
  }
}

function writeStoredCloudConfig(config: StoredCloudAudioConfig): void {
  fs.mkdirSync(ADMIN_AUTH_DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(CLOUD_CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
}

function ensureStandardWavBuffer(base64Audio: string, mimeType = 'audio/wav'): Buffer {
  const bytes = Buffer.from(base64Audio, 'base64');
  const isRiffWav =
    bytes.length >= 4 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46;

  if (isRiffWav) {
    return bytes;
  }

  const lowerMime = mimeType.toLowerCase();
  const rateMatch = lowerMime.match(/rate=(\d+)/);
  const sampleRate = rateMatch ? Number(rateMatch[1]) || 24000 : 24000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = bytes.length;

  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, bytes]);
}

async function uploadWavToCloudinary(
  wavBuffer: Buffer,
  newsId: string,
  cloudName: string,
  uploadPreset: string
): Promise<string | null> {
  if (!isValidCloudSlug(cloudName, 64) || !isValidCloudSlug(uploadPreset, 80)) {
    return null;
  }
  const safeCloudName = cloudName.trim();
  const safePreset = uploadPreset.trim();
  const safePublicId = newsId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) || `reel-${Date.now()}`;

  try {
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(wavBuffer)], { type: 'audio/wav' }), `${safePublicId}.wav`);
    form.append('upload_preset', safePreset);
    form.append('folder', 'desh-reel-audio');
    form.append('public_id', safePublicId);

    const uploadUrl = `https://api.cloudinary.com/v1_1/${encodeURIComponent(safeCloudName)}/video/upload`;
    const resp = await fetch(uploadUrl, {
      method: 'POST',
      body: form,
    });
    if (!resp.ok) {
      return null;
    }
    const payload = (await resp.json()) as { secure_url?: string };
    if (typeof payload.secure_url === 'string' && payload.secure_url.startsWith('https://')) {
      return payload.secure_url;
    }
    return null;
  } catch {
    return null;
  }
}

app.get('/api/admin/cloud-config', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const tokenCheck = verifyAdminBearerToken(bearerToken);
  if (!tokenCheck.valid) {
    res.status(401).json({ error: 'Chief Editor authorization required.' });
    return;
  }

  let cfg = readStoredCloudConfig();
  const rtdbBase = getFirebaseRtdbBase();
  if (!cfg.cloudName && !cfg.uploadPreset && rtdbBase) {
    try {
      const rtdbResp = await fetch(`${rtdbBase}/app_settings/cloudAudioConfig.json`);
      if (rtdbResp.ok) {
        const remote = (await rtdbResp.json()) as Partial<StoredCloudAudioConfig> | null;
        if (remote && isValidCloudSlug(remote.cloudName, 64) && isValidCloudSlug(remote.uploadPreset, 80)) {
          cfg = {
            cloudName: remote.cloudName.trim(),
            uploadPreset: remote.uploadPreset.trim(),
            updatedAt: remote.updatedAt,
          };
          writeStoredCloudConfig(cfg);
        }
      }
    } catch {
      // Ignore RTDB read fallback
    }
  }

  res.json({
    cloudName: cfg.cloudName,
    uploadPreset: cfg.uploadPreset,
    geminiServerConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
    updatedAt: cfg.updatedAt,
  });
});

app.put('/api/admin/cloud-config', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const tokenCheck = verifyAdminBearerToken(bearerToken);
  if (!tokenCheck.valid) {
    res.status(401).json({ error: 'Chief Editor authorization required.' });
    return;
  }

  const body = req.body as Partial<StoredCloudAudioConfig>;
  const rawCloudName = typeof body.cloudName === 'string' ? body.cloudName.trim() : '';
  const rawPreset = typeof body.uploadPreset === 'string' ? body.uploadPreset.trim() : '';

  if (rawCloudName && !isValidCloudSlug(rawCloudName, 64)) {
    res.status(400).json({ error: 'Invalid Cloudinary Cloud Name format.' });
    return;
  }
  if (rawPreset && !isValidCloudSlug(rawPreset, 80)) {
    res.status(400).json({ error: 'Invalid Cloudinary Upload Preset format.' });
    return;
  }

  const nextConfig: StoredCloudAudioConfig = {
    cloudName: rawCloudName,
    uploadPreset: rawPreset,
    updatedAt: new Date().toISOString(),
  };

  writeStoredCloudConfig(nextConfig);

  const rtdbBase = getFirebaseRtdbBase();
  let rtdbSynced = false;
  if (rtdbBase) {
    try {
      const writeResp = await fetch(`${rtdbBase}/app_settings/cloudAudioConfig.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextConfig),
      });
      rtdbSynced = writeResp.ok;
    } catch {
      // Ignore RTDB sync error
    }
  }

  res.json({
    ok: true,
    synced: rtdbSynced,
    cloudName: nextConfig.cloudName,
    uploadPreset: nextConfig.uploadPreset,
    geminiServerConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
    updatedAt: nextConfig.updatedAt,
  });
});

app.post('/api/admin/generate-and-host-audio', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const tokenCheck = verifyAdminBearerToken(bearerToken);
  if (!tokenCheck.valid) {
    res.status(401).json({ error: 'Chief Editor authorization required.' });
    return;
  }

  const { newsId, district, text, language = 'hi', voiceName = 'Kore' } = req.body as {
    newsId?: string;
    district?: string;
    text?: string;
    language?: string;
    voiceName?: string;
  };

  const cleanNewsId =
    typeof newsId === 'string' && /^[a-zA-Z0-9_-]{3,100}$/.test(newsId.trim())
      ? newsId.trim()
      : '';
  const cleanText = typeof text === 'string' ? text.trim() : '';
  const safeVoice = ALLOWED_VOICES.has(voiceName) ? voiceName : 'Kore';

  if (!cleanNewsId || !cleanText || cleanText.length > 4000) {
    res.status(400).json({ error: 'Valid newsId and news script text are required.' });
    return;
  }

  const cacheKey = `${language}::${safeVoice}::${cleanText}`;
  let base64Audio = ttsCache.get(cacheKey);
  let mimeType = 'audio/wav';

  if (!base64Audio) {
    if (Date.now() < geminiQuotaCooldownUntil) {
      res.status(geminiQuotaCooldownStatus).json({
        quotaExhausted: true,
        error: 'Gemini TTS quota cooldown active.',
      });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Server GEMINI_API_KEY is not configured in Secrets.',
      });
      return;
    }

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `Read this local Indian TV news bulletin in an authoritative, fluent, natural broadcast news anchor tone:\n\n${cleanText}`,
                speechMetadata: {
                  style: 'Authoritative, fluent, natural Indian television broadcast news anchor',
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: safeVoice },
            },
          },
        },
      });

      const inlineAudio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      if (!inlineAudio?.data) {
        res.status(502).json({ error: 'Gemini TTS returned no audio data.' });
        return;
      }
      base64Audio = inlineAudio.data;
      mimeType = inlineAudio.mimeType || 'audio/wav';

      if (ttsCache.size >= MAX_CACHE_ENTRIES) {
        const oldestKey = ttsCache.keys().next().value;
        if (oldestKey) ttsCache.delete(oldestKey);
      }
      ttsCache.set(cacheKey, base64Audio);
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : 'Gemini TTS generation failed';
      const errObj = err as { status?: number; code?: number } | null;
      const statusCode = Number(errObj?.status ?? errObj?.code ?? 0);
      const lowerMsg = rawMessage.toLowerCase();
      const is403 = statusCode === 403 || rawMessage.includes('403') || rawMessage.includes('PERMISSION_DENIED');
      const is429 = statusCode === 429 || rawMessage.includes('429') || rawMessage.includes('RESOURCE_EXHAUSTED') || lowerMsg.includes('quota');

      if (is429 || is403) {
        geminiQuotaCooldownStatus = is403 && !is429 ? 403 : 429;
        geminiQuotaCooldownUntil = Date.now() + 5 * 60 * 1000;
        res.status(geminiQuotaCooldownStatus).json({
          quotaExhausted: true,
          error: 'Gemini TTS quota limit reached.',
        });
        return;
      }
      res.status(500).json({ error: rawMessage });
      return;
    }
  }

  const wavBuffer = ensureStandardWavBuffer(base64Audio, mimeType);
  const cloudCfg = readStoredCloudConfig();
  let finalAudioUrl: string | null = null;
  let storageMode: 'cloudinary' | 'server' = 'server';

  if (cloudCfg.cloudName && cloudCfg.uploadPreset) {
    finalAudioUrl = await uploadWavToCloudinary(
      wavBuffer,
      cleanNewsId,
      cloudCfg.cloudName,
      cloudCfg.uploadPreset
    );
    if (finalAudioUrl) {
      storageMode = 'cloudinary';
    }
  }

  if (!finalAudioUrl) {
    fs.mkdirSync(HOSTED_AUDIO_DIR, { recursive: true });
    const fileName = `${cleanNewsId}.wav`;
    const resolvedTarget = path.resolve(HOSTED_AUDIO_DIR, fileName);
    if (resolvedTarget.startsWith(HOSTED_AUDIO_DIR + path.sep)) {
      fs.writeFileSync(resolvedTarget, wavBuffer);
      finalAudioUrl = `/api/hosted-audio/${encodeURIComponent(fileName)}`;
      storageMode = 'server';
    }
  }

  if (!finalAudioUrl) {
    res.status(500).json({ error: 'Unable to host generated audio clip.' });
    return;
  }

  const rtdbBase = getFirebaseRtdbBase();
  const cleanDistrict = typeof district === 'string' ? district.trim() : '';
  if (rtdbBase && cleanDistrict) {
    try {
      await fetch(
        `${rtdbBase}/live_news/${encodeURIComponent(cleanDistrict)}/${encodeURIComponent(cleanNewsId)}.json`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audioUrl: finalAudioUrl }),
        }
      );
    } catch {
      // Best-effort RTDB audioUrl patch
    }
  }

  res.json({
    ok: true,
    audioUrl: finalAudioUrl,
    storage: storageMode,
    audioBase64: wavBuffer.toString('base64'),
    mimeType: 'audio/wav',
  });
});

app.get('/api/hosted-audio/:filename', (req, res) => {
  const filename = String(req.params.filename || '').trim();
  if (!/^[a-zA-Z0-9_-]{3,100}\.wav$/.test(filename)) {
    res.status(400).send('Invalid audio filename.');
    return;
  }

  const resolvedPath = path.resolve(HOSTED_AUDIO_DIR, filename);
  if (!resolvedPath.startsWith(HOSTED_AUDIO_DIR + path.sep)) {
    res.status(403).send('Forbidden.');
    return;
  }

  if (!fs.existsSync(resolvedPath)) {
    res.status(404).send('Audio clip not found.');
    return;
  }

  res.setHeader('Content-Type', 'audio/wav');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.sendFile(resolvedPath);
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  // Cache local MP4 B-roll reels aggressively across clip loops and swipes
  app.use(
    '/videos',
    express.static(path.resolve(__dirname, 'public/videos'), {
      maxAge: '1d',
      acceptRanges: true,
    })
  );

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(
      express.static(distPath, {
        maxAge: '7d',
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache');
          }
        },
      })
    );
    app.get('*', (_req, res) => {
      const indexFile = path.join(distPath, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Khabar Nama server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
