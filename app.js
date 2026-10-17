'use strict';

/* GitHub Pages frontend. Google Sheets (via Cloudflare Worker) is authoritative when configured.
   Local bundled JSON is a clearly marked fallback snapshot. No credentials are shipped in the site. */
const state = {
  original: null, data: null, page: 'dashboard', recordLimit: 12, dirty: 0,
  live: false, busy: false, adminToken: '',
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
const deepCopy = (v) => JSON.parse(JSON.stringify(v));
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
  $('dashboard-alert').innerHTML=`<div><strong>기록 분류 완료</strong> · 총 ${s.total}경기를 살인마 또는 생존자로 분류했습니다. 생존자 맵 정보는 저장하지 않습니다.</div><button type="button" data-go="manage">기준 확인</button>`;
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
    return `<tr><td class="name">${esc(k.name)}</td><td><span class="category-chip">${k.category==='original'?'오리지널':'라이선스'}</span></td><td>${k.total}</td><td>${k.wins}</td><td>${k.losses}</td><td><div class="rate-inline"><div class="bar-track"><div class="bar-fill ${p>=70?'positive':''}" style="width:${p}%"></div></div><strong class="${tone}">${rate(k.wins,k.total,0)}</strong></div></td></tr>`;
  }).join('')||`<tr><td colspan="6" class="empty-state">검색 결과가 없습니다.</td></tr>`;
  $('killer-count').textContent=`표시: ${list.length}종 · ${f.killerYear==='all'?'전체 연도':f.killerYear+'년'} 살인마 상대 경기 결과를 기준으로 계산합니다.`;
}
function renderSurvivor(){
  const year=state.filters.survivorYear;
  const sv=yearFilter(allMatches(),year).filter(m=>m.mode==='survivor'),escapes=sv.filter(win).length;
  const period=year==='all'?'전체 기록':'집계 연도 '+year+'년';
  $('survivor-kpis').innerHTML=kpi('생존자 경기',`${sv.length}전`,period)+kpi('탈출',`${escapes}회`,'탈출 성공 수','green')+kpi('사망',`${sv.length-escapes}회`,'탈출 실패 수')+kpi('생존자 탈출률',rate(escapes,sv.length,2),'탈출 수 ÷ 생존자 경기 수','accent');
}
function renderManage(){
  const s=getStats();
  $('export-count').innerHTML=`현재 ${num(s.total)}전 · ${s.wins}승 ${s.losses}패`;
  $('data-notes').innerHTML=state.data.dataNotes.map(n=>`<li>${esc(n.text)}</li>`).join('');
}
function renderAll(){
  if(!state.data)return;
  $('source-date').textContent=`마지막 기록 ${state.data.sourceLastDate}`;
  renderDashboard();renderRecords();renderKillers();renderSurvivor();renderManage();
}
const pageNames={dashboard:'대시보드',records:'토토데이 전적',killers:'살인마 통계',survivor:'생존자 기록',manage:'데이터 관리'};
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
  $('killer-names').innerHTML=Object.keys(state.data.killerCategories).sort((a,b)=>a.localeCompare(b,'ko')).map(name=>`<option value="${esc(name)}"></option>`).join('');
}
const remoteConfig=window.KDM_CONFIG||{};
const apiUrl=String(remoteConfig.apiBase||'').replace(/\/$/,'');
const firebaseKey=String(remoteConfig.firebaseWebApiKey||'');
const configured=Boolean(apiUrl&&firebaseKey);
function syncNotice(text,theme=''){
  const el=$('sync-label');el.textContent=text;el.className='sync-label '+theme;
  const side=$('sidebar-status');if(side){side.innerHTML='<span class="status-pulse"></span> '+(theme==='good'?'Google Sheets 실시간 연결':theme==='bad'?'연동 오류 · 저장본 표시':'연동 설정 전');side.classList.toggle('connected',theme==='good');}
}
function adminUi(){
  const notice=$('admin-notice');
  $('login-panel').hidden=!configured||Boolean(state.adminToken);
  $('admin-tools').hidden=!configured||!state.adminToken;
  if(!configured){notice.innerHTML='<strong>연동 설정 전</strong><span>현재 582경기 저장본을 조회할 수 있습니다. 관리 기능을 사용하려면 README의 Firebase · Cloudflare Worker 설정을 완료해 주세요.</span>';}
  else if(!state.live){notice.innerHTML='<strong>연결 확인 필요</strong><span>실시간 서버에 접속할 수 없어 관리자 기록 입력이 일시적으로 차단됩니다.</span>';}
  else {notice.innerHTML=state.adminToken?'<strong>관리자 인증 완료</strong><span>새 기록은 서버에서 인증한 뒤 스프레드시트에 저장됩니다.</span>':'<strong>로그인 필요</strong><span>등록된 관리자 계정만 기록을 저장할 수 있습니다. 시청자는 통계를 조회할 수 있습니다.</span>';}
  $('login-panel').hidden=!configured||Boolean(state.adminToken);
  $('admin-tools').hidden=!configured||!state.adminToken||!state.live;
}
async function reloadRemote(silent=false){
  if(!apiUrl||state.busy)return;
  state.busy=true;
  try{
    const response=await fetch(apiUrl+'/api/records',{cache:'no-store'});
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||`HTTP ${response.status}`);
    if(!Array.isArray(data.sessions)||!data.killerCategories||data.schemaVersion!==2)throw new Error('데이터 형식이 올바르지 않습니다.');
    state.data=data;state.live=true;populateOptions();renderAll();
    syncNotice('Google Sheets 연결 · 자동 갱신','good');
    if(!silent)toast('최신 스프레드시트 기록을 불러왔습니다.');
  }catch(e){
    console.error('Sheet sync failed',e);state.live=false;
    syncNotice('연동 오류 · 저장본 표시','bad');
    if(!silent)toast('실시간 연동에 실패했습니다. 기존 저장본을 표시합니다.');
  }finally{state.busy=false;adminUi();}
}
async function verifyAdmin(token){
  const response=await fetch(apiUrl+'/api/session',{headers:{Authorization:'Bearer '+token}});
  return response.ok;
}
function logout(){
  state.adminToken='';sessionStorage.removeItem('kdm-admin-token');adminUi();
  toast('관리자 로그아웃이 완료됐습니다.');
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
  $('add-mode').addEventListener('change',e=>{const sv=e.target.value==='survivor';$('add-name-wrap').hidden=sv;$('add-name').required=!sv;if(sv)$('add-name').value='';$('add-result').innerHTML=sv?'<option value="win">탈출</option><option value="loss">사망</option>':'<option value="win">승리</option><option value="loss">패배</option>';});
  $('login-form').addEventListener('submit',async e=>{
    e.preventDefault();if(!configured)return;
    const form=e.currentTarget,button=form.querySelector('button[type=submit]');
    const values=new FormData(form);button.disabled=true;
    $('login-feedback').textContent='계정을 확인하고 있습니다.';
    try{
      const r=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key='+encodeURIComponent(firebaseKey),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:String(values.get('email')),password:String(values.get('password')),returnSecureToken:true})});
      const data=await r.json();
      if(!r.ok||!data.idToken)throw new Error('아이디 또는 비밀번호를 확인해 주세요.');
      if(!await verifyAdmin(data.idToken))throw new Error('등록된 관리자 계정이 아닙니다.');
      state.adminToken=data.idToken;sessionStorage.setItem('kdm-admin-token',data.idToken);form.reset();adminUi();
      $('login-feedback').textContent='';toast('관리자 로그인이 완료됐습니다.');
    }catch(error){$('login-feedback').textContent=error.message;}
    finally{button.disabled=false;}
  });
  $('admin-logout').addEventListener('click',logout);
  $('add-form').addEventListener('submit',async e=>{
    e.preventDefault();
    if(!state.adminToken||!state.live){toast('서버 연결과 관리자 로그인을 확인하세요.');return;}
    const f=new FormData(e.currentTarget),dateISO=String(f.get('date')).trim(),mode=String(f.get('mode')),result=String(f.get('result'));
    const rawName=String(f.get('name')||'').trim(),name=rawName==='프레디'?'나이트메어':rawName;
    const parsedDate=new Date(dateISO+'T00:00:00Z');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)||Number.isNaN(parsedDate.getTime())||parsedDate.toISOString().slice(0,10)!==dateISO){toast('날짜를 올바르게 입력해 주세요.');return;}
    if(mode==='killer'&&!state.data.killerCategories[name]){$('form-feedback').textContent='등록되지 않은 살인마입니다.';return;}
    const button=$('add-submit');button.disabled=true;$('form-feedback').textContent='서버에 기록을 저장하고 있습니다.';
    try{
      const response=await fetch(apiUrl+'/api/matches',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+state.adminToken},body:JSON.stringify({dateISO,mode,result,name:mode==='survivor'?'':name})});
      const body=await response.json();
      if(!response.ok){if([401,403].includes(response.status))logout();throw new Error(body.error||'서버 저장 실패');}
      $('form-feedback').textContent='서버에 기록이 저장됐습니다. 통계를 다시 불러옵니다.';
      e.currentTarget.elements.name.value='';await reloadRemote(true);
      toast('스프레드시트 기록이 저장됐습니다.');
    }catch(error){$('form-feedback').textContent=error.message;toast('기록을 저장하지 못했습니다.');}
    finally{button.disabled=false;}
  });
}
async function start(){
  attachEvents();
  try{
    const response=await fetch('./data/records.json',{cache:'no-cache'});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const data=await response.json();
    if(!Array.isArray(data.sessions)||!data.killerCategories||data.schemaVersion!==2||data.sessions.some(s=>!s.dateISO||!s.year))throw new Error('records.json v2 구조 확인 필요');
    state.original=deepCopy(data);state.data=data;populateOptions();renderAll();openPage(location.hash.slice(1),false);
    syncNotice(configured?'Google Sheets 연결 확인 중':'저장본 조회 · 연동 설정 전');adminUi();
    if(configured){
      await reloadRemote(true);
      const token=sessionStorage.getItem('kdm-admin-token');
      if(token&&await verifyAdmin(token).catch(()=>false)){state.adminToken=token;adminUi();}
      else sessionStorage.removeItem('kdm-admin-token');
      setInterval(()=>{if(!document.hidden)reloadRemote(true);},60000);
      document.addEventListener('visibilitychange',()=>{if(!document.hidden)reloadRemote(true);});
    }
  }catch(error){
    console.error(error);
    $('overview-kpis').innerHTML='<div class="notice" style="grid-column:1/-1"><strong>데이터를 불러오지 못했습니다.</strong><span>README의 로컬 서버 실행 방법을 참고하거나 GitHub Pages에 게시해 주세요.</span></div>';
    syncNotice('데이터 로드 오류','bad');
  }
}
start();
