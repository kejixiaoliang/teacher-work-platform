import { Router } from 'express';
import crypto from 'node:crypto';
import db, { getAppSetting, setAppSetting } from '../db.js';
import { createSyncQueueEntry, validateSyncCursor } from '../../shared/contracts/sync.js';
import { getDataDir } from '../config/paths.js';
import path from 'node:path';
import fs from 'node:fs';

const router = Router();
const MAX_QUEUE = 5000;

function queueKey(datasetId) { return `cloud-sync.queue.${datasetId}`; }
function readQueue(datasetId) {
  try { const value = JSON.parse(getAppSetting(queueKey(datasetId), '[]')); return Array.isArray(value) ? value : []; } catch { return []; }
}
function writeQueue(datasetId, queue) { setAppSetting(queueKey(datasetId), JSON.stringify(queue.slice(-MAX_QUEUE))); }
function validDataset(value) { return typeof value === 'string' && /^[\w-]{1,120}$/.test(value.trim()); }

router.get('/status', (req, res) => {
  const datasetId = String(req.query.dataset_id || '').trim();
  if (!validDataset(datasetId)) return res.status(400).json({ ok: false, code: 'DATASET_REQUIRED', error: '缺少有效数据集' });
  const queue = readQueue(datasetId);
  res.json({ ok: true, data: { datasetId, total: queue.length, pending: queue.filter((item) => item.queueStatus === 'pending').length, conflict: queue.filter((item) => item.queueStatus === 'conflict').length, failed: queue.filter((item) => item.queueStatus === 'failed').length } });
});

router.post('/prepare', async (req, res) => {
  const datasetId = String(req.body?.datasetId || '').trim();
  if (!validDataset(datasetId)) return res.status(400).json({ ok: false, code: 'DATASET_REQUIRED', error: '缺少有效数据集' });
  if (req.body?.confirm !== true) return res.status(400).json({ ok: false, code: 'CONFIRM_REQUIRED', error: '首次全量同步必须明确确认' });
  const backupDir = path.join(getDataDir(), 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const snapshotPath = path.join(backupDir, `before-cloud-sync-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.db`);
  try {
    await db.backup(snapshotPath);
    return res.json({ ok: true, data: { datasetId, snapshotPath, createdAt: new Date().toISOString() } });
  } catch (error) {
    try { fs.rmSync(snapshotPath, { force: true }); } catch { /* preserve the original failure */ }
    return res.status(503).json({ ok: false, code: 'SYNC_SNAPSHOT_FAILED', error: `同步前快照失败：${error.message}` });
  }
});

router.post('/queue', (req, res) => {
  const datasetId = String(req.body?.datasetId || '').trim();
  const changes = req.body?.changes;
  if (!validDataset(datasetId) || !Array.isArray(changes) || !changes.length || changes.length > 100) return res.status(400).json({ ok: false, code: 'INVALID_SYNC_BATCH', error: '同步批次无效' });
  const queue = readQueue(datasetId);
  const accepted = [];
  for (const change of changes) {
    if (!change || change.record?.datasetId !== datasetId || !change.changeId || [...queue, ...accepted].some((item) => item.changeId === change.changeId)) continue;
    try { accepted.push(createSyncQueueEntry(change)); } catch { /* invalid changes are reported below */ }
  }
  writeQueue(datasetId, [...queue, ...accepted]);
  res.status(202).json({ ok: true, data: { datasetId, accepted: accepted.length, duplicateOrInvalid: changes.length - accepted.length, queueSize: queue.length + accepted.length } });
});

router.post('/cursor/validate', (req, res) => {
  const result = validateSyncCursor(req.body?.cursor);
  res.status(result.ok ? 200 : 400).json(result.ok ? { ok: true, data: req.body.cursor } : { ok: false, code: 'INVALID_SYNC_CURSOR', errors: result.errors });
});

router.post('/queue/:changeId/retry', (req, res) => {
  const datasetId = String(req.body?.datasetId || '').trim();
  if (!validDataset(datasetId)) return res.status(400).json({ ok: false, code: 'DATASET_REQUIRED', error: '缺少有效数据集' });
  const queue = readQueue(datasetId);
  const index = queue.findIndex((item) => item.changeId === req.params.changeId);
  if (index < 0) return res.status(404).json({ ok: false, code: 'SYNC_CHANGE_NOT_FOUND', error: '同步变更不存在' });
  const current = queue[index];
  queue[index] = { ...current, queueStatus: 'pending', attempts: current.attempts + 1, lastError: '', retryAt: new Date().toISOString(), retryToken: crypto.randomUUID() };
  writeQueue(datasetId, queue);
  res.json({ ok: true, data: queue[index] });
});

export default router;
