import { reactive, computed } from 'vue';
import { api } from './api.js';

export const store = reactive({
  classes: [],
  currentClassId: null,
});

export const currentClass = computed(() =>
  store.classes.find(c => c.id === store.currentClassId) || null
);

export async function loadClasses() {
  store.classes = await api.classes.list();
  if (!store.currentClassId && store.classes.length) {
    store.currentClassId = store.classes[0].id;
  }
  if (store.currentClassId && !store.classes.some(c => c.id === store.currentClassId)) {
    store.currentClassId = store.classes.length ? store.classes[0].id : null;
  }
  return store.classes;
}
