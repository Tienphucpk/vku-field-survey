import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

export default defineConfig({
  plugins: [
    {
      name: 'sync-to-dist',
      closeBundle() {
        const root = process.cwd();
        const srcDir = path.join(root, 'dist_pwa');
        const destDir = path.join(root, 'dist');
        const copyFiles = (s, d) => {
          if (!fs.existsSync(s)) return;
          try {
            fs.mkdirSync(d, { recursive: true });
          } catch (e) {}
          fs.readdirSync(s).forEach((file) => {
            const sp = path.join(s, file);
            const dp = path.join(d, file);
            if (fs.statSync(sp).isDirectory()) {
              copyFiles(sp, dp);
            } else {
              try {
                fs.writeFileSync(dp, fs.readFileSync(sp));
              } catch (e) {}
            }
          });
        };
        copyFiles(srcDir, destDir);
      }
    }
  ],
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist_pwa',
    emptyOutDir: true,
    rollupOptions: {
      external: (id) => id.startsWith('@capacitor/')
    }
  },
  server: {
    port: 3000,
    open: true
  }
});
