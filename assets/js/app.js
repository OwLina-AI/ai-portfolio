
let DATA=window.OWLINA_DATA;
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const lang=document.documentElement.lang.startsWith('en')?'en':'ua';
const FORMSPREE_ENDPOINT='https://formspree.io/f/xbdveazg';
const showAllText=lang==='en'?'Show all':'Показати всі';
function localized(row,field){return row?.[`${field}_${lang}`]||row?.[`${field}_ua`]||row?.[`${field}_en`]||''}
function featuredOrder(a,b){return (a.featured_order??a.sort_order??9999)-(b.featured_order??b.sort_order??9999)}
async function loadSupabasePortfolio(){
  const config=window.OWLINA_SUPABASE;
  if(!window.supabase?.createClient||!config?.url||!config?.publishableKey)return null;
  const client=window.supabase.createClient(config.url,config.publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const [projectsResult,assetsResult,mediaResult,galleryResult]=await Promise.all([
    client.from('projects').select('*').eq('published',true).order('sort_order'),
    client.from('media_assets').select('*').eq('archived',false).eq('public_visible',true),
    client.from('project_media').select('*').eq('published',true).order('sort_order'),
    client.from('gallery_items').select('*').eq('published',true).order('sort_order')
  ]);
  const failed=[projectsResult,assetsResult,mediaResult,galleryResult].find(result=>result.error);
  if(failed)throw failed.error;
  const assets=new Map((assetsResult.data||[]).map(asset=>[asset.id,asset]));
  const media=(mediaResult.data||[]).filter(item=>assets.has(item.asset_id));
  const gallery=(galleryResult.data||[]).filter(item=>assets.has(item.asset_id));
  const imageItem=(item)=>{
    const asset=assets.get(item.asset_id);
    const caption=localized(item,'caption')||localized(item,'title')||localized(asset,'alt')||'AI static creative';
    return {src:asset.source_url,alt:localized(asset,'alt')||caption,caption,cats:item.categories||[]};
  };
  const videoItem=(item)=>{
    const asset=assets.get(item.asset_id);
    return {src:asset.source_url,title:localized(item,'title')||localized(asset,'alt')||'AI Video',category:item.category||(item.categories||[])[0]||'creative',featured:!!item.featured};
  };
  const remoteProjects=(projectsResult.data||[]).map(project=>{
    const parts=media.filter(item=>item.project_id===project.id);
    const cover=assets.get(project.cover_asset_id);
    const images=(section)=>parts.filter(item=>item.section===section&&assets.get(item.asset_id)?.media_type==='image').map(imageItem);
    const projectVideos=parts.filter(item=>item.section==='video'&&assets.get(item.asset_id)?.media_type==='video').map(videoItem);
    const works=images('works');
    return {
      id:project.id,
      name:localized(project,'name'),
      desc:{ua:project.description_ua||'',en:project.description_en||project.description_ua||''},
      card:cover?.source_url||works[0]?.src||'',
      tools:project.tools||[],
      featured:!!project.featured,
      before:images('before'),
      process:images('process'),
      works,
      videos:projectVideos
    };
  });
  const staticRows=gallery.filter(item=>item.gallery_type==='static');
  const videoRows=gallery.filter(item=>item.gallery_type==='video');
  return {
    ...DATA,
    projects:remoteProjects,
    staticLibrary:staticRows.map(imageItem),
    staticFeatured:staticRows.filter(item=>item.featured).sort(featuredOrder).map(item=>assets.get(item.asset_id).source_url),
    videos:videoRows.map(videoItem)
  };
}
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
  const featuredNames=['Amelie Accessories video campaign','Armani Sì campaign edit','BlinkBetter CGI ingredients','Fashion Full Look Motion Editorial','AI Cartoon Mascot for Shelley','AI Influencer Kiara Lifestyle Video','HeyGen AI Avatar: Saving Our Oceans','AI Fashion Editorial Motion'];
  const selectedVideos=DATA.videos.filter(v=>v.featured).slice(0,8);
  const featuredVideos=selectedVideos.length?selectedVideos:featuredNames.map(name=>DATA.videos.find(v=>v.title===name)).filter(Boolean);
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
function renderPortfolio(){renderHome();renderProjects();renderVideosPage()}
renderPortfolio();
loadSupabasePortfolio().then(remote=>{
  if(!remote)return;
  DATA=remote;
  renderPortfolio();
}).catch(error=>console.warn('OwLina portfolio fallback is active:',error.message));
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
let lbItems=[],lbIndex=0,scale=1,tx=0,ty=0,drag=false,sx=0,sy=0,dragPointer=null;
function isVisible(el){return getComputedStyle(el).display!=='none'&&!!(el.offsetWidth||el.offsetHeight||el.getClientRects().length)}
function collect(scope=document){lbItems=$$('.shot',scope).filter(isVisible).map(el=>({src:el.dataset.src,alt:el.dataset.alt}))}
function apply(){const im=$('#lb-img'),vp=$('.lightbox-viewport');if(im)im.style.transform=`translate(${tx}px,${ty}px) scale(${scale})`;vp?.classList.toggle('can-pan',scale>1);if(scale===1)vp?.classList.remove('is-panning')}
function resetLbView(){scale=1;tx=0;ty=0;drag=false;dragPointer=null;apply()}
function showLbItem(){resetLbView();const im=$('#lb-img');if(!im||!lbItems.length)return;im.draggable=false;im.src=lbItems[lbIndex].src;im.alt=lbItems[lbIndex].alt;$('.lightbox').classList.add('open');apply()}
function openLbFromShot(sh){const scope=sh.closest('.mini-gallery,.masonry,#static-gallery')||document;collect(scope);lbIndex=Math.max(0,lbItems.findIndex(x=>x.src===sh.dataset.src));showLbItem()}
function closeLightbox(){const lb=$('.lightbox');const im=$('#lb-img');resetLbView();if(im){im.removeAttribute('src');im.alt=''}lb?.classList.remove('open')}
function stopLb(e){e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation()}
function bindLbButton(selector,handler){const btn=$(selector);if(!btn)return;['click','pointerup','touchend'].forEach(type=>btn.addEventListener(type,e=>{stopLb(e);handler(e)},{passive:false}))}
bindLbButton('.lb-close',closeLightbox);
bindLbButton('.lb-prev',()=>{if(!lbItems.length)return;lbIndex=(lbIndex-1+lbItems.length)%lbItems.length;showLbItem()});
bindLbButton('.lb-next',()=>{if(!lbItems.length)return;lbIndex=(lbIndex+1)%lbItems.length;showLbItem()});
document.addEventListener('click',e=>{const sh=e.target.closest('.shot');if(sh){e.preventDefault();openLbFromShot(sh)}else if(e.target.matches('.lightbox'))closeLightbox()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeLightbox();$('.brief-modal')?.classList.remove('open')}});
const vp=$('.lightbox-viewport');if(vp){
  const im=$('#lb-img');
  im?.addEventListener('dragstart',e=>e.preventDefault());
  vp.addEventListener('wheel',e=>{
    e.preventDefault();
    const oldScale=scale;
    const nextScale=Math.min(6,Math.max(1,scale+(e.deltaY<0?.25:-.25)));
    if(nextScale===oldScale)return;
    const rect=vp.getBoundingClientRect();
    const px=e.clientX-(rect.left+rect.width/2),py=e.clientY-(rect.top+rect.height/2);
    tx=px-(px-tx)*(nextScale/oldScale);
    ty=py-(py-ty)*(nextScale/oldScale);
    scale=nextScale;
    if(scale===1){tx=0;ty=0}
    apply();
  },{passive:false});
  vp.addEventListener('pointerdown',e=>{
    if(e.target.closest('button')||scale===1||(e.pointerType==='mouse'&&e.button!==0))return;
    e.preventDefault();drag=true;dragPointer=e.pointerId;sx=e.clientX-tx;sy=e.clientY-ty;
    vp.classList.add('is-panning');vp.setPointerCapture(e.pointerId);
  });
  vp.addEventListener('pointermove',e=>{if(!drag||dragPointer!==e.pointerId||scale===1)return;e.preventDefault();tx=e.clientX-sx;ty=e.clientY-sy;apply()});
  const endPan=e=>{if(dragPointer!==null&&e.pointerId!==dragPointer)return;drag=false;dragPointer=null;vp.classList.remove('is-panning');if(vp.hasPointerCapture?.(e.pointerId))vp.releasePointerCapture(e.pointerId)};
  vp.addEventListener('pointerup',endPan);vp.addEventListener('pointercancel',endPan);
  vp.addEventListener('dblclick',e=>{if(e.target.closest('button'))return;e.preventDefault();resetLbView()});
}
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
const heroVideo=$('.hero-showreel video');
const heroPlay=$('.hero-play');
if(heroVideo){
  heroVideo.muted=true;
  heroVideo.loop=true;
  heroVideo.playsInline=true;
  heroVideo.autoplay=true;
  heroVideo.preload='auto';
  const startHeroVideo=()=>{
    heroVideo.muted=true;
    const promise=heroVideo.play();
    if(promise&&typeof promise.catch==='function')promise.catch(()=>{});
  };
  const syncHeroPlay=()=>{if(heroPlay)heroPlay.classList.toggle('visible',heroVideo.paused)};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startHeroVideo,{once:true});
  else startHeroVideo();
  heroVideo.addEventListener('canplay',startHeroVideo,{once:true});
  heroVideo.addEventListener('play',syncHeroPlay);
  heroVideo.addEventListener('pause',syncHeroPlay);
  heroVideo.addEventListener('ended',()=>{heroVideo.currentTime=0;startHeroVideo()});
  heroPlay?.addEventListener('click',e=>{e.preventDefault();startHeroVideo();setTimeout(syncHeroPlay,120)});
  ['pointerdown','touchstart','mousemove','scroll'].forEach(evt=>window.addEventListener(evt,startHeroVideo,{once:true,passive:true}));
  setTimeout(syncHeroPlay,900);
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
