import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

// Plugin to copy dexie.min.js to dist
function copyDexiePlugin() {
    return {
        name: 'copy-dexie',
        writeBundle() {
            const srcPath = path.resolve(rootDir, 'src/assets/libs/dexie.min.js');
            const destDir = path.resolve(rootDir, 'dist/src/assets/libs');
            const destPath = path.resolve(destDir, 'dexie.min.js');

            if (!existsSync(destDir)) {
                mkdirSync(destDir, { recursive: true });
            }
            copyFileSync(srcPath, destPath);
            console.log('Copied dexie.min.js to dist/src/assets/libs/');
        }
    };
}

export default defineConfig({
    base: '', // Use relative paths for assets
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        rollupOptions: {
            input: {
                popup: path.resolve(rootDir, 'src/popup/popup.html'),
                options: path.resolve(rootDir, 'src/options/options.html'),
                drills: path.resolve(rootDir, 'src/drills/drills.html'),
                drill_overview: path.resolve(rootDir, 'src/drills/drill_overview.html'),
                background: path.resolve(rootDir, 'src/background/worker.js')
            },
            output: {
                entryFileNames: '[name].js',
                chunkFileNames: 'chunks/[name].js',
                assetFileNames: 'assets/[name][extname]'
            }
        }
    },
    plugins: [copyDexiePlugin()]
});
