export function studentClassGuard(classId) {
  const id = Number(classId);
  const hasClass = Number.isInteger(id) && id > 0;
  return {
    canCreate: hasClass,
    canImport: hasClass,
    entryMessage: hasClass ? '' : '请先创建班级，再录入或导入学生',
    saveMessage: hasClass ? '' : '当前班级已失效，请先创建或选择班级；已填写内容会为你保留',
  };
}
