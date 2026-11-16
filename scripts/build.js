/* Build: memastikan semua berkas yang dirujuk index.html ada, lalu menyalin ke dist/. */
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync('index.html', 'utf8');
const refs = [...html.matchAll(/(?:src|href)="((?:js|css)\/[^"]+)"/g)].map(m => m[1]);
let missing = 0;
for (const r of refs) {
  if (!fs.existsSync(r)) { console.error(`✗ Berkas dirujuk index.html tetapi tidak ada: ${r}`); missing++; }
  else console.log(`✓ ${r}`);
}
if (missing) { console.error(`\nBuild gagal: ${missing} berkas hilang.`); process.exit(1); }

fs.rmSync('dist', { recursive: true, force: true });
for (const f of ['index.html', ...refs]) {
  fs.mkdirSync(path.dirname(path.join('dist', f)), { recursive: true });
  fs.copyFileSync(f, path.join('dist', f));
}
if (fs.existsSync('images')) fs.cpSync('images', 'dist/images', { recursive: true });
console.log(`\nBuild sukses: ${refs.length + 1} berkas disalin ke dist/`);
