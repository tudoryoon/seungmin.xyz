import {mkdir,readFile,writeFile} from 'node:fs/promises';
const {default:sharp}=await import(process.env.SHARP_MODULE||'sharp');
const root=new URL('../',import.meta.url);
const svg=await readFile(new URL('favicon.svg',root));
const sizes=[16,32,48];
const images=[];
for(const size of sizes)images.push(await sharp(svg,{density:144}).resize(size,size).png().toBuffer());
// ICO directory entries point to PNG payloads for each tab-icon size.
const header=Buffer.alloc(6+16*sizes.length);
header.writeUInt16LE(1,2);header.writeUInt16LE(sizes.length,4);
let offset=header.length;
images.forEach((image,i)=>{
  const entry=6+i*16;
  header[entry]=sizes[i];header[entry+1]=sizes[i];
  header.writeUInt16LE(1,entry+4);header.writeUInt16LE(32,entry+6);
  header.writeUInt32LE(image.length,entry+8);header.writeUInt32LE(offset,entry+12);
  offset+=image.length;
});
await writeFile(new URL('favicon.ico',root),Buffer.concat([header,...images]));
await sharp(svg,{density:576}).resize(180,180).flatten({background:'#080f14'}).png().toFile(new URL('apple-touch-icon.png',root).pathname);
console.log('Generated favicon.ico (16, 32, 48 px) and apple-touch-icon.png (180 px).');
await mkdir(new URL('assets/',root),{recursive:true});
for(const size of [192,512])await sharp(svg,{density:1152}).resize(size,size).flatten({background:'#080f14'}).png().toFile(new URL('assets/app-'+size+'.png',root).pathname);
await sharp(svg,{density:1152}).resize(352,352).flatten({background:'#080f14'}).extend({top:80,bottom:80,left:80,right:80,background:'#080f14'}).png().toFile(new URL('assets/app-maskable-512.png',root).pathname);
console.log('Generated 192/512 px app icons and a padded 512 px maskable icon.');
