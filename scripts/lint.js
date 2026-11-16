/* Lint sederhana tanpa dependensi: cek sintaks JS + pola kode bermasalah. */
const fs = require('fs');
const { execFileSync } = require('child_process');

const files = ['js/app.js', 'js/data.js', 'scripts/build.js', 'scripts/lint.js', 'tests/skinmatch.test.js'];
let errors = 0;

for (const f of files) {
  if (!fs.existsSync(f)) { console.error(`✗ ${f} tidak ditemukan`); errors++; continue; }
  try {
    execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });   // cek sintaks
  } catch (e) {
    console.error(`✗ Kesalahan sintaks pada ${f}\n${e.stderr}`); errors++; continue;
  }
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  lines.forEach((ln, i) => {
    const isComment = /^\s*(\/\/|\*|\/\*)/.test(ln);
    if (/\bdebugger\b/.test(ln) && !isComment && f !== 'scripts/lint.js') { console.error(`✗ ${f}:${i + 1} memakai 'debugger'`); errors++; }
    if (/\beval\s*\(/.test(ln) && !isComment && f !== 'scripts/lint.js') { console.error(`✗ ${f}:${i + 1} memakai eval()`); errors++; }
  });
  console.log(`✓ ${f}`);
}
if (errors) { console.error(`\nLint gagal: ${errors} masalah.`); process.exit(1); }
console.log('\nLint lulus.');
