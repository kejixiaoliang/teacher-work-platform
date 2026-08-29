export const STUDENT_FIELD_CATALOG = Object.freeze([
  { key: 'school_no', label: '学号', dataType: 'text', kind: 'core' },
  { key: 'name', label: '姓名', dataType: 'text', kind: 'core', required: true },
  { key: 'gender', label: '性别', dataType: 'text', kind: 'core' },
  { key: 'birth_date', label: '出生日期', dataType: 'date', kind: 'core' },
  { key: 'phone', label: '联系电话', dataType: 'text', kind: 'core' },
  { key: 'parent_phone', label: '家长电话', dataType: 'text', kind: 'core' },
  { key: 'id_card', label: '身份证号', dataType: 'text', kind: 'preset_extension' },
  { key: 'address', label: '家庭住址', dataType: 'text', kind: 'preset_extension' },
  { key: 'guardian_relation', label: '监护人关系', dataType: 'text', kind: 'preset_extension' },
  { key: 'is_boarding', label: '住宿状态', dataType: 'boolean', kind: 'core' },
  { key: 'interest_duty', label: '兴趣与特长', dataType: 'text', kind: 'core' },
  { key: 'health_note', label: '健康备注', dataType: 'text', kind: 'core' },
  { key: 'height_cm', label: '身高(cm)', dataType: 'number', kind: 'core' },
  { key: 'vision_left', label: '左眼视力', dataType: 'number', kind: 'core' },
  { key: 'vision_right', label: '右眼视力', dataType: 'number', kind: 'core' },
  { key: 'is_myopia', label: '近视', dataType: 'boolean', kind: 'core' },
  { key: 'grade_level', label: '年级', dataType: 'text', kind: 'core' },
  { key: 'seat_note', label: '座位备注', dataType: 'text', kind: 'core' },
  { key: 'status', label: '状态', dataType: 'text', kind: 'core' },
  { key: 'remark', label: '备注', dataType: 'text', kind: 'core' },
]);

export const STUDENT_FIELD_BY_KEY = Object.freeze(Object.fromEntries(STUDENT_FIELD_CATALOG.map(field => [field.key, field])));
