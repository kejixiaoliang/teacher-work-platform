const crypto = require('node:crypto');

const CODE_RE = /^[A-Z0-9-]{8,64}$/;
const PLAN_TYPES = new Set(['permanent', 'annual', 'version']);
function hashCode(value) { return crypto.createHash('sha256').update(String(value || '').trim().toUpperCase()).digest('hex'); }
function normalizeCode(value) { const code = String(value || '').trim().toUpperCase(); return CODE_RE.test(code) ? code : ''; }
function validUntil(planType, expiresAt, version) {
  if (!PLAN_TYPES.has(planType)) return { ok: false, code: 'PLAN_INVALID', errors: ['授权类型无效'] };
  if (planType === 'version' && (!version || typeof version !== 'string')) return { ok: false, code: 'VERSION_REQUIRED', errors: ['版本授权缺少版本号'] };
  if (planType !== 'permanent' && (!expiresAt || !Number.isFinite(Date.parse(expiresAt)))) return { ok: false, code: 'EXPIRY_REQUIRED', errors: ['授权有效期无效'] };
  return { ok: true };
}
function grantState(grant = {}, now = Date.now()) {
  if (grant.revokedAt) return { state: 'revoked', stateLabel: '已撤销', active: false };
  if (grant.expiresAt && (!Number.isFinite(Date.parse(grant.expiresAt)) || Date.parse(grant.expiresAt) <= now)) return { state: 'expired', stateLabel: '已过期', active: false };
  return { state: 'active', stateLabel: '有效', active: true };
}
function presentGrant(grant, now = Date.now()) { return { ...grant, ...grantState(grant, now) }; }

async function main(event = {}) {
  const cloudModule = await import('wx-server-sdk');
  const cloud = cloudModule.default || cloudModule;
  cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
  const context = cloud.getWXContext();
  if (!context?.OPENID) return { ok: false, code: 'AUTH_REQUIRED', errors: ['未获取到微信用户身份'] };
  const db = cloud.database();
  if (event.action === 'redeem') {
    const code = normalizeCode(event.code);
    if (!code) return { ok: false, code: 'CODE_INVALID', errors: ['兑换码格式无效'] };
    const found = await db.collection('license_codes').where({ codeHash: hashCode(code), revokedAt: null }).limit(1).get();
    if (!found.data.length) return { ok: false, code: 'CODE_NOT_FOUND', errors: ['兑换码不存在或已撤销'] };
    const license = found.data[0];
    if (license.expiresAt && Date.parse(license.expiresAt) <= Date.now()) return { ok: false, code: 'CODE_EXPIRED', errors: ['兑换码已过期'] };
    const used = await db.collection('license_grants').where({ codeUuid: license.uuid }).limit(1).get();
    if (used.data.length) return { ok: false, code: 'CODE_USED', errors: ['兑换码已经兑换'] };
    const now = new Date().toISOString();
    const result = await db.collection('license_grants').add({ data: { uuid: crypto.randomUUID(), codeUuid: license.uuid, ownerId: context.OPENID, planType: license.planType, version: license.version || '', expiresAt: license.expiresAt || null, createdAt: now, updatedAt: now, revokedAt: null } });
    return { ok: true, grantId: result._id, planType: license.planType, version: license.version || '', expiresAt: license.expiresAt || null };
  }
  if (event.action === 'status') {
    const result = await db.collection('license_grants').where({ ownerId: context.OPENID }).orderBy('createdAt', 'desc').limit(50).get();
    const history = result.data.map((item) => presentGrant(item));
    const grants = history.filter((item) => item.active);
    return { ok: true, grants, history, summary: { active: grants.length, expired: history.filter((item) => item.state === 'expired').length, revoked: history.filter((item) => item.state === 'revoked').length } };
  }
  return { ok: false, code: 'ACTION_NOT_ALLOWED', errors: ['不支持该授权操作'] };
}

module.exports = { CODE_RE, PLAN_TYPES, hashCode, normalizeCode, validUntil, grantState, presentGrant, main };
