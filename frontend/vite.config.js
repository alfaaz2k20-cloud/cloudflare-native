import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.', // Vite root is the frontend directory
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
        blogs: resolve(__dirname, 'blogs.html'),
        dashboard: resolve(__dirname, 'dashboard.html'),
        exhibition: resolve(__dirname, 'exhibition.html'),
        login: resolve(__dirname, 'login.html'),
        post: resolve(__dirname, 'post.html'),
        register: resolve(__dirname, 'register.html'),
        reset: resolve(__dirname, 'reset.html'),
        submit: resolve(__dirname, 'submit.html'),
        recruit: resolve(__dirname, 'recruit.html'),
        research: resolve(__dirname, 'research.html'),
      },
    },
  },
  server: {
    port: 3000,
    fs: {
      allow: ['..']
    }
  },
});
