import {LIMITS,imageDimensions} from './store.js';
import {b64} from './crypto.js';

// Re-encode decoded pixels: never trust only a MIME label or carry file metadata forward.
export async function compressImage(file,mode='balanced'){
 if(!['compact','balanced','clear'].includes(mode)||file.size>LIMITS.sourceImage||!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('invalidImage');
 const source=new Uint8Array(await file.arrayBuffer()),dimensions=imageDimensions(source,file.type);
 if(!dimensions||dimensions.width<1||dimensions.height<1||dimensions.width*dimensions.height>LIMITS.pixels)throw new Error('invalidImage');
 let image;try{image=await createImageBitmap(file);}catch{throw new Error('invalidImage');}
 try{
  if(image.width*image.height>LIMITS.pixels)throw new Error('invalidImage');
  const originalLong=Math.max(image.width,image.height),canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
  const encode=async(long,quality,type='image/webp')=>{
   const scale=Math.min(1,long/originalLong);canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
   ctx.drawImage(image,0,0,canvas.width,canvas.height);
   const result=await new Promise(resolve=>canvas.toBlob(resolve,type,quality));if(!result)throw new Error('invalidImage');return result;
  };
  let blob;
  if(mode==='clear'){
   // Keep native dimensions where possible. Small PNGs can remain pixel-lossless.
   if(file.type==='image/png'&&file.size<=LIMITS.image&&originalLong<=LIMITS.dimension){
    blob=await encode(originalLong,1,'image/png');
   }
   if(!blob||blob.size>LIMITS.image)blob=await encode(Math.min(originalLong,LIMITS.dimension),1);
  }else if(mode==='balanced'){
   let long=Math.min(1600,originalLong),quality=.76;blob=await encode(long,quality);
   for(let pass=0;blob.size>180_000&&pass<4;pass++){
    long=Math.min(originalLong,Math.max(1024,Math.round(long*.85)));quality=Math.max(.62,quality-.035);blob=await encode(long,quality);
   }
  }else{
   let long=Math.min(640,originalLong),quality=.24;blob=await encode(long,quality);
   // A private optimization target, not an upload promise or a user-facing quota.
   for(let pass=0;blob.size>5_000&&pass<10;pass++){
    const next=Math.max(Math.min(128,originalLong),Math.round(long*.78));quality=Math.max(.12,quality-.025);
    if(next>=long&&quality<=.12)break;long=next;blob=await encode(long,quality);
   }
  }
  if(!blob||blob.size>LIMITS.image)throw new Error('invalidImage');
  return {type:blob.type,data:b64(new Uint8Array(await blob.arrayBuffer())),width:canvas.width,height:canvas.height};
 }finally{image.close();}
}
