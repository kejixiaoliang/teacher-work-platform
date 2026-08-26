const crypto = require('node:crypto');

function isAdmin(context, env = process.env) { return Boolean(context?.OPENID && env.ADMIN_OPENID && context.OPENID === env.ADMIN_OPENID); }
function hashCode(value) { return crypto.createHash('sha256').update(String(value || '').trim().toUpperCase()).digest('hex'); }

async function main(event = {}) {
  const cloudModule = await import('wx-server-sdk');
  const cloud = cloudModule.default || cloudModule;
  cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
  const context = cloud.getWXContext();
  if (!isAdmin(context)) return { ok: false, code: 'ADMIN_REQUIRED', errors: ['当前微信身份不是管理员'] };
  const db = cloud.database();
  if (event.action === 'createCode') {
    const code = String(event.code || '').trim().toUpperCase();
    const planType = event.planType;
    if (!code || !['permanent', 'annual', 'version'].includes(planType)) return { ok: false, code: 'INPUT_INVALID', errors: ['兑换码或授权类型无效'] };
    const now = new Date().toISOString();
    const result = await db.collection('license_codes').add({ data: { uuid: crypto.randomUUID(), codeHash: hashCode(code), planType, version: String(event.version || ''), expiresAt: event.expiresAt || null, createdAt: now, revokedAt: null, createdBy: context.OPENID } });
    return { ok: true, codeId: result._id };
  }
  if (event.action === 'revokeCode') {
    const codeUuid = String(event.codeUuid || '').trim();
    if (!codeUuid) return { ok: false, code: 'INPUT_INVALID', errors: ['兑换码 ID 无效'] };
    await db.collection('license_codes').where({ uuid: codeUuid, revokedAt: null }).update({ data: { revokedAt: new Date().toISOString() } });
    return { ok: true };
  }
  if (event.action === 'listGrants') {
    const result = await db.collection('license_grants').orderBy('createdAt', 'desc').limit(100).get();
    return { ok: true, grants: result.data };
  }
  return { ok: false, code: 'ACTION_NOT_ALLOWED', errors: ['不支持该管理员操作'] };
}

module.exports = { isAdmin, hashCode, main };
