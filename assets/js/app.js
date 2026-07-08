
const DATA=window.OWLINA_DATA;
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const lang=document.documentElement.lang.startsWith('en')?'en':'ua';
const FORMSPREE_ENDPOINT='https://formspree.io/f/xbdveazg';
const showAllText=lang==='en'?'Show all':'Показати всі';
function short(t){return t.length>135?t.slice(0,132)+'...':t}
function catFor(item, fallback='ads'){
  const s=(item.src||'').toLowerCase();
  if(s.includes('armona')||s.includes('furniture')||s.includes('woodnest')||s.includes('karnyz')||s.includes('polytsya')||s.includes('shelf')||s.includes('curtain'))return 'furniture';
  if(s.includes('amelie')||s.includes('bizhuter')||s.includes('57fb')||s.includes('7ba2'))return 'jewelry';
  if(s.includes('shelly')||s.includes('weleda')||s.includes('sisters')||s.includes('smile')||s.includes('globe'))return 'beauty';
  if(s.includes('lingerie')||s.includes('linger')||s.includes('ling_')||s.includes('rain_concept')||s.includes('armani')||s.includes('velour'))return 'fashion';
  if(s.includes('harlem'))return 'food';
  if(s.includes('dikiy'))return 'barber';
  if(s.includes('bouqets'))return 'seasonal';
  return fallback;
}
function captionForItem(item){
  const match=DATA.staticLibrary?.find(x=>x.src===item.src);
  return item.caption||match?.caption||'AI static creative';
}
function mediaFigure(item,extra=''){
  const cats=item.cats||[item.cat||catFor(item)];
  const caption=captionForItem(item);
  const preview=cloudinaryImage(item.src,760);
  return `<figure class="shot ${extra}" data-cats="${cats.join(',')}" data-src="${item.src}" data-alt="${item.alt||caption}"><img loading="lazy" decoding="async" src="${preview}" alt="${item.alt||caption}"><figcaption>${caption}</figcaption></figure>`
}
function cloudinaryImage(src,w=900){
  if(!src||!src.includes('res.cloudinary.com')||!src.includes('/image/upload/'))return src;
  return src.replace('/image/upload/',`/image/upload/f_auto,q_auto,c_limit,w_${w}/`);
}
function cloudinaryVideo(src,w=720){
  if(!src||!src.includes('res.cloudinary.com')||!src.includes('/video/upload/'))return src;
  return src.replace('/video/upload/',`/video/upload/q_auto,c_limit,w_${w}/`);
}
function card(p){return `<a class="project-card" href="${lang==='en'?'projects-en.html':'projects.html'}#${p.id}"><figure><img loading="lazy" decoding="async" src="${cloudinaryImage(p.card,640)}" alt="${p.name} AI creative project by OwLina AI Studio"></figure><div class="project-card-body"><h3>${p.name}</h3><p>${short(p.desc[lang])}</p><div class="pill-row">${p.tools.slice(0,3).map(x=>`<span class="pill">${x}</span>`).join('')}</div></div></a>`}
function posterFor(src){
  if(!src||!src.includes('res.cloudinary.com')||!src.includes('/video/upload/'))return '';
  return src.replace('/video/upload/','/video/upload/so_1,f_jpg,q_auto,c_limit,w_640/').replace(/\.(mp4|mov|webm)(\?.*)?$/i,'.jpg');
}
function scrollToHash(){
  if(!location.hash)return;
  const target=document.querySelector(location.hash);
  if(!target)return;
  const header=document.querySelector('.site-header');
  const offset=(header?.offsetHeight||0)+14;
  const top=target.getBoundingClientRect().top+window.scrollY-offset;
  window.scrollTo({top:Math.max(0,top),behavior:'auto'});
}
function allStatic(){
  let all=DATA.staticLibrary ? [...DATA.staticLibrary] : [];
  if(!all.length){
    DATA.projects.forEach(p=>(p.works||[]).forEach(x=>all.push({...x,cats:[catFor(x)]})));
    DATA.extraSeries.forEach(g=>g.items.forEach(u=>all.push({src:u,alt:g.title[lang]+' AI visual',cats:[catFor({src:u})]})));
  }
  return all;
}
function featuredStatic(){
  const all=allStatic();
  return (DATA.staticFeatured||[]).map(src=>all.find(x=>x.src===src)||{src,cats:[],alt:'AI static creative by OwLina AI Studio'}).filter(Boolean);
}
function renderStatic(){
  const wrap=$('#static-gallery'); if(!wrap)return;
  const isStaticPage=location.pathname.includes('static');
  const all=isStaticPage?allStatic():featuredStatic();
  wrap.innerHTML=all.map(x=>mediaFigure(x)).join('');
  if(!isStaticPage)wrap.classList.add('static-preview','collapsed');
  else wrap.classList.remove('static-preview','collapsed');
  const filters=$('#static-filters');
  if(filters)filters.innerHTML=isStaticPage?DATA.staticCategories.map((c,i)=>`<button class="filter-btn ${i===0?'active':''}" data-cat="${c.id}">${c[lang]}</button>`).join(''):'';
}
function applyStaticFilter(cat){
  const wrap=$('#static-gallery'); if(!wrap)return;
  wrap.classList.remove('collapsed');
  $$('.filter-btn').forEach(b=>b.classList.toggle('active',b.dataset.cat===cat));
  $$('#static-gallery .shot').forEach(sh=>{
    const cats=(sh.dataset.cats||'').split(',');
    sh.style.display=(cat==='all'||cats.includes(cat))?'':'none'
  });
  const action=$('[data-show-static]'); if(action) action.style.display = cat==='all' ? '' : 'none';
}
function renderHome(){
  const grid=$('#featured-projects'); if(grid)grid.innerHTML=DATA.projects.filter(p=>p.featured).map(card).join('');
  renderStatic();
  const featuredNames=['Amelie Accessories video campaign','Armani Sì campaign edit','BlinkBetter CGI ingredients','Velour Store motion creative','Cartoon Strawberry Banana Love Animation','AI Influencer Kiara Lifestyle Video','HeyGen AI Avatar: Saving Our Oceans','AI Memories Emotional Video Creative'];
  const featuredVideos=featuredNames.map(name=>DATA.videos.find(v=>v.title===name)).filter(Boolean);
  const mv=$('#motion-grid'); if(mv)mv.innerHTML=featuredVideos.map(videoCard).join('');
}
function renderProjects(){
  const list=$('#case-list'); if(!list)return;
  list.innerHTML=DATA.projects.map(p=>{
    const before=[...(p.before||[]),...(p.process||[])];
    return `<article class="case" id="${p.id}"><h2>${p.name}</h2><div class="case-layout"><div class="case-top"><aside class="case-aside"><p class="case-copy">${p.desc[lang]}</p><div class="pill-row">${p.tools.map(x=>`<span class="pill">${x}</span>`).join('')}</div></aside>${before.length?`<div class="case-before"><h3>${lang==='en'?'Before / process':'До / процес'}</h3><div class="mini-gallery">${before.map(x=>mediaFigure(x)).join('')}</div></div>`:''}</div><div><h3>AI Production</h3><div class="masonry">${(p.works||[]).map(x=>mediaFigure(x)).join('')}</div>${p.videos&&p.videos.length?`<h3>${lang==='en'?'Video':'Відео'}</h3><div class="video-grid">${p.videos.map(videoCard).join('')}</div>`:''}</div></div></article>`
  }).join('');
  if(location.hash){
    if('scrollRestoration' in history)history.scrollRestoration='manual';
    requestAnimationFrame(scrollToHash);
    [240,700,1400,2200].forEach(delay=>setTimeout(scrollToHash,delay));
  }
}
function renderVideosPage(){
  const full=$('#all-video-grid'); if(!full)return;
  const filters=$('#video-filters');
  if(filters)filters.innerHTML=DATA.videoCategories.map((c,i)=>`<button class="video-filter filter-btn ${i===0?'active':''}" data-video-cat="${c.id}">${c[lang]}</button>`).join('');
  full.innerHTML=DATA.videos.map(videoCard).join('');
}
function videoCard(v){const poster=posterFor(v.src);const webVideo=cloudinaryVideo(v.src,720);return `<article class="video-card" data-category="${v.category}" data-video-src="${webVideo}"><video src="${webVideo}" ${poster?`poster="${poster}"`:''} controls muted playsinline preload="none"></video><h3>${v.title}</h3></article>`}
renderHome();renderProjects();renderVideosPage();
document.addEventListener('click',e=>{
  const videoFilter=e.target.closest('.video-filter'); if(videoFilter){$$('.video-filter').forEach(x=>x.classList.remove('active'));videoFilter.classList.add('active');const cat=videoFilter.dataset.videoCat;$$('#all-video-grid .video-card').forEach(card=>{card.style.display=(cat==='all'||card.dataset.category===cat)?'':'none'});}
  const filter=e.target.closest('.filter-btn:not(.video-filter)'); if(filter)applyStaticFilter(filter.dataset.cat);
  const serviceTab=e.target.closest('.stab'); if(serviceTab){$$('.stab').forEach(x=>x.classList.remove('active'));$$('.spanel').forEach(x=>x.classList.remove('active'));serviceTab.classList.add('active');$('#p-'+serviceTab.dataset.p)?.classList.add('active');}
  const show=e.target.closest('[data-show-static]'); if(show){location.href=lang==='en'?'static-en.html':'static.html';}
  const faq=e.target.closest('.faq-q'); if(faq)faq.closest('.faq-item').classList.toggle('open');
  const openBrief=e.target.closest('[data-open-brief]'); if(openBrief){e.preventDefault();const modal=$('.brief-modal');modal?.querySelector('.brief-dialog')?.classList.remove('sent');modal?.classList.add('open');}
  const closeBrief=e.target.closest('[data-close-brief]'); if(closeBrief||e.target.matches('.brief-modal'))$('.brief-modal')?.classList.remove('open');
});
const briefForm=$('.brief-form');
if(briefForm){
  const contactField=$('#brief-contact');
  const validateContact=()=>{
    if(!contactField)return true;
    const v=contactField.value.trim();
    const digits=v.replace(/\D/g,'');
    const isTelegram=/^@[A-Za-z0-9_]{3,32}$/.test(v);
    const isPhone=digits.length>=10;
    const msg=lang==='en'?'Enter Telegram as @username or a phone number with at least 10 digits.':'Вкажіть Telegram у форматі @username або телефон мінімум з 10 цифрами.';
    contactField.setCustomValidity(isTelegram||isPhone?'':msg);
    return contactField.checkValidity();
  };
  contactField?.addEventListener('input',validateContact);
  briefForm.addEventListener('submit',async e=>{
    e.preventDefault();
    const status=$('.brief-status');
    status.classList.remove('error');
    status.textContent='';
    if(!validateContact()){
      status.textContent=lang==='en'?'Enter Telegram as @username or a phone number with at least 10 digits.':'Вкажіть Telegram у форматі @username або телефон мінімум з 10 цифрами.';
      status.classList.add('error');
      contactField.reportValidity();
      contactField.focus();
      return;
    }
    if(FORMSPREE_ENDPOINT.includes('REPLACE_WITH_YOUR_ID')){
      status.textContent=lang==='en'?'Formspree is not connected yet. Add your Formspree form ID first.':'Formspree ще не підключено. Спочатку додайте ID форми Formspree.';
      status.classList.add('error');
      return;
    }
    const submit=briefForm.querySelector('button[type="submit"]');
    submit.disabled=true;
    status.textContent=lang==='en'?'Sending...':'Надсилаю...';
    try{
      const res=await fetch(FORMSPREE_ENDPOINT,{method:'POST',headers:{Accept:'application/json'},body:new FormData(briefForm)});
      if(!res.ok)throw new Error('send failed');
      briefForm.reset();
      status.textContent='';
      const dialog=briefForm.closest('.brief-dialog');
      const success=dialog?.querySelector('.brief-success');
      if(success)success.textContent=briefForm.dataset.success;
      dialog?.classList.add('sent');
    }catch(err){
      status.textContent=lang==='en'?'Something went wrong. Please try again or contact me on Telegram.':'Щось пішло не так. Спробуйте ще раз або напишіть мені в Telegram.';
      status.classList.add('error');
    }finally{
      submit.disabled=false;
    }
  });
}
let lbItems=[],lbIndex=0,scale=1,tx=0,ty=0,drag=false,sx=0,sy=0;
function isVisible(el){return getComputedStyle(el).display!=='none'&&!!(el.offsetWidth||el.offsetHeight||el.getClientRects().length)}
function collect(scope=document){lbItems=$$('.shot',scope).filter(isVisible).map(el=>({src:el.dataset.src,alt:el.dataset.alt}))}
function apply(){const im=$('#lb-img');if(im)im.style.transform=`translate(${tx}px,${ty}px) scale(${scale})`}
function showLbItem(){scale=1;tx=0;ty=0;const im=$('#lb-img');if(!im||!lbItems.length)return;im.src=lbItems[lbIndex].src;im.alt=lbItems[lbIndex].alt;$('.lightbox').classList.add('open');apply()}
function openLbFromShot(sh){const scope=sh.closest('.mini-gallery,.masonry,#static-gallery')||document;collect(scope);lbIndex=Math.max(0,lbItems.findIndex(x=>x.src===sh.dataset.src));showLbItem()}
document.addEventListener('click',e=>{const sh=e.target.closest('.shot');if(sh)openLbFromShot(sh);if(e.target.matches('.lb-close'))$('.lightbox').classList.remove('open');if(e.target.matches('.lb-prev')&&lbItems.length){lbIndex=(lbIndex-1+lbItems.length)%lbItems.length;showLbItem()}if(e.target.matches('.lb-next')&&lbItems.length){lbIndex=(lbIndex+1)%lbItems.length;showLbItem()}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){$('.lightbox')?.classList.remove('open');$('.brief-modal')?.classList.remove('open')}});
const vp=$('.lightbox-viewport');if(vp){vp.addEventListener('wheel',e=>{e.preventDefault();scale=Math.min(6,Math.max(1,scale+(e.deltaY<0?.25:-.25)));if(scale===1){tx=0;ty=0}apply()},{passive:false});vp.addEventListener('pointerdown',e=>{drag=true;sx=e.clientX-tx;sy=e.clientY-ty;vp.setPointerCapture(e.pointerId)});vp.addEventListener('pointermove',e=>{if(!drag||scale===1)return;tx=e.clientX-sx;ty=e.clientY-sy;apply()});vp.addEventListener('pointerup',()=>drag=false)}
document.addEventListener('mouseover',e=>{const card=e.target.closest('.video-card');if(!card)return;const v=card.querySelector('video');if(v){v.muted=true;v.play().catch(()=>{})}});
document.addEventListener('mouseout',e=>{const card=e.target.closest('.video-card');if(!card||card.contains(e.relatedTarget))return;const v=card.querySelector('video');if(v){v.pause();v.currentTime=0}});
document.addEventListener('click',e=>{const card=e.target.closest('.video-card');if(!card)return;const src=card.dataset.videoSrc||card.querySelector('video')?.currentSrc||card.querySelector('video')?.src;if(!src)return;const modal=$('.video-modal');const player=$('#video-modal-player');if(modal&&player){player.src=src;player.play().catch(()=>{});modal.classList.add('open')}});
document.addEventListener('click',e=>{if(e.target.matches('.video-modal-close')||e.target.matches('.video-modal')){const modal=$('.video-modal');const player=$('#video-modal-player');if(player){player.pause();player.removeAttribute('src');player.load()}modal?.classList.remove('open')}});
const aboutGrid=$('.about-grid');
if(aboutGrid&&'IntersectionObserver' in window){
  const io=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('reveal-in');io.unobserve(entry.target)}}),{threshold:.22});
  io.observe(aboutGrid);
}else if(aboutGrid){aboutGrid.classList.add('reveal-in')}
const heroMedia=$('.hero-media');
if(heroMedia&&matchMedia('(pointer:fine)').matches){
  document.addEventListener('mousemove',e=>{
    const x=(e.clientX/window.innerWidth-.5)*10;
    const y=(e.clientY/window.innerHeight-.5)*8;
    heroMedia.style.transform=`translate3d(${x}px,${y}px,0)`;
  });
}
if(matchMedia('(pointer:fine)').matches&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
  const glow=document.createElement('div');
  glow.className='cursor-glow';
  document.body.appendChild(glow);
  let gx=window.innerWidth/2,gy=window.innerHeight/2,txg=gx,tyg=gy,raf=null;
  function moveGlow(){
    gx+=(txg-gx)*0.16;
    gy+=(tyg-gy)*0.16;
    glow.style.transform=`translate3d(${gx}px,${gy}px,0) translate(-50%,-50%)`;
    raf=requestAnimationFrame(moveGlow);
  }
  document.addEventListener('mousemove',e=>{
    txg=e.clientX;tyg=e.clientY;
    glow.style.opacity='1';
    if(!raf)moveGlow();
  });
  document.addEventListener('mouseleave',()=>{glow.style.opacity='0'});
  document.addEventListener('mouseenter',()=>{glow.style.opacity='1'});
}
