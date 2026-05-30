import { defineConfig } from '@super/vite-config';

export default defineConfig(async () => {
  return {
    application: {},
    vite: {
      server: {
        proxy: {
          '/api': {
            changeOrigin: true,
            target: 'http://localhost:10588',
            ws: true,
          },
        },
      },
    },
  };
});
