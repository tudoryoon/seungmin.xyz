export const BUCKET = 'library-files';
export const MAX_FILE_SIZE = 20 * 1024 * 1024;
const extensions = {'application/pdf':'pdf','image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','image/avif':'avif'};
export function normalizeUrl(value) {
  const text = String(value || '').trim();
  if (!text || text.length > 2048) throw new Error('사이트 주소를 확인해 주세요.');
  let url;
  try {url = new URL(/^[a-z][a-z\d+.-]*:/i.test(text) ? text : 'https://' + text);} catch {throw new Error('사이트 주소를 확인해 주세요.');}
  if (!['http:','https:'].includes(url.protocol) || !url.hostname || url.username || url.password || url.href.length > 2048) throw new Error('http 또는 https 사이트 주소만 저장할 수 있습니다.');
  return url.href;
}
export function itemText(title, notes, fallback = '') {
  const result = {title:String(title || fallback).trim(),notes:String(notes || '').trim()};
  if (!result.title || result.title.length > 160) throw new Error('이름은 1~160자로 입력해 주세요.');
  if (result.notes.length > 4000) throw new Error('메모는 4,000자까지 저장할 수 있습니다.');
  return result;
}
export async function inspectFile(file) {
  if (!file?.size || file.size > MAX_FILE_SIZE) throw new Error('파일은 0바이트 초과, 20 MB 이하로 선택해 주세요.');
  if (!file.name || file.name.length > 255) throw new Error('파일 이름은 255자 이하여야 합니다.');
  const bytes = new Uint8Array(await file.slice(0,16).arrayBuffer());
  const ascii = new TextDecoder('ascii').decode(bytes);
  let mime;
  if (ascii.startsWith('%PDF-')) mime = 'application/pdf';
  else if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) mime = 'image/jpeg';
  else if ([137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n)) mime = 'image/png';
  else if (/^GIF8[79]a/.test(ascii)) mime = 'image/gif';
  else if (ascii.startsWith('RIFF') && ascii.slice(8,12)==='WEBP') mime = 'image/webp';
  else if (ascii.slice(4,8)==='ftyp' && ['avif','avis'].includes(ascii.slice(8,12))) mime = 'image/avif';
  if (!mime) throw new Error('PDF 또는 JPG, PNG, WEBP, GIF, AVIF 이미지를 선택해 주세요.');
  return {mime,extension:extensions[mime],kind:mime==='application/pdf'?'pdf':'image'};
}
export function filePath(userId, id, mime) {
  if (!extensions[mime]) throw new Error('지원하지 않는 파일입니다.');
  return `${userId}/${id}.${extensions[mime]}`;
}
export function libraryError(error) {
  if (['PGRST205','42P01','42501'].includes(error?.code) || /bucket not found/i.test(error?.message || '')) return '자료 저장소 연결이 필요합니다. Supabase 자료 저장 설정을 먼저 적용해 주세요.';
  if (error?.code === 'ACCOUNT_CHANGED') return '계정이 변경되었습니다. 다시 시도해 주세요.';
  if (error instanceof TypeError) return '인터넷 연결을 확인하고 다시 시도해 주세요.';
  if (error instanceof Error && !error.status && !error.code) return error.message;
  return '자료를 처리하지 못했습니다. 입력 내용은 유지됩니다. 다시 시도해 주세요.';
}
export function createLibraryStore(client, identity) {
  const bucket = client.storage.from(BUCKET);
  function capture() {
    const state = {...identity()};
    if (!state.id) throw new Error('로그인이 필요합니다.');
    return state;
  }
  function guard(state) {
    const current = identity();
    if (state.id !== current.id || state.version !== current.version) throw Object.assign(new Error('계정이 변경되었습니다.'),{code:'ACCOUNT_CHANGED'});
  }
  function own(item,state) {
    if (item.user_id !== state.id || (item.kind !== 'link' && item.storage_path !== filePath(state.id,item.id,item.mime_type))) throw new Error('이 자료에 접근할 수 없습니다.');
  }
  async function write(row,state) {
    guard(state);
    const {data,error} = await client.from('library_items').upsert(row,{onConflict:'user_id,id'}).select('*').single();
    if (error) throw error;
    guard(state);
    return data;
  }
  return {
    async list() {
      const state = capture(), items = [];
      for (let from=0;;from+=500) {
        guard(state);
        const {data,error} = await client.from('library_items').select('*').eq('user_id',state.id).order('created_at',{ascending:false}).order('id').range(from,from+499);
        if (error) throw error;
        guard(state);
        items.push(...data);
        if (data.length<500) return items;
      }
    },
    async saveLink({id,url,title,notes}) {
      const state = capture(), safe = normalizeUrl(url);
      return write({id,user_id:state.id,kind:'link',url:safe,...itemText(title,notes,new URL(safe).hostname),updated_at:new Date().toISOString()},state);
    },
    async saveFile(file,id) {
      const state = capture();
      const info = await inspectFile(file);
      guard(state);
      const path = filePath(state.id,id,info.mime);
      const {error} = await bucket.upload(path,file,{upsert:true,contentType:info.mime,cacheControl:'300'});
      if (error) throw error;
      guard(state);
      // Retain private bytes on ambiguous metadata failures; retries reuse this ID.
      return write({id,user_id:state.id,kind:info.kind,...itemText(file.name.slice(0,160),'',file.name),
        storage_path:path,file_name:file.name,mime_type:info.mime,file_size:file.size,updated_at:new Date().toISOString()},state);
    },
    async edit(item,{title,notes,url}) {
      const state = capture();own(item,state);
      const patch = {...itemText(title,notes),updated_at:new Date().toISOString()};
      if (item.kind==='link') patch.url = normalizeUrl(url);
      const {data,error} = await client.from('library_items').update(patch).eq('user_id',state.id).eq('id',item.id).select('*').single();
      if (error) throw error;guard(state);return data;
    },
    async archive(item,archived) {
      const state = capture();own(item,state);
      const {data,error} = await client.from('library_items').update({archived,updated_at:new Date().toISOString()}).eq('user_id',state.id).eq('id',item.id).select('*').single();
      if (error) throw error;guard(state);return data;
    },
    async preview(item) {
      const state = capture();own(item,state);
      if (item.kind==='link') return normalizeUrl(item.url);
      const {data,error} = await bucket.createSignedUrl(item.storage_path,300);
      if (error) throw error;guard(state);return data.signedUrl;
    },
    async download(item) {
      const state = capture();own(item,state);
      const {data,error} = await bucket.download(item.storage_path);
      if (error) throw error;guard(state);
      return new Blob([data],{type:item.mime_type});
    }
  };
}
