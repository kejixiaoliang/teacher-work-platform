import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { createGzip } from 'zlib';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

/** 构建后为静态资源生成 .gz 文件（配合 server 端 gzip 中间件） */
function gzipPlugin() {
  return {
    name: 'vite:gzip-assets',
    apply: 'build',
    closeBundle() {
      const outDir = 'web/dist';
      const files = ['index.html'];
      const assetsDir = join(outDir, 'assets');
      if (existsSync(assetsDir)) {
        for (const f of readdirSync(assetsDir)) {
          if (/\.(js|css)$/.test(f)) files.push('assets/' + f);
        }
      }
      let count = 0;
      for (const rel of files) {
        const abs = join(outDir, rel);
        if (!existsSync(abs)) continue;
        const gz = createGzip({ level: 9 });
        const chunks = [];
        gz.on('data', c => chunks.push(c));
        gz.on('end', () => writeFileSync(abs + '.gz', Buffer.concat(chunks)));
        gz.write(readFileSync(abs));
        gz.end();
        count++;
      }
      console.log(`[gzip] 已为 ${count} 个静态资源生成 .gz`);
    },
  };
}

export default defineConfig({
  root: 'web',
  base: './',
  plugins: [vue(), gzipPlugin()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3210' },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.code === 'INVALID_ANNOTATION' && warning.message?.includes('@vueuse/core')) return;
        warn(warning);
      },
      output: {
        manualChunks(id) {
          // 大依赖单独分块：缓存友好，改动业务代码不影响 vendor 缓存
          if (id.includes('node_modules/echarts')) return 'echarts';
          if (id.includes('node_modules/exceljs')) return 'exceljs';
          if (id.includes('node_modules/element-plus')) return 'element-plus';
          if (id.includes('node_modules/vue') || id.includes('node_modules/@vue')) return 'vue-vendor';
        },
      },
    },
  },
});
