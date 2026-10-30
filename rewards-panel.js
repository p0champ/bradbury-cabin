import { navigationSurface, CONTROL } from './theme.js?v=57';
import { HOME_FRAME, HOME_SCALE as S } from './home-panel.js?v=57';
import { compactWrap } from './compact-panels.js?v=57';
const Y=HOME_FRAME.y;
function local(o) {
  if(o.phase==='glow')return [{id:'reward-skip',x:536,y:432,w:160,h:48,label:'Skip →'}];
  if(o.shelf)return [{id:'reward-back',x:24,y:20,w:150,h:48,label:'‹ Shelf'},...(o.entries||[]).map((r,i)=>({id:`reward-detail:${r.id}`,x:24,y:130+i*98,w:672,h:90,label:''}))];
  return [
    ...(o.entry?.work?[{id:'reward-read',x:24,y:356,w:328,h:60,label:'Read now →'}]:[]),
    {id:'reward-later',x:o.entry?.work?368:24,y:356,w:o.entry?.work?328:672,h:60,label:'Later · keep on shelf'},
  ];
}
export function rewardsButtons(o) {return local(o).map(b=>({...b,x:b.x*S,y:Y+b.y*S,w:b.w*S,h:b.h*S}));}
export function paintRewards(ctx,o) {
  ctx.save();ctx.translate(0,Y);ctx.scale(S,S);navigationSurface(ctx,720,500);ctx.textBaseline='middle';ctx.textAlign='left';
  const text=(s,x,y,size=18,c='#f5f5f2')=>{ctx.font=`400 ${size}px system-ui`;ctx.fillStyle=c;ctx.fillText(s,x,y);};
  const lines=(s,y,size=22,max=3)=>{ctx.font=`400 ${size}px Georgia`;compactWrap(ctx,s,640).slice(0,max).forEach((s,i)=>{ctx.font=`400 ${size}px Georgia`;ctx.fillStyle='#f5f5f2';ctx.fillText(s,32,y+i*(size+5));});};
  for(const b of local(o)){ctx.fillStyle=o.hover===b.id?CONTROL.hover:CONTROL.quiet;ctx.beginPath();ctx.roundRect(b.x,b.y,b.w,b.h,14);ctx.fill();if(b.label)text(b.label,b.x+18,b.y+b.h/2,17);}
  if(o.phase==='glow') {text('A moment earned',32,178,18,'#e5c98f');lines(o.entries.map(r=>r.label).join(' · '),222,28,3);ctx.restore();return;}
  if(o.shelf) {
    text('Your rewards',280,44,25);text('Permanent picks · optional reading',32,96,17,'#cbd0cd');
    for(const [i,r] of (o.entries||[]).entries()) {
      const y=130+i*98;text(r.short,42,y+22,16,'#e5c98f');
      ctx.font='400 21px Georgia';const title=r.work?.title||'Reward earned · more reviewed picks needed';
      const wrapped=compactWrap(ctx,title,620);wrapped.slice(0,2).forEach((s,n)=>{ctx.font='400 21px Georgia';ctx.fillStyle='#f5f5f2';ctx.fillText(s,42,y+49+n*23);});
    }
    if(!o.entries.length){lines('A reading habit, a little at a time.',216,27);text('7-day streak · 30 complete days · 100 different pieces',32,275,18,'#cbd0cd');}
  } else {
    const r=o.entry;text(o.entries.length>1?`Reward ${o.index+1} of ${o.entries.length}`:'A reading reward',32,40,18,'#e5c98f');
    text(r?.label || 'A milestone earned',32,90,21);
    lines(r?.work?.title||'Your reward is earned.',146,27,3);
    text(r?.work?.author||'',32,244,18,'#cbd0cd');
    const note=r?.work?`A ${r.work.kind==='poem'?'poem':r.work.kind==='essay'?'essay':'story'} by ${r.work.author}, reserved for this milestone.`:'The reserved picks are already in your reading. More critic-approved picks are needed.';
    ctx.font='400 18px system-ui';compactWrap(ctx,note,640).slice(0,2).forEach((s,i)=>text(s,32,285+i*24,18,'#cbd0cd'));
    text(o.notice || 'Yours to return to. No extra daily requirement.',32,454,16,'#cbd0cd');
  }
  ctx.restore();
}
// Painted once. Its opacity changes on the GPU; no per-frame canvas drawing.
export function paintRewardGlow(canvas) {
  canvas.width=2048;canvas.height=2560;const c=canvas.getContext('2d');
  c.translate(0,Y);c.scale(S,S);c.strokeStyle='#e4b56a';c.lineWidth=2.5;c.shadowColor='#d99c42';c.shadowBlur=18;
  c.beginPath();c.roundRect(3,3,714,494,26);c.stroke();
}
