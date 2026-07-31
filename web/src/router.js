import { createRouter, createWebHashHistory } from 'vue-router';
import Overview from './views/Overview.vue';
import Students from './views/Students.vue';
import Seats from './views/Seats.vue';
import Analytics from './views/Analytics.vue';
import Scores from './views/Scores.vue';
import Attendance from './views/Attendance.vue';
import Documents from './views/Documents.vue';
import Duties from './views/Duties.vue';
import Leaders from './views/Leaders.vue';
import SubjectLeaders from './views/SubjectLeaders.vue';
import Leaves from './views/Leaves.vue';
import Contacts from './views/Contacts.vue';
import Classes from './views/Classes.vue';

export default createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/overview' },
    { path: '/overview', component: Overview, meta: { title: '概览首页' } },
    { path: '/students', component: Students, meta: { title: '学生管理' } },
    { path: '/seats', component: Seats, meta: { title: '座位管理' } },
    { path: '/analytics', component: Analytics, meta: { title: '数据分析' } },
    { path: '/scores', component: Scores, meta: { title: '成绩管理' } },
    { path: '/attendance', component: Attendance, meta: { title: '考勤管理' } },
    { path: '/documents', component: Documents, meta: { title: '文档管理' } },
    { path: '/duties', component: Duties, meta: { title: '值日管理' } },
    { path: '/leaders', component: Leaders, meta: { title: '班委学委' } },
    { path: '/subject-leaders', component: SubjectLeaders, meta: { title: '课代表选择' } },
    { path: '/leaves', component: Leaves, meta: { title: '请假管理' } },
    { path: '/contacts', component: Contacts, meta: { title: '家校沟通' } },
    { path: '/classes', component: Classes, meta: { title: '班级设置' } },
  ],
});
