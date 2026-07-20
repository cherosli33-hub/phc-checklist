import { STORAGE_KEY, LATEST_INVENTORY_KEY } from "./app.js";

const modal=document.querySelector("#settingsModal");
const content={
  ppp:["Senarai PPP","Dalam prototaip ini, nama PPP dimasukkan melalui kotak teks semasa pemeriksaan. Senarai pilihan boleh disambungkan kepada Google Sheet dalam fasa production."],
  quantity:["Kuantiti Standard","Kuantiti standard telah disalin daripada buku checklist asal. PHC 1 mempunyai 7 kategori; PHC 2 mempunyai 6 kategori dan tidak mengandungi Dextrostix Kit."],
  about:["Tentang aplikasi","PHC Inventory Prototype V1 dibina untuk menguji aliran kerja, navigasi dan pengalaman PPP sebelum integrasi Google Apps Script dan Google Sheet."]
};
function openModal(key){ const [heading,copy]=content[key]; modal.hidden=false; modal.innerHTML=`<section class="modal" role="dialog" aria-modal="true"><div class="modal-handle"></div><div class="modal-head"><h2>${heading}</h2><button class="modal-close" aria-label="Tutup">×</button></div><p style="font-size:12px;line-height:1.7;color:var(--muted)">${copy}</p><button class="button primary full modal-close">Faham</button></section>`; }
document.querySelectorAll("[data-setting]").forEach(button=>button.addEventListener("click",()=>openModal(button.dataset.setting)));
modal.addEventListener("click",event=>{ if(event.target===modal || event.target.closest(".modal-close")) modal.hidden=true; });
document.querySelector("#resetDemo").addEventListener("click",()=>{ if(confirm("Padam semua rekod prototaip pada peranti ini?")){ localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(LATEST_INVENTORY_KEY); alert("Data prototaip telah diset semula."); location.href="index.html"; } });
