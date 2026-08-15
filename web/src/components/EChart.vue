<template>
  <div ref="el" :style="{ width: '100%', height: height }"></div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import * as echarts from 'echarts/core';
import { BarChart, PieChart, LineChart } from 'echarts/charts';
import {
  TitleComponent, TooltipComponent, LegendComponent, GridComponent,
  MarkPointComponent, DataZoomComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
  BarChart, PieChart, LineChart,
  TitleComponent, TooltipComponent, LegendComponent, GridComponent,
  MarkPointComponent, DataZoomComponent,
  CanvasRenderer,
]);

const props = defineProps({
  option: { type: Object, required: true },
  height: { type: String, default: '300px' },
});

const el = ref(null);
let chart = null;
let resizeTimer = null;
let resizeObserver = null;

function render() {
  // 增量更新（notMerge=false）：避免每次全量重建实例，图表切换更流畅
  if (chart) chart.setOption(props.option, { notMerge: false });
}

function resizeChart() {
  if (!chart || !el.value) return;
  const { width, height } = el.value.getBoundingClientRect();
  if (width > 0 && height > 0) chart.resize({ width, height });
}

onMounted(() => {
  chart = echarts.init(el.value);
  render();
  nextTick(resizeChart);
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => resizeChart());
    resizeObserver.observe(el.value);
  }
  window.addEventListener('resize', onResize);
});
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize);
  resizeObserver?.disconnect();
  resizeObserver = null;
  if (resizeTimer) clearTimeout(resizeTimer);
  chart?.dispose();
  chart = null;
});
watch(() => props.option, () => { render(); nextTick(resizeChart); });

// resize 防抖：连续窗口变化只执行一次
function onResize() {
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => chart?.resize(), 120);
}
</script>
