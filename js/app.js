export const CATEGORIES = [
  { id:"airway", name:"Airway & Ventilation", icon:"◉", items:[
    ["Nasal cannula (adult)",2],["Nasal cannula (paed)",2],["High flow mask (adult)",2],["High flow mask (paed)",2],["Nebulizer mask (adult)",2],["Nebulizer mask (paed)",2],["Oropharyngeal airway",5],["Nasopharyngeal airway",2],["Bag Valve Mask (adult)",1],["Bag Valve Mask (paed)",1],["BVM tubing",1],["Endotracheal tube size 7.0mm",1],["Endotracheal tube size 6.5mm",1],["Endotracheal tube size 7.5mm",1],["Endotracheal tube size 8.0mm",1],["Endotracheal tube size 5.0mm",1],["Endotracheal tube size 5.5mm",1],["Endotracheal tube size 6.0mm",1],["Stylet (adult)",1],["Stylet (paed)",1],["Laryngeal mask airway size 2",1],["Laryngeal mask airway size 3",1],["Laryngeal mask airway size 4",1],["Laryngoscope handle",1],["Laryngoscope blade size 2",1],["Laryngoscope blade size 3",1],["Laryngoscope blade size 4",1],["Lubrication gel",1],["Anchor tape",1],["10cc Syringe",2]
  ]},
  { id:"iv", name:"IV Access", icon:"✚", items:[
    ["Branula size 16G",4],["Branula size 18G",4],["Branula size 20G",4],["Branula size 22G",4],["Tegaderm",5],["Alcohol swab",20],["Stopper",2],["3cc Syringe",4],["5cc Syringe",4],["10cc Syringe",4],["Needle size 21G",3],["Needle size 23G",3]
  ]},
  { id:"medication", name:"Medication & Drug", icon:"Rx", items:[
    ["Dextrose 50%",5],["Tab. Aspirin",5],["Sublingual GTN (bottle)",1],["Atropine 1mg",3],["Adrenaline 1mg",5],["Tramadol 50mg",4],["Diclofenac sodium 75mg",2],["Chlorpheniramine Maleate 10mg",2],["Metoclopramide 10mg",2],["Hydrocortisone 100mg",4],["Haloperidol 10mg",2],["Combivent solution",5],["Atrovent solution",5],["Salbutamol solution (bottle)",1],["Water for Injection",5],["Heparin saline",5]
  ]},
  { id:"drip", name:"IV Drip", icon:"滴", items:[
    ["Normal saline 0.9%",1],["Dextrose 10%",1],["Drip set tubing (adult)",1]
  ]},
  { id:"dxt", name:"Dextrostix Kit", icon:"DXT", phc1Only:true, items:[
    ["Dextrostix machine",1],["Dextrostix strips (bottle)",1],["Lancet",10]
  ]},
  { id:"wound", name:"Wound Management", icon:"✥", items:[
    ["Adhesive tape / micropore (roll)",1],["Gauze pack",5],["Cotton pack",5],["Gamgee pack",3],["Arm sling",4],["Crepe bandage 10cm (roll)",3],["Crepe bandage 6cm (roll)",3],["Commercial tourniquet",1]
  ]},
  { id:"personal", name:"Personal Equipment", icon:"▣", items:[
    ["Rescue scissor",1],["Torchlight",1],["Stethoscope",1],["Sterile glove",3],["Chest leads",15],["Spider strapping",1]
  ]}
];

export const SHIFTS = ["Pagi","Petang","Malam"];
export const STORAGE_KEY = "phcPrototypeRecords";
export const LATEST_INVENTORY_KEY = "phcLatestInventory";

export function categoriesForBag(bag){ return CATEGORIES.filter(category => bag === "PHC 1" || !category.phc1Only); }
export function startOfWeek(input=new Date()){ const d=new Date(input); const day=d.getDay() || 7; d.setHours(0,0,0,0); d.setDate(d.getDate()-day+1); return d; }
export function isoDate(date){ const y=date.getFullYear(); const m=String(date.getMonth()+1).padStart(2,"0"); const d=String(date.getDate()).padStart(2,"0"); return `${y}-${m}-${d}`; }
export function formatDate(date, options={weekday:"long",day:"numeric",month:"long",year:"numeric"}){ return new Intl.DateTimeFormat("ms-MY",options).format(date); }
export function loadRecords(){ try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; } }
export function saveRecords(records){ localStorage.setItem(STORAGE_KEY,JSON.stringify(records)); }
export function loadLatestInventory(){ try { return JSON.parse(localStorage.getItem(LATEST_INVENTORY_KEY)) || {}; } catch { return {}; } }
export function saveLatestInventory(record){ const latest=loadLatestInventory(); latest[record.bag]=record; localStorage.setItem(LATEST_INVENTORY_KEY,JSON.stringify(latest)); }
export function getWeekDays(){ const monday=startOfWeek(); return Array.from({length:7},(_,i)=>{ const d=new Date(monday); d.setDate(monday.getDate()+i); return d; }); }
export function recordLowItems(record){ if(!record?.quantities) return []; return Object.values(record.quantities).flatMap(category => category.items || []).filter(item => item.qty < item.standard); }

export function seedDemoRecords(){
  const existing=loadRecords(); if(existing.length) return existing;
  const days=getWeekDays(); const now=new Date();
  const demo=[
    {id:"demo-1",date:isoDate(days[0]),time:"08:12",bag:"PHC 1",shift:"Pagi",ppp:"Rosli",notes:"Semua peralatan lengkap.",quantities:{},prototype:true},
    {id:"demo-2",date:isoDate(days[0]),time:"15:06",bag:"PHC 2",shift:"Petang",ppp:"Fairuz",notes:"Perlu restock selepas penggunaan.",quantities:{medication:{items:[{name:"Adrenaline 1mg",qty:3,standard:5}]},iv:{items:[{name:"Branula size 18G",qty:2,standard:4}]}},prototype:true},
    {id:"demo-3",date:isoDate(days[Math.min(1,Math.max(0,(now.getDay()||7)-1))]),time:"07:48",bag:"PHC 1",shift:"Pagi",ppp:"Sofia",notes:"",quantities:{},prototype:true}
  ]; saveRecords(demo); return demo;
}

export function registerServiceWorker(){
  if(typeof navigator==="undefined"||!("serviceWorker" in navigator)||location.protocol==="file:") return;
  let refreshing=false;
  navigator.serviceWorker.addEventListener("controllerchange",()=>{ if(!refreshing){ refreshing=true; location.reload(); } });
  window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js",{updateViaCache:"none"}).then(registration=>registration.update()).catch(()=>{}));
}
registerServiceWorker();
