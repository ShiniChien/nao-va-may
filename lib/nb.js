/* NB — tiny helper library for interactive figures in "Não & Máy" */
(function(){
  const NB = window.NB = {};
  let disposers = [];
  let live = [];
  const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  NB.colors = function(){
    const cs = getComputedStyle(document.documentElement);
    const g = n => cs.getPropertyValue('--'+n).trim();
    return {bg:g('bg'),surface:g('surface'),surface2:g('surface2'),ink:g('ink'),muted:g('muted'),line:g('line'),
      neuro:g('neuro'),neuroBg:g('neuro-bg'),ai:g('ai'),aiBg:g('ai-bg'),spike:g('spike'),spikeBg:g('spike-bg'),ok:g('ok')};
  };
  NB.font = function(px, weight){ return (weight||400)+' '+px+'px "Bricolage Grotesque", system-ui, sans-serif'; };
  NB.mono = function(px){ return px+'px "JetBrains Mono", monospace'; };
  NB.onDispose = fn => disposers.push(fn);
  NB.dispose = function(){ disposers.forEach(f=>{try{f()}catch(e){}}); disposers=[]; live=[]; };
  NB.redrawAll = function(){ live.forEach(c=>c.redraw()); };
  NB.randn = function(){ let u=0,v=0; while(!u)u=Math.random(); while(!v)v=Math.random(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); };
  NB.clamp = (x,a,b)=>Math.max(a,Math.min(b,x));
  NB.lerp = (a,b,t)=>a+(b-a)*t;

  NB.controls = function(el){
    let c = el.querySelector(':scope > .controls');
    if(!c){ c=document.createElement('div'); c.className='controls'; el.appendChild(c); }
    return c;
  };
  let uid=0;
  NB.slider = function(el,o){
    const c=NB.controls(el), w=document.createElement('div'); w.className='ctl';
    const id=o.id||('nb-s'+(++uid));
    const fmt=o.fmt||(v=>(+v).toFixed(o.step && o.step<1 ? String(o.step).split('.')[1].length : 0)+(o.unit?' '+o.unit:''));
    w.innerHTML='<label for="'+id+'"></label><input type="range" id="'+id+'"><output></output>';
    w.querySelector('label').textContent=o.label;
    const inp=w.querySelector('input'), out=w.querySelector('output');
    inp.min=o.min; inp.max=o.max; inp.step=o.step||1; inp.value=o.value;
    out.textContent=fmt(inp.value);
    inp.addEventListener('input',()=>{ out.textContent=fmt(inp.value); if(o.onInput)o.onInput(+inp.value); NB.redrawAll(); });
    c.appendChild(w);
    return { get value(){return +inp.value}, set value(v){inp.value=v; out.textContent=fmt(inp.value);} , el:inp };
  };
  NB.button = function(el,o){
    const b=document.createElement('button'); b.type='button'; b.textContent=o.label;
    b.addEventListener('click',()=>{ o.onClick&&o.onClick(b); NB.redrawAll(); });
    NB.controls(el).appendChild(b); return b;
  };
  NB.toggle = function(el,o){
    let v=!!o.value; const b=document.createElement('button'); b.type='button'; b.textContent=o.label;
    b.classList.toggle('on',v); b.setAttribute('aria-pressed',v);
    b.addEventListener('click',()=>{ v=!v; b.classList.toggle('on',v); b.setAttribute('aria-pressed',v); o.onChange&&o.onChange(v); NB.redrawAll(); });
    NB.controls(el).appendChild(b);
    return { get value(){return v} };
  };
  NB.select = function(el,o){
    const w=document.createElement('div'); w.className='ctl'; const id='nb-sel'+(++uid);
    w.innerHTML='<label for="'+id+'"></label><select id="'+id+'"></select>';
    w.querySelector('label').textContent=o.label||'';
    const s=w.querySelector('select');
    o.options.forEach(op=>{ const e=document.createElement('option'); e.value=op[0]; e.textContent=op[1]; s.appendChild(e); });
    s.value=o.value!=null?o.value:o.options[0][0];
    s.addEventListener('change',()=>{ o.onChange&&o.onChange(s.value); NB.redrawAll(); });
    NB.controls(el).appendChild(w);
    return { get value(){return s.value} };
  };
  NB.readout = function(el){
    const r=document.createElement('div'); r.className='widget-readout'; el.appendChild(r);
    return t=>{ r.textContent=t; };
  };

  /* NB.canvas(el, {height, animate, draw(ctx,w,h,t,dt), autoplay}) */
  NB.canvas = function(el,o){
    const cv=document.createElement('canvas');
    cv.setAttribute('role','img'); if(o.label) cv.setAttribute('aria-label',o.label);
    const ctrl=el.querySelector(':scope > .controls');
    if(ctrl) el.insertBefore(cv,ctrl); else el.appendChild(cv);
    const ctx=cv.getContext('2d');
    let W=0,H=o.height||260,t=0,last=0,raf=0,visible=false,dead=false;
    let playing = o.animate!==false && o.autoplay!==false && !reduced;
    function size(){
      const dpr=Math.min(window.devicePixelRatio||1,2);
      W=Math.max(200,cv.clientWidth||el.clientWidth-36||600);
      const hh = typeof o.height==='function' ? o.height(W) : H; H=hh;
      cv.style.height=H+'px'; cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr);
      ctx.setTransform(dpr,0,0,dpr,0,0);
    }
    function frame(dt){
      ctx.clearRect(0,0,W,H);
      try{ o.draw(ctx,W,H,t,dt); }catch(e){ console.error('[NB.canvas draw]',e); playing=false; }
    }
    function loop(now){
      raf=0; if(dead||!playing||!visible) return;
      let dt=last?(now-last)/1000:0.016; last=now; dt=Math.min(dt,0.05); t+=dt;
      frame(dt); raf=requestAnimationFrame(loop);
    }
    function kick(){ if(!raf&&playing&&visible&&!dead){ last=0; raf=requestAnimationFrame(loop);} }
    const api={ canvas:cv, ctx:ctx,
      get width(){return W}, get height(){return H}, get t(){return t}, set t(v){t=v},
      get playing(){return playing},
      redraw(){ if(!dead&&!(playing&&visible)) frame(0); },
      play(){ playing=true; sync(); kick(); }, pause(){ playing=false; sync(); },
      reset(){ t=0; api.redraw(); } };
    let pbtn=null;
    function sync(){ if(pbtn){ pbtn.textContent=playing?'Tạm dừng':'Chạy'; } }
    if(o.animate!==false){
      pbtn=document.createElement('button'); pbtn.type='button';
      pbtn.addEventListener('click',()=>{ playing?api.pause():api.play(); });
      const c=NB.controls(el); c.insertBefore(pbtn,c.firstChild); sync();
    }
    const ro=new ResizeObserver(()=>{ const w=cv.clientWidth; if(Math.abs(w-W)>1){ size(); frame(0);} });
    ro.observe(cv);
    const io=new IntersectionObserver(es=>{ visible=es[0].isIntersecting; if(visible){ kick(); } },{rootMargin:'100px'});
    io.observe(cv);
    size(); frame(0);
    live.push(api);
    NB.onDispose(()=>{ dead=true; if(raf)cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); });
    return api;
  };

  /* pointer helper: cb(x, y, type, event) with x,y in CSS px of the canvas; type = down|move|up */
  NB.pointer = function(cv,cb){
    let down=false;
    const pos=e=>{ const r=cv.getBoundingClientRect(); return [e.clientX-r.left,e.clientY-r.top]; };
    cv.addEventListener('pointerdown',e=>{ down=true; try{cv.setPointerCapture(e.pointerId)}catch(_){}; const p=pos(e); cb(p[0],p[1],'down',e); NB.redrawAll(); });
    cv.addEventListener('pointermove',e=>{ const p=pos(e); cb(p[0],p[1],down?'drag':'move',e); if(down)NB.redrawAll(); });
    cv.addEventListener('pointerup',e=>{ down=false; const p=pos(e); cb(p[0],p[1],'up',e); NB.redrawAll(); });
    cv.style.cursor='crosshair';
  };

  /* axes: draws frame, ticks, labels. returns {X(v), Y(v)} */
  NB.axes = function(ctx,o){
    const C=NB.colors(); const x=o.x,y=o.y,w=o.w,h=o.h;
    const X=v=>x+(v-o.xmin)/(o.xmax-o.xmin)*w, Y=v=>y+h-(v-o.ymin)/(o.ymax-o.ymin)*h;
    ctx.save(); ctx.strokeStyle=C.line; ctx.lineWidth=1; ctx.fillStyle=C.muted; ctx.font=NB.font(11);
    ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x,y+h); ctx.lineTo(x+w,y+h); ctx.stroke();
    ctx.textAlign='center'; ctx.textBaseline='top';
    (o.xticks||[]).forEach(v=>{ const px=X(v); ctx.beginPath(); ctx.moveTo(px,y+h); ctx.lineTo(px,y+h+4); ctx.stroke(); ctx.fillText(String(v),px,y+h+6); });
    ctx.textAlign='right'; ctx.textBaseline='middle';
    (o.yticks||[]).forEach(v=>{ const py=Y(v); ctx.beginPath(); ctx.moveTo(x-4,py); ctx.lineTo(x,py); ctx.stroke(); ctx.fillText(String(v),x-7,py);
      if(o.grid){ ctx.save(); ctx.globalAlpha=.5; ctx.setLineDash([2,4]); ctx.beginPath(); ctx.moveTo(x,py); ctx.lineTo(x+w,py); ctx.stroke(); ctx.restore(); } });
    if(o.xlabel){ ctx.textAlign='center'; ctx.textBaseline='top'; ctx.fillText(o.xlabel,x+w/2,y+h+21); }
    if(o.ylabel){ ctx.save(); ctx.translate(x-(o.ylabelOffset||34),y+h/2); ctx.rotate(-Math.PI/2); ctx.textAlign='center'; ctx.textBaseline='bottom'; ctx.fillText(o.ylabel,0,0); ctx.restore(); }
    ctx.restore();
    return {X:X,Y:Y};
  };
  /* polyline through data; m = mapper from NB.axes; clipped to values */
  NB.line = function(ctx,xs,ys,m,color,width){
    ctx.save(); ctx.strokeStyle=color; ctx.lineWidth=width||2; ctx.lineJoin='round'; ctx.beginPath();
    for(let i=0;i<xs.length;i++){ const px=m.X(xs[i]), py=m.Y(ys[i]); i?ctx.lineTo(px,py):ctx.moveTo(px,py); }
    ctx.stroke(); ctx.restore();
  };
  NB.text = function(ctx,s,x,y,o){ o=o||{}; ctx.save(); ctx.fillStyle=o.color||NB.colors().ink; ctx.font=NB.font(o.size||12,o.weight); ctx.textAlign=o.align||'left'; ctx.textBaseline=o.baseline||'alphabetic'; ctx.fillText(s,x,y); ctx.restore(); };
  NB.arrow = function(ctx,x1,y1,x2,y2,color,width){
    const a=Math.atan2(y2-y1,x2-x1), s=7; ctx.save(); ctx.strokeStyle=ctx.fillStyle=color||NB.colors().ink; ctx.lineWidth=width||1.5;
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x2,y2); ctx.lineTo(x2-s*Math.cos(a-.4),y2-s*Math.sin(a-.4)); ctx.lineTo(x2-s*Math.cos(a+.4),y2-s*Math.sin(a+.4)); ctx.closePath(); ctx.fill(); ctx.restore();
  };

  // repaint static canvases when theme flips
  try{
    new MutationObserver(()=>NB.redrawAll()).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>NB.redrawAll());
  }catch(e){}
})();
