'use strict';

/* Read-only GitHub Pages statistics. Sync uses a Google Sheets bound Apps Script JSONP endpoint.
   No admin login, remote writes, or private sheet data are included. */
const state = {
  data: null, page: 'dashboard', recordLimit: 12,
  live: false, busy: false,
  filters: { recordSearch: '', recordMode: 'all', recordYear: 'all', recordMonth: 'all', recordOutcome: 'all',
    killerSearch: '', killerYear: 'all', killerCategory: 'all', killerSort: 'matches', survivorYear: 'all' }
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
  const ranked=getKillerStats().filter(k=>k.total>=10).sort((a,b)=>pct(b.wins,b.total)-pct(a.wins,a.total)||b.total-a.total||a.name.localeCompare(b.name,'ko')).slice(0,6);
  $('top-killers').innerHTML=ranked.map((k,i)=>`<div class="ranking-row"><span class="rank-num">${String(i+1).padStart(2,'0')}</span><span class="rank-name" title="${esc(k.name)}">${esc(k.name)}</span><div class="bar-track"><div class="bar-fill ${pct(k.wins,k.total)>=70?'positive':''}" style="width:${pct(k.wins,k.total).toFixed(1)}%"></div></div><span class="rank-percent">${rate(k.wins,k.total,0)}</span></div>`).join('');
  const recent=state.data.sessions.slice(-6).reverse();
  $('recent-records').innerHTML=recent.map(x=>{
    const w=x.rounds.filter(win).length,l=x.rounds.length-w;
    return `<div class="recent-item"><div><div class="recent-date">${esc(x.dateISO)}</div><div class="recent-meta">${x.rounds.length}라운드 · 원본 ${esc(x.sourceRow||'추가')}행</div></div><div class="recent-score"><span class="w">${w}승</span> <span class="l">${l}패</span><span class="mini-rate">${rate(w,w+l,0)}</span></div></div>`;
  }).join('');
  $('dashboard-alert').innerHTML=`<div><strong>조회 전용 통계</strong> · 전체 ${s.total}전. 기록은 구글 스프레드시트에서만 수정하며, 생존자 맵 정보는 수집하지 않습니다.</div>`;
  renderTrend();
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
  renderDashboard();renderRecords();renderKillers();renderSurvivor();
}
const pageNames={dashboard:'대시보드',records:'토토데이 전적',killers:'살인마 통계',survivor:'생존자 기록'};
function openPage(page,updateHash=true){
  if(!pageNames[page])page='dashboard';state.page=page;
  document.querySelectorAll('.page').forEach(el=>el.classList.toggle('active',el.id===`page-${page}`));
  document.querySelectorAll('.nav-button').forEach(el=>{el.classList.toggle('active',el.dataset.page===page);el.setAttribute('aria-current',el.dataset.page===page?'page':'false');});
  $('breadcrumb').textContent=pageNames[page];
  if(updateHash&&location.hash!==`#${page}`)history.replaceState(null,'',`#${page}`);
  window.scrollTo({top:0,behavior:'instant'});
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
  $('nav').addEventListener('click',e=>{const el=e.target.closest('[data-page]');if(el)openPage(el.dataset.page);});
  document.body.addEventListener('click',e=>{const el=e.target.closest('[data-go]');if(el)openPage(el.dataset.go);});
  window.addEventListener('hashchange',()=>openPage(location.hash.slice(1),false));
  $('theme-toggle').addEventListener('click',()=>{document.body.classList.toggle('light');$('theme-toggle').textContent=document.body.classList.contains('light')?'☾':'☀';});
  for(const [id,key] of [['record-search','recordSearch'],['record-mode','recordMode'],['record-year','recordYear'],['record-month','recordMonth'],['record-outcome','recordOutcome']]){
    $(id).addEventListener('input',e=>{state.filters[key]=e.target.value;state.recordLimit=12;renderRecords();});
  }
  for(const [id,key] of [['killer-search','killerSearch'],['killer-year','killerYear'],['killer-category','killerCategory'],['killer-sort','killerSort']]){
    $(id).addEventListener('input',e=>{state.filters[key]=e.target.value;renderKillers();});
  }
  $('load-more').addEventListener('click',()=>{state.recordLimit+=12;renderRecords();});
  $('survivor-year').addEventListener('change',e=>{state.filters.survivorYear=e.target.value;renderSurvivor();});
}
async function start(){
  attachEvents();
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
