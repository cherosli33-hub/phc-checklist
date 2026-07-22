import { SHIFTS, formatDate, getWeekDays, isoDate, loadLatestInventory, loadPendingSync, loadRecords, loadRestockActions, recordLowItems, saveLatestInventory, saveRestockAction, upsertLocalRecord } from "./app.js";
import { apiConfigured, fetchRecords, saveRestockResolution, syncPendingInspections } from "./api.js";

const content=document.querySelector("#dashboardContent");
const restockModal=document.querySelector("#restockModal");
const weekDays=getWeekDays(); const now=new Date(); const today=isoDate(now);
const shortDay=["Isn","Sel","Rab","Kha","Jum","Sab","Ahd"];
let records=loadRecords(); let connectionMessage="";

function recordTimestamp(record){ return new Date(record.savedAt||`${record.date}T${record.time||"00:00"}`).getTime()||0; }
function latestUniqueRecords(items){ const seen=new Set(); return [...items].sort((a,b)=>recordTimestamp(b)-recordTimestamp(a)).filter(record=>{ const key=record.checkKey||`${record.date}|${record.bag}|${record.shift}`; if(seen.has(key)) return false; seen.add(key); return true; }); }
function statusIcon(done){ return `<span class="state-dot ${done?"done":"missing"}">${done?"✓":"×"}</span>`; }
function weekStatus(date){ const dateKey=isoDate(date); if(date>now) return "pending"; return records.some(record=>record.date===dateKey)?"done":"missing"; }
function esc(value=""){ return String(value).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c])); }
function shortageKey(record,item){ return `${record.id}|${item.name}`; }
function newestRecord(items){ return items.filter(Boolean).sort((a,b)=>recordTimestamp(b)-recordTimestamp(a))[0]; }

function render(){
  const unique=latestUniqueRecords(records); const todayRecords=unique.filter(record=>record.date===today);
  const completed=new Set(todayRecords.map(record=>`${record.bag}-${record.shift}`));
  const expected=[...SHIFTS.map(shift=>`PHC 1-${shift}`),...SHIFTS.map(shift=>`PHC 2-${shift}`)];
  const next=expected.find(key=>!completed.has(key)); const savedLatest=loadLatestInventory();
  const latestInventory=["PHC 1","PHC 2"].map(bag=>newestRecord([savedLatest[bag],...unique.filter(record=>record.bag===bag&&record.quantities)])).filter(Boolean);
  const actions=loadRestockActions();
  const lowItems=latestInventory.flatMap(record=>recordLowItems(record).map((item,index)=>({...item,bag:record.bag,shift:record.shift,date:record.date,recordId:record.id,findingId:`${record.id}-F${String(index+1).padStart(3,"0")}`,key:shortageKey(record,item)}))).filter(item=>!actions[item.key]);
  const pending=loadPendingSync().length;
  const bagCard=bag=>`<article class="card bag-card"><div class="bag-title"><span class="bag-badge">▣</span><h3>Beg ${bag}</h3></div><div class="shift-list">${SHIFTS.map(shift=>`<div class="shift-row"><span>${shift}</span>${statusIcon(completed.has(`${bag}-${shift}`))}</div>`).join("")}</div></article>`;
  content.innerHTML=`
    ${pending||connectionMessage?`<div class="connection-banner ${pending?"pending":"info"}"><strong>${pending?`${pending} rekod menunggu sync`:"Status sambungan"}</strong><span>${esc(connectionMessage||"Rekod akan dihantar semula apabila internet tersedia.")}</span></div>`:""}
    <section class="date-line"><div><p class="eyebrow">HARI INI</p><h1>${formatDate(now,{weekday:"long",day:"numeric",month:"long"})}</h1></div><span class="live-time" id="liveTime"></span></section>
    <section class="card next-card"><span class="label">TINDAKAN SETERUSNYA</span>${next?`<h2>${next.replace("-"," · Shift ")}</h2><p>Pemeriksaan ini masih belum dilengkapkan.</p>`:`<h2>Semua pemeriksaan lengkap</h2><p>Semua beg dan shift sudah disemak hari ini.</p>`}</section>
    <section class="card status-summary"><div class="section-head"><h2>Status Hari Ini</h2><span class="state-dot ${completed.size===6?"done":"pending"}">${completed.size===6?"✓":"!"}</span></div><div class="progress-row"><div class="progress-ring" style="--progress:${Math.round(completed.size/6*100)}%"><strong>${completed.size}/6</strong></div><div class="progress-copy"><strong>${completed.size} pemeriksaan selesai</strong><small>2 beg × 3 shift setiap hari</small></div></div></section>
    <section class="bag-grid">${bagCard("PHC 1")}${bagCard("PHC 2")}</section>
    <button class="card alert-card" id="restockButton"><span class="alert-icon">⚠</span><span><strong>${lowItems.length} item perlu restock</strong><small>Tekan untuk lihat senarai</small></span><b>›</b></button>
    <section class="card week-card"><div class="section-head"><h2>Rekod Minggu Ini</h2><a href="records.html">Lihat semua</a></div><div class="week-strip">${weekDays.map((date,i)=>{const status=weekStatus(date); return `<div class="week-day"><span>${shortDay[i]}</span><b class="${status}">${status==="done"?"✓":status==="missing"?"×":"–"}</b></div>`}).join("")}</div></section>
    <button class="primary-cta" onclick="location.href='inspection.html'">＋ MULAKAN PEMERIKSAAN</button>`;
  document.querySelector("#restockButton").addEventListener("click",()=>showRestock(lowItems)); updateClock();
}

function showRestock(lowItems){
  if(!lowItems.length){ alert("Tiada item perlu restock."); return; }
  restockModal.hidden=false;
  restockModal.innerHTML=`<section class="modal restock-modal" role="dialog" aria-modal="true" aria-label="Item perlu restock"><div class="modal-handle"></div><div class="modal-head"><div><p class="eyebrow">AMARAN STOK</p><h2>Item Perlu Restock</h2></div><button class="modal-close" aria-label="Tutup">×</button></div><p class="restock-help">Catat tindakan selepas stok diambil, kemudian tekan <strong>Selesai</strong>.</p><div class="restock-table">${lowItems.map(item=>`<div class="restock-table-row" data-restock-key="${esc(item.key)}" data-finding-id="${esc(item.findingId)}"><div class="restock-summary"><span><strong>${esc(item.name)}</strong><small>Standard ${item.standard} · ${item.bag} · ${item.shift}</small></span><span class="restock-qty">${item.qty}/${item.standard}</span></div><div class="restock-action"><label>Tindakan diambil</label><div><input class="restock-action-input" placeholder="Contoh: Stok telah ditambah" maxlength="200"><button class="restock-done" data-complete-restock="${esc(item.key)}">Selesai</button></div></div></div>`).join("")}</div></section>`;
}
function updateClock(){ const el=document.querySelector("#liveTime"); if(el) el.textContent=new Intl.DateTimeFormat("ms-MY",{hour:"2-digit",minute:"2-digit",hour12:true}).format(new Date()); }

async function refresh(){
  if(!apiConfigured()){ connectionMessage="Google Sheet belum disambungkan."; render(); return; }
  await syncPendingInspections();
  try{
    const remote=await fetchRecords(isoDate(weekDays[0]),isoDate(weekDays[6]));
    remote.forEach(record=>{ upsertLocalRecord(record); if(record.quantities) saveLatestInventory(record); });
    records=loadRecords(); connectionMessage="";
  }catch(error){ connectionMessage=`Paparan menggunakan rekod peranti: ${error.message}`; }
  render();
}

restockModal.addEventListener("click",async event=>{
  if(event.target===restockModal||event.target.closest(".modal-close")){ restockModal.hidden=true; return; }
  const button=event.target.closest("[data-complete-restock]"); if(!button) return;
  const row=button.closest("[data-restock-key]"); const input=row.querySelector(".restock-action-input"); const action=input.value.trim();
  if(!action){ input.focus(); input.classList.add("invalid"); return; }
  button.disabled=true; button.textContent="Simpan...";
  saveRestockAction(button.dataset.completeRestock,action);
  try{ await saveRestockResolution(row.dataset.findingId,action); }catch(error){ connectionMessage=`Tindakan disimpan pada peranti: ${error.message}`; }
  row.remove(); render();
  if(!restockModal.querySelector("[data-restock-key]")) restockModal.hidden=true;
});
window.addEventListener("online",refresh); window.addEventListener("pageshow",event=>{ if(event.persisted) refresh(); });
render(); setInterval(updateClock,30000); refresh();
