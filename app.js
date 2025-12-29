// app.js (ESM module)

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getFirestore, doc, onSnapshot, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDpNvuwxq9bgAV700hRxAkcs7BgrzHd72A",
  authDomain: "autoorderobux.firebaseapp.com",
  projectId: "autoorderobux",
  storageBucket: "autoorderobux.firebasestorage.app",
  messagingSenderId: "505258620852",
  appId: "1:505258620852:web:9daf566902c7efe73324e1",
  measurementId: "G-QMZ8R007VB"
};

const ADMIN_EMAIL = "dinijanuari23@gmail.com";
const STORE_DOC_PATH = ["settings", "store"]; // { open, rate }
const wantAdminPanel = new URLSearchParams(window.location.search).get("admin") === "1";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

let storeOpen = true;
let isAdmin = false;
let RATE = 75;

// tax sesuai kalkulator
const SELLER_GET = 0.7; // 70%

// ===== helpers
function formatRupiah(num){
  const n = Number(num || 0);
  return "Rp" + new Intl.NumberFormat('id-ID').format(isNaN(n) ? 0 : n);
}
function numOnly(v){
  const n = Number(String(v ?? "").replace(/[^\d]/g, ""));
  return isNaN(n) ? 0 : n;
}

// ===== popup
function showPopup(title, message, submessage){
  const existing = document.getElementById('validationCenterPopup');
  if(existing) existing.remove();

  const container = document.getElementById('validationContainer') || document.body;
  const popup = document.createElement('div');
  popup.id = 'validationCenterPopup';
  popup.className = 'validation-center';
  popup.tabIndex = -1;

  popup.innerHTML = `
    <div class="hdr">${title || 'Notification'}</div>
    <div class="divider"></div>
    <div class="txt">${message || ''}</div>
    ${submessage ? `<div class="subtxt">${submessage}</div>` : ``}
    <div class="btnRow">
      <button type="button" class="okbtn">OK</button>
    </div>
  `;

  container.appendChild(popup);

  popup.querySelector('.okbtn').addEventListener('click', () => {
    popup.style.transition = 'opacity 160ms ease, transform 160ms ease';
    popup.style.opacity = '0';
    popup.style.transform = 'translate(-50%,-50%) scale(.98)';
    setTimeout(()=> popup.remove(), 170);
  });

  popup.focus({preventScroll:true});
}

// ===== admin UI
function applyStoreStatusUI(){
  const badge = document.getElementById('adminBadge');
  if(badge){
    badge.textContent = storeOpen ? 'OPEN' : 'CLOSED';
    badge.style.borderColor = storeOpen ? '#bbf7d0' : '#fecaca';
    badge.style.background = storeOpen ? '#ecfdf5' : '#fef2f2';
    badge.style.color = storeOpen ? '#14532d' : '#7f1d1d';
  }
}

function applyAdminUI(user){
  const panel = document.getElementById('adminPanel');
  if(!panel) return;

  panel.style.display = wantAdminPanel ? 'block' : 'none';

  const btnLogin = document.getElementById('btnAdminLogin');
  const btnLogout = document.getElementById('btnAdminLogout');
  const emailEl = document.getElementById('adminEmail');
  const btnSetOpen = document.getElementById('btnSetOpen');
  const btnSetClose = document.getElementById('btnSetClose');
  const adminRateInput = document.getElementById('adminRateInput');
  const btnSaveRate = document.getElementById('btnSaveRate');

  if(!btnLogin || !btnLogout || !emailEl || !btnSetOpen || !btnSetClose || !adminRateInput || !btnSaveRate) return;

  if(user){
    btnLogin.style.display = 'none';
    btnLogout.style.display = 'inline-block';
    emailEl.textContent = user.email || '';
  } else {
    btnLogin.style.display = 'inline-block';
    btnLogout.style.display = 'none';
    emailEl.textContent = '';
  }

  btnSetOpen.disabled = !isAdmin;
  btnSetClose.disabled = !isAdmin;
  adminRateInput.disabled = !isAdmin;
  btnSaveRate.disabled = !isAdmin;

  adminRateInput.value = RATE;
}

async function setStoreOpen(flag){
  if(!isAdmin){
    showPopup('Notification', 'Akses ditolak', 'Hanya admin yang bisa mengubah status.');
    return;
  }
  const ref = doc(db, STORE_DOC_PATH[0], STORE_DOC_PATH[1]);
  await setDoc(ref, { open: !!flag, updatedAt: serverTimestamp() }, { merge: true });
}
async function setStoreRate(newRate){
  if(!isAdmin){
    showPopup('Notification', 'Akses ditolak', 'Hanya admin yang bisa mengubah rate.');
    return;
  }
  const r = Number(newRate);
  if(!r || r <= 0){
    showPopup('Notification', 'Oops', 'Rate harus angka > 0');
    return;
  }
  const ref = doc(db, STORE_DOC_PATH[0], STORE_DOC_PATH[1]);
  await setDoc(ref, { rate: Math.round(r), updatedAt: serverTimestamp() }, { merge: true });
  showPopup('Notification', 'Berhasil', 'Rate berhasil disimpan.');
}

// ===== kalkulasi
function setRateUI(){
  const rateEl = document.getElementById("rate");
  if(rateEl) rateEl.value = formatRupiah(RATE) + " / Robux";
}
function clearCalc(){
  document.getElementById("robuxNeed").value = "";
  document.getElementById("harga").value = "";
  document.getElementById("netReceive").value = "";
}
function calcPaytax(){
  const targetNet = Number(document.getElementById("targetNet").value || 0);
  if(!targetNet || targetNet <= 0){
    document.getElementById("robuxNeed").value = "";
    document.getElementById("harga").value = "";
    return;
  }
  const robuxNeed = Math.ceil(targetNet / SELLER_GET);
  const hargaNum = robuxNeed * RATE;

  document.getElementById("robuxNeed").value = String(robuxNeed);
  document.getElementById("harga").value = formatRupiah(hargaNum);
}
function calcNotax(){
  const robux = Number(document.getElementById("robuxInput").value || 0);
  if(!robux || robux <= 0){
    document.getElementById("netReceive").value = "";
    document.getElementById("harga").value = "";
    return;
  }
  const net = Math.floor(robux * SELLER_GET);
  const hargaNum = robux * RATE;

  document.getElementById("netReceive").value = String(net) + " R$";
  document.getElementById("harga").value = formatRupiah(hargaNum);
}
function calcGig(){
  const gigRobux = Number(document.getElementById("gigRobuxPrice").value || 0);
  if(!gigRobux || gigRobux <= 0){
    document.getElementById("harga").value = "";
    return;
  }
  const hargaNum = gigRobux * RATE;
  document.getElementById("harga").value = formatRupiah(hargaNum);
}

// ===== type UI
function applyTypeUI(){
  const gpType = document.getElementById("gpType").value;

  const paytax = document.getElementById("paytaxFields");
  const notax = document.getElementById("notaxFields");
  const gig = document.getElementById("gigFields");

  const targetNet = document.getElementById("targetNet");
  const robuxInput = document.getElementById("robuxInput");
  const gigMap = document.getElementById("gigMap");
  const gigItem = document.getElementById("gigItem");
  const gigRobuxPrice = document.getElementById("gigRobuxPrice");

  paytax.classList.add("hidden");
  notax.classList.add("hidden");
  gig.classList.add("hidden");

  // reset required
  targetNet.required = false;
  robuxInput.required = false;
  gigMap.required = false;
  gigItem.required = false;
  gigRobuxPrice.required = false;

  // reset values
  targetNet.value = "";
  robuxInput.value = "";
  gigMap.value = "";
  gigItem.value = "";
  gigRobuxPrice.value = "";
  clearCalc();

  if(gpType === "paytax"){
    paytax.classList.remove("hidden");
    targetNet.required = true;
  } else if(gpType === "notax"){
    notax.classList.remove("hidden");
    robuxInput.required = true;
  } else if(gpType === "gig"){
    gig.classList.remove("hidden");
    gigMap.required = true;
    gigItem.required = true;
    gigRobuxPrice.required = true;
  }
}

// ===== payment modal (dipakai sama persis)
function showPaymentPopup(qrUrl, hargaFormatted) {
  const backdrop = document.getElementById('paymentModalBackdrop');
  const modalQr = document.getElementById('modalQr');
  const modalAmount = document.getElementById('modalAmount');
  const copySuccess = document.getElementById('copySuccess');

  const walletLabel = document.getElementById('walletLabel');
  const walletNumberTitle = document.getElementById('walletNumberTitle');
  const walletNumber = document.getElementById('walletNumber');
  const walletNumberWrapper = document.getElementById('walletNumberWrapper');
  const walletNote = document.getElementById('walletNote');
  const copyNumberBtn = document.getElementById('copyNumberBtn');

  const methodButtons = document.querySelectorAll('.method-btn');

  const GOPAY_NUMBER   = '083197962700';
  const BRI_NUMBER     = '3295 0102 4903 507';
  const SEABANK_NUMBER = '901673348752';

  const baseAmount = (function () {
    const num = Number(String(hargaFormatted).replace(/[^\d]/g, ''));
    return isNaN(num) ? 0 : num;
  })();

  function formatRupiahLocal(num) {
    return "Rp" + new Intl.NumberFormat('id-ID').format(num);
  }

  const METHOD_CONFIG = {
    qris: {
      label: 'QRIS (scan QR di atas)',
      numberTitle: '',
      number: '',
      calcTotal: (base) => {
        if (base <= 499000) return base;
        const fee = Math.round(base * 0.003);
        return base + fee;
      },
      note: 'QRIS hingga Rp499.000 tidak ada biaya tambahan. Di atas itu akan dikenakan biaya 0,3% dari nominal.',
      showNumber: false
    },
    gopay: {
      label: 'Transfer GoPay',
      numberTitle: 'No HP GoPay',
      number: GOPAY_NUMBER,
      calcTotal: (base) => base,
      note: 'Pembayaran GoPay tidak ada biaya tambahan. Bayar sesuai nominal yang tertera.',
      showNumber: true
    },
    seabank: {
      label: 'Transfer SeaBank',
      numberTitle: 'Nomor rekening SeaBank',
      number: SEABANK_NUMBER,
      calcTotal: (base) => base,
      note: 'SeaBank tidak ada biaya tambahan. Bayar sesuai nominal yang tertera.',
      showNumber: true
    },
    bri: {
      label: 'Transfer BRI',
      numberTitle: 'Nomor rekening BRI',
      number: BRI_NUMBER,
      calcTotal: (base) => base,
      note: 'BRI tidak ada biaya tambahan. Bayar sesuai nominal yang tertera.',
      showNumber: true
    }
  };

  function showMessage(msg) {
    copySuccess.textContent = msg;
    copySuccess.style.display = 'block';
    setTimeout(()=> copySuccess.style.display = 'none', 2500);
  }

  function fallbackCopy(text, successMsg){
    const tmp = document.createElement('textarea');
    tmp.value = text;
    document.body.appendChild(tmp);
    tmp.select();
    try { document.execCommand('copy'); showMessage(successMsg); }
    catch(e){ showMessage('Tidak dapat menyalin, silakan salin manual.'); }
    document.body.removeChild(tmp);
  }

  function copyTextToClipboard(text, successMsg) {
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => showMessage(successMsg)).catch(() => fallbackCopy(text, successMsg));
    } else {
      fallbackCopy(text, successMsg);
    }
  }

  function applyMethod(methodKey) {
    methodButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.method === methodKey));
    const cfg = METHOD_CONFIG[methodKey];

    walletLabel.textContent = cfg.label;
    walletNote.textContent = cfg.note;

    const total = cfg.calcTotal(baseAmount);
    modalAmount.textContent = formatRupiahLocal(total);

    if (cfg.showNumber) {
      walletNumberTitle.textContent = cfg.numberTitle;
      walletNumber.textContent = cfg.number;
      walletNumberWrapper.style.display = 'block';
      copyNumberBtn.style.display = 'block';
    } else {
      walletNumberWrapper.style.display = 'none';
      copyNumberBtn.style.display = 'none';
    }

    if (methodKey === 'qris') {
      modalQr.style.display = 'block';
      modalQr.src = qrUrl;
    } else {
      modalQr.style.display = 'none';
    }
  }

  applyMethod('qris');

  copySuccess.style.display = 'none';
  backdrop.style.display = 'flex';
  backdrop.setAttribute('aria-hidden', 'false');

  methodButtons.forEach(btn => { btn.onclick = function () { applyMethod(this.dataset.method); }; });

  document.getElementById('closeModalBtn').onclick = function() {
    backdrop.style.display = 'none';
    backdrop.setAttribute('aria-hidden', 'true');
  };

  backdrop.onclick = function(e) {
    if (e.target === backdrop) {
      backdrop.style.display = 'none';
      backdrop.setAttribute('aria-hidden', 'true');
    }
  };

  copyNumberBtn.onclick = function () {
    copyTextToClipboard(walletNumber.textContent || '', 'Nomor berhasil disalin');
  };

  document.getElementById('copyAmountBtn').onclick = function() {
    copyTextToClipboard(modalAmount.textContent || '', 'Jumlah berhasil disalin');
  };

  document.getElementById('openBotBtn').onclick = function() {
    const botUsername = 'topupressbot';
    const tgScheme = 'tg://resolve?domain=' + encodeURIComponent(botUsername);
    const webLink  = 'https://t.me/' + encodeURIComponent(botUsername) + '?start';
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    let appOpened = false;
    function onVisibilityChange() { if (document.hidden) appOpened = true; }
    document.addEventListener('visibilitychange', onVisibilityChange);

    try {
      if (isMobile) window.location.href = tgScheme;
      else window.open(tgScheme, '_blank');
    } catch (e) {}

    const fallbackTimeout = setTimeout(function() {
      if (!appOpened) window.open(webLink, '_blank');
      document.removeEventListener('visibilitychange', onVisibilityChange);
    }, 800);

    window.addEventListener('pagehide', function cleanup() {
      clearTimeout(fallbackTimeout);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', cleanup);
    });
  };
}

// ===== DOM ready
document.addEventListener('DOMContentLoaded', function(){
  const gpType = document.getElementById("gpType");
  const targetNet = document.getElementById("targetNet");
  const robuxInput = document.getElementById("robuxInput");
  const gigRobuxPrice = document.getElementById("gigRobuxPrice");

  applyTypeUI();
  setRateUI();

  gpType.addEventListener("change", () => {
    applyTypeUI();
    setRateUI();
  });

  targetNet.addEventListener("input", () => {
    if (gpType.value === "paytax") calcPaytax();
  });

  robuxInput.addEventListener("input", () => {
    if (gpType.value === "notax") calcNotax();
  });

  gigRobuxPrice.addEventListener("input", () => {
    if (gpType.value === "gig") calcGig();
  });

  // listen store status + rate
  const storeRef = doc(db, STORE_DOC_PATH[0], STORE_DOC_PATH[1]);
  onSnapshot(storeRef, (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      storeOpen = (data.open !== false);
      RATE = Number(data.rate || 75);
    } else {
      storeOpen = true;
      RATE = 75;
    }

    applyStoreStatusUI();
    applyAdminUI(auth.currentUser || null);
    setRateUI();

    // recalc when rate changes
    if (gpType.value === "paytax") calcPaytax();
    if (gpType.value === "notax") calcNotax();
    if (gpType.value === "gig") calcGig();
  }, () => {
    storeOpen = true;
    RATE = 75;
    applyStoreStatusUI();
    setRateUI();
  });

  // admin auth
  onAuthStateChanged(auth, (user) => {
    isAdmin = !!(user && (user.email || '').toLowerCase() === ADMIN_EMAIL.toLowerCase());
    applyAdminUI(user);

    if (user && !isAdmin) {
      signOut(auth).catch(()=>{});
      showPopup('Notification', 'Akses ditolak', 'Email ini bukan admin.');
    }
  });

  document.getElementById('btnAdminLogin')?.addEventListener('click', async ()=>{
    try { await signInWithPopup(auth, provider); }
    catch(e){ showPopup('Notification', 'Login gagal', 'Login dibatalkan / gagal.'); }
  });

  document.getElementById('btnAdminLogout')?.addEventListener('click', async ()=>{
    try { await signOut(auth); } catch(e){}
  });

  document.getElementById('btnSetOpen')?.addEventListener('click', ()=> setStoreOpen(true));
  document.getElementById('btnSetClose')?.addEventListener('click', ()=> setStoreOpen(false));

  document.getElementById('btnSaveRate')?.addEventListener('click', ()=>{
    const v = document.getElementById('adminRateInput')?.value;
    setStoreRate(v);
  });

  // submit
  document.getElementById("btnWa").addEventListener("click", function() {
    if (!storeOpen) {
      showPopup(
        'Notification',
        'CLOSE',
        'Mohon maaf, saat ini kamu belum bisa melakukan pemesanan. Silahkan kembali saat @Topupgram OPEN.'
      );
      return;
    }

    const form = document.getElementById("orderForm");
    const inputs = form.querySelectorAll("input[required], select[required]");
    for (const input of inputs) {
      if (!String(input.value || '').trim()) {
        showPopup('Notification', 'Oops', 'Harap isi semua kolom yang wajib diisi!');
        try{ input.focus(); }catch(e){}
        return;
      }
    }

    const displayUser = document.getElementById("displayUser").value.trim();
    const type = gpType.value;

    let detailLine = "";
    let hargaText = document.getElementById("harga").value;
    let hargaNum = numOnly(hargaText);

    if(!hargaNum){
      showPopup('Notification', 'Oops', 'Harga belum terhitung. Cek input kamu.');
      return;
    }

    if(type === "paytax"){
      const target = Number(targetNet.value || 0);
      const need = Math.ceil(target / SELLER_GET);
      detailLine =
        "Tipe: Gamepass Paytax\n" +
        "Target bersih: " + target + " R$\n" +
        "Robux dibutuhkan: " + need + " R$\n";
    } else if(type === "notax"){
      const r = Number(robuxInput.value || 0);
      const net = Math.floor(r * SELLER_GET);
      detailLine =
        "Tipe: Gamepass No tax\n" +
        "Robux: " + r + " R$\n" +
        "Perkiraan bersih diterima: " + net + " R$\n";
    } else if(type === "gig"){
      const map = document.getElementById("gigMap").value.trim();
      const item = document.getElementById("gigItem").value.trim();
      const robuxItem = Number(document.getElementById("gigRobuxPrice").value || 0);

      detailLine =
        "Tipe: GIG\n" +
        "Maps: " + map + "\n" +
        "Item gift: " + item + "\n" +
        "Harga item: " + robuxItem + " R$\n";
    } else {
      showPopup('Notification', 'Oops', 'Pilih jenis dulu.');
      gpType.focus();
      return;
    }

    // TELEGRAM
    const botToken = "8039852277:AAEqbfQUF37cjDlEposj2rzHm28_Pxzv-mw";
    const chatId = "-1003049680083";

    const text =
      "Pesanan Baru Masuk!\n\n" +
      "Display + Username: " + displayUser + "\n" +
      detailLine +
      "Rate: Rp" + RATE + " / Robux\n" +
      "Harga: " + hargaText;

    fetch("https://api.telegram.org/bot" + botToken + "/sendMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text })
    })
    .then(res => {
      if (res.ok) {
        const qrUrl = "https://payment.uwu.ai/assets/images/gallery03/8555ed8a_original.jpg?v=58e63277";
        showPaymentPopup(qrUrl, hargaText);
        form.reset();
        applyTypeUI();
        setRateUI();
      } else {
        showPopup('Notification', 'Gagal', 'Gagal mengirim ke Telegram. Coba lagi.');
      }
    })
    .catch((error) => {
      console.error(error);
      showPopup('Notification', 'Error', 'Terjadi kesalahan saat mengirim ke Telegram.');
    });
  });
});
