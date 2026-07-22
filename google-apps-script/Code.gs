const APP_VERSION = '2.1.0';
const SHEETS = Object.freeze({
  inspections: 'PEMERIKSAAN',
  checks: 'ITEM CHECK',
  findings: 'PENEMUAN',
  master: 'MASTER ITEM',
});
const MONTHS = ['Januari','Februari','Mac','April','Mei','Jun','Julai','Ogos','September','Oktober','November','Disember'];
const VALID_BAGS = ['PHC 1','PHC 2'];
const VALID_SHIFTS = ['Pagi','Petang','Malam'];

function doGet(e) {
  try {
    const action = String((e && e.parameter && e.parameter.action) || 'health');
    if (action === 'health') return json_({ok:true, app:'PHC Checklist', version:APP_VERSION, time:new Date().toISOString()});
    if (action === 'records') return json_({ok:true, records:getRecords_(e.parameter.from, e.parameter.to)});
    return json_({ok:false, message:'Tindakan tidak dikenali.'});
  } catch (error) {
    return json_({ok:false, message:error.message || String(error)});
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (payload.action === 'saveInspection') return json_(saveInspection_(payload.record, payload.appVersion));
    if (payload.action === 'resolveFinding') return json_(resolveFinding_(payload.findingId, payload.resolution));
    return json_({ok:false, message:'Tindakan tidak dikenali.'});
  } catch (error) {
    return json_({ok:false, message:error.message || String(error)});
  }
}

function resolveFinding_(findingId, resolution) {
  const id = safeText_(findingId, 100);
  const action = safeText_(resolution, 200);
  if (!id || !action) throw new Error('ID penemuan dan tindakan diperlukan.');
  const sheet = requiredSheet_(getSpreadsheet_(), SHEETS.findings);
  if (sheet.getLastRow() < 2) throw new Error('Penemuan tidak ditemui.');
  const match = sheet.getRange(2,1,sheet.getLastRow()-1,1).createTextFinder(id).matchEntireCell(true).findNext();
  if (!match) throw new Error('Penemuan tidak ditemui.');
  sheet.getRange(match.getRow(),11,1,2).setValues([[action,'SELESAI']]);
  SpreadsheetApp.flush();
  return {ok:true, findingId:id, status:'SELESAI', savedAt:new Date().toISOString()};
}

function saveInspection_(record, clientVersion) {
  const checked = validateRecord_(record);
  const spreadsheet = getSpreadsheet_();
  const inspectionSheet = requiredSheet_(spreadsheet, SHEETS.inspections);
  const checkSheet = requiredSheet_(spreadsheet, SHEETS.checks);
  const findingSheet = requiredSheet_(spreadsheet, SHEETS.findings);
  const master = loadMaster_(spreadsheet, checked.bag);
  const items = flattenItems_(checked, master);
  const expected = checked.bag === 'PHC 1' ? 78 : 75;
  if (items.length !== expected) throw new Error(`Bilangan item ${checked.bag} tidak tepat. Dijangka ${expected}, diterima ${items.length}.`);

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    if (idExists_(inspectionSheet, checked.id)) {
      return {ok:true, duplicate:true, id:checked.id, savedAt:new Date().toISOString()};
    }
    const date = parseIsoDate_(checked.date);
    const timestamp = new Date(checked.savedAt);
    const monthNumber = date.getMonth() + 1;
    const monthName = MONTHS[monthNumber - 1];
    const shortageCount = items.filter(item => item.qty < item.standard).length;
    inspectionSheet.appendRow([
      checked.id, checked.checkKey, timestamp, date, monthName, monthNumber, date.getFullYear(),
      checked.bag, checked.shift, checked.ppp, items.length, shortageCount, checked.notes,
      'SYNCED', safeText_(clientVersion || APP_VERSION, 30),
    ]);

    const checkRows = items.map(item => [
      checked.id, checked.checkKey, timestamp, date, monthName, monthNumber, date.getFullYear(),
      checked.bag, checked.shift, checked.ppp, item.categoryId, item.categoryName, item.name,
      item.standard, item.qty, item.standard - item.qty, item.qty < item.standard ? 'KURANG' : 'LENGKAP',
      safeText_(clientVersion || APP_VERSION, 30),
    ]);
    appendRows_(checkSheet, checkRows);

    const findingRows = items.filter(item => item.qty < item.standard).map((item, index) => [
      `${checked.id}-F${String(index + 1).padStart(3, '0')}`, checked.id, date, monthName,
      monthNumber, date.getFullYear(), `${checked.bag} / ${checked.shift}`, item.name,
      item.qty, item.standard, '', '', checked.notes,
    ]);
    appendRows_(findingSheet, findingRows);
    SpreadsheetApp.flush();
    return {ok:true, id:checked.id, savedAt:new Date().toISOString(), itemCount:items.length, findingCount:findingRows.length};
  } finally {
    lock.releaseLock();
  }
}

function getRecords_(fromText, toText) {
  const spreadsheet = getSpreadsheet_();
  const inspectionSheet = requiredSheet_(spreadsheet, SHEETS.inspections);
  const checkSheet = requiredSheet_(spreadsheet, SHEETS.checks);
  const from = fromText ? parseIsoDate_(fromText) : new Date(2000,0,1);
  const to = toText ? parseIsoDate_(toText) : new Date(2100,11,31);
  const rows = dataRows_(inspectionSheet, 15).filter(row => row[0]);
  const selected = rows.filter(row => {
    const date = normaliseDate_(row[3]); return date >= from && date <= to;
  });
  const ids = new Set(selected.map(row => String(row[0])));
  const itemRows = dataRows_(checkSheet, 18).filter(row => ids.has(String(row[0])));
  const quantitiesById = {};
  itemRows.forEach(row => {
    const id = String(row[0]); const categoryId = String(row[10]);
    quantitiesById[id] = quantitiesById[id] || {};
    quantitiesById[id][categoryId] = quantitiesById[id][categoryId] || {items:[]};
    quantitiesById[id][categoryId].items.push({name:String(row[12]), standard:Number(row[13]), qty:Number(row[14])});
  });
  return selected.map(row => ({
    id:String(row[0]), checkKey:String(row[1]), savedAt:normaliseDateTime_(row[2]), date:formatIsoDate_(row[3]),
    time:Utilities.formatDate(normaliseDate_(row[2]), Session.getScriptTimeZone() || 'Asia/Kuala_Lumpur', 'HH:mm'),
    bag:String(row[7]), shift:String(row[8]), ppp:String(row[9]), notes:String(row[12] || ''),
    syncStatus:'SYNCED', appVersion:String(row[14] || ''), quantities:quantitiesById[String(row[0])] || {},
  }));
}

function validateRecord_(record) {
  if (!record || typeof record !== 'object') throw new Error('Rekod pemeriksaan tidak sah.');
  const checked = {
    id:safeText_(record.id, 80), checkKey:safeText_(record.checkKey, 80), savedAt:safeText_(record.savedAt, 40),
    date:safeText_(record.date, 10), bag:safeText_(record.bag, 10), shift:safeText_(record.shift, 10),
    ppp:safeText_(record.ppp, 100), notes:safeText_(record.notes || '', 1000), quantities:record.quantities,
  };
  if (!checked.id || !checked.checkKey || !checked.ppp) throw new Error('ID, kunci pemeriksaan dan nama PPP diperlukan.');
  if (!VALID_BAGS.includes(checked.bag)) throw new Error('Beg PHC tidak sah.');
  if (!VALID_SHIFTS.includes(checked.shift)) throw new Error('Shift tidak sah.');
  if (Number.isNaN(new Date(checked.savedAt).getTime())) throw new Error('Masa simpan tidak sah.');
  const expectedKey = `${checked.date}|${checked.bag}|${checked.shift}`;
  if (checked.checkKey !== expectedKey) throw new Error('Kunci pemeriksaan tidak sepadan.');
  parseIsoDate_(checked.date);
  if (!checked.quantities || typeof checked.quantities !== 'object') throw new Error('Data kuantiti tidak lengkap.');
  return checked;
}

function loadMaster_(spreadsheet, bag) {
  const rows = dataRows_(requiredSheet_(spreadsheet, SHEETS.master), 9).filter(row => String(row[6]) === 'AKTIF');
  const map = {};
  rows.filter(row => String(row[1]) === 'Kedua-dua' || String(row[1]) === bag).forEach(row => {
    map[`${row[2]}|${row[4]}`] = {categoryId:String(row[2]), categoryName:String(row[3]), name:String(row[4]), standard:Number(row[5])};
  });
  return map;
}

function flattenItems_(record, master) {
  const result = []; const seen = new Set();
  Object.keys(record.quantities).forEach(categoryId => {
    const group = record.quantities[categoryId];
    if (!group || !Array.isArray(group.items)) throw new Error(`Kategori ${categoryId} tidak lengkap.`);
    group.items.forEach(item => {
      const name = safeText_(item.name, 160); const key = `${categoryId}|${name}`; const source = master[key];
      if (!source) throw new Error(`Item tidak sah: ${name}.`);
      if (seen.has(key)) throw new Error(`Item berulang: ${name}.`); seen.add(key);
      const standard = Number(item.standard); const qty = Number(item.qty);
      if (!Number.isInteger(qty) || qty < 0 || qty > source.standard) throw new Error(`Kuantiti ${name} mesti antara 0 hingga ${source.standard}.`);
      if (standard !== source.standard) throw new Error(`Kuantiti standard ${name} tidak sepadan dengan master.`);
      result.push({...source, qty});
    });
  });
  if (seen.size !== Object.keys(master).length) throw new Error('Checklist tidak lengkap atau tidak sepadan dengan master item.');
  return result;
}

function setupSpreadsheetId(spreadsheetId) {
  const file = SpreadsheetApp.openById(String(spreadsheetId));
  [SHEETS.inspections,SHEETS.checks,SHEETS.findings,SHEETS.master].forEach(name => requiredSheet_(file,name));
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', file.getId());
  return `Google Sheet disambungkan: ${file.getName()}`;
}

function getSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  throw new Error('SPREADSHEET_ID belum ditetapkan.');
}
function requiredSheet_(spreadsheet, name) { const sheet=spreadsheet.getSheetByName(name); if(!sheet) throw new Error(`Tab ${name} tidak ditemui.`); return sheet; }
function dataRows_(sheet, columns) { const last=sheet.getLastRow(); return last < 2 ? [] : sheet.getRange(2,1,last-1,columns).getValues(); }
function appendRows_(sheet, rows) { if(rows.length) sheet.getRange(sheet.getLastRow()+1,1,rows.length,rows[0].length).setValues(rows); }
function idExists_(sheet, id) { if(sheet.getLastRow()<2) return false; return !!sheet.getRange(2,1,sheet.getLastRow()-1,1).createTextFinder(id).matchEntireCell(true).findNext(); }
function safeText_(value, max) { return String(value == null ? '' : value).replace(/[\u0000-\u001F\u007F]/g,' ').trim().slice(0,max); }
function parseIsoDate_(text) { if(!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error('Tarikh tidak sah.'); const parts=text.split('-').map(Number); const date=new Date(parts[0],parts[1]-1,parts[2]); if(date.getFullYear()!==parts[0]||date.getMonth()!==parts[1]-1||date.getDate()!==parts[2]) throw new Error('Tarikh tidak sah.'); return date; }
function normaliseDate_(value) { return value instanceof Date ? value : new Date(value); }
function normaliseDateTime_(value) { return normaliseDate_(value).toISOString(); }
function formatIsoDate_(value) { return Utilities.formatDate(normaliseDate_(value), Session.getScriptTimeZone() || 'Asia/Kuala_Lumpur', 'yyyy-MM-dd'); }
function json_(payload) { return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON); }
