/* ═══════════════════════════════════════════════════════════
   SHARED CHROME — loads on every page
   Every module guards its own root element, so a page that
   does not contain a given widget simply skips it.
   ═══════════════════════════════════════════════════════════ */

/* ═══════════════ CONFIG ═══════════════ */
const WA = "971543871702";
const MAIL = "privateadvisory@emanuelrendas.com";
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const noHover = window.matchMedia('(hover: none)').matches;

/* ═══════════════ PRELOADER ═══════════════
   Shown once per session only. On an MPA, replaying a 900ms
   curtain on every navigation reads as slowness, not polish. */
(function(){
  const loader = document.getElementById('loader');
  if(!loader) return;
  const seen = sessionStorage.getItem('er-seen');
  if(seen){ loader.remove(); document.body.classList.add('ready'); startHero(0); return; }
  window.addEventListener('load', ()=>{
    setTimeout(()=>{ loader.classList.add('gone'); document.body.classList.add('ready'); }, 700);
    setTimeout(()=> startHero(), 850);
    sessionStorage.setItem('er-seen','1');
  });
})();

/* ═══════════════ HERO LETTER REVEAL ═══════════════
   Each word is wrapped as an inline-block unit so the browser
   can still break lines between words — splitting into bare
   letters used to hyphenate mid-word on narrow screens. */
function splitRow(el){
  const text = el.dataset.text || el.textContent;
  el.innerHTML = '';
  text.split(' ').forEach((word, wi, arr)=>{
    const w = document.createElement('span');
    w.className = 'w';
    [...word].forEach(ch=>{
      const s = document.createElement('span');
      s.className = 'l';
      s.textContent = ch;
      w.appendChild(s);
    });
    el.appendChild(w);
    if(wi < arr.length - 1) el.appendChild(document.createTextNode(' '));
  });
}
function startHero(step){
  const rows = document.querySelectorAll('.row1, .row2');
  if(!rows.length) return;
  const gap = step === 0 ? 0 : 22;
  const all = [...document.querySelectorAll('.row1 .l, .row2 .l')];
  all.forEach((s,i)=> gap ? setTimeout(()=> s.classList.add('on'), i*gap) : s.classList.add('on'));
  document.getElementById('hero-sub')?.classList.add('on');
  document.getElementById('hero-ctas')?.classList.add('on');
}
(function(){
  const r1 = document.querySelector('.row1'), r2 = document.querySelector('.row2');
  if(r1) splitRow(r1);
  if(r2) splitRow(r2);
})();

/* ═══════════════ CHAMPAGNE DUST (canvas) ═══════════════ */
(function(){
  const cv = document.getElementById('dust');
  if(!cv) return;
  const cx = cv.getContext('2d');
  let W,H,parts=[],mx=0.5,my=0.5;
  function sizeCanvas(){
    W = cv.width = cv.offsetWidth * devicePixelRatio;
    H = cv.height = cv.offsetHeight * devicePixelRatio;
  }
  function makeParts(){
    const n = window.innerWidth < 700 ? 34 : 64;
    parts = Array.from({length:n},()=>({
      x:Math.random(), y:Math.random(),
      r:(Math.random()*1.6+0.5)*devicePixelRatio,
      vy:-(Math.random()*0.00022+0.00006),
      vx:(Math.random()-0.5)*0.00012,
      o:Math.random()*0.5+0.15,
      p:Math.random()*0.6+0.4      /* parallax depth */
    }));
  }
  function tick(){
    cx.clearRect(0,0,W,H);
    const ox=(mx-0.5)*40*devicePixelRatio, oy=(my-0.5)*26*devicePixelRatio;
    for(const p of parts){
      p.y += p.vy; p.x += p.vx;
      if(p.y < -0.05){ p.y = 1.05; p.x = Math.random(); }
      if(p.x < -0.05) p.x = 1.05; if(p.x > 1.05) p.x = -0.05;
      cx.beginPath();
      cx.arc(p.x*W + ox*p.p, p.y*H + oy*p.p, p.r, 0, 6.283);
      cx.fillStyle = `rgba(196,162,101,${p.o})`;
      cx.fill();
    }
    if(!reduced) requestAnimationFrame(tick);
  }
  sizeCanvas(); makeParts();
  if(reduced){ tick(); } else { requestAnimationFrame(tick); }
  window.addEventListener('resize', ()=>{ sizeCanvas(); makeParts(); }, {passive:true});
  window.addEventListener('mousemove', e=>{
    mx = e.clientX / window.innerWidth; my = e.clientY / window.innerHeight;
    const sk = document.getElementById('skyline');
    if(sk && !reduced) sk.style.transform = `translateX(${(mx-0.5)*-18}px)`;
  }, {passive:true});
})();

/* ═══════════════ CURSOR ═══════════════ */
(function(){
  if(noHover || reduced) return;
  const dot=document.getElementById('cur-dot'), ring=document.getElementById('cur-ring');
  if(!dot || !ring) return;
  let tx=0,ty=0,rx=0,ry=0;
  window.addEventListener('mousemove',e=>{ tx=e.clientX; ty=e.clientY; dot.style.left=tx+'px'; dot.style.top=ty+'px'; },{passive:true});
  (function loop(){ rx+=(tx-rx)*0.14; ry+=(ty-ry)*0.14; ring.style.left=rx+'px'; ring.style.top=ry+'px'; requestAnimationFrame(loop); })();
  document.addEventListener('mouseover', e=>{
    if(e.target.closest('a,button,.qo,.tt,.faq-q,.map-pin,input,select,textarea')) ring.classList.add('hot');
  });
  document.addEventListener('mouseout', e=>{
    if(e.target.closest('a,button,.qo,.tt,.faq-q,.map-pin,input,select,textarea')) ring.classList.remove('hot');
  });
})();

/* ═══════════════ MAGNETIC BUTTONS ═══════════════ */
if(!noHover && !reduced){
  document.querySelectorAll('.magnetic').forEach(btn=>{
    btn.addEventListener('mousemove', e=>{
      const r = btn.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width/2), dy = e.clientY - (r.top + r.height/2);
      btn.style.transform = `translate(${dx*0.10}px, ${dy*0.14}px)`;
    });
    btn.addEventListener('mouseleave', ()=> btn.style.transform = '');
  });
}

/* ═══════════════ NAV + PROGRESS ═══════════════ */
const nav = document.getElementById('nav');
const hasHero = !!document.querySelector('.hero');
const navToggle = document.getElementById('nav-tg');
const navLinks = document.getElementById('nav-links');
(function(){
  const progress = document.getElementById('progress');
  let ticking = false;
  const onScroll = ()=>{
    if(ticking) return;
    ticking = true;
    requestAnimationFrame(()=>{
      /* Only the home page has a hero to sit behind a transparent bar. On
         every other route the content begins directly under the nav, so a
         see-through bar lets headings slide under it during the first 70px
         of scroll. Those pages stay solid throughout. */
      nav?.classList.toggle('solid', hasHero ? scrollY > 70 : true);
      if(progress){
        const h = document.documentElement.scrollHeight - innerHeight;
        progress.style.width = (h > 0 ? scrollY/h*100 : 0) + '%';
      }
      ticking = false;
    });
  };
  window.addEventListener('scroll', onScroll, {passive:true});
  onScroll();

  if(navToggle && navLinks){
    const setOpen = (open)=>{
      navLinks.classList.toggle('open', open);
      navToggle.classList.toggle('open', open);
      navToggle.setAttribute('aria-expanded', String(open));
      navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      document.body.classList.toggle('nav-open', open);
    };
    navToggle.addEventListener('click', ()=> setOpen(!navLinks.classList.contains('open')));
    navLinks.querySelectorAll('a').forEach(a=> a.addEventListener('click', ()=> setOpen(false)));
    document.addEventListener('keydown', e=>{ if(e.key === 'Escape') setOpen(false); });
  }
})();

/* ═══════════════ SOCIAL LINKS ═══════════════
   ⚙ Replace the four URLs below with your own profiles.
   Leave a value empty ('') and that icon simply will not render. */
const SOCIAL = {
  instagram: 'https://www.instagram.com/emanuel_rendas/',
  youtube:   'https://www.youtube.com/@Emanuelrendaspt',
  facebook:  'https://www.facebook.com/emanuelrendass',
  linkedin:  '',   /* ← paste your LinkedIn URL here when ready */
};

const SOCIAL_ICONS = {
  linkedin:  '<path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zm1.78 13.02H3.55V9h3.57v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z"/>',
  instagram: '<path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41-.56-.22-.96-.48-1.38-.9-.42-.42-.68-.82-.9-1.38-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16zM12 0C8.74 0 8.33.01 7.05.07c-1.28.06-2.15.26-2.91.56-.79.31-1.46.72-2.13 1.38A5.9 5.9 0 0 0 .63 4.14c-.3.76-.5 1.63-.56 2.91C.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.28.26 2.15.56 2.91.31.79.72 1.46 1.38 2.13a5.9 5.9 0 0 0 2.13 1.38c.76.3 1.63.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.28-.06 2.15-.26 2.91-.56a5.9 5.9 0 0 0 2.13-1.38 5.9 5.9 0 0 0 1.38-2.13c.3-.76.5-1.63.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.28-.26-2.15-.56-2.91a5.9 5.9 0 0 0-1.38-2.13A5.9 5.9 0 0 0 19.86.63c-.76-.3-1.63-.5-2.91-.56C15.67.01 15.26 0 12 0zm0 5.84a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm7.85-10.4a1.44 1.44 0 1 1-2.88 0 1.44 1.44 0 0 1 2.88 0z"/>',
  youtube:   '<path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.5A3.02 3.02 0 0 0 .5 6.19C0 8.07 0 12 0 12s0 3.93.5 5.81a3.02 3.02 0 0 0 2.12 2.14c1.88.5 9.38.5 9.38.5s7.5 0 9.38-.5a3.02 3.02 0 0 0 2.12-2.14C24 15.93 24 12 24 12s0-3.93-.5-5.81zM9.55 15.57V8.43L15.82 12l-6.27 3.57z"/>',
  facebook:  '<path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z"/>',
};

(function renderSocial(){
  const box = document.getElementById('social-links');
  if(!box) return;
  const labels = {linkedin:'LinkedIn', instagram:'Instagram', youtube:'YouTube', facebook:'Facebook'};
  const html = Object.entries(SOCIAL)
    .filter(([k,url]) => url && !url.includes('YOUR-HANDLE'))
    .map(([k,url]) =>
      `<a href="${url}" target="_blank" rel="noopener noreferrer me" aria-label="${labels[k]}">
         <svg viewBox="0 0 24 24" aria-hidden="true">${SOCIAL_ICONS[k]}</svg>
       </a>`).join('');
  if(html) box.innerHTML = html;
  else box.closest('.ft-social')?.querySelector('.fs-l')?.remove();
})();

/* ═══════════════ IN-PAGE ANCHORS ═══════════════
   Only same-page hashes are intercepted; real routes navigate
   natively so the browser owns history and the back button.
   Offset comes from CSS scroll-margin-top, not a magic number. */
document.addEventListener('click', function(e){
  const link = e.target.closest('a[href^="#"]');
  if(!link) return;
  const id = link.getAttribute('href').slice(1);
  if(!id) return;
  const target = document.getElementById(id);
  if(!target) return;
  e.preventDefault();
  navLinks?.classList.remove('open');
  document.body.classList.remove('nav-open');
  target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  history.replaceState(null, '', '#' + id);
}, false);

/* external links open in a new tab */
document.querySelectorAll('a[href^="http"]').forEach(a=>{
  if(a.hostname && a.hostname !== location.hostname){
    a.setAttribute('target','_blank');
    a.setAttribute('rel','noopener noreferrer');
  }
});

/* ═══════════════ CROSS-PAGE TRANSITIONS + PREFETCH ═══════════════
   View Transitions handle the cross-fade where supported (opted in
   from CSS). Prefetch on intent makes the next page land instantly;
   anything unsupported just navigates normally. */
(function(){
  if(!('connection' in navigator) || !navigator.connection?.saveData){
    const primed = new Set();
    const prime = (href)=>{
      if(!href || primed.has(href)) return;
      primed.add(href);
      const l = document.createElement('link');
      l.rel = 'prefetch'; l.href = href; l.as = 'document';
      document.head.appendChild(l);
    };
    const onIntent = e=>{
      const a = e.target.closest('a[href^="/"]');
      if(a && a.hostname === location.hostname && a.pathname !== location.pathname) prime(a.pathname);
    };
    document.addEventListener('mouseover', onIntent, {passive:true});
    document.addEventListener('touchstart', onIntent, {passive:true});
    document.addEventListener('focusin', onIntent, {passive:true});
  }
})();

/* ═══════════════ REVEALS ═══════════════ */
(function(){
  const targets = document.querySelectorAll('.rv');
  if(!targets.length) return;
  if(reduced){ targets.forEach(el=> el.classList.add('in')); return; }
  const io = new IntersectionObserver(es=>{
    es.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
  },{threshold:0.12, rootMargin:'0px 0px -40px 0px'});
  targets.forEach(el=> io.observe(el));
})();

/* ═══════════════ ADDRESS CARD GLOW ═══════════════ */
if(!noHover){
  document.querySelectorAll('.addr-c').forEach(c=>{
    c.addEventListener('mousemove', e=>{
      const r = c.getBoundingClientRect();
      c.style.setProperty('--mx', (e.clientX-r.left)+'px');
      c.style.setProperty('--my', (e.clientY-r.top)+'px');
    });
  });
}

/* ═══════════════ MARQUEE DUPLICATE ═══════════════ */
(function(){
  const mq = document.getElementById('mq');
  if(mq) mq.innerHTML += mq.innerHTML;
})();

/* ═══════════════ FAQ ═══════════════ */
document.querySelectorAll('.faq-q').forEach(q=>{
  q.setAttribute('aria-expanded','false');
  q.addEventListener('click', ()=>{
    const item = q.parentElement, a = item.querySelector('.faq-a');
    const open = item.classList.contains('open');
    document.querySelectorAll('.faq-i').forEach(i=>{
      i.classList.remove('open');
      i.querySelector('.faq-a').style.maxHeight = null;
      i.querySelector('.faq-q')?.setAttribute('aria-expanded','false');
    });
    if(!open){
      item.classList.add('open');
      a.style.maxHeight = a.scrollHeight + 'px';
      q.setAttribute('aria-expanded','true');
    }
  });
});

/* ═══════════════ 3D TILT ON CARDS ═══════════════ */
if(!reduced && !noHover){
  document.querySelectorAll('.philo-c, .ins-c').forEach(card=>{
    card.classList.add('tilt');
    card.addEventListener('mousemove', e=>{
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left)/r.width - 0.5;
      const py = (e.clientY - r.top)/r.height - 0.5;
      card.style.transform = `perspective(900px) rotateY(${px*4}deg) rotateX(${-py*4}deg) translateZ(6px)`;
    });
    card.addEventListener('mouseleave', ()=> card.style.transform = '');
  });
}

/* ═══════════════ PROVENANCE — tap support on touch ═══════════════ */
document.querySelectorAll('.src').forEach(el=>{
  el.addEventListener('click', e=>{
    e.stopPropagation();
    const wasOpen = el.classList.contains('open');
    document.querySelectorAll('.src.open').forEach(x=>x.classList.remove('open'));
    if(!wasOpen) el.classList.add('open');
  });
  el.addEventListener('keydown', e=>{
    if(e.key==='Enter'||e.key===' '){ e.preventDefault(); el.classList.toggle('open'); }
    if(e.key==='Escape') el.classList.remove('open');
  });
});
document.addEventListener('click', ()=> document.querySelectorAll('.src.open').forEach(x=>x.classList.remove('open')));

/* ═══════════════ FUNNEL EVENTS ═══════════════
   A session id that lives only for this tab, and a small set of named
   events. Nothing here identifies a person; the server refuses any event
   name and any property it does not already know about.

   Failure is silent on purpose. Telemetry that breaks a page is worse
   than telemetry that is missing. */
window.Track = (function(){
  let sid = null;
  try {
    sid = sessionStorage.getItem('er_sid');
    if(!sid){
      sid = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2));
      sessionStorage.setItem('er_sid', sid);
    }
  } catch { /* private mode, storage disabled — events simply stop */ }

  return function track(event_name, event_props){
    if(!sid) return;
    try {
      fetch('/api/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        /* pathname only, never location.href. The instruments page serialises
           the visitor's own figures into the query string so a model can be
           shared by link — sending the full URL would carry their purchase
           price out of the browser on every event. The server strips the
           query too, but the figure should never travel in the first place. */
        body: JSON.stringify({ session_id: sid, event_name, event_props: event_props || null, page_url: location.pathname }),
        keepalive: true,
      }).catch(()=>{});
    } catch { /* never let this surface */ }
  };
})();

/* ═══════════════ BRIEF FORM → STORED, THEN WHATSAPP ═══════════════
   The brief used to open WhatsApp and keep no record, so anyone who
   hesitated at the handoff — pop-up blocked, no WhatsApp on the device,
   or simply a change of mind — vanished without trace.

   Now it is stored first. Two details matter in the ordering below:

   · WhatsApp is opened SYNCHRONOUSLY, before any await. A pop-up opened
     after an await has lost the user-gesture context and blockers kill
     it. The visitor's experience is unchanged and instant.

   · Storage failing does not block the handoff, and the handoff failing
     does not block storage. They are independent paths to the same lead,
     which is the entire point — either one alone still reaches me. */
(function(){
  const form = document.getElementById('brief-form');
  if(!form) return;
  const val = id => (document.getElementById(id)?.value || '').trim();
  const compose = ()=>
    "PRIVATE BRIEF — via website\n" +
    "Name: " + (val('b-name') || "—") + "\n" +
    "Email: " + (val('b-email') || "—") + "\n" +
    "Based in: " + (val('b-base') || "—") + "\n" +
    "Interest: " + val('b-int') + "\n" +
    "Budget: " + val('b-bud') + "\n" +
    "Brief: " + (val('b-msg') || "—");

  form.addEventListener('submit', function(e){
    e.preventDefault();
    const msg = compose();

    /* First, and synchronously — see the note above. */
    const win = window.open("https://wa.me/" + WA + "?text=" + encodeURIComponent(msg), "_blank");
    window.Track && window.Track('whatsapp_clicked', { budget_band: val('b-bud'), objective: val('b-int') });

    const fb   = document.getElementById('brief-fallback');
    const note = document.getElementById('brief-stored');
    const p = new URLSearchParams(location.search);

    fetch('/api/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        name:  val('b-name'),
        email: val('b-email'),
        address: val('b-base'),
        investment_objective: val('b-int'),
        budget_band: val('b-bud'),
        notes: val('b-msg'),
        preferred_language: (document.documentElement.lang || 'en').slice(0,2),
        referrer_url: document.referrer || null,
        utm_source: p.get('utm_source'), utm_medium: p.get('utm_medium'), utm_campaign: p.get('utm_campaign'),
      }),
    })
    .then(r => r.json().catch(()=>({ ok:false })))
    .then(d => {
      window.Track && window.Track('form_submitted', { stored: !!(d && d.ok), budget_band: val('b-bud') });
      if(note){
        note.hidden = false;
        note.textContent = (d && d.ok)
          ? 'Your brief has reached me. I respond within one business day.'
          : 'Your brief did not save — please send it on WhatsApp, or by email below.';
        note.classList.toggle('warn', !(d && d.ok));
      }
    })
    .catch(()=>{
      window.Track && window.Track('form_submitted', { stored: false });
      if(note){
        note.hidden = false;
        note.textContent = 'Your brief did not save — please send it on WhatsApp, or by email below.';
        note.classList.add('warn');
      }
    });

    if(fb){
      const mail = document.getElementById('brief-mail');
      if(mail) mail.href = "mailto:" + MAIL + "?subject=" + encodeURIComponent("Private brief — " + (val('b-name') || 'website')) + "&body=" + encodeURIComponent(msg);
      const copy = document.getElementById('brief-copy');
      if(copy) copy.onclick = ()=>{
        navigator.clipboard?.writeText(msg).then(()=>{ copy.textContent = 'Copied'; setTimeout(()=> copy.textContent = 'Copy the brief', 2200); });
      };
      fb.hidden = false;
      if(!win || win.closed) fb.classList.add('urgent');
    }
  });
})();
