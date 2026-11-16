/* =====================================================================
   DATA AWAL SKINMATCH  (edit di sini untuk mengganti produk/bahan/akun)
   Data disalin ke localStorage saat pertama dibuka. Untuk reset data:
   buka Console browser -> localStorage.clear() -> refresh.
   Gambar produk: simpan di folder images/ lalu isi field "img".
   ===================================================================== */
const SKIN_TYPES = ['Normal','Kering','Berminyak','Kombinasi','Sensitif'];
const CONCERNS   = ['Jerawat','Kemerahan','Penuaan','Kusam','Pori Besar','Kulit Kering','Flek Hitam'];
const CATEGORIES = ['Cleanser','Toner','Serum','Moisturizer','Sunscreen','Treatment'];
const RISKS      = ['Rendah','Sedang','Tinggi'];

const SEED = {
  /* D3: Bahan aktif & aturan konflik (konflik berlaku dua arah) */
  ingredients: [
    {id:'I1', name:'Retinol',          risk:'Tinggi', info:'Anti-aging, mempercepat regenerasi kulit', conflicts:['AHA','BHA','Vitamin C','Benzoyl Peroxide']},
    {id:'I2', name:'AHA',              risk:'Sedang', info:'Eksfoliasi permukaan kulit',               conflicts:['Retinol','Vitamin C']},
    {id:'I3', name:'BHA',              risk:'Sedang', info:'Membersihkan pori dari minyak',            conflicts:['Retinol']},
    {id:'I4', name:'Vitamin C',        risk:'Sedang', info:'Antioksidan pencerah',                     conflicts:['Retinol','AHA']},
    {id:'I5', name:'Benzoyl Peroxide', risk:'Tinggi', info:'Membunuh bakteri jerawat',                 conflicts:['Retinol']},
    {id:'I6', name:'Niacinamide',      risk:'Rendah', info:'Mengontrol minyak, menenangkan kulit',     conflicts:[]},
    {id:'I7', name:'Hyaluronic Acid',  risk:'Rendah', info:'Melembapkan',                              conflicts:[]},
    {id:'I8', name:'Ceramide',         risk:'Rendah', info:'Memperkuat skin barrier',                  conflicts:[]},
    {id:'I9', name:'Centella Asiatica',risk:'Rendah', info:'Menenangkan kemerahan',                    conflicts:[]},
    {id:'I10',name:'Fragrance',        risk:'Tinggi', info:'Pewangi, sering memicu iritasi',           conflicts:[]},
    {id:'I11',name:'Alcohol Denat',    risk:'Sedang', info:'Pelarut, bisa mengeringkan kulit',         conflicts:[]},
    {id:'I12',name:'Zinc Oxide',       risk:'Rendah', info:'Filter UV mineral',                        conflicts:[]}
  ],
  /* D2: Produk  (img = nama file di folder images/) */
  products: [
    {id:'P1',name:'Gentle Foam Cleanser',  brand:'Lumi',   category:'Cleanser',   price:89000, stock:30,barcode:'8991001000001',img:'cleanser.jpg',      skinTypes:['Normal','Kering','Berminyak','Kombinasi','Sensitif'],concerns:['Kemerahan','Kulit Kering'],ingredients:['Centella Asiatica','Ceramide','Hyaluronic Acid']},
    {id:'P2',name:'Bright C Serum',        brand:'Lumi',   category:'Serum',      price:145000,stock:20,barcode:'8991001000002',img:'serum-vitc.jpg',    skinTypes:['Normal','Kering','Kombinasi'],concerns:['Kusam','Flek Hitam'],ingredients:['Vitamin C','Hyaluronic Acid','Niacinamide']},
    {id:'P3',name:'Clear Niacinamide 10%', brand:'Dewy',   category:'Serum',      price:99000, stock:25,barcode:'8991001000003',img:'serum-niacinamide.jpg',skinTypes:['Berminyak','Kombinasi'],concerns:['Jerawat','Pori Besar'],ingredients:['Niacinamide','Zinc Oxide','Centella Asiatica']},
    {id:'P4',name:'Night Retinol 0.3%',    brand:'Aurel',  category:'Serum',      price:175000,stock:15,barcode:'8991001000004',img:'retinol.jpg',       skinTypes:['Normal','Kombinasi'],concerns:['Penuaan','Flek Hitam'],ingredients:['Retinol','Ceramide','Fragrance']},
    {id:'P5',name:'Barrier Ceramide Cream',brand:'Dewy',   category:'Moisturizer',price:128000,stock:40,barcode:'8991001000005',img:'moisturizer.jpg',   skinTypes:['Kering','Sensitif','Normal'],concerns:['Kulit Kering','Kemerahan'],ingredients:['Ceramide','Hyaluronic Acid','Centella Asiatica']},
    {id:'P6',name:'Glow AHA Toner',        brand:'Aurel',  category:'Toner',      price:115000,stock:18,barcode:'8991001000006',img:'toner-aha.jpg',     skinTypes:['Normal','Berminyak'],concerns:['Kusam','Pori Besar'],ingredients:['AHA','Alcohol Denat','Fragrance']},
    {id:'P7',name:'Spot Acne Gel',         brand:'Clearo', category:'Treatment',  price:79000, stock:35,barcode:'8991001000007',img:'acne-gel.jpg',      skinTypes:['Berminyak','Kombinasi'],concerns:['Jerawat'],ingredients:['Benzoyl Peroxide','BHA','Alcohol Denat']},
    {id:'P8',name:'Daily Shield SPF 50',   brand:'Lumi',   category:'Sunscreen',  price:135000,stock:50,barcode:'8991001000008',img:'sunscreen.jpg',     skinTypes:['Normal','Kering','Berminyak','Kombinasi','Sensitif'],concerns:['Flek Hitam','Penuaan'],ingredients:['Zinc Oxide','Niacinamide','Hyaluronic Acid']}
  ],
  /* D4: Ulasan komunitas (skinType = tipe kulit si pengulas) */
  reviews: [
    {id:'R1',pid:'P3',uid:'U2',name:'Sari',skinType:'Berminyak',rating:5,comment:'Minyak di wajah berkurang dalam 2 minggu.',date:'2026-09-12'},
    {id:'R2',pid:'P5',uid:'U2',name:'Sari',skinType:'Kering',   rating:5,comment:'Kulit terasa lembap seharian, tidak perih.',date:'2026-09-20'},
    {id:'R3',pid:'P4',uid:'U3',name:'Dewi',skinType:'Normal',   rating:4,comment:'Bagus untuk garis halus, awalnya agak kering.',date:'2026-10-02'},
    {id:'R4',pid:'P7',uid:'U3',name:'Dewi',skinType:'Berminyak',rating:3,comment:'Jerawat mengempis tapi cukup menyengat.',date:'2026-10-05'},
    {id:'R5',pid:'P1',uid:'U3',name:'Dewi',skinType:'Sensitif', rating:5,comment:'Lembut, tidak membuat kemerahan.',date:'2026-10-09'}
  ],
  /* D1: Akun. role: 'admin' atau 'customer'. profile diisi lewat Skin Profile Quiz */
  users: [
    {id:'U1',name:'Admin SkinMatch',email:'admin@skinmatch.id',password:'admin123',role:'admin',profile:null},
    {id:'U2',name:'Sari',email:'sari@mail.com',password:'sari123',role:'customer',profile:{type:'Kering',concerns:['Kulit Kering'],avoid:['Fragrance']}},
    {id:'U3',name:'Dewi',email:'dewi@mail.com',password:'dewi123',role:'customer',profile:null}
  ],
  carts: {},   /* D5: keranjang per pengguna  { U2:[{pid,qty}] } */
  orders: []   /* D6: transaksi & riwayat pembelian */
};