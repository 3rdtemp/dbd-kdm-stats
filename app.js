'use strict';

/* Read-only GitHub Pages statistics. Sync uses a Google Sheets bound Apps Script JSONP endpoint.
   No admin login, remote writes, or private sheet data are included. */
const state = {
  data: null, page: 'dashboard', selectedYear: 'all', recordLimit: 12, detailKiller: null, detailYear: 'all', detailShowAll: false,
  live: false, busy: false, rouletteTab: 'killer', rouletteSpinning: false, rouletteWinner: null, rouletteSoundOn: true,
  filters: { recordSearch: '', recordMode: 'all', recordYear: 'all', recordMonth: 'all', recordOutcome: 'all',
    killerSearch: '', killerYear: 'all', killerCategory: 'all', killerSort: 'roster', survivorYear: 'all', gallerySearch: '', galleryCategory: 'all', galleryOrder: 'roster' }
};
const $ = (id) => document.getElementById(id);
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct = (w,t) => t ? w/t*100 : 0;
const rate = (w,t,n=1) => `${pct(w,t).toFixed(n)}%`;
const num = (v) => Number(v).toLocaleString('ko-KR');
const win = (m) => m.result === 'win';
const allMatches = () => state.data.sessions.flatMap(s => s.rounds.map(r=>({...r, date:s.date, dateISO:s.dateISO, year:s.year, sessionId:s.id})));
const yearFilter = (matches, year) => year==='all' ? matches : matches.filter(m=>String(m.year)===String(year));
const yearSessions = () => state.selectedYear==='all' ? state.data.sessions : state.data.sessions.filter(s=>String(s.year)===String(state.selectedYear));
const scopedMatches = () => yearFilter(allMatches(),state.selectedYear);
const labelMode = {killer:'살인마',survivor:'생존자',unclassified:'확인 필요'};
const labelResult = (m) => m.mode === 'survivor' ? (win(m) ? '탈출':'사망') : (win(m) ? '승':'패');

// All 44 portraits are served locally from the ZIP provided by the site owner.
// Original filenames are preserved, including K05_TheShape and K06_TheHag.
const KILLER_PORTRAITS = {
  '트래퍼':'K01','레이스':'K02','힐빌리':'K03','너스':'K04','쉐이프':'K05','해그':'K06',
  '닥터':'K07','헌트리스':'K08','카니발':'K09','나이트메어':'K10','피그':'K11','클라운':'K12',
  '스피릿':'K13','군단':'K14','역병':'K15','고스트페이스':'K16','데모고르곤':'K17',
  '악귀':'K18','데스슬링거':'K19','처형자':'K20','블라이트':'K21','쌍둥이':'K22',
  '트릭스터':'K23','네메시스':'K24','수도사':'K25','예술가':'K26','원령':'K27',
  '드레지':'K28','마스터마인드':'K29','기사':'K30','해골상인':'K31','특이점':'K32',
  '제노모프':'K33','착한아이':'K34','미지의존재':'K35','리치':'K36',
  '어둠의군주':'K37','조련사':'K38','구울':'K39','애니매트로닉스':'K40',
  '끄라스':'K41','퍼스트':'K42','슬래셔':'K43','심판':'K44'
};
const KILLER_LOCAL_FILES = {
  '트래퍼':'K01_TheTrapper_Portrait.png',
  '레이스':'K02_TheWraith_Portrait.png',
  '힐빌리':'K03_TheHillbilly_Portrait.png',
  '너스':'K04_TheNurse_Portrait.png',
  '쉐이프':'K05_TheShape_Portrait.png',
  '해그':'K06_TheHag_Portrait.png',
  '닥터':'K07_TheDoctor_Portrait.png',
  '헌트리스':'K08_TheHuntress_Portrait.png',
  '카니발':'K09_TheCannibal_Portrait.png',
  '나이트메어':'K10_TheNightmare_Portrait.png',
  '피그':'K11_ThePig_Portrait.png',
  '클라운':'K12_TheClown_Portrait.png',
  '스피릿':'K13_TheSpirit_Portrait.png',
  '군단':'K14_TheLegion_Portrait.png',
  '역병':'K15_ThePlague_Portrait.png',
  '고스트페이스':'K16_TheGhostFace_Portrait.png',
  '데모고르곤':'K17_TheDemogorgon_Portrait.png',
  '악귀':'K18_TheOni_Portrait.png',
  '데스슬링거':'K19_TheDeathslinger_Portrait.png',
  '처형자':'K20_TheExecutioner_Portrait.png',
  '블라이트':'K21_TheBlight_Portrait.png',
  '쌍둥이':'K22_TheTwins_Portrait.png',
  '트릭스터':'K23_TheTrickster_Portrait.png',
  '네메시스':'K24_TheNemesis_Portrait.png',
  '수도사':'K25_TheCenobite_Portrait.png',
  '예술가':'K26_TheArtist_Portrait.png',
  '원령':'K27_TheOnryo_Portrait.png',
  '드레지':'K28_TheDredge_Portrait.png',
  '마스터마인드':'K29_TheMastermind_Portrait.png',
  '기사':'K30_TheKnight_Portrait.png',
  '해골상인':'K31_TheSkullMerchant_Portrait.png',
  '특이점':'K32_TheSingularity_Portrait.png',
  '제노모프':'K33_TheXenomorph_Portrait.png',
  '착한아이':'K34_TheGoodGuy_Portrait.png',
  '미지의존재':'K35_TheUnknown_Portrait.png',
  '리치':'K36_TheLich_Portrait.png',
  '어둠의군주':'K37_TheDarkLord_Portrait.png',
  '조련사':'K38_TheHoundmaster_Portrait.png',
  '구울':'K39_TheGhoul_Portrait.png',
  '애니매트로닉스':'K40_TheAnimatronic_Portrait.png',
  '끄라스':'K41_TheKrasue_Portrait.png',
  '퍼스트':'K42_TheFirst_Portrait.png',
  '슬래셔':'K43_TheSlasher_Portrait.png',
  '심판':'K44_TheJudgment_Portrait.png'
};
const KILLER_ORDER = Object.keys(KILLER_PORTRAITS);
const KDM_FALLBACK_IMAGE = './assets/kdm-logo.png';
// New API: roster is read from the Google Sheet and contains even 0-match killers.
// Older snapshots use the bundled 44-image mapping until the live API responds.
function killerRoster(){
  const source=state.data?.killerRoster;
  if(Array.isArray(source) && source.length){
    return source.filter(item=>item && typeof item.name==='string' && item.name.trim()).map(item=>({
      name:item.name.trim(),
      category:item.category==='licensed'?'licensed':'original',
      imageFile:typeof item.imageFile==='string'?item.imageFile.trim():''
    }));
  }
  return KILLER_ORDER.map(name=>({name,category:state.data?.killerCategories?.[name]||'original',imageFile:KILLER_LOCAL_FILES[name]||''}));
}
function killerOrder(){return killerRoster().map(item=>item.name);}
function portraitSrc(name){
  const roster=state.data?.killerRoster;
  const item=Array.isArray(roster)?roster.find(k=>k?.name===name):null;
  // A blank image filename deliberately means "use the KDM logo".
  const filename=item ? item.imageFile : (KILLER_LOCAL_FILES[name]||'');
  if(typeof filename!=='string' || !/^[A-Za-z0-9_-]+\.(?:png|jpg|jpeg|webp)$/i.test(filename)) return KDM_FALLBACK_IMAGE;
  return `./assets/killers/${encodeURIComponent(filename)}`;
}
function portraitMarkup(name, type='small'){
  const src=portraitSrc(name),isFallback=src===KDM_FALLBACK_IMAGE;
  return `<div class="portrait-slot ${type}${isFallback?' portrait-logo-fallback':''}"><img data-kdm-portrait="1" src="${src}" alt="${esc(name)} 초상화" loading="${type==='large'?'eager':'lazy'}" decoding="async"></div>`;
}
// If an image file has not been uploaded yet, display the KDM logo instead.
document.addEventListener('error', event=>{
  const img=event.target;
  if(!(img instanceof HTMLImageElement))return;
  if(!img.matches('[data-kdm-portrait], .kdm-slot-symbol img'))return;
  if(img.src.endsWith('/assets/kdm-logo.png')) return;
  img.src=KDM_FALLBACK_IMAGE;
  img.closest('.portrait-slot')?.classList.add('portrait-logo-fallback');
},true);

function renderKillerGallery(){
  const node=$('killer-gallery');if(!node)return;
  const f=state.filters;
  const ks=getKillerStats(state.selectedYear);
  let list=ks.filter(k=>(f.galleryCategory==='all'||k.category===f.galleryCategory)&&k.name.includes(f.gallerySearch.trim()));
  const orderIndex=new Map(killerOrder().map((name,i)=>[name,i]));
  const order=(a,b)=>(orderIndex.get(a.name)??9999)-(orderIndex.get(b.name)??9999);
  if(f.galleryOrder==='matches')list.sort((a,b)=>b.total-a.total||order(a,b));
  else if(f.galleryOrder==='winrate')list.sort((a,b)=>pct(b.wins,b.total)-pct(a.wins,a.total)||order(a,b));
  else list.sort(order);
  $('gallery-count').textContent=`${list.length} / ${ks.length} KILLERS`;
  node.innerHTML=list.map(k=>`<a class="killer-select-card" href="#killer/${encodeURIComponent(k.name)}" aria-label="${esc(k.name)} 상세 전적 보기, ${k.total}경기 ${k.total?rate(k.wins,k.total,0):'승률 없음'}">
    ${portraitMarkup(k.name)}<span class="killer-card-name">${esc(k.name)}</span><span class="killer-card-meta">${k.total}전 <strong>${k.total?rate(k.wins,k.total,0):'—'}</strong></span></a>`).join('') || '<div class="gallery-no-results">조건에 맞는 살인마가 없습니다.</div>';
}
function matchesForKiller(name,year=state.selectedYear){
  return yearFilter(allMatches(),year).filter(m=>m.mode==='killer'&&m.name===name)
    .sort((a,b)=>a.dateISO.localeCompare(b.dateISO)||a.round-b.round);
}
function renderKillerDetail(){
  const name=state.detailKiller;
  if(!name)return;
  const category=state.data.killerCategories[name];
  if(!category){
    $('detail-heading').textContent='살인마 정보를 찾을 수 없습니다.';
    $('detail-description').textContent='목록으로 돌아가 다른 살인마를 선택해 주세요.';
    $('detail-portrait').innerHTML='';$('detail-kpis').innerHTML='';$('detail-donut').innerHTML='';$('detail-trend').innerHTML='';$('detail-history').innerHTML='';$('detail-history-total').textContent='';$('detail-show-more').hidden=true;
    return;
  }
  const matches=matchesForKiller(name,state.detailYear),total=matches.length,wins=matches.filter(win).length,losses=total-wins;
  const allKiller=yearFilter(allMatches(),state.detailYear).filter(x=>x.mode==='killer');
  const globalRate=pct(allKiller.filter(win).length,allKiller.length), ownRate=pct(wins,total);
  $('detail-heading').textContent=name;
  $('detail-description').textContent='토토데이에서 만난 살인마의 출현 기록과 승패 분석입니다.';
  $('detail-portrait').innerHTML=portraitMarkup(name,'large');
  $('detail-category').innerHTML=`<span class="category-chip">${category==='original'?'오리지널 살인마':'라이선스 살인마'}</span><span>${esc(KILLER_PORTRAITS[name]||'')}</span><span>로컬 초상화</span>`;
  $('detail-kpis').innerHTML=[
    mini('등장 경기',`${total}전`),mini('승리 / 패배',`${wins}승 ${losses}패`),
    mini('해당 살인마 승률',total?rate(wins,total,2):'—'),mini('전체 살인마 상대 승률',`${globalRate.toFixed(2)}%`)
  ].join('');
  $('detail-donut').innerHTML=total?`<div class="win-donut" role="img" aria-label="승리 ${wins}경기 ${rate(wins,total,1)}, 패배 ${losses}경기" style="--wins:${ownRate.toFixed(3)}%"><div class="donut-center"><strong>${rate(wins,total,1)}</strong><small>승률</small></div></div>
  <div class="donut-legend"><div><i class="win-key"></i><span>승리</span><strong>${wins}회</strong></div><div><i class="loss-key"></i><span>패배</span><strong>${losses}회</strong></div><div class="detail-comparison">전체 살인마 상대 평균보다 <strong class="${ownRate>=globalRate?'positive':'negative'}">${ownRate>=globalRate?'+':''}${(ownRate-globalRate).toFixed(2)}%p</strong></div></div>`:'<div class="empty-state">선택한 기간에 경기 기록이 없습니다.</div>';
  const recent=matches.slice(-10),recentW=recent.filter(win).length;
  $('detail-trend').innerHTML=recent.length?`<div class="recent-form-number"><strong>${recentW}승 ${recent.length-recentW}패</strong><span>최근 ${recent.length}경기 · 승률 ${rate(recentW,recent.length,0)}</span></div>
    <div class="result-timeline" role="img" aria-label="최근 경기 결과: ${recent.map(m=>win(m)?'승':'패').join(', ')}">${recent.map((m,i)=>`<div class="timeline-cell ${m.result}" title="${esc(m.dateISO)} ${m.round}R · ${labelResult(m)}"><span>${win(m)?'W':'L'}</span><small>${i+1}</small></div>`).join('')}</div>
    <div class="form-footnote">최근 날짜 <strong>${esc(recent.at(-1).dateISO)}</strong> · 좌측부터 오래된 순서</div>`:'<div class="empty-state">해당 기간에 최근 경기 기록이 없습니다.</div>';
  const currentMatches=state.detailShowAll?matches.slice().reverse():matches.slice(-10).reverse();
  const runningByYear=new Map();
  const totals=new Map();
  matches.forEach(m=>{const key=m.year;const old=totals.get(key)||[0,0];old[win(m)?0:1]++;totals.set(key,old);runningByYear.set(m.sessionId+'-'+m.round,`${old[0]}승 ${old[1]}패`);});
  $('detail-history').innerHTML=currentMatches.map(m=>`<tr><td class="detail-date">${esc(m.dateISO)}</td><td>${m.round}R</td><td><span class="detail-result ${m.result}">${labelResult(m)}</span></td><td>${runningByYear.get(m.sessionId+'-'+m.round)||''}</td></tr>`).join('')||'<tr><td colspan="4" class="empty-state">기록이 없습니다.</td></tr>';
  $('detail-history-total').textContent=`총 ${total}경기`;
  $('detail-show-more').hidden=total<=10;
  $('detail-show-more').textContent=state.detailShowAll?'최근 10경기만 보기 ↑':`전체 ${total}경기 보기 ↓`;
}


/* v1.5.12: Three independent still-image selectors synced to the 4.128-second audio clip.
   Each window owns one IMG and one label; only src/text change while selecting.
   No overlapping layers, cross-fade transitions or cell tracks. */
const slotImageReady=new Set();
const slotImageCache=new Map();
function preloadSlotPortraits(){
  for(const name of slotPool()){
    if(slotImageCache.has(name))continue;
    const img=new Image();
    slotImageCache.set(name,img);
    img.onload=()=>slotImageReady.add(name);
    img.onerror=()=>slotImageReady.delete(name);
    img.src=portraitSrc(name);
    if(img.complete&&img.naturalWidth>0)slotImageReady.add(name);
  }
}
const SLOT_AUDIO_FALLBACK_MS=4128;
let slotAudioOK=true;
function slotDuration(){
  const a=$('roulette-sound');
  return Number.isFinite(a?.duration)&&a.duration>0?Math.round(a.duration*1000):SLOT_AUDIO_FALLBACK_MS;
}
function slotPool(){return killerOrder().filter(n=>state.data?.killerCategories?.[n]==='original'||state.data?.killerCategories?.[n]==='licensed');}
function slotChoice(names){
  if(!names.length) return '';
  if(window.crypto?.getRandomValues){
    const values=new Uint32Array(1),n=4294967296,limit=n-(n%names.length);
    do{crypto.getRandomValues(values);}while(values[0]>=limit);
    return names[values[0]%names.length];
  }
  return names[Math.floor(Math.random()*names.length)];
}
function slotSymbol(name){
  const src=portraitSrc(name);
  return `<div class="kdm-slot-symbol">${src?`<img src="${src}" alt="" draggable="false" decoding="async">`:''}<span>${esc(name)}</span></div>`;
}
function slotIdle(){return `<div class="kdm-slot-idle"><small>READY TO SPIN</small><strong>?</strong><span>랜덤 살인마 선택</span></div>`;}
function slotShowStatic(name){
  for(let i=1;i<=3;i++){
    const node=$(`roulette-reel-${i}`);
    node.innerHTML=name?slotSymbol(name):slotIdle();
    node.closest('.kdm-slot-window').classList.toggle('is-settled',Boolean(name));
  }
}
function renderRoulette(){
  if(state.rouletteSpinning || !state.data || !$('roulette-result'))return;
  slotShowStatic(state.rouletteWinner);
  $('roulette-status').textContent=state.rouletteWinner?'추첨 완료':'대기 중';
  const target=$('roulette-result');
  if(!state.rouletteWinner){
    target.innerHTML='<div class="kdm-slot-empty"><span>◇</span><strong>아직 선택된 살인마가 없습니다.</strong><p>왼쪽에서 랜덤 살인마 뽑기를 눌러주세요.</p></div>';
    return;
  }
  const name=state.rouletteWinner,s=getKiller(name);
  const cat=state.data.killerCategories[name];
  target.innerHTML=`<div class="kdm-slot-winner">
    <div class="kdm-slot-winner-image">${portraitMarkup(name,'small')}</div>
    <div><span class="eyebrow">RANDOM RESULT</span><h3>${esc(name)}</h3><p>${cat==='original'?'오리지널 살인마':'라이선스 살인마'}</p></div>
  </div><div class="kdm-slot-result-stats">
    <div><small>대전 수</small><strong>${s.total}전</strong></div>
    <div><small>승 / 패</small><strong>${s.wins}승 ${s.losses}패</strong></div>
    <div><small>승률</small><strong>${s.total?rate(s.wins,s.total,0):'—'}</strong></div>
  </div><button type="button" class="kdm-slot-secondary kdm-slot-detail" id="roulette-open-detail">${esc(name)} 상세 통계 보기</button>`;
}
function setRouletteTab(tab){
  state.rouletteTab=tab==='perk'?'perk':'killer';
  document.querySelectorAll('.kdm-slot-tab').forEach(el=>{
    const active=el.dataset.rouletteTab===state.rouletteTab;
    el.classList.toggle('active',active);el.setAttribute('aria-selected',String(active));
  });
  document.querySelectorAll('.kdm-slot-page').forEach(el=>{
    const active=el.id===`roulette-panel-${state.rouletteTab}`;
    el.classList.toggle('active',active);el.hidden=!active;
  });
}
function soundStatus(message='',error=false){
  const n=$('roulette-sound-status');if(!n)return;
  n.textContent=message;n.classList.toggle('error',Boolean(error));
}
function updateRouletteSoundButton(){
  const n=$('roulette-sound-toggle');if(!n)return;
  const enabled=state.rouletteSoundOn;
  n.textContent=enabled?'🔊 효과음 켜짐':'🔇 효과음 꺼짐';
  n.classList.toggle('sound-off',!enabled);n.setAttribute('aria-pressed',String(enabled));
  n.setAttribute('aria-label',enabled?'슬롯머신 효과음 끄기':'슬롯머신 효과음 켜기');
  if(!enabled)soundStatus('효과음이 꺼져 있습니다.');
  else if(slotAudioOK)soundStatus('');
}
function stopRouletteSound(){
  const a=$('roulette-sound');if(!a)return;
  a.pause();try{a.currentTime=0;}catch{}
}
function playRouletteSound(){
  const a=$('roulette-sound');if(!a||!state.rouletteSoundOn)return;
  stopRouletteSound();a.playbackRate=1;a.volume=.8;a.loop=false;
  if(a.error){soundStatus('MP3 로드 오류: assets/audio/electric-slot-machine.mp3 업로드를 확인해 주세요.',true);return;}
  try{
    const p=a.play();
    if(p&&p.catch)p.catch(e=>soundStatus(e.name==='NotAllowedError'?'브라우저에서 오디오 재생을 허용해 주세요.':'MP3 재생이 실패했습니다.',true));
  }catch(e){soundStatus('효과음 재생이 차단되었습니다.',true);}
}
function toggleRouletteSound(){
  state.rouletteSoundOn=!state.rouletteSoundOn;
  if(!state.rouletteSoundOn)stopRouletteSound();
  updateRouletteSoundButton();
  try{localStorage.setItem('kdm-roulette-sound',state.rouletteSoundOn?'on':'off');}catch{}
}
function slotSwapStill(node,name){
  const image=node.querySelector('.kdm-slot-symbol img');
  const label=node.querySelector('.kdm-slot-symbol span');
  // Reuse the same image node for the whole spin. No superimposed portraits.
  if(image && image.dataset.name!==name){
    image.src=portraitSrc(name);
    image.dataset.name=name;
  }
  if(label)label.textContent=name;
}
function slotSpinOne(index,pool,winner,stopMs){
  return new Promise(resolve=>{
    const node=$(`roulette-reel-${index+1}`);
    const frame=node.closest('.kdm-slot-window');
    const ready=()=>pool.filter(n=>slotImageReady.has(n));
    const initial=slotChoice(ready().length?ready():pool);
    // One still image for each column, from start to finish.
    node.innerHTML=slotSymbol(initial);
    const image=node.querySelector('img');
    if(image)image.dataset.name=initial;
    let previous=initial, tickTimer=null, settled=false;
    const began=performance.now();
    const settle=()=>{
      if(settled)return;
      settled=true;clearTimeout(tickTimer);
      slotSwapStill(node,winner);
      frame.classList.add('is-settled');
      resolve();
    };
    const finishTimer=setTimeout(settle,stopMs);
    const tick=()=>{
      if(settled)return;
      const progress=Math.min(1,(performance.now()-began)/stopMs);
      // Selection starts briskly, slowing just before the column locks.
      const readyPool=ready();
      const candidates=(readyPool.length>1?readyPool:pool).filter(n=>n!==previous);
      const next=slotChoice(candidates.length?candidates:pool);
      if(next){slotSwapStill(node,next);previous=next;}
      const delay=60+210*Math.pow(progress,2.4);
      tickTimer=setTimeout(tick,delay);
    };
    tickTimer=setTimeout(tick,65);
  });
}
async function spinRoulette(){
  if(state.rouletteSpinning||!state.data)return;
  const pool=slotPool();if(!pool.length)return;
  preloadSlotPortraits();
  const winner=slotChoice(pool);
  const machine=$('roulette-machine'),start=$('roulette-spin'),again=$('roulette-spin-again');
  const audioDuration=slotDuration();
  const times=[Math.max(1500,Math.round(audioDuration*0.66)),Math.max(2200,Math.round(audioDuration*0.84)),Math.max(2800,Math.round(audioDuration*0.992))];
  state.rouletteSpinning=true;state.rouletteWinner=null;
  start.disabled=true;again.disabled=true;
  machine.classList.add('is-spinning');
  machine.querySelectorAll('.kdm-slot-window').forEach(x=>x.classList.remove('is-settled'));
  $('roulette-status').textContent='선택 중';
  $('roulette-result').innerHTML='<div class="kdm-slot-empty"><span>◎</span><strong>추첨 중입니다.</strong><p>세 칸의 캐릭터가 무작위로 바뀌다가 순서대로 확정됩니다.</p></div>';
  // Audio begins in the direct button handler, preserving browser playback permissions.
  playRouletteSound();
  try{
    await Promise.all(times.map((duration,i)=>slotSpinOne(i,pool,winner,duration)));
  }catch(e){
    console.error('살인마 랜덤 선택 오류',e);
    slotShowStatic(winner);
  }finally{
    machine.classList.remove('is-spinning');
    state.rouletteSpinning=false;state.rouletteWinner=winner;
    start.disabled=false;again.disabled=false;
    renderRoulette();
    toast(`랜덤 결과: ${winner}`);
  }
}

function getStats(){
  const matches=scopedMatches(),w=matches.filter(win).length,sv=matches.filter(m=>m.mode==='survivor');
  return {matches, total:matches.length, wins:w, losses:matches.length-w,
    survival:sv.length, escapes:sv.filter(win).length, deaths:sv.filter(m=>!win(m)).length,
    killer:matches.filter(m=>m.mode==='killer').length,
    killerWins:matches.filter(m=>m.mode==='killer'&&win(m)).length,
    unclassified:matches.filter(m=>m.mode==='unclassified').length,
    dates:new Set(yearSessions().map(s=>s.dateISO)).size};
}
function getKillerStats(year=state.selectedYear){
  const categories=state.data.killerCategories;
  const map=new Map(Object.entries(categories).map(([name,category])=>[name,{name,category,wins:0,losses:0,total:0}]));
  yearFilter(allMatches(),year).filter(m=>m.mode==='killer').forEach(m=>{
    if(!map.has(m.name))map.set(m.name,{name:m.name,category:m.category||'original',wins:0,losses:0,total:0});
    const x=map.get(m.name); x.total++;x[win(m)?'wins':'losses']++;
  });
  return [...map.values()];
}
function getKiller(name){return getKillerStats(state.selectedYear).find(k=>k.name===name)||{name,wins:0,losses:0,total:0};}
function toast(message){
  const el=$('toast'); el.textContent=message;el.classList.add('show');
  clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),3200);
}
function kpi(caption,value,sub,theme=''){
  return `<div class="stat-card ${theme}"><div class="stat-caption">${esc(caption)}</div><div class="stat-value">${esc(value)}</div><div class="stat-sub">${esc(sub)}</div></div>`;
}
function mini(caption,value){return `<div class="mini-kpi"><label>${esc(caption)}</label><strong>${esc(value)}</strong></div>`;}

function renderDashboard(){
  const s=getStats();
  $('overview-kpis').innerHTML=[
    kpi('전체 누적 경기',`${num(s.total)}전`,`${num(s.wins)}승 · ${num(s.losses)}패`),
    kpi('누적 승률',rate(s.wins,s.total,2),`전체 ${num(s.total)}경기 기준`,'accent'),
    kpi('살인마 상대 승률',rate(s.killerWins,s.killer,2),`${num(s.killer)}전 · ${s.killerWins}승 ${s.killer-s.killerWins}패`,'green'),
    kpi('생존자 탈출률',rate(s.escapes,s.survival,2),`${s.survival}전 · ${s.escapes}탈출 ${s.deaths}사망`,'green')
  ].join('');
  const years=[...new Set(yearSessions().map(s=>s.year))].sort((a,b)=>a-b);
  $('year-summary').innerHTML=years.map(year=>{
    const matches=yearFilter(s.matches,year),wins=matches.filter(win).length,sv=matches.filter(m=>m.mode==='survivor');
    return `<div class="year-summary-card"><span class="year-tag">${year}년</span><strong>${matches.length}전 <span class="year-scores">${wins}승 · ${matches.length-wins}패</span></strong><span class="year-detail">승률 ${rate(wins,matches.length,2)} · 생존자 ${sv.length}전</span></div>`;
  }).join('');
  const picks=state.data.picks;
  $('featured-picks').innerHTML=`<div class="picks-wrapper">${[
    {name:picks.favorite,title:'BEST PICK',type:'best'},
    {name:picks.leastFavorite,title:'WORST PICK',type:'worst'}
  ].map(p=>{const k=getKiller(p.name);return `<div class="pick-card ${p.type}"><div><div class="pick-label">${esc(p.title)}</div><div class="pick-title">${esc(p.name)}</div><div class="pick-detail">${k.total}전 ${k.wins}승 ${k.losses}패</div></div><div class="pick-rate">${rate(k.wins,k.total,0)}</div></div>`;}).join('')}</div>`;
  // Top 10 among killers with at least ten matches; ties favor more matches.
  const ranked=getKillerStats(state.selectedYear).filter(k=>k.total>=10).sort((a,b)=>pct(b.wins,b.total)-pct(a.wins,a.total)||b.total-a.total||a.name.localeCompare(b.name,'ko')).slice(0,10);
  $('top-killers').innerHTML=ranked.map((k,i)=>`<div class="ranking-row"><span class="rank-num">${String(i+1).padStart(2,'0')}</span><div class="rank-killer" title="${esc(k.name)} · ${k.total}전"><span class="rank-name">${esc(k.name)}</span><span class="rank-games">${k.total}전</span></div><div class="bar-track"><div class="bar-fill ${pct(k.wins,k.total)>=70?'positive':''}" style="width:${pct(k.wins,k.total).toFixed(1)}%"></div></div><span class="rank-percent">${rate(k.wins,k.total,0)}</span></div>`).join('');
  if(!ranked.length) $('top-killers').innerHTML='<div class="empty-state">10경기 이상 기록된 살인마가 없습니다.</div>';
  const recent=yearSessions().slice(-10).reverse();
  $('recent-records').innerHTML=recent.map(x=>{
    const w=x.rounds.filter(win).length,l=x.rounds.length-w;
    return `<div class="recent-item"><div><div class="recent-date">${esc(x.dateISO)}</div><div class="recent-meta">${x.rounds.length}라운드 · 원본 ${esc(x.sourceRow||'추가')}행</div></div><div class="recent-score"><span class="w">${w}승</span> <span class="l">${l}패</span><span class="mini-rate">${rate(w,w+l,0)}</span></div></div>`;
  }).join('');
  $('dashboard-alert').innerHTML=`<div><strong>조회 전용 통계</strong> · ${state.selectedYear==='all'?'전체 연도':state.selectedYear+'년'} ${s.total}전. 기록은 구글 스프레드시트에서만 수정하며, 생존자 맵 정보는 수집하지 않습니다.</div>`;
  renderTrend();renderKillerGallery();
}
function renderTrend(){
  const groups=[]; const lookup=new Map();
  for(const s of yearSessions()){
    let g=lookup.get(s.dateISO);if(!g){g={date:s.dateISO,w:0,t:0};lookup.set(s.dateISO,g);groups.push(g);}
    g.t+=s.rounds.length;g.w+=s.rounds.filter(win).length;
  }
  const values=groups.slice(-24);if(!values.length){$('winrate-chart').innerHTML='<p class="chart-empty">경기 기록이 없습니다.</p>';return;}
  const width=900,height=264,pL=45,pR=17,pT=20,pB=33;
  const X=(i)=>pL+(values.length===1?0:i/(values.length-1))*(width-pL-pR);
  const Y=(v)=>pT+(100-v)/100*(height-pT-pB);
  const points=values.map((x,i)=>({x:X(i),y:Y(pct(x.w,x.t)),...x}));
  const line=points.map((x,i)=>`${i?'L':'M'} ${x.x.toFixed(2)} ${x.y.toFixed(2)}`).join(' ');
  const area=`${line} L ${points.at(-1).x} ${Y(0)} L ${points[0].x} ${Y(0)} Z`;
  let grid='';for(const percent of [0,25,50,75,100])grid+=`<line class="gridline" x1="${pL}" x2="${width-pR}" y1="${Y(percent)}" y2="${Y(percent)}"/><text x="0" y="${Y(percent)+4}">${percent}%</text>`;
  const xlabels=values.map((v,i)=>i%(values.length>18?5:values.length>10?3:2)===0||i===values.length-1?`<text x="${X(i)}" y="${height-5}" text-anchor="middle">${esc(v.date)}</text>`:'').join('');
  const dots=points.map(v=>`<circle cx="${v.x}" cy="${v.y}" r="4"><title>${esc(v.date)}: ${v.w}승 ${v.t-v.w}패 (${rate(v.w,v.t,1)})</title></circle>`).join('');
  $('winrate-chart').innerHTML=`<svg viewBox="0 0 ${width} ${height}" aria-label="최근 24개 기록일의 승률 흐름" role="img" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="chart-gradient" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#ec3e51" stop-opacity=".29"/><stop offset="1" stop-color="#ec3e51" stop-opacity="0"/></linearGradient></defs>${grid}<path class="chart-area" d="${area}"/><path class="chart-path" d="${line}"/>${dots}${xlabels}</svg>`;
}

function getFilteredRecords(){
  const f=state.filters;
  return yearSessions().map(s=>{
    const rounds=s.rounds.filter(m=>(f.recordMode==='all'||m.mode===f.recordMode) &&
      (f.recordOutcome==='all'||m.result===f.recordOutcome) &&
      (!f.recordSearch||(m.mode==='killer'&&m.name.toLocaleLowerCase('ko').includes(f.recordSearch.toLocaleLowerCase('ko')))) &&
      (f.recordYear==='all'||String(s.year)===f.recordYear) &&
      (f.recordMonth==='all'||s.date.split('.')[0]===f.recordMonth));
    return {...s,rounds};
  }).filter(s=>s.rounds.length).reverse();
}
function renderRecords(){
  const sessions=getFilteredRecords(),shown=sessions.slice(0,state.recordLimit);
  const matchCount=sessions.reduce((a,s)=>a+s.rounds.length,0);
  $('record-count').textContent=`${sessions.length}개 기록 묶음 · 총 ${num(matchCount)}경기 검색됨`;
  $('record-list').innerHTML=shown.length?shown.map((s,i)=>{
    const w=s.rounds.filter(win).length,l=s.rounds.length-w;
    return `<details class="record-card" ${i===0?'open':''}><summary><span class="record-date">${esc(s.dateISO)}</span><div><div class="record-desc">${s.rounds.length}라운드 <span class="muted-label">· ${s.rounds.some(x=>x.mode==='survivor')?'생존자 포함':'살인마 기록'}</span></div></div><div class="record-bar"><span style="width:${pct(w,w+l)}%"></span></div><div class="record-score"><b>${w}승</b> ${l}패</div><span class="record-arrow">⌄</span></summary><div class="round-list">${s.rounds.map(m=>`<div class="round-row"><span class="round-num">${m.round}R</span><span class="round-name">${m.mode==='survivor'?'생존자 플레이':esc(m.name)}</span><span class="round-mode">${labelMode[m.mode]||'기타'}</span><span class="round-result ${m.result}">${labelResult(m)}</span></div>`).join('')}</div></details>`;
  }).join(''):`<div class="empty-state">해당 조건에 맞는 경기 기록이 없습니다.</div>`;
  $('load-more').hidden=sessions.length<=shown.length;
}
function renderKillers(){
  const f=state.filters,all=getKillerStats(state.selectedYear);
  const total=all.reduce((a,k)=>a+k.total,0);
  $('killer-summary').innerHTML=mini('살인마 종류',`${all.length}종`)+mini('살인마 대전',`${num(total)}전`)+mini('오리지널',`${all.filter(x=>x.category==='original').length}종`)+mini('라이선스',`${all.filter(x=>x.category==='licensed').length}종`);
  let list=all.filter(k=>(f.killerCategory==='all'||k.category===f.killerCategory)&&k.name.toLocaleLowerCase('ko').includes(f.killerSearch.toLocaleLowerCase('ko')));
  const kr=(a,b)=>a.name.localeCompare(b.name,'ko');
  // Official release-order mapping takes precedence for existing killers.
  // New killers from the Google Sheet appear afterward in roster-sheet order.
  const orderList=[...KILLER_ORDER,...killerOrder().filter(name=>!KILLER_PORTRAITS[name])];
  const orderIndex=new Map(orderList.map((name,index)=>[name,index]));
  const rosterOrder=(a,b)=>(orderIndex.get(a.name)??Number.MAX_SAFE_INTEGER)-(orderIndex.get(b.name)??Number.MAX_SAFE_INTEGER)||kr(a,b);
  if(f.killerSort==='matches')list.sort((a,b)=>b.total-a.total||pct(b.wins,b.total)-pct(a.wins,a.total)||rosterOrder(a,b));
  else if(f.killerSort==='winrate')list.sort((a,b)=>pct(b.wins,b.total)-pct(a.wins,a.total)||b.total-a.total||rosterOrder(a,b));
  else if(f.killerSort==='winrate-asc')list.sort((a,b)=>pct(a.wins,a.total)-pct(b.wins,b.total)||b.total-a.total||rosterOrder(a,b));
  else if(f.killerSort==='name')list.sort(kr);
  else list.sort(rosterOrder);
  $('killer-table').innerHTML=list.map(k=>{
    const p=pct(k.wins,k.total), tone=!k.total?'':p>=70?'good':p<50?'bad':'';
    return `<tr><td class="name">${esc(k.name)}</td><td><span class="category-chip">${k.category==='original'?'오리지널':k.category==='licensed'?'라이선스':'분류 확인'}</span></td><td>${k.total}</td><td>${k.wins}</td><td>${k.losses}</td><td><div class="rate-inline"><div class="bar-track"><div class="bar-fill ${p>=70?'positive':''}" style="width:${p}%"></div></div><strong class="${tone}">${k.total?rate(k.wins,k.total,0):'—'}</strong></div></td></tr>`;
  }).join('')||`<tr><td colspan="6" class="empty-state">검색 결과가 없습니다.</td></tr>`;
  $('killer-count').textContent=`표시: ${list.length}종 · ${f.killerYear==='all'?'전체 연도':f.killerYear+'년'} 살인마 상대 경기 결과를 기준으로 계산합니다.`;
}
function renderSurvivor(){
  const year=state.selectedYear;
  const sv=yearFilter(allMatches(),year).filter(m=>m.mode==='survivor'),escapes=sv.filter(win).length;
  const period=year==='all'?'전체 기록':'집계 연도 '+year+'년';
  $('survivor-kpis').innerHTML=kpi('생존자 경기',`${sv.length}전`,period)+kpi('탈출',`${escapes}회`,'탈출 성공 수','green')+kpi('사망',`${sv.length-escapes}회`,'탈출 실패 수')+kpi('생존자 탈출률',rate(escapes,sv.length,2),'탈출 수 ÷ 생존자 경기 수','accent');
}

function renderAll(){
  if(!state.data)return;
  const latest=yearSessions().at(-1)?.dateISO || '기록 없음';
  $('source-date').textContent=`마지막 기록 ${latest}`;
  renderDashboard();renderRecords();renderKillers();renderRoulette();renderSurvivor();
  if(state.detailKiller)renderKillerDetail();
}
const pageNames={dashboard:'대시보드',records:'토토데이 전적',killers:'살인마 통계',roulette:'랜덤 선택 룰렛',survivor:'생존자 기록', 'killer-detail':'살인마 상세 전적'};
function openPage(raw,updateHash=true){
  const isDetail=raw.startsWith('killer/');
  if(isDetail){
    let name; try{name=decodeURIComponent(raw.slice(7));}catch{name='';}
    state.detailKiller=name;
    state.detailYear=state.selectedYear;state.detailShowAll=false;
    $('detail-year').value=state.selectedYear;
    raw='killer-detail';
    if(state.data)renderKillerDetail();
  }
  const page=pageNames[raw]?raw:'dashboard';state.page=page;
  if(page==='roulette' && state.data)preloadSlotPortraits();
  document.querySelectorAll('.page').forEach(el=>el.classList.toggle('active',el.id===`page-${page}`));
  document.querySelectorAll('.nav-button').forEach(el=>{el.classList.toggle('active',el.dataset.page===page);el.setAttribute('aria-current',el.dataset.page===page?'page':'false');});
  $('breadcrumb').textContent=isDetail?state.detailKiller:pageNames[page];
  const target=isDetail?`#killer/${encodeURIComponent(state.detailKiller)}`:`#${page}`;
  if(updateHash&&location.hash!==target)history.pushState(null,'',target);
  window.scrollTo({top:0,behavior:'auto'});
}
function populateOptions(){
  const years = [...new Set([...(state.data.yearsAvailable||[]),...state.data.sessions.map(s=>s.year)])]
    .filter(y=>/^20\d{2}$/.test(String(y)) || /^21\d{2}$/.test(String(y)))
    .sort((a,b)=>Number(a)-Number(b));
  const options='<option value="all">전체 연도</option>'+years.map(y=>`<option value="${y}">${y}년</option>`).join('');
  if(state.selectedYear!=='all' && !years.some(y=>String(y)===String(state.selectedYear))){state.selectedYear='all';}
  for(const id of ['global-year','record-year','killer-year','survivor-year','detail-year']){
    $(id).innerHTML=options;$(id).value=state.selectedYear;
  }
  for(const key of ['recordYear','killerYear','survivorYear'])state.filters[key]=state.selectedYear;
  state.detailYear=state.selectedYear;
  const dates=[...new Set(yearSessions().map(s=>s.date.split('.')[0]))].sort((a,b)=>Number(a)-Number(b));
  $('record-month').innerHTML='<option value="all">전체 월</option>'+dates.map(m=>`<option value="${esc(m)}">${Number(m)}월</option>`).join('');
  if(!dates.includes(state.filters.recordMonth))state.filters.recordMonth='all';
  $('record-month').value=state.filters.recordMonth;
}
function setActiveYear(year){
  const value=String(year);
  if(value!=='all' && !state.data?.sessions.some(s=>String(s.year)===value) &&
    !(state.data?.yearsAvailable||[]).some(y=>String(y)===value))return;
  state.selectedYear=value;state.recordLimit=12;state.detailShowAll=false;
  state.filters.recordMonth='all';
  populateOptions();
  renderAll();
}
const remoteConfig = window.KDM_CONFIG || {};
const sheetUrl = String(remoteConfig.appsScriptUrl || '').trim();
const configured = /^https:\/\/script\.google\.com\/macros\/s\/[^/?#]+\/exec(?:\?.*)?$/.test(sheetUrl);
const REFRESH_MS = 300000; // 5 minutes while the page is open.
function syncNotice(text, theme='') {
  const label=$('sync-label'); label.textContent=text; label.className='sync-label '+theme;
  const side=$('sidebar-status');
  if(side) {
    side.innerHTML='<span class="status-pulse"></span> '+(theme==='good'?'구글 시트 자동 연동':theme==='bad'?'연동 실패 · 저장본 표시':'저장본 조회 · 연동 설정 전');
    side.classList.toggle('connected',theme==='good');
  }
}
function validateLive(data) {
  if(!data||data.schemaVersion!==2||!Array.isArray(data.sessions)||!data.killerCategories)throw new Error('응답 형식 오류');
  for(const s of data.sessions){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(s.dateISO)||!Array.isArray(s.rounds)) throw new Error('기록 날짜 오류');
    for(const m of s.rounds){
      if(!['killer','survivor'].includes(m.mode)||!['win','loss'].includes(m.result))throw new Error('경기 결과 오류');
      if(m.mode==='survivor' && (m.name||m.map))throw new Error('생존자 맵 정보가 포함되었습니다');
    }
  }
  if(data.killerRoster!==undefined){
    if(!Array.isArray(data.killerRoster)) throw new Error('살인마 목록 형식 오류');
    const names=new Set();
    for(const entry of data.killerRoster){
      if(!entry || typeof entry.name!=='string' || !entry.name.trim() || names.has(entry.name)) throw new Error('살인마 목록 이름 오류');
      if(!['original','licensed'].includes(entry.category)) throw new Error('살인마 목록 분류 오류');
      names.add(entry.name);
    }
  }
  return data;
}
function loadLiveJSONP(endpoint, timeoutMs=18000) {
  return new Promise((resolve,reject)=>{
    const callback='kdmSheetCallback_'+Date.now()+'_'+Math.random().toString(36).slice(2,10);
    const script=document.createElement('script');
    let finished=false;
    const cleanup=()=>{
      delete window[callback];
      script.remove();
      clearTimeout(timer);
    };
    const done=(error,data)=>{
      if(finished)return;
      finished=true; cleanup();
      if(error)reject(error);else resolve(data);
    };
    window[callback]=(result)=>{
      if(result && result.error)done(new Error(String(result.error)));
      else done(null,result);
    };
    script.onerror=()=>done(new Error('Apps Script 연결 실패'));
    const timer=setTimeout(()=>done(new Error('연동 응답 시간 초과')),timeoutMs);
    // Callback supplied by this site, URL must be an Apps Script deployment /exec endpoint.
    const sep=endpoint.includes('?')?'&':'?';
    script.src=endpoint+sep+'callback='+encodeURIComponent(callback)+'&t='+Date.now();
    document.head.appendChild(script);
  });
}
async function reloadRemote(silent=false) {
  if(!configured||state.busy)return;
  state.busy=true;
  try{
    const incoming=validateLive(await loadLiveJSONP(sheetUrl));
    state.data=incoming;state.live=true;
    populateOptions();renderAll();
    syncNotice('Google Sheets 연동 · 자동 갱신','good');
    if(!silent)toast('최신 구글 스프레드시트 기록을 불러왔습니다.');
  }catch(e){
    console.error('Sheets auto sync failed',e);
    state.live=false;
    // Keep the last successfully loaded data if network fails; initial data is the dated local snapshot.
    syncNotice('연동 오류 · 최근 저장본 표시','bad');
    if(!silent)toast('연동에 실패했습니다. 이전 데이터를 표시합니다.');
  }finally{state.busy=false;}
}
// Mobile menu is a disclosure: desktop sidebar navigation remains unchanged.
function setMobileMenu(open, returnFocus=false){
  const sidebar=document.querySelector('.sidebar');
  const toggle=$('mobile-menu-toggle');
  const backdrop=$('mobile-menu-backdrop');
  if(!sidebar||!toggle||!backdrop)return;
  const shouldOpen=Boolean(open)&&window.matchMedia('(max-width:850px)').matches;
  sidebar.classList.toggle('mobile-menu-open',shouldOpen);
  toggle.setAttribute('aria-expanded',String(shouldOpen));
  toggle.setAttribute('aria-label',shouldOpen?'전체 메뉴 닫기':'전체 메뉴 열기');
  backdrop.hidden=!shouldOpen;
  if(returnFocus&&!shouldOpen)toggle.focus();
}
function attachEvents(){
  $('mobile-menu-toggle').addEventListener('click',()=>{
    const open=document.querySelector('.sidebar').classList.contains('mobile-menu-open');
    setMobileMenu(!open);
  });
  $('mobile-menu-backdrop').addEventListener('click',()=>setMobileMenu(false));
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&document.querySelector('.sidebar').classList.contains('mobile-menu-open')){
      event.preventDefault();setMobileMenu(false,true);
    }
  });
  window.addEventListener('resize',()=>{
    if(window.innerWidth>850)setMobileMenu(false);
  });
  document.querySelector('.sidebar .brand').addEventListener('click',()=>setMobileMenu(false));
  $('nav').addEventListener('click',e=>{
    const pageBtn=e.target.closest('[data-page]');
    if(pageBtn){ setMobileMenu(false);openPage(pageBtn.dataset.page); return; }
    const jumpBtn=e.target.closest('[data-jump]');
    if(jumpBtn){
      setMobileMenu(false);
      openPage('dashboard');
      const target=$(jumpBtn.dataset.jump);
      if(target) requestAnimationFrame(()=>target.scrollIntoView({behavior:'smooth', block:'start'}));
    }
  });
  document.body.addEventListener('click',e=>{
    const go=e.target.closest('[data-go]'); if(go){ openPage(go.dataset.go); return; }
    const detailBtn=e.target.closest('#roulette-open-detail'); if(detailBtn && state.rouletteWinner){ openPage('killer/'+encodeURIComponent(state.rouletteWinner)); return; }
  });
  window.addEventListener('hashchange',()=>{setMobileMenu(false);openPage(location.hash.slice(1),false);});
  // Both controls share the same theme state. Only one is visible at each breakpoint.
  function updateThemeControls(){
    const isLight=document.body.classList.contains('light');
    for(const id of ['theme-toggle','mobile-theme-toggle']){
      const button=$(id);
      if(!button)continue;
      button.textContent=isLight?'☾':'☀';
      button.title=isLight?'어두운 테마 전환':'밝은 테마 전환';
      button.setAttribute('aria-label',isLight?'어두운 테마로 전환':'밝은 테마로 전환');
      button.setAttribute('aria-pressed',String(isLight));
    }
  }
  for(const id of ['theme-toggle','mobile-theme-toggle']){
    $(id).addEventListener('click',()=>{
      document.body.classList.toggle('light');
      updateThemeControls();
    });
  }
  updateThemeControls();
  for(const [id,key] of [['record-search','recordSearch'],['record-mode','recordMode'],['record-year','recordYear'],['record-month','recordMonth'],['record-outcome','recordOutcome']]){
    $(id).addEventListener('input',e=>{state.filters[key]=e.target.value;state.recordLimit=12;renderRecords();});
  }
  for(const [id,key] of [['killer-search','killerSearch'],['killer-year','killerYear'],['killer-category','killerCategory'],['killer-sort','killerSort']]){
    $(id).addEventListener('input',e=>{state.filters[key]=e.target.value;renderKillers();});
  }
  $('global-year').addEventListener('change',e=>setActiveYear(e.target.value));
  for(const id of ['record-year','killer-year'])$(id).addEventListener('change',e=>setActiveYear(e.target.value));
  $('load-more').addEventListener('click',()=>{state.recordLimit+=12;renderRecords();});
  for(const [id,key] of [['gallery-search','gallerySearch'],['gallery-category','galleryCategory'],['gallery-order','galleryOrder']]){$(id).addEventListener('input',e=>{state.filters[key]=e.target.value;renderKillerGallery();});}
  $('detail-year').addEventListener('change',e=>setActiveYear(e.target.value));
  $('detail-show-more').addEventListener('click',()=>{state.detailShowAll=!state.detailShowAll;renderKillerDetail();});
  $('survivor-year').addEventListener('change',e=>setActiveYear(e.target.value));
  document.querySelectorAll('.kdm-slot-tab').forEach(btn=>btn.addEventListener('click',()=>setRouletteTab(btn.dataset.rouletteTab)));
  $('roulette-spin').addEventListener('click',spinRoulette);
  $('roulette-spin-again').addEventListener('click',spinRoulette);
  $('roulette-sound-toggle').addEventListener('click',toggleRouletteSound);
  const audio=$('roulette-sound');
  audio.addEventListener('error',()=>{slotAudioOK=false;soundStatus('MP3 파일을 불러올 수 없습니다. GitHub assets/audio 폴더를 확인해 주세요.',true);});
  audio.addEventListener('loadedmetadata',()=>{slotAudioOK=true;if(state.rouletteSoundOn)soundStatus('');});
}
async function start(){
  try{state.rouletteSoundOn=window.localStorage.getItem('kdm-roulette-sound')!=='off';}catch{}
  attachEvents();
  updateRouletteSoundButton();
  try{
    const response=await fetch('./data/records.json',{cache:'no-cache'});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    state.data=validateLive(await response.json());
    populateOptions();renderAll();openPage(location.hash.slice(1),false);
    syncNotice(configured?'Google Sheets 연결 확인 중':'저장본 조회 · 연동 설정 전');
    if(configured){
      await reloadRemote(true);
      setInterval(()=>{if(!document.hidden)reloadRemote(true);},REFRESH_MS);
      document.addEventListener('visibilitychange',()=>{if(!document.hidden)reloadRemote(true);});
    }
  }catch(error){
    console.error(error);
    $('overview-kpis').innerHTML='<div class="notice" style="grid-column:1/-1"><strong>데이터를 불러오지 못했습니다.</strong><span>README의 GitHub Pages 게시 방법을 확인해 주세요.</span></div>';
    syncNotice('데이터 로드 오류','bad');
  }
}
start();
