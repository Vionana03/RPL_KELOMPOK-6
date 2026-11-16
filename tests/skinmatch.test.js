/* Unit test SkinMatch: menguji Rule-Based Engine (recommend) dan Ingredient Conflict Detector (conflictCheck).
   app.js ditulis untuk browser, sehingga dimuat di Node memakai modul vm dengan stub localStorage/document/window. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadApp() {
  const store = new Map();
  const el = () => new Proxy(function () {}, {
    get: (t, k) => k === 'classList' ? { add() {}, remove() {} } : k === 'style' ? {} : k === 'dataset' ? {} : el(),
    set: () => true,
    apply: () => el()
  });
  const sandbox = {
    console, setTimeout, clearTimeout, structuredClone,
    localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k), clear: () => store.clear() },
    document: { querySelector: () => el(), getElementById: () => null, createElement: () => el(), addEventListener() {} },
    window: { addEventListener() {}, scrollTo() {}, AudioContext: undefined },
    location: { hash: '' },
    Html5Qrcode: function () {},
    confirm: () => true
  };
  sandbox.window.localStorage = sandbox.localStorage;
  vm.createContext(sandbox);
  for (const f of ['js/data.js', 'js/app.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), sandbox, { filename: f });
  }
  vm.runInContext('globalThis.__api = { recommend, conflictCheck, avg, rp, db, SEED }', sandbox);
  return sandbox.__api;
}

const api = loadApp();
const P = id => api.db.products.find(p => p.id === id);

/* ---------- Ingredient Conflict Detector ---------- */
test('conflictCheck: Retinol (P4) bentrok dengan AHA (P6)', () => {
  const r = api.conflictCheck(P('P4'), [P('P6')]);
  assert.ok(r.some(x => x.a === 'Retinol' && x.b === 'AHA'), 'konflik Retinol–AHA harus terdeteksi');
});

test('conflictCheck: konflik berlaku dua arah', () => {
  const ab = api.conflictCheck(P('P4'), [P('P6')]).length;
  const ba = api.conflictCheck(P('P6'), [P('P4')]).length;
  assert.ok(ab > 0 && ba > 0);
});

test('conflictCheck: produk aman tidak menghasilkan konflik (Cleanser vs Moisturizer)', () => {
  assert.equal(api.conflictCheck(P('P1'), [P('P5')]).length, 0);
});

test('conflictCheck: bahan yang sama bukan konflik (Niacinamide P2 vs P3)', () => {
  const r = api.conflictCheck(P('P2'), [P('P3')]);
  assert.ok(!r.some(x => x.a === x.b));
});

test('conflictCheck: Benzoyl Peroxide (P7) bentrok dengan Retinol (P4)', () => {
  const r = api.conflictCheck(P('P7'), [P('P4')]);
  assert.ok(r.some(x => x.a === 'Benzoyl Peroxide' && x.b === 'Retinol'));
});

/* ---------- Rule-Based Engine ---------- */
test('recommend: profil kosong menghasilkan daftar kosong', () => {
  assert.equal(api.recommend(null).length, 0);
});

test('recommend: bahan yang dihindari (Fragrance) tidak pernah direkomendasikan', () => {
  const res = api.recommend({ type: 'Kering', concerns: ['Kulit Kering'], avoid: ['Fragrance'] });
  assert.ok(res.length > 0);
  assert.ok(res.every(r => !r.p.ingredients.includes('Fragrance')));
});

test('recommend: kulit Kering + Kulit Kering menempatkan Barrier Ceramide Cream (P5) di skor tertinggi', () => {
  const res = api.recommend({ type: 'Kering', concerns: ['Kulit Kering'], avoid: [] });
  const p5 = res.find(r => r.p.id === 'P5');
  assert.ok(p5, 'P5 harus direkomendasikan');
  assert.equal(p5.score, res[0].score);   // boleh seri dengan produk lain (mis. P1)
});

test('recommend: skor selalu di antara 0 dan 100 dan terurut menurun', () => {
  const res = api.recommend({ type: 'Berminyak', concerns: ['Jerawat', 'Pori Besar'], avoid: [] });
  res.forEach(r => assert.ok(r.score >= 0 && r.score <= 100));
  for (let i = 1; i < res.length; i++) assert.ok(res[i - 1].score >= res[i].score);
});

test('recommend: kulit Sensitif mendapat penalti untuk bahan berisiko tinggi', () => {
  const res = api.recommend({ type: 'Sensitif', concerns: ['Penuaan'], avoid: [] });
  assert.ok(!res.some(r => r.p.id === 'P4'), 'Night Retinol (Fragrance & Retinol berisiko tinggi) tidak boleh lolos untuk kulit Sensitif');
});

/* ---------- Integritas data & helper ---------- */
test('data: setiap bahan produk terdaftar di tabel bahan', () => {
  const names = new Set(api.db.ingredients.map(i => i.name));
  api.db.products.forEach(p => p.ingredients.forEach(n => assert.ok(names.has(n), `${p.name}: bahan "${n}" tidak terdaftar`)));
});

test('data: aturan konflik simetris (A bentrok B ⇒ B bentrok A)', () => {
  const by = Object.fromEntries(api.db.ingredients.map(i => [i.name, i]));
  api.db.ingredients.forEach(i => i.conflicts.forEach(c => assert.ok(by[c].conflicts.includes(i.name), `${i.name} ↔ ${c} tidak simetris`)));
});

test('data: barcode produk unik', () => {
  const codes = api.db.products.map(p => p.barcode);
  assert.equal(new Set(codes).size, codes.length);
});

test('helper: avg() menghitung rata-rata rating ulasan', () => {
  assert.equal(api.avg('P3'), 4);
  assert.equal(api.avg('P7'), 3);
  assert.equal(api.avg('TIDAK-ADA'), 0);
});

test('helper: rp() memformat rupiah', () => {
  assert.match(api.rp(89000), /^Rp89[.,]000$/);
});
