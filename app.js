// app.js (ESM module)

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getFirestore, doc, onSnapshot, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

// =======================
// FIREBASE CONFIG
// =======================
const firebaseConfig = {
  apiKey: "AIzaSyArSdap1Bl2MKU6MoBn7kcWK0IQx1J3PTg",
  authDomain: "gp-order.firebaseapp.com",
  projectId: "gp-order",
  storageBucket: "gp-order.firebasestorage.app",
  messagingSenderId: "933313943838",
  appId: "1:933313943838:web:bd1abe7762dee7eba6110f"
};

const ADMIN_EMAIL = "dinijanuari23@gmail.com";
const STORE_DOC_PATH = ["settings", "store"];
const wantAdminPanel = new URLSearchParams(window.location.search).get("admin") === "1";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

let storeOpen = true;
let isAdmin = false;
let RATE = 75;

const SELLER_GET = 0.7;

// =======================
// HELPERS
// =======================
function formatRupiah(num){
  return "Rp" + new Intl.NumberFormat('id-ID').format(Number(num || 0));
}
function numOnly(v){
  return Number(String(v || "").replace(/[^\d]/g,"")) || 0;
}
function isValidUrl(url){
  try{
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  }catch(e){ return false; }
}

// =======================
// POPUP
// =======================
function showPopup(title, message, submessage){
  const existing = document.getElementById('validationCenterPopup');
  if(existing) existing.remove();

  const container = document.getElementById('validationContainer') || document.body;
  const popup = document.createElement('div');
  popup.id = 'validationCenterPopup';
  popup.className = 'validation-center';
  popup.tabIndex = -1;

  popup.innerHTML = `
    <div class="hdr">${title}</div>
    <div class="divider"></div>
    <div class="txt">${message}</div>
    ${submessage ? `<div class="subtxt">${submessage}</div>` : ``}
    <div class="btnRow"><button class="okbtn">OK</button></div>
  `;
  container.appendChild(popup);

  popup.querySelector('.okbtn').onclick = () => popup.remove();
}

// =======================
// STORE STATUS UI (ADMIN)
// =======================
function applyStoreStatusUI(){
  const badge = document.getElementById('adminBadge');
  if(!badge) return;

  badge.textContent = storeOpen ? 'OPEN' : 'CLOSED';
  badge.style.background = storeOpen ? '#ecfdf5' : '#fef2f2';
  badge.style.color = storeOpen ? '#14532d' : '#7f1d1d';
}

// =======================
// STORE STATUS UI (PUBLIC)
// =======================
function applyPublicStoreStatusUI(){
  const bar = document.getElementById('storeStatusBar');
  const text = document.getElementById('storeStatusText');
  if(!bar || !text) return;

  bar.classList.toggle('open', storeOpen);
  bar.classList.toggle('closed', !storeOpen);

  text.textContent = storeOpen
    ? 'STORE OPEN — kamu bisa order sekarang'
    : 'STORE CLOSED — sedang istirahat';
}

// =======================
// ADMIN UI
// =======================
function applyAdminUI(user){
  const panel = document.getElementById('adminPanel');
  if(!panel) return;

  panel.style.display = wantAdminPanel ? 'block' : 'none';

  const btnLogin = document.getElementById('btnAdminLogin');
  const btnLogout = document.getElementById('btnAdminLogout');
  const emailEl = document.getElementById('adminEmail');

  if(user){
    btnLogin.style.display = 'none';
    btnLogout.style.display = 'inline-block';
    emailEl.textContent = user.email;
  }else{
    btnLogin.style.display = 'inline-block';
    btnLogout.style.display = 'none';
    emailEl.textContent = '';
  }

  document.getElementById('btnSetOpen').disabled = !isAdmin;
  document.getElementById('btnSetClose').disabled = !isAdmin;
  document.getElementById('adminRateInput').disabled = !isAdmin;
  document.getElementById('btnSaveRate').disabled = !isAdmin;

  document.getElementById('adminRateInput').value = RATE;
}

// =======================
// ADMIN ACTIONS
// =======================
async function setStoreOpen(flag){
  if(!isAdmin){
    showPopup('Akses ditolak','Hanya admin');
    return;
  }
  await setDoc(doc(db, ...STORE_DOC_PATH), {
    open: !!flag,
    updatedAt: serverTimestamp()
  },{ merge:true });
}

async function setStoreRate(rate){
  if(!isAdmin) return;
  const r = Number(rate);
  if(!r || r <= 0){
    showPopup('Error','Rate tidak valid');
    return;
  }
  await setDoc(doc(db, ...STORE_DOC_PATH), {
    rate: Math.round(r),
    updatedAt: serverTimestamp()
  },{ merge:true });
  showPopup('Berhasil','Rate disimpan');
}

// =======================
// CALCULATION
// =======================
function setRateUI(){
  const rate = document.getElementById("rate");
  if(rate) rate.value = formatRupiah(RATE) + " / Robux";
}

function calcPaytax(){
  const target = Number(document.getElementById("targetNet")?.value || 0);
  if(!target) return;
  const need = Math.ceil(target / SELLER_GET);
  document.getElementById("robuxNeed").value = need;
  document.getElementById("harga").value = formatRupiah(need * RATE);
}

function calcNotax(){
  const r = Number(document.getElementById("robuxInput")?.value || 0);
  if(!r) return;
  document.getElementById("netReceive").value = Math.floor(r * SELLER_GET) + " R$";
  document.getElementById("harga").value = formatRupiah(r * RATE);
}

function calcGig(){
  const r = Number(document.getElementById("gigRobuxPrice")?.value || 0);
  if(!r) return;
  document.getElementById("harga").value = formatRupiah(r * RATE);
}

// =======================
// TYPE UI
// =======================
function applyTypeUI(){
  const type = document.getElementById("gpType")?.value;
  ["paytaxFields","notaxFields","gigFields"].forEach(id=>{
    document.getElementById(id)?.classList.add("hidden");
  });
  if(type==="paytax") document.getElementById("paytaxFields").classList.remove("hidden");
  if(type==="notax") document.getElementById("notaxFields").classList.remove("hidden");
  if(type==="gig") document.getElementById("gigFields").classList.remove("hidden");
}

// =======================
// DOM READY
// =======================
document.addEventListener('DOMContentLoaded',()=>{

  applyTypeUI();
  setRateUI();

  document.getElementById("gpType")?.addEventListener("change",applyTypeUI);
  document.getElementById("targetNet")?.addEventListener("input",calcPaytax);
  document.getElementById("robuxInput")?.addEventListener("input",calcNotax);
  document.getElementById("gigRobuxPrice")?.addEventListener("input",calcGig);

  // realtime store
  const storeRef = doc(db, ...STORE_DOC_PATH);
  onSnapshot(storeRef,(snap)=>{
    if(snap.exists()){
      const d = snap.data();
      storeOpen = d.open !== false;
      RATE = Number(d.rate || 75);
    }
    applyStoreStatusUI();
    applyPublicStoreStatusUI();
    applyAdminUI(auth.currentUser);
    setRateUI();
  });

  // auth
  onAuthStateChanged(auth,(user)=>{
    isAdmin = !!(user && user.email === ADMIN_EMAIL);
    applyAdminUI(user);
    if(user && !isAdmin){
      signOut(auth);
      showPopup('Akses ditolak','Bukan admin');
    }
  });

  document.getElementById("btnAdminLogin")?.onclick = ()=> signInWithPopup(auth,provider);
  document.getElementById("btnAdminLogout")?.onclick = ()=> signOut(auth);

  document.getElementById("btnSetOpen")?.onclick = ()=> setStoreOpen(true);
  document.getElementById("btnSetClose")?.onclick = ()=> setStoreOpen(false);
  document.getElementById("btnSaveRate")?.onclick = ()=>{
    setStoreRate(document.getElementById("adminRateInput").value);
  };

  // submit
  document.getElementById("btnWa")?.addEventListener("click",()=>{
    if(!storeOpen){
      showPopup('STORE CLOSED','Silakan coba lagi nanti');
      return;
    }
    showPopup('Berhasil','Pesanan dikirim (simulasi)');
  });
});
