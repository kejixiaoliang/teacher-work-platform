async function request(method, url, body) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const r = await fetch(url, opts);
  const j = await r.json().catch(() => ({ ok: false, error: '服务器响应异常' }));
  if (!j.ok) throw new Error(j.error || '请求失败');
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
    upload: formData => fetch('/api/documents', { method: 'POST', body: formData })
      .then(r => r.json()).then(j => { if (!j.ok) throw new Error(j.error || '上传失败'); return j.data; }),
    update: (id, d) => request('PUT', `/api/documents/${id}`, d),
    remove: id => request('DELETE', `/api/documents/${id}`),
    restore: ids => request('POST', '/api/documents/restore', { ids }),
    purge: ids => request('POST', '/api/documents/purge', { ids }),
    fileUrl: id => `/api/documents/${id}/file`,
    fileDl: id => `/api/documents/${id}/file?dl=1`,
  },
  duties: {
    list: q => request('GET', '/api/duties' + toQuery(q)),
    create: d => request('POST', '/api/duties', d),
    batch: d => request('POST', '/api/duties/batch', d),
    autoGroup: d => request('POST', '/api/duties/auto-group', d),
    presetLeaders: d => request('POST', '/api/duties/preset-leaders', d),
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
  records: {
    list: id => request('GET', `/api/students/${id}/records`),
    create: (id, d) => request('POST', `/api/students/${id}/records`, d),
    update: (id, rid, d) => request('PUT', `/api/students/${id}/records/${rid}`, d),
    remove: (id, rid) => request('DELETE', `/api/students/${id}/records/${rid}`),
    contacts: id => request('GET', `/api/students/${id}/contacts`),
    addContact: (id, d) => request('POST', `/api/students/${id}/contacts`, d),
    updateContact: (id, cid, d) => request('PUT', `/api/students/${id}/contacts/${cid}`, d),
    removeContact: (id, cid) => request('DELETE', `/api/students/${id}/contacts/${cid}`),
  },
};
