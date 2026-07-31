import { reactive, computed, watch } from 'vue';
import { api } from './api.js';

export const store = reactive({
  classes: [],
  currentClassId: Number(localStorage.getItem('current-class-id')) || null,
  seatsDirty: false, // 座位页是否有未保存修改（用于切班级拦截）
});

export const currentClass = computed(() =>
  store.classes.find(c => c.id === store.currentClassId) || null
);

// 当前班级持久化，刷新后保持
watch(() => store.currentClassId, id => {
  if (id) localStorage.setItem('current-class-id', String(id));
  else localStorage.removeItem('current-class-id');
});

export async function loadClasses() {
  store.classes = await api.classes.list();
  if (!store.currentClassId || !store.classes.some(c => c.id === store.currentClassId)) {
    store.currentClassId = store.classes.length ? store.classes[0].id : null;
  }
  return store.classes;
}
