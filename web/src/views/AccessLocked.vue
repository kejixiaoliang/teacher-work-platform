<template>
  <section class="page-wrap locked-page">
    <div class="panel locked-card">
      <div class="locked-icon">🔒</div>
      <h2>此模块已保护</h2>
      <p class="text-muted">当前处于班级公开模式。请点击顶部“教师入口”并验证主密码后查看隐私信息。</p>
      <el-button type="primary" @click="router.push('/overview')">返回班级首页</el-button>
    </div>
  </section>
</template>

<script setup>
import { useRouter } from 'vue-router';
const router = useRouter();
</script>

<style scoped>
.locked-page { min-height: 70vh; display: grid; place-items: center; }
.locked-card { width: min(460px, 100%); text-align: center; padding: 42px 28px; }
.locked-icon { font-size: 42px; margin-bottom: 8px; }
.locked-card h2 { margin: 0 0 10px; }
.locked-card p { margin: 0 0 22px; }
</style>
