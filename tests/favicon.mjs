import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {Window}=await import(process.env.DOM_MODULE||'happy-dom');
const window=new Window({settings:{disableCSSFileLoading:true,disableJavaScriptFileLoading:true}});
const root=new URL('../',import.meta.url);
try {
  for(const page of ['index.html','test.html','roulette.html']) {
    const document=window.document.implementation.createHTMLDocument();
    document.documentElement.innerHTML=await readFile(new URL(page,root),'utf8');
    assert.deepEqual([...document.querySelectorAll('link[rel="icon"]')].map(link=>link.getAttribute('href')),['favicon.ico?v=1','favicon.svg?v=1'],page);
    assert.equal(document.querySelector('link[rel="apple-touch-icon"]').getAttribute('href'),'apple-touch-icon.png?v=1');
    assert.equal(document.querySelector('meta[name="theme-color"]').content,'#080f14');
  }
  const ico=await readFile(new URL('favicon.ico',root));
  assert.equal(ico.readUInt16LE(0),0);assert.equal(ico.readUInt16LE(2),1);assert.equal(ico.readUInt16LE(4),3);
  for(let i=0;i<3;i++) {
    const entry=6+16*i,size=[16,32,48][i],offset=ico.readUInt32LE(entry+12),length=ico.readUInt32LE(entry+8);
    assert.equal(ico[entry],size);assert.ok(offset+length<=ico.length);
    assert.equal(ico.subarray(offset,offset+8).toString('hex'),'89504e470d0a1a0a');
    assert.equal(ico.readUInt32BE(offset+16),size);assert.equal(ico.readUInt32BE(offset+20),size);
  }
  const apple=await readFile(new URL('apple-touch-icon.png',root));
  assert.equal(apple.readUInt32BE(16),180);assert.equal(apple.readUInt32BE(20),180);
  console.log('PASS: consistent tab icons on all entrypoints, valid 16/32/48 px ICO and 180 px home-screen icon.');
}finally {await window.happyDOM.close();}
