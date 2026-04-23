// ================================================================
//  ★ 여기만 수정하세요 ★
//  앱스 스크립트 배포 후 받은 웹앱 URL을 아래에 붙여넣으세요.
// ================================================================
const API_URL = "https://script.google.com/macros/s/AKfycbx01uwjX9TGc6GMAhb-27jDGwjOhWJqTgtF-rQCP4YHV-_537Q04hHJ_jLCX9Rl3b2P/exec";
// ================================================================

let state = { teams: [], investors: [], investments: [], ranking: [] };
let selectedSeq  = "";  // 선택된 투자자 연번
let selectedName = "";  // 선택된 투자자명
let selectedTeam = "";  // 선택된 투자자 소속팀
let adminPassword = "";
let loadingCount = 0;

// ===== UI Helpers =====
function showToast(msg, isError = false) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = "toast show" + (isError ? " error" : "");
  setTimeout(() => el.className = "toast", 1800);
}
function showLoading(msg = "로딩중...") {
  loadingCount += 1;
  const ov = document.getElementById("loadingOverlay");
  ov.querySelector(".loading-text").textContent = msg;
  ov.style.display = "flex";
}
function hideLoading() {
  loadingCount = Math.max(0, loadingCount - 1);
  if (loadingCount === 0) document.getElementById("loadingOverlay").style.display = "none";
}
async function withLoading(fn, msg = "로딩중...") {
  showLoading(msg);
  try { return await fn(); }
  finally { hideLoading(); }
}
function n(v) { const x = Number(v); return Number.isFinite(x) ? x : 0; }
function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;")
    .replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
}
function cssEscape(s) { return String(s).replace(/\\/g,"\\\\").replace(/"/g,'\\"'); }
function toISO(v) { const d = new Date(v); return Number.isNaN(d.getTime()) ? String(v ?? "") : d.toISOString(); }
function formatDateKOR(v) { const d = new Date(v); return Number.isNaN(d.getTime()) ? String(v ?? "") : d.toLocaleString("ko-KR"); }
function getInitialChar(name) { return String(name || "?").charAt(0).toUpperCase(); }

// ===== API =====
async function apiGetInit() {
  const r = await fetch(`${API_URL}?action=init`, { method: "GET" });
  if (!r.ok) throw new Error(`init failed: ${r.status}`);
  return r.json();
}
async function apiPost(action, payload) {
  const r = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, ...payload }),
  });
  if (!r.ok) throw new Error(`post failed: ${r.status}`);
  return r.json();
}

// ===== 집계 =====
function computeAggregates() {
  const spentByInvestor = new Map(); // key: "투자자명|소속팀"
  const raisedByTeam    = new Map();
  const backersByTeam   = new Map();

  for (const inv of state.investments) {
    const name  = String(inv["투자자명"]   ?? "").trim();
    const iTeam = String(inv["투자자팀명"] ?? "").trim();
    const tTeam = String(inv["피투자팀명"] ?? "").trim();
    const amt   = n(inv["투자금액"] ?? 0);
    if (!name || !tTeam || amt <= 0) continue;

    const investorKey = name + "|" + iTeam;
    spentByInvestor.set(investorKey, (spentByInvestor.get(investorKey) || 0) + amt);
    raisedByTeam.set(tTeam, (raisedByTeam.get(tTeam) || 0) + amt);
    if (!backersByTeam.has(tTeam)) backersByTeam.set(tTeam, new Set());
    backersByTeam.get(tTeam).add(investorKey);
  }
  return { spentByInvestor, raisedByTeam, backersByTeam };
}

async function loadFromSheet() {
  const data = await apiGetInit();
  if (data.error) throw new Error(data.error);
  state.teams       = Array.isArray(data.teams)       ? data.teams       : [];
  state.investors   = Array.isArray(data.investors)   ? data.investors   : [];
  state.investments = Array.isArray(data.investments) ? data.investments : [];
  state.ranking     = Array.isArray(data.ranking)     ? data.ranking     : [];
}

// ===== Entry =====
function resetToEntry() {
  selectedSeq = ""; selectedName = ""; selectedTeam = ""; adminPassword = "";
  sessionStorage.removeItem("selectedInvestorKey");
  document.getElementById("investorPage").style.display  = "none";
  document.getElementById("adminPage").style.display     = "none";
  document.getElementById("passwordModal").style.display = "none";
  document.getElementById("entryModal").style.display    = "flex";
  document.getElementById("entryStepInvestor").style.display = "none";
  document.getElementById("entryStepType").style.display = "block";
  document.getElementById("entryInvestorSelect").innerHTML = `<option value="">불러오는 중...</option>`;
  document.getElementById("passwordInput").value = "";
  document.getElementById("passwordError").textContent = "";
}

document.getElementById("adminBtn").addEventListener("click", () => {
  document.getElementById("entryModal").style.display    = "none";
  document.getElementById("passwordModal").style.display = "flex";
});
document.getElementById("investorBtn").addEventListener("click", async () => {
  document.getElementById("entryStepType").style.display     = "none";
  document.getElementById("entryStepInvestor").style.display = "block";
  await withLoading(fillInvestorDropdown, "투자자 목록 불러오는 중...");
});
document.getElementById("entryInvestorBack").addEventListener("click", () => {
  document.getElementById("entryStepInvestor").style.display = "none";
  document.getElementById("entryStepType").style.display     = "block";
});
document.getElementById("entryInvestorEnter").addEventListener("click", async () => {
  const val = document.getElementById("entryInvestorSelect").value;
  if (!val) return showToast("투자자를 선택해주세요", true);
  const [seq, name, team] = val.split("|");
  selectedSeq = seq; selectedName = name; selectedTeam = team;
  sessionStorage.setItem("selectedInvestorKey", val);
  document.getElementById("entryModal").style.display   = "none";
  document.getElementById("investorPage").style.display = "block";
  await withLoading(initInvestorPage, "화면 준비중...");
});

document.getElementById("passwordCancel").addEventListener("click", () => resetToEntry());
document.getElementById("passwordSubmit").addEventListener("click", async () => {
  const pw  = document.getElementById("passwordInput").value.trim();
  const err = document.getElementById("passwordError");
  if (!pw) { err.textContent = "비밀번호를 입력해주세요"; return; }
  await withLoading(async () => {
    try {
      const resp = await apiPost("adminLogin", { password: pw });
      if (!resp.success) { err.textContent = "비밀번호가 일치하지 않습니다"; return; }
      adminPassword = pw; err.textContent = "";
      document.getElementById("passwordModal").style.display = "none";
      document.getElementById("adminPage").style.display     = "block";
      await initAdminPage();
    } catch (e) { console.error(e); err.textContent = "로그인에 실패했습니다"; }
  }, "로그인중...");
});
document.getElementById("passwordInput").addEventListener("keypress", e => {
  if (e.key === "Enter") document.getElementById("passwordSubmit").click();
});

// ===== Tabs =====
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab + "Tab").classList.add("active");
  });
});

// ===== Dropdown =====
async function fillInvestorDropdown() {
  try {
    await loadFromSheet();
    const sel = document.getElementById("entryInvestorSelect");
    sel.innerHTML = `<option value="">투자자를 선택하세요</option>`;
    state.investors.forEach(p => {
      const seq  = String(p["연번"]     ?? "").trim();
      const name = String(p["투자자명"] ?? "").trim();
      const team = String(p["소속팀"]   ?? "").trim();
      if (!name) return;
      const opt = document.createElement("option");
      opt.value = `${seq}|${name}|${team}`;
      // 이름이 같은 사람이 있을 수 있으므로 소속팀도 표시
      opt.textContent = team ? `${name} (${team})` : name;
      sel.appendChild(opt);
    });
  } catch (e) {
    console.error(e);
    document.getElementById("entryInvestorSelect").innerHTML = `<option value="">불러오기 실패</option>`;
    showToast("투자자 목록을 불러오지 못했습니다", true);
  }
}

// ===== Admin Page =====
async function initAdminPage() {
  await loadFromSheet();
  document.getElementById("lastSyncText").textContent = `마지막 동기화: ${new Date().toLocaleString("ko-KR")}`;
  renderAdminAll();
}
document.getElementById("syncBtn").addEventListener("click", async () => {
  await withLoading(async () => {
    try { await initAdminPage(); showToast("불러오기 완료"); }
    catch (e) { console.error(e); showToast("불러오기에 실패했습니다", true); }
  }, "불러오는 중...");
});
function renderAdminAll() { renderTeamsTable(); renderInvestorsTable(); renderInvestmentsTable(); renderRankingTable(); }

function renderRankingTable() {
  const tbody = document.querySelector("#rankingTable tbody");
  tbody.innerHTML = "";
  const rows = state.ranking;

  if (rows.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="4" style="text-align:center;color:var(--ink-muted);padding:20px;">데이터 없음</td>`;
    tbody.appendChild(tr);
    return;
  }

  rows.forEach((r, i) => {
    const rank    = n(r["순위"]);
    const name    = String(r["팀명"]       ?? "").trim();
    const pts     = n(r["모인포인트"]);
    const backers = n(r["투자자수"]);
    const medal   = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="font-weight:800;font-size:15px;">${medal} ${rank}</td>
      <td style="font-weight:700;">${escapeHtml(name)}</td>
      <td style="font-weight:800;color:var(--blue);">${pts.toLocaleString()} P</td>
      <td>${backers}명</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderTeamsTable() {
  const tbody = document.querySelector("#teamsTable tbody");
  tbody.innerHTML = "";
  const { raisedByTeam, backersByTeam } = computeAggregates();
  state.teams.forEach((t, i) => {
    const name    = String(t["팀명"] ?? "").trim();
    const raised  = raisedByTeam.get(name) || 0;
    const backers = backersByTeam.has(name) ? backersByTeam.get(name).size : 0;
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><input type="text" value="${escapeHtml(name)}" data-type="team" data-field="팀명" data-index="${i}"></td>
      <td><textarea data-type="team" data-field="주제" data-index="${i}">${escapeHtml(t["주제"] ?? "")}</textarea></td>
      <td><textarea data-type="team" data-field="세부설명" data-index="${i}">${escapeHtml(t["세부설명"] ?? "")}</textarea></td>
      <td><input type="text" value="${escapeHtml(t["이미지파일명"] ?? "")}" data-type="team" data-field="이미지파일명" data-index="${i}" placeholder="예: team1.jpg"></td>
      <td><input type="number" class="readonly" value="${raised}" readonly></td>
      <td><input type="number" class="readonly" value="${backers}" readonly></td>
      <td><button class="delete-row-btn" data-index="${i}">삭제</button></td>
    `;
    tbody.appendChild(row);
  });
  tbody.querySelectorAll(".delete-row-btn").forEach(btn =>
    btn.addEventListener("click", e => { state.teams.splice(parseInt(e.target.dataset.index,10),1); renderTeamsTable(); })
  );
  tbody.querySelectorAll("[data-type='team']").forEach(inp =>
    inp.addEventListener("input", e => { state.teams[parseInt(e.target.dataset.index,10)][e.target.dataset.field] = e.target.value; })
  );
}

function renderInvestorsTable() {
  const tbody = document.querySelector("#investorsTable tbody");
  tbody.innerHTML = "";
  const { spentByInvestor } = computeAggregates();
  state.investors.forEach((p, i) => {
    const seq    = String(p["연번"]     ?? (i+1)).trim();
    const name   = String(p["투자자명"] ?? "").trim();
    const team   = String(p["소속팀"]   ?? "").trim();
    const base   = n(p["기본포인트"]);
    const spent  = spentByInvestor.get(name + "|" + team) || 0;
    const remain = base - spent;
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><input type="text" value="${escapeHtml(seq)}" data-type="investor" data-field="연번" data-index="${i}"></td>
      <td><input type="text" value="${escapeHtml(name)}" data-type="investor" data-field="투자자명" data-index="${i}"></td>
      <td><input type="text" value="${escapeHtml(team)}" data-type="investor" data-field="소속팀" data-index="${i}"></td>
      <td><input type="number" value="${base}" data-type="investor" data-field="기본포인트" data-index="${i}"></td>
      <td><input type="number" class="readonly" value="${spent}" readonly></td>
      <td><input type="number" class="readonly" value="${remain}" readonly></td>
      <td><button class="delete-row-btn" data-index="${i}">삭제</button></td>
    `;
    tbody.appendChild(row);
  });
  tbody.querySelectorAll(".delete-row-btn").forEach(btn =>
    btn.addEventListener("click", e => { state.investors.splice(parseInt(e.target.dataset.index,10),1); renderInvestorsTable(); })
  );
  tbody.querySelectorAll("[data-type='investor']").forEach(inp =>
    inp.addEventListener("input", e => {
      const idx = parseInt(e.target.dataset.index,10), field = e.target.dataset.field;
      state.investors[idx][field] = (field === "기본포인트") ? n(e.target.value) : e.target.value;
    })
  );
}

function renderInvestmentsTable() {
  const tbody = document.querySelector("#investmentsTable tbody");
  tbody.innerHTML = "";
  state.investments.forEach(inv => {
    const tsRaw      = inv["일시"];
    const tsIso      = toISO(tsRaw);
    const invName    = String(inv["투자자명"]   ?? "").trim();
    const invTeam    = String(inv["투자자팀명"] ?? "").trim();
    const targetTeam = String(inv["피투자팀명"] ?? "").trim();
    const amount     = n(inv["투자금액"] ?? 0);
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(formatDateKOR(tsRaw))}</td>
      <td>${escapeHtml(invName)}</td>
      <td>${escapeHtml(invTeam)}</td>
      <td>${escapeHtml(targetTeam)}</td>
      <td>${amount.toLocaleString()}</td>
      <td><button class="delete-row-btn">삭제</button></td>
    `;
    tbody.appendChild(row);
    row.querySelector(".delete-row-btn").addEventListener("click", async () => {
      if (!confirm("이 투자내역을 삭제할까요?")) return;
      await withLoading(async () => {
        try {
          const resp = await apiPost("deleteInvestment", { password: adminPassword, ts: tsIso, investorName: invName, investorTeam: invTeam, targetTeam, amount });
          if (!resp.success) throw new Error(resp.error || "delete failed");
          await loadFromSheet(); renderAdminAll(); showToast("삭제되었습니다");
        } catch (e) { console.error(e); showToast("삭제에 실패했습니다", true); }
      }, "삭제 처리중...");
    });
  });
}

document.getElementById("addTeamBtn").addEventListener("click", () => {
  state.teams.push({ "팀명":"","주제":"","세부설명":"","이미지파일명":"" });
  renderTeamsTable();
});
document.getElementById("addInvestorBtn").addEventListener("click", () => {
  state.investors.push({ "연번": String(state.investors.length+1), "투자자명":"","소속팀":"","기본포인트":0 });
  renderInvestorsTable();
});

document.getElementById("saveAdminBtn").addEventListener("click", async () => {
  const saveBtn = document.getElementById("saveAdminBtn");
  await withLoading(async () => {
    try {
      const teamNames = new Set();
      for (const t of state.teams) {
        const name = String(t["팀명"] ?? "").trim();
        if (!name) return showToast("팀명을 입력해주세요", true);
        if (teamNames.has(name)) return showToast(`팀명 중복: ${name}`, true);
        teamNames.add(name);
      }
      const seqs = new Set();
      for (const p of state.investors) {
        const name = String(p["투자자명"] ?? "").trim();
        const seq  = String(p["연번"]     ?? "").trim();
        if (!name) return showToast("투자자명을 입력해주세요", true);
        if (!seq)  return showToast("연번을 입력해주세요", true);
        if (seqs.has(seq)) return showToast(`연번 중복: ${seq}`, true);
        seqs.add(seq);
      }
      saveBtn.disabled = true; saveBtn.textContent = "저장중...";
      const r1 = await apiPost("saveTeams",     { password: adminPassword, teams:     state.teams });
      if (!r1.success) throw new Error(r1.error || "saveTeams failed");
      const r2 = await apiPost("saveInvestors", { password: adminPassword, investors: state.investors });
      if (!r2.success) throw new Error(r2.error || "saveInvestors failed");
      await loadFromSheet(); renderAdminAll(); showToast("저장되었습니다");
    } catch (e) { console.error(e); showToast("저장에 실패했습니다", true); }
    finally { saveBtn.disabled = false; saveBtn.textContent = "저장하기"; }
  }, "저장중...");
});

document.getElementById("clearInvestmentsBtn").addEventListener("click", async () => {
  if (!confirm("모든 투자내역을 삭제하시겠습니까?")) return;
  await withLoading(async () => {
    try {
      const r = await apiPost("clearInvestments", { password: adminPassword });
      if (!r.success) throw new Error(r.error || "clear failed");
      await loadFromSheet(); renderAdminAll(); showToast("투자내역이 모두 삭제되었습니다");
    } catch (e) { console.error(e); showToast("전체 삭제에 실패했습니다", true); }
  }, "전체 삭제중...");
});

// ===== Investor Page =====
async function initInvestorPage() {
  if (state.investors.length === 0) await loadFromSheet();
  const investor = state.investors.find(p =>
    String(p["연번"]     ?? "").trim() === selectedSeq &&
    String(p["투자자명"] ?? "").trim() === selectedName
  );
  if (!investor) { showToast("투자자 정보를 찾을 수 없습니다", true); resetToEntry(); return; }

  selectedTeam = String(investor["소속팀"] ?? "").trim();
  document.getElementById("fixedInvestorName").textContent = selectedName;
  document.getElementById("fixedInvestorTeam").textContent = selectedTeam || "-";
  document.getElementById("investorAvatar").textContent   = getInitialChar(selectedName);
  document.getElementById("investorResetBtn").onclick      = () => resetToEntry();
  renderInvestorPage();
}

function renderInvestorPage() {
  const { spentByInvestor } = computeAggregates();
  const investor = state.investors.find(p =>
    String(p["연번"]     ?? "").trim() === selectedSeq &&
    String(p["투자자명"] ?? "").trim() === selectedName
  );
  if (!investor) return;

  const base   = n(investor["기본포인트"]);
  const spent  = spentByInvestor.get(selectedName + "|" + selectedTeam) || 0;
  const remain = base - spent;

  document.getElementById("basePoints").textContent   = base.toLocaleString();
  document.getElementById("spentPoints").textContent  = spent.toLocaleString();
  document.getElementById("remainPoints").textContent = remain.toLocaleString();
  document.getElementById("pointsCard").style.display = "flex";

  renderMyInvestSummary();
  renderTeamCards();
}

function renderMyInvestSummary() {
  const wrap = document.getElementById("myInvestSummary");
  const list = document.getElementById("myInvestList");
  const invs = state.investments
    .filter(inv =>
      String(inv["투자자명"]   ?? "").trim() === selectedName &&
      String(inv["투자자팀명"] ?? "").trim() === selectedTeam
    )
    .map(inv => ({ team: String(inv["피투자팀명"] ?? "").trim(), amt: n(inv["투자금액"] ?? 0) }))
    .filter(x => x.team && x.amt > 0);

  if (invs.length === 0) { wrap.style.display = "none"; return; }
  const sum = new Map();
  for (const x of invs) sum.set(x.team, (sum.get(x.team) || 0) + x.amt);
  wrap.style.display = "block"; list.innerHTML = "";
  [...sum.entries()].forEach(([team, total]) => {
    const row = document.createElement("div");
    row.className = "my-invest-row";
    row.innerHTML = `<div class="mi-team">${escapeHtml(team)}</div><div class="mi-amt">${Number(total).toLocaleString()} P</div>`;
    list.appendChild(row);
  });
}

function renderTeamCards() {
  const container = document.getElementById("teamsContainer");
  container.innerHTML = "";
  const { raisedByTeam, backersByTeam } = computeAggregates();

  state.teams.forEach(team => {
    const teamName = String(team["팀명"]     ?? "").trim();
    const topic    = String(team["주제"]      ?? "");
    const detail   = String(team["세부설명"] ?? "");
    const imageUrl = String(team["이미지URL"] ?? "").trim();
    const raised   = raisedByTeam.get(teamName) || 0;
    const backers  = backersByTeam.has(teamName) ? backersByTeam.get(teamName).size : 0;
    const isOwnTeam = selectedTeam && selectedTeam === teamName;

    const imageHtml = imageUrl
      ? `<img class="team-image" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(teamName)}" loading="lazy">`
      : `<div class="team-image-placeholder">이미지 없음</div>`;

    const card = document.createElement("div");
    card.className = "team-card";
    card.innerHTML = `
      ${imageHtml}
      <div class="team-card-body">
        <div class="team-header">
          <div class="team-name">${escapeHtml(teamName)}</div>
          <div class="team-badge">투자자 ${backers}명 · ${raised.toLocaleString()}P</div>
        </div>
        <div class="team-grid">
          <div class="team-info-box"><div class="team-info-label">주제</div><div class="team-info-value">${escapeHtml(topic)}</div></div>
          <div class="team-info-box"><div class="team-info-label">세부설명</div><div class="team-info-value">${escapeHtml(detail)}</div></div>
        </div>
        <div class="investment-section">
          ${isOwnTeam
            ? `<div class="investment-notice blocked">⚠ 소속팀에는 투자할 수 없습니다</div>`
            : `<div class="investment-notice">한 번 투자하면 수정이 불가합니다. 신중하게 투자해주세요.</div>
               <div class="investment-row">
                 <input type="text" class="investment-input" placeholder="투자 포인트 입력" data-team="${escapeHtml(teamName)}" inputmode="numeric">
                 <button class="invest-btn" data-team="${escapeHtml(teamName)}">투자하기</button>
               </div>
               <div class="input-error" data-team="${escapeHtml(teamName)}"></div>`
          }
        </div>
      </div>
    `;

    if (!isOwnTeam) {
      const input = card.querySelector(".investment-input");
      const errorDiv = card.querySelector(".input-error");
      input.addEventListener("input", e => {
        const c = e.target.value.replace(/[^0-9]/g,"");
        if (e.target.value !== c) { e.target.value=c; errorDiv.textContent="숫자만 입력해주세요"; e.target.classList.add("error"); }
        else { errorDiv.textContent=""; e.target.classList.remove("error"); }
      });
      card.querySelector(".invest-btn").addEventListener("click", async () => await handleInvestment(teamName));
    }
    container.appendChild(card);
  });
}

async function handleInvestment(targetTeamName) {
  const input    = document.querySelector(`.investment-input[data-team="${cssEscape(targetTeamName)}"]`);
  const button   = document.querySelector(`.invest-btn[data-team="${cssEscape(targetTeamName)}"]`);
  const errorDiv = document.querySelector(`.input-error[data-team="${cssEscape(targetTeamName)}"]`);
  const value    = (input?.value || "").trim();

  if (!value)               { errorDiv.textContent="투자 포인트를 입력해주세요"; return; }
  if (!/^\d+$/.test(value)) { errorDiv.textContent="숫자만 입력해주세요"; return; }
  const amount = parseInt(value, 10);
  if (amount <= 0) { errorDiv.textContent="0보다 큰 금액을 입력해주세요"; return; }

  const { spentByInvestor } = computeAggregates();
  const investor = state.investors.find(p =>
    String(p["연번"]     ?? "").trim() === selectedSeq &&
    String(p["투자자명"] ?? "").trim() === selectedName
  );
  if (!investor) return showToast("투자자 정보를 찾을 수 없습니다", true);

  const base  = n(investor["기본포인트"]);
  const spent = spentByInvestor.get(selectedName + "|" + selectedTeam) || 0;
  if (amount > base - spent) { showToast("포인트가 부족합니다", true); return; }

  button.disabled = true; button.textContent = "처리중...";
  await withLoading(async () => {
    try {
      const resp = await apiPost("invest", {
        investorSeq: selectedSeq, investorName: selectedName,
        investorTeam: selectedTeam, targetTeamName, amount,
      });
      if (!resp.success) {
        if      (resp.error === "insufficient points")      showToast("포인트가 부족합니다", true);
        else if (resp.error === "investor not found")       showToast("투자자 정보를 찾을 수 없습니다", true);
        else if (resp.error === "team not found")           showToast("팀 정보를 찾을 수 없습니다", true);
        else if (resp.error === "cannot invest in own team") showToast("소속팀에는 투자할 수 없습니다", true);
        else showToast("투자에 실패했습니다", true);
        await loadFromSheet(); renderInvestorPage(); return;
      }
      await loadFromSheet();
      input.value = ""; errorDiv.textContent = "";
      renderInvestorPage(); showToast("투자가 완료되었습니다 ✓");
    } catch (e) { console.error(e); showToast("투자에 실패했습니다", true); }
    finally { button.disabled = false; button.textContent = "투자하기"; }
  }, "투자 반영중...");
}

// ===== 시작: 새로고침 시 투자자 복원 =====
(async function init() {
  const saved = sessionStorage.getItem("selectedInvestorKey");
  if (saved) {
    const [seq, name, team] = saved.split("|");
    selectedSeq = seq; selectedName = name; selectedTeam = team;
    document.getElementById("entryModal").style.display   = "none";
    document.getElementById("investorPage").style.display = "block";
    await withLoading(async () => {
      try {
        await loadFromSheet();
        const exists = state.investors.some(p =>
          String(p["연번"]     ?? "").trim() === seq &&
          String(p["투자자명"] ?? "").trim() === name
        );
        if (!exists) { resetToEntry(); return; }
        await initInvestorPage();
      } catch (e) { console.error(e); resetToEntry(); }
    }, "화면 준비중...");
  } else {
    resetToEntry();
  }
})();
