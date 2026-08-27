const modules = [
  { id: 'students', label: '学生管理', group: '常用', route: '/pages/students/index' },
  { id: 'seats', label: '座位管理', group: '常用', route: '/pages/seats/index' },
  { id: 'analysis', label: '数据分析', group: '学习分析', route: '/pages/analysis/index' },
  { id: 'scores', label: '成绩管理', group: '学习分析', route: '/pages/scores/index' },
  { id: 'attendance', label: '考勤管理', group: '学习分析', route: '/pages/attendance/index' },
  { id: 'assessment', label: '表现量化', group: '学习分析', route: '/pages/assessment/index' },
  { id: 'documents', label: '文档管理', group: '班级事务', route: '/pages/documents/index' },
  { id: 'duties', label: '值日管理', group: '班级事务', route: '/pages/duties/index' },
  { id: 'leaders', label: '班委学委', group: '班级事务', route: '/pages/leaders/index' },
  { id: 'subject-leaders', label: '课代表选择', group: '班级事务', route: '/pages/subject-leaders/index' },
  { id: 'leaves', label: '请假管理', group: '班级事务', route: '/pages/leaves/index' },
  { id: 'contacts', label: '家校沟通', group: '班级事务', route: '/pages/contacts/index' },
];

module.exports = { modules };
