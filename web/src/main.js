import { createApp } from 'vue';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import App from './App.vue';
import router from './router.js';
import './style.css';
import { desktopApi } from './platform/desktopApi.js';

async function mountApp() {
  await desktopApi.bootstrap();
  const app = createApp(App);
  app.use(ElementPlus, { locale: zhCn });
  app.use(router);
  app.mount('#app');
}

mountApp().catch(error => {
  console.error('[startup]', error);
  document.querySelector('#app').textContent = `启动失败：${error?.message || error}`;
});
