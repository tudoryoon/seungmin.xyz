(() => {
  const standalone=matchMedia('(display-mode: standalone)');
  const installButton=document.getElementById('install-app');
  let pendingInstall=null,installed=false;
  const isStandalone=()=>standalone.matches||navigator.standalone===true;
  function sync() {
    document.documentElement.dataset.appMode=isStandalone()?'standalone':'browser';
    if(!installButton)return;
    const hidden=!pendingInstall||installed||isStandalone();
    if(hidden&&document.activeElement===installButton)document.getElementById('settings-toggle')?.focus();
    installButton.hidden=hidden;
  }
  window.addEventListener('beforeinstallprompt',event=>{
    if(!installButton||isStandalone()||installed)return;
    event.preventDefault();pendingInstall=event;sync();
  });
  window.addEventListener('appinstalled',()=>{installed=true;pendingInstall=null;sync();});
  standalone.addEventListener('change',sync);
  window.addEventListener('pageshow',sync);
  installButton?.addEventListener('click',async()=>{
    if(!pendingInstall||installButton.disabled)return;
    const prompt=pendingInstall;pendingInstall=null;installButton.disabled=true;
    try {await prompt.prompt();await prompt.userChoice;}
    catch(error) {console.warn('App installation was not completed.',error);}
    finally {installButton.disabled=false;sync();}
  });
  sync();
  async function register() {
    if(!('serviceWorker' in navigator)||!window.isSecureContext)return;
    try {
      await navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'});
      document.documentElement.dataset.serviceWorker='registered';
      await navigator.serviceWorker.ready;
      document.documentElement.dataset.serviceWorker='ready';
    }catch(error) {
      document.documentElement.dataset.serviceWorker='unavailable';
      console.warn('Offline fallback is unavailable.',error);
    }
  }
  if(document.readyState==='complete')register();
  else window.addEventListener('load',register,{once:true});
})();
