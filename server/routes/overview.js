import { Router } from 'express';
import db from '../db.js';

const router = Router();

// 智能预警中心（方向 4）：按班级聚合各类预警，供首页「预警中心」卡片展示
router.get('/alerts', (req, res) => {
  const { class_id } = req.query;
  if (!class_id) return res.json({ ok: false, error: '缺少班级' });
  const cid = Number(class_id);
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const todayStr = `${y}-${m}-${d}`;
  const monthStr = `${y}-${m}`;

  const alerts = [];

  /* 1) 累计缺勤预警：近 30 天缺勤 ≥3 次 */
  const absent = db.prepare(`
    SELECT s.id, s.name, COUNT(*) AS cnt
    FROM attendance a JOIN students s ON s.id = a.student_id
    WHERE a.class_id = ? AND a.status = '缺勤' AND a.date >= date('now','-30 days')
      AND s.deleted_at IS NULL
    GROUP BY s.id HAVING cnt >= 3 ORDER BY cnt DESC
  `).all(cid);
  for (const r of absent) {
    alerts.push({ type: 'absent', level: 'danger', studentName: r.name, text: `近 30 天缺勤 ${r.cnt} 次` });
  }

  /* 2) 逾期未销假：已过 end_date 且状态不是已销假 */
  const overdue = db.prepare(`
    SELECT l.id, l.end_date, s.name AS student_name, l.type
    FROM leaves l JOIN students s ON s.id = l.student_id
    WHERE l.class_id = ? AND l.status <> '已销假' AND l.end_date < ? AND l.end_date <> ''
      AND s.deleted_at IS NULL
    ORDER BY l.end_date
  `).all(cid, todayStr);
  for (const r of overdue) {
    alerts.push({ type: 'overdue', level: 'warning', studentName: r.student_name, text: `${r.type} ${r.end_date} 到期未销假` });
  }

  /* 3) 超期未沟通：最近一次家校沟通距今 >30 天（取每个学生最新日期） */
  // 若班级完全没有任何沟通记录，说明功能尚未使用，不刷「从未沟通」预警避免噪音
  const totalContacts = db.prepare(`
    SELECT COUNT(*) AS c FROM contacts WHERE student_id IN (SELECT id FROM students WHERE class_id = ? AND deleted_at IS NULL)
  `).get(cid).c;
  const silent = db.prepare(`
    SELECT s.id, s.name,
      (SELECT MAX(c.date) FROM contacts c WHERE c.student_id = s.id) AS last_date
    FROM students s
    WHERE s.class_id = ? AND s.deleted_at IS NULL AND s.status = '在读'
  `).all(cid);
  for (const r of silent) {
    if (!r.last_date) {
      if (totalContacts > 0) {
        alerts.push({ type: 'noContact', level: 'warning', studentName: r.name, text: '从未记录家校沟通' });
      }
      continue;
    }
    const days = Math.floor((new Date(todayStr) - new Date(r.last_date)) / 86400000);
    if (days > 30) {
      alerts.push({ type: 'noContact', level: 'warning', studentName: r.name, text: `已 ${days} 天未沟通` });
    }
  }

  /* 4) 健康预警：最新学期快照 vs 上一条，视力下降 ≥0.5 或近视新增 */
  const healthRows = db.prepare(`
    SELECT m.student_id, s.name, m.term, m.vision_left, m.vision_right, m.is_myopia
    FROM student_metrics_history m JOIN students s ON s.id = m.student_id
    WHERE s.class_id = ? AND s.deleted_at IS NULL
    ORDER BY m.student_id, m.id
  `).all(cid);
  const byStudent = {};
  for (const r of healthRows) {
    if (!byStudent[r.student_id]) byStudent[r.student_id] = [];
    byStudent[r.student_id].push(r);
  }
  for (const [sid, list] of Object.entries(byStudent)) {
    if (list.length < 2) continue;
    const latest = list[list.length - 1];
    const prev = list[list.length - 2];
    const vNow = Math.min(Number(latest.vision_left) || 5, Number(latest.vision_right) || 5);
    const vPrev = Math.min(Number(prev.vision_left) || 5, Number(prev.vision_right) || 5);
    if (Number.isFinite(vNow) && Number.isFinite(vPrev) && vPrev - vNow >= 0.5) {
      alerts.push({
        type: 'vision', level: 'danger', studentName: latest.name,
        text: `视力从 ${vPrev.toFixed(1)} 降至 ${vNow.toFixed(1)}（${latest.term}）`,
      });
    }
    if (!prev.is_myopia && latest.is_myopia) {
      alerts.push({ type: 'myopia', level: 'warning', studentName: latest.name, text: `本学期新发现近视（${latest.term}）` });
    }
  }

  /* 5) 本月生日提醒 */
  const birthdays = db.prepare(`
    SELECT id, name, birth_date FROM students
    WHERE class_id = ? AND deleted_at IS NULL AND status = '在读'
      AND birth_date <> '' AND substr(birth_date, 6, 2) = ?
  `).all(cid, m);
  for (const r of birthdays) {
    const day = String(r.birth_date).slice(8, 10);
    alerts.push({ type: 'birthday', level: 'info', studentName: r.name, text: `${monthStr}-${day} 生日` });
  }

  res.json({
    ok: true,
    data: {
      generatedAt: todayStr,
      total: alerts.length,
      danger: alerts.filter(a => a.level === 'danger').length,
      warning: alerts.filter(a => a.level === 'warning').length,
      info: alerts.filter(a => a.level === 'info').length,
      alerts,
    },
  });
});

export default router;
