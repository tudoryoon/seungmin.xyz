import {createLibraryStore,inspectFile,libraryError,normalizeUrl} from './library-store.js?v=20260913-7';

const $ = id => document.getElementById(id);
const cloud = window.journalCloud;
const store = createLibraryStore(window.realmClient,()=>({id:cloud.user?.id,version:cloud.version}));
let items = [], loaded = false, loading = false, trash = false, busy = false;
let revision = 0, listRequest = 0, paintRequest = 0, previewRequest = 0;
let editing = null, linkId = null, jobs = [], previewBlob = null;
const active = () => document.body.dataset.view === 'library';
const current = version => version === revision && Boolean(cloud.user);
const icons = () => window.lucide?.createIcons();
function make(tag,text,className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function icon(name) {const node=make('i');node.dataset.lucide=name;return node;}
function tool(name,label,action) {
  const button=make('button',undefined,'library-icon');button.type='button';button.title=label;button.setAttribute('aria-label',label);
  button.append(icon(name));button.addEventListener('click',action);return button;
}
const fileSize = bytes => bytes>=1024*1024 ? `${(bytes/(1024*1024)).toFixed(1)} MB` : `${Math.max(1,Math.round(bytes/1024))} KB`;
function available() {return !busy && loaded && !loading && Boolean(cloud.user);}
function controls() {
  for (const id of ['add-link','add-files']) $(id).disabled=!available();
  for (const id of ['sign-out','refresh-records']) $(id).disabled=busy;
  $('library-grid').querySelectorAll('button').forEach(button=>button.disabled=busy);
  $('link-form').querySelectorAll('input,textarea').forEach(input=>input.disabled=busy);
}
function merge(item) {items=items.filter(row=>row.id!==item.id).concat(item);render();}
function clearPreview() {
  previewRequest++;
  if(previewBlob) URL.revokeObjectURL(previewBlob);
  previewBlob=null;$('preview-content').replaceChildren();
  for(const id of ['preview-open','preview-download']) {$(id).hidden=true;$(id).removeAttribute('href');}
}
async function preview(item) {
  if(!available())return;
  clearPreview();
  const request=previewRequest, version=revision;
  $('preview-title').textContent=item.title;$('preview-status').textContent='불러오는 중…';$('resource-preview').showModal();
  try {
    const blob=await store.download(item);
    if(!current(version)||request!==previewRequest)return;
    previewBlob=URL.createObjectURL(blob);
    const media=make(item.kind==='image'?'img':'iframe');
    if(item.kind==='image') media.alt=item.title;
    else {media.title=item.title;media.setAttribute('sandbox','');}
    media.src=previewBlob;
    $('preview-content').replaceChildren(media);$('preview-status').textContent='';
    $('preview-download').href=previewBlob;$('preview-download').download=item.file_name;$('preview-download').hidden=false;
    $('preview-open').href=previewBlob;$('preview-open').hidden=false;
  } catch(error) {if(current(version)&&request===previewRequest)$('preview-status').textContent=libraryError(error);}
}
async function thumbnail(item,node,paint,version) {
  try {
    const url=await store.preview(item);
    if(!current(version)||paint!==paintRequest||!node.isConnected)return;
    const image=make('img');image.alt='';image.loading='lazy';image.decoding='async';image.referrerPolicy='no-referrer';image.src=url;
    image.addEventListener('error',()=>image.remove(),{once:true});node.append(image);
  } catch { /* The file can still be opened or retried from its card. */ }
}
function render() {
  const paint=++paintRequest, version=revision;
  const query=$('library-search').value.trim().toLocaleLowerCase();
  const filter=$('library-filter').value;
  const filtered=items.filter(item=>Boolean(item.archived)===trash && (filter==='all'||item.kind===filter)
    && [item.title,item.notes,item.url,item.file_name].filter(Boolean).join(' ').toLocaleLowerCase().includes(query))
    .sort((a,b)=>b.created_at.localeCompare(a.created_at)||a.id.localeCompare(b.id));
  $('library-count').textContent=loading?'불러오는 중…':`${trash?'휴지통 · ':''}${filtered.length}개`;
  $('library-grid').setAttribute('aria-busy',String(loading));
  $('library-empty').hidden=loading||filtered.length>0;
  $('library-empty-label').textContent=!loaded?'자료를 불러오지 못했습니다.':query||filter!=='all'?'검색 결과가 없습니다.':trash?'휴지통이 비어 있습니다.':'저장된 자료가 없습니다.';
  const thumbnails=[];
  $('library-grid').replaceChildren(...filtered.map(item=>{
    const card=make('article',undefined,'resource-card');card.dataset.kind=item.kind;
    let safe;
    try {if(item.kind==='link')safe=normalizeUrl(item.url);} catch {}
    const media=make(item.kind==='link'&&safe?'a':'button',undefined,'resource-media');
    media.setAttribute('aria-label',item.title+' 열기');media.title=item.title+' 열기';
    if(safe){media.href=safe;media.target='_blank';media.rel='noopener noreferrer';}
    else {media.type='button';media.addEventListener('click',()=>preview(item));}
    media.append(icon(item.kind==='link'?'link':item.kind==='pdf'?'file-text':'image'));
    const body=make('div',undefined,'resource-body');body.append(make('h2',item.title,'resource-title'));
    const detail=safe?new URL(safe).hostname:`${item.kind==='pdf'?'PDF':'이미지'} · ${fileSize(item.file_size||0)}`;
    body.append(make('p',detail,'resource-detail'));
    if(item.notes)body.append(make('p',item.notes,'resource-notes'));
    const actions=make('div',undefined,'resource-actions');
    actions.append(tool('pencil','이름·메모 수정',()=>edit(item)),tool(trash?'undo-2':'trash-2',trash?'복원':'휴지통으로 이동',()=>archive(item)));
    card.append(media,body,actions);
    if(item.kind==='image')thumbnails.push([item,media]);
    return card;
  }));
  icons();controls();
  for(const [item,node] of thumbnails)thumbnail(item,node,paint,version);
}
async function load() {
  if(!active()||!cloud.ready||!cloud.user||busy)return;
  const request=++listRequest,version=revision;loading=true;$('library-message').textContent='';render();
  try {
    const fetched=await store.list();
    if(!current(version)||request!==listRequest)return;
    items=fetched;loaded=true;
  } catch(error) {
    if(!current(version)||request!==listRequest)return;
    $('library-message').textContent=libraryError(error);
  } finally {if(current(version)&&request===listRequest){loading=false;render();}}
}
function edit(item=null) {
  if(!available())return;
  editing=item;linkId=item?.id||crypto.randomUUID();$('link-form').reset();$('link-error').textContent='';
  const link=!item||item.kind==='link';
  $('link-editor-title').textContent=item?'자료 수정':'링크 추가';
  $('link-url-field').hidden=!link;$('link-url').required=link;
  $('link-url').value=item?.url||'';$('link-title').value=item?.title||'';$('link-notes').value=item?.notes||'';
  $('link-title').required=Boolean(item);
  $('link-dialog').showModal();$(link?'link-url':'link-title').focus();
}
$('add-link').addEventListener('click',()=>edit());
$('link-form').addEventListener('submit',async event=>{
  event.preventDefault();if(!available())return;
  const version=revision;busy=true;controls();$('save-link').disabled=true;$('link-error').textContent='';
  try {
    const fields={title:$('link-title').value,notes:$('link-notes').value,url:$('link-url').value};
    const item=editing?await store.edit(editing,fields):await store.saveLink({...fields,id:linkId});
    if(!current(version))return;
    merge(item);$('link-dialog').close();
  } catch(error){if(current(version))$('link-error').textContent=libraryError(error);}
  finally{if(version===revision){busy=false;$('save-link').disabled=false;controls();}}
});
async function archive(item) {
  if(!available())return;
  const version=revision;busy=true;controls();
  try{const result=await store.archive(item,!item.archived);if(current(version)){merge(result);$('library-message').textContent=item.archived?'복원했습니다.':'휴지통으로 이동했습니다.';}}
  catch(error){if(current(version))$('library-message').textContent=libraryError(error);}
  finally{if(version===revision){busy=false;controls();}}
}
function renderJobs() {
  $('upload-list').replaceChildren(...jobs.map(job=>{
    const row=make('li');row.dataset.state=job.state;
    const info=make('div');info.append(make('strong',job.file.name),make('small',job.error||({ready:fileSize(job.file.size),saving:'저장 중…',saved:'저장됨',failed:'저장 실패'})[job.state]));
    row.append(info);
    if(job.state!=='saved'&&!busy)row.append(tool('x','파일 선택 취소',()=>{jobs=jobs.filter(other=>other!==job);renderJobs();}));
    return row;
  }));
  $('save-files').disabled=busy||!jobs.some(job=>job.state!=='saved');
  $('library-files').disabled=busy;icons();
}
async function addFiles(files) {
  if(busy)return;
  if(jobs.filter(job=>job.state!=='saved').length+files.length>10){$('upload-error').textContent='한 번에 최대 10개까지 선택할 수 있습니다.';return;}
  const version=revision;
  const accepted=[],errors=[];
  for(const file of files) {
    try {await inspectFile(file);accepted.push({id:crypto.randomUUID(),file,state:'ready',error:''});}
    catch(error){errors.push(`${file.name}: ${libraryError(error)}`);}
  }
  if(!current(version))return;
  const room=Math.max(0,10-jobs.filter(job=>job.state!=='saved').length);
  jobs.push(...accepted.slice(0,room));
  if(accepted.length>room)errors.push('한 번에 최대 10개까지 선택할 수 있습니다.');
  $('upload-error').textContent=errors.join('\n');renderJobs();
}
$('add-files').addEventListener('click',()=>{
  if(!available())return;
  jobs=jobs.filter(job=>job.state!=='saved');$('library-files').value='';$('upload-error').textContent='';renderJobs();$('file-dialog').showModal();
});
$('library-files').addEventListener('change',async event=>{await addFiles([...event.target.files]);event.target.value='';});
for(const name of ['dragenter','dragover'])$('file-drop').addEventListener(name,event=>{event.preventDefault();if(!busy)$('file-drop').classList.add('dragging');});
$('file-drop').addEventListener('dragleave',()=>$('file-drop').classList.remove('dragging'));
$('file-drop').addEventListener('drop',event=>{event.preventDefault();$('file-drop').classList.remove('dragging');addFiles([...event.dataTransfer.files]);});
$('file-form').addEventListener('submit',async event=>{
  event.preventDefault();if(!available()||!jobs.some(job=>job.state!=='saved'))return;
  const version=revision;busy=true;controls();$('upload-error').textContent='';renderJobs();
  try {
    for(const job of jobs.filter(job=>job.state!=='saved')) {
      job.state='saving';job.error='';renderJobs();
      try {
        const item=await store.saveFile(job.file,job.id);
        if(!current(version))return;
        job.state='saved';merge(item);renderJobs();
      } catch(error) {
        if(!current(version))return;
        job.state='failed';job.error=libraryError(error);renderJobs();break;
      }
    }
    if(current(version)&&jobs.every(job=>job.state==='saved')){$('file-dialog').close();jobs=[];}
  } finally{if(version===revision){busy=false;renderJobs();controls();}}
});
document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>{
  if(busy&&button.dataset.close!=='resource-preview')return;$(button.dataset.close).close();
}));
for(const id of ['file-dialog','link-dialog'])$(id).addEventListener('cancel',event=>{if(busy)event.preventDefault();});
$('resource-preview').addEventListener('close',clearPreview);
$('library-search').addEventListener('input',render);$('library-filter').addEventListener('change',render);
$('library-trash').addEventListener('click',()=>{trash=!trash;$('library-trash').setAttribute('aria-pressed',String(trash));render();});
window.addEventListener('library-refresh',load);
window.addEventListener('beforeunload',event=>{if(busy){event.preventDefault();event.returnValue='';}});
window.addEventListener('journal-view',event=>{
  if(event.detail==='library'&&!loaded)load();
  if(event.detail!=='library'){$('resource-preview').close();clearPreview();}
});
window.addEventListener('journal-account',()=>{
  revision++;listRequest++;paintRequest++;busy=false;loaded=false;loading=false;items=[];jobs=[];editing=null;
  for(const id of ['file-dialog','link-dialog','resource-preview'])$(id).close();
  $('link-form').reset();$('library-files').value='';$('save-link').disabled=false;
  clearPreview();render();load();
});
render();load();
