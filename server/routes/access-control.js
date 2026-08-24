import { Router } from 'express';
import crypto from 'node:crypto';

export function createAccessRouter({ controller, sessions }) {
  const router = Router();

  function issueSession(res) {
    const token = crypto.randomBytes(24).toString('hex');
    sessions.add(token);
    res.setHeader('Set-Cookie', `teacher_work_access=${token}; HttpOnly; SameSite=Strict; Max-Age=1800; Path=/`);
  }

  function status(res, extra = {}) {
    res.json({ ok: true, data: { ...controller.status(), ...extra } });
  }

  router.get('/status', (_req, res) => status(res));

  router.post('/password', (req, res) => {
    if (controller.hasPassword()) {
      return res.status(409).json({ ok: false, code: 'PASSWORD_ALREADY_SET', error: '教师密码已经设置，请使用修改密码功能' });
    }
    try {
      const result = controller.configurePassword(req.body?.password);
      issueSession(res);
      status(res, { recoveryKey: result.recoveryKey });
    } catch (error) {
      res.status(400).json({ ok: false, code: 'INVALID_PASSWORD', error: error.message });
    }
  });

  router.post('/password/change', (req, res) => {
    if (!controller.changePassword(req.body?.oldPassword, req.body?.newPassword)) {
      return res.status(401).json({ ok: false, code: 'INVALID_PASSWORD', error: '密码不正确' });
    }
    issueSession(res);
    return status(res);
  });

  router.post('/password/reset', (req, res) => {
    try {
      const result = controller.resetPassword(req.body?.recoveryKey, req.body?.nextPassword);
      if (!result) return res.status(409).json({ ok: false, code: 'INVALID_RECOVERY_KEY', error: '恢复密钥无效或已经使用' });
      issueSession(res);
      return status(res, { recoveryKey: result.recoveryKey });
    } catch (error) {
      return res.status(400).json({ ok: false, code: 'INVALID_PASSWORD', error: error.message });
    }
  });

  router.post('/mode', (req, res) => {
    const nextMode = req.body?.mode;
    if (nextMode === 'teacher' && !controller.verify(req.body?.password)) {
      return res.status(401).json({ ok: false, code: 'INVALID_PASSWORD', error: '密码不正确' });
    }
    if (nextMode === 'classroom' && !controller.hasPassword()) {
      return res.status(409).json({ ok: false, code: 'PASSWORD_REQUIRED', error: '请先设置教师主密码' });
    }
    controller.setMode(nextMode);
    if (controller.getMode() === 'teacher') issueSession(res);
    return status(res);
  });

  router.post('/classroom-mode', (req, res) => {
    if (!controller.hasPassword()) {
      return res.status(409).json({ ok: false, code: 'PASSWORD_REQUIRED', error: '请先设置教师主密码' });
    }
    if (controller.getMode() !== 'teacher') {
      return res.status(409).json({ ok: false, code: 'INVALID_MODE', error: '当前已经是班级公开模式' });
    }
    controller.setMode('classroom');
    res.setHeader('Set-Cookie', 'teacher_work_access=; HttpOnly; SameSite=Strict; Max-Age=0; Path=/');
    return status(res);
  });

  router.post('/teacher-session', (req, res) => {
    if (!controller.verify(req.body?.password)) {
      return res.status(401).json({ ok: false, code: 'INVALID_PASSWORD', error: '密码不正确' });
    }
    controller.setMode('teacher');
    issueSession(res);
    return status(res);
  });

  router.delete('/teacher-session', (_req, res) => {
    if (!controller.hasPassword()) return res.status(409).json({ ok: false, code: 'PASSWORD_REQUIRED', error: '请先设置教师主密码' });
    controller.setMode('classroom');
    res.setHeader('Set-Cookie', 'teacher_work_access=; HttpOnly; SameSite=Strict; Max-Age=0; Path=/');
    return status(res);
  });

  router.post('/unlock-module', (req, res) => {
    if (!controller.verify(req.body?.password)) {
      return res.status(401).json({ ok: false, code: 'INVALID_PASSWORD', error: '密码不正确' });
    }
    try {
      controller.grantModule(req.body?.module);
      return status(res);
    } catch (error) {
      return res.status(400).json({ ok: false, code: 'INVALID_MODULE', error: error.message });
    }
  });

  router.put('/policies', (req, res) => {
    if (controller.getMode() !== 'teacher') {
      return res.status(403).json({ ok: false, code: 'MODULE_LOCKED', error: '请先进入教师模式' });
    }
    const requested = req.body?.policies;
    if (!requested || typeof requested !== 'object' || Array.isArray(requested)) {
      return res.status(400).json({ ok: false, code: 'INVALID_POLICIES', error: '权限配置格式不正确' });
    }
    const allowed = new Set(['open', 'protected']);
    const next = {};
    for (const [module, policy] of Object.entries(requested)) {
      if (!(module in controller.getPolicies()) || !allowed.has(policy)) {
        return res.status(400).json({ ok: false, code: 'INVALID_POLICIES', error: '包含不支持的模块权限' });
      }
      next[module] = policy;
    }
    controller.setPolicies(next);
    return status(res);
  });

  router.post('/lock', (_req, res) => {
    controller.lock();
    res.setHeader('Set-Cookie', 'teacher_work_access=; HttpOnly; SameSite=Strict; Max-Age=0; Path=/');
    return status(res);
  });

  return router;
}
