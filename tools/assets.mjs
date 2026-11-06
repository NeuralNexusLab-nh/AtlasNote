/* Build web and install icons from the original four-petal AtlasNote artwork. */
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const require=createRequire(import.meta.url),sharp=require('sharp');
const source=new URL('../asset/logo-source.jpg',import.meta.url);
const output=relative=>fileURLToPath(new URL(relative,import.meta.url));
const {data,info}=await sharp(fileURLToPath(source)).trim({background:'#fff',threshold:20}).ensureAlpha().raw().toBuffer({resolveWithObject:true});

// The supplied original is a white-background JPEG. Remove only near-white pixels
// so the website mark remains identical while working on either color theme.
for(let offset=0;offset<data.length;offset+=4){
  const darkest=Math.min(data[offset],data[offset+1],data[offset+2]);
  data[offset+3]=darkest>=245?0:darkest>222?Math.round((245-darkest)/23*255):255;
}
// The source has already been trimmed before its white canvas is made transparent.
// A second transparent trim in sharp can leave a one-pixel opaque edge in generated
// icons, so preserve this exact cropped artwork as-is.
const mark=await sharp(data,{raw:{width:info.width,height:info.height,channels:4}}).png().toBuffer();
const transparent={r:0,g:0,b:0,alpha:0};
await sharp(mark).resize(512,512,{fit:'contain',background:transparent}).png().toFile(output('../asset/logo.png'));

async function installedIcon(size,scale=.68){
  const logo=await sharp(mark).resize(Math.round(size*scale),Math.round(size*scale),{fit:'contain',background:transparent}).png().toBuffer();
  return sharp({create:{width:size,height:size,channels:4,background:'#f8f9ff'}}).composite([{input:logo,gravity:'center'}]).png();
}
for(const size of [192,512])await (await installedIcon(size)).toFile(output(`../asset/icon-${size}.png`));
await (await installedIcon(512,.58)).toFile(output('../asset/icon-maskable.png'));
const favicon=await (await installedIcon(256,.72)).toBuffer(),header=Buffer.alloc(22);
header.writeUInt16LE(1,2);header.writeUInt16LE(1,4);header.writeUInt16LE(1,10);header.writeUInt16LE(32,12);header.writeUInt32LE(favicon.length,14);header.writeUInt32LE(22,18);
await fs.writeFile(output('../favicon.ico'),Buffer.concat([header,favicon]));

const socialFrame=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="soft" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#eef0ff"/><stop offset="1" stop-color="#f8f9ff"/></linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#soft)"/>
  <circle cx="1020" cy="160" r="330" fill="#7181e5" opacity=".08"/>
  <circle cx="860" cy="630" r="250" fill="#a199ec" opacity=".09"/>
  <rect x="55" y="55" width="1090" height="520" rx="34" fill="none" stroke="#29367f" stroke-opacity=".16" stroke-width="2"/>
  <text x="108" y="198" fill="#6c6fa0" font-family="Arial, sans-serif" font-size="24" font-weight="700" letter-spacing="5">PERSONAL NOTES, YOUR PUTER STORAGE</text>
  <text x="104" y="303" fill="#202546" font-family="Arial, sans-serif" font-size="82" font-weight="700">AtlasNote</text>
  <text x="108" y="366" fill="#4e5374" font-family="Arial, sans-serif" font-size="31">Write it freely, keep it closely.</text>
  <text x="108" y="466" fill="#4e5374" font-family="Arial, sans-serif" font-size="25">Notes · images · Markdown · private encryption</text>
</svg>`);
const socialMark=await sharp(mark).resize(330,330,{fit:'contain',background:transparent}).png().toBuffer();
await sharp({create:{width:1200,height:630,channels:4,background:'#f8f9ff'}}).composite([{input:socialFrame},{input:socialMark,left:760,top:150}]).png().toFile(output('../asset/social-graph.png'));
