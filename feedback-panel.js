import { navigationSurface, CONTROL } from './theme.js?v=57';
import { compactBounds, compactWrap } from './compact-panels.js?v=57';
const S = 2048 / 720, Y = compactBounds().y;
const rows = o => [
  ...[1,2,3,4,5].map((n,i)=>({id:`feedback-star:${n}`,x:24+i*88,y:112,w:78,h:52,label:`${n <= (o.feedback?.stars || 0) ? '★' : '☆'} ${n}`})),
  {id:'feedback-unrate',x:478,y:112,w:218,h:52,label:'Clear rating'},
  ...(o.thoughtPage>0?[{id:'feedback-prev',x:502,y:172,w:90,h:34,label:'← Back'}]:[]),
  ...(o.thoughtPage+1<o.thoughtPages?[{id:'feedback-next',x:600,y:172,w:96,h:34,label:'More →'}]:[]),
  {id:'feedback-speak',x:24,y:378,w:160,h:48,label:o.listening?'Stop':'Speak'},
  ...(o.draft && o.draft.length<=360?[{id:'feedback-save',x:192,y:378,w:160,h:48,label:'Save thought'}]:[]),
  {id:'feedback-type',x:360,y:378,w:160,h:48,label:'Type instead'},
  {id:'feedback-clear',x:528,y:378,w:168,h:48,label:'Clear thought'},
  {id:'feedback-done',x:24,y:440,w:672,h:44,label:'Done · Library →'},
];
export function feedbackButtons(o) {return rows(o).map(b=>({...b,x:b.x*S,y:Y+b.y*S,w:b.w*S,h:b.h*S}));}
export function thoughtPages(ctx,draft) {
  ctx.save();ctx.font='400 19px system-ui';
  const lines=compactWrap(ctx,draft || 'Speak one sentence, or leave this blank.',650);ctx.restore();
  const pages=[];for(let i=0;i<lines.length;i+=5)pages.push(lines.slice(i,i+5));return pages;
}
export function paintFeedback(ctx,o) {
  ctx.save();ctx.translate(0,Y);ctx.scale(S,S);navigationSurface(ctx,720,500);ctx.textAlign='left';ctx.textBaseline='middle';
  const text=(s,x,y,size=17,c='#f5f5f2')=>{ctx.font=`400 ${size}px system-ui`;ctx.fillStyle=c;ctx.fillText(s,x,y);};
  text('Your reading',24,25,15,'#cbd0cd');
  ctx.font='400 24px Georgia';
  const title=compactWrap(ctx,o.work?.title || '',650);
  title.slice(0,2).forEach((s,i)=>{ctx.font='400 24px Georgia';ctx.fillStyle='#f5f5f2';ctx.fillText(s,24,52+i*27);});
  text('Stars and thoughts are optional.',24,97,15,'#cbd0cd');
  text(`One thought${o.thoughtPages>1?` · ${o.thoughtPage+1}/${o.thoughtPages}`:''}`,24,188,17);
  const pages=thoughtPages(ctx,o.draft),lines=pages[Math.min(o.thoughtPage || 0,pages.length-1)];
  lines.forEach((s,i)=>text(s,24,220+i*23,19,o.draft?'#f5f5f2':'#cbd0cd'));
  ctx.font='400 15px system-ui';
  compactWrap(ctx,o.voiceStatus || 'Saved feedback reaches Claude after Drive sync.',650).slice(0,2).forEach((s,i)=>text(s,24,344+i*18,15,'#cbd0cd'));
  for(const b of rows(o)){
    ctx.fillStyle=o.hover===b.id?CONTROL.hover:CONTROL.quiet;ctx.beginPath();ctx.roundRect(b.x,b.y,b.w,b.h,12);ctx.fill();
    text(b.label,b.x+12,b.y+b.h/2,b.id.startsWith('feedback-star:')?22:16);
  }
  ctx.restore();
}
