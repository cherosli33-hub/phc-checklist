const CACHE = "phc-production-v11";
const ASSETS = ["./", "./index.html", "./inspection.html", "./records.html", "./settings.html", "./css/style.css", "./js/app.js", "./js/api.js", "./js/config.js", "./js/dashboard.js", "./js/inspection.js", "./js/records.js", "./js/settings.js", "./assets/logo.png", "./manifest.json"];
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET") return;
  const networkFirst=event.request.mode==="navigate"||["document","script","style"].includes(event.request.destination);
  if(networkFirst){
    event.respondWith(fetch(event.request).then(response=>{ if(response.ok){ const copy=response.clone(); caches.open(CACHE).then(cache=>cache.put(event.request,copy)); } return response; }).catch(()=>caches.match(event.request).then(cached=>cached||caches.match("./index.html"))));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{ if(response.ok){ const copy=response.clone(); caches.open(CACHE).then(cache=>cache.put(event.request,copy)); } return response; })));
});
