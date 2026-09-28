// Notion signs its uploaded image URLs. Match the file independently of the
// signature so a fresh export can repair an expired URL without replacing text.
export function notionImageKey(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return '';
    const hosted = url.hostname === 'prod-files-secure.s3.us-west-2.amazonaws.com'
      || url.hostname === 's3.us-west-2.amazonaws.com' && url.pathname.startsWith('/secure.notion-static.com/')
      || url.hostname === 'secure.notion-static.com';
    return hosted ? url.origin + url.pathname : '';
  } catch { return ''; }
}

export function attachImageRecovery(image, refreshImage) {
  const document = image.ownerDocument, wrapper = document.createElement('span');
  wrapper.className = 'research-image';
  const status = document.createElement('span'), retry = document.createElement('button');
  status.className = 'research-image-status'; status.setAttribute('role', 'status'); status.hidden = true;
  retry.className = 'research-image-retry'; retry.type = 'button'; retry.textContent = '이미지 다시 불러오기'; retry.hidden = true;
  image.replaceWith(wrapper); wrapper.append(image, status, retry);
  image.decoding = 'async';
  let attempted = false, pending = false;
  const failed = () => {
    image.hidden = true; status.hidden = false; retry.hidden = false; retry.disabled = false;
    status.textContent = '이미지를 불러오지 못했습니다.';
  };
  async function reload() {
    if (pending) return;
    pending = true; image.hidden = true; status.hidden = false; retry.hidden = false; retry.disabled = true;
    status.textContent = '이미지를 다시 불러오는 중…';
    try {
      const src = notionImageKey(image.src) && refreshImage ? await refreshImage(image.src) : image.src;
      if (!wrapper.isConnected) return;
      if (!src) throw Error('Image unavailable');
      // Keep the original signed query intact. Appending a cache-buster can
      // invalidate a signature. The refreshed export supplies a new URL.
      image.src = src; image.hidden = false;
    } catch { if (wrapper.isConnected) failed(); }
    finally { pending = false; }
  }
  image.addEventListener('load', () => { image.hidden = false; status.hidden = true; retry.hidden = true; retry.disabled = false; });
  image.addEventListener('error', () => {
    if (!attempted) { attempted = true; void reload(); }
    else failed();
  });
  retry.addEventListener('click', () => { attempted = true; void reload(); });
  return wrapper;
}
