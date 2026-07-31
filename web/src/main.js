import { createApp } from 'vue';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import App from './App.vue';
import router from './router.js';
import './style.css';

const app = createApp(App);
app.use(ElementPlus, { locale: zhCn });
// 图标全部按需 import（各页面已显式引入），不再全量注册 293 个组件
app.use(router);
app.mount('#app');
