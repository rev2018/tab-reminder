let tabs = JSON.parse(localStorage.getItem("tabs")) || [];
let currentTags = [];
let selectedPriority = "low";
let sortMode = "newest";
let deleteIdx = null;

// ── Tab title flashing ──────────────────────────────────────────────
let titleFlashInterval = null;
const originalTitle = document.title;

function startTitleFlash(label) {
  if (titleFlashInterval) return;
  let toggle = false;
  titleFlashInterval = setInterval(() => {
    document.title = toggle ? `🔔 ${label}` : originalTitle;
    toggle = !toggle;
  }, 1000);
  document.addEventListener("visibilitychange", stopTitleFlash, { once: true });
}

function stopTitleFlash() {
  if (titleFlashInterval) {
    clearInterval(titleFlashInterval);
    titleFlashInterval = null;
  }
  document.title = originalTitle;
}

// ── Notification permission ─────────────────────────────────────────
function checkNotifPermission() {
  if (!("Notification" in window)) return;
  const banner = document.getElementById("notifBanner");
  if (Notification.permission === "default") {
    banner.classList.add("show");
  } else {
    banner.classList.remove("show");
  }
}

document.getElementById("allowNotifBtn").onclick = () => {
  Notification.requestPermission().then(checkNotifPermission);
};

// ── Fire a reminder: OS notification + title flash ──────────────────
function fireReminder(tab) {
  if (Notification.permission === "granted") {
    const n = new Notification("🔖 Tab Reminder", {
      body: tab.reason + "\n" + tab.url,
      icon: `https://www.google.com/s2/favicons?sz=64&domain=${(() => { try { return new URL(tab.url).hostname; } catch { return ""; } })()}`,
      tag: "tab-reminder-" + tab.createdAt,
      requireInteraction: true,
    });
    n.onclick = () => { window.focus(); n.close(); };
  }
  const shortLabel = tab.reason.length > 30 ? tab.reason.slice(0, 28) + "…" : tab.reason;
  startTitleFlash(shortLabel);
}

// ── Core utilities ──────────────────────────────────────────────────
const save = () => localStorage.setItem("tabs", JSON.stringify(tabs));

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2600);
}

function updateStats() {
  const now = Date.now();
  const total   = tabs.length;
  const pending = tabs.filter(t => t.status === "pending").length;
  const done    = tabs.filter(t => t.status === "done").length;
  const overdue = tabs.filter(t => t.remindAt && t.remindAt <= now && t.status === "pending").length;
  document.getElementById("sTotal").textContent   = total;
  document.getElementById("sPending").textContent = pending;
  document.getElementById("sDone").textContent    = done;
  document.getElementById("sOverdue").textContent = overdue;
  const pr = document.getElementById("progRow");
  if (total > 0) {
    pr.style.display = "flex";
    const pct = Math.round(done / total * 100);
    document.getElementById("progLabel").textContent = pct + "%";
    document.getElementById("progFill").style.width  = pct + "%";
    document.getElementById("progFrac").textContent  = done + "/" + total;
  } else { pr.style.display = "none"; }
}

function esc(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function timeAgo(ts) {
  const d = Date.now() - ts;
  if (d < 60000) return "just now";
  if (d < 3600000) return Math.floor(d/60000) + "m ago";
  if (d < 86400000) return Math.floor(d/3600000) + "h ago";
  return Math.floor(d/86400000) + "d ago";
}
function remindLabel(ts) {
  const d = ts - Date.now();
  if (d <= 0) return "overdue";
  if (d < 3600000) return "in " + Math.ceil(d/60000) + "m";
  return "in " + Math.ceil(d/3600000) + "h";
}
function favicon(url) {
  try { return `https://www.google.com/s2/favicons?sz=32&domain=${new URL(url).hostname}`; }
  catch { return null; }
}
const prioOrder = { high:0, medium:1, low:2, none:3 };

function render() {
  const list   = document.getElementById("tabList");
  const search = document.getElementById("search").value.toLowerCase();
  const filter = document.getElementById("filterSel").value;
  const now    = Date.now();
  list.innerHTML = "";
  let items = tabs.map((t,i) => ({...t,_i:i})).filter(t => {
    const match = t.reason.toLowerCase().includes(search) ||
      t.url.toLowerCase().includes(search) ||
      (t.tags||[]).some(tg => tg.toLowerCase().includes(search));
    return match && (filter === "all" || t.status === filter);
  });
  if (sortMode === "newest")   items.sort((a,b) => b.createdAt - a.createdAt);
  if (sortMode === "oldest")   items.sort((a,b) => a.createdAt - b.createdAt);
  if (sortMode === "priority") items.sort((a,b) => (prioOrder[a.priority]??3) - (prioOrder[b.priority]??3));
  if (sortMode === "az")       items.sort((a,b) => a.reason.localeCompare(b.reason));
  document.getElementById("emptyState").classList.toggle("show", items.length === 0);
  items.forEach(tab => {
    const i = tab._i;
    const overdue = tab.remindAt && tab.remindAt <= now && tab.status === "pending";
    const fav = favicon(tab.url);
    const prio = tab.priority || "none";
    const prioClass = {low:"p-low",medium:"p-med",high:"p-high",none:"p-none"}[prio];
    const div = document.createElement("div");
    div.className = "tab-card" + (tab.status === "done" ? " done" : "");
    div.setAttribute("data-p", prio);
    div.innerHTML = `
      <div class="tc-top">
        ${fav ? `<img class="tc-fav" src="${fav}" alt="" onerror="this.style.display='none'">` : ""}
        <a class="tc-url" href="${esc(tab.url)}" target="_blank" rel="noopener">${esc(tab.url)}</a>
      </div>
      <p class="tc-reason">${esc(tab.reason)}</p>
      ${tab.note ? `<div class="tc-note">${esc(tab.note)}</div>` : ""}
      <textarea class="inline-edit" id="ie-${i}" rows="2">${esc(tab.reason)}</textarea>
      <div class="tc-meta">
        <span class="badge time">${timeAgo(tab.createdAt)}</span>
        <span class="badge ${prioClass}">${prio === "none" ? "no priority" : prio}</span>
        ${overdue ? `<span class="badge overdue">⚡ overdue</span>` : ""}
        ${tab.remindAt && tab.remindAt > now ? `<span class="badge remind">⏰ ${remindLabel(tab.remindAt)}</span>` : ""}
        ${(tab.tags||[]).map(tg=>`<span class="badge tag">#${esc(tg)}</span>`).join("")}
      </div>
      <div class="tc-actions">
        <button class="act-btn done-btn" onclick="toggleStatus(${i})">${tab.status==="pending"?"✓ Done":"↩ Undo"}</button>
        <button class="act-btn" onclick="startEdit(${i})">✏ Edit</button>
        <button class="act-btn" onclick="copyURL(${i})">⎘ Copy</button>
        <button class="act-btn del" onclick="confirmDelete(${i})">✕ Delete</button>
      </div>`;
    list.appendChild(div);
  });
  updateStats();
}

function toggleStatus(i) {
  tabs[i].status = tabs[i].status === "pending" ? "done" : "pending";
  save(); render();
  showToast(tabs[i].status === "done" ? "✅ Marked done" : "↩ Marked pending");
}
function copyURL(i) {
  navigator.clipboard.writeText(tabs[i].url).then(() => showToast("⎘ URL copied!"));
}
function startEdit(i) {
  const el = document.getElementById("ie-" + i); if (!el) return;
  const isOpen = el.classList.contains("open");
  document.querySelectorAll(".inline-edit.open").forEach(e => e.classList.remove("open"));
  if (!isOpen) {
    el.classList.add("open"); el.focus();
    el.addEventListener("blur", () => {
      const v = el.value.trim();
      if (v && v !== tabs[i].reason) { tabs[i].reason = v; save(); render(); showToast("✏ Updated"); }
      else el.classList.remove("open");
    }, { once: true });
    el.addEventListener("keydown", e => {
      if (e.key==="Enter"&&!e.shiftKey){e.preventDefault();el.blur();}
      if (e.key==="Escape") el.classList.remove("open");
    });
  }
}
function confirmDelete(i) {
  deleteIdx = i;
  document.getElementById("backdrop").classList.add("open");
}
document.getElementById("mCancel").onclick = () => { document.getElementById("backdrop").classList.remove("open"); deleteIdx=null; };
document.getElementById("mConfirm").onclick = () => {
  if (deleteIdx !== null) { tabs.splice(deleteIdx,1); save(); render(); showToast("🗑 Deleted"); }
  document.getElementById("backdrop").classList.remove("open"); deleteIdx=null;
};

function renderChips() {
  document.querySelectorAll(".tag-chip").forEach(c=>c.remove());
  const wrap = document.getElementById("tagsWrap");
  currentTags.forEach((tg,i) => {
    const s = document.createElement("span");
    s.className = "tag-chip";
    s.innerHTML = `#${esc(tg)} <span class="rm" data-i="${i}">×</span>`;
    s.querySelector(".rm").onclick = () => { currentTags.splice(i,1); renderChips(); };
    wrap.insertBefore(s, document.getElementById("tagInput"));
  });
}
document.getElementById("tagInput").addEventListener("keydown", e => {
  if (e.key==="Enter"||e.key===",") {
    e.preventDefault();
    const v = e.target.value.trim().replace(/,/g,"");
    if (v && !currentTags.includes(v)) { currentTags.push(v); renderChips(); }
    e.target.value = "";
  }
  if (e.key==="Backspace"&&!e.target.value&&currentTags.length) { currentTags.pop(); renderChips(); }
});

document.querySelectorAll(".prio-btn").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".prio-btn").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active"); selectedPriority = btn.dataset.p;
  };
});
document.querySelectorAll(".sort-chip").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".sort-chip").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active"); sortMode = btn.dataset.s; render();
  };
});

document.getElementById("tabForm").addEventListener("submit", e => {
  e.preventDefault();
  const url    = document.getElementById("url").value.trim();
  const reason = document.getElementById("reason").value.trim();
  const note   = document.getElementById("noteInput").value.trim();
  const mins   = document.getElementById("remindAfter").value;
  if (!url||!reason) return;
  tabs.unshift({ url, reason, note, priority:selectedPriority, tags:[...currentTags],
    createdAt:Date.now(), status:"pending",
    remindAt: mins ? Date.now()+mins*60000 : null, notified:false });
  save(); render(); e.target.reset();
  currentTags=[]; renderChips();
  document.querySelectorAll(".prio-btn").forEach(b=>b.classList.remove("active"));
  document.querySelector('.prio-btn[data-p="low"]').classList.add("active");
  selectedPriority="low";
  showToast("🔖 Tab saved!");
});

document.getElementById("search").addEventListener("input", render);
document.getElementById("filterSel").addEventListener("change", render);

// ── Reminder checker — runs every 15 seconds ────────────────────────
function checkReminders() {
  const now = Date.now();
  const due = tabs.filter(t => t.remindAt && t.remindAt <= now && t.status === "pending" && !t.notified);
  due.forEach(t => {
    t.notified = true;
    fireReminder(t);
  });
  if (due.length) save();

  const allOverdue = tabs.filter(t => t.remindAt && t.remindAt <= now && t.status === "pending");
  const box = document.getElementById("reminderBox");
  if (!allOverdue.length) { box.style.display="none"; return; }
  box.style.display = "block";
  document.getElementById("reminderList").innerHTML = allOverdue.map(t =>
    `<div style="margin-top:4px;font-size:.76rem">• <strong>${esc(t.reason)}</strong> — <a href="${esc(t.url)}" target="_blank" style="color:var(--warn)">${esc(t.url)}</a></div>`
  ).join("");

  if (due.length) render();
}

// ── Export / Import ─────────────────────────────────────────────────
document.getElementById("exportBtn").onclick = () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(tabs,null,2)],{type:"application/json"}));
  a.download = "tab-reminder-backup.json"; a.click();
  showToast("📦 Exported!");
};
document.getElementById("importBtn").onclick = () => document.getElementById("importFile").click();
document.getElementById("importFile").addEventListener("change", e => {
  const f=e.target.files[0]; if(!f) return;
  const r=new FileReader();
  r.onload=ev=>{
    try {
      const d=JSON.parse(ev.target.result);
      if(Array.isArray(d)){tabs=d;save();render();showToast("✅ Imported "+d.length+" tabs")}
      else showToast("❌ Invalid file");
    } catch{showToast("❌ Parse error")}
  };
  r.readAsText(f); e.target.value="";
});

// ── Theme ───────────────────────────────────────────────────────────
const themeBtn = document.getElementById("themeBtn");
if (localStorage.getItem("theme")==="light"){document.body.classList.add("light");themeBtn.textContent="🌙";}
themeBtn.onclick = () => {
  document.body.classList.toggle("light");
  const light = document.body.classList.contains("light");
  themeBtn.textContent = light?"🌙":"☀️";
  localStorage.setItem("theme", light?"light":"dark");
};

// ── Keyboard shortcut ───────────────────────────────────────────────
document.addEventListener("keydown", e => {
  if ((e.ctrlKey||e.metaKey)&&e.key==="/") document.getElementById("url").focus();
});

// ── Stop title flash when user comes back to this tab ───────────────
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) stopTitleFlash();
});

// ── Init ────────────────────────────────────────────────────────────
render();
checkNotifPermission();
checkReminders();
setInterval(checkReminders, 15000);
