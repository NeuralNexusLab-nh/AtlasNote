/* Visible diagonal trails, bounded on mobile and paused when the page is hidden. */
export function startMeteors(canvas){
  if(!canvas||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const ctx=canvas.getContext('2d');let w=0,h=0,stars=[],meteors=[],last=0,next=0,frame=0;
  const spawn=initial=>{const side=!initial&&Math.random()<.55;return {x:side?-30:Math.random()*w*1.3-w*.4,y:initial?Math.random()*h:side?Math.random()*h*.65:-40,s:260+Math.random()*190,l:100+Math.random()*160};};
  function resize(){w=innerWidth;h=innerHeight;const dpr=Math.min(devicePixelRatio||1,2);canvas.width=w*dpr;canvas.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);stars=Array.from({length:Math.min(95,Math.round(w*h/11000))},()=>({x:Math.random()*w,y:Math.random()*h,r:Math.random()*.8+.35,a:Math.random()*.4+.2}));meteors=Array.from({length:w<600?5:8},()=>spawn(true));}
  function tick(now){
    if(!canvas.isConnected){stop();return;}frame=requestAnimationFrame(tick);if(document.hidden)return;if(now-last<33)return;const dt=Math.min((now-last)/1000,.07);last=now;
    ctx.clearRect(0,0,w,h);const light=document.documentElement.dataset.theme==='light';ctx.fillStyle=light?'#636db6':'#c9ceff';
    for(const star of stars){ctx.globalAlpha=star.a*(light?.6:1);ctx.beginPath();ctx.arc(star.x,star.y,star.r,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;
    if(now>next&&meteors.length<(w<600?8:13)){meteors.push(spawn(false));next=now+180+Math.random()*300;}
    meteors=meteors.filter(m=>m.x<w+200&&m.y<h+200);
    for(const m of meteors){m.x+=m.s*dt;m.y+=m.s*.7*dt;const x=m.x-m.l,y=m.y-m.l*.7,g=ctx.createLinearGradient(x,y,m.x,m.y);g.addColorStop(0,'rgba(125,131,245,0)');g.addColorStop(.65,light?'rgba(104,115,202,.3)':'rgba(132,155,255,.4)');g.addColorStop(1,light?'rgba(77,94,193,.8)':'rgba(211,224,255,1)');ctx.strokeStyle=g;ctx.shadowColor=light?'#7b8cdb':'#a4b9ff';ctx.shadowBlur=light?2:6;ctx.lineWidth=light?1.5:1.8;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(m.x,m.y);ctx.stroke();ctx.shadowBlur=0;}
  }
  function stop(){cancelAnimationFrame(frame);removeEventListener('resize',resize);}
  resize();addEventListener('resize',resize,{passive:true});frame=requestAnimationFrame(tick);return stop;
}
