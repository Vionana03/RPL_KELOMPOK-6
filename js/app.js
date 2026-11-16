/* =====================================================================
   SKINMATCH – app.js
   Daftar isi:  1.Database & Profil  2.Helper & Scanner  3.Logika inti (Rule Engine & Conflict Detector)
                4.Tampilan halaman pelanggan  5.Tampilan halaman admin
                6.Aksi tombol & form  7.Router & Navbar
   ===================================================================== */

/* ========== 1. DATABASE & PROFIL (localStorage) ========== */
const DB_KEY = 'skinmatch_db_v1', ME_KEY = 'skinmatch_me', GUEST_KEY = 'skinmatch_guest_profile';
let db = JSON.parse(localStorage.getItem(DB_KEY) || 'null') || structuredClone(SEED);
let me = localStorage.getItem(ME_KEY);               // id pengguna yang login
const state = { q:'', cat:'', rtype:'', scanMode:'manual' }; // filter sementara & mode scan
const save = () => localStorage.setItem(DB_KEY, JSON.stringify(db));

// Pengelolaan profil kulit (mendukung tamu tanpa login & pelanggan yang login)
const getGuestProfile = () => {
  try { return JSON.parse(localStorage.getItem(GUEST_KEY) || 'null'); } catch(e) { return null; }
};
const setGuestProfile = pr => localStorage.setItem(GUEST_KEY, JSON.stringify(pr));
const getActiveProfile = () => user()?.profile || getGuestProfile();
const transferGuestProfileIfAny = u => {
  const gp = getGuestProfile();
  if (gp && !u.profile) {
    u.profile = gp;
    save();
  }
};

/* ========== 2. HELPER & SCANNER KAMERA ========== */
const $ = s => document.querySelector(s);
const rp = n => 'Rp' + Number(n).toLocaleString('id-ID');
const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 4);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const user = () => db.users.find(u => u.id === me);
const prod = id => db.products.find(p => p.id === id);
const ing  = name => db.ingredients.find(i => i.name === name);
const avg  = pid => { const r = db.reviews.filter(x => x.pid === pid); return r.length ? r.reduce((a, b) => a + b.rating, 0) / r.length : 0; };
const stars = n => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));
const tags = (arr, cls = '') => arr.map(t => `<span class="tag ${cls}">${esc(t)}</span>`).join('');
const go = h => { location.hash = '#/' + h; };
const cartOf = () => (db.carts[me] ||= []);
function toast(msg) { const d = document.createElement('div'); d.textContent = msg; $('#toast').append(d); setTimeout(() => d.remove(), 2800); }
function openModal(html) { $('#modal').innerHTML = `<div class="card">${html}</div>`; $('#modal').classList.remove('hidden'); }
function closeModal() { $('#modal').classList.add('hidden'); $('#modal').innerHTML = ''; }
const riskTag = r => `<span class="tag ${r === 'Tinggi' ? 'red' : r === 'Sedang' ? 'blue' : 'ok'}">Risiko ${r}</span>`;

// Audio feedback untuk scan barcode kamera
function playBeepSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.16);
  } catch(e) {}
}

// Pengendali Scanner Kamera (html5-qrcode)
let html5QrScanner = null;
let camerasList = [];
let currentCamIdx = 0;

function stopScanner() {
  if (html5QrScanner) {
    try {
      if (html5QrScanner.isScanning) {
        html5QrScanner.stop().catch(() => {});
      }
    } catch(e) {}
  }
  const btnStart = $('#btn-start-camera'), btnStop = $('#btn-stop-camera'), btnSwitch = $('#btn-switch-camera');
  if (btnStart) btnStart.style.display = 'inline-flex';
  if (btnStop) btnStop.style.display = 'none';
  if (btnSwitch) btnSwitch.style.display = 'none';
}

function startScanner(cameraIdOrFacing) {
  stopScanner();
  const readerEl = $('#reader');
  if (!readerEl) return;
  readerEl.innerHTML = '<div style="color:#fff;padding:50px 16px;text-align:center"><div class="scanner-spinner"></div><p style="font-size:0.92rem;color:var(--rose)">Menghubungkan ke kamera...</p></div>';

  if (!window.Html5Qrcode) {
    readerEl.innerHTML = '<div style="color:#fff;padding:30px 16px;text-align:center"><p style="color:var(--pink)">Modul kamera scanner tidak ditemukan. Gunakan tab Ketik ID Barcode.</p></div>';
    return;
  }

  if (!html5QrScanner) {
    html5QrScanner = new Html5Qrcode("reader");
  }

  const config = {
    fps: 15,
    qrbox: (w, h) => {
      const min = Math.min(w, h);
      return { width: Math.floor(min * 0.85), height: Math.floor(min * 0.6) };
    },
    aspectRatio: 1.333333
  };

  const onSuccess = (decodedText) => {
    playBeepSound();
    toast(`✓ Barcode berhasil dipindai: ${decodedText}`);
    stopScanner();
    processBarcode(decodedText);
  };

  const onError = () => {};

  Html5Qrcode.getCameras().then(devices => {
    camerasList = devices || [];
    let cam = cameraIdOrFacing;
    if (!cam) {
      if (camerasList.length > 0) {
        currentCamIdx = camerasList.length - 1;
        cam = camerasList[currentCamIdx].id;
      } else {
        cam = { facingMode: "environment" };
      }
    }
    return html5QrScanner.start(cam, config, onSuccess, onError);
  }).then(() => {
    const btnStart = $('#btn-start-camera'), btnStop = $('#btn-stop-camera'), btnSwitch = $('#btn-switch-camera');
    if (btnStart) btnStart.style.display = 'none';
    if (btnStop) btnStop.style.display = 'inline-flex';
    if (btnSwitch && camerasList.length > 1) btnSwitch.style.display = 'inline-flex';
  }).catch(err => {
    readerEl.innerHTML = `
      <div style="color:#fff;padding:30px 16px;text-align:center">
        <p style="font-weight:700;color:var(--pink);margin-bottom:8px">⚠️ Kamera Belum Diizinkan / Tidak Ditemukan</p>
        <p style="font-size:0.86rem;color:#fcdde2;line-height:1.5">Pastikan browser mengizinkan akses kamera, atau gunakan opsi <b>Ketik ID Barcode</b> di atas.</p>
        <button type="button" class="btn sm" style="margin-top:14px" data-act="startCamera">🔄 Coba Akses Lagi</button>
      </div>`;
  });
}

function switchCamera() {
  if (camerasList.length > 1) {
    currentCamIdx = (currentCamIdx + 1) % camerasList.length;
    startScanner(camerasList[currentCamIdx].id);
  }
}

// Logika pemrosesan barcode (dipakai scan kamera maupun ketik manual)
function processBarcode(rawCode) {
  const code = String(rawCode || '').trim();
  const p = db.products.find(x => x.barcode === code);
  const out = $('#scanOut');
  if (!out) return;

  if (!p) {
    out.innerHTML = `
      <div class="card conflict" style="background:var(--burgundy);color:#fff">
        <h4 style="color:#fff">ID Barcode Tidak Ditemukan: ${esc(code)}</h4>
        <p style="font-size:0.9rem;margin-top:6px">Kode ini belum terdaftar di database SkinMatch. Coba salah satu contoh produk di atas atau cek kembali kode barcode.</p>
      </div>`;
    out.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return;
  }

  const prof = getActiveProfile();
  const avoid = prof?.avoid || [];
  const warn = p.ingredients.filter(n => avoid.includes(n) || ing(n)?.risk === 'Tinggi');
  const isSensitifRisk = prof?.type === 'Sensitif' && p.ingredients.some(n => ing(n)?.risk === 'Tinggi');

  out.innerHTML = `
    <article class="card scan-result-card" style="border:2px solid var(--silver);background:#fff;margin-top:10px">
      <div class="row between" style="margin-bottom:12px;border-bottom:1px solid var(--rose);padding-bottom:10px">
        <span class="tag blue" style="font-size:0.82rem">✓ Barcode Terverifikasi: <b>${esc(p.barcode)}</b></span>
        <button class="btn ghost sm" data-act="resetScan" title="Tutup hasil">✕ Bersihkan Hasil</button>
      </div>
      <div class="row" style="align-items:flex-start;gap:18px">
        <div style="width:120px;flex-shrink:0">${imgBox(p)}</div>
        <div style="flex:1">
          <span class="muted">${esc(p.brand)} · ${esc(p.category)}</span>
          <h3 style="font-size:1.35rem;margin:2px 0 4px">${esc(p.name)}</h3>
          <p class="price">${rp(p.price)}</p>
          <div class="star" style="margin-top:4px">${stars(avg(p.id))} <span class="muted">${avg(p.id) ? avg(p.id).toFixed(1) : 'Belum ada ulasan'} · Stok: ${p.stock}</span></div>
          <div style="margin-top:6px">${tags(p.skinTypes.length > 4 ? ['Semua kulit'] : p.skinTypes, 'blue')}</div>
        </div>
      </div>

      <h4 style="margin:18px 0 8px;color:var(--burgundy);border-top:1px dashed var(--rose);padding-top:12px">Analisis Kandungan Bahan Aktif:</h4>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${p.ingredients.map(n => {
          const item = ing(n);
          return `<div style="padding:8px 12px;background:#fdf7f8;border-radius:10px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
            <div><b>${esc(n)}</b> <small class="muted">— ${esc(item?.info || '')}</small></div>
            <div>${riskTag(item?.risk || 'Rendah')}</div>
          </div>`;
        }).join('')}
      </div>

      <div style="margin-top:14px">
        ${warn.length ? warn.map(n => `
          <div class="conflict">
            ⚠️ <b>${esc(n)}</b>: ${avoid.includes(n) ? 'termasuk dalam daftar bahan yang kamu hindari!' : 'memiliki tingkat risiko iritasi tinggi.'}
          </div>
        `).join('') : '<div class="safe">✓ Aman! Tidak ada bahan berisiko tinggi atau bahan yang kamu hindari.</div>'}
        ${isSensitifRisk ? '<div class="conflict">⚠️ Perhatian: Kulitmu Sensitif, disarankan uji oles (patch test) sebelum pemakaian penuh.</div>' : ''}
      </div>

      <div class="row between" style="margin-top:18px;padding-top:14px;border-top:1px solid var(--rose)">
        <button class="btn ghost sm" data-act="detail" data-id="${p.id}">Lihat Detail &amp; Ulasan Komunitas</button>
        ${user()?.role === 'customer' || !user() ? `<button class="btn sm" data-act="add" data-id="${p.id}">+ Tambah ke Keranjang</button>` : ''}
      </div>
    </article>
  `;
  out.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ========== 3. LOGIKA INTI ========== */

/* --- 3a. Rule-Based Engine: skor kecocokan produk dengan profil kulit --- */
function recommend(profile) {
  if (!profile) return [];
  return db.products.map(p => {
    const why = [], avoided = p.ingredients.filter(i => (profile.avoid || []).includes(i));
    let score = 0;
    if (p.skinTypes.includes(profile.type)) { score += 40; why.push('Cocok untuk kulit ' + profile.type); }          // aturan 1: tipe kulit
    const hit = p.concerns.filter(c => (profile.concerns || []).includes(c));
    score += Math.min(hit.length * 20, 40); if (hit.length) why.push('Membantu: ' + hit.join(', '));                // aturan 2: masalah kulit
    score += avg(p.id) * 4;                                                                                         // aturan 3: rating komunitas
    const highRisk = p.ingredients.filter(i => ing(i)?.risk === 'Tinggi' && profile.type === 'Sensitif');           // aturan 4: kulit sensitif
    if (highRisk.length) { score -= 30; why.push('Perhatian: bahan berisiko tinggi (' + highRisk.join(', ') + ')'); }
    return { p, score: Math.max(0, Math.min(100, Math.round(score))), why, avoided };
  }).filter(r => !r.avoided.length && r.score >= 40)                                                                // aturan 5: buang bahan yang dihindari
    .sort((a, b) => b.score - a.score);
}

/* --- 3b. Ingredient Conflict Detector: bandingkan produk baru dengan isi keranjang --- */
function conflictCheck(newProd, otherProds) {
  const out = [];
  otherProds.forEach(o => newProd.ingredients.forEach(a => o.ingredients.forEach(b => {
    const A = ing(a), B = ing(b);
    if (A && B && a !== b && (A.conflicts.includes(b) || B.conflicts.includes(a))) out.push({ a, b, with: o.name });
  })));
  return out;
}

/* ========== 4. TAMPILAN PELANGGAN ========== */
function imgBox(p) {   // gambar produk; jika file belum ada tampil ikon pengganti
  return `<div class="pimg">🧴<img src="images/${esc(p.img)}" alt="${esc(p.name)}" loading="lazy" onerror="this.remove()"></div>`;
}
function productCard(p, extra = '') {
  const a = avg(p.id);
  return `<article class="card">${imgBox(p)}
    <span class="muted">${esc(p.brand)} · ${esc(p.category)}</span>
    <h3>${esc(p.name)}</h3>
    <div class="star">${stars(a)} <span class="muted">${a ? a.toFixed(1) : 'Belum ada ulasan'}</span></div>
    <div>${tags(p.skinTypes.length > 4 ? ['Semua kulit'] : p.skinTypes, 'blue')}</div>
    <div class="row between" style="margin-top:10px"><span class="price">${rp(p.price)}</span>${extra}</div>
    <div class="row" style="margin-top:10px">
      <button class="btn ghost sm" data-act="detail" data-id="${p.id}">Detail</button>
      ${user()?.role === 'customer' || !user() ? `<button class="btn sm" data-act="add" data-id="${p.id}">+ Keranjang</button>` : ''}
    </div></article>`;
}

// Template komponen Form Kuis (dipakai di Beranda dan Halaman Kuis)
function quizFormContent(pr) {
  const p = pr || { type: '', concerns: [], avoid: [] };
  const chk = (name, opts, sel) => `<div class="chips">${opts.map(o => `<label class="chip"><input type="checkbox" name="${name}" value="${esc(o)}" ${(sel || []).includes(o) ? 'checked' : ''}>${esc(o)}</label>`).join('')}</div>`;
  return `
    <label class="lbl">1. Apa tipe kulitmu?</label>
    <div class="chips">${SKIN_TYPES.map(t => `<label class="chip"><input type="radio" name="type" value="${t}" ${p.type === t ? 'checked' : ''} required>${t}</label>`).join('')}</div>
    <label class="lbl">2. Apa masalah utama kulitmu? (bisa pilih lebih dari satu)</label>${chk('concerns', CONCERNS, p.concerns)}
    <label class="lbl">3. Bahan apa yang ingin kamu hindari?</label>${chk('avoid', db.ingredients.map(i => i.name), p.avoid)}
    <button class="btn" style="margin-top:20px;font-size:1rem;padding:12px 28px">✨ Simpan &amp; Lihat Rekomendasi Produk</button>
  `;
}

// Komponen Hubungi Kami & Dark Footer SkinMatch (ditempatkan di beranda paling bawah)
function contactSection() {
  return `
  <section class="contact-wrapper" id="kontak">
    <div class="contact-header">
      <h2>Hubungi Kami</h2>
      <div class="contact-underline"></div>
    </div>

    <div class="contact-grid">
      <!-- Kolom Kiri: Informasi Kontak -->
      <div class="contact-info-col">
        <h3>Informasi Kontak</h3>
        <p class="contact-desc">Kami siap melayani kebutuhan konsultasi produk skincare, keluhan, rekomendasi dan informasi bahan aktif 24 jam sehari.</p>

        <div class="contact-btn-list">
          <!-- Tombol WhatsApp -->
          <a href="https://wa.me/6281241277050" target="_blank" rel="noopener" class="contact-btn contact-wa">
            <div class="contact-btn-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.698c.969.586 1.761.884 2.796.885 3.182 0 5.768-2.587 5.769-5.766 0-3.18-2.587-5.772-5.769-5.772zm3.397 8.257c-.144.405-.837.774-1.17.824-.312.045-.634.072-1.859-.441-1.393-.583-2.317-1.954-2.387-2.048-.07-.094-.57-.76-.57-1.448 0-.689.36-1.028.49-1.171.13-.144.284-.18.378-.18.095 0 .19.001.272.006.088.005.205-.033.32.245.12.289.41 1.002.446 1.075.036.073.06.158.01.254-.05.096-.075.156-.15.244-.075.088-.158.196-.226.264-.075.075-.153.157-.066.306.087.148.387.638.83 1.033.57.508 1.05.666 1.199.74.149.074.236.062.324-.039.088-.1.378-.441.479-.592.1-.151.201-.126.338-.076.137.05.867.409 1.015.483.149.074.248.111.285.174.037.063.037.368-.107.773zM12 2C6.477 2 2 6.477 2 12c0 1.891.524 3.662 1.435 5.177L2 22l4.981-1.398A9.957 9.957 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/></svg>
            </div>
            <div class="contact-btn-text">
              <span class="contact-btn-label">Whatsapp Admin</span>
              <span class="contact-btn-main">+62 812-4127-7050</span>
            </div>
          </a>

          <!-- Tombol Instagram -->
          <a href="https://instagram.com/skinmatch" target="_blank" rel="noopener" class="contact-btn contact-ig">
            <div class="contact-btn-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
            </div>
            <div class="contact-btn-text">
              <span class="contact-btn-label">Instagram Kami</span>
              <span class="contact-btn-main">@skinmatch</span>
            </div>
          </a>

          <!-- Tombol TikTok -->
          <a href="https://tiktok.com/@skinmatch_" target="_blank" rel="noopener" class="contact-btn contact-tiktok">
            <div class="contact-btn-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64c.298-.002.595.042.88.13V9.4a6.33 6.33 0 00-1-.08A6.34 6.34 0 003 15.66a6.34 6.34 0 0010.86 4.46V12.9a8.28 8.28 0 005.73 2.27V11.7a4.83 4.83 0 01-3.77-1.24z"/></svg>
            </div>
            <div class="contact-btn-text">
              <span class="contact-btn-label">Tiktok Kami</span>
              <span class="contact-btn-main">@skinmatch_</span>
            </div>
          </a>
        </div>
      </div>

      <!-- Kolom Kanan: Lokasi Kami -->
      <div class="contact-map-col">
        <h3>Lokasi Kami</h3>
        <div class="contact-map-wrap">
          <a href="https://maps.google.com/?q=Universitas+Tadulako,+Palu" target="_blank" rel="noopener" class="contact-map-badge">
            Buka di Maps ↗
          </a>
          <iframe
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3989.3149814421115!2d119.89381677496515!3d-0.8344686991575205!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2d8befc44d156ff7%3A0x6b107e3ecad8779b!2sUniversitas%20Tadulako!5e0!3m2!1sid!2sid!4v1710000000000!5m2!1sid!2sid"
            loading="lazy" referrerpolicy="no-referrer-when-downgrade">
          </iframe>
        </div>
      </div>
    </div>
  </section>

  <!-- Dark Footer SkinMatch Sesuai Desain -->
  <footer class="contact-footer">
    <div class="contact-footer-grid">
      <!-- Kolom 1 -->
      <div>
        <div class="contact-footer-brand">Skin<span>Match</span></div>
        <p class="contact-footer-desc">Platform kecerdasan buatan &amp; rule-based engine perawatan kulit terpercaya yang membantu Anda menemukan produk tepat tanpa risiko iritasi dan benturan bahan aktif.</p>
      </div>

      <!-- Kolom 2 -->
      <div>
        <h4>Navigasi Pintar</h4>
        <ul class="contact-footer-links">
          <li><a href="#/">Beranda Utama</a></li>
          <li><a href="#/produk">Katalog Produk</a></li>
          <li><a href="#quiz-home" data-act="goQuiz">Kuis Profil Kulit</a></li>
          <li><a href="#kontak" data-act="goContact">Hubungi Kami</a></li>
        </ul>
      </div>

      <!-- Kolom 3 -->
      <div>
        <h4>Kantor Pusat</h4>
        <div class="contact-footer-address">
          <div class="addr-line">
            <span class="addr-icon">📍</span>
            <span>Jl. Soekarno-Hatta Km. 9, Kampus Bumi Tadulako Tondo, Kota Palu, Sulawesi Tengah</span>
          </div>
          <div class="addr-line" style="margin-top:10px">
            <span class="addr-icon">✉️</span>
            <a href="mailto:support@skinmatch.id" style="color:#38bdf8;text-decoration:none">support@skinmatch.id</a>
          </div>
        </div>
      </div>
    </div>

    <div class="contact-footer-bottom">
      © 2026 SkinMatch Indonesia. Hak Cipta Dilindungi Kelompok 6 · Universitas Tadulako.
    </div>
  </footer>
  `;
}

const V = {};   // V = kumpulan halaman. Nama = alamat (#/nama)

V.home = () => {
  const u = user();
  const pr = getActiveProfile();

  const featureList = [
    { icon: '📝', title: 'Skin Profile Quiz', desc: 'Tentukan tipe kulit, masalah utama, dan bahan yang dihindari.', href: '#quiz-home' },
    { icon: '🎯', title: 'Rekomendasi Produk', desc: 'Rule-Based Engine memberi skor kecocokan tiap produk.', href: '#/rekomendasi' },
    { icon: '💬', title: 'Ulasan Komunitas', desc: 'Baca ulasan dari pengguna dengan kulit serupa.', href: '#/ulasan' },
    { icon: '📷', title: 'Scan Barcode', desc: 'Cek kandungan dan peringatan iritasi secara langsung via kamera atau ketik ID.', href: '#/scan' },
    { icon: '🛡️', title: 'Validasi Keranjang', desc: 'Bahan aktif yang bertentangan ditolak otomatis oleh Conflict Detector.', href: '#/keranjang' },
    { icon: '🛍️', title: 'Belanja & Riwayat', desc: 'Checkout aman dan riwayat pembelian transparan.', href: u ? '#/riwayat' : '#/produk' }
  ];

  return `
    <section class="hero">
      <div>
        <h1>Skincare yang cocok untuk kulitmu, bukan sekadar yang populer.</h1>
        <p>Isi kuis singkat langsung di bawah ini tanpa perlu login! Dapatkan rekomendasi produk terpersonalisasi, scan barcode lewat kamera, dan biarkan Conflict Detector mencegah bahan aktif yang bentrok.</p>
        <div class="row">
          <a class="btn" href="#quiz-home" data-act="goQuiz">Mulai Kuis Kulit (Gratis)</a>
          <a class="btn ghost" href="#/produk">Lihat Produk</a>
          ${u ? `<a class="btn ghost" href="#/scan">Scan Barcode</a>` : ''}
        </div>
      </div>
      <div class="hero-art">
        <h3>Bahan ini tidak boleh bertemu</h3>
        <p style="margin:10px 0">Saat produk ditambahkan ke keranjang, SkinMatch langsung membandingkan bahan aktifnya.</p>
        ${tags(['Retinol', 'AHA', 'Vitamin C', 'Benzoyl Peroxide'])}
        <p style="margin-top:12px">Konflik terdeteksi → produk ditolak otomatis agar kulitmu tetap aman.</p>
      </div>
    </section>

    <!-- Bagian Yang Bisa Kamu Lakukan (Dapat Ditekan Sesuai Fitur) -->
    <div style="margin-top:40px">
      <h2>Yang bisa kamu lakukan</h2>
      <p class="muted">Pilih fitur di bawah untuk langsung mencoba fungsionalitas SkinMatch:</p>
      <div class="grid">
        ${featureList.map(f => `
          <a class="card feature-card" href="${f.href}" ${f.href.startsWith('#quiz') ? 'data-act="goQuiz"' : ''}>
            <div>
              <div style="font-size:2.2rem;margin-bottom:8px">${f.icon}</div>
              <h3>${f.title}</h3>
              <p class="muted" style="margin-top:6px;font-size:0.9rem">${f.desc}</p>
            </div>
            <div class="feature-action">Buka fitur <span>→</span></div>
          </a>
        `).join('')}
      </div>
    </div>

    <!-- Bagian Kuis di Beranda (Bisa Diisi Langsung Tanpa Perlu Login) -->
    <section class="quiz-home-box" id="quiz-home">
      <span class="quiz-home-badge">✨ Kuis Cepat &amp; Gratis · Tanpa Perlu Login</span>
      <h2>Skin Profile Quiz Langsung di Sini</h2>
      <p class="muted">Tentukan tipe kulit, masalah utama, dan bahan yang dihindari. Rekomendasi produk dengan skor kecocokan akan langsung dibuat untukmu!</p>
      ${pr ? `<div class="safe" style="margin:14px 0">✓ Profil kulit aktif: <b>Kulit ${esc(pr.type)}</b> ${pr.concerns?.length ? `· Masalah: ${esc(pr.concerns.join(', '))}` : ''} ${pr.avoid?.length ? `· Hindari: ${esc(pr.avoid.join(', '))}` : ''}. Kamu bisa memperbaruinya kapan saja dengan mengisi form di bawah:</div>` : ''}
      <form data-form="quiz" style="margin-top:16px">
        ${quizFormContent(pr)}
      </form>
    </section>

    <!-- Produk Pilihan -->
    <h2 style="margin-top:42px">Produk pilihan</h2>
    <div class="grid">${db.products.slice(0, 4).map(p => productCard(p)).join('')}</div>

    <!-- Fitur Hubungi Kami & Footer SkinMatch di Beranda Paling Bawah -->
    ${contactSection()}
  `;
};

V.login = () => `<div class="card auth">
  <div class="tabs"><button class="btn sm" data-act="tab" data-id="in">Masuk</button><button class="btn ghost sm" data-act="tab" data-id="up">Daftar</button></div>
  <form data-form="login" id="f-in"><h2>Masuk</h2>
    <label class="lbl">Email<input name="email" type="email" required></label>
    <label class="lbl">Kata sandi<input name="password" type="password" required></label>
    <button class="btn" style="margin-top:16px">Masuk</button>
    <p class="muted" style="margin-top:12px">Demo – Admin: admin@skinmatch.id / admin123<br>Pelanggan: sari@mail.com / sari123</p></form>
  <form data-form="register" id="f-up" hidden><h2>Daftar pelanggan</h2>
    <label class="lbl">Nama<input name="name" required></label>
    <label class="lbl">Email<input name="email" type="email" required></label>
    <label class="lbl">Kata sandi<input name="password" type="password" minlength="6" required></label>
    <button class="btn" style="margin-top:16px">Buat akun</button></form></div>`;

V.quiz = () => {
  const pr = getActiveProfile();
  return `<form class="card" data-form="quiz" style="max-width:760px;margin:auto">
    <span class="quiz-home-badge">✨ Kuis Mandiri</span>
    <h2>Skin Profile Quiz</h2>
    <p class="muted">Jawabanmu menjadi dasar Rule-Based Engine dalam mencocokkan produk skincare.</p>
    ${quizFormContent(pr)}
  </form>`;
};

V.rekomendasi = () => {
  const pr = getActiveProfile();
  if (!pr) return `<div class="card" style="max-width:680px;margin:auto;text-align:center">
    <h2>Profil kulit belum diisi</h2>
    <p class="muted" style="margin:12px 0 20px">Isi kuis singkat profil kulit terlebih dahulu agar sistem dapat menghitung skor kecocokan produk.</p>
    <a class="btn" href="#quiz-home">Mulai Kuis Sekarang</a>
  </div>`;
  const res = recommend(pr);
  return `
    <div class="recom-header-box">
      <div class="row between">
        <div>
          <h2>Rekomendasi Skincare untuk Kulitmu</h2>
          <p class="muted">Dihitung otomatis oleh Rule-Based Engine berdasarkan jenis kulit, masalah utama, dan keamanan bahan aktif.</p>
        </div>
        <a class="btn ghost sm" href="#/quiz">Ubah Profil Kuis</a>
      </div>
      <div class="recom-profile-summary">
        <span class="muted" style="font-weight:700">Profil Kulit Aktif:</span>
        <span class="tag blue">Kulit ${esc(pr.type)}</span>
        ${(pr.concerns || []).length ? pr.concerns.map(c => `<span class="tag">${esc(c)}</span>`).join('') : '<span class="tag">Masalah Umum</span>'}
        ${(pr.avoid || []).length ? `<span class="tag red">Hindari: ${esc(pr.avoid.join(', '))}</span>` : ''}
      </div>
    </div>

    ${res.length ? `
      <div class="row between" style="margin-bottom:8px">
        <span class="muted" style="font-weight:700">Ditemukan ${res.length} produk dengan kecocokan tertinggi untuk kulitmu:</span>
      </div>
      <div class="recom-grid">
        ${res.map((r, idx) => {
          const p = r.p;
          const a = avg(p.id);
          return `
            <article class="recom-card">
              <div>
                <div class="recom-badge-top">
                  <div>
                    <span class="tag" style="background:var(--rose);color:var(--burgundy);font-weight:800">#${idx + 1} Rekomendasi</span>
                    <span class="muted" style="font-size:0.84rem;margin-left:4px">${esc(p.brand)} · ${esc(p.category)}</span>
                  </div>
                  <div class="recom-score-pill">
                    <span class="recom-score-val">${r.score}%</span>
                    <span class="recom-score-label">Kecocokan</span>
                  </div>
                </div>

                <div class="recom-bar" title="Tingkat kecocokan ${r.score}%">
                  <i style="width:${r.score}%"></i>
                </div>

                <div class="recom-product-info">
                  <div class="recom-img">
                    🧴<img src="images/${esc(p.img)}" alt="${esc(p.name)}" loading="lazy" onerror="this.remove()">
                  </div>
                  <div class="recom-details">
                    <h3>${esc(p.name)}</h3>
                    <div class="price">${rp(p.price)}</div>
                    <div class="star">${stars(a)} <span class="muted" style="font-size:0.82rem">${a ? a.toFixed(1) : 'Belum ada ulasan'}</span></div>
                    <div style="margin-top:6px">${tags(p.skinTypes.length > 4 ? ['Semua kulit'] : p.skinTypes, 'blue')}</div>
                  </div>
                </div>

                <div class="recom-why-box">
                  <div class="recom-why-title">Analisis Kecocokan Formulasi:</div>
                  ${r.why.map(w => `
                    <div class="recom-why-item">
                      <span class="chk">✓</span>
                      <span>${esc(w)}</span>
                    </div>
                  `).join('')}
                </div>

                <div class="recom-ingredients-box">
                  <span class="muted" style="font-size:0.8rem;font-weight:700;display:block;margin-bottom:4px">Kandungan Bahan Aktif:</span>
                  <div>
                    ${p.ingredients.map(n => `<span class="tag">${esc(n)}</span>`).join('')}
                  </div>
                </div>
              </div>

              <div class="recom-actions">
                <button class="btn ghost sm" data-act="detail" data-id="${p.id}">Detail Produk</button>
                ${user()?.role === 'customer' || !user() ? `<button class="btn sm" data-act="add" data-id="${p.id}">+ Keranjang</button>` : ''}
              </div>
            </article>
          `;
        }).join('')}
      </div>
    ` : `
      <div class="card" style="margin-top:16px;text-align:center;padding:36px">
        <h3>Belum ada produk yang cocok</h3>
        <p class="muted" style="margin:10px 0 16px">Semua produk saat ini memiliki bahan yang dihindari pada kuis atau skor di bawah batas minimal kecocokan.</p>
        <a class="btn sm" href="#/quiz">Ubah Kriteria Kuis</a>
      </div>
    `}
  `;
};

const prodGrid = () => {
  const q = state.q.toLowerCase(), list = db.products.filter(p => (!state.cat || p.category === state.cat) && (p.name + p.brand).toLowerCase().includes(q));
  return list.length ? list.map(p => productCard(p)).join('') : '<p class="muted">Produk tidak ditemukan.</p>';
};
V.produk = () => `<h2>Semua produk</h2><div class="row">
  <input style="max-width:280px" placeholder="Cari produk atau merek" data-filter="q" value="${esc(state.q)}">
  <select style="max-width:200px" data-filter="cat"><option value="">Semua kategori</option>${CATEGORIES.map(c => `<option ${state.cat === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
  <div class="grid" id="grid">${prodGrid()}</div>`;

V.scan = () => {
  const mode = state.scanMode || 'manual';
  return `
    <div class="card" style="max-width:760px;margin:auto">
      <h2>Scan &amp; Cek Kandungan Produk</h2>
      <p class="muted">Periksa bahan aktif, potensi iritasi, dan kecocokan dengan profil kulitmu langsung dari barcode produk.</p>

      <!-- 2 Pilihan Mode: Manual & Kamera -->
      <div class="scan-mode-tabs">
        <button type="button" class="btn ${mode === 'manual' ? '' : 'ghost'} sm" data-act="setScanMode" data-id="manual">
          ⌨️ 1. Ketik ID Barcode
        </button>
        <button type="button" class="btn ${mode === 'camera' ? '' : 'ghost'} sm" data-act="setScanMode" data-id="camera">
          📷 2. Scan dengan Kamera
        </button>
      </div>

      <!-- Pilihan 1: Masukkan ID Barcode Secara Manual -->
      <div id="scan-manual-panel" style="${mode === 'manual' ? '' : 'display:none'}">
        <p class="muted" style="font-size:0.92rem">Ketik ID / kode barcode produk, atau pilih dari contoh barcode di bawah:</p>
        <form data-form="scan" class="row" style="margin-top:10px">
          <input name="code" id="manual-code-input" placeholder="Contoh ID barcode: 8991001000004" style="flex:1" required>
          <button class="btn" type="submit">🔍 Cek Kandungan</button>
        </form>
        <div style="margin-top:16px">
          <span class="muted" style="font-size:0.85rem">Pilih contoh barcode cepat:</span>
          <div class="chips" style="margin-top:6px">
            ${db.products.map(p => `<button type="button" class="chip" data-act="sample" data-id="${p.barcode}">${esc(p.name)} <small style="color:var(--lapis)">(${p.barcode})</small></button>`).join('')}
          </div>
        </div>
      </div>

      <!-- Pilihan 2: Scan Menggunakan Kamera -->
      <div id="scan-camera-panel" style="${mode === 'camera' ? '' : 'display:none'}">
        <div class="camera-wrapper">
          <p style="text-align:center;font-size:0.92rem;color:var(--rose);margin-bottom:12px">
            Arahkan kamera ke barcode produk atau QR code. Pastikan pencahayaan cukup dan barcode berada di dalam kotak scanner.
          </p>
          <div id="reader"></div>
          <div class="row" style="justify-content:center;margin-top:16px;gap:10px">
            <button type="button" class="btn sm" id="btn-start-camera" data-act="startCamera">▶ Buka Kamera</button>
            <button type="button" class="btn ghost sm" id="btn-stop-camera" data-act="stopCamera" style="display:none;color:#fff;border-color:var(--pink)">⏹ Matikan Kamera</button>
            <button type="button" class="btn ghost sm" id="btn-switch-camera" data-act="switchCamera" style="display:none;color:#fff;border-color:var(--silver)">🔄 Ganti Kamera</button>
          </div>
          <div style="margin-top:14px;padding-top:12px;border-top:1px dashed rgba(242,174,188,0.3);text-align:center">
            <span style="font-size:0.85rem;color:var(--rose)">Alternatif: Scan dari file foto barcode</span>
            <label class="btn ghost sm" style="margin-left:8px;cursor:pointer;color:#fff;border-color:var(--rose)">
              📁 Pilih File Foto
              <input type="file" id="scan-file-input" accept="image/*" style="display:none">
            </label>
          </div>
        </div>
      </div>

      <!-- Wadah Output Hasil Scan -->
      <div id="scanOut" style="margin-top:20px"></div>
    </div>
  `;
};

const reviewItem = (r, showProd = true) => `<div class="review"><div class="row between"><b>${esc(r.name)} ${tags([r.skinType], 'blue')}</b><span class="star">${stars(r.rating)}</span></div>
  ${showProd ? `<small class="muted">${esc(prod(r.pid)?.name || 'Produk dihapus')} · ${r.date}</small><br>` : ''}${esc(r.comment)}</div>`;
const revGrid = () => {
  const list = db.reviews.filter(r => !state.rtype || r.skinType === state.rtype);
  return list.length ? list.map(r => reviewItem(r)).join('') : '<p class="muted">Belum ada ulasan untuk tipe kulit ini.</p>';
};
V.ulasan = () => { const u = user(); if (u?.profile && state.rtype === '' && !state._rset) { state.rtype = u.profile.type; state._rset = 1; }
  return `<h2>Ulasan komunitas</h2><p class="muted">Saring berdasarkan tipe kulit pengulas agar lebih relevan.</p>
  <select style="max-width:240px" data-filter="rtype"><option value="">Semua tipe kulit</option>${SKIN_TYPES.map(t => `<option ${state.rtype === t ? 'selected' : ''}>${t}</option>`).join('')}</select>
  <div id="grid" style="margin-top:14px">${revGrid()}</div>`; };

V.keranjang = () => {
  const cart = cartOf();
  if (!cart.length) return `<div class="card"><h2>Keranjang belanja</h2><p>Keranjang masih kosong. Tambahkan produk dari <a href="#/produk">katalog produk</a> atau coba simulasi bahan bertentangan.</p></div>`;
  const total = cart.reduce((s, c) => s + prod(c.pid).price * c.qty, 0);
  return `<h2>Keranjang</h2><div class="safe">✓ Semua produk di keranjang sudah divalidasi aman digunakan bersama oleh Conflict Detector.</div>
  <div class="table-wrap"><table><tr><th>Produk</th><th>Harga</th><th>Jumlah</th><th>Subtotal</th><th></th></tr>
  ${cart.map(c => { const p = prod(c.pid); return `<tr><td><b>${esc(p.name)}</b><br>${tags(p.ingredients)}</td><td>${rp(p.price)}</td>
    <td><button class="btn ghost sm" data-act="qty" data-id="${p.id}" data-d="-1">−</button> ${c.qty} <button class="btn ghost sm" data-act="qty" data-id="${p.id}" data-d="1">+</button></td>
    <td>${rp(p.price * c.qty)}</td><td><button class="btn danger sm" data-act="rm" data-id="${p.id}">Hapus</button></td></tr>`; }).join('')}</table></div>
  <div class="row between card" style="margin-top:16px"><span class="stat">${rp(total)}</span><button class="btn" data-act="checkout">Checkout</button></div>`;
};

V.riwayat = () => {
  const list = db.orders.filter(o => o.uid === me).reverse();
  return `<h2>Riwayat pembelian</h2>${list.length ? list.map(o => `<div class="card" style="margin:14px 0"><div class="row between"><b>#${o.id}</b>${tags([o.status], 'blue')}</div>
    <p class="muted">${o.date} · ${esc(o.method)}</p>${o.items.map(i => `${esc(i.name)} × ${i.qty}`).join('<br>')}<p class="price" style="margin-top:8px">${rp(o.total)}</p></div>`).join('')
    : '<div class="card">Belum ada pembelian.</div>'}`;
};

V.kontak = () => contactSection();
V['hubungi-kami'] = V.kontak;

/* ========== 5. TAMPILAN ADMIN (CRUD) ========== */
const table = (heads, rows) => `<div class="table-wrap"><table><tr>${heads.map(h => `<th>${h}</th>`).join('')}</tr>${rows.join('')}</table></div>`;
const adminBtns = (edit, del, id) => `<td><div class="admin-row-actions"><button class="btn ghost sm" data-act="${edit}" data-id="${id}">Edit</button><button class="btn danger sm" data-act="${del}" data-id="${id}">Hapus</button></div></td>`;

V.admin = () => `<h2>Dashboard admin</h2><div class="grid">${[
  ['Produk', db.products.length, 'admin-produk'], ['Bahan aktif', db.ingredients.length, 'admin-bahan'],
  ['Ulasan', db.reviews.length, 'admin-ulasan'], ['Transaksi', db.orders.length, 'admin-transaksi']
].map(s => `<a class="card" href="#/${s[2]}" style="text-decoration:none"><div class="stat">${s[1]}</div><b>${s[0]}</b><div class="muted">Kelola →</div></a>`).join('')}</div>`;

V['admin-produk'] = () => `
  <div class="admin-topbar">
    <div>
      <h2>Kelola Produk</h2>
      <p class="muted">Daftar produk skincare, harga, stok, kode barcode, dan formulasi bahan aktif.</p>
    </div>
    <button class="btn btn-add" data-act="newP">
      <span class="btn-icon">➕</span> Tambah Produk Baru
    </button>
  </div>
  ${table(['Produk', 'Kategori', 'Harga', 'Stok', 'Barcode', 'Bahan', 'Aksi'], db.products.map(p => `<tr><td><b>${esc(p.name)}</b><br><span class="muted">${esc(p.brand)}</span></td><td>${p.category}</td><td>${rp(p.price)}</td><td>${p.stock}</td><td>${p.barcode}</td><td>${tags(p.ingredients)}</td>${adminBtns('editP', 'delP', p.id)}</tr>`))}`;

V['admin-bahan'] = () => `
  <div class="admin-topbar">
    <div>
      <h2>Bahan Aktif &amp; Aturan Konflik</h2>
      <p class="muted">Aturan keamanan formulasi dan pencegahan benturan bahan aktif (Conflict Detector).</p>
    </div>
    <button class="btn btn-add" data-act="newI">
      <span class="btn-icon">➕</span> Tambah Bahan Baru
    </button>
  </div>
  ${table(['Bahan', 'Risiko', 'Informasi', 'Bertentangan dengan', 'Aksi'], db.ingredients.map(i => `<tr><td><b>${esc(i.name)}</b></td><td>${riskTag(i.risk)}</td><td>${esc(i.info)}</td><td>${tags(i.conflicts, 'red') || '-'}</td>${adminBtns('editI', 'delI', i.id)}</tr>`))}`;

V['admin-ulasan'] = () => `
  <div class="admin-topbar">
    <div>
      <h2>Moderasi Ulasan</h2>
      <p class="muted">Tinjau dan kelola ulasan yang dikirimkan oleh pelanggan.</p>
    </div>
  </div>
  ${table(['Produk', 'Pengulas', 'Rating', 'Komentar', 'Aksi'], db.reviews.map(r => `<tr><td>${esc(prod(r.pid)?.name || '-')}</td><td>${esc(r.name)} ${tags([r.skinType], 'blue')}</td><td class="star">${stars(r.rating)}</td><td>${esc(r.comment)}</td>
  <td><div class="admin-row-actions"><button class="btn ghost sm" data-act="editR" data-id="${r.id}">Edit</button><button class="btn danger sm" data-act="delR" data-id="${r.id}">Hapus</button></div></td></tr>`))}`;

V['admin-transaksi'] = () => `
  <div class="admin-topbar">
    <div>
      <h2>Daftar Transaksi Pelanggan</h2>
      <p class="muted">Status pembayaran, alamat pengiriman, dan riwayat pesanan.</p>
    </div>
  </div>
  ${db.orders.length ? table(['ID', 'Pelanggan', 'Item', 'Total', 'Status', 'Aksi'], db.orders.slice().reverse().map(o => `<tr><td>#${o.id}<br><span class="muted">${o.date}</span></td><td>${esc(o.name)}</td><td>${o.items.map(i => `${esc(i.name)} × ${i.qty}`).join('<br>')}</td><td>${rp(o.total)}</td><td>${tags([o.status], 'blue')}</td>
  <td><div class="admin-row-actions"><button class="btn ghost sm" data-act="status" data-id="${o.id}">Ubah status</button><button class="btn danger sm" data-act="delO" data-id="${o.id}">Hapus</button></div></td></tr>`)) : '<div class="card">Belum ada transaksi.</div>'}`;

/* ========== 6. AKSI TOMBOL & FORM ========== */

/* --- 6a. Pembuat form modal generik (dipakai semua CRUD admin) --- */
function formModal(title, fields, vals, onSave) {
  const f = (x, v) => {
    if (x.t === 'checks') { v = v || []; return `<label class="lbl">${x.l}</label><div class="chips">${x.opts.map(o => `<label class="chip"><input type="checkbox" name="${x.k}" value="${esc(o)}" ${v.includes(o) ? 'checked' : ''}>${esc(o)}</label>`).join('')}</div>`; }
    if (x.t === 'select') return `<label class="lbl">${x.l}<select name="${x.k}">${x.opts.map(o => `<option ${o == v ? 'selected' : ''}>${o}</option>`).join('')}</select></label>`;
    if (x.t === 'area') return `<label class="lbl">${x.l}<textarea name="${x.k}" rows="3" required>${esc(v)}</textarea></label>`;
    return `<label class="lbl">${x.l}<input name="${x.k}" type="${x.t || 'text'}" value="${esc(v)}" ${x.t === 'number' ? 'min="0"' : ''} required></label>`;
  };
  openModal(`<form id="mf"><h3>${title}</h3>${fields.map(x => f(x, vals[x.k])).join('')}<div class="row end" style="margin-top:18px"><button type="button" class="btn ghost" data-act="close">Batal</button><button class="btn">Simpan</button></div></form>`);
  $('#mf').onsubmit = e => {
    e.preventDefault(); const fd = new FormData(e.target), o = {};
    fields.forEach(x => o[x.k] = x.t === 'checks' ? fd.getAll(x.k) : x.t === 'number' ? +fd.get(x.k) : fd.get(x.k));
    onSave(o); save(); closeModal(); render();
  };
}
const prodFields = () => [
  { k: 'name', l: 'Nama produk' }, { k: 'brand', l: 'Merek' }, { k: 'category', l: 'Kategori', t: 'select', opts: CATEGORIES },
  { k: 'price', l: 'Harga (Rp)', t: 'number' }, { k: 'stock', l: 'Stok', t: 'number' }, { k: 'barcode', l: 'Barcode / QR' },
  { k: 'img', l: 'Nama file gambar (di folder images/)' },
  { k: 'skinTypes', l: 'Cocok untuk tipe kulit', t: 'checks', opts: SKIN_TYPES }, { k: 'concerns', l: 'Membantu masalah', t: 'checks', opts: CONCERNS },
  { k: 'ingredients', l: 'Kandungan bahan', t: 'checks', opts: db.ingredients.map(i => i.name) }];
const ingFields = () => [{ k: 'name', l: 'Nama bahan' }, { k: 'risk', l: 'Risiko iritasi', t: 'select', opts: RISKS }, { k: 'info', l: 'Informasi bahan' },
  { k: 'conflicts', l: 'Bertentangan dengan', t: 'checks', opts: db.ingredients.map(i => i.name) }];

/* --- 6b. Aksi tombol (data-act="nama") --- */
const A = {
  close: closeModal,
  logout() { me = null; localStorage.removeItem(ME_KEY); go(''); render(); },
  tab(id) { $('#f-in').hidden = id !== 'in'; $('#f-up').hidden = id !== 'up'; },

  /* Navigasi Gulir Halus Beranda */
  goContact() {
    const raw = location.hash.replace(/^#\/?/, '');
    const isHome = !raw || raw === 'home' || raw === 'kontak';
    const target = document.getElementById('kontak');
    if (isHome && target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      history.replaceState(null, '', '#kontak');
      renderNav();
    } else {
      location.hash = '#kontak';
    }
  },
  goQuiz() {
    const raw = location.hash.replace(/^#\/?/, '');
    const isHome = !raw || raw === 'home' || raw === 'kontak';
    const q = document.getElementById('quiz-home');
    if (isHome && q) {
      q.scrollIntoView({ behavior: 'smooth', block: 'start' });
      history.replaceState(null, '', '#quiz-home');
      renderNav();
    } else {
      location.hash = '#quiz-home';
    }
  },
  
  /* Mode Scan: Ketik Manual vs Kamera */
  setScanMode(mode) {
    state.scanMode = mode;
    const manualPanel = $('#scan-manual-panel');
    const cameraPanel = $('#scan-camera-panel');
    const btns = document.querySelectorAll('.scan-mode-tabs .btn');
    if (mode === 'camera') {
      if (manualPanel) manualPanel.style.display = 'none';
      if (cameraPanel) cameraPanel.style.display = 'block';
      if (btns[0]) btns[0].classList.add('ghost');
      if (btns[1]) btns[1].classList.remove('ghost');
      startScanner();
    } else {
      stopScanner();
      if (cameraPanel) cameraPanel.style.display = 'none';
      if (manualPanel) manualPanel.style.display = 'block';
      if (btns[0]) btns[0].classList.remove('ghost');
      if (btns[1]) btns[1].classList.add('ghost');
    }
  },
  startCamera() { startScanner(); },
  stopCamera() { stopScanner(); },
  switchCamera() { switchCamera(); },
  resetScan() { const o = $('#scanOut'); if (o) o.innerHTML = ''; },
  sample(code) {
    const inp = $('#manual-code-input') || document.querySelector('[name=code]');
    if (inp) inp.value = code;
    processBarcode(code);
  },

  /* Cart Validation Engine */
  add(id) {
    const u = user();
    if (!u) { toast('Silakan masuk terlebih dahulu untuk berbelanja'); return go('login'); }
    if (u.role !== 'customer') return toast('Akun admin tidak dapat berbelanja');
    const p = prod(id), cart = cartOf(), cf = conflictCheck(p, cart.filter(c => c.pid !== id).map(c => prod(c.pid)));
    if (cf.length) return openModal(`<h3>Produk tidak bisa ditambahkan</h3><p class="muted" style="margin:6px 0">${esc(p.name)} berisiko bentrok dengan produk di keranjangmu:</p>
      ${cf.map(c => `<div class="conflict"><b>${esc(c.a)}</b> bertentangan dengan <b>${esc(c.b)}</b><br><small>pada ${esc(c.with)}</small></div>`).join('')}
      <div class="row end"><button class="btn" data-act="close">Mengerti</button></div>`);
    const it = cart.find(c => c.pid === id);
    if (it) { if (it.qty >= p.stock) return toast('Stok tidak cukup'); it.qty++; } else cart.push({ pid: id, qty: 1 });
    save(); toast('✓ Aman digunakan bersama. Ditambahkan ke keranjang.'); renderNav();
  },
  qty(id, el) { const c = cartOf().find(x => x.pid === id), d = +el.dataset.d; c.qty = Math.max(1, Math.min(prod(id).stock, c.qty + d)); save(); render(); },
  rm(id) { db.carts[me] = cartOf().filter(c => c.pid !== id); save(); render(); },
  checkout() {
    openModal(`<form id="co"><h3>Checkout</h3><label class="lbl">Alamat pengiriman<textarea name="addr" rows="2" required></textarea></label>
      <label class="lbl">Metode pembayaran<select name="method"><option>Transfer Bank</option><option>E-Wallet</option><option>COD</option></select></label>
      <div class="row end" style="margin-top:16px"><button type="button" class="btn ghost" data-act="close">Batal</button><button class="btn">Bayar sekarang</button></div></form>`);
    $('#co').onsubmit = e => {
      e.preventDefault(); const fd = new FormData(e.target), cart = cartOf();
      const items = cart.map(c => ({ pid: c.pid, name: prod(c.pid).name, price: prod(c.pid).price, qty: c.qty }));
      items.forEach(i => prod(i.pid).stock -= i.qty);
      db.orders.push({ id: 'T' + String(db.orders.length + 1).padStart(4, '0'), uid: me, name: user().name, items, total: items.reduce((s, i) => s + i.price * i.qty, 0),
        method: fd.get('method'), address: fd.get('addr'), status: 'Dibayar', date: new Date().toISOString().slice(0, 10) });
      db.carts[me] = []; save(); closeModal(); toast('✓ Pembayaran berhasil'); go('riwayat');
    };
  },
  detail(id) {
    const p = prod(id), prof = getActiveProfile(), rv = db.reviews.filter(r => r.pid === id).sort((a, b) => (b.skinType === prof?.type) - (a.skinType === prof?.type));
    openModal(`${imgBox(p)}<h3>${esc(p.name)}</h3><p class="muted">${esc(p.brand)} · ${p.category} · Stok ${p.stock} · Barcode ${p.barcode}</p>
      <p class="price">${rp(p.price)}</p><h4 style="margin-top:12px">Kandungan</h4>${p.ingredients.map(n => `${tags([n])} ${ing(n) ? riskTag(ing(n).risk) : ''}<br><small class="muted">${esc(ing(n)?.info || '')}</small><br>`).join('')}
      <h4 style="margin-top:14px">Ulasan (${rv.length})</h4>${rv.map(r => reviewItem(r, false)).join('') || '<p class="muted">Belum ada ulasan.</p>'}
      ${user()?.role === 'customer' ? `<form data-form="review" data-id="${id}"><label class="lbl">Tulis ulasan<select name="rating">${[5, 4, 3, 2, 1].map(n => `<option value="${n}">${stars(n)}</option>`).join('')}</select></label>
        <textarea name="comment" rows="2" placeholder="Bagaimana hasilnya di kulitmu?" required></textarea><button class="btn sm" style="margin-top:8px">Kirim ulasan</button></form>` : ''}
      <div class="row end" style="margin-top:12px"><button class="btn ghost" data-act="close">Tutup</button></div>`);
  },

  /* CRUD admin */
  newP() { formModal('Tambah produk baru', prodFields(), { category: 'Serum', img: 'cleanser.jpg', skinTypes: [], concerns: [], ingredients: [] }, o => db.products.push({ id: uid('P'), ...o })); },
  editP(id) { const p = prod(id); formModal('Edit produk', prodFields(), p, o => Object.assign(p, o)); },
  delP(id) { if (confirm('Hapus produk ini?')) { db.products = db.products.filter(p => p.id !== id); db.reviews = db.reviews.filter(r => r.pid !== id); save(); render(); } },
  newI() { formModal('Tambah bahan aktif baru', ingFields(), { risk: 'Rendah', conflicts: [] }, o => db.ingredients.push({ id: uid('I'), ...o })); },
  editI(id) { const i = db.ingredients.find(x => x.id === id), old = i.name; formModal('Edit bahan aktif', ingFields(), i, o => {
    Object.assign(i, o); if (old !== o.name) { db.products.forEach(p => p.ingredients = p.ingredients.map(n => n === old ? o.name : n)); db.ingredients.forEach(x => x.conflicts = x.conflicts.map(n => n === old ? o.name : n)); } }); },
  delI(id) { if (confirm('Hapus bahan ini?')) { const n = db.ingredients.find(i => i.id === id).name; db.ingredients = db.ingredients.filter(i => i.id !== id);
    db.ingredients.forEach(i => i.conflicts = i.conflicts.filter(c => c !== n)); db.products.forEach(p => p.ingredients = p.ingredients.filter(c => c !== n)); save(); render(); } },
  editR(id) { const r = db.reviews.find(x => x.id === id); formModal('Edit ulasan', [{ k: 'rating', l: 'Rating (1-5)', t: 'number' }, { k: 'comment', l: 'Komentar', t: 'area' }], r, o => Object.assign(r, o)); },
  delR(id) { if (confirm('Hapus ulasan ini?')) { db.reviews = db.reviews.filter(r => r.id !== id); save(); render(); } },
  status(id) { const o = db.orders.find(x => x.id === id), s = ['Dibayar', 'Dikemas', 'Dikirim', 'Selesai']; o.status = s[(s.indexOf(o.status) + 1) % s.length]; save(); render(); },
  delO(id) { if (confirm('Hapus transaksi ini?')) { db.orders = db.orders.filter(o => o.id !== id); save(); render(); } }
};

/* --- 6c. Form biasa (data-form="nama") --- */
const F = {
  login(_, fd) {
    const u = db.users.find(x => x.email === fd.get('email') && x.password === fd.get('password'));
    if (!u) return toast('Email atau kata sandi salah');
    me = u.id;
    localStorage.setItem(ME_KEY, me);
    transferGuestProfileIfAny(u);
    toast('Halo, ' + u.name);
    go(u.role === 'admin' ? 'admin' : (u.profile ? 'rekomendasi' : 'quiz'));
  },
  register(_, fd) {
    if (db.users.some(x => x.email === fd.get('email'))) return toast('Email sudah terdaftar');
    const u = { id: uid('U'), name: fd.get('name'), email: fd.get('email'), password: fd.get('password'), role: 'customer', profile: null };
    transferGuestProfileIfAny(u);
    db.users.push(u);
    save();
    me = u.id;
    localStorage.setItem(ME_KEY, me);
    toast('Akun berhasil dibuat!');
    go(u.profile ? 'rekomendasi' : 'quiz');
  },
  quiz(_, fd) {
    const profile = { type: fd.get('type'), concerns: fd.getAll('concerns'), avoid: fd.getAll('avoid') };
    const u = user();
    if (u) {
      u.profile = profile;
      save();
    } else {
      setGuestProfile(profile);
    }
    state._rset = 0; state.rtype = '';
    toast('✓ Profil kulit berhasil disimpan!');
    go('rekomendasi');
  },
  scan(_, fd) {
    processBarcode(fd.get('code'));
  },
  review(f, fd) {
    const u = user(), prof = getActiveProfile();
    db.reviews.push({ id: uid('R'), pid: f.dataset.id, uid: u.id, name: u.name, skinType: prof?.type || 'Normal', rating: +fd.get('rating'), comment: fd.get('comment'), date: new Date().toISOString().slice(0, 10) });
    save(); toast('✓ Ulasan terkirim'); A.detail(f.dataset.id);
  }
};

/* --- 6d. Pendengar event (satu untuk semua) --- */
document.addEventListener('click', e => {
  if (e.target.id === 'modal') return closeModal();
  const el = e.target.closest('[data-act]');
  if (el) {
    if (el.dataset.act === 'goContact' || el.dataset.act === 'goQuiz') {
      e.preventDefault();
    }
    A[el.dataset.act]?.(el.dataset.id, el);
  }
});
document.addEventListener('submit', e => { const h = F[e.target.dataset.form]; if (h) { e.preventDefault(); h(e.target, new FormData(e.target)); } });
document.addEventListener('input', e => { const k = e.target.dataset.filter; if (k) { state[k] = e.target.value; $('#grid').innerHTML = location.hash.includes('ulasan') ? revGrid() : prodGrid(); } });
document.addEventListener('change', e => {
  if (e.target.id === 'scan-file-input' && e.target.files && e.target.files[0]) {
    const file = e.target.files[0];
    if (!html5QrScanner) html5QrScanner = new Html5Qrcode("reader");
    stopScanner();
    html5QrScanner.scanFile(file, true)
      .then(decodedText => {
        playBeepSound();
        toast(`✓ Barcode dari gambar terbaca: ${decodedText}`);
        processBarcode(decodedText);
      })
      .catch(() => {
        toast('Foto tidak jelas atau barcode tidak terdeteksi. Coba foto lain.');
      });
  }
});

/* ========== 7. ROUTER & NAVBAR ========== */
const CUSTOMER_ONLY = ['keranjang', 'riwayat', 'ulasan', 'scan'];

function renderNav() {
  const u = user();
  const rawHash = location.hash.replace(/^#\/?/, '');
  const r = (location.hash === '#kontak' || rawHash === 'kontak' || rawHash === 'hubungi-kami') ? 'kontak' : (rawHash || 'home');
  const n = u ? cartOf().reduce((s, c) => s + c.qty, 0) : 0;
  const isHome = (r === '' || r === 'home');
  const isKontak = (r === 'kontak');

  const L = (h, t) => {
    let on = false;
    if (h === '' || h === 'home') on = isHome;
    else if (h === 'kontak') on = isKontak;
    else on = (r === h);
    const actAttr = (h === 'kontak') ? ' data-act="goContact"' : '';
    const hrefAttr = (h === 'kontak') ? '#kontak' : `#/${h}`;
    return `<a class="lk ${on ? 'on' : ''}" href="${hrefAttr}"${actAttr}>${t}</a>`;
  };

  let links = '';
  if (u?.role === 'admin') {
    // Mode Admin: tulisan saja tanpa ikon
    links = L('', 'Beranda')
      + L('admin', 'Dashboard')
      + L('admin-produk', 'Produk')
      + L('kontak', 'Hubungi Kami')
      + L('admin-bahan', 'Bahan')
      + L('admin-ulasan', 'Ulasan')
      + L('admin-transaksi', 'Transaksi');
  } else if (u?.role === 'customer') {
    // Mode Pelanggan saat sudah login: semua fitur dapat diakses, tulisan saja tanpa ikon
    links = L('', 'Beranda')
      + L('produk', 'Produk')
      + L('kontak', 'Hubungi Kami')
      + L('ulasan', 'Ulasan')
      + L('scan', 'Scan Barcode')
      + L('quiz', 'Kuis')
      + L('rekomendasi', 'Rekomendasi')
      + L('riwayat', 'Riwayat')
      + L('keranjang', `Keranjang${n ? `<span class="badge-n">${n}</span>` : ''}`);
  } else {
    // Tampilan beranda awal sebelum login:
    // Cukup (Beranda, Produk, Hubungi Kami) dan tombol Masuk di kanan, tulisan saja tanpa ikon
    links = L('', 'Beranda')
      + L('produk', 'Produk')
      + L('kontak', 'Hubungi Kami');
  }

  const auth = u
    ? `<span class="muted" style="margin-left:4px">${esc(u.name)}</span><button class="btn ghost sm" data-act="logout">Keluar</button>`
    : `<a class="btn sm" href="#/login">Masuk</a>`;

  $('#nav').innerHTML = `<a class="brand" href="#/">Skin<span>Match</span></a><div class="nav-right">${links}${auth}</div>`;
}

function render() {
  const rawHash = location.hash.replace(/^#\/?/, '');
  const r = (location.hash === '#kontak' || rawHash === 'kontak' || rawHash === 'hubungi-kami') ? 'kontak' : (rawHash || 'home');
  const u = user();
  stopScanner(); // Matikan kamera scanner setiap kali berpindah halaman
  if ((r.startsWith('admin') && u?.role !== 'admin') || (CUSTOMER_ONLY.includes(r) && u?.role !== 'customer')) return go('login');
  closeModal();
  renderNav();

  const footEl = $('.foot');
  if (r === 'kontak') {
    $('#app').innerHTML = V.home();
    if (footEl) footEl.style.display = 'none';
    setTimeout(() => {
      const el = document.getElementById('kontak');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  } else {
    $('#app').innerHTML = (V[r] || V.home)();
    if (footEl) footEl.style.display = (r === '' || r === 'home') ? 'none' : 'block';
    window.scrollTo(0, 0);
  }

  // Jika membuka halaman scan dan dalam mode kamera, mulai kamera otomatis
  if (r === 'scan' && state.scanMode === 'camera') {
    setTimeout(() => startScanner(), 100);
  }
}

window.addEventListener('hashchange', render);
render();