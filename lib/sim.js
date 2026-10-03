export const rng=s=>()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
export const gauss=r=>Math.sqrt(-2*Math.log(r()+1e-9))*Math.cos(6.2832*r());
export const hz=v=>v>=1e6?(v/1e6).toFixed(3)+' MHz':v>=1e3?(v/1e3).toFixed(2)+' kHz':v+' Hz';
export const hex=b=>b.map(x=>x.toString(16).padStart(2,'0').toUpperCase()).join(' ');
export const PRESETS=[
{id:'0412',name:'vhf_burst_0412.iq',fmt:'complex64',size:'38.2 MB',fs:250e3,mod:'QPSK',sr:31250,fec:'Conv r1/2 K=7',ilR:16,ilC:12,snr:11,sync:[0x1A,0xCF,0xFC,0x1D],cfo:412},
{id:'0409',name:'hf_link_0409.wav',fmt:'int16 wav',size:'11.4 MB',fs:48e3,mod:'BPSK',sr:1200,fec:'RS(255,223)',ilR:8,ilC:20,snr:8,sync:[0xEB,0x90,0xEB,0x90],cfo:-37},
{id:'0331',name:'uhf_telemetry_0331.iq',fmt:'complex64',size:'96.0 MB',fs:1e6,mod:'2-FSK',sr:9600,fec:'Conv r1/2 K=7',ilR:12,ilC:20,snr:14,sync:[0x7E,0x7E,0x7E,0x7E],cfo:1290}];
export const STAGES=['Ingest and normalise','Estimate parameters','Recover carrier and timing','Find interleaver','Decode FEC','Locate header and payload'];
export const STAGE_MS=[120,840,410,2310,1560,180];
export const bw=p=>Math.round(p.sr*(p.mod==='2-FSK'?2.6:1.35));
export function spectrum(p,n=256,r=rng(7),gain=1){const b=bw(p)/p.fs,fsk=p.mod==='2-FSK';
 const lobe=(f,f0,w)=>Math.max(-60,-40*(Math.abs(f-f0)/(w/2))**2);
 return Array.from({length:n},(_,i)=>{const f=i/n-.5;
  let s=fsk?Math.max(lobe(f,-b/4,b/2.4),lobe(f,b/4,b/2.4)):lobe(f,0,b);
  s=-30+s+10*Math.log10(gain);
  const spur=-52+lobe(f,0.31,0.004)*0.4;
  const pw=10**(-92/10)+10**(s/10)+10**(spur/10);
  return 10*Math.log10(pw)+(r()-.5)*4});}
export const logs=p=>[
[`read ${p.name} as ${p.fmt}`,`fs ${hz(p.fs)}, DC offset removed, gain normalised`],
[`occupied bandwidth ${hz(bw(p))}`,`symbol rate ${hz(p.sr)} from cyclostationary peak`,`modulation ${p.mod}, cumulant check agrees`],
[`carrier offset ${p.cfo} Hz corrected`,`timing locked, loop bandwidth 1.0%`],
[`scanned 441 block geometries`,`lowest entropy at ${p.ilR}x${p.ilC}`],
[`tried 6 candidate codes, ${p.fec} converged`,`syndrome clear on 97% of blocks`],
[`sync word ${hex(p.sync)} at offset 0`,`frame period 62 bytes, header 6, payload 48`]];
export const params=p=>{const a=c=>Math.min(.99,+(c+(p.snr-11)*.006).toFixed(2));return[
{k:'Sample rate',v:hz(p.fs),c:.99,at:1},{k:'Bandwidth',v:hz(bw(p)),c:a(.96),at:2},
{k:'Symbol rate',v:hz(p.sr),c:a(.95),at:2},{k:'Modulation',v:p.mod,c:a(.94),at:2},
{k:'Carrier offset',v:p.cfo+' Hz',c:a(.91),at:3},{k:'Interleaver',v:`Block ${p.ilR} x ${p.ilC}`,c:a(.88),at:4},
{k:'FEC',v:p.fec,c:a(.91),at:5},{k:'Sync word',v:hex(p.sync),c:a(.97),at:6}]};
export function mods(p){const r=rng(p.sr),n=['BPSK','QPSK','8PSK','16QAM','64QAM','2-FSK','4-FSK','GMSK'];
 const top=Math.max(.6,Math.min(.97,.88+.01*(p.snr-11))),w=n.map(m=>m===p.mod?0:r()+.05),s=w.reduce((a,b)=>a+b,0);
 return n.map((m,i)=>({m,p:m===p.mod?top:(1-top)*w[i]/s})).sort((a,b)=>b.p-a.p)}
export function heat(p){const r=rng(p.ilR*31+p.ilC);return Array.from({length:21},(_,i)=>Array.from({length:21},(_,j)=>{
 const R=i+4,C=j+4;let e=.8+.12*r();if(R===p.ilR||C===p.ilC)e-=.08;if(R*C===p.ilR*p.ilC)e-=.12;if(R===p.ilR&&C===p.ilC)e=.2+.05*r();return e}))}
export function fecList(p){const r=rng(p.sr+3),n=['Conv r1/2 K=7 (171,133)','Conv r1/2 K=3','Conv r2/3 K=7 punctured','RS(255,223)','RS(255,239)','LDPC r1/2 n=648'];
 const hit=c=>p.fec.startsWith('RS')?c.includes('223'):c.includes('K=7 (');
 return n.map(c=>({c,s:hit(c)?.97-(11-p.snr)*.004:.38+r()*.22})).sort((a,b)=>b.s-a.s)}
export function frame(p){const t=`NODE-07 BAT 12.6V TEMP 31C RSSI -88 SEQ ${p.id} OK`.padEnd(48,' ').split('').map(c=>c.charCodeAt(0));
 const seg=(a,s)=>a.map(b=>({b,s})),id=+p.id;
 return[...seg([0xAA,0xAA],'pre_'),...seg(p.sync,'sync'),...seg([1,7,48,(id>>8)&255,id&255,0x40],'hdr'),...seg(t,'pay'),...seg([0x9C,0x3E],'crc')]}
export function autocorr(p,n=140){const L=frame(p).length,r=rng(5);return Array.from({length:n},(_,i)=>i===0?1:Math.min(1,.06*r()+Math.exp(-((i-L)**2)/1.2)*.9+Math.exp(-((i-2*L)**2)/1.4)*.7))}
