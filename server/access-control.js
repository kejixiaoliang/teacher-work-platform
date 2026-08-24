import crypto from 'node:crypto';

export const ACCESS_MODES = Object.freeze({
  TEACHER: 'teacher',
  CLASSROOM: 'classroom',
});

export const DEFAULT_MODULE_POLICIES = Object.freeze({
  overview: 'open',
  seats: 'open',
  attendance: 'open',
  assessment: 'open',
  duties: 'open',
  leaders: 'open',
  'subject-leaders': 'open',
  guide: 'open',
  changelog: 'open',
  analytics: 'protected',
  scores: 'protected',
  students: 'protected',
  documents: 'protected',
  leaves: 'protected',
  contacts: 'protected',
  classes: 'protected',
  backup: 'protected',
});

const PASSWORD_KEYLEN = 64;
const SCRYPT_OPTIONS = { N: 16_384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 };
const MODULE_GRANT_MS = 10 * 60 * 1000;
export const AUTO_LOCK_MS = 30 * 60 * 1000;

function hashRecoveryKey(recoveryKey) {
  return crypto.createHash('sha256').update(recoveryKey, 'utf8').digest('hex');
}

function issueRecoveryKey() {
  const recoveryKey = crypto.randomBytes(16).toString('hex');
  return { recoveryKey, recoveryKeyHash: hashRecoveryKey(recoveryKey) };
}

export function createPasswordRecord(password) {
  if (typeof password !== 'string' || password.length < 6 || password.length > 64) {
    throw new Error('密码长度必须为 6 至 64 位');
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, PASSWORD_KEYLEN, SCRYPT_OPTIONS).toString('hex');
  return { algorithm: 'scrypt', salt, hash };
}

export function verifyPassword(password, record) {
  if (!record || record.algorithm !== 'scrypt' || typeof password !== 'string') return false;
  try {
    const expected = Buffer.from(record.hash, 'hex');
    const actual = crypto.scryptSync(password, record.salt, PASSWORD_KEYLEN, SCRYPT_OPTIONS);
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function createAccessController({ now = () => Date.now(), config = {}, onConfigChange = () => {} } = {}) {
  let passwordRecord = config.passwordRecord || null;
  let mode = config.mode === ACCESS_MODES.CLASSROOM ? ACCESS_MODES.CLASSROOM : ACCESS_MODES.TEACHER;
  let recoveryKeyHash = config.recoveryKeyHash || null;
  let recoveryKeyUsedAt = config.recoveryKeyUsedAt || null;
  let policies = { ...DEFAULT_MODULE_POLICIES, ...(config.policies || {}) };
  const moduleGrants = new Map();
  let lastActivityAt = now();

  function clearGrants() {
    moduleGrants.clear();
  }

  function configured() {
    return Boolean(passwordRecord);
  }

  function enforceAutoLock() {
    if (mode === ACCESS_MODES.TEACHER && now() - lastActivityAt > AUTO_LOCK_MS) {
      mode = ACCESS_MODES.CLASSROOM;
      clearGrants();
    }
  }

  return {
    configurePassword(password) {
      passwordRecord = createPasswordRecord(password);
      const recovery = issueRecoveryKey();
      recoveryKeyHash = recovery.recoveryKeyHash;
      recoveryKeyUsedAt = null;
      onConfigChange({ passwordRecord, policies, mode, recoveryKeyHash, recoveryKeyUsedAt });
      return { configured: true, recoveryKey: recovery.recoveryKey };
    },
    changePassword(oldPassword, newPassword) {
      if (!verifyPassword(oldPassword, passwordRecord)) return false;
      passwordRecord = createPasswordRecord(newPassword);
      clearGrants();
      mode = ACCESS_MODES.CLASSROOM;
      lastActivityAt = now();
      const recovery = issueRecoveryKey();
      recoveryKeyHash = recovery.recoveryKeyHash;
      recoveryKeyUsedAt = null;
      onConfigChange({ passwordRecord, policies, mode, recoveryKeyHash, recoveryKeyUsedAt });
      return true;
    },
    resetPassword(recoveryKey, newPassword) {
      if (!recoveryKeyHash || recoveryKeyUsedAt || hashRecoveryKey(recoveryKey || '') !== recoveryKeyHash) return false;
      passwordRecord = createPasswordRecord(newPassword);
      const recovery = issueRecoveryKey();
      recoveryKeyHash = recovery.recoveryKeyHash;
      recoveryKeyUsedAt = null;
      mode = ACCESS_MODES.CLASSROOM;
      clearGrants();
      lastActivityAt = now();
      onConfigChange({ passwordRecord, policies, mode, recoveryKeyHash, recoveryKeyUsedAt });
      return recovery;
    },
    verify(password) {
      return verifyPassword(password, passwordRecord);
    },
    hasPassword() {
      return configured();
    },
    getPasswordRecord() {
      return passwordRecord ? { ...passwordRecord } : null;
    },
    getMode() {
      enforceAutoLock();
      return mode;
    },
    setMode(nextMode) {
      if (!Object.values(ACCESS_MODES).includes(nextMode)) throw new Error('不支持的工作模式');
      mode = nextMode;
      clearGrants();
      lastActivityAt = now();
      onConfigChange({ passwordRecord, policies, mode, recoveryKeyHash, recoveryKeyUsedAt });
      return mode;
    },
    lock() {
      mode = ACCESS_MODES.CLASSROOM;
      clearGrants();
      lastActivityAt = now();
    },
    getPolicies() {
      return { ...policies };
    },
    getSessionState() {
      enforceAutoLock();
      return { teacherSession: mode === ACCESS_MODES.TEACHER };
    },
    setPolicies(nextPolicies) {
      policies = { ...policies, ...nextPolicies };
      onConfigChange({ passwordRecord, policies });
      return { ...policies };
    },
    touchActivity() {
      enforceAutoLock();
      if (mode === ACCESS_MODES.TEACHER) lastActivityAt = now();
    },
    grantModule(module) {
      if (!policies[module]) throw new Error('不支持的模块');
      moduleGrants.set(module, now() + MODULE_GRANT_MS);
    },
    getUnlockedModules() {
      const current = now();
      for (const [module, expiresAt] of moduleGrants) {
        if (expiresAt <= current) moduleGrants.delete(module);
      }
      return [...moduleGrants.keys()];
    },
    isAllowed(module) {
      enforceAutoLock();
      if (mode === ACCESS_MODES.TEACHER) return true;
      if (policies[module] === 'open') return true;
      const expiresAt = moduleGrants.get(module);
      if (!expiresAt || expiresAt <= now()) {
        moduleGrants.delete(module);
        return false;
      }
      return true;
    },
    status() {
      enforceAutoLock();
      return {
        configured: configured(),
        mode,
        teacherSession: mode === ACCESS_MODES.TEACHER,
        policies: { ...policies },
        unlockedModules: this.getUnlockedModules(),
      };
    },
  };
}
