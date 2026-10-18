/* Rasterize our own SVG logo for PWA icons; no remote image service. */
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const require=createRequire('C:/Users/eaton/Documents/Codex/2026-08-13/astra/work/AstraNote/package.json');
const sharp=require('sharp');const svg=await fs.readFile(new URL('../asset/logo.svg',import.meta.url));
for(const size of [192,512])await sharp({create:{width:size,height:size,channels:4,background:'#171721'}}).composite([{input:await sharp(svg).resize(Math.round(size*.74)).toBuffer(),gravity:'center'}]).png().toFile(fileURLToPath(new URL(`../asset/icon-${size}.png`,import.meta.url)));
await sharp({create:{width:512,height:512,channels:4,background:'#171721'}}).composite([{input:await sharp(svg).resize(310).toBuffer(),gravity:'center'}]).png().toFile(fileURLToPath(new URL('../asset/icon-maskable.png',import.meta.url)));
const favicon=await sharp(svg).resize(256).png().toBuffer(),header=Buffer.alloc(22);
header.writeUInt16LE(1,2);header.writeUInt16LE(1,4);header.writeUInt16LE(1,10);header.writeUInt16LE(32,12);header.writeUInt32LE(favicon.length,14);header.writeUInt32LE(22,18);
await fs.writeFile(new URL('../favicon.ico',import.meta.url),Buffer.concat([header,favicon]));
