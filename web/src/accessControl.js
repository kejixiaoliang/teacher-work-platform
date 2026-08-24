import { reactive, computed } from 'vue';
import { api } from './api.js';

export const accessState = reactive({
  configured: false,
  mode: 'teacher',
  policies: {},
  unlockedModules: [],
  loading: false,
});

export const isTeacherMode = computed(() => accessState.mode === 'teacher');
let autoLockTimer = null;

export async function refreshAccessStatus() {
  const status = await api.access.status();
  Object.assign(accessState, status);
  return status;
}

export function startAutoLockMonitor() {
  if (autoLockTimer) return;
  autoLockTimer = setInterval(() => {
    if (accessState.mode === 'teacher') refreshAccessStatus().catch(() => {});
  }, 60 * 1000);
}

export async function setupPassword(password) {
  const status = await api.access.setupPassword(password);
  Object.assign(accessState, status);
  return status;
}

export async function switchMode(mode, password) {
  const status = mode === 'classroom'
    ? await api.access.enableClassroomMode()
    : await api.access.enterTeacherSession(password);
  Object.assign(accessState, status);
  return status;
}

export async function resetPassword(recoveryKey, nextPassword) {
  const status = await api.access.resetPassword(recoveryKey, nextPassword);
  Object.assign(accessState, status);
  return status;
}

export async function unlockModule(module, password) {
  const status = await api.access.unlockModule(module, password);
  Object.assign(accessState, status);
  return status;
}

export async function lockWorkspace() {
  const status = await api.access.lock();
  Object.assign(accessState, status);
  return status;
}

export async function setPolicies(policies) {
  const status = await api.access.setPolicies(policies);
  Object.assign(accessState, status);
  return status;
}

export function isModuleAvailable(module) {
  return accessState.mode === 'teacher'
    || accessState.policies[module] === 'open'
    || accessState.unlockedModules.includes(module);
}
