import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
    vue(),
    dts({
      entryRoot: 'src',
      tsconfigPath: './tsconfig.json',
    }),
  ],
  build: {
    lib: {
      entry: {
        index: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
        wide: fileURLToPath(new URL('./src/wide.ts', import.meta.url)),
        schedule: fileURLToPath(new URL('./src/schedule.ts', import.meta.url)),
      },
      formats: ['es'],
      fileName: (format, entryName) => `${entryName}.js`,
      cssFileName: 'index',
    },
    rollupOptions: {
      external: [
        'vue',
        'vue-router',
        'tdesign-vue-next',
        'tdesign-icons-vue-next',
        // 接入层不打包进本包，保持运行时单实例（消费端按 dependencies 解析）
        '@beangle/ems-app',
        '@beangle/ems-app/pc',
        /^tdesign-vue-next\//,
        /^tdesign-icons-vue-next\//,
      ],
    },
    outDir: 'dist',
  },
})
