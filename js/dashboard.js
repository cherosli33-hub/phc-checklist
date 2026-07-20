import { SHIFTS, formatDate, getWeekDays, isoDate, seedDemoRecords, recordLowItems } from "./app.js";

const content=document.querySelector("#dashboardContent");
const records=seedDemoRecords();
const now=new Date(); const today=isoDate(now);
const todayRecords=records.filter(record=>record.date===today);
const completed=new Set(todayRecords.map(record=>`${record.bag}-${record.shift}`));
const expected=[...SHIFTS.map(shift=>`PHC 1-${shift}`),...SHIFTS.map(shift=>`PHC 2-${shift}`)];
const next=expected.find(key=>!completed.has(key));
const latestInventoryRecords=["PHC 1","PHC 2"].map(bag=>records
  .filter(record=>record.bag===bag&&record.quantities&&Object.keys(record.quantities).length)
  .sort((a,b)=>recordTimestamp(b)-recordTimestamp(a))[0]
).filter(Boolean);
const lowItems=latestInventoryRecords.flatMap(record=>recordLowItems(record).map(item=>({...item,bag:record.bag,shift:record.shift,date:record.date})));
const restockModal=document.querySelector("#restockModal");
const weekDays=getWeekDays();
const shortDay=["Isn","Sel","Rab","Kha","Jum","Sab","Ahd"];

function recordTimestamp(record){ return new Date(`${record.date}T${record.time||"00:00"}`).getTime()||0; }
function statusIcon(done){ return `<span class="state-dot ${done?"done":"missing"}">${done?"✓":"×"}</span>`; }
function bagCard(bag){ return `<article class="card bag-card"><div class="bag-title"><span class="bag-badge">▣</span><h3>Beg ${bag}</h3></div><div class="shift-list">${SHIFTS.map(shift=>`<div class="shift-row"><span>${shift}</span>${statusIcon(completed.has(`${bag}-${shift}`))}</div>`).join("")}</div></article>`; }
function weekStatus(date){ const dateKey=isoDate(date); const count=records.filter(record=>record.date===dateKey).length; if(date>now) return "pending"; return count>0?"done":"missing"; }

content.innerHTML=`
  <section class="date-line"><div><p class="eyebrow">HARI INI</p><h1>${formatDate(now,{weekday:"long",day:"numeric",month:"long"})}</h1></div><span class="live-time" id="liveTime"></span></section>
  <section class="card next-card"><span class="label">TINDAKAN SETERUSNYA</span>${next?`<h2>${next.replace("-"," · Shift ")}</h2><p>Pemeriksaan ini masih belum dilengkapkan.</p>`:`<h2>Semua pemeriksaan lengkap</h2><p>Terima kasih. Semua beg dan shift sudah disemak hari ini.</p>`}</section>
  <section class="card status-summary"><div class="section-head"><h2>Status Hari Ini</h2><span class="state-dot ${completed.size===6?"done":"pending"}">${completed.size===6?"✓":"!"}</span></div><div class="progress-row"><div class="progress-ring" style="--progress:${Math.round(completed.size/6*100)}%"><strong>${completed.size}/6</strong></div><div class="progress-copy"><strong>${completed.size} pemeriksaan selesai</strong><small>2 beg × 3 shift setiap hari</small></div></div></section>
  <section class="bag-grid">${bagCard("PHC 1")}${bagCard("PHC 2")}</section>
  <button class="card alert-card" id="restockButton"><span class="alert-icon">⚠</span><span><strong>${lowItems.length} item perlu restock</strong><small>Tekan untuk lihat senarai</small></span><b>›</b></button>
  <section class="card week-card"><div class="section-head"><h2>Rekod Minggu Ini</h2><a href="records.html">Lihat semua</a></div><div class="week-strip">${weekDays.map((date,i)=>{const status=weekStatus(date); return `<div class="week-day"><span>${shortDay[i]}</span><b class="${status}">${status==="done"?"✓":status==="missing"?"×":"–"}</b></div>`}).join("")}</div></section>
  <button class="primary-cta" onclick="location.href='inspection.html'">＋ MULAKAN PEMERIKSAAN</button>`;

function updateClock(){ document.querySelector("#liveTime").textContent=new Intl.DateTimeFormat("ms-MY",{hour:"2-digit",minute:"2-digit",hour12:true}).format(new Date()); }
updateClock(); setInterval(updateClock,30000);
document.querySelector("#restockButton").addEventListener("click",()=>{
  if(!lowItems.length){ alert("Tiada item perlu restock dalam data prototaip."); return; }
  restockModal.hidden=false;
  restockModal.innerHTML=`<section class="modal" role="dialog" aria-modal="true" aria-label="Item perlu restock"><div class="modal-handle"></div><div class="modal-head"><div><p class="eyebrow">AMARAN STOK</p><h2>Item Perlu Restock</h2></div><button class="modal-close" aria-label="Tutup">×</button></div><div class="restock-table"><div class="restock-table-head"><span>Item</span><span>Beg & shift</span><span>Qty</span></div>${lowItems.map(item=>`<div class="restock-table-row"><span><strong>${item.name}</strong><small>Standard ${item.standard}</small></span><span><b>${item.bag}</b><small>${item.shift}</small></span><span class="restock-qty">${item.qty}/${item.standard}</span></div>`).join("")}</div></section>`;
});
restockModal.addEventListener("click",event=>{ if(event.target===restockModal||event.target.closest(".modal-close")) restockModal.hidden=true; });
