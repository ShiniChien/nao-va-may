/* Panel Hỏi AI — BYOK Google AI Studio (Gemini/Gemma), gọi thẳng từ trình duyệt.
   Logic thuần nằm ở lib/logic.js (đã có test); file này chỉ wiring DOM. */
(function(){
  const L=window.LOGIC, UI=window.BOOK_UI;
  if(!L||!UI) return;
  const $=s=>document.querySelector(s);
  const fab=$('#aiFab'), panel=$('#aiPanel'), msgs=$('#aiMsgs'), input=$('#aiInput'), send=$('#aiSend'),
        cfg=$('#aiCfg'), cfgBtn=$('#aiCfgBtn'), cfgSave=$('#aiCfgSave'), closeBtn=$('#aiClose'), clearBtn=$('#aiClear'),
        secEl=$('#aiSec'), ctxBar=$('#aiCtxBar'), ctxLabel=$('#aiCtxLabel'), wholeCb=$('#aiWhole'),
        keyInput=$('#aiKey'), modelSel=$('#aiModel'), modelCustom=$('#aiModelCustom');
  const GEMINI='https://generativelanguage.googleapis.com/v1beta';
  const FALLBACK_MODEL='gemini-2.5-flash'; // ổn định khi gemma gặp 500/429 (khác hạn mức quota)
  const ls={ get(k,d){ try{const v=localStorage.getItem(k); return v==null?d:JSON.parse(v);}catch(e){return d;} }, set(k,v){ try{localStorage.setItem(k,JSON.stringify(v));}catch(e){} } };
  let conf=ls.get('nm-ai',{key:'',model:'gemma-4-31b-it'});
  if(!conf.model) conf.model='gemma-4-31b-it';
  let curHead=null, quote='', busy=false, curChapter=null;

  /* ---- cấu hình ---- */
  function syncCustom(){ modelCustom.style.display=modelSel.value==='__custom'?'block':'none'; }
  function openCfg(open){
    cfg.classList.toggle('on',open);
    if(!open) return;
    keyInput.value=conf.key||'';
    const known=['gemma-4-31b-it','gemini-2.5-flash','gemma-3-27b-it'];
    if(known.includes(conf.model)){ modelSel.value=conf.model; }
    else { modelSel.value='__custom'; modelCustom.value=conf.model; }
    syncCustom();
  }
  modelSel.addEventListener('change',syncCustom);
  cfgBtn.addEventListener('click',()=>openCfg(!cfg.classList.contains('on')));
  cfgSave.addEventListener('click',()=>{
    const m=modelSel.value==='__custom'?(modelCustom.value.trim()||'gemma-4-31b-it'):modelSel.value;
    conf={key:keyInput.value.trim(),model:m};
    ls.set('nm-ai',conf);
    UI.toast(conf.key?'Đã lưu cấu hình AI':'Chưa có API key — điền key để hỏi được');
    if(!conf.key){ keyInput.focus(); return; }
    openCfg(false);
  });

  /* ---- ngữ cảnh đang đọc ---- */
  function refreshCtxBar(){
    const ch=UI.curId(), inChapter=ch&&ch!=='cover'&&ch!=='glossary';
    ctxBar.hidden=!inChapter;
    const m=UI.meta();
    secEl.textContent=m?(m.part.split(' — ')[0]+' · '+m.title):'';
    let lbl=wholeCb.checked?('Cả chương: '+((m||{}).title||'')):('Đang đọc: '+((curHead&&curHead.title)||'đầu chương'));
    if(quote) lbl+=' · có đoạn bôi đen';
    ctxLabel.textContent=lbl;
  }
  wholeCb.addEventListener('change',refreshCtxBar);
  function currentContext(){
    const whole=wholeCb.checked;
    return {
      text:whole?UI.chapterText():UI.sectionText(),
      title:whole?('toàn chương — '+((UI.meta()||{}).title||'')):((curHead&&curHead.title)||'đầu chương'),
    };
  }
  function captureQuote(){
    const sel=window.getSelection&&window.getSelection();
    if(!sel||sel.isCollapsed||!sel.rangeCount) { quote=''; return; }
    quote=UI.richSelection?UI.richSelection():''; // công thức giữ dạng TeX gốc
  }

  /* ---- hội thoại theo chương ---- */
  const chatKey=()=>'nm-ai-chat-'+(UI.curId()||'cover');
  const loadChat=()=>ls.get(chatKey(),[]);
  function saveChat(h){ ls.set(chatKey(),h.slice(-24)); }
  function msgEl(role,html){ const d=document.createElement('div'); d.className='ai-msg '+role; d.innerHTML=html; return d; }
  function renderHistory(){
    msgs.innerHTML='';
    const h=loadChat();
    if(!h.length){
      msgs.innerHTML='<div class="ai-empty">Hỏi bất kỳ chỗ nào chưa hiểu — AI đọc theo phần sách bạn đang xem.<br>Có thể bôi đen một đoạn trước khi mở panel.</div>';
      return;
    }
    h.forEach(m=>msgs.appendChild(msgEl(m.role==='user'?'user':'model',L.mdLite(m.text))));
    msgs.scrollTop=msgs.scrollHeight;
  }

  /* ---- gọi API (stream, retry 400 bỏ thinkingConfig như worker) ---- */
  function reqBody(contents,withThinking){
    const g={temperature:0.4,maxOutputTokens:16384}; //thinking token tính vào cap với gemini-2.5 → để dư
    if(withThinking){ const tc=L.thinkingConfigFor(conf.model); if(tc) g.thinkingConfig=tc; }
    return {systemInstruction:{parts:[{text:L.buildSystemPrompt()}]},contents:contents,generationConfig:g};
  }
  async function streamReq(contents,onText){
    const url=GEMINI+'/models/'+encodeURIComponent(conf.model)+':streamGenerateContent?alt=sse&key='+encodeURIComponent(conf.key);
    let res, delivered=false;
    for(let attempt=0;;attempt++){
      res=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(reqBody(contents,attempt===0))});
      if(res.ok||res.status!==400||attempt>0) break; // 400 lần đầu → thử lại không thinkingConfig
    }
    if(!res.ok) throw L.friendlyError(res.status,await res.text());
    try{
      const parser=L.makeSseParser(), reader=res.body.getReader(), dec=new TextDecoder();
      for(;;){
        const r=await reader.read(); if(r.done) break;
        parser.feed(dec.decode(r.value,{stream:true})).forEach(t=>{ delivered=true; onText(t); });
      }
      parser.feed(dec.decode()).forEach(t=>{ delivered=true; onText(t); });
    }catch(e){ e.partial=delivered; throw e; } // hỏng giữa stream → không gọi lại (đã vẽ 1 phần)
  }

  // Non-streaming generateContent — cách gọi đã chạy ổn ở worker; gemma bắt buộc đường này
  // (stream alt=sse của gemma bị Google trả 500). 500/503 của Google lỏng lẻo ~50% với gemma
  // (đo 2026-09) → thử lại tối đa 3 lần với backoff.
  async function plainReq(contents,onText){
    const url=GEMINI+'/models/'+encodeURIComponent(conf.model)+':generateContent?key='+encodeURIComponent(conf.key);
    for(let attempt=0;;attempt++){
      const res=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(reqBody(contents,attempt===0))});
      if(res.ok){ const text=L.pickText(await res.json()); if(text) onText(text); return text; }
      const transient=(res.status===500||res.status===503)&&attempt<4;
      if(!transient&&!(res.status===400&&attempt===0)) throw L.friendlyError(res.status,await res.text());
      if(res.status===400) continue; // lần đầu → thử lại không thinkingConfig
      await new Promise(r=>setTimeout(r,600*Math.pow(2,attempt-1)));
    }
  }

  async function callModel(contents,onText){
    if(/gemma/i.test(conf.model)) return plainReq(contents,onText);
    try{ return await streamReq(contents,onText); }
    catch(e){ if(e&&e.partial) throw e; return plainReq(contents,onText); } // stream hỏng → fallback non-stream
  }

  async function ask(question){
    if(busy||!question.trim()) return;
    if(!conf.key){ openCfg(true); UI.toast('Cần API key của Google AI Studio'); return; }
    busy=true; send.disabled=true;
    const q=question.trim(), ctx=currentContext(), usedQuote=quote; quote='';
    const ckey=chatKey(); // khoá theo chương NGAY TỜI ĐIỂM hỏi — đổi chương giữa stream không làm lệch nơi lưu
    const h=ls.get(ckey,[]);
    const contents=h.slice(-12).map(m=>({role:m.role==='user'?'user':'model',parts:[{text:m.text}]}));
    contents.push({role:'user',parts:[{text:L.buildUserPrompt({
      partTitle:(UI.meta()||{}).part,sectionTitle:ctx.title,sectionText:ctx.text,quote:usedQuote,question:q})}]});
    refreshCtxBar();
    msgs.appendChild(msgEl('user',L.mdLite(q)));
    const aEl=msgEl('model',''); aEl.classList.add('pending'); msgs.appendChild(aEl);
    msgs.scrollTop=msgs.scrollHeight;
    let acc='', noteHtml='';
    const paint=()=>{ aEl.innerHTML=noteHtml+(L.mdLite(acc)||'<p>…</p>'); msgs.scrollTop=msgs.scrollHeight; };
    const finish=()=>{ aEl.classList.remove('pending'); busy=false; send.disabled=false; };
    const userConf=conf;
    try{
      try{ await callModel(contents,t=>{ acc+=t; paint(); }); }
      catch(e){
        // gemma/đang chọn gặp 500-STS hoặc 429-quota → thử model dự phòng (bucket quota riêng)
        if(!(e&&[500,503,429].includes(e.status))||conf.model===FALLBACK_MODEL) throw e;
        const from=conf.model;
        conf={key:conf.key,model:FALLBACK_MODEL};
        try{
          await callModel(contents,t=>{ acc+=t; paint(); });
          noteHtml='<div class="ai-fbnote">'+L.mdLite('↻ **'+from+'** đang lỗi phía Google — trả lời này dùng model dự phòng **'+FALLBACK_MODEL+'**.')+'</div>';
          aEl.innerHTML=noteHtml+L.mdLite(acc);
        } finally { conf=userConf; }
      }
    }
    catch(e){
      aEl.classList.remove('pending'); aEl.classList.add('ai-err');
      aEl.innerHTML=L.mdLite('**'+((e&&e.title)||'Lỗi')+'**\n'+((e&&e.detail)||e.message||'Không gọi được API — kiểm tra mạng.'));
      finish(); return; // lỗi không lưu vào hội thoại
    }
    acc=acc.trim();
    if(!acc){ aEl.innerHTML=noteHtml+'<p>(Không nhận được nội dung trả lời.)</p>'; finish(); return; }
    aEl.innerHTML=noteHtml+L.mdLite(acc);
    h.push({role:'user',text:q},{role:'model',text:acc});
    ls.set(ckey,h.slice(-24));
    finish();
  }

  /* ---- mở/đóng panel ---- */
  function openPanel(){
    captureQuote();
    panel.classList.add('open'); fab.setAttribute('aria-expanded','true');
    if(!conf.key) openCfg(true);
    refreshCtxBar(); renderHistory();
    input.focus({preventScroll:true});
    if(matchMedia('(max-width:640px)').matches) document.body.classList.add('ai-lock');
  }
  function closePanel(){
    panel.classList.remove('open'); fab.setAttribute('aria-expanded','false');
    document.body.classList.remove('ai-lock');
  }
  fab.addEventListener('click',()=>panel.classList.contains('open')?closePanel():openPanel());
  closeBtn.addEventListener('click',closePanel);
  clearBtn.addEventListener('click',()=>{ ls.set(chatKey(),[]); renderHistory(); UI.toast('Đã xoá hội thoại chương này'); });

  /* ---- form ---- */
  $('#aiForm').addEventListener('submit',e=>{
    e.preventDefault();
    const q=input.value;
    if(!q.trim()||busy) return;
    if(!conf.key){ openCfg(true); UI.toast('Cần API key của Google AI Studio'); return; } // giữ nguyên text người dùng đã gõ
    input.value=''; input.style.height='auto';
    ask(q);
  });
  input.addEventListener('keydown',e=>{
    if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); const f=$('#aiForm'); if(f.requestSubmit) f.requestSubmit(); else $('#aiSend').click(); }
  });
  input.addEventListener('input',()=>{ input.style.height='auto'; input.style.height=Math.min(input.scrollHeight,110)+'px'; });

  window.BOOK_AI={
    onChapter(id){ // sang chương khác → transcript/context đổi theo, không trộn hội thoại
      if(curChapter===id) return;
      curChapter=id; curHead=null; quote='';
      if(panel.classList.contains('open')){ refreshCtxBar(); renderHistory(); }
    },
    onSection(h){ curHead=h; if(panel.classList.contains('open')) refreshCtxBar(); },
    close:closePanel,
  };
})();
