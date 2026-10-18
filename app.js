'use strict';

/* Read-only GitHub Pages statistics. Sync uses a Google Sheets bound Apps Script JSONP endpoint.
   No admin login, remote writes, or private sheet data are included. */
const state = {
  data: null, page: 'dashboard', recordLimit: 12, detailKiller: null, detailYear: 'all', detailShowAll: false,
  live: false, busy: false, rouletteTab: 'killer', rouletteSpinning: false, rouletteWinner: null, rouletteSoundOn: true,
  filters: { recordSearch: '', recordMode: 'all', recordYear: 'all', recordMonth: 'all', recordOutcome: 'all',
    killerSearch: '', killerYear: 'all', killerCategory: 'all', killerSort: 'matches', survivorYear: 'all', gallerySearch: '', galleryCategory: 'all', galleryOrder: 'roster' }
};
const $ = (id) => document.getElementById(id);
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct = (w,t) => t ? w/t*100 : 0;
const rate = (w,t,n=1) => `${pct(w,t).toFixed(n)}%`;
const num = (v) => Number(v).toLocaleString('ko-KR');
const win = (m) => m.result === 'win';
const allMatches = () => state.data.sessions.flatMap(s => s.rounds.map(r=>({...r, date:s.date, dateISO:s.dateISO, year:s.year, sessionId:s.id})));
const yearFilter = (matches, year) => year==='all' ? matches : matches.filter(m=>String(m.year)===String(year));
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
function portraitSrc(name){ const filename=KILLER_LOCAL_FILES[name]; return filename?`./assets/killers/${encodeURIComponent(filename)}`:''; }
function portraitMarkup(name, type='small'){
  const filename=KILLER_LOCAL_FILES[name];
  const unavailable='<span class="portrait-placeholder" aria-hidden="true"><small>이미지 없음</small></span>';
  if(!filename)return `<div class="portrait-slot ${type}">${unavailable}</div>`;
  return `<div class="portrait-slot ${type}"><img data-kdm-portrait="1" src="./assets/killers/${encodeURIComponent(filename)}" alt="${esc(name)} 초상화" loading="${type==='large'?'eager':'lazy'}" decoding="async"></div>`;
}
// The gallery never places placeholder text behind transparent portraits.
document.addEventListener('error', (event)=>{
  const img=event.target;
  if(!(img instanceof HTMLImageElement)||!img.matches('[data-kdm-portrait]'))return;
  const slot=img.closest('.portrait-slot');
  if(slot){ slot.classList.add('portrait-unavailable'); slot.insertAdjacentHTML('beforeend','<span class="portrait-placeholder" aria-hidden="true"><small>이미지 없음</small></span>'); }
  img.remove();
},true);

function renderKillerGallery(){
  const node=$('killer-gallery');if(!node)return;
  const f=state.filters;
  const ks=getKillerStats();
  let list=ks.filter(k=>(f.galleryCategory==='all'||k.category===f.galleryCategory)&&k.name.includes(f.gallerySearch.trim()));
  const order=(a,b)=>(KILLER_ORDER.indexOf(a.name)<0?999:KILLER_ORDER.indexOf(a.name))-(KILLER_ORDER.indexOf(b.name)<0?999:KILLER_ORDER.indexOf(b.name));
  if(f.galleryOrder==='matches')list.sort((a,b)=>b.total-a.total||order(a,b));
  else if(f.galleryOrder==='winrate')list.sort((a,b)=>pct(b.wins,b.total)-pct(a.wins,a.total)||order(a,b));
  else list.sort(order);
  $('gallery-count').textContent=`${list.length} / ${ks.length} KILLERS`;
  node.innerHTML=list.map(k=>`<a class="killer-select-card" href="#killer/${encodeURIComponent(k.name)}" aria-label="${esc(k.name)} 상세 전적 보기, ${k.total}경기 ${rate(k.wins,k.total,0)}">
    ${portraitMarkup(k.name)}<span class="killer-card-name">${esc(k.name)}</span><span class="killer-card-meta">${k.total}전 <strong>${rate(k.wins,k.total,0)}</strong></span></a>`).join('') || '<div class="gallery-no-results">조건에 맞는 살인마가 없습니다.</div>';
}
function matchesForKiller(name,year='all'){
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
    mini('해당 살인마 승률',rate(wins,total,2)),mini('전체 살인마 상대 승률',`${globalRate.toFixed(2)}%`)
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


function rouletteCardMarkup(name, compact=false){
  const src=portraitSrc(name);
  const title=esc(name||'알 수 없음');
  // Transparent character portrait; KDM watermark exists only on the reel *window*.
  const img=src?`<img data-kdm-portrait="1" src="${src}" alt="${title} 초상화" decoding="async">`:'';
  return `<div class="roulette-card ${compact?'compact':''}">${img}<span>${title}</span></div>`;
}
function rouletteIdleMarkup(){
  return '<div class="roulette-idle" aria-hidden="true"><span>RANDOM PICK</span><strong>?</strong><small>버튼을 눌러 살인마를 선택하세요</small></div>';
}
function renderRoulette(){
  const reel=$('roulette-reel-1');
  const resultNode=$('roulette-result');
  if(!reel||!resultNode||state.rouletteSpinning)return;
  reel.innerHTML=state.rouletteWinner?rouletteCardMarkup(state.rouletteWinner,true):rouletteIdleMarkup();
  $('roulette-status').textContent=state.rouletteWinner?'추첨 완료':'대기 중';
  if(!state.rouletteWinner){
    resultNode.innerHTML='<div class="roulette-result-empty"><span>◈</span><strong>아직 선택된 살인마가 없습니다.</strong><p>왼쪽의 랜덤 살인마 뽑기를 눌러주세요.</p></div>';
    return;
  }
  const name=state.rouletteWinner;
  const stats=getKiller(name);
  const category=state.data?.killerCategories?.[name];
  resultNode.innerHTML=`<div class="roulette-result-hero">${portraitMarkup(name,'small')}<div><div class="eyebrow">RANDOM RESULT</div><h3>${esc(name)}</h3><p>${category==='original'?'오리지널 살인마':'라이선스 살인마'}</p></div></div>
    <div class="roulette-result-stats">
      <div><label>대전 수</label><strong>${stats.total}전</strong></div>
      <div><label>승 / 패</label><strong>${stats.wins}승 ${stats.losses}패</strong></div>
      <div><label>승률</label><strong>${rate(stats.wins,stats.total,0)}</strong></div>
    </div>
    <div class="roulette-result-actions"><button type="button" class="secondary-button" id="roulette-open-detail">${esc(name)} 상세 통계 보기</button></div>`;
}
function setRouletteTab(tab){
  state.rouletteTab = tab==='perk'?'perk':'killer';
  document.querySelectorAll('.roulette-tab').forEach(btn=>{
    const active=btn.dataset.rouletteTab===state.rouletteTab;
    btn.classList.toggle('active',active); btn.setAttribute('aria-selected',active?'true':'false');
  });
  document.querySelectorAll('.roulette-panel').forEach(panel=>{
    const active=panel.id===`roulette-panel-${state.rouletteTab}`;
    panel.classList.toggle('active',active); panel.hidden=!active;
  });
}
function choice(arr){
  // Unbiased integer selection using browser crypto when available.
  if(globalThis.crypto?.getRandomValues){
    const max=0x100000000, limit=max-(max%arr.length), number=new Uint32Array(1);
    do{crypto.getRandomValues(number);}while(number[0]>=limit);
    return arr[number[0]%arr.length];
  }
  return arr[Math.floor(Math.random()*arr.length)];
}

// The sound is local to GitHub Pages and starts only after a user clicks Spin.
// The supplied MP3 is ~5.9 s; the visual reel runs for 5.7 s, ending with the clip.
const ROULETTE_SPIN_MS = 5700;
function updateRouletteSoundButton(){
  const button=$('roulette-sound-toggle');
  if(!button)return;
  const enabled=state.rouletteSoundOn;
  button.setAttribute('aria-pressed',enabled?'true':'false');
  button.setAttribute('aria-label',enabled?'슬롯머신 효과음 끄기':'슬롯머신 효과음 켜기');
  button.textContent=enabled?'♪ 효과음 켜짐':'♪ 효과음 꺼짐';
  button.classList.toggle('sound-off',!enabled);
}
function stopRouletteSound(){
  const audio=$('roulette-sound');
  if(!audio)return;
  audio.pause();
  try{audio.currentTime=0;}catch{}
}
function playRouletteSound(){
  const audio=$('roulette-sound');
  if(!audio||!state.rouletteSoundOn)return;
  stopRouletteSound();
  audio.volume=0.78;
  audio.loop=false;
  // play() runs directly in the click handler; on restricted browsers, silent spin remains usable.
  const request=audio.play();
  if(request&&typeof request.catch==='function'){
    request.catch(error=>console.info('룰렛 효과음 재생이 제한되었습니다.',error));
  }
}
function toggleRouletteSound(){
  state.rouletteSoundOn=!state.rouletteSoundOn;
  if(!state.rouletteSoundOn)stopRouletteSound();
  updateRouletteSoundButton();
  try{window.localStorage.setItem('kdm-roulette-sound',state.rouletteSoundOn?'on':'off');}catch{}
}

function spinRoulette(){
  if(state.rouletteSpinning||!state.data)return;
  const pool=KILLER_ORDER.filter(name=>state.data?.killerCategories?.[name]);
  if(!pool.length)return;
  const reel=$('roulette-reel-1');
  const machine=$('roulette-machine');
  const resultNode=$('roulette-result');
  const status=$('roulette-status');
  const spinButton=$('roulette-spin'), againButton=$('roulette-spin-again');
  const winner=choice(pool);
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  state.rouletteSpinning=true;
  state.rouletteWinner=null;
  machine.classList.add('spinning');
  status.textContent='회전 중';
  spinButton.disabled=true; againButton.disabled=true;
  resultNode.innerHTML='<div class="roulette-result-empty"><span>◈</span><strong>살인마를 선택하고 있습니다...</strong><p>잠시만 기다려 주세요.</p></div>';
  playRouletteSound();
  const started=performance.now();
  function advance(){
    const elapsed=performance.now()-started;
    const finished=reduced||elapsed>=ROULETTE_SPIN_MS;
    const name=finished?winner:choice(pool);
    reel.innerHTML=rouletteCardMarkup(name,true);
    reel.classList.remove('reel-bump');
    void reel.offsetWidth;
    if(!reduced)reel.classList.add('reel-bump');
    if(!finished){
      // Fast switching at the beginning, then slowing down like a slot machine.
      const progress=Math.min(1,elapsed/ROULETTE_SPIN_MS);
      const delay=Math.round(60+progress*progress*230);
      window.setTimeout(advance,Math.min(delay,ROULETTE_SPIN_MS-elapsed));
      return;
    }
    stopRouletteSound();
    machine.classList.remove('spinning');
    state.rouletteSpinning=false;
    state.rouletteWinner=winner;
    spinButton.disabled=false; againButton.disabled=false;
    renderRoulette();
    toast(`랜덤 결과: ${winner}`);
  }
  window.setTimeout(advance,reduced?0:95);
}

function getStats(){
  const matches=allMatches(),w=matches.filter(win).length,sv=matches.filter(m=>m.mode==='survivor');
  return {matches, total:matches.length, wins:w, losses:matches.length-w,
    survival:sv.length, escapes:sv.filter(win).length, deaths:sv.filter(m=>!win(m)).length,
    killer:matches.filter(m=>m.mode==='killer').length,
    killerWins:matches.filter(m=>m.mode==='killer'&&win(m)).length,
    unclassified:matches.filter(m=>m.mode==='unclassified').length,
    dates:new Set(state.data.sessions.map(s=>s.dateISO)).size};
}
function getKillerStats(year='all'){
  const categories=state.data.killerCategories;
  const map=new Map(Object.entries(categories).map(([name,category])=>[name,{name,category,wins:0,losses:0,total:0}]));
  yearFilter(allMatches(),year).filter(m=>m.mode==='killer').forEach(m=>{
    if(!map.has(m.name))map.set(m.name,{name:m.name,category:m.category||'original',wins:0,losses:0,total:0});
    const x=map.get(m.name); x.total++;x[win(m)?'wins':'losses']++;
  });
  return [...map.values()].filter(k=>k.total>0);
}
function getKiller(name){return getKillerStats().find(k=>k.name===name)||{name,wins:0,losses:0,total:0};}
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
  const years=[...new Set(state.data.sessions.map(s=>s.year))].sort((a,b)=>a-b);
  $('year-summary').innerHTML=years.map(year=>{
    const matches=yearFilter(s.matches,year),wins=matches.filter(win).length,sv=matches.filter(m=>m.mode==='survivor');
    return `<div class="year-summary-card"><span class="year-tag">${year}년</span><strong>${matches.length}전 <span class="year-scores">${wins}승 · ${matches.length-wins}패</span></strong><span class="year-detail">승률 ${rate(wins,matches.length,2)} · 생존자 ${sv.length}전</span></div>`;
  }).join('');
  const picks=state.data.picks;
  $('featured-picks').innerHTML=`<div class="picks-wrapper">${[
    {name:picks.favorite,title:'BEST PICK',type:'best'},
    {name:picks.leastFavorite,title:'WORST PICK',type:'worst'}
  ].map(p=>{const k=getKiller(p.name);return `<div class="pick-card ${p.type}"><div><div class="pick-label">${esc(p.title)}</div><div class="pick-title">${esc(p.name)}</div><div class="pick-detail">${k.total}전 ${k.wins}승 ${k.losses}패</div></div><div class="pick-rate">${rate(k.wins,k.total,0)}</div></div>`;}).join('')}</div>`;
  // No minimum match count. A tie is resolved by more matches, then by Korean name.
  const ranked=getKillerStats().sort((a,b)=>pct(b.wins,b.total)-pct(a.wins,a.total)||b.total-a.total||a.name.localeCompare(b.name,'ko')).slice(0,12);
  $('top-killers').innerHTML=ranked.map((k,i)=>`<div class="ranking-row"><span class="rank-num">${String(i+1).padStart(2,'0')}</span><div class="rank-killer" title="${esc(k.name)} · ${k.total}전"><span class="rank-name">${esc(k.name)}</span><span class="rank-games">${k.total}전</span></div><div class="bar-track"><div class="bar-fill ${pct(k.wins,k.total)>=70?'positive':''}" style="width:${pct(k.wins,k.total).toFixed(1)}%"></div></div><span class="rank-percent">${rate(k.wins,k.total,0)}</span></div>`).join('');
  const recent=state.data.sessions.slice(-6).reverse();
  $('recent-records').innerHTML=recent.map(x=>{
    const w=x.rounds.filter(win).length,l=x.rounds.length-w;
    return `<div class="recent-item"><div><div class="recent-date">${esc(x.dateISO)}</div><div class="recent-meta">${x.rounds.length}라운드 · 원본 ${esc(x.sourceRow||'추가')}행</div></div><div class="recent-score"><span class="w">${w}승</span> <span class="l">${l}패</span><span class="mini-rate">${rate(w,w+l,0)}</span></div></div>`;
  }).join('');
  $('dashboard-alert').innerHTML=`<div><strong>조회 전용 통계</strong> · 전체 ${s.total}전. 기록은 구글 스프레드시트에서만 수정하며, 생존자 맵 정보는 수집하지 않습니다.</div>`;
  renderTrend();renderKillerGallery();
}
function renderTrend(){
  const groups=[]; const lookup=new Map();
  for(const s of state.data.sessions){
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
  return state.data.sessions.map(s=>{
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
  const f=state.filters,all=getKillerStats(f.killerYear);
  const total=all.reduce((a,k)=>a+k.total,0);
  $('killer-summary').innerHTML=mini('살인마 종류',`${all.length}종`)+mini('살인마 대전',`${num(total)}전`)+mini('오리지널',`${all.filter(x=>x.category==='original').length}종`)+mini('라이선스',`${all.filter(x=>x.category==='licensed').length}종`);
  let list=all.filter(k=>(f.killerCategory==='all'||k.category===f.killerCategory)&&k.name.toLocaleLowerCase('ko').includes(f.killerSearch.toLocaleLowerCase('ko')));
  const kr=(a,b)=>a.name.localeCompare(b.name,'ko');
  if(f.killerSort==='matches')list.sort((a,b)=>b.total-a.total||pct(b.wins,b.total)-pct(a.wins,a.total)||kr(a,b));
  else if(f.killerSort==='winrate')list.sort((a,b)=>pct(b.wins,b.total)-pct(a.wins,a.total)||b.total-a.total||kr(a,b));
  else if(f.killerSort==='winrate-asc')list.sort((a,b)=>pct(a.wins,a.total)-pct(b.wins,b.total)||b.total-a.total||kr(a,b));
  else list.sort(kr);
  $('killer-table').innerHTML=list.map(k=>{
    const p=pct(k.wins,k.total), tone=p>=70?'good':p<50?'bad':'';
    return `<tr><td class="name">${esc(k.name)}</td><td><span class="category-chip">${k.category==='original'?'오리지널':k.category==='licensed'?'라이선스':'분류 확인'}</span></td><td>${k.total}</td><td>${k.wins}</td><td>${k.losses}</td><td><div class="rate-inline"><div class="bar-track"><div class="bar-fill ${p>=70?'positive':''}" style="width:${p}%"></div></div><strong class="${tone}">${rate(k.wins,k.total,0)}</strong></div></td></tr>`;
  }).join('')||`<tr><td colspan="6" class="empty-state">검색 결과가 없습니다.</td></tr>`;
  $('killer-count').textContent=`표시: ${list.length}종 · ${f.killerYear==='all'?'전체 연도':f.killerYear+'년'} 살인마 상대 경기 결과를 기준으로 계산합니다.`;
}
function renderSurvivor(){
  const year=state.filters.survivorYear;
  const sv=yearFilter(allMatches(),year).filter(m=>m.mode==='survivor'),escapes=sv.filter(win).length;
  const period=year==='all'?'전체 기록':'집계 연도 '+year+'년';
  $('survivor-kpis').innerHTML=kpi('생존자 경기',`${sv.length}전`,period)+kpi('탈출',`${escapes}회`,'탈출 성공 수','green')+kpi('사망',`${sv.length-escapes}회`,'탈출 실패 수')+kpi('생존자 탈출률',rate(escapes,sv.length,2),'탈출 수 ÷ 생존자 경기 수','accent');
}

function renderAll(){
  if(!state.data)return;
  $('source-date').textContent=`마지막 기록 ${state.data.sourceLastDate}`;
  renderDashboard();renderRecords();renderKillers();renderRoulette();renderSurvivor();
  if(state.detailKiller)renderKillerDetail();
}
const pageNames={dashboard:'대시보드',records:'토토데이 전적',killers:'살인마 통계',roulette:'랜덤 선택 룰렛',survivor:'생존자 기록', 'killer-detail':'살인마 상세 전적'};
function openPage(raw,updateHash=true){
  const isDetail=raw.startsWith('killer/');
  if(isDetail){
    let name; try{name=decodeURIComponent(raw.slice(7));}catch{name='';}
    state.detailKiller=name;
    state.detailYear='all';state.detailShowAll=false;
    $('detail-year').value='all';
    raw='killer-detail';
    if(state.data)renderKillerDetail();
  }
  const page=pageNames[raw]?raw:'dashboard';state.page=page;
  document.querySelectorAll('.page').forEach(el=>el.classList.toggle('active',el.id===`page-${page}`));
  document.querySelectorAll('.nav-button').forEach(el=>{el.classList.toggle('active',el.dataset.page===page);el.setAttribute('aria-current',el.dataset.page===page?'page':'false');});
  $('breadcrumb').textContent=isDetail?state.detailKiller:pageNames[page];
  const target=isDetail?`#killer/${encodeURIComponent(state.detailKiller)}`:`#${page}`;
  if(updateHash&&location.hash!==target)history.pushState(null,'',target);
  window.scrollTo({top:0,behavior:'auto'});
}
function populateOptions(){
  const dates=[...new Set(state.data.sessions.map(s=>s.date.split('.')[0]))].sort((a,b)=>Number(a)-Number(b));
  $('record-month').innerHTML='<option value="all">전체 월</option>'+dates.map(m=>`<option value="${esc(m)}">${Number(m)}월</option>`).join('');
  $('record-month').value=state.filters.recordMonth;
  const years=[...new Set(state.data.sessions.map(s=>s.year))].sort((a,b)=>a-b);
  for(const [id,key] of [['record-year','recordYear'],['killer-year','killerYear'],['survivor-year','survivorYear']]){
    $(id).innerHTML='<option value="all">전체 연도</option>'+years.map(y=>`<option value="${y}">${y}년</option>`).join('');
    $(id).value=state.filters[key];
  }
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
function attachEvents(){
  $('nav').addEventListener('click',e=>{
    const pageBtn=e.target.closest('[data-page]');
    if(pageBtn){ openPage(pageBtn.dataset.page); return; }
    const jumpBtn=e.target.closest('[data-jump]');
    if(jumpBtn){
      openPage('dashboard');
      const target=$(jumpBtn.dataset.jump);
      if(target) requestAnimationFrame(()=>target.scrollIntoView({behavior:'smooth', block:'start'}));
    }
  });
  document.body.addEventListener('click',e=>{
    const go=e.target.closest('[data-go]'); if(go){ openPage(go.dataset.go); return; }
    const detailBtn=e.target.closest('#roulette-open-detail'); if(detailBtn && state.rouletteWinner){ openPage('killer/'+encodeURIComponent(state.rouletteWinner)); return; }
  });
  window.addEventListener('hashchange',()=>openPage(location.hash.slice(1),false));
  $('theme-toggle').addEventListener('click',()=>{document.body.classList.toggle('light');$('theme-toggle').textContent=document.body.classList.contains('light')?'☾':'☀';});
  for(const [id,key] of [['record-search','recordSearch'],['record-mode','recordMode'],['record-year','recordYear'],['record-month','recordMonth'],['record-outcome','recordOutcome']]){
    $(id).addEventListener('input',e=>{state.filters[key]=e.target.value;state.recordLimit=12;renderRecords();});
  }
  for(const [id,key] of [['killer-search','killerSearch'],['killer-year','killerYear'],['killer-category','killerCategory'],['killer-sort','killerSort']]){
    $(id).addEventListener('input',e=>{state.filters[key]=e.target.value;renderKillers();});
  }
  $('load-more').addEventListener('click',()=>{state.recordLimit+=12;renderRecords();});
  for(const [id,key] of [['gallery-search','gallerySearch'],['gallery-category','galleryCategory'],['gallery-order','galleryOrder']]){$(id).addEventListener('input',e=>{state.filters[key]=e.target.value;renderKillerGallery();});}
  $('detail-year').addEventListener('change',e=>{state.detailYear=e.target.value;state.detailShowAll=false;renderKillerDetail();});
  $('detail-show-more').addEventListener('click',()=>{state.detailShowAll=!state.detailShowAll;renderKillerDetail();});
  $('survivor-year').addEventListener('change',e=>{state.filters.survivorYear=e.target.value;renderSurvivor();});
  document.querySelectorAll('.roulette-tab').forEach(btn=>btn.addEventListener('click',()=>setRouletteTab(btn.dataset.rouletteTab)));
  $('roulette-spin').addEventListener('click',spinRoulette);
  $('roulette-spin-again').addEventListener('click',spinRoulette);
  $('roulette-sound-toggle').addEventListener('click',toggleRouletteSound);
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
