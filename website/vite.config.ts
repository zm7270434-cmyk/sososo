import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// Served from GitHub Pages at https://yusupsupriyadi.github.io/sososo/
export default defineConfig({
  base: '/sososo/',
  plugins: [tailwindcss()],
});
