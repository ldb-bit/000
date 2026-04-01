// ================================================================
//  ★ 여기만 수정하세요 ★
//  앱스 스크립트 배포 후 받은 웹앱 URL을 아래에 붙여넣으세요.
// ================================================================
const API_URL = "https://script.google.com/macros/s/AKfycbx01uwjX9TGc6GMAhb-27jDGwjOhWJqTgtF-rQCP4YHV-_537Q04hHJ_jLCX9Rl3b2P/exec";
// ================================================================

let state={teams:[],participants:[],investments:[]};
let selectedParticipantName="",selectedParticipantTeam="",adminPassword="",loadingCount=0;

function showToast(msg,isError=false){const el=document.getElementById("toast");el.textContent=msg;el.className="toast show"+(isError?" error":"");setTimeout(()=>el.className="toast",1800)}
function showLoading(msg="로딩중..."){loadingCount+=1;const ov=document.getElementById("loadingOverlay");ov.querySelector(".loading-text").textContent=msg;ov.style.display="flex"}
function hideLoading(){loadingCount=Math.max(0,loadingCount-1);if(loadingCount===0)document.getElementById("loadingOverlay").style.display="none"}
async function withLoading(fn,msg="로딩중..."){showLoading(msg);try{return await fn()}finally{hideLoading()}}
function n(v){const x=Number(v);return Number.isFinite(x)?x:0}
function escapeHtml(s){return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
function cssEscape(s){return String(s).replace(/\\/g,"\\\\").replace(/"/g,'\\"')}
function toISO(v){const d=new Date(v);return Number.isNaN(d.getTime())?String(v??""):d.toISOString()}
function formatDateKOR(v){const d=new Date(v);return Number.isNaN(d.getTime())?String(v??""): d.toLocaleString("ko-KR")}
function getInitialChar(name){return String(name||"?").charAt(0).toUpperCase()}

async function apiGetInit(){const r=await fetch(`${API_URL}?action=init`,{method:"GET"});if(!r.ok)throw new Error(`init failed:${r.status}`);return r.json()}
async function apiPost(action,payload){const r=await fetch(API_URL,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({action,...payload})});if(!r.ok)throw new Error(`post failed:${r.status}`);return r.json()}

function computeAggregates(){
  const s=new Map(),raised=new Map(),backers=new Map();
  for(const inv of state.investments){
    const p=String(inv["참여자명"]??"").trim(),t=String(inv["팀명"]??"").trim(),a=n(inv["투자금액"]??0);
    if(!p||!t||a<=0)continue;
    s.set(p,(s.get(p)||0)+a);raised.set(t,(raised.get(t)||0)+a);
    if(!backers.has(t))backers.set(t,new Set());backers.get(t).add(p);
  }
  return{spentByParticipant:s,raisedByTeam:raised,backersByTeam:backers};
}

async function loadFromSheet(){
  const d=await apiGetInit();if(d.error)throw new Error(d.error);
  state.teams=Array.isArray(d.teams)?d.teams:[];
  state.participants=Array.isArray(d.participants)?d.participants:[];
  state.investments=Array.isArray(d.investments)?d.investments:[];
}

function resetToEntry(){
  selectedParticipantName="";selectedParticipantTeam="";adminPassword="";
  sessionStorage.removeItem("selectedParticipantName");
  document.getElementById("participantPage").style.display="none";
  document.getElementById("adminPage").style.display="none";
  document.getElementById("passwordModal").style.display="none";
  document.getElementById("entryModal").style.display="flex";
  document.getElementById("entryStepParticipant").style.display="none";
  document.getElementById("entryStepType").style.display="block";
  document.getElementById("entryParticipantSelect").innerHTML=`<option value="">불러오는 중...</option>`;
  document.getElementById("passwordInput").value="";
  document.getElementById("passwordError").textContent="";
}

document.getElementById("adminBtn").addEventListener("click",()=>{document.getElementById("entryModal").style.display="none";document.getElementById("passwordModal").style.display="flex"});
document.getElementById("participantBtn").addEventListener("click",async()=>{document.getElementById("entryStepType").style.display="none";document.getElementById("entryStepParticipant").style.display="block";await withLoading(fillParticipantDropdown,"참여자 목록 불러오는 중...")});
document.getElementById("entryParticipantBack").addEventListener("click",()=>{document.getElementById("entryStepParticipant").style.display="none";document.getElementById("entryStepType").style.display="block"});
document.getElementById("entryParticipantEnter").addEventListener("click",async()=>{
  const name=document.getElementById("entryParticipantSelect").value;
  if(!name)return showToast("참여자를 선택해주세요",true);
  selectedParticipantName=name;
  const p=state.participants.find(x=>String(x["참여자명"]??"").trim()===name);
  selectedParticipantTeam=String(p?.["소속팀"]??"").trim();
  sessionStorage.setItem("selectedParticipantName",name);
  document.getElementById("entryModal").style.display="none";
  document.getElementById("participantPage").style.display="block";
  await withLoading(initParticipantPage,"화면 준비중...");
});
document.getElementById("passwordCancel").addEventListener("click",()=>resetToEntry());
document.getElementById("passwordSubmit").addEventListener("click",async()=>{
  const pw=document.getElementById("passwordInput").value.trim();
  const err=document.getElementById("passwordError");
  if(!pw){err.textContent="비밀번호를 입력해주세요";return}
  await withLoading(async()=>{
    try{
      const resp=await apiPost("adminLogin",{password:pw});
      if(!resp.success){err.textContent="비밀번호가 일치하지 않습니다";return}
      adminPassword=pw;err.textContent="";
      document.getElementById("passwordModal").style.display="none";
      document.getElementById("adminPage").style.display="block";
      await initAdminPage();
    }catch(e){console.error(e);err.textContent="로그인에 실패했습니다"}
  },"로그인중...");
});
document.getElementById("passwordInput").addEventListener("keypress",e=>{if(e.key==="Enter")document.getElementById("passwordSubmit").click()});

document.querySelectorAll(".tab-btn").forEach(btn=>btn.addEventListener("click",()=>{
  document.querySelectorAll(".tab-btn").forEach(b=>b.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach(c=>c.classList.remove("active"));
  btn.classList.add("active");document.getElementById(btn.dataset.tab+"Tab").classList.add("active");
}));

async function fillParticipantDropdown(){
  try{
    await loadFromSheet();
    const sel=document.getElementById("entryParticipantSelect");
    sel.innerHTML=`<option value="">참여자를 선택하세요</option>`;
    state.participants.forEach(p=>{const name=String(p["참여자명"]??"").trim();if(!name)return;const o=document.createElement("option");o.value=name;o.textContent=name;sel.appendChild(o)});
  }catch(e){console.error(e);document.getElementById("entryParticipantSelect").innerHTML=`<option value="">불러오기 실패</option>`;showToast("참여자 목록을 불러오지 못했습니다",true)}
}

async function initAdminPage(){await loadFromSheet();document.getElementById("lastSyncText").textContent=`마지막 동기화: ${new Date().toLocaleString("ko-KR")}`;renderAdminAll()}
document.getElementById("syncBtn").addEventListener("click",async()=>{await withLoading(async()=>{try{await initAdminPage();showToast("불러오기 완료")}catch(e){console.error(e);showToast("불러오기에 실패했습니다",true)}},"불러오는 중...")});
function renderAdminAll(){renderTeamsTable();renderParticipantsTable();renderInvestmentsTable()}

function renderTeamsTable(){
  const tbody=document.querySelector("#teamsTable tbody");tbody.innerHTML="";
  const{raisedByTeam:r,backersByTeam:b}=computeAggregates();
  state.teams.forEach((t,i)=>{
    const name=String(t["팀명"]??"").trim();
    const raised=r.get(name)||0,backers=b.has(name)?b.get(name).size:0;
    const row=document.createElement("tr");
    row.innerHTML=`<td><input type="text" value="${escapeHtml(name)}" data-type="team" data-field="팀명" data-index="${i}"></td><td><textarea data-type="team" data-field="주제" data-index="${i}">${escapeHtml(t["주제"]??"")}</textarea></td><td><textarea data-type="team" data-field="세부설명" data-index="${i}">${escapeHtml(t["세부설명"]??"")}</textarea></td><td><input type="text" value="${escapeHtml(t["이미지파일명"]??"")}" data-type="team" data-field="이미지파일명" data-index="${i}" placeholder="예: team1.jpg"></td><td><input type="number" class="readonly" value="${raised}" readonly></td><td><input type="number" class="readonly" value="${backers}" readonly></td><td><button class="delete-row-btn" data-index="${i}">삭제</button></td>`;
    tbody.appendChild(row);
  });
  tbody.querySelectorAll(".delete-row-btn").forEach(btn=>btn.addEventListener("click",e=>{state.teams.splice(parseInt(e.target.dataset.index,10),1);renderTeamsTable()}));
  tbody.querySelectorAll("[data-type='team']").forEach(inp=>inp.addEventListener("input",e=>{state.teams[parseInt(e.target.dataset.index,10)][e.target.dataset.field]=e.target.value}));
}

function renderParticipantsTable(){
  const tbody=document.querySelector("#participantsTable tbody");tbody.innerHTML="";
  const{spentByParticipant:s}=computeAggregates();
  state.participants.forEach((p,i)=>{
    const name=String(p["참여자명"]??"").trim(),team=String(p["소속팀"]??"").trim();
    const base=n(p["기본포인트"]),spent=s.get(name)||0,remain=base-spent;
    const row=document.createElement("tr");
    row.innerHTML=`<td><input type="text" value="${escapeHtml(name)}" data-type="participant" data-field="참여자명" data-index="${i}"></td><td><input type="text" value="${escapeHtml(team)}" data-type="participant" data-field="소속팀" data-index="${i}"></td><td><input type="number" value="${base}" data-type="participant" data-field="기본포인트" data-index="${i}"></td><td><input type="number" class="readonly" value="${spent}" readonly></td><td><input type="number" class="readonly" value="${remain}" readonly></td><td><button class="delete-row-btn" data-index="${i}">삭제</button></td>`;
    tbody.appendChild(row);
  });
  tbody.querySelectorAll(".delete-row-btn").forEach(btn=>btn.addEventListener("click",e=>{state.participants.splice(parseInt(e.target.dataset.index,10),1);renderParticipantsTable()}));
  tbody.querySelectorAll("[data-type='participant']").forEach(inp=>inp.addEventListener("input",e=>{const idx=parseInt(e.target.dataset.index,10),field=e.target.dataset.field;state.participants[idx][field]=(field==="기본포인트")?n(e.target.value):e.target.value}));
}

function renderInvestmentsTable(){
  const tbody=document.querySelector("#investmentsTable tbody");tbody.innerHTML="";
  state.investments.forEach(inv=>{
    const tsRaw=inv["일시"],tsIso=toISO(tsRaw);
    const participantName=String(inv["참여자명"]??"").trim(),teamName=String(inv["팀명"]??"").trim(),amount=n(inv["투자금액"]??0);
    const row=document.createElement("tr");
    row.innerHTML=`<td>${escapeHtml(formatDateKOR(tsRaw))}</td><td>${escapeHtml(participantName)}</td><td>${escapeHtml(teamName)}</td><td>${amount.toLocaleString()}</td><td><button class="delete-row-btn">삭제</button></td>`;
    tbody.appendChild(row);
    row.querySelector(".delete-row-btn").addEventListener("click",async()=>{
      if(!confirm("이 투자내역을 삭제할까요?"))return;
      await withLoading(async()=>{
        try{const resp=await apiPost("deleteInvestment",{password:adminPassword,ts:tsIso,participantName,teamName,amount});if(!resp.success){throw new Error(resp.error||"delete failed")}await loadFromSheet();renderAdminAll();showToast("삭제되었습니다")}catch(e){console.error(e);showToast("삭제에 실패했습니다",true)}
      },"삭제 처리중...");
    });
  });
}

document.getElementById("addTeamBtn").addEventListener("click",()=>{state.teams.push({"팀명":"","주제":"","세부설명":"","이미지파일명":""});renderTeamsTable()});
document.getElementById("addParticipantBtn").addEventListener("click",()=>{state.participants.push({"참여자명":"","소속팀":"","기본포인트":0});renderParticipantsTable()});

document.getElementById("saveAdminBtn").addEventListener("click",async()=>{
  const saveBtn=document.getElementById("saveAdminBtn");
  await withLoading(async()=>{
    try{
      const tn=new Set();
      for(const t of state.teams){const name=String(t["팀명"]??"").trim();if(!name)return showToast("팀명을 입력해주세요",true);if(tn.has(name))return showToast(`팀명 중복: ${name}`,true);tn.add(name)}
      const pn=new Set();
      for(const p of state.participants){const name=String(p["참여자명"]??"").trim();if(!name)return showToast("참여자명을 입력해주세요",true);if(pn.has(name))return showToast(`참여자명 중복: ${name}`,true);pn.add(name)}
      saveBtn.disabled=true;saveBtn.textContent="저장중...";
      const r1=await apiPost("saveTeams",{password:adminPassword,teams:state.teams});
      if(!r1.success){throw new Error(r1.error||"saveTeams failed")}
      const r2=await apiPost("saveParticipants",{password:adminPassword,participants:state.participants});
      if(!r2.success){throw new Error(r2.error||"saveParticipants failed")}
      await loadFromSheet();renderAdminAll();showToast("저장되었습니다");
    }catch(e){console.error(e);showToast("저장에 실패했습니다",true)}
    finally{saveBtn.disabled=false;saveBtn.textContent="저장하기"}
  },"저장중...");
});

document.getElementById("clearInvestmentsBtn").addEventListener("click",async()=>{
  if(!confirm("모든 투자내역을 삭제하시겠습니까?"))return;
  await withLoading(async()=>{
    try{const r=await apiPost("clearInvestments",{password:adminPassword});if(!r.success){throw new Error(r.error||"clear failed")}await loadFromSheet();renderAdminAll();showToast("투자내역이 모두 삭제되었습니다")}catch(e){console.error(e);showToast("전체 삭제에 실패했습니다",true)}
  },"전체 삭제중...");
});

async function initParticipantPage(){
  if(state.participants.length===0)await loadFromSheet();
  const participant=state.participants.find(p=>String(p["참여자명"]??"").trim()===selectedParticipantName);
  if(!participant){showToast("참여자 정보를 찾을 수 없습니다",true);resetToEntry();return}
  selectedParticipantTeam=String(participant["소속팀"]??"").trim();
  document.getElementById("fixedParticipantName").textContent=selectedParticipantName;
  document.getElementById("fixedParticipantTeam").textContent=selectedParticipantTeam||"-";
  document.getElementById("participantAvatar").textContent=getInitialChar(selectedParticipantName);
  document.getElementById("participantResetBtn").onclick=()=>resetToEntry();
  renderParticipantPage();
}

function renderParticipantPage(){
  const{spentByParticipant:s}=computeAggregates();
  const participant=state.participants.find(p=>String(p["참여자명"]??"").trim()===selectedParticipantName);
  if(!participant)return;
  const base=n(participant["기본포인트"]),spent=s.get(selectedParticipantName)||0,remain=base-spent;
  document.getElementById("basePoints").textContent=base.toLocaleString();
  document.getElementById("spentPoints").textContent=spent.toLocaleString();
  document.getElementById("remainPoints").textContent=remain.toLocaleString();
  document.getElementById("pointsCard").style.display="flex";
  renderMyInvestSummary();renderTeamCards();
}

function renderMyInvestSummary(){
  const wrap=document.getElementById("myInvestSummary"),list=document.getElementById("myInvestList");
  const invs=state.investments.filter(inv=>String(inv["참여자명"]??"").trim()===selectedParticipantName).map(inv=>({team:String(inv["팀명"]??"").trim(),amt:n(inv["투자금액"]??0)})).filter(x=>x.team&&x.amt>0);
  if(invs.length===0){wrap.style.display="none";return}
  const sum=new Map();for(const x of invs)sum.set(x.team,(sum.get(x.team)||0)+x.amt);
  wrap.style.display="block";list.innerHTML="";
  [...sum.entries()].forEach(([team,total])=>{const row=document.createElement("div");row.className="my-invest-row";row.innerHTML=`<div class="mi-team">${escapeHtml(team)}</div><div class="mi-amt">${Number(total).toLocaleString()} P</div>`;list.appendChild(row)});
}

function renderTeamCards(){
  const container=document.getElementById("teamsContainer");container.innerHTML="";
  const{raisedByTeam:r,backersByTeam:b}=computeAggregates();
  state.teams.forEach(team=>{
    const teamName=String(team["팀명"]??"").trim(),topic=String(team["주제"]??""),detail=String(team["세부설명"]??""),imageUrl=String(team["이미지URL"]??"").trim();
    const raised=r.get(teamName)||0,backers=b.has(teamName)?b.get(teamName).size:0;
    const isOwnTeam=selectedParticipantTeam&&selectedParticipantTeam===teamName;
    const imageHtml=imageUrl?`<img class="team-image" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(teamName)}" loading="lazy">`:`<div class="team-image-placeholder">이미지 없음</div>`;
    const card=document.createElement("div");card.className="team-card";
    card.innerHTML=`${imageHtml}<div class="team-card-body"><div class="team-header"><div class="team-name">${escapeHtml(teamName)}</div><div class="team-badge">투자자 ${backers}명 · ${raised.toLocaleString()}P</div></div><div class="team-grid"><div class="team-info-box"><div class="team-info-label">주제</div><div class="team-info-value">${escapeHtml(topic)}</div></div><div class="team-info-box"><div class="team-info-label">세부설명</div><div class="team-info-value">${escapeHtml(detail)}</div></div></div><div class="investment-section">${isOwnTeam?`<div class="investment-notice blocked">⚠ 소속팀에는 투자할 수 없습니다</div>`:`<div class="investment-notice">한 번 투자하면 수정이 불가합니다. 신중하게 투자해주세요.</div><div class="investment-row"><input type="text" class="investment-input" placeholder="투자 포인트 입력" data-team="${escapeHtml(teamName)}" inputmode="numeric"><button class="invest-btn" data-team="${escapeHtml(teamName)}">투자하기</button></div><div class="input-error" data-team="${escapeHtml(teamName)}"></div>`}</div></div>`;
    if(!isOwnTeam){
      const input=card.querySelector(".investment-input"),errorDiv=card.querySelector(".input-error");
      input.addEventListener("input",e=>{const c=e.target.value.replace(/[^0-9]/g,"");if(e.target.value!==c){e.target.value=c;errorDiv.textContent="숫자만 입력해주세요";e.target.classList.add("error")}else{errorDiv.textContent="";e.target.classList.remove("error")}});
      card.querySelector(".invest-btn").addEventListener("click",async()=>await handleInvestment(teamName));
    }
    container.appendChild(card);
  });
}

async function handleInvestment(teamName){
  const input=document.querySelector(`.investment-input[data-team="${cssEscape(teamName)}"]`);
  const button=document.querySelector(`.invest-btn[data-team="${cssEscape(teamName)}"]`);
  const errorDiv=document.querySelector(`.input-error[data-team="${cssEscape(teamName)}"]`);
  const value=(input?.value||"").trim();
  if(!value){errorDiv.textContent="투자 포인트를 입력해주세요";return}
  if(!/^\d+$/.test(value)){errorDiv.textContent="숫자만 입력해주세요";return}
  const amount=parseInt(value,10);
  if(amount<=0){errorDiv.textContent="0보다 큰 금액을 입력해주세요";return}
  const{spentByParticipant:s}=computeAggregates();
  const participant=state.participants.find(p=>String(p["참여자명"]??"").trim()===selectedParticipantName);
  if(!participant)return showToast("참여자 정보를 찾을 수 없습니다",true);
  const base=n(participant["기본포인트"]),spent=s.get(selectedParticipantName)||0,remain=base-spent;
  if(amount>remain){showToast("포인트가 부족합니다",true);return}
  button.disabled=true;button.textContent="처리중...";
  await withLoading(async()=>{
    try{
      const resp=await apiPost("invest",{participantName:selectedParticipantName,teamName,amount});
      if(!resp.success){
        if(resp.error==="insufficient points")showToast("포인트가 부족합니다",true);
        else if(resp.error==="participant not found")showToast("참여자 정보를 찾을 수 없습니다",true);
        else if(resp.error==="team not found")showToast("팀 정보를 찾을 수 없습니다",true);
        else showToast("투자에 실패했습니다",true);
        await loadFromSheet();renderParticipantPage();return;
      }
      await loadFromSheet();input.value="";errorDiv.textContent="";renderParticipantPage();showToast("투자가 완료되었습니다 ✓");
    }catch(e){console.error(e);showToast("투자에 실패했습니다",true)}
    finally{button.disabled=false;button.textContent="투자하기"}
  },"투자 반영중...");
}

(async function init(){
  const saved=sessionStorage.getItem("selectedParticipantName");
  if(saved){
    selectedParticipantName=saved;
    document.getElementById("entryModal").style.display="none";
    document.getElementById("participantPage").style.display="block";
    await withLoading(async()=>{
      try{
        await loadFromSheet();
        const exists=state.participants.some(p=>String(p["참여자명"]??"").trim()===saved);
        if(!exists){resetToEntry();return}
        const p=state.participants.find(x=>String(x["참여자명"]??"").trim()===saved);
        selectedParticipantTeam=String(p?.["소속팀"]??"").trim();
        await initParticipantPage();
      }catch(e){console.error(e);resetToEntry()}
    },"화면 준비중...");
  }else{resetToEntry()}
})();
