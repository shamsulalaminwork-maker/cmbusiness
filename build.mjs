import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync } from 'fs';
rmSync('www', { recursive: true, force: true });
mkdirSync('www', { recursive: true });
await build({ entryPoints: ['src/app.js'], bundle: true, minify: true, outfile: 'www/app.js', target: 'es2020' });
cpSync('src/index.html', 'www/index.html');
cpSync('src/style.css', 'www/style.css');
cpSync('src/fonts', 'www/fonts', { recursive: true });
console.log('built');
