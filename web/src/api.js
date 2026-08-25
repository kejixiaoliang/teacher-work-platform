import { getRuntimeConfig, toApiUrl } from './platform/runtimeConfig.js';

async function request(method, url, body) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  // 15s 超时：防止慢请求永久 pending 卡住 loading（P2）
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  opts.signal = ctrl.signal;
  let r;
  try {
    const { apiToken } = getRuntimeConfig();
    if (apiToken) opts.headers['x-teacher-work-token'] = apiToken;
    r = await fetch(toApiUrl(url), opts);
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') throw new Error('请求超时，请重试');
    throw new Error('网络错误：' + e.message);
  }
  clearTimeout(timer);
  // 非 2xx 状态：后端可能返回 HTML 错误页或无 body，先按状态抛错（P2）
  if (!r.ok) {
    const j = await r.json().catch(() => null);
    throw new Error((j && j.error) || `请求失败（${r.status}）`);
  }
  const j = await r.json().catch(() => ({ ok: false, error: '服务器响应异常' }));
  if (!j.ok) throw new Error(j.error || '请求失败');
  return j.data;
}

async function requestBlob(method, url) {
  const opts = { method, headers: {} };
  const { apiToken } = getRuntimeConfig();
  if (apiToken) opts.headers['x-teacher-work-token'] = apiToken;
  const r = await fetch(toApiUrl(url), opts);
  if (!r.ok) {
    const j = await r.json().catch(() => null);
    throw new Error((j && j.error) || `请求失败（${r.status}）`);
  }
  return r.blob();
}

async function requestMultipart(url, file) {
  const form = new FormData();
  form.append('backup', file);
  const { apiToken } = getRuntimeConfig();
  const headers = apiToken ? { 'x-teacher-work-token': apiToken } : {};
  let r;
  try {
    r = await fetch(toApiUrl(url), { method: 'POST', headers, body: form });
  } catch (e) {
    if (e?.name === 'AbortError') throw new Error('恢复请求超时，请检查程序状态后重试');
    throw new Error('无法连接到本地服务，请确认程序仍在运行');
  }
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.ok) throw new Error((j && j.error) || `请求失败（${r.status}）`);
  return j.data;
}

function toQuery(q = {}) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (v !== undefined && v !== null && v !== '') p.set(k, v);
  }
  const s = p.toString();
  return s ? '?' + s : '';
}

export const api = {
  access: {
    status: () => request('GET', '/api/access/status'),
    setupPassword: password => request('POST', '/api/access/password', { password }),
    changePassword: (oldPassword, newPassword) => request('POST', '/api/access/password/change', { oldPassword, newPassword }),
    switchMode: (mode, password) => request('POST', '/api/access/mode', { mode, password }),
    enableClassroomMode: () => request('POST', '/api/access/classroom-mode', {}),
    enterTeacherSession: password => request('POST', '/api/access/teacher-session', { password }),
    leaveTeacherSession: () => request('DELETE', '/api/access/teacher-session'),
    resetPassword: (recoveryKey, nextPassword) => request('POST', '/api/access/password/reset', { recoveryKey, nextPassword }),
    unlockModule: (module, password) => request('POST', '/api/access/unlock-module', { module, password }),
    setPolicies: policies => request('PUT', '/api/access/policies', { policies }),
    lock: () => request('POST', '/api/access/lock', {}),
  },
  classes: {
    list: () => request('GET', '/api/classes'),
    create: d => request('POST', '/api/classes', d),
    update: (id, d) => request('PUT', `/api/classes/${id}`, d),
    remove: id => request('DELETE', `/api/classes/${id}`),
  },
  students: {
    list: q => request('GET', '/api/students' + toQuery(q)),
    create: d => request('POST', '/api/students', d),
    update: (id, d) => request('PUT', `/api/students/${id}`, d),
    remove: id => request('DELETE', `/api/students/${id}`),
    restore: ids => request('POST', '/api/students/restore', { ids }),
    purge: ids => request('POST', '/api/students/purge', { ids }),
    import: d => request('POST', '/api/students/import', d),
    archive: d => request('POST', '/api/students/archive', d),
    metrics: id => request('GET', `/api/students/${id}/metrics`),
    classMetrics: classId => request('GET', `/api/students/class-metrics?class_id=${classId}`),
  },
  seats: {
    get: classId => request('GET', `/api/seats?class_id=${classId}`),
    save: d => request('PUT', '/api/seats', d),
    auto: d => request('POST', '/api/seats/auto', d),
    shift: d => request('POST', '/api/seats/shift', d),
    layouts: classId => request('GET', `/api/seats/layouts?class_id=${classId}`),
    layoutDetail: id => request('GET', `/api/seats/layouts/${id}`),
    removeLayout: id => request('DELETE', `/api/seats/layouts/${id}`),
  },
  documents: {
    list: q => request('GET', '/api/documents' + toQuery(q)),
    upload: async formData => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 15000);
      let r;
      try {
        const { apiToken } = getRuntimeConfig();
        const headers = apiToken ? { 'x-teacher-work-token': apiToken } : {};
        r = await fetch(toApiUrl('/api/documents'), { method: 'POST', body: formData, headers, signal: ctrl.signal });
      } catch (e) {
        if (e.name === 'AbortError') throw new Error('上传超时，请重试');
        throw new Error('网络错误：' + e.message);
      } finally {
        clearTimeout(timer);
      }
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) throw new Error((j && j.error) || `上传失败（${r.status}）`);
      return j.data;
    },
    update: (id, d) => request('PUT', `/api/documents/${id}`, d),
    remove: id => request('DELETE', `/api/documents/${id}`),
    restore: ids => request('POST', '/api/documents/restore', { ids }),
    purge: ids => request('POST', '/api/documents/purge', { ids }),
    fileToken: id => request('GET', `/api/documents/${id}/file-token`),
    readFile: async (id, { download = false } = {}) => {
      const { token } = await request('GET', `/api/documents/${id}/file-token`);
      const query = new URLSearchParams({ __token: token });
      if (download) query.set('dl', '1');
      const r = await fetch(toApiUrl(`/api/documents/${id}/file?${query}`));
      if (!r.ok) throw new Error(`文件读取失败（${r.status}）`);
      return r.blob();
    },
  },
  duties: {
    list: q => request('GET', '/api/duties' + toQuery(q)),
    create: d => request('POST', '/api/duties', d),
    batch: d => request('POST', '/api/duties/batch', d),
    autoGroup: d => request('POST', '/api/duties/auto-group', d),
    groupDays: d => request('PUT', '/api/duties/group-days', d),
    presetLeaders: d => request('POST', '/api/duties/preset-leaders', d),
    presetSubjectLeaders: d => request('POST', '/api/duties/preset-subject-leaders', d),
    update: (id, d) => request('PUT', `/api/duties/${id}`, d),
    remove: id => request('DELETE', `/api/duties/${id}`),
  },
  scores: {
    exams: classId => request('GET', `/api/scores/exams?class_id=${classId}`),
    createExam: d => request('POST', '/api/scores/exams', d),
    updateExam: (id, d) => request('PUT', `/api/scores/exams/${id}`, d),
    removeExam: id => request('DELETE', `/api/scores/exams/${id}`),
    list: examId => request('GET', `/api/scores?exam_id=${examId}`),
    save: d => request('PUT', '/api/scores', d),
    analysis: examId => request('GET', `/api/scores/analysis?exam_id=${examId}`),
    trend: (classId, studentId) => request('GET', `/api/scores/trend?class_id=${classId}&student_id=${studentId}`),
  },
  attendance: {
    get: (classId, date) => request('GET', `/api/attendance?class_id=${classId}&date=${date}`),
    save: d => request('PUT', '/api/attendance', d),
    stats: (classId, month) => request('GET', `/api/attendance/stats?class_id=${classId}&month=${month}`),
  },
  assessment: {
    categories: {
      list: includeInactive => request('GET', '/api/assessment/categories' + toQuery({ include_inactive: includeInactive ? '1' : '' })),
      create: d => request('POST', '/api/assessment/categories', d),
      update: (id, d) => request('PUT', `/api/assessment/categories/${id}`, d),
      remove: id => request('DELETE', `/api/assessment/categories/${id}`),
    },
    items: {
      create: d => request('POST', '/api/assessment/items', d),
      update: (id, d) => request('PUT', `/api/assessment/items/${id}`, d),
      remove: id => request('DELETE', `/api/assessment/items/${id}`),
      disable: id => request('POST', `/api/assessment/items/${id}/disable`, {}),
    },
    records: {
      list: q => request('GET', '/api/assessment/records' + toQuery(q)),
      batchCreate: d => request('POST', '/api/assessment/records/batch', d),
      update: (id, d) => request('PUT', `/api/assessment/records/${id}`, d),
      void: (id, reason) => request('POST', `/api/assessment/records/${id}/void`, { reason }),
      restore: (id, reason) => request('POST', `/api/assessment/records/${id}/restore`, { reason }),
      revisions: id => request('GET', `/api/assessment/records/${id}/revisions`),
      voidBatch: (batchId, reason) => request('POST', `/api/assessment/batches/${batchId}/void`, { reason }),
    },
    stats: {
      daily: q => request('GET', '/api/assessment/stats/daily' + toQuery(q)),
      monthly: q => request('GET', '/api/assessment/stats/monthly' + toQuery(q)),
      term: q => request('GET', '/api/assessment/stats/term' + toQuery(q)),
      student: (id, q) => request('GET', `/api/assessment/stats/student/${id}` + toQuery(q)),
    },
  },
  leaves: {
    list: q => request('GET', '/api/leaves' + toQuery(q)),
    create: d => request('POST', '/api/leaves', d),
    update: (id, d) => request('PUT', `/api/leaves/${id}`, d),
    remove: id => request('DELETE', `/api/leaves/${id}`),
    today: classId => request('GET', `/api/leaves/today?class_id=${classId}`),
  },
  contacts: {
    list: q => request('GET', '/api/contacts' + toQuery(q)),
    stats: q => request('GET', '/api/contacts/stats' + toQuery(q)),
    create: d => request('POST', '/api/contacts', d),
    update: (id, d) => request('PUT', `/api/contacts/${id}`, d),
    remove: id => request('DELETE', `/api/contacts/${id}`),
  },
  records: {
    list: id => request('GET', `/api/students/${id}/records`),
    timeline: id => request('GET', `/api/students/${id}/timeline`),
    create: (id, d) => request('POST', `/api/students/${id}/records`, d),
    update: (id, rid, d) => request('PUT', `/api/students/${id}/records/${rid}`, d),
    remove: (id, rid) => request('DELETE', `/api/students/${id}/records/${rid}`),
    contacts: id => request('GET', `/api/students/${id}/contacts`),
    addContact: (id, d) => request('POST', `/api/students/${id}/contacts`, d),
    updateContact: (id, cid, d) => request('PUT', `/api/students/${id}/contacts/${cid}`, d),
    removeContact: (id, cid) => request('DELETE', `/api/students/${id}/contacts/${cid}`),
  },
  backup: {
    export: () => requestBlob('GET', '/api/backup/export'),
    exportJson: () => requestBlob('GET', '/api/backup/export-json'),
    import: payload => request('POST', '/api/backup/import', payload),
    importFile: file => requestMultipart('/api/backup/import', file),
    update: payload => request('POST', '/api/backup/update', payload),
    exportClass: id => requestBlob('GET', `/api/backup/export-class/${id}`),
  },
  overview: {
    alerts: classId => request('GET', `/api/overview/alerts?class_id=${classId}`),
  },
  followUpTasks: {
    list: q => request('GET', '/api/follow-up-tasks' + toQuery(q)),
    create: d => request('POST', '/api/follow-up-tasks', d),
    update: (id, d) => request('PUT', `/api/follow-up-tasks/${id}`, d),
    remove: id => request('DELETE', `/api/follow-up-tasks/${id}`),
  },
  workbench: {
    today: classId => request('GET', `/api/workbench/today?class_id=${classId}`),
  },
};
