import { APPS_SCRIPT_URL, API_TIMEOUT_MS, APP_VERSION } from "./config.js";
import { loadPendingSync, loadRestockActions, savePendingSync, saveLatestInventory, saveRestockAction, upsertLocalRecord } from "./app.js";

function configured(){ return /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(APPS_SCRIPT_URL); }

async function request(url, options={}){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),API_TIMEOUT_MS);
  try{
    const response=await fetch(url,{...options,signal:controller.signal,redirect:"follow"});
    const data=await response.json();
    if(!response.ok || data.ok===false) throw new Error(data.message||`Ralat pelayan (${response.status})`);
    return data;
  } finally { clearTimeout(timer); }
}

export function apiConfigured(){ return configured(); }

export async function saveRestockResolution(findingId, action, status="Telah diambil tindakan"){
  if(!configured()) throw new Error("Google Sheet belum disambungkan.");
  return request(APPS_SCRIPT_URL,{
    method:"POST",
    headers:{"Content-Type":"text/plain;charset=utf-8"},
    body:JSON.stringify({action:"resolveFinding",appVersion:APP_VERSION,findingId,resolution:action,status}),
  });
}

export async function fetchRecords(from,to){
  if(!configured()) throw new Error("Google Sheet belum disambungkan.");
  const url=new URL(APPS_SCRIPT_URL); url.searchParams.set("action","records");
  if(from) url.searchParams.set("from",from); if(to) url.searchParams.set("to",to);
  const data=await request(url.toString(),{cache:"no-store"});
  return Array.isArray(data.records)?data.records:[];
}

export async function fetchFindings(from,to){
  if(!configured()) throw new Error("Google Sheet belum disambungkan.");
  const url=new URL(APPS_SCRIPT_URL); url.searchParams.set("action","findings");
  if(from) url.searchParams.set("from",from); if(to) url.searchParams.set("to",to);
  const data=await request(url.toString(),{cache:"no-store"});
  return Array.isArray(data.findings)?data.findings:[];
}

async function sendInspection(record){
  const data=await request(APPS_SCRIPT_URL,{
    method:"POST",
    headers:{"Content-Type":"text/plain;charset=utf-8"},
    body:JSON.stringify({action:"saveInspection",appVersion:APP_VERSION,record}),
  });
  return {...record,syncStatus:"SYNCED",serverSavedAt:data.savedAt||record.savedAt};
}

export async function saveInspection(record){
  const prepared={...record,appVersion:APP_VERSION,syncStatus:"PENDING"};
  upsertLocalRecord(prepared); saveLatestInventory(prepared); queueInspection(prepared);
  if(configured() && navigator.onLine) syncPendingInspections().catch(()=>{});
  return {record:prepared,synced:false,message:"Rekod disimpan. Sync Google Sheet berjalan di belakang."};
}

let restockSyncPromise=null;
export function syncPendingRestockActions(){
  if(restockSyncPromise) return restockSyncPromise;
  restockSyncPromise=runRestockSync().finally(()=>{ restockSyncPromise=null; });
  return restockSyncPromise;
}

async function runRestockSync(){
  const actions=loadRestockActions(); const pending=Object.entries(actions).filter(([,value])=>value.syncStatus!=="SYNCED"&&value.findingId);
  if(!configured()||!navigator.onLine) return {synced:0,pending:pending.length};
  let synced=0;
  for(const [key,value] of pending){ try{ await saveRestockResolution(value.findingId,value.action,value.status||"Telah diambil tindakan"); saveRestockAction(key,value.action,{findingId:value.findingId,status:value.status||"Telah diambil tindakan",syncStatus:"SYNCED"}); synced++; }catch{} }
  return {synced,pending:pending.length-synced};
}

export function queueInspection(record){
  const pending=loadPendingSync();
  if(!pending.some(item=>item.id===record.id)) pending.push(record);
  savePendingSync(pending);
}

let inspectionSyncPromise=null;
export function syncPendingInspections(){
  if(inspectionSyncPromise) return inspectionSyncPromise;
  inspectionSyncPromise=runInspectionSync().finally(()=>{ inspectionSyncPromise=null; });
  return inspectionSyncPromise;
}

async function runInspectionSync(){
  if(!configured() || !navigator.onLine) return {synced:0,pending:loadPendingSync().length};
  let synced=0; const queue=[...loadPendingSync()];
  for(const record of queue){
    if(!navigator.onLine) break;
    try{
      const saved=await sendInspection(record); upsertLocalRecord(saved); saveLatestInventory(saved);
      savePendingSync(loadPendingSync().filter(item=>item.id!==record.id)); synced+=1;
    }catch{
      // Rekod lama mungkin sudah berada dalam Sheet tetapi respons sync terdahulu
      // tidak sempat diterima oleh telefon. Sahkan melalui checkKey sebelum membuangnya.
      try{
        const remote=await fetchRecords(record.date,record.date);
        const existing=remote.find(item=>item.checkKey===record.checkKey);
        const remoteTime=new Date(existing?.savedAt||0).getTime();
        const localTime=new Date(record.savedAt||0).getTime();
        if(existing && remoteTime>=localTime){
          upsertLocalRecord(existing); if(existing.quantities) saveLatestInventory(existing);
          savePendingSync(loadPendingSync().filter(item=>item.id!==record.id)); synced+=1;
        }
      }catch{}
    }
  }
  return {synced,pending:loadPendingSync().length};
}
