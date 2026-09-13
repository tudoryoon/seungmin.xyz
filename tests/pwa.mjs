import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {Window}=await import(process.env.DOM_MODULE||'happy-dom');
const root=new URL('../',import.meta.url),manifest=JSON.parse(await readFile(new URL('manifest.webmanifest',root),'utf8'));
assert.equal(manifest.id,'/');assert.equal(manifest.start_url,'/');assert.equal(manifest.scope,'/');
assert.equal(manifest.display,'standalone');assert.equal(manifest.orientation,'any');assert.equal(manifest.name,'포털');
assert.equal(manifest.theme_color,'#080f14');
for(const icon of manifest.icons) {
  const png=await readFile(new URL('.'+icon.src,root)),size=Number(icon.sizes.split('x')[0]);
  assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16),size);assert.equal(png.readUInt32BE(20),size);
}
assert.deepEqual(manifest.icons.filter(icon=>icon.purpose==='any').map(icon=>icon.sizes),['192x192','512x512']);
assert.equal(manifest.icons.filter(icon=>icon.purpose==='maskable').length,1);
const source=await readFile(new URL('pwa.js',root),'utf8');
for(const page of ['index.html','test.html','roulette.html']) {
  const window=new Window({settings:{disableCSSFileLoading:true,disableJavaScriptFileLoading:true}});
  try {
    window.document.write(await readFile(new URL(page,root),'utf8'));
    const doc=window.document;
    assert.equal(doc.querySelector('link[rel="manifest"]').getAttribute('href'),'manifest.webmanifest');
    assert.equal(doc.querySelectorAll('meta[name="theme-color"]').length,1);
    assert.equal(doc.querySelector('meta[name="apple-mobile-web-app-capable"]').content,'yes');
    assert.ok(doc.querySelector('meta[name="viewport"]').content.includes('viewport-fit=cover'));
    assert.equal(doc.querySelector('script[src="pwa.js?v=1"]').defer,true);
    assert.ok(doc.querySelector('link[href="pwa.css?v=1"]'));
  }finally{await window.happyDOM.close();}
}
async function boot({standalone=false,ios=false,worker=true,fail=false,button=true}={}) {
  const window=new Window({url:'https://example.test/'}),query=new window.EventTarget(),calls=[];
  query.matches=standalone;window.matchMedia=()=>query;
  window.document.body.innerHTML='<button id="settings-toggle">Settings</button>'+(button?'<button id="install-app" hidden>Install</button>':'');
  Object.defineProperty(window,'isSecureContext',{value:true});
  Object.defineProperty(window.navigator,'standalone',{value:ios});
  if(worker)Object.defineProperty(window.navigator,'serviceWorker',{value:{async register(...args){calls.push(args);if(fail)throw new Error('blocked');return {};},ready:Promise.resolve({})}});
  window.console.warn=()=>{};
  window.localStorage.setItem('seungmin-journal-v1','keep');
  window.eval(source);window.dispatchEvent(new window.Event('load'));
  await new Promise(resolve=>setTimeout(resolve,0));
  return {window,query,calls,button:window.document.getElementById('install-app')};
}
for(const options of [{},{standalone:true},{ios:true},{worker:false},{fail:true},{button:false}]) {
  const test=await boot(options),{window,button,calls}=test;
  try {
    const isApp=options.standalone||options.ios;
    assert.equal(window.document.documentElement.dataset.appMode,isApp?'standalone':'browser');
    if(button)assert.equal(button.hidden,true);
    assert.equal(calls.length,options.worker===false?0:1);
    if(calls.length){assert.equal(calls[0][0],'/sw.js');assert.equal(calls[0][1].scope,'/');assert.equal(calls[0][1].updateViaCache,'none');}
    if(options.fail)assert.equal(window.document.documentElement.dataset.serviceWorker,'unavailable');
    else if(options.worker!==false)assert.equal(window.document.documentElement.dataset.serviceWorker,'ready');
    let prompts=0,finish;
    const event=new window.Event('beforeinstallprompt',{cancelable:true});
    event.prompt=async()=>{prompts++;};event.userChoice=new Promise(resolve=>{finish=resolve;});
    window.dispatchEvent(event);
    assert.equal(event.defaultPrevented,!!button&&!isApp);
    if(button&&!isApp) {
      assert.equal(button.hidden,false);button.click();button.click();assert.equal(prompts,1);
      finish({outcome:'dismissed'});await new Promise(resolve=>setTimeout(resolve,0));
      assert.equal(button.hidden,true);assert.equal(button.disabled,false);
      window.dispatchEvent(event);assert.equal(button.hidden,false);
      test.query.matches=true;test.query.dispatchEvent(new window.Event('change'));assert.equal(button.hidden,true);
      test.query.matches=false;test.query.dispatchEvent(new window.Event('change'));assert.equal(button.hidden,false);
      window.dispatchEvent(new window.Event('appinstalled'));assert.equal(button.hidden,true);
      window.dispatchEvent(event);assert.equal(button.hidden,true);
    }
    assert.equal(window.localStorage.getItem('seungmin-journal-v1'),'keep');
  }finally{await window.happyDOM.close();}
}
console.log('PASS: manifest/icons, all entrypoints, standalone/iOS detection, guarded install prompt, registration failure and untouched user storage.');
