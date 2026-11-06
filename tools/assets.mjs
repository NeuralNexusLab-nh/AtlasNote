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
