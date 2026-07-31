<template>
  <div ref="el" :style="{ width: '100%', height: height }"></div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import * as echarts from 'echarts';

const props = defineProps({
  option: { type: Object, required: true },
  height: { type: String, default: '300px' },
});

const el = ref(null);
let chart = null;

function render() {
  if (chart) chart.setOption(props.option, true);
}

onMounted(() => {
  chart = echarts.init(el.value);
  render();
  window.addEventListener('resize', resize);
});
onBeforeUnmount(() => {
  window.removeEventListener('resize', resize);
  chart?.dispose();
  chart = null;
});
watch(() => props.option, render);

function resize() { chart?.resize(); }
</script>
