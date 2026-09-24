(function(){
  const TOC=window.BOOK_TOC, flat=[]; TOC.forEach(p=>p.ch.forEach(c=>flat.push({id:c[0],title:c[1],part:p.part})));
  const store={}; const waiting={};
  window.BOOK={ register(id,html){ store[id]=html; if(waiting[id]){ waiting[id](html); delete waiting[id]; } } };
  const $=s=>document.querySelector(s);
  const content=$('#content'), toc=$('#toc'), where=$('#where'), tip=$('#tip');
  const ls={ get(k,d){ try{ const v=localStorage.getItem(k); return v==null?d:JSON.parse(v);}catch(e){return d;} }, set(k,v){ try{localStorage.setItem(k,JSON.stringify(v));}catch(e){} } };
  let read=ls.get('nm-read',{});

  function label(c){ return c.id.startsWith('ch')?String(+c.id.slice(2)):(c.id==='glossary'?'T':c.id.slice(3)); }
  function buildToc(){
    let h='<a href="#cover" data-id="cover"><span class="n">◦</span><span>Bìa &amp; cách đọc</span></a>';
    TOC.forEach(p=>{ h+='<div class="part">'+p.part+'</div>'; p.ch.forEach(c=>{ h+='<a href="#'+c[0]+'" data-id="'+c[0]+'"><span class="n">'+label({id:c[0]})+'</span><span>'+c[1]+'</span></a>'; }); });
    toc.innerHTML=h;
    toc.addEventListener('click',e=>{ if(e.target.closest('a')) closeMenu(); });
  }
  function markToc(id){ toc.querySelectorAll('a').forEach(a=>{ a.classList.toggle('active',a.dataset.id===id); a.classList.toggle('read',!!read[a.dataset.id]); });
    const act=toc.querySelector('a.active'); if(act&&act.scrollIntoView) { const r=act.getBoundingClientRect(), t=toc.getBoundingClientRect(); if(r.top<t.top||r.bottom>t.bottom) toc.scrollTop+=r.top-t.top-120; } }
  const mqMobile=matchMedia('(max-width:900px)'), backdrop=$('#toc-backdrop');
  function setDrawer(open){ toc.classList.toggle('open',open); backdrop.classList.toggle('on',open); document.body.classList.toggle('toc-lock',open); $('#menuBtn').setAttribute('aria-expanded',open); }
  function closeMenu(){ if(mqMobile.matches) setDrawer(false); }
  function applySidebarPref(){
    if(mqMobile.matches){ setDrawer(false); return; }
    const open=ls.get('nm-sidebar',true);
    document.body.classList.toggle('toc-hidden',!open);
    $('#menuBtn').setAttribute('aria-expanded',open);
  }
  $('#menuBtn').addEventListener('click',()=>{
    if(mqMobile.matches){ setDrawer(!toc.classList.contains('open')); return; }
    const hidden=document.body.classList.toggle('toc-hidden');
    ls.set('nm-sidebar',!hidden);
    $('#menuBtn').setAttribute('aria-expanded',!hidden);
  });
  backdrop.addEventListener('click',()=>setDrawer(false));
  document.addEventListener('keydown',e=>{ if(e.key==='Escape'){ setDrawer(false); if(window.BOOK_AI&&BOOK_AI.close) BOOK_AI.close(); } });
  if(mqMobile.addEventListener) mqMobile.addEventListener('change',applySidebarPref); else mqMobile.addListener(applySidebarPref);
  $('#brandBtn').addEventListener('click',()=>{ location.hash='#cover'; });
  applySidebarPref();

  function loadChapter(id){
    return new Promise((res,rej)=>{
      if(store[id]) return res(store[id]);
      waiting[id]=res;
      const s=document.createElement('script'); s.src='ch/'+id+'.js'; s.onerror=()=>rej(new Error('missing')); document.head.appendChild(s);
    });
  }
  function runScripts(root){
    root.querySelectorAll('script').forEach(s=>{
      const code=s.textContent; s.remove();
      try{ new Function('NB','root',code)(window.NB,root); }catch(e){ console.error('[chapter script]',e); }
    });
  }
  function pager(idx){
    const p=flat[idx-1], n=flat[idx+1]; let h='<nav class="pager">';
    h+= p?'<a class="prev" href="#'+p.id+'"><small>← Trước</small>'+p.title+'</a>':'<span></span>';
    h+= n?'<a class="next" href="#'+n.id+'"><small>Tiếp →</small>'+n.title+'</a>':'<span></span>';
    return h+'</nav>';
  }
  /* ---- fallback TeX renderer (used when MathJax fails to load) ---- */
  const SYM={alpha:'α',beta:'β',gamma:'γ',delta:'δ',epsilon:'ε',varepsilon:'ε',zeta:'ζ',eta:'η',theta:'θ',vartheta:'ϑ',iota:'ι',kappa:'κ',lambda:'λ',mu:'μ',nu:'ν',xi:'ξ',pi:'π',rho:'ρ',sigma:'σ',tau:'τ',upsilon:'υ',phi:'φ',varphi:'ϕ',chi:'χ',psi:'ψ',omega:'ω',Gamma:'Γ',Delta:'Δ',Theta:'Θ',Lambda:'Λ',Xi:'Ξ',Pi:'Π',Sigma:'Σ',Phi:'Φ',Psi:'Ψ',Omega:'Ω',
    infty:'∞',partial:'∂',nabla:'∇',sum:'Σ',prod:'Π',int:'∫',approx:'≈',propto:'∝',neq:'≠',ne:'≠',leq:'≤',le:'≤',geq:'≥',ge:'≥',ll:'≪',gg:'≫',sim:'∼',simeq:'≃',equiv:'≡',pm:'±',mp:'∓',times:'×',cdot:'·',cdots:'⋯',ldots:'…',dots:'…',vdots:'⋮',to:'→',rightarrow:'→',leftarrow:'←',Rightarrow:'⇒',Leftarrow:'⇐',leftrightarrow:'↔',Leftrightarrow:'⇔',mapsto:'↦',in:'∈',notin:'∉',subset:'⊂',subseteq:'⊆',cup:'∪',cap:'∩',forall:'∀',exists:'∃',langle:'⟨',rangle:'⟩',lVert:'‖',rVert:'‖',vert:'|',mid:'|',ast:'∗',star:'⋆',circ:'∘',bullet:'•',oplus:'⊕',otimes:'⊗',odot:'⊙',perp:'⊥',parallel:'∥',angle:'∠',degree:'°',prime:'′',ell:'ℓ',hbar:'ℏ',Re:'ℜ',Im:'ℑ',emptyset:'∅',
    quad:'  ',qquad:'    ',',':' ',';':' ',':':' ','!':'','\\':'\n',' ':' ','{':'{','}':'}','_':'_','^':'^','%':'%','&':'&','#':'#','$':'$','|':'‖',lbrace:'{',rbrace:'}',lfloor:'⌊',rfloor:'⌋',lceil:'⌈',rceil:'⌉',
    sin:'sin',cos:'cos',tan:'tan',exp:'exp',log:'log',ln:'ln',max:'max',min:'min',argmax:'argmax',argmin:'argmin',lim:'lim',det:'det',tanh:'tanh',sinh:'sinh',cosh:'cosh',arg:'arg',sup:'sup',inf:'inf',Pr:'Pr',E:'E',
    left:'',right:'',displaystyle:'',textstyle:'',nonumber:'',limits:'',nolimits:'',bigl:'',bigr:'',Bigl:'',Bigr:'',big:'',Big:'',mathstrut:'',
    dagger:'†',ddagger:'‡',top:'⊤',bot:'⊥',vec:'',hat:'',bar:'',tilde:'',dot:'',ddot:'',overline:'',underline:''};
  const SUP={'0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹','+':'⁺','-':'⁻','n':'ⁿ','i':'ⁱ','T':'ᵀ','t':'ᵗ','(':'⁽',')':'⁾'};
  const SUB={'0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉','+':'₊','-':'₋','i':'ᵢ','j':'ⱼ','n':'ₙ','m':'ₘ','t':'ₜ','x':'ₓ','k':'ₖ','a':'ₐ','e':'ₑ','o':'ₒ','r':'ᵣ','u':'ᵤ','v':'ᵥ','p':'ₚ','s':'ₛ','h':'ₕ','l':'ₗ'};
  function texToText(s){
    let i=0, out='';
    function grp(){ // parse {…} or a single token
      while(s[i]===' ')i++;
      if(s[i]==='{'){ i++; let d=1,st=i; while(i<s.length&&d){ if(s[i]==='{')d++; else if(s[i]==='}')d--; i++; } return conv(s.slice(st,i-1)); }
      if(s[i]==='\\'){ let st=i; i++; while(i<s.length&&/[A-Za-z]/.test(s[i]))i++; if(i===st+1)i++; return conv(s.slice(st,i)); }
      return s[i++]||'';
    }
    function script(txt,map){ const t=txt.trim(); if([...t].every(c=>map[c])) return [...t].map(c=>map[c]).join(''); if(t.length===1) return (map===SUP?'^':'_')+t; return map===SUP?'^('+t+')':'_('+t+')'; }
    function conv(str){ const save=[s,i,out]; s=str; i=0; out=''; run(); const r=out; [s,i,out]=save; return r; }
    function run(){
      while(i<s.length){
        const c=s[i];
        if(c==='\\'){ let st=i+1; i++; while(i<s.length&&/[A-Za-z]/.test(s[i]))i++; if(i===st)i++; const name=s.slice(st,i);
          if(name==='frac'||name==='dfrac'||name==='tfrac'){ const a=grp(),b=grp(); out+=(a.length>1?'('+a+')':a)+'/'+(b.length>1?'('+b+')':b); }
          else if(name==='sqrt'){ if(s[i]==='['){ while(i<s.length&&s[i]!==']')i++; i++; } out+='√('+grp()+')'; }
          else if(/^(text|mathrm|mathbf|mathbb|mathcal|boldsymbol|operatorname|textbf|textit|mathit|mathsf|mathtt|underbrace|overbrace|hat|vec|bar|tilde|dot|ddot|overline|underline|boxed|widehat|widetilde)$/.test(name)){ out+=grp(); }
          else if(name==='begin'||name==='end'){ grp(); }
          else if(name in SYM){ out+=SYM[name]; }
          else out+=name;
        }
        else if(c==='^'){ i++; out+=script(grp(),SUP); }
        else if(c==='_'){ i++; out+=script(grp(),SUB); }
        else if(c==='{'||c==='}'){ i++; }
        else if(c==='&'){ i++; out+=' '; }
        else { out+=c; i++; }
      }
    }
    run(); return out.replace(/\s+/g,' ').trim();
  }
  function fallbackMath(root){
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:n=>(/\\\(|\$\$|\\\[/.test(n.nodeValue)&&!n.parentElement.closest('pre,code,script,style'))?1:2});
    const nodes=[]; let n; while(n=walker.nextNode()) nodes.push(n);
    nodes.forEach(node=>{
      const parts=node.nodeValue.split(/(\\\([\s\S]*?\\\)|\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\])/);
      if(parts.length<2) return;
      const frag=document.createDocumentFragment();
      parts.forEach(p=>{
        if(/^\\\(/.test(p)){ const sp=document.createElement('span'); sp.className='tex-fallback'; sp.textContent=texToText(p.slice(2,-2)); frag.appendChild(sp); }
        else if(/^\$\$|^\\\[/.test(p)){ const d=document.createElement('div'); d.className='tex-fallback block'; d.textContent=texToText(p.slice(2,-2)); frag.appendChild(d); }
        else if(p) frag.appendChild(document.createTextNode(p));
      });
      node.parentNode.replaceChild(frag,node);
    });
  }
  function typeset(){
    if(window.hljs) content.querySelectorAll('pre code').forEach(b=>{ try{hljs.highlightElement(b);}catch(e){} });
    const started=Date.now(), my=token;
    const go=()=>{ if(my!==token) return;
      if(window.MathJax&&MathJax.typesetPromise){ try{ MathJax.typesetClear&&MathJax.typesetClear([content]); }catch(e){}
        MathJax.typesetPromise([content]).then(()=>{
          content.querySelectorAll('mjx-container[display="true"]').forEach(m=>{ if(!m.parentElement.classList.contains('mjx-block')){ const w=document.createElement('div'); w.className='mjx-block'; m.parentNode.insertBefore(w,m); w.appendChild(m);} });
          rescrollPending(); // MathJax reflow xong → đưa anchor về đúng chỗ
        }).catch(e=>{ console.error('[MathJax]',e); fallbackMath(content); }); }
      else if(window.__mjxFail || Date.now()-started>6000){ fallbackMath(content); }
      else setTimeout(go,250); };
    go();
  }

  let token=0;
  async function show(id, anchor){
    const my=++token; NB.dispose(); closeMenu();
    const wantRestore=pendingRestore; pendingRestore=false;
    rendered=false; heads=[]; curAnchor=''; pendingAnchor=null;
    if(window.BOOK_AI&&BOOK_AI.onChapter) BOOK_AI.onChapter(id);
    if(id==='cover'){ document.title='Não & Máy'; renderCover(); markToc('cover'); where.textContent=''; window.scrollTo(0,0); return; }
    const idx=flat.findIndex(c=>c.id===id); if(idx<0){ location.hash='#cover'; return; }
    const c=flat[idx]; where.textContent=c.part.split(' — ')[0]+' · '+c.title; markToc(id); ls.set('nm-last',id);
    document.title=(id==='glossary'?'Bảng thuật ngữ':c.title)+' — Não & Máy';
    if(id==='glossary'){ renderGlossary(idx); window.scrollTo(0,0); return; }
    content.innerHTML='<p class="loading">Đang tải chương…</p>';
    let html; try{ html=await loadChapter(id); }catch(e){ html='<p>Chương này chưa sẵn sàng.</p>'; }
    if(my!==token) return;
    const eyebrow=id.startsWith('ch')?'Chương '+(+id.slice(2)):'Phụ lục '+id.slice(3);
    content.innerHTML='<header class="ch-head"><div class="eyebrow">'+eyebrow+' · '+c.part.split(' — ')[0]+'</div><h1>'+c.title+'</h1></header><div class="ch-body">'+html+'</div>'+pager(idx);
    const sub=content.querySelector('.ch-body .ch-sub'); if(sub){ sub.className='sub'; content.querySelector('.ch-head').appendChild(sub); }
    content.querySelectorAll('.ch-body [id]').forEach(el=>{ if(!el.closest('.widget')&&!el.closest('svg')&&!/^(w-|fig-)/.test(el.id)) el.id=id+'--'+el.id; });
    runScripts(content); typeset();
    collectHeads(id);
    if(wantRestore&&pos[id]&&!anchor){
      const y=Math.min(pos[id].y,Math.max(0,document.documentElement.scrollHeight-innerHeight));
      jumpTo(y);
      try{ history.replaceState(null,'','#'+curId); }catch(e){}
      toast('Đã quay về vị trí đang đọc');
      rendered=true;
      [900,2500].forEach(ms=>setTimeout(()=>{ if(my===token&&Math.abs(window.scrollY-y)<400) jumpTo(y); },ms));
      return;
    }
    rendered=true;
    const target=anchor?document.getElementById(id+'--'+anchor):null;
    if(target){
      const saved=pos[id];
      if(saved&&saved.a===anchor){ // F5 giữa chương: vị trí đã lưu chính xác hơn anchor
        const y=Math.min(saved.y,Math.max(0,document.documentElement.scrollHeight-innerHeight));
        jumpTo(y);
        [900,2500].forEach(ms=>setTimeout(()=>{ if(my===token&&Math.abs(window.scrollY-y)<400) jumpTo(y); },ms));
        return;
      }
      jumpToEl(target); // anchor từ link/reload → về đúng heading, cuộn lại sau typeset
      pendingAnchor={id:id+'--'+anchor,my:my};
      setTimeout(()=>{ if(pendingAnchor&&pendingAnchor.my===my) rescrollPending(); },1200);
      return;
    }
    window.scrollTo(0,0);
  }

  function renderGlossary(idx){
    const G=(window.BOOK_GLOSSARY||[]).slice().sort((a,b)=>a.term.localeCompare(b.term,'en',{sensitivity:'base'}));
    content.innerHTML='<header class="ch-head"><div class="eyebrow">Phụ lục</div><h1>Bảng thuật ngữ</h1><p class="sub">'+G.length+' thuật ngữ tiếng Anh dùng trong sách, kèm nghĩa tiếng Việt và chương xuất hiện đầu tiên.</p></header><input class="gloss-filter" id="glossFilter" type="search" placeholder="Lọc thuật ngữ… (vd: dopamine, attractor)" aria-label="Lọc thuật ngữ"><dl class="gloss" id="glossList"></dl>'+pager(idx);
    const list=$('#glossList');
    const draw=q=>{ q=(q||'').toLowerCase(); list.innerHTML=G.filter(g=>!q||(g.term+' '+g.vi+' '+g.def).toLowerCase().includes(q)).map(g=>'<dt>'+esc(g.term)+' <span>— '+esc(g.vi||'')+'</span></dt><dd>'+esc(g.def)+' <a href="#'+g.ch+'">'+(g.ch.startsWith('ch')?'Ch. '+(+g.ch.slice(2)):g.ch)+'</a></dd>').join(''); };
    draw(''); $('#glossFilter').addEventListener('input',e=>draw(e.target.value));
  }
  function esc(s){ return String(s).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }

  function renderCover(){
    const last=ls.get('nm-last',null); const lc=last&&flat.find(c=>c.id===last);
    let parts=''; TOC.forEach(p=>{ const sp=p.part.split(' — '); parts+='<a href="#'+p.ch[0][0]+'"><small>'+sp[0]+'</small>'+(sp[1]||'Tra cứu')+'<br><span>'+p.blurb+'</span></a>'; });
    content.innerHTML='<div class="cover"><div class="eyebrow" style="font-family:var(--display);font-size:13px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;color:var(--muted)">Neuroscience cho AI engineer · sách tương tác</div><h1><em>Não</em> &amp; <b>Máy</b></h1>'
      +'<p class="lead" style="max-width:56ch">Một cuốn all-in-one đi từ kênh ion đến ý thức, viết cho người đã quen gradient descent. Mỗi chương đặt sinh học cạnh deep learning: cái gì giống, cái gì chỉ giống tên, và cái gì AI vẫn chưa làm được.</p>'
      +'<div class="widget" id="w-cover" style="padding:10px"><div class="controls"></div></div>'
      +(lc?'<p style="font-family:var(--display)"><a class="continue" href="#'+lc.id+'">Đọc tiếp: '+lc.title+' →</a></p>':'<p style="font-family:var(--display)"><a href="#ch01">Bắt đầu từ Chương 1 →</a></p>')
      +'<h2>Cách đọc cuốn sách này</h2>'
      +'<div class="map"><div class="map-title">Ô mapping — xuất hiện trong mọi chương</div><div class="map-cols"><div class="map-neuro"><h4>Neuroscience</h4><p>Cột hồng luôn là phía sinh học: cơ chế, số liệu đo được, thí nghiệm kinh điển.</p></div><div class="map-ai"><h4>Deep learning</h4><p>Cột xanh là khái niệm bạn đã biết: layer, loss, optimizer, attention…</p></div></div><div class="map-note">dòng cuối luôn nói rõ phép so sánh sai ở đâu, để bạn không mang nhầm trực giác từ ngành này sang ngành kia.</div></div>'
      +'<div class="recall"><p>Ô <b>Nhắc lại</b> gợi lại ý quan trọng từ các chương trước đúng lúc cần dùng — bạn không phải lật ngược sách.</p></div>'
      +'<div class="key"><p class="vi">Những câu then chốt được viết song ngữ như thế này.</p><p class="en">Key sentences are written bilingually, like this.</p></div>'
      +'<p>Thuật ngữ giữ nguyên tiếng Anh; từ có <span class="term" data-term="action potential">gạch chấm</span> có thể rê chuột (hoặc chạm) để xem nghĩa, và tất cả nằm trong <a href="#glossary">Bảng thuật ngữ</a> cuối sách. Các khung có nút <b>Chạy</b> là mô phỏng chạy thật trong trình duyệt — hãy kéo các thanh trượt. Code Python trong sách chỉ cần NumPy/Matplotlib (đôi chỗ PyTorch).</p>'
      +'<h2>Bảy phần</h2><div class="parts">'+parts+'</div></div>';
    coverAnim();
  }
  function coverAnim(){
    const el=$('#w-cover'); if(!el) return; const N=46; let nodes=null, edges=[], pulses=[];
    function init(w,h){ nodes=[]; for(let i=0;i<N;i++){ const left=i<N/2; let x,y;
        if(left){ x=w*(.06+Math.random()*.4); y=h*(.1+Math.random()*.8); } else { const L=Math.floor((i-N/2)/ (N/2/4)); x=w*(.58+L*.11); y=h*(.14+((i-N/2)%Math.ceil(N/8))/(Math.ceil(N/8)-1)*.72); }
        nodes.push({x,y,v:Math.random()*.5,left,f:0}); }
      edges=[]; nodes.forEach((a,i)=>nodes.forEach((b,j)=>{ if(i===j)return; const d=Math.hypot(a.x-b.x,a.y-b.y);
        if(a.left&&b.left&&d<w*.13&&Math.random()<.5) edges.push([i,j]); if(!a.left&&!b.left&&Math.abs(b.x-a.x-w*.11)<2&&Math.random()<.45) edges.push([i,j]);
        if(a.left&&!b.left&&b.x<w*.6&&a.x>w*.36&&Math.random()<.25) edges.push([i,j]); })); pulses=[]; }
    let lw=0;
    NB.canvas(el,{height:w=>w<520?200:260,label:'Mạng neuron sinh học bên trái phát spike lan sang mạng nhân tạo nhiều lớp bên phải',draw(ctx,w,h,t,dt){
      const C=NB.colors(); if(!nodes||Math.abs(lw-w)>1){ init(w,h); lw=w; }
      nodes.forEach((n,i)=>{ n.v+=dt*(n.left?.22+.1*Math.sin(i):.02); n.f=Math.max(0,n.f-dt*2.5);
        if(n.v>=1){ n.v=0; n.f=1; edges.forEach(e=>{ if(e[0]===i&&pulses.length<140) pulses.push({e,p:0}); }); } });
      pulses.forEach(p=>p.p+=dt*1.6); pulses=pulses.filter(p=>{ if(p.p>=1){ nodes[p.e[1]].v+=.34; return false;} return true; });
      ctx.lineWidth=1; ctx.strokeStyle=C.line; ctx.beginPath(); edges.forEach(e=>{ const a=nodes[e[0]],b=nodes[e[1]]; ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); }); ctx.stroke();
      pulses.forEach(p=>{ const a=nodes[p.e[0]],b=nodes[p.e[1]]; ctx.fillStyle=C.spike; ctx.beginPath(); ctx.arc(NB.lerp(a.x,b.x,p.p),NB.lerp(a.y,b.y,p.p),2.2,0,7); ctx.fill(); });
      nodes.forEach(n=>{ const col=n.left?C.neuro:C.ai; ctx.fillStyle=C.surface; ctx.strokeStyle=col; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(n.x,n.y,5+n.f*4,0,7); ctx.fill(); ctx.stroke();
        if(n.f>0){ ctx.globalAlpha=n.f; ctx.fillStyle=col; ctx.beginPath(); ctx.arc(n.x,n.y,5+n.f*4,0,7); ctx.fill(); ctx.globalAlpha=1; } });
      NB.text(ctx,'mạng sinh học · spike',w*.06,h-10,{color:C.neuro,size:12,weight:600}); NB.text(ctx,'mạng nhân tạo · activation',w*.94,h-10,{color:C.ai,size:12,weight:600,align:'right'});
    }});
  }

  // glossary tooltips
  function lookup(t){ const G=window.BOOK_GLOSSARY||[]; t=t.toLowerCase(); return G.find(g=>g.term.toLowerCase()===t); }
  function showTip(el){ const g=lookup(el.dataset.term||el.textContent.trim()); if(!g) return; tip.innerHTML='<b>'+esc(g.term)+(g.vi?' — '+esc(g.vi):'')+'</b>'+esc(g.def); tip.hidden=false;
    const r=el.getBoundingClientRect(), tw=tip.offsetWidth, th=tip.offsetHeight; let x=NB.clamp(r.left+r.width/2-tw/2,8,innerWidth-tw-8), y=r.top-th-8; if(y<54) y=r.bottom+8; tip.style.left=x+'px'; tip.style.top=y+'px'; }
  document.addEventListener('pointerover',e=>{ const t=e.target.closest&&e.target.closest('.term'); if(t) showTip(t); });
  document.addEventListener('pointerout',e=>{ if(e.target.closest&&e.target.closest('.term')) tip.hidden=true; });
  document.addEventListener('click',e=>{ const t=e.target.closest&&e.target.closest('.term'); if(t) showTip(t); else tip.hidden=true; });
  /* ---- vị trí đọc & URL theo heading ---- */
  const pos=ls.get('nm-pos',{});
  let heads=[], curAnchor='', pendingRestore=false, rendered=false, pendingAnchor=null;
  function toast(msg,ms){ const t=$('#toast'); t.textContent=msg; t.classList.add('on'); clearTimeout(toast._t); toast._t=setTimeout(()=>t.classList.remove('on'),ms||2400); }
  function copyLink(frag){
    const url=location.href.split('#')[0]+'#'+frag;
    const done=()=>toast('Đã copy link phần này');
    if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done,()=>prompt('Link phần này:',url));
    else prompt('Link phần này:',url);
  }
  function headTitle(el){ return Array.from(el.childNodes).filter(n=>n.nodeType===1?!(n.classList&&n.classList.contains('hd-link')):true).map(n=>n.textContent).join('').trim(); }
  function collectHeads(chId){
    heads=[]; curAnchor='';
    if(!chId||chId==='cover'||chId==='glossary') return;
    content.querySelectorAll('.ch-body h2[id],.ch-body h3[id],.ch-body h4[id]').forEach(el=>{
      if(!el.id.startsWith(chId+'--')) return;
      const slug=el.id.slice(chId.length+2);
      if(!slug) return;
      const a=document.createElement('a'); a.className='hd-link'; a.href='#'+chId+'/'+slug; a.textContent='#'; a.title='Copy link phần này';
      a.addEventListener('click',e=>{ e.preventDefault(); copyLink(chId+'/'+slug); });
      el.appendChild(a);
      heads.push({el,slug,title:headTitle(el)});
    });
  }
  function jumpTo(y){ try{ window.scrollTo({top:y,behavior:'instant'}); }catch(e){ window.scrollTo(0,y); } }
  function jumpToEl(t){ try{ t.scrollIntoView({behavior:'instant',block:'start'}); }catch(e){ t.scrollIntoView(); } }
  function rescrollPending(){ // anchor có thể lệch sau khi MathJax reflow → cuộn lại đúng chỗ
    if(!pendingAnchor) return;
    const t=document.getElementById(pendingAnchor.id);
    if(t&&pendingAnchor.my===token) jumpToEl(t);
    pendingAnchor=null;
  }
  function activeHead(){
    const i=LOGIC.activeHeadingIndex(heads.map(h=>h.el.getBoundingClientRect().top),140);
    return i<0?null:heads[i];
  }
  function updateReadingState(){
    if(!heads.length){ curAnchor=''; return; }
    const h=activeHead(), a=h?h.slug:'';
    if(a!==curAnchor){
      curAnchor=a;
      try{ history.replaceState(null,'','#'+(a?curId+'/'+a:curId)); }catch(e){}
      if(window.BOOK_AI&&BOOK_AI.onSection) BOOK_AI.onSection(h);
    }
  }
  function savePos(){
    if(!rendered||!curId||curId==='cover'||curId==='glossary') return;
    pos[curId]={y:window.scrollY,a:curAnchor,t:Date.now()};
    ls.set('nm-pos',pos);
  }
  const progressEl=$('#progress'), toTopEl=$('#toTop');
  let posTimer=0;
  function flushPos(){ if(posTimer){ clearTimeout(posTimer); posTimer=0; savePos(); } }
  window.addEventListener('scroll',()=>{ tip.hidden=true;
    const d=document.documentElement, max=d.scrollHeight-innerHeight, p=max>0?d.scrollTop/max:0;
    updateReadingState(); // các lệnh đọc layout trước khi ghi style → tránh force reflow mỗi event cuộn
    progressEl.style.width=(p*100)+'%';
    const id=(location.hash||'').slice(1).split('/')[0]; if(p>.92&&id&&id!=='cover'&&!read[id]&&max>600){ read[id]=1; ls.set('nm-read',read); markToc(id); }
    toTopEl.classList.toggle('on',d.scrollTop>innerHeight*1.4);
    if(!posTimer){ posTimer=setTimeout(()=>{ posTimer=0; savePos(); },400); }
  },{passive:true});
  window.addEventListener('pagehide',flushPos);
  document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='hidden') flushPos(); });
  $('#toTop').addEventListener('click',()=>{ window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'}); });
  document.addEventListener('click',e=>{ const a=e.target.closest&&e.target.closest('a.continue'); if(a) pendingRestore=true; });

  window.BOOK_UI={
    curId:()=>curId,
    toast:toast,
    meta(){ const c=flat.find(x=>x.id===curId); return c?{title:c.title,part:c.part}:null; },
    section(){
      const h=activeHead(); if(!h) return null;
      return {title:h.title,slug:h.slug,el:h.el};
    },
    sectionText(max){
      max=max||12000;
      const s=this.section();
      if(!s){ const b=content.querySelector('.ch-body')||content; return LOGIC.capText(b?b.innerText:'',max); }
      let txt=s.title+'\n', node=s.el.nextElementSibling;
      while(node&&!/^H[1-4]$/.test(node.tagName)){ txt+='\n'+(node.innerText||''); node=node.nextElementSibling; }
      return LOGIC.capText(txt,max);
    },
    chapterText(max){ const b=content.querySelector('.ch-body')||content; return LOGIC.capText(b?b.innerText:'',max||24000); },
  };

  let curId='';
  function route(){ const raw=(location.hash||'#cover').slice(1); const h=raw.split('/');
    if(h[0]!==curId && document.getElementById(raw) && !flat.some(c=>c.id===raw) && raw!=='cover'){ document.getElementById(raw).scrollIntoView({block:'start'}); return; }
    const isChapter=flat.some(c=>c.id===h[0])||h[0]==='cover'||h[0]==='';
    if(!isChapter){ const el=document.getElementById(raw)||document.getElementById(curId+'--'+raw); if(el){ el.scrollIntoView({block:'start'}); } return; }
    if(!location.hash&&(!h[0]||h[0]==='cover')){ // mở lần đầu không có hash → quay về vị trí đang đọc
      const last=ls.get('nm-last',null);
      if(last&&flat.some(c=>c.id===last)){ pendingRestore=true; curId=last; show(last); return; }
    }
    curId=h[0]||'cover'; show(curId,h[1]); }
  window.addEventListener('hashchange',route);
  buildToc(); route();
})();
