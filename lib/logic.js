/* Pure helpers dùng chung cho app đọc (vị trí theo heading) và panel AI (Gemini).
   Chạy được cả trong browser (window.LOGIC) lẫn node:test (module.exports). */
(function(root){
  'use strict';

  /* ---- đọc theo heading ---- */

  // Index của heading đang đứng sau "reading line": phần tử cuối có top <= line, -1 nếu không có.
  function activeHeadingIndex(tops, line){
    for(let i=tops.length-1;i>=0;i--){ if(tops[i]<=line) return i; }
    return -1;
  }

  function capText(s, max){
    s=String(s||'');
    if(s.length<=max) return s;
    return s.slice(0,Math.max(0,max-1)).trimEnd()+'…';
  }

  /* ---- Gemini API (mirror PersonalNews/worker: shape + thinkingConfig + thought filter) ---- */

  // Field thinkingConfig đúng theo họ model — gửi sai field → 400; model không hỗ trợ → bỏ hẳn.
  function thinkingConfigFor(model){
    if(/gemini-2\.5/.test(model)) return {thinkingBudget:-1};
    if(/gemma-[34]|gemini-3/.test(model)) return {thinkingLevel:'high'};
    return undefined;
  }

  // Join các part.text của 1 response/chunk, bỏ qua part suy luận (thought===true).
  function pickText(data){
    try{
      const parts=(data&&data.candidates&&data.candidates[0]&&data.candidates[0].content&&data.candidates[0].content.parts)||[];
      return parts.filter(p=>p&&p.thought!==true).map(p=>p.text||'').join('');
    }catch(e){ return ''; }
  }

  // Parser incremental cho streamGenerateContent?alt=sse: feed() mỗi chunk, trả về các text hoàn chỉnh.
  function makeSseParser(){
    let buf='';
    return {
      feed(chunk){
        buf+=chunk; const out=[];
        let idx;
        while((idx=buf.indexOf('\n'))>=0){
          const line=buf.slice(0,idx).replace(/\r$/,''); buf=buf.slice(idx+1);
          const m=/^data:\s?(.*)$/.exec(line);
          if(!m) continue;
          try{ const t=pickText(JSON.parse(m[1])); if(t) out.push(t); }catch(e){ /* dòng dở hoặc not-json → bỏ qua */ }
        }
        return out;
      }
    };
  }

  // Lỗi HTTP → thông điệp thân thiện cho panel. `status` đi kèm để wiring quyết định fallback model.
  function friendlyError(status, body){
    const t=String(body||'').slice(0,300);
    if(status===400) return {status:status,title:'Lỗi 400 — yêu cầu không hợp lệ', detail:'Model có thể không nhận được cấu hình gửi kèm. Thử lại hoặc đổi model trong ⚙ Cấu hình.', dropThinking:true};
    if(status===401||status===403) return {status:status,title:'Lỗi '+status+' — API key không hợp lệ', detail:'Kiểm tra hoặc tạo lại key tại aistudio.google.com/apikey rồi lưu trong ⚙ Cấu hình.'};
    if(status===500||status===503) return {status:status,title:'Lỗi '+status+' — Google đang lỗi tạm thời', detail:'Model này đang không ổn định phía Google (lỗi được thử lại tự động). Thử gửi lại sau ít phút, hoặc đổi model (vd gemini-2.5-flash) trong ⚙ Cấu hình.'};
    if(status===404) return {status:status,title:'Lỗi 404 — không thấy model', detail:'Model không tồn tại hoặc chưa được cấp quyền cho key này. Đổi model trong ⚙ Cấu hình.'};
    if(status===429){
      const m=/retry in (\d+(?:\.\d+)?)s/i.exec(t);
      const sec=m?Math.round(Number(m[1])):60;
      return {status:status,title:'Lỗi 429 — hết hạn mức miễn phí', detail:'Free quota tạm hết (giới hạn mỗi phút hoặc mỗi ngày). Thử lại sau ~'+sec+'s.', retrySec:sec};
    }
    return {status:status,title:'Lỗi HTTP '+status, detail:t||'Không rõ lỗi.'};
  }

  /* ---- markdown nhẹ (không thư viện ngoài) ---- */

  function esc(s){ return String(s).replace(/[&<>"]/g,function(m){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]; }); }

  function inline(s){
    s=esc(s);
    s=s.replace(/`([^`]+)`/g,'<code>$1</code>');
    s=s.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
    s=s.replace(/\[([^\]]+)\]\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g,function(m,text,href){
      return /^(https?:\/\/|#)/.test(href)?'<a href="'+href+'" target="_blank" rel="noopener">'+text+'</a>':text;
    });
    return s;
  }

  // Blocks: đoạn văn (newline đơn → <br>), ul/ol, fenced code. Không render bảng, không italic đơn.
  function mdLite(text){
    const out=[];
    String(text||'').split(/```(?:[A-Za-z0-9_-]*)\n?/).forEach((seg,i)=>{
      if(i%2===1){ out.push('<pre><code>'+esc(seg)+'</code></pre>'); return; } // nội dung fence (đã cắt)
      const lines=seg.split('\n'); let para=[], list=null;
      const flushPara=()=>{ if(para.length){ out.push('<p>'+para.map(inline).join('<br>')+'</p>'); para=[]; } };
      const flushList=()=>{ if(list){ out.push('<'+list.tag+'>'+list.items.map(li=>'<li>'+inline(li)+'</li>').join('')+'</'+list.tag+'>'); list=null; } };
      lines.forEach(line=>{
        const bu=/^[-*] (.*)$/.exec(line), ol=/^\d+\. (.*)$/.exec(line);
        if(bu){ flushPara(); if(!list||list.tag!=='ul'){ flushList(); list={tag:'ul',items:[]}; } list.items.push(bu[1]); }
        else if(ol){ flushPara(); if(!list||list.tag!=='ol'){ flushList(); list={tag:'ol',items:[]}; } list.items.push(ol[1]); }
        else if(!line.trim()){ flushPara(); flushList(); }
        else { flushList(); para.push(line); }
      });
      flushPara(); flushList();
    });
    return out.join('');
  }

  /* ---- prompt builders (theo hướng system prompt đã chạy ổn ở PersonalNews) ---- */

  function buildSystemPrompt(){
    return [
      'Bạn là trợ lý giải đáp thắc mắc khi đọc sách "Não & Máy" — sách neuroscience viết cho AI engineer, mỗi chương đặt sinh học não cạnh deep learning.',
      'Trả lời bằng tiếng Việt, ngắn gọn, đúng trọng tâm câu hỏi, dựa trên NỘI DUNG SÁCH được cung cấp trong tin nhắn. Có thể bổ sung kiến thức nền chung, nhưng nói rõ phần nào nằm ngoài sách.',
      'Nếu nội dung được cung cấp không đủ để trả lời, nói rõ bạn cần thêm ngữ cảnh gì thay vì đoán mò.',
      'Định dạng: KHÔNG dùng LaTeX/math notation ($..$, \\alpha...); viết ký hiệu Unicode (→, ≥, α) hoặc chữ thường.',
      'KHÔNG dùng bảng markdown | a | b |; nếu cần so sánh, viết dạng bullet gạch đầu dòng. Có thể dùng **in đậm**, `code` và danh sách.',
    ].join('\n');
  }

  function buildUserPrompt(o){
    const parts=['--- Sách: '+(o.bookTitle||'Não & Máy')+' ---'];
    if(o.partTitle) parts.push('--- Phần sách: '+o.partTitle+' ---');
    parts.push('--- Đang đọc: '+(o.sectionTitle||'toàn chương')+' ---');
    parts.push(o.sectionText||'(không có nội dung)');
    let out=parts.join('\n\n');
    if(o.quote) out+='\n\n--- Đoạn người đọc bôi đen ---\n'+o.quote;
    return out+'\n\n--- Câu hỏi mới ---\n'+o.question+'\n';
  }

  const LOGIC={activeHeadingIndex,capText,thinkingConfigFor,pickText,makeSseParser,friendlyError,mdLite,buildSystemPrompt,buildUserPrompt};
  if(typeof module!=='undefined'&&module.exports){ module.exports=LOGIC; }
  root.LOGIC=LOGIC;
})(this);
