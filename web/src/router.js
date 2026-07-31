import { createRouter, createWebHashHistory } from 'vue-router';

// 路由懒加载：按需加载页面 JS，显著缩小首屏体积
const Overview = () => import('./views/Overview.vue');
const Students = () => import('./views/Students.vue');
const Seats = () => import('./views/Seats.vue');
const Analytics = () => import('./views/Analytics.vue');
const Scores = () => import('./views/Scores.vue');
const Attendance = () => import('./views/Attendance.vue');
const Documents = () => import('./views/Documents.vue');
const Duties = () => import('./views/Duties.vue');
const Leaders = () => import('./views/Leaders.vue');
const SubjectLeaders = () => import('./views/SubjectLeaders.vue');
const Leaves = () => import('./views/Leaves.vue');
const Contacts = () => import('./views/Contacts.vue');
const Classes = () => import('./views/Classes.vue');

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
