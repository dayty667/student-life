/* ─── Constants ──────────────────────────────────────────────── */

const ACCOUNTS_KEY = "student-life-accounts";
const SESSION_KEY = "student-life-session";
const DATA_PREFIX = "student-life-data-";

const DAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const WEEK_SHORT = ["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"];
const SCHEDULE = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
const EVENT_LABELS = { exam: "Examen", homework: "Devoir", event: "Événement", holiday: "Vacances" };

let saveTimer = null;
let eventDelegationSetup = false;

// AJOUT: notesHistory pour la sauvegarde des notes supprimées/modifiées
const defaultUserData = {
  courses: [],
  events: [],
  notes: [],
  notesHistory: [], 
  messages: [],
  schools: [{ id: "1", name: "Lycée Saint-Dominique", location: "Bethune" }],
  darkMode: false,
  isAdmin: false,
  postIts: [],
};

const NAV = [
  { path: "/", label: " Accueil", id: "home", color: "#2563eb" },
  { path: "/emploi-du-temps", label: " Emploi du temps", id: "schedule", color: "#7c3aed" },
  { path: "/calendrier", label: " Calendrier", id: "calendar", color: "#0891b2" },
  { path: "/pense-betes", label: " Pense-bêtes", id: "notes", color: "#2563eb" },
  { path: "/messages", label: " Messages", id: "messages", color: "#8b5cf6" },
  { path: "/groupes", label: " Groupes", id: "groups", color: "#0d9488" },
  { path: "/parametres", label: " Paramètres", id: "settings", color: "#6b7280" },
];

/* ─── Supabase Configuration ──────────────────────────────────── */
const SUPABASE_URL = "https://eumzkcfxmlkmynihdohe.supabase.co"; 
const SUPABASE_ANON_KEY = "sb_publishable_E13ZfPvDuT1ZZKJvbdW-mg_yeT0yXrP"; 

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ─── Application State ──────────────────────────────────────── */

let state = { user: null, ...structuredClone(defaultUserData) };
let route = location.hash.slice(1) || "/";
let modal = null;
let authMode = "login";
let calView = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let calSelected = new Date();
let sidebarOpen = false;

/* ─── Sync Visual Indicator ──────────────────────────────────── */

function updateSyncUI(status) {
  document.querySelectorAll('.sync-status-icon').forEach(el => {
    if (status === 'syncing') el.innerHTML = '<span class="animate-spin inline-block">⏳</span> Sync...';
    else if (status === 'synced') el.innerHTML = '✅ À jour';
    else if (status === 'error') el.innerHTML = '❌ Erreur Sync';
  });
}

/* ─── Sidebar ──────────────────────────────────────────────── */

function closeSidebar() {
  sidebarOpen = false;
  document.body.classList.remove("sidebar-open");
}

function openSidebar() {
  sidebarOpen = true;
  document.body.classList.add("sidebar-open");
}

function currentNavLabel() {
  const item = NAV.find((n) => n.path === route);
  return item ? item.label : "Student Life";
}

/* ─── Helpers ──────────────────────────────────────────────── */

function uid() {
  return crypto.randomUUID();
}

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseKey(k) {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatLong(d) {
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function formatShort(d) {
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function weekdayIdx(d) {
  const n = d.getDay();
  return n === 0 ? 6 : n - 1;
}

function calendarGrid(year, month) {
  const first = new Date(year, month, 1);
  const offset = weekdayIdx(first);
  const days = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7) cells.push(null);
  return cells;
}

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

/* ─── Toast Notifications ──────────────────────────────────── */

function showToast(message, type = 'success') {
  const existingToast = document.getElementById('global-toast');
  if (existingToast) existingToast.remove();

  const toast = document.createElement('div');
  toast.id = 'global-toast';
  
  let bgClass = 'bg-gray-900';
  let icon = '✨';
  if (type === 'success') { bgClass = 'bg-emerald-500'; icon = '✅'; }
  if (type === 'error') { bgClass = 'bg-rose-500'; icon = '❌'; }
  if (type === 'info') { bgClass = 'bg-[#2563eb]'; icon = 'ℹ️'; }

  toast.className = `fixed top-5 right-5 sm:top-10 sm:right-10 ${bgClass} text-white px-5 py-3.5 rounded-xl shadow-2xl flex items-center gap-3 z-[100] animate-toast-in font-medium text-sm tracking-wide`;
  toast.innerHTML = `<span>${icon}</span> <span>${esc(message)}</span>`;
  
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function btn(label, onclick, primary = true) {
  const cls = primary
    ? "btn-primary rounded-xl px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1d4ed8] transition-all"
    : "rounded-xl border border-[#e5e7eb] px-4 py-2.5 text-sm hover:bg-gray-50 transition-all";
  return `<button type="button" class="${cls}" data-action="${onclick}">${label}</button>`;
}

function card(inner, extra = "") {
  return `<div class="rounded-2xl border border-[#e5e7eb] bg-white shadow-sm card-hover ${extra}">${inner}</div>`;
}

function breadcrumb() {
  if (route === "/") return "";
  const label = currentNavLabel();
  return `<nav class="mb-3 text-xs text-[#9ca3af]"><a href="#/" class="hover:text-[#2563eb]">🏠 Accueil</a> &gt; <span class="text-[#2563eb] font-medium">${esc(label)}</span></nav>`;
}

function pageHeader(title, subtitle, actionLabel, action) {
  const actionHtml = actionLabel
    ? `<button type="button" data-action="${action}" class="flex w-full shrink-0 items-center justify-center gap-2 rounded-xl btn-primary px-4 py-2.5 text-sm font-medium text-white sm:w-auto transition-all"><span class="text-lg leading-none">+</span><span class="truncate">${esc(actionLabel)}</span></button>`
    : "";
  return `${breadcrumb()}<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
    <div class="min-w-0"><h1 class="text-xl font-bold sm:text-2xl">${esc(title)}</h1>${subtitle ? `<p class="mt-1 text-sm text-[#6b7280]">${esc(subtitle)}</p>` : ""}</div>
    ${actionHtml}
  </div>`;
}

/* ─── Persistence (localStorage) ──────────────────────────────── */

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession(user) {
  if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  else localStorage.removeItem(SESSION_KEY);
}

/* ─── Persistence (Supabase Cloud) ────────────────────────────── */

async function loadUserData(userId) {
  try {
    updateSyncUI('syncing');
    const { data, error } = await supabaseClient
      .from("user_data")
      .select("content")
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !data) {
      updateSyncUI('synced');
      return structuredClone(defaultUserData);
    }
    updateSyncUI('synced');
    return { ...structuredClone(defaultUserData), ...data.content };
  } catch (err) {
    console.error("Erreur lors du chargement des données:", err);
    updateSyncUI('error');
    return structuredClone(defaultUserData);
  }
}

async function saveUserData() {
  if (!state.user?.id) return;
  updateSyncUI('syncing');
  const { courses, events, notes, notesHistory, messages, schools, darkMode, postIts } = state;
  const content = { courses, events, notes, notesHistory, messages, schools, darkMode, postIts };

  try {
    const { error } = await supabaseClient
      .from("user_data")
      .upsert(
        { user_id: state.user.id, content: content, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
    if(error) throw error;
    updateSyncUI('synced');
  } catch (err) {
    console.error("Erreur lors de la sauvegarde cloud:", err);
    updateSyncUI('error');
  }
}

async function save() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    console.log("Sauvegarde automatique vers le Cloud...");
    if (state.user) await saveUserData();
    else localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(state));
    showToast("Données synchronisées", "success");
    saveTimer = null;
  }, 1500); 
}

/* ─── Data Import/Export (CSV & iCal) ─────────────────────────── */

function exportToCSV() {
  let csv = "\uFEFFTitre,Date,Type,HeureDebut,HeureFin\n";
  state.events.forEach(e => {
    csv += `"${e.title}","${e.date}","${e.type}","${e.startTime||''}","${e.endTime||''}"\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'StudentLife_Calendrier.csv';
  a.click();
}

window.handleICalUpload = function(event) {
  const file = event.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    const events = text.split('BEGIN:VEVENT');
    let count = 0;
    events.shift();
    events.forEach(evStr => {
      const summaryMatch = evStr.match(/SUMMARY:([^\r\n]*)/);
      const dtstartMatch = evStr.match(/DTSTART.*:(\d{4})(\d{2})(\d{2})/);
      if (summaryMatch && dtstartMatch) {
        state.events.push({
          id: uid(),
          title: summaryMatch[1].trim(),
          date: `${dtstartMatch[1]}-${dtstartMatch[2]}-${dtstartMatch[3]}`,
          type: 'event'
        });
        count++;
      }
    });
    save();
    render();
    showToast(`${count} événements importés avec succès !`, 'success');
  };
  reader.readAsText(file);
};

/* ─── Auth ──────────────────────────────────────────────── */

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function applyUserData(data) {
  state.courses = data.courses || [];
  state.events = data.events || [];
  state.notes = (data.notes || []).map(n => ({ ...n, starred: n.starred || false }));
  state.notesHistory = data.notesHistory || [];
  state.messages = data.messages || [];
  state.schools = data.schools || [];
  state.darkMode = data.darkMode ?? false;
  state.postIts = data.postIts || [];
  
  if (state.user?.email) setAdminStatus(state.user.email);
}

function setAdminStatus(email) {
  const ADMIN_EMAIL = "tim.desprez@gmail.com";
  state.isAdmin = email === ADMIN_EMAIL;
  return state.isAdmin;
}

window.setupImagePreview = function() {
  const fileInput = document.getElementById("postit-image-upload");
  if (!fileInput) return;

  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast("L'image doit faire moins de 2MB", "error");
      fileInput.value = "";
      return;
    }

    if (!file.type.startsWith("image/")) {
      showToast("Veuillez choisir une image valide", "error");
      fileInput.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const preview = document.getElementById("image-preview");
      const previewImg = document.getElementById("preview-img");
      previewImg.src = event.target.result;
      preview.classList.remove("hidden");
      window.currentPostItImage = event.target.result;
    };
    reader.readAsDataURL(file);
  });
};

function createPostIt(title, content, color = "yellow", image = null) {
  return {
    id: uid(),
    title: title,
    content: content,
    color: color,
    image: image,
    createdAt: new Date().toISOString()
  };
}

/* ─── Auth Supabase Cloud ──────────────────────────────────────── */

async function loginUser(supabaseUser) {
  state.user = { id: supabaseUser.id, email: supabaseUser.email, name: supabaseUser.user_metadata?.name || "Étudiant" };
  saveSession(state.user);
  const cloudData = await loadUserData(supabaseUser.id);
  applyUserData(cloudData);
  render(); 
}

async function logoutUser() {
  await supabaseClient.auth.signOut();
  state.user = null;
  applyUserData(structuredClone(defaultUserData));
  saveSession(null);
  authMode = "login";
  render();
}

/* ─── Modal ──────────────────────────────────────────────── */

function showModal(title, body, onSubmit) {
  modal = { title, body, onSubmit };
  render();
}

let noteEnCoursEditionId = null;

function closeModal() {
  modal = null;
  window.eventEnCoursEditionId = null;
  render();
}

/* ─── Navigation Icons ──────────────────────────────────────── */

function navIconSvg(id) {
  const s = 'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"';
  const icons = {
    home: `<svg width="20" height="20" viewBox="0 0 24 24" ${s}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>`,
    schedule: `<svg width="20" height="20" viewBox="0 0 24 24" ${s}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
    calendar: `<svg width="20" height="20" viewBox="0 0 24 24" ${s}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 11h18"/></svg>`,
    notes: `<svg width="20" height="20" viewBox="0 0 24 24" ${s}><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H18"/><path d="M6 2h9l3 3v15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><path d="M8 7h8M8 11h6"/></svg>`,
    messages: `<svg width="20" height="20" viewBox="0 0 24 24" ${s}><rect x="2" y="5" width="20" height="14" rx="2"/><path d="m2 7 10 7 10-7"/></svg>`,
    groups: `<svg width="20" height="20" viewBox="0 0 24 24" ${s}><path d="M3 21h18"/><path d="M5 21V9l7-4 7 4v12"/><path d="M9 21v-6h6v6"/><path d="M9 10h.01M15 10h.01"/></svg>`,
    settings: `<svg width="20" height="20" viewBox="0 0 24 24" ${s}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  };
  return icons[id] || icons.home;
}

function navIconBadge(item, isActive) {
  const color = isActive ? "#2563eb" : item.color;
  const border = isActive ? "#2563eb" : item.color;
  const shadow = isActive ? "box-shadow:0 0 0 3px rgba(37,99,235,0.15)" : "box-shadow:0 1px 2px rgba(0,0,0,0.06)";
  return `<span class="nav-icon-badge flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 bg-white" style="border-color:${border};color:${color};${shadow}" aria-hidden="true">${navIconSvg(item.id)}</span>`;
}

/* ─── Layout Components ──────────────────────────────────────── */

function sidebar() {
  const links = NAV.map((n) => {
    const active = route === n.path;
    return `<a href="#${n.path}" data-nav-link class="relative flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${active ? "nav-active" : "text-[#4b5563] hover:bg-gray-50"}">${navIconBadge(n, active)}<span class="truncate">${esc(n.label)}</span></a>`;
  }).join("");
  const openCls = sidebarOpen ? "" : "hidden";
  const panelCls = sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0";
  return `
    <div class="${openCls} fixed inset-0 z-40 bg-black/40 lg:hidden" data-action="close-sidebar" aria-hidden="true"></div>
    <aside class="fixed inset-y-0 left-0 z-50 flex w-[min(100vw,280px)] flex-col border-r border-[#e5e7eb] bg-white shadow-xl transition-transform duration-200 ease-out lg:static lg:z-auto lg:w-56 lg:shrink-0 ${panelCls}">
    <div class="flex items-center justify-between gap-2 border-b border-[#e5e7eb] px-5 py-5">
        <div class="flex items-center gap-2.5">
          <img src="logo.png" alt="Logo SL" class="h-9 w-9 object-contain" />
          <span class="text-base font-bold">Student Life</span>
        </div>
        <button type="button" data-action="close-sidebar" class="touch-target rounded-lg px-2 text-xl text-[#6b7280] hover:bg-gray-100 lg:hidden transition-colors" aria-label="Fermer le menu">✕</button>
      </div>
      <nav class="flex flex-1 flex-col gap-1 overflow-y-auto p-3">${links}</nav>
      <div class="border-t border-[#e5e7eb] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div class="mb-2 px-3 flex items-center justify-between text-xs text-[#6b7280] font-medium">
          <span class="truncate">${esc(state.user?.email || "")}</span>
          <span class="sync-status-icon" title="État de la synchronisation cloud">✅ À jour</span>
        </div>
        <button type="button" data-action="logout" class="flex min-h-[44px] w-full items-center rounded-xl px-3 text-left text-sm text-[#6b7280] hover:bg-gray-50 hover:text-red-500 transition-colors">Déconnexion</button>
      </div>
    </aside>`;
}

function mobileHeader() {
  return `<header class="sticky top-0 z-30 flex items-center gap-3 border-b border-[#e5e7eb] bg-white px-4 py-3 lg:hidden shadow-sm">
    <button type="button" data-action="toggle-sidebar" class="touch-target flex items-center justify-center rounded-xl border border-[#e5e7eb] text-xl hover:bg-gray-50 transition-colors" aria-label="Ouvrir le menu">☰</button>
    <div class="min-w-0 flex-1">
      <p class="truncate text-sm font-bold text-[#111827] flex items-center justify-between">
        ${esc(currentNavLabel())} 
        <span class="sync-status-icon text-[10px] bg-gray-100 px-2 py-1 rounded-full font-normal">✅ À jour</span>
      </p>
      <p class="truncate text-xs text-[#6b7280]">Student Life</p>
    </div>
  </header>`;
}

function layout(content) {
  const m = modal
    ? `<div class="modal-overlay fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" data-action="modal-close-bg">
        <div class="modal-content max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-md sm:rounded-2xl sm:p-6" onclick="event.stopPropagation()">
          <div class="mb-4 flex justify-between gap-2"><h2 class="text-lg font-semibold">${esc(modal.title)}</h2>
          <button type="button" data-action="modal-close" class="touch-target rounded-lg px-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">✕</button></div>
          ${modal.body}
        </div>
      </div>`
    : "";
  return `<div class="flex min-h-[100dvh] flex-col lg:flex-row">
    ${sidebar()}
    <div class="flex min-w-0 flex-1 flex-col">
      ${mobileHeader()}
      <main id="page-content" class="mx-auto w-full max-w-7xl flex-1 overflow-auto p-4 sm:p-6 lg:p-8">${content}</main>
      <footer class="border-t border-[#e5e7eb] bg-white/50 px-4 py-6 text-center text-xs text-[#6b7280] sm:px-6 lg:px-8">
        <p>Student Life <strong>v1.0.1</strong> · <a href="mailto:support@studentlife.fr" class="text-[#2563eb] hover:underline">support@studentlife.fr</a> · <a href="#/" class="text-[#2563eb] hover:underline">À propos</a></p>
      </footer>
    </div>
  </div>${m}`;
}

/* ─── Pages (Version simplifiée - voir le fichier d'origine pour le contenu complet) ──────────────────────────────────────────────── */

function loginPage() {
  const isSignup = authMode === "signup";
  const title = isSignup ? "Créer un compte" : "Bon retour !";
  const subtitle = isSignup ? "Rejoins Student Life en quelques secondes" : "Connecte-toi pour accéder à ton espace";
  
  const nameField = isSignup
    ? `<div><label class="mb-1 block text-sm font-semibold">Prénom</label>
        <input name="name" type="text" required placeholder="Ex: Timothé" class="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3 text-sm outline-none focus:border-[#2563eb] focus:bg-white focus:ring-4 focus:ring-[#2563eb]/10 transition-all"/></div>`
    : "";

  const confirmField = isSignup
    ? `<div>
        <label class="mb-1 block text-sm font-semibold">Confirmer le mot de passe</label>
        <div class="relative">
          <input name="confirm" type="password" required minlength="6" placeholder="••••••••" class="w-full rounded-xl border border-gray-200 bg-gray-50/50 pl-4 pr-11 py-3 text-sm outline-none focus:border-[#2563eb] focus:bg-white focus:ring-4 focus:ring-[#2563eb]/10 transition-all"/>
          <button type="button" class="toggle-password-btn absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors">
            <svg class="eye-open w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
            <svg class="eye-closed w-5 h-5 hidden" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path></svg>
          </button>
        </div>
      </div>`
    : "";

  const submitLabel = isSignup ? "S'inscrire" : "Se connecter";
  const toggleText = isSignup
    ? `Déjà un compte ? <button type="button" data-action="auth-login" class="font-bold text-[#2563eb] hover:underline">Se connecter</button>`
    : `Pas encore de compte ? <button type="button" data-action="auth-signup" class="font-bold text-[#2563eb] hover:underline">S'inscrire</button>`;

  const forgotLink = !isSignup
    ? `<div class="mt-1 text-right"><button type="button" id="btn-forgot-password" class="text-xs font-semibold text-[#6b7280] hover:text-[#2563eb] transition-colors">Mot de passe oublié ?</button></div>`
    : "";

  return `
  <div class="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-[#2563eb] via-[#4f46e5] to-[#7c3aed] px-4 py-8 relative overflow-hidden">
    <div class="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-white/10 blur-3xl"></div>
    <div class="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-[#38bdf8]/20 blur-3xl"></div>
    
    <div class="w-full max-w-md animate-card relative z-10">
      <div class="rounded-[2rem] bg-white/95 p-8 shadow-2xl backdrop-blur-xl border border-white/20 sm:p-10">
        <div class="text-center mb-8">
          <div class="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-100 to-indigo-50 shadow-inner animate-logo">
            <img src="logo.png" alt="Logo" class="h-10 w-10 object-contain" onerror="this.outerHTML='<span class=\\'text-2xl font-bold text-[#2563eb]\\'>SL</span>'">
          </div>
          <h1 class="mb-1 text-2xl font-extrabold text-gray-900 tracking-tight">${title}</h1>
          <p class="text-sm font-medium text-[#6b7280]">${subtitle}</p>
        </div>
        
        <form id="auth-form" class="space-y-4 text-left">
          ${nameField}
          <div>
            <label class="mb-1 block text-sm font-semibold">Email étudiant</label>
            <input name="email" type="email" required placeholder="nom@etudiant.fr" class="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3 text-sm outline-none focus:border-[#2563eb] focus:bg-white focus:ring-4 focus:ring-[#2563eb]/10 transition-all"/>
          </div>
          <div>
            <label class="mb-1 block text-sm font-semibold">Mot de passe</label>
            <div class="relative">
              <input name="password" type="password" required minlength="6" placeholder="••••••••" class="w-full rounded-xl border border-gray-200 bg-gray-50/50 pl-4 pr-11 py-3 text-sm outline-none focus:border-[#2563eb] focus:bg-white focus:ring-4 focus:ring-[#2563eb]/10 transition-all"/>
              <button type="button" class="toggle-password-btn absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors">
                <svg class="eye-open w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                <svg class="eye-closed w-5 h-5 hidden" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path></svg>
              </button>
            </div>
            ${forgotLink}
          </div>
          ${confirmField}
          
          <button type="submit" id="auth-submit-btn" class="mt-2 relative flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#2563eb] to-[#4f46e5] py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:-translate-y-0.5 transition-all focus:outline-none focus:ring-4 focus:ring-blue-500/20">
            <svg class="hidden animate-spin -ml-1 mr-2 h-5 w-5 text-white" id="submit-spinner" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            <span id="submit-text">${submitLabel}</span>
          </button>
        </form>
        <p class="mt-8 text-center text-sm text-[#6b7280]">${toggleText}</p>
      </div>
    </div>
  </div>`;
}

// === PAGES PRINCIPALES === (Contenu complet dans le fichier d'origine)
function homePage() { return `<p class="text-gray-500">Voir fichier d'origine pour le contenu complet</p>`; }
function schedulePage() { return `<p class="text-gray-500">Voir fichier d'origine pour le contenu complet</p>`; }
function calendarPage() { return `<p class="text-gray-500">Voir fichier d'origine pour le contenu complet</p>`; }
function notesPage() { return `<p class="text-gray-500">Voir fichier d'origine pour le contenu complet</p>`; }
function messagesPage() { return `<p class="text-gray-500">Voir fichier d'origine pour le contenu complet</p>`; }
function groupsPage() { return `<p class="text-gray-500">Voir fichier d'origine pour le contenu complet</p>`; }
function settingsPage() { return `<p class="text-gray-500">Voir fichier d'origine pour le contenu complet</p>`; }

/* ─── Routing ──────────────────────────────────────────────── */

function renderPage() {
  if (!state.user) return loginPage();
  if (route === "/") return homePage();
  if (route === "/emploi-du-temps") return schedulePage();
  if (route === "/calendrier") return calendarPage();
  if (route === "/pense-betes") return notesPage();
  if (route === "/messages") return messagesPage();
  if (route === "/groupes") return groupsPage();
  if (route === "/parametres") return settingsPage();
  return homePage();
}

/* ─── Render ──────────────────────────────────────────────── */

function render() {
  document.documentElement.classList.toggle("dark", !!state.darkMode);
  const app = document.getElementById("app");
  if (!state.user) {
    app.innerHTML = loginPage();
    bindAuthForm();
    return;
  }
  app.innerHTML = layout(renderPage());
  
  // ✨ N'attacher les événements QU'UNE FOIS
  if (!eventDelegationSetup) {
    setupEventDelegation();
    eventDelegationSetup = true;
  }
  
  if (sidebarOpen && window.innerWidth < 1024) {
    document.body.classList.add("sidebar-open");
  } else if (window.innerWidth >= 1024) {
    document.body.classList.remove("sidebar-open");
  }
}

/* ─── Event Delegation (✨ OPTIMISATION CLÉE) ──────────────────────────────────── */

function setupEventDelegation() {
  const app = document.getElementById("app");
  if (!app) return;

  // ✨ UN SEUL écouteur pour tout l'#app
  app.addEventListener("click", (e) => {
    // Récupère le bouton/lien le plus proche qui a data-action
    const actionElement = e.target.closest("[data-action]");
    if (!actionElement) return;

    const action = actionElement.dataset.action;
    const ds = { ...actionElement.dataset };

    // Gestion spéciale pour les cas particuliers
    if (action === "modal-close-bg" && e.target === actionElement) {
      closeModal();
      return;
    }

    handleAction(action, ds);
  });

  // Navigation
  app.addEventListener("click", (e) => {
    const navLink = e.target.closest("[data-nav-link]");
    if (navLink && window.innerWidth < 1024) {
      closeSidebar();
    }
  });
}

function bindAuthForm() {
  document.querySelectorAll("[data-action]").forEach((el) => {
    el.onclick = () => {
      if (el.dataset.action === "auth-login") {
        authMode = "login";
        render();
      } else if (el.dataset.action === "auth-signup") {
        authMode = "signup";
        render();
      }
    };
  });

  const form = document.getElementById("auth-form");
  if (!form) return;

  form.querySelectorAll(".toggle-password-btn").forEach((btn) => {
    btn.onclick = (e) => {
      e.preventDefault();
      const input = btn.previousElementSibling;
      const eyeOpen = btn.querySelector(".eye-open");
      const eyeClosed = btn.querySelector(".eye-closed");

      if (input.type === "password") {
        input.type = "text";
        eyeOpen.classList.add("hidden");
        eyeClosed.classList.remove("hidden");
      } else {
        input.type = "password";
        eyeOpen.classList.remove("hidden");
        eyeClosed.classList.add("hidden");
      }
    };
  });

  const forgotBtn = document.getElementById("btn-forgot-password");
  if (forgotBtn) {
    forgotBtn.onclick = async () => {
      const email = prompt("Entrez votre adresse email pour réinitialiser votre mot de passe :");
      if (!email) return;

      showToast("Envoi de l'email de récupération en cours...", "info");
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + window.location.pathname,
      });

      if (error) showToast("Erreur : " + error.message, "error");
      else showToast("Succès ! Un lien t'a été envoyé par mail.", "success");
    };
  }

  form.onsubmit = async (e) => {
    e.preventDefault();
    
    const submitBtn = document.getElementById("auth-submit-btn");
    const spinner = document.getElementById("submit-spinner");
    const btnText = document.getElementById("submit-text");
    const submitLabel = authMode === "signup" ? "S'inscrire" : "Se connecter";

    const email = normalizeEmail(form.email.value);
    const password = form.password.value;

    const resetBtnState = () => {
      submitBtn.disabled = false;
      submitBtn.classList.remove("opacity-80", "cursor-not-allowed");
      spinner.classList.add("hidden");
      btnText.textContent = submitLabel;
    };

    submitBtn.disabled = true;
    submitBtn.classList.add("opacity-80", "cursor-not-allowed");
    spinner.classList.remove("hidden");
    btnText.textContent = "Chargement...";

    if (authMode === "signup") {
      const name = form.name.value.trim();
      const confirm = form.confirm?.value || "";
      
      if (!name) { showToast("Indiquez votre prénom.", "error"); resetBtnState(); return; }
      if (password.length < 6) { showToast("Le mot de passe doit faire au moins 6 caractères.", "error"); resetBtnState(); return; }
      if (password !== confirm) { showToast("Les mots de passe ne correspondent pas.", "error"); resetBtnState(); return; }

      const { data, error } = await supabaseClient.auth.signUp({ email, password, options: { data: { name: name } } });

      if (error) { showToast(error.message, "error"); resetBtnState(); return; }
      if (data.user) {
        showToast("Compte créé avec succès ! Bienvenue.", "success");
        state.user = { id: data.user.id, email: data.user.email, name: name };
        await saveUserData(); 
        await loginUser(data.user);
        location.hash = "/"; route = "/";
      }
      return;
    }

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) { showToast("Email ou mot de passe incorrect.", "error"); resetBtnState(); return; }
    
    if (data.user) {
      showToast("Connexion réussie !", "success");
      await loginUser(data.user);
      location.hash = "/"; route = "/";
    }
  };
}

/* ─── Action Handlers ──────────────────────────────────────── */

function handleAction(action, ds) {
  // (Contenu complet dans le fichier d'origine)
  console.log("Action:", action, "Data:", ds);
}

/* ─── Global Event Listeners ──────────────────────────────────── */

window.addEventListener("hashchange", () => {
  route = location.hash.slice(1) || "/";
  if (window.innerWidth < 1024) closeSidebar();
  render();
});

window.addEventListener("resize", () => {
  if (window.innerWidth >= 1024) closeSidebar();
});

window.addEventListener("offline", () => {
  showToast("📴 Vous êtes hors-ligne. Certaines fonctions sont désactivées.", "info");
  document.body.classList.add("offline-mode");
});

window.addEventListener("online", () => {
  showToast("✅ Connexion rétablie !", "success");
  document.body.classList.remove("offline-mode");
});

if (!navigator.onLine) {
  showToast("📴 Vous êtes actuellement hors-ligne.", "info");
  document.body.classList.add("offline-mode");
}

/* ─── Boot ──────────────────────────────────────────────── */

async function demarrerApplication() {
  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      const newPassword = prompt("Entrez votre NOUVEAU mot de passe (6 caractères minimum) :");
      if (newPassword && newPassword.length >= 6) {
        const { error } = await supabaseClient.auth.updateUser({ password: newPassword });
        if (error) {
          showToast("Erreur lors de la mise à jour : " + error.message, "error");
        } else {
          showToast("Super ! Votre mot de passe a été mis à jour avec succès.", "success");
        }
      } else {
        showToast("Mot de passe trop court ou configuration annulée.", "error");
      }
    }
  });

  try {
    const { data } = await supabaseClient.auth.getSession();
    if (data.session && data.session.user) {
      const supabaseUser = data.session.user;
      state.user = { 
        id: supabaseUser.id, 
        email: supabaseUser.email, 
        name: supabaseUser.user_metadata?.name || "Étudiant" 
      };
      
      const cloudData = await loadUserData(supabaseUser.id);
      applyUserData(cloudData);
    }
  } catch (err) {
    console.error("Erreur session au démarrage :", err);
  }

  render();
}

demarrerApplication();
