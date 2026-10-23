// Page-memory only. Keep SDK calls below Puter's concurrency and rolling quotas.
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export function isRateLimited(error){return error?.status===429||error?.response?.status===429||error?.error?.status===429||['too_many_requests','rate_limit_exceeded'].includes(error?.code||error?.error?.code);}
export class RequestQueue{
  constructor({now=Date.now,wait=sleep,gap=80,writeGap=650}={}){this.now=now;this.wait=wait;this.gap=gap;this.writeGap=writeGap;this.pending=[];this.active=0;this.admission=Promise.resolve();this.nextStart=0;this.nextWrite=0;this.cooldown=0;this.history=new Map();}
  run(work,kind='read'){return new Promise((resolve,reject)=>{this.pending.push({work,kind,resolve,reject});this.pump();});}
  pump(){while(this.active<2&&this.pending.length){const job=this.pending.shift();this.active++;this.execute(job).then(job.resolve,job.reject).finally(()=>{this.active--;this.pump();});}}
  async pace(kind){
    const turn=this.admission.then(async()=>{
      const minuteLimit=kind==='write'?90:kind==='space'?15:240;
      for(;;){const now=this.now(),recent=(this.history.get(kind)||[]).filter(t=>now-t<60000);this.history.set(kind,recent);let due=Math.max(this.nextStart,this.cooldown,kind==='write'?this.nextWrite:0);if(recent.length>=minuteLimit)due=Math.max(due,recent[0]+60010);if(kind==='list'){const burst=recent.filter(t=>now-t<10000);if(burst.length>=40)due=Math.max(due,burst[0]+10010);}if(due>now){await this.wait(due-now);continue;}recent.push(now);this.nextStart=now+this.gap;if(kind==='write')this.nextWrite=now+this.writeGap;break;}
    });
    this.admission=turn.catch(()=>{});return turn;
  }
  async execute({work,kind}){
    for(let attempt=0;attempt<3;attempt++){
      await this.pace(kind);
      try{return await work();}catch(error){
        if(!isRateLimited(error))throw error;
        const supplied=Number(error?.retry_after??error?.error?.retry_after??error?.headers?.get?.('Retry-After'));
        const delay=Number.isFinite(supplied)&&supplied>0?Math.min(supplied*1000,60000):1000*2**attempt;
        this.cooldown=Math.max(this.cooldown,this.now()+delay);
        if(attempt===2)throw error;
      }
    }
  }
}
export const requests=new RequestQueue();
