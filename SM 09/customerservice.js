// ============================================================
// customerservice.js v3 — Customer Service Reviews Module
// Changes: Clean attempt workflow — hide/show based on selection
//          4 terminal statuses: Completed, Declined, No Show, Unreachable
//          No Show added (customer agreed but didn't join)
//          Form fields hidden until user makes a choice
// ============================================================

(function () {
    var style = document.createElement('style');
    style.textContent = `
    #customerServiceView .cs-status-badge {
        padding:5px 10px;border-radius:8px;font-size:11px;font-weight:700;
        text-transform:uppercase;letter-spacing:0.4px;
        display:inline-flex;align-items:center;gap:5px;white-space:nowrap;
    }
    #customerServiceView .cs-badge-completed      { background:rgba(16,185,129,0.12);color:#10b981;border:1px solid rgba(16,185,129,0.25); }
    #customerServiceView .cs-badge-in-progress    { background:rgba(245,158,11,0.12);color:var(--warning);border:1px solid rgba(245,158,11,0.25); }
    #customerServiceView .cs-badge-pending        { background:var(--chip);color:var(--t3);border:1px solid var(--border); }
    #customerServiceView .cs-badge-overdue        { background:rgba(239,68,68,0.12);color:var(--danger);border:1px solid rgba(239,68,68,0.25); }
    #customerServiceView .cs-badge-not-applicable { background:var(--chip);color:var(--t3);border:1px solid var(--border); }
    #customerServiceView .cs-badge-customer-declined { background:var(--chip);color:var(--t3);border:1px solid var(--border); }
    #customerServiceView .cs-badge-failed         { background:rgba(220,38,38,0.12);color:#dc2626;border:1px solid rgba(220,38,38,0.25); }
    #customerServiceView .cs-badge-unreachable    { background:rgba(220,38,38,0.12);color:#dc2626;border:1px solid rgba(220,38,38,0.25); }
    #customerServiceView .cs-badge-no-show        { background:rgba(245,158,11,0.12);color:#b45309;border:1px solid rgba(245,158,11,0.28); }
    #customerServiceView .cs-type-badge { padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;color:#fff;display:inline-block;text-transform:uppercase;letter-spacing:0.3px; }
    #customerServiceView .cs-type-msr  { background:var(--grad); }
    #customerServiceView .cs-type-qsr  { background:linear-gradient(135deg,var(--acc),var(--acc2)); }
    #customerServiceView .cs-tab-active { background:var(--grad) !important;color:#fff !important;border-color:transparent !important;box-shadow:0 2px 10px var(--glow); }

    /* Top filters (match the structured style like s.js) */
    #customerServiceView .filters-section{
        background:var(--bg-card);
        border:1px solid var(--border);
        border-radius:16px;
        padding:14px;
        margin:10px 0 14px;
        box-shadow:var(--ch);
        position:relative;
        z-index:50;
    }
    #customerServiceView .filters-grid{
        display:grid;
        grid-template-columns:repeat(auto-fit,minmax(170px,1fr));
        gap:10px;
        align-items:end;
    }
    #customerServiceView .filter-group{ display:flex; flex-direction:column; gap:6px; }
    #customerServiceView .filter-label{
        font-size:11px;font-weight:800;color:var(--t3);
        text-transform:uppercase;letter-spacing:.06em;
    }
    #customerServiceView .filter-select{
        padding:10px 12px;border:1.5px solid var(--border);border-radius:12px;
        background:var(--bg-input);color:var(--t1);font-size:13px;
        outline:none;
    }
    #customerServiceView .filter-select:focus{
        border-color:var(--acc);
        box-shadow:0 0 0 3px rgba(76,111,255,0.12);
    }
    #customerServiceView .filter-actions{
        display:flex;gap:10px;margin-top:12px;padding-top:12px;border-top:1px solid var(--border);
    }

    /* Status multiselect (like s.js) */
    #customerServiceView .custom-multiselect{ position:relative; z-index:60; }
    #customerServiceView .multiselect-selected{
        padding:10px 12px;border:1.5px solid var(--border);border-radius:12px;
        background:var(--bg-input);color:var(--t1);font-size:13px;cursor:pointer;
        display:flex;align-items:center;justify-content:space-between;gap:10px;
    }
    #customerServiceView .multiselect-selected:hover{ border-color:var(--acc); }
    #customerServiceView .multiselect-dropdown{
        position:absolute;top:100%;left:0;right:0;margin-top:6px;
        background:var(--bg-card);border:1.5px solid var(--border);border-radius:12px;
        box-shadow:var(--ch);max-height:240px;overflow-y:auto;z-index:9999;
    }
    #customerServiceView .multiselect-option{
        padding:9px 12px;display:flex;align-items:center;gap:10px;
        cursor:pointer;transition:background .15s;
    }
    #customerServiceView .multiselect-option:hover{ background:rgba(76,111,255,0.08); }
    #customerServiceView .multiselect-option input{ width:16px;height:16px;cursor:pointer; }
    #customerServiceView .multiselect-option label{ cursor:pointer; flex:1; font-size:13px; color:var(--t1); }

    /* Hide legacy table filter row controls (keep only top filters) */
    #customerServiceView #csReviewTypeFilter,
    #customerServiceView #csStatusFilter{
        display:none !important;
    }

    /* AG Grid set filter — same as SM dashboard */
    .sm-ag-set-filter { padding:.5rem; min-width:200px; max-width:260px; }
    .sm-ag-set-search { width:100%; box-sizing:border-box; margin-bottom:.45rem; padding:.35rem .5rem; border:1px solid var(--border, var(--border-color, #e2e8f0)); border-radius:8px; font-size:.75rem; background:var(--bg-card, #fff); color:var(--t1, var(--text-primary, #1e293b)); }
    .sm-ag-set-list { max-height:180px; overflow-y:auto; display:flex; flex-direction:column; gap:.2rem; }
    .sm-ag-set-option { display:flex; align-items:center; gap:.35rem; font-size:.75rem; cursor:pointer; padding:.15rem 0; color:var(--t1, var(--text-primary, #1e293b)); }
    .sm-ag-set-actions { display:flex; gap:.35rem; margin-top:.45rem; }
    .sm-ag-set-actions button { flex:1; padding:.25rem .4rem; font-size:.68rem; font-weight:700; border:1px solid var(--border, var(--border-color, #e2e8f0)); border-radius:6px; background:var(--chip, rgba(168,85,247,.08)); color:var(--acc, #a855f7); cursor:pointer; }
    `;
    document.head.appendChild(style);
})();

// ─── GLOBALS ───────────────────────────────────────────────────────────────────
var CS_SP_URL = 'http://sharedspaces:8086/sites/SM';
var CS_ACCOUNTS = [];
var CS_REVIEWS = [];
var CS_HEALTH_CHECKS = [];
var CS_ACCESS_CONTROL = [];
var CS_USER_CONTEXT = { userName: '', userEmail: '', role: 'SM', userTeam: null, selectedLM: null, selectedSM: null, statusFilter: null };
var CS_ACTIVE_TAB = 'MSR';
var csTrendChart = null;
var csCompletionChart = null;
var csGridApi = null;
var csHCGridApi = null;
var CS_DATA_LOADED = false;
var CS_CHARTS_VISIBLE = false;
var CS_REVIEWS_LIST  = 'MSR_QSR_Reviews';
var CS_ACCOUNTS_LIST = 'Service Manager Request';
var CS_HEALTH_LIST   = 'Health_Check_Reviews';
var _csUserIdCache = {};
// Disable datalabels plugin for all CS charts

async function csResolveUserId(name) {
    if (!name) return null;
    if (_csUserIdCache[name]) return _csUserIdCache[name];
    try {
        const id = await getUserId(name);
        _csUserIdCache[name] = id;
        return id;
    } catch(e) {
        console.warn('[CS] Could not resolve user ID for:', name);
        return null;
    }
}
// ─── SHOW / HIDE ───────────────────────────────────────────────────────────────
window.showCustomerService = function () {
    if (typeof analyticsTrackPage === 'function') analyticsTrackPage('Customer Service');
    switchDashboardSection('cs-view');
    var csView = document.getElementById('customerServiceView');
    if (csView) { csView.style.display = 'block'; csView.style.position = ''; csView.style.zIndex = ''; }
    var mainDate = document.getElementById('currentDate');
    var csDate   = document.getElementById('csCurrentDate');
    if (csDate && mainDate) csDate.textContent = mainDate.textContent;
    if (!CS_DATA_LOADED) {
        csFetchSharePointData();
    } else {
        document.getElementById('csLoadingScreen').style.display = 'none';
        document.getElementById('csMainContent').style.display = 'block';
        csInitTabs();
        csRenderBreadcrumb();
        csRefreshMSRQSRDashboard();
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
};

window.showCSBack = function () {
    document.getElementById('customerServiceView').style.display = 'none';
    if (typeof switchDashboardSection === 'function') switchDashboardSection('dashboard-view');
};

// ─── DATA FETCH ────────────────────────────────────────────────────────────────
async function csFetchSharePointData() {
    try {
        await csGetCurrentUser();
        await csFetchAccessControl();
        await csFetchAccounts();
        await csFetchReviews();
        await csFetchHealthChecks();
        csDetermineUserRole();
        console.log('[CS] Data loaded - Accounts:', CS_ACCOUNTS.length, 'Reviews:', CS_REVIEWS.length, 'Role:', CS_USER_CONTEXT.role, 'Team:', CS_USER_CONTEXT.userTeam);
        document.getElementById('csLoadingScreen').style.display = 'none';
        document.getElementById('csMainContent').style.display = 'block';
        csPopulateFilters();
        csInitTabs();
        csRenderBreadcrumb();
        csRefreshMSRQSRDashboard();
        CS_DATA_LOADED = true;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    } catch (err) {
        console.error('CS Dashboard Error:', err);
        document.getElementById('csLoadingScreen').innerHTML = `
            <div style="background:rgba(239,68,68,0.1);border:1px solid var(--danger);color:var(--danger);padding:20px;border-radius:12px;text-align:center;margin:40px auto;max-width:500px;">
                <div style="font-size:18px;font-weight:700;margin-bottom:8px;">Error Loading Dashboard</div>
                <div style="font-size:13px;">${err.message}</div>
            </div>`;
    }
}

async function csGetCurrentUser() {
    const res = await fetch(CS_SP_URL + '/_api/web/currentuser?$select=Title,Email', {
        headers: { 'Accept': 'application/json;odata=verbose' }, credentials: 'include'
    });
    if (!res.ok) throw new Error('Cannot get current user');
    const data = await res.json();
    CS_USER_CONTEXT.userName  = data.d.Title;
    CS_USER_CONTEXT.userEmail = data.d.Email;
    const nameEl = document.getElementById('csUserName');
    if (nameEl) nameEl.textContent = CS_USER_CONTEXT.userName;
}

async function csFetchAccessControl() {
    try {
        const res = await fetch(CS_SP_URL + "/_api/web/lists/getbytitle('Access_Control')/items?$select=Title,Role,UserEmailID&$top=20000", {
            headers: { 'Accept': 'application/json;odata=verbose' }, credentials: 'include'
        });
        if (!res.ok) return;
        const data = await res.json();
        CS_ACCESS_CONTROL = data.d.results.map(i => ({ title: i.Title || '', role: i.Role || '', email: i.UserEmailID || '' }));
    } catch (e) { console.warn('Access_Control fetch failed:', e.message); }
}

async function csFetchAccounts() {
    const url = CS_SP_URL + "/_api/web/lists/getbytitle('" + CS_ACCOUNTS_LIST + "')/items?" +
        "$select=Title,Customer_x0020_Name,Team,Service_Required,Line_x0020_Manager/Title,Service_x0020_Manager/Title,Request_x0020_Status,POC_x0020_Name,POC_x0020_Email_x0020_ID,POC_x0020_Contact_x0020_No&" +
        "$expand=Line_x0020_Manager,Service_x0020_Manager&" +
        "$filter=Request_x0020_Status eq 'OnBoarded' or Request_x0020_Status eq 'AM_Approved'&$top=20000";
    const res = await fetch(url, { headers: { 'Accept': 'application/json;odata=verbose' }, credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch accounts');
    const data = await res.json();
    CS_ACCOUNTS = data.d.results.map(item => ({
        code:           item.Title || '',
        customer:       item.Customer_x0020_Name || '',
        team:           item.Team || '',
        sm:             item.Service_x0020_Manager ? item.Service_x0020_Manager.Title : '',
        lm:             item.Line_x0020_Manager   ? item.Line_x0020_Manager.Title   : '',
        pocName:        item.POC_x0020_Name || '-',
        pocEmail:       item.POC_x0020_Email_x0020_ID || '-',
        pocContact:     item.POC_x0020_Contact_x0020_No || '-',
        serviceRequired: item.Service_Required || 'False'
    }));
}

// ─── FETCH REVIEWS (v2 — new columns) ─────────────────────────────────────────
async function csFetchReviews() {
    const url = CS_SP_URL + "/_api/web/lists/getbytitle('" + CS_REVIEWS_LIST + "')/items?" +
"$select=ID,Title,Account_Code,Review_Type,Review_Period,Review_Due_Date,Review_Status," +
        "Actual_Review_Date,Agreed_Date,Review_Notes,Action_Items,LM_Attended,Review_Mode,Customer_Eligibility,Eligibility_Reason," +
        "Attempt_1_Date,Attempt_1_Notes,Event_Ref_1,Customer_Reachable_1," +
        "Attempt_2_Date,Attempt_2_Notes,Event_Ref_2,Customer_Reachable_2," +
        "Attempt_3_Date,Attempt_3_Notes,Event_Ref_3,Customer_Reachable_3," +
        "Review_Date_Agreed&$top=20000";

    const res = await fetch(url, { headers: { 'Accept': 'application/json;odata=verbose' }, credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch reviews');
    const data = await res.json();

    CS_REVIEWS = data.d.results.map(item => ({
        id:           item.ID,
        period:       item.Review_Period    || '',
        accountCode:  item.Account_Code     || '',
        reviewType:   item.Review_Type      || 'MSR',
        status:       item.Review_Status    || 'Pending',
        reviewDate:   item.Actual_Review_Date ? new Date(item.Actual_Review_Date).toISOString().split('T')[0] : null,
        dueDate:      item.Review_Due_Date  ? new Date(item.Review_Due_Date).toISOString().split('T')[0]  : null,
        agreedDate:   item.Agreed_Date      ? new Date(item.Agreed_Date).toISOString().split('T')[0]      : null,
        reviewNotes:  item.Review_Notes     || '',
        actionItems:  item.Action_Items     || '',
        // Attempt 1
        attempt1Date:  item.Attempt_1_Date ? new Date(item.Attempt_1_Date).toISOString().split('T')[0] : '',
        attempt1Notes: item.Attempt_1_Notes || '',
       eventRef1:     item.Event_Ref_1     || '',
        reachable1:    (item.Customer_Reachable_1 === 'Yes' || item.Customer_Reachable_1 === 'No') ? item.Customer_Reachable_1 : '',
        // Attempt 2
        attempt2Date:  item.Attempt_2_Date ? new Date(item.Attempt_2_Date).toISOString().split('T')[0] : '',
        attempt2Notes: item.Attempt_2_Notes || '',
        eventRef2:     item.Event_Ref_2     || '',
        reachable2:    (item.Customer_Reachable_2 === 'Yes' || item.Customer_Reachable_2 === 'No') ? item.Customer_Reachable_2 : '',
        // Attempt 3
        attempt3Date:  item.Attempt_3_Date ? new Date(item.Attempt_3_Date).toISOString().split('T')[0] : '',
        attempt3Notes: item.Attempt_3_Notes || '',
        eventRef3:     item.Event_Ref_3     || '',
        reachable3:    (item.Customer_Reachable_3 === 'Yes' || item.Customer_Reachable_3 === 'No') ? item.Customer_Reachable_3 : '',
      // Agreement
        reviewDateAgreed: (item.Review_Date_Agreed === 'Yes' || item.Review_Date_Agreed === 'No') ? item.Review_Date_Agreed : '',
        lmAttended:       item.LM_Attended || '',
        reviewMode:       item.Review_Mode || '',
        eligibility:      item.Customer_Eligibility || '',
        eligibilityReason: item.Eligibility_Reason || ''
    }));

    // Auto-mark Failed if period deadline passed and still open
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    CS_REVIEWS.forEach(review => {
        if (['Completed','Not Applicable','Customer Declined','Failed','Unreachable','No Show'].includes(review.status)) return;
        const account = CS_ACCOUNTS.find(a => a.code === review.accountCode);
        if (!account) return;
        const isMSR = account.team === 'DSM';
        if (isMSR) {
            // MSR: fail after month ends — "Apr 2026" → fail after May 1
            const [month, year] = review.period.split(' ');
            const mi = MONTHS.indexOf(month);
            if (mi >= 0 && today >= new Date(parseInt(year), mi + 1, 1)) review.status = 'Failed';
        } else {
            // QSR Option C: period is "Q1 2026 - Jan"
            // Monthly record fails after that month ends
            // But also mark Failed if quarter has ended entirely
            const quarterLabel = csQuarterFromPeriod(review.period); // "Q1 2026"
            const [q, year] = quarterLabel.split(' ');
            const qNum = parseInt(q.replace('Q',''));
            const quarterEnd = new Date(parseInt(year), qNum * 3, 1); // first day AFTER quarter
            if (today >= quarterEnd) { review.status = 'Failed'; return; }

            // Also fail the monthly record if that specific month has passed
            if (review.period.includes(' - ')) {
                const monthStr = review.period.split(' - ')[1]; // "Jan"
                const mi = MONTHS.indexOf(monthStr);
                if (mi >= 0 && today >= new Date(parseInt(year), mi + 1, 1)) review.status = 'Failed';
            }
        }
    });
}

// ─── ROLE ──────────────────────────────────────────────────────────────────────
function csDetermineUserRole() {
    // Inherit TSM Manager flag from main USER_CONTEXT
    CS_USER_CONTEXT.isTSMManager = (window.USER_CONTEXT && window.USER_CONTEXT.isTSMManager) ? true : false;

    const rec = CS_ACCESS_CONTROL.find(a =>
        a.email.toLowerCase() === CS_USER_CONTEXT.userEmail.toLowerCase() ||
        a.title.toLowerCase() === CS_USER_CONTEXT.userName.toLowerCase()
    );
    if (rec) {
        if (rec.role === 'Admin')                                       { CS_USER_CONTEXT.role = 'SD'; }
        else if (rec.role === 'TSM Manager')                           { CS_USER_CONTEXT.role = 'SD'; CS_USER_CONTEXT.isTSMManager = true; }
        else if (rec.role === 'Line Manager' || rec.role === 'LM')     { CS_USER_CONTEXT.role = 'LM'; }
        else if (rec.role === 'Service Manager' || rec.role === 'SM')  { CS_USER_CONTEXT.role = 'SM'; }
    } else {
        if (CS_ACCOUNTS.some(a => a.lm === CS_USER_CONTEXT.userName))      { CS_USER_CONTEXT.role = 'LM'; }
        else if (CS_ACCOUNTS.some(a => a.sm === CS_USER_CONTEXT.userName)) { CS_USER_CONTEXT.role = 'SM'; }
        else                                                                { CS_USER_CONTEXT.role = 'SD'; }
    }
    if (CS_USER_CONTEXT.role === 'SD') {
        CS_USER_CONTEXT.userTeam = 'ALL';
    } else if (CS_USER_CONTEXT.role === 'SM') {
        const smAccounts = CS_ACCOUNTS.filter(a => a.sm === CS_USER_CONTEXT.userName);
        const hasDSM = smAccounts.some(a => a.team === 'DSM');
        const hasTSM = smAccounts.some(a => ['TSM_ME','TSM_SE'].includes(a.team));
        if (hasDSM && hasTSM) CS_USER_CONTEXT.userTeam = 'MIXED';
        else if (hasDSM) CS_USER_CONTEXT.userTeam = 'DSM';
        else if (hasTSM) CS_USER_CONTEXT.userTeam = smAccounts.find(a => ['TSM_ME','TSM_SE'].includes(a.team))?.team || null;
        else CS_USER_CONTEXT.userTeam = null;
    } else if (CS_USER_CONTEXT.role === 'LM') {
        const acct = CS_ACCOUNTS.find(a => a.lm === CS_USER_CONTEXT.userName);
        CS_USER_CONTEXT.userTeam = acct ? acct.team : null;
    }
}

// ─── TABS ──────────────────────────────────────────────────────────────────────
function csInitTabs() {
    const team    = CS_USER_CONTEXT.userTeam;
    const isAdmin = CS_USER_CONTEXT.role === 'SD';
    const dsmTeams = ['DSM'];
    const tsmTeams = ['TSM_ME','TSM_SE'];
const showMSR = (isAdmin && !CS_USER_CONTEXT.isTSMManager) || dsmTeams.includes(team) || team === 'MIXED';const showQSR = isAdmin || CS_USER_CONTEXT.isTSMManager || tsmTeams.includes(team) || team === 'MIXED';
const showHC  = isAdmin || CS_USER_CONTEXT.isTSMManager || tsmTeams.includes(team) || team === 'MIXED';
    const msrBtn = document.getElementById('csTabMSR');
    const qsrBtn = document.getElementById('csTabQSR');
    const hcBtn  = document.getElementById('csTabHC');
    if (msrBtn) msrBtn.style.display = showMSR ? 'inline-flex' : 'none';
    if (qsrBtn) qsrBtn.style.display = showQSR ? 'inline-flex' : 'none';
    if (hcBtn)  hcBtn.style.display  = showHC  ? 'inline-flex' : 'none';
    if (isAdmin || dsmTeams.includes(team) || team === 'MIXED') CS_ACTIVE_TAB = 'MSR';
    else if (tsmTeams.includes(team)) CS_ACTIVE_TAB = 'QSR';
    csSetTab(CS_ACTIVE_TAB);
}

window.csSetTab = function(tab) {
    CS_ACTIVE_TAB = tab;
    ['MSR','QSR','HC'].forEach(function(t) {
        const btn = document.getElementById('csTab' + t);
        if (!btn) return;
        if (t === tab) {
            btn.style.background = 'var(--grad)'; btn.style.color = '#fff';
            btn.style.borderColor = 'transparent'; btn.style.boxShadow = '0 2px 10px var(--glow)';
        } else {
            btn.style.background = 'var(--bg-input)'; btn.style.color = 'var(--t1)';
            btn.style.borderColor = 'var(--border)';  btn.style.boxShadow = '';
        }
    });
    const msrqsr = document.getElementById('csMSRQSRContent');
    const hc     = document.getElementById('csHCContent');
    if (msrqsr) msrqsr.style.display = tab !== 'HC' ? 'block' : 'none';
    if (hc)     hc.style.display     = tab === 'HC' ? 'block'  : 'none';
    const autoBtn = document.getElementById('csAutoCreateBtn');
    if (autoBtn) autoBtn.style.display = (CS_USER_CONTEXT.role === 'SD' && tab !== 'HC') ? 'inline-flex' : 'none';
    const hcAddBtn = document.getElementById('csHCAddBtn');
    if (hcAddBtn) hcAddBtn.style.display = (tab === 'HC') ? 'inline-flex' : 'none';
  if (tab === 'HC') {
        csRenderHCKPIs();
        csHCApplyFilters();
        // Inject toggle button + analytics section for HC
        var hcGrid = document.getElementById('csHCContent');
        if (hcGrid && !document.getElementById('csHCAnalyticsWrap')) {
            var analyticsDiv = document.createElement('div');
            analyticsDiv.id = 'csHCAnalyticsWrap';
            analyticsDiv.style.marginBottom = '1rem';
            analyticsDiv.innerHTML =
                '<div style="text-align:center;margin:1rem 0;">' +
                '<button type="button" class="export-btn" onclick="csToggleHCCharts()" style="padding:12px 24px;font-size:14px;">' +
                '<i data-lucide="eye" id="csHCChartsIcon" style="width:16px;height:16px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>' +
                '<span id="csHCChartsBtnText">Show Analytics Charts</span>' +
                '</button></div>' +
                '<div id="csHCChartsSection" style="display:none;"></div>';
            // Insert before the table section
            var tableSection = hcGrid.querySelector('.table-section');
            if (tableSection) hcGrid.insertBefore(analyticsDiv, tableSection);
            else hcGrid.insertBefore(analyticsDiv, hcGrid.firstChild);
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    }
    else {
        csPopulateFilters();
        csPlaceTopFiltersAtTop();
        csRefreshMSRQSRDashboard();
    }
if (typeof lucide !== 'undefined') lucide.createIcons();
};

// ─── FILTERS ───────────────────────────────────────────────────────────────────
var CS_TIME_FILTER_INIT = { MSR:false, QSR:false };
var CS_SELECTED_STATUSES = []; // multi-select status filter

function csPopulateFilters() {
    // Existing dropdown (kept for backwards compatibility)
    csUpdatePeriodFilter();
    // Top filters (Year/Quarter/Month/Week + MSR/QSR period key)
    csEnsureTopTimeFilters();
    csPlaceTopFiltersAtTop();
    csUpdateTopTimeFiltersOptions();
    csInitDefaultTopTimeFiltersForTab();
}

function csPlaceTopFiltersAtTop() {
    const section = document.getElementById('csTopFiltersSection');
    if (!section) return;
    // Place above KPIs/tiles so it filters everything
    const host = document.getElementById('csMSRQSRContent') || document.getElementById('csMainContent') || section.parentElement;
    const kpi  = document.getElementById('csKPISection');
    if (!host || !kpi) return;
    if (section.parentElement !== host || section.nextSibling !== kpi) {
        try { host.insertBefore(section, kpi); } catch(e) {}
    }
}

function csEnsureTopTimeFilters() {
    const periodEl = document.getElementById('csPeriodFilter');
    if (!periodEl) return; // HTML not present yet
    if (document.getElementById('csTopFiltersSection')) return;

    // Hide legacy "Period" dropdown but keep it in DOM for safety
    periodEl.style.display = 'none';

    const section = document.createElement('div');
    section.id = 'csTopFiltersSection';
    section.className = 'filters-section';

    section.innerHTML = `
        <div class="filters-grid">
            <div class="filter-group">
                <div class="filter-label">Year</div>
                <select class="filter-select" id="csFilterYear"></select>
            </div>
            <div class="filter-group">
                <div class="filter-label">Quarter</div>
                <select class="filter-select" id="csFilterQuarter"></select>
            </div>
            <div class="filter-group">
                <div class="filter-label">Month</div>
                <select class="filter-select" id="csFilterMonth"></select>
            </div>
            <div class="filter-group">
                <div class="filter-label">Week</div>
                <select class="filter-select" id="csFilterWeek"></select>
            </div>
            <div class="filter-group">
                <div class="filter-label">Status</div>
                <div class="custom-multiselect" id="csStatusMultiselect">
                    <div class="multiselect-selected" id="csStatusSelected" onclick="csToggleStatusDropdown()">
                        <span id="csStatusSelectedText">All Statuses</span>
                        <span style="opacity:.75;">▾</span>
                    </div>
                    <div class="multiselect-dropdown" id="csStatusDropdown" style="display:none;"></div>
                </div>
            </div>
        </div>
        <div class="filter-actions">
            <button type="button" class="reset-btn" onclick="csResetTopFilters()" style="padding:10px 16px;">Reset</button>
            <button type="button" class="export-btn" onclick="csSelectAllTimeData()" style="padding:10px 16px;">Select all data</button>
        </div>
    `;

    const parent = periodEl.parentElement || periodEl;
    parent.appendChild(section);

    // Cascading: change triggers options refresh too (better UX)
    ['csFilterYear','csFilterQuarter','csFilterMonth','csFilterWeek'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('change', () => {
            csUpdateTopTimeFiltersOptions();
            csRenderKPIs(); csRenderTiles(); csRenderAnalytics(); csApplyFilters();
        });
    });

    // Close dropdown on outside click
    document.addEventListener('click', function(e) {
        const dd = document.getElementById('csStatusDropdown');
        const ms = document.getElementById('csStatusMultiselect');
        if (!dd || !ms) return;
        if (!ms.contains(e.target)) dd.style.display = 'none';
    }, true);
}

function csGetSelectVal(id) {
    const el = document.getElementById(id);
    if (!el) return '';
    return (el.value || '').trim();
}

function csWeekOfMonth(d) {
    if (!(d instanceof Date) || isNaN(d.getTime())) return null;
    // Week number inside the month: 1..5 (matches "a month has 4 or 5 weeks")
    return Math.ceil(d.getDate() / 7);
}

function csParseMSRPeriod(period) {
    // "Apr 2026"
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    if (!period) return null;
    const parts = String(period).trim().split(/\s+/);
    if (parts.length < 2) return null;
    const mi = MONTHS.indexOf(parts[0]);
    const y = parseInt(parts[1], 10);
    if (mi < 0 || !y) return null;
    const q = Math.floor(mi / 3) + 1;
    return { year: y, quarter: q, monthIndex: mi };
}

function csParseQSRPeriod(period) {
    // "Q1 2026 - Jan"
    if (!period) return null;
    const qLabel = csQuarterFromPeriod(period); // "Q1 2026"
    const qParts = String(qLabel || '').split(' ');
    const qNum = parseInt((qParts[0] || '').replace('Q',''), 10);
    const y = parseInt(qParts[1], 10);
    let mi = null;
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    if (String(period).includes(' - ')) {
        const mStr = String(period).split(' - ')[1].trim();
        const idx = MONTHS.indexOf(mStr);
        if (idx >= 0) mi = idx;
    }
    if (!qNum || !y) return null;
    return { year: y, quarter: qNum, monthIndex: mi };
}

function csGetReviewTimeMeta(review, account) {
    if (!review || !account) return null;
    const type = account.team === 'DSM' ? 'MSR' : 'QSR';
    const base = type === 'MSR' ? csParseMSRPeriod(review.period) : csParseQSRPeriod(review.period);
    if (!base) return null;

    // Week: use an actual date if available
    const dateStr = review.reviewDate || review.agreedDate || review.dueDate || review.attempt1Date || null;
    const d = dateStr ? new Date(dateStr) : null;
    const w = d && !isNaN(d.getTime()) ? csWeekOfMonth(d) : null;
    return { type, year: base.year, quarter: base.quarter, monthIndex: base.monthIndex, week: w };
}

function csGetDashboardReviewsFiltered(extra) {
    // Applies role + type + time + (optional) status + search
    const typeF   = (extra && typeof extra.typeF !== 'undefined') ? extra.typeF : (document.getElementById('csReviewTypeFilter') ? document.getElementById('csReviewTypeFilter').value : '');
    const statusF = (extra && typeof extra.statusF !== 'undefined') ? extra.statusF : (document.getElementById('csStatusFilter') ? document.getElementById('csStatusFilter').value : '');
    // Search comes from the AG Grid search box (legacy UI).
    const searchT = (extra && typeof extra.searchT !== 'undefined') ? extra.searchT : (
        document.getElementById('csSearchBox') ? document.getElementById('csSearchBox').value.toLowerCase()
        : ''
    );

    const yV = csGetSelectVal('csFilterYear');
    const qV = csGetSelectVal('csFilterQuarter');
    const mV = csGetSelectVal('csFilterMonth');
    const wV = csGetSelectVal('csFilterWeek');

    const yearSel = yV ? parseInt(yV, 10) : null;
    const quarterSel = qV ? parseInt(String(qV).replace('Q',''), 10) : null;
    const monthSel = (mV !== '') ? parseInt(mV, 10) : null; // monthIndex 0-11
    const weekSel = wV ? parseInt(String(wV).replace('W',''), 10) : null;

    const legacyPeriodF = document.getElementById('csPeriodFilter') ? document.getElementById('csPeriodFilter').value : '';

    return csGetFilteredByRole().filter(review => {
        const account = CS_ACCOUNTS.find(a => a.code === review.accountCode);
        if (!account) return false;

        const meta = csGetReviewTimeMeta(review, account);
        if (!meta) return false;

        if (typeF) {
            const t = meta.type;
            if (t !== typeF) return false;
        }

        // Top time filters
        if (yearSel && meta.year !== yearSel) return false;
        if (quarterSel && meta.quarter !== quarterSel) return false;
        if (monthSel != null && (meta.monthIndex == null || meta.monthIndex !== monthSel)) return false;
        if (weekSel && (meta.week == null || meta.week !== weekSel)) return false;

        // Status multi-select (top bar). If empty => all
        if (CS_SELECTED_STATUSES && CS_SELECTED_STATUSES.length) {
            // Special handling for "Overdue"
            if (CS_SELECTED_STATUSES.includes('OVERDUE')) {
                if (!review.dueDate) return false;
                const due = new Date(review.dueDate), today = new Date(); today.setHours(0,0,0,0);
                if (!(due < today && !['Completed','Not Applicable','Customer Declined','Failed','Unreachable','No Show'].includes(review.status))) return false;
            } else {
                if (!CS_SELECTED_STATUSES.includes(review.status)) return false;
            }
        }

        // Legacy period filter (kept for backwards compatibility if top filters not mounted)
        if (!document.getElementById('csTopFiltersSection') && legacyPeriodF && review.period !== legacyPeriodF) return false;

        if (statusF && review.status !== statusF) return false;

        if (CS_USER_CONTEXT.statusFilter) {
            if (CS_USER_CONTEXT.statusFilter === 'OVERDUE') {
                if (!review.dueDate) return false;
                const due = new Date(review.dueDate), today = new Date(); today.setHours(0,0,0,0);
                if (!(due < today && !['Completed','Not Applicable','Customer Declined','Failed','Unreachable','No Show'].includes(review.status))) return false;
            } else if (review.status !== CS_USER_CONTEXT.statusFilter) return false;
        }

        if (searchT) {
            const ok = (account.code||'').toLowerCase().includes(searchT) ||
                       (account.customer||'').toLowerCase().includes(searchT) ||
                       (account.sm||'').toLowerCase().includes(searchT);
            if (!ok) return false;
        }

        return true;
    });
}

function csUpdateTopTimeFiltersOptions() {
    if (!document.getElementById('csTopFiltersSection')) return;

    const yearEl = document.getElementById('csFilterYear');
    const qEl    = document.getElementById('csFilterQuarter');
    const mEl    = document.getElementById('csFilterMonth');
    const wEl    = document.getElementById('csFilterWeek');
    const dd     = document.getElementById('csStatusDropdown');
    if (!yearEl || !qEl || !mEl || !wEl || !dd) return;

    const reviews = csGetFilteredByRole();
    const years = new Set();
    const quarters = new Set();
    const months = new Set();
    const weeks = new Set();
    const statuses = new Set();

    reviews.forEach(r => {
        const a = CS_ACCOUNTS.find(x => x.code === r.accountCode);
        if (!a) return;
        const meta = csGetReviewTimeMeta(r, a);
        if (!meta) return;
        years.add(meta.year);
        quarters.add(meta.quarter);
        if (meta.monthIndex != null) months.add(meta.monthIndex);
        if (meta.week != null) weeks.add(meta.week);
        statuses.add(r.status);
    });

    const keep = (el) => el.value;
    const yKeep = keep(yearEl), qKeep = keep(qEl), mKeep = keep(mEl), wKeep = keep(wEl);

    const ySel = yKeep ? parseInt(yKeep, 10) : null;
    const qSel = qKeep ? parseInt(String(qKeep).replace('Q',''), 10) : null;
    const mSel = (mKeep !== '') ? parseInt(mKeep, 10) : null;

    yearEl.innerHTML = `<option value="">All Years</option>`;
    Array.from(years).sort((a,b)=>b-a).forEach(y => {
        yearEl.innerHTML += `<option value="${y}">${y}</option>`;
    });

    // Cascading options based on current selections
    const metas = reviews.map(r => {
        const a = CS_ACCOUNTS.find(x => x.code === r.accountCode);
        const meta = a ? csGetReviewTimeMeta(r, a) : null;
        return meta ? meta : null;
    }).filter(Boolean);

    const quartersC = new Set();
    metas.forEach(m => { if (!ySel || m.year === ySel) quartersC.add(m.quarter); });
    qEl.innerHTML = `<option value="">All Quarters</option>`;
    Array.from(quartersC).sort((a,b)=>a-b).forEach(q => { qEl.innerHTML += `<option value="${q}">Q${q}</option>`; });

    const monthsC = new Set();
    metas.forEach(m => {
        if (ySel && m.year !== ySel) return;
        if (qSel && m.quarter !== qSel) return;
        if (m.monthIndex != null) monthsC.add(m.monthIndex);
    });
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    mEl.innerHTML = `<option value="">All Months</option>`;
    Array.from(monthsC).sort((a,b)=>a-b).forEach(mi => { mEl.innerHTML += `<option value="${mi}">${MONTHS[mi] || ('Month '+(mi+1))}</option>`; });

    const weeksC = new Set();
    metas.forEach(m => {
        if (ySel && m.year !== ySel) return;
        if (qSel && m.quarter !== qSel) return;
        if (mSel != null && (m.monthIndex == null || m.monthIndex !== mSel)) return;
        if (m.week != null) weeksC.add(m.week);
    });
    wEl.innerHTML = `<option value="">All Weeks</option>`;
    // Week-of-month is 1..5; show only those available for the chosen month
    Array.from(weeksC).sort((a,b)=>a-b).forEach(w => { wEl.innerHTML += `<option value="${w}">W${w}</option>`; });

    // Status dropdown options (like s.js)
    const ordered = ['Completed','In Progress','Pending','Customer Declined','No Show','Unreachable','Failed','Not Applicable'];
    const all = Array.from(statuses).filter(Boolean);
    const list = ordered.filter(s => all.includes(s)).concat(all.filter(s => !ordered.includes(s)));
    const withOverdue = ['OVERDUE'].concat(list);
    dd.innerHTML = withOverdue.map(s => {
        const label = (s === 'OVERDUE') ? 'Overdue' : s;
        const checked = CS_SELECTED_STATUSES.includes(s) ? 'checked' : '';
        return `<div class="multiselect-option" onclick="csToggleStatus('${s}', event)">
            <input type="checkbox" ${checked} />
            <label>${label}</label>
        </div>`;
    }).join('');

    csUpdateStatusSelectedText();

    // restore previous selections if still valid
    if (yKeep) yearEl.value = yKeep;
    if (qKeep && Array.from(qEl.options).some(o => o.value === qKeep)) qEl.value = qKeep; else qEl.value = '';
    if (mKeep && Array.from(mEl.options).some(o => o.value === mKeep)) mEl.value = mKeep; else mEl.value = '';
    if (wKeep && Array.from(wEl.options).some(o => o.value === wKeep)) wEl.value = wKeep; else wEl.value = '';
}

function csInitDefaultTopTimeFiltersForTab() {
    if (!document.getElementById('csTopFiltersSection')) return;
    if (CS_ACTIVE_TAB !== 'MSR' && CS_ACTIVE_TAB !== 'QSR') return;
    if (CS_TIME_FILTER_INIT[CS_ACTIVE_TAB]) return;

    const now = new Date();
    const y = String(now.getFullYear());
    const mi = String(now.getMonth());

    const yearEl = document.getElementById('csFilterYear');
    const mEl = document.getElementById('csFilterMonth');
    const qEl = document.getElementById('csFilterQuarter');
    const wEl = document.getElementById('csFilterWeek');

    if (yearEl) yearEl.value = y;
    if (mEl) mEl.value = mi;
    if (qEl) qEl.value = '';
    if (wEl) wEl.value = '';
    CS_SELECTED_STATUSES = [];
    csUpdateStatusSelectedText();

    CS_TIME_FILTER_INIT[CS_ACTIVE_TAB] = true;
}

window.csSelectAllTimeData = function() {
    ['csFilterYear','csFilterQuarter','csFilterMonth','csFilterWeek'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    CS_SELECTED_STATUSES = [];
    csUpdateStatusSelectedText();
    csRenderKPIs(); csRenderTiles(); csRenderAnalytics(); csApplyFilters();
};

window.csResetTopFilters = function() {
    CS_TIME_FILTER_INIT[CS_ACTIVE_TAB] = false;
    csUpdateTopTimeFiltersOptions();
    csInitDefaultTopTimeFiltersForTab();
    csRenderKPIs(); csRenderTiles(); csRenderAnalytics(); csApplyFilters();
};

window.csToggleStatusDropdown = function() {
    const dd = document.getElementById('csStatusDropdown');
    if (!dd) return;
    dd.style.display = (dd.style.display === 'none' || !dd.style.display) ? 'block' : 'none';
};

window.csToggleStatus = function(status, ev) {
    if (ev) { ev.preventDefault(); ev.stopPropagation(); }
    const idx = CS_SELECTED_STATUSES.indexOf(status);
    if (idx >= 0) CS_SELECTED_STATUSES.splice(idx, 1);
    else CS_SELECTED_STATUSES.push(status);
    csUpdateTopTimeFiltersOptions();
    csRenderKPIs(); csRenderTiles(); csRenderAnalytics(); csApplyFilters();
};

function csUpdateStatusSelectedText() {
    const el = document.getElementById('csStatusSelectedText');
    if (!el) return;
    if (!CS_SELECTED_STATUSES || CS_SELECTED_STATUSES.length === 0) { el.textContent = 'All Statuses'; return; }
    const labels = CS_SELECTED_STATUSES.map(s => s === 'OVERDUE' ? 'Overdue' : s);
    el.textContent = labels.length <= 2 ? labels.join(', ') : `${labels.length} selected`;
}

function csUpdatePeriodFilter() {
    const typeF = document.getElementById('csReviewTypeFilter').value;
    const el    = document.getElementById('csPeriodFilter');
    const cur   = el.value;
    el.innerHTML = '<option value="">All Periods</option>';
    let periods = [...new Set(CS_REVIEWS.map(r => r.period))];
    if (typeF === 'MSR') periods = periods.filter(p => !p.startsWith('Q'));
    else if (typeF === 'QSR') periods = periods.filter(p => p.startsWith('Q'));
    periods.sort().reverse().forEach(p => {
        const opt = document.createElement('option');
        opt.value = p; opt.textContent = p; if (p === cur) opt.selected = true;
        el.appendChild(opt);
    });
}

window.csReviewTypeChanged = function () { csUpdatePeriodFilter(); csApplyFilters(); };

// ─── ROLE FILTER ───────────────────────────────────────────────────────────────
function csGetFilteredByRole() {
    let reviews = CS_REVIEWS;
    if (CS_ACTIVE_TAB === 'MSR') {
        reviews = reviews.filter(r => { const a = CS_ACCOUNTS.find(x => x.code === r.accountCode); return a && a.team === 'DSM'; });
    } else if (CS_ACTIVE_TAB === 'QSR') {
        reviews = reviews.filter(r => { const a = CS_ACCOUNTS.find(x => x.code === r.accountCode); return a && ['TSM_ME','TSM_SE'].includes(a.team); });
    }
    if (CS_USER_CONTEXT.role === 'SM') {
        reviews = reviews.filter(r => { const a = CS_ACCOUNTS.find(x => x.code === r.accountCode); return a && a.sm === CS_USER_CONTEXT.userName; });
    } else if (CS_USER_CONTEXT.role === 'LM') {
        if (CS_USER_CONTEXT.selectedSM) {
            reviews = reviews.filter(r => { const a = CS_ACCOUNTS.find(x => x.code === r.accountCode); return a && a.sm === CS_USER_CONTEXT.selectedSM; });
        } else {
            reviews = reviews.filter(r => { const a = CS_ACCOUNTS.find(x => x.code === r.accountCode); return a && a.lm === CS_USER_CONTEXT.userName; });
        }
    } else if (CS_USER_CONTEXT.role === 'SD') {
        if (CS_USER_CONTEXT.selectedSM) {
            reviews = reviews.filter(r => { const a = CS_ACCOUNTS.find(x => x.code === r.accountCode); return a && a.sm === CS_USER_CONTEXT.selectedSM; });
        } else if (CS_USER_CONTEXT.selectedLM) {
            reviews = reviews.filter(r => { const a = CS_ACCOUNTS.find(x => x.code === r.accountCode); return a && a.lm === CS_USER_CONTEXT.selectedLM; });
        }
    }
    return reviews;
}

// ─── KPIs (v2 — includes Unreachable) ─────────────────────────────────────────
function csRenderKPIs() {
    const reviews     = csGetDashboardReviewsFiltered({ searchT:'' });
    const total       = reviews.length;
    const completed   = reviews.filter(r => r.status === 'Completed').length;
    const inProg      = reviews.filter(r => r.status === 'In Progress').length;
    const pending     = reviews.filter(r => r.status === 'Pending').length;
    const declined    = reviews.filter(r => r.status === 'Customer Declined').length;
    const unreachable = reviews.filter(r => r.status === 'Unreachable').length;
   const noShow      = reviews.filter(r => r.status === 'No Show').length;
    const failed      = reviews.filter(r => r.status === 'Failed').length;
    const notApplicable = reviews.filter(r => r.status === 'Not Applicable').length;
    const terminal    = ['Completed','Not Applicable','Customer Declined','Failed','Unreachable','No Show'];
    const overdue     = reviews.filter(r => {
        if (!r.dueDate) return false;
        const due = new Date(r.dueDate), today = new Date(); today.setHours(0,0,0,0);
        return due < today && !terminal.includes(r.status);
    }).length;
    const rate = total > 0 ? ((completed / total) * 100).toFixed(1) : 0;

    document.getElementById('csKPISection').innerHTML = `
    <div class="top-stats" style="margin-bottom:1rem;">
        <div class="stat-card" onclick="csClearFilters()" style="cursor:pointer;">
            <div class="stat-label">Total reviews</div>
            <div class="stat-value">${total}</div>
            <div class="stat-subtitle">${rate}% completed</div>
            <div class="stat-breakdown">
                <div class="breakdown-item"><div class="breakdown-label">Completed</div><div class="breakdown-value" style="color:#10b981">${completed}</div></div>
                <div class="breakdown-item"><div class="breakdown-label">Pending</div><div class="breakdown-value">${pending}</div></div>
            </div>
        </div>
        <div class="stat-card" onclick="csFilterByStatus('Completed')" style="cursor:pointer;">
            <div class="stat-label">Completed</div>
            <div class="stat-value" style="color:#10b981">${completed}</div>
            <div class="stat-subtitle">${rate}% of total</div>
        </div>
        <div class="stat-card" onclick="csFilterByStatus('In Progress')" style="cursor:pointer;">
            <div class="stat-label">In progress</div>
            <div class="stat-value" style="color:var(--warning)">${inProg}</div>
            <div class="stat-subtitle">Active reviews</div>
        </div>
        <div class="stat-card" onclick="csFilterByStatus('Pending')" style="cursor:pointer;">
            <div class="stat-label">Pending</div>
            <div class="stat-value">${pending}</div>
            <div class="stat-subtitle">Not started</div>
        </div>
        <div class="stat-card" onclick="csFilterOverdue()" style="cursor:pointer;">
            <div class="stat-label">Overdue</div>
            <div class="stat-value" style="color:var(--danger)">${overdue}</div>
            <div class="stat-subtitle">Action needed</div>
        </div>
        <div class="stat-card" onclick="csFilterByStatus('Customer Declined')" style="cursor:pointer;">
            <div class="stat-label">Declined</div>
            <div class="stat-value">${declined}</div>
            <div class="stat-subtitle">Customer declined</div>
        </div>
        <div class="stat-card" onclick="csFilterByStatus('No Show')" style="cursor:pointer;">
            <div class="stat-label">No show</div>
            <div class="stat-value" style="color:#b45309">${noShow}</div>
            <div class="stat-subtitle">Agreed but didn't join</div>
        </div>
        <div class="stat-card" onclick="csFilterByStatus('Unreachable')" style="cursor:pointer;">
            <div class="stat-label">Unreachable</div>
            <div class="stat-value" style="color:var(--danger)">${unreachable}</div>
            <div class="stat-subtitle">All 3 attempts failed</div>
        </div>
       <div class="stat-card" onclick="csFilterByStatus('Failed')" style="cursor:pointer;">
            <div class="stat-label">Failed</div>
            <div class="stat-value" style="color:var(--danger)">${failed}</div>
            <div class="stat-subtitle">Missed period deadline</div>
        </div>
        <div class="stat-card" onclick="csFilterByStatus('Not Applicable')" style="cursor:pointer;">
            <div class="stat-label">Not applicable</div>
            <div class="stat-value" style="color:var(--t3)">${notApplicable}</div>
            <div class="stat-subtitle">Customer not eligible</div>
        </div>
    </div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ─── ANALYTICS ─────────────────────────────────────────────────────────────────
function csEnsureAnalyticsHost() {
    var msrqsr = document.getElementById('csMSRQSRContent');
    if (!msrqsr) return null;
    var host = document.getElementById('csAnalyticsHost');
    if (!host) {
        host = document.createElement('div');
        host.id = 'csAnalyticsHost';
        var tableSection = msrqsr.querySelector('.table-section');
        if (tableSection) msrqsr.insertBefore(host, tableSection);
        else msrqsr.appendChild(host);
        host.innerHTML =
            '<div style="text-align:center;margin:1rem 0;">' +
            '<button type="button" class="export-btn" onclick="csToggleCharts()" style="padding:12px 24px;font-size:14px;">' +
            '<i data-lucide="eye" id="csChartsIcon" style="width:16px;height:16px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>' +
            '<span id="csChartsBtnText">Show Analytics Charts</span>' +
            '</button></div>' +
            '<div id="csAnalyticsSection"></div>';
    }
    var btnText = document.getElementById('csChartsBtnText');
    var icon = document.getElementById('csChartsIcon');
    if (btnText) btnText.textContent = CS_CHARTS_VISIBLE ? 'Hide Analytics Charts' : 'Show Analytics Charts';
    if (icon) icon.setAttribute('data-lucide', CS_CHARTS_VISIBLE ? 'eye-off' : 'eye');
    return host;
}

function csRenderActiveTabCharts() {
    if (typeof Chart === 'undefined') {
        console.warn('[CS] Chart.js is not loaded — charts cannot render.');
        return;
    }
    ['csMSRCharts', 'csQSRCharts', 'csHCCharts'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    try {
        if (CS_ACTIVE_TAB === 'MSR') {
            var msrEl = document.getElementById('csMSRCharts');
            if (msrEl) { msrEl.style.display = 'block'; csRenderMSRCharts(); }
        } else if (CS_ACTIVE_TAB === 'QSR') {
            var qsrEl = document.getElementById('csQSRCharts');
            if (qsrEl) { qsrEl.style.display = 'block'; csRenderQSRCharts(); }
        } else if (CS_ACTIVE_TAB === 'HC') {
            var hcEl = document.getElementById('csHCCharts');
            if (hcEl) { hcEl.style.display = 'block'; csRenderHCCharts(); }
        }
    } catch (e) { console.warn('CS Charts error:', e); }
}

function csRefreshMSRQSRDashboard() {
    csRenderKPIs();
    csRenderTiles();
    csRenderAnalytics();
    csApplyFilters();
}

function csRenderAnalytics() {
    if (CS_ACTIVE_TAB === 'HC') return;
    csEnsureAnalyticsHost();
    var section = document.getElementById('csAnalyticsSection');
    if (!section) return;
    const reviews = csGetDashboardReviewsFiltered({ searchT:'' });
    const months  = [...new Set(reviews.map(r => r.period))].sort().slice(-6);
    const byStatus = ['Completed','In Progress','Pending','Overdue','Customer Declined','Unreachable','Failed'].map(s => ({
        label: s,
        count: s === 'Overdue'
            ? reviews.filter(r => { if(!r.dueDate) return false; const d=new Date(r.dueDate),t=new Date(); t.setHours(0,0,0,0); return d<t&&!['Completed','Not Applicable','Customer Declined','Failed','Unreachable'].includes(r.status); }).length
            : reviews.filter(r => r.status === s).length
    })).filter(s => s.count > 0);

    section.innerHTML = `
<div id="csChartsWrap" style="display:${CS_CHARTS_VISIBLE ? 'block' : 'none'};">
        <!-- ACCOUNT HISTORY SEARCH -->
        <div class="chart-card" style="margin-bottom:1rem;">
            <h3 class="chart-title"><i data-lucide="search" style="width:15px;height:15px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Account History Search</h3>
            <div style="display:flex;gap:10px;align-items:center;margin-bottom:1rem;">
                <input type="text" id="csAccHistoryInput" placeholder="Enter account code..." 
                    style="flex:1;padding:10px 14px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg-input);color:var(--t1);"
                    onkeydown="if(event.key==='Enter')csSearchAccountHistory()">
                <button type="button" class="export-btn" onclick="csSearchAccountHistory()" style="padding:10px 20px;font-size:13px;">
                    <i data-lucide="search" style="width:13px;height:13px;display:inline-block;vertical-align:middle;margin-right:5px;"></i>Search
                </button>
                <button type="button" class="reset-btn" onclick="csClearAccountHistory()" style="padding:10px 16px;font-size:13px;">Clear</button>
            </div>
            <div id="csAccHistoryResult"></div>
        </div>

        <!-- MSR CHARTS -->
        <div id="csMSRCharts" style="display:none;">
            <div style="font-size:.78rem;font-weight:700;text-transform:uppercase;color:var(--t3);letter-spacing:.06em;margin-bottom:1rem;padding:.5rem 1rem;background:var(--bg-secondary);border-radius:8px;">MSR Analytics</div>

            <!-- Row 1 -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem;">
                <div class="chart-card">
                    <h3 class="chart-title"><i data-lucide="trending-up" style="width:15px;height:15px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Completion Rate Trend</h3>
                    <div style="height:260px;"><canvas id="csMSRTrendChart"></canvas></div>
                </div>
                <div class="chart-card">
                    <h3 class="chart-title"><i data-lucide="pie-chart" style="width:15px;height:15px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Status Distribution</h3>
                    <div style="height:260px;"><canvas id="csMSRStatusChart"></canvas></div>
                </div>
            </div>

            <!-- Row 2 -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem;">
                <div class="chart-card">
                    <h3 class="chart-title"><i data-lucide="bar-chart-3" style="width:15px;height:15px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>SM Performance League</h3>
                    <div style="height:260px;"><canvas id="csMSRSMLeagueChart"></canvas></div>
                </div>
                <div class="chart-card">
                    <h3 class="chart-title"><i data-lucide="bar-chart-2" style="width:15px;height:15px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Overdue by SM</h3>
                    <div style="height:260px;"><canvas id="csMSROverdueChart"></canvas></div>
                </div>
            </div>

            <!-- Row 3 -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem;">
                <div class="chart-card">
                    <h3 class="chart-title"><i data-lucide="layers" style="width:15px;height:15px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Monthly Volume vs Completion</h3>
                    <div style="height:260px;"><canvas id="csMSRVolumeChart"></canvas></div>
                </div>
                <div class="chart-card">
                    <h3 class="chart-title"><i data-lucide="repeat" style="width:15px;height:15px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Attempt Analysis</h3>
                    <div style="height:260px;"><canvas id="csMSRAttemptChart"></canvas></div>
                </div>
            </div>

            <!-- Row 4 -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem;">
                <div class="chart-card">
                    <h3 class="chart-title"><i data-lucide="clock" style="width:15px;height:15px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Avg Days to Complete by SM</h3>
                    <div style="height:260px;"><canvas id="csMSRDaysChart"></canvas></div>
                </div>
                <div class="chart-card">
                    <h3 class="chart-title"><i data-lucide="alert-triangle" style="width:15px;height:15px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Failure Reasons Breakdown</h3>
                    <div style="height:260px;"><canvas id="csMSRFailureChart"></canvas></div>
                </div>
            </div>

            <!-- Row 5 full -->
            <div style="margin-bottom:1rem;">
                <div class="chart-card">
                    <h3 class="chart-title"><i data-lucide="alert-circle" style="width:15px;height:15px;display:inline-block;vertical-align:middle;margin-right:6px;color:#ef4444;"></i>Top 5 Most Difficult Accounts</h3>
                    <div id="csMSRDifficultAccounts"></div>
                </div>
            </div>
        </div>

        <!-- QSR CHARTS -->
        <div id="csQSRCharts" style="display:none;">
            <div style="font-size:.78rem;font-weight:700;text-transform:uppercase;color:var(--t3);letter-spacing:.06em;margin-bottom:1rem;padding:.5rem 1rem;background:var(--bg-secondary);border-radius:8px;">QSR Analytics</div>

            <!-- Row 1 -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem;">
                <div class="chart-card">
                    <h3 class="chart-title"><i data-lucide="trending-up" style="width:15px;height:15px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Quarter over Quarter Trend</h3>
                    <div style="height:260px;"><canvas id="csQSRQoQChart"></canvas></div>
                </div>
                <div class="chart-card">
                    <h3 class="chart-title"><i data-lucide="pie-chart" style="width:15px;height:15px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Status Distribution</h3>
                    <div style="height:260px;"><canvas id="csQSRStatusChart"></canvas></div>
                </div>
            </div>

            <!-- Row 2 -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem;">
                <div class="chart-card">
                    <h3 class="chart-title"><i data-lucide="bar-chart-3" style="width:15px;height:15px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>SM Completion Comparison</h3>
                    <div style="height:260px;"><canvas id="csQSRSMChart"></canvas></div>
                </div>
                <div class="chart-card">
                    <h3 class="chart-title"><i data-lucide="layers" style="width:15px;height:15px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Monthly Attempt Distribution</h3>
                    <div style="height:260px;"><canvas id="csQSRAttemptChart"></canvas></div>
                </div>
            </div>

            <!-- Row 3 -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem;">
                <div class="chart-card">
                    <h3 class="chart-title"><i data-lucide="phone-off" style="width:15px;height:15px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Reachable vs Unreachable</h3>
                    <div style="height:260px;"><canvas id="csQSRReachChart"></canvas></div>
                </div>
                <div class="chart-card">
                    <h3 class="chart-title"><i data-lucide="bar-chart-2" style="width:15px;height:15px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Quarter Completion Rate by SM</h3>
                    <div style="height:260px;"><canvas id="csQSRQtCompChart"></canvas></div>
                </div>
            </div>

            <!-- Row 4 full -->
            <div style="margin-bottom:1rem;">
                <div class="chart-card">
                    <h3 class="chart-title"><i data-lucide="alert-circle" style="width:15px;height:15px;display:inline-block;vertical-align:middle;margin-right:6px;color:#ef4444;"></i>Accounts Needing 3 Months to Complete</h3>
                    <div id="csQSRHardAccounts"></div>
                </div>
            </div>
        </div>

        <!-- HC CHARTS -->
        <div id="csHCCharts" style="display:none;">
            <div style="font-size:.78rem;font-weight:700;text-transform:uppercase;color:var(--t3);letter-spacing:.06em;margin-bottom:1rem;padding:.5rem 1rem;background:var(--bg-secondary);border-radius:8px;">Health Check Analytics</div>

            <!-- Row 1 -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem;">
                <div class="chart-card">
                    <h3 class="chart-title"><i data-lucide="trending-up" style="width:15px;height:15px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Monthly Interaction Volume</h3>
                    <div style="height:260px;"><canvas id="csHCVolumeChart"></canvas></div>
                </div>
                <div class="chart-card">
                    <h3 class="chart-title"><i data-lucide="pie-chart" style="width:15px;height:15px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Reachable vs Unreachable</h3>
                    <div style="height:260px;"><canvas id="csHCReachChart"></canvas></div>
                </div>
            </div>

            <!-- Row 2 -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem;">
                <div class="chart-card">
                    <h3 class="chart-title"><i data-lucide="bar-chart-3" style="width:15px;height:15px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>SM Activity League</h3>
                    <div style="height:260px;"><canvas id="csHCSMActivityChart"></canvas></div>
                </div>
                <div class="chart-card">
                    <h3 class="chart-title"><i data-lucide="activity" style="width:15px;height:15px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Reachability Trend</h3>
                    <div style="height:260px;"><canvas id="csHCReachTrendChart"></canvas></div>
                </div>
            </div>

            <!-- Row 3 -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem;">
                <div class="chart-card">
                    <h3 class="chart-title"><i data-lucide="bar-chart-2" style="width:15px;height:15px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Interaction Frequency per Account</h3>
                    <div style="height:260px;"><canvas id="csHCFreqChart"></canvas></div>
                </div>
                <div class="chart-card">
                    <h3 class="chart-title"><i data-lucide="users" style="width:15px;height:15px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Month over Month SM Comparison</h3>
                    <div style="height:260px;"><canvas id="csHCSMMoMChart"></canvas></div>
                </div>
            </div>

            <!-- Row 4 full -->
            <div style="margin-bottom:1rem;">
                <div class="chart-card">
                    <h3 class="chart-title"><i data-lucide="alert-triangle" style="width:15px;height:15px;display:inline-block;vertical-align:middle;margin-right:6px;color:#ef4444;"></i>Accounts Not Touched This Month</h3>
                    <div id="csHCNotTouched"></div>
                </div>
            </div>
        </div>

    </div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    if (CS_CHARTS_VISIBLE) {
        setTimeout(function() { csRenderActiveTabCharts(); }, 150);
    }
}
function csGetChartColors() {
    const theme = document.body.getAttribute('data-theme');
    const isDark = theme === 'dark' || theme === 'duralux-dark';
    return {
        text: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)',
        grid: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'
    };
}
// ─── LM / SM TILES ────────────────────────────────────────────────────────────
function csMakeLMTile(lm, reviews, isSelected) {
    const total = reviews.length;
    const comp  = reviews.filter(r=>r.status==='Completed').length;
    const pend  = reviews.filter(r=>r.status==='Pending').length;
    const unr   = reviews.filter(r=>r.status==='Unreachable').length;
    const fail  = reviews.filter(r=>r.status==='Failed').length;
    const over  = reviews.filter(r=>{ if(!r.dueDate)return false; const d=new Date(r.dueDate),t=new Date(); t.setHours(0,0,0,0); return d<t&&!['Completed','Not Applicable','Customer Declined','Failed','Unreachable'].includes(r.status); }).length;
    const rate  = total>0?((comp/total)*100).toFixed(1):0;
    const onclick = isSelected ? `csClearLMFilter()` : `csSelectLM('${lm.replace(/'/g,"\\'")}')`;
    return `
    <div class="lm-tile${isSelected?' selected':''}" onclick="${onclick}">
        <div class="lm-header"><h3>${lm}</h3></div>
        <div class="lm-stats-grid">
            <div class="lm-stat-box"><div class="lm-stat-label">Reviews</div><div class="lm-stat-value">${total}</div></div>
            <div class="lm-stat-box"><div class="lm-stat-label">Completed</div><div class="lm-stat-value" style="color:#10b981">${comp}</div></div>
            <div class="lm-stat-box"><div class="lm-stat-label">Pending</div><div class="lm-stat-value">${pend}</div></div>
            <div class="lm-stat-box"><div class="lm-stat-label">Unreachable</div><div class="lm-stat-value" style="color:var(--danger)">${unr}</div></div>
            <div class="lm-stat-box"><div class="lm-stat-label">Failed</div><div class="lm-stat-value" style="color:var(--danger)">${fail}</div></div>
        </div>
        <div class="lm-revenue">
            <div class="lm-revenue-label">Completion rate</div>
            <div class="lm-revenue-count">${rate}%</div>
            <div class="lm-revenue-breakdown">
                <div class="lm-revenue-item"><div class="lm-revenue-item-label">Overdue</div><div class="lm-revenue-item-value" style="color:#fca5a5">${over}</div></div>
                <div class="lm-revenue-item"><div class="lm-revenue-item-label">Done / Total</div><div class="lm-revenue-item-value">${comp} / ${total}</div></div>
            </div>
        </div>
        <div class="lm-progress-section">
            <div class="lm-progress-row"><span class="lm-progress-label">Completion</span><span class="lm-progress-value">${rate}%</span></div>
            <div class="progress-bar"><div class="progress-fill" style="width:${Math.min(rate,100)}%"></div></div>
        </div>
    </div>`;
}

function csMakeSMRow(sm, reviews, index, isSelected) {
    const total = reviews.length;
    const comp  = reviews.filter(r=>r.status==='Completed').length;
    const rate  = total>0?((comp/total)*100).toFixed(1):0;
    const pend  = reviews.filter(r=>r.status==='Pending').length;
    const unr   = reviews.filter(r=>r.status==='Unreachable').length;
    const fail  = reviews.filter(r=>r.status==='Failed').length;
    const over  = reviews.filter(r=>{ if(!r.dueDate)return false; const d=new Date(r.dueDate),t=new Date(); t.setHours(0,0,0,0); return d<t&&!['Completed','Not Applicable','Customer Declined','Failed','Unreachable'].includes(r.status); }).length;
    const rankClass = index===0?'rank-1':index===1?'rank-2':index===2?'rank-3':'rank-other';
    const tag       = index===0?'Top Performer':index===1?'High Achiever':'Key Contributor';
    const onclick   = isSelected ? `csClearSMFilter()` : `csSelectSM('${sm.replace(/'/g,"\\'")}')`;
    return `
    <div class="manager-row${isSelected?' selected':''}" onclick="${onclick}">
        <div class="rank-badge ${rankClass}">${index+1}</div>
        <div class="manager-name-col"><div class="manager-name">${sm}</div><div class="manager-tag">${tag}</div></div>
        <div class="stat-col"><div class="stat-label">Reviews</div><div class="stat-value">${total}</div></div>
        <div class="stat-col"><div class="stat-label">Completed</div><div class="stat-value" style="color:#10b981">${comp}</div></div>
        <div class="stat-col"><div class="stat-label">Pending</div><div class="stat-value">${pend}</div></div>
        <div class="stat-col"><div class="stat-label">Unreachable</div><div class="stat-value" style="color:var(--danger)">${unr}</div></div>
        <div class="stat-col"><div class="stat-label">Failed</div><div class="stat-value" style="color:var(--danger)">${fail}</div></div>
        <div class="stat-col"><div class="stat-label">Overdue</div><div class="stat-value" style="color:var(--danger)">${over}</div></div>
        <div class="stat-col"><div class="stat-label">Rate</div><div class="stat-value" style="color:var(--acc)">${rate}%</div></div>
        <div class="progress-bar-col">
            <div class="progress-label">Completion: ${rate}%</div>
            <div class="progress-bar"><div class="progress-fill" style="width:${Math.min(rate,100)}%"></div></div>
        </div>
    </div>`;
}

function csRenderTiles() {
    const section = document.getElementById('csTilesSection');
    let html = '';
    const selLM = CS_USER_CONTEXT.selectedLM;
    const selSM = CS_USER_CONTEXT.selectedSM;
    if (CS_USER_CONTEXT.role === 'SD') {
        const tabReviews = csGetDashboardReviewsFiltered({ searchT:'' });
        const lms = [...new Set(CS_ACCOUNTS.map(a=>a.lm))].filter(Boolean).sort();
        const lmsToShow = selLM ? lms.filter(lm=>lm===selLM) : lms;
        const lmTiles = lmsToShow.map(lm => {
            const reviews = tabReviews.filter(r=>CS_ACCOUNTS.some(a=>a.code===r.accountCode&&a.lm===lm));
            return reviews.length>0 ? csMakeLMTile(lm, reviews, selLM===lm) : '';
        }).join('');
        html += `<div class="line-managers-grid" style="margin-bottom:1.5rem;">${lmTiles}</div>`;
        if (selLM) {
            const sms = [...new Set(CS_ACCOUNTS.filter(a=>a.lm===selLM).map(a=>a.sm))].filter(Boolean);
            const smStats = sms.map(sm=>({ name:sm, reviews:tabReviews.filter(r=>CS_ACCOUNTS.some(a=>a.code===r.accountCode&&a.sm===sm)) }))
                .filter(s=>s.reviews.length>0)
                .sort((a,b)=>b.reviews.filter(r=>r.status==='Completed').length - a.reviews.filter(r=>r.status==='Completed').length);
            const smsToShow = selSM ? smStats.filter(s=>s.name===selSM) : smStats;
            if (smsToShow.length>0) {
                html += `<div class="manager-list" style="margin-bottom:1.5rem;">`;
                smsToShow.forEach((s,i)=>{ html += csMakeSMRow(s.name, s.reviews, smStats.indexOf(s), selSM===s.name); });
                html += `</div>`;
            }
        }
    } else if (CS_USER_CONTEXT.role === 'LM') {
        const tabReviews = csGetDashboardReviewsFiltered({ searchT:'' });
        const sms = [...new Set(CS_ACCOUNTS.filter(a=>a.lm===CS_USER_CONTEXT.userName).map(a=>a.sm))].filter(Boolean);
        const smStats = sms.map(sm=>({ name:sm, reviews:tabReviews.filter(r=>CS_ACCOUNTS.some(a=>a.code===r.accountCode&&a.sm===sm)) }))
            .filter(s=>s.reviews.length>0)
            .sort((a,b)=>b.reviews.filter(r=>r.status==='Completed').length - a.reviews.filter(r=>r.status==='Completed').length);
        const smsToShow = selSM ? smStats.filter(s=>s.name===selSM) : smStats;
        html += `<div class="manager-list" style="margin-bottom:1.5rem;">`;
        smsToShow.forEach((s,i)=>{ html += csMakeSMRow(s.name, s.reviews, smStats.indexOf(s), selSM===s.name); });
        html += `</div>`;
    }
    section.innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}
// ─── BREADCRUMB ────────────────────────────────────────────────────────────────
function csRenderBreadcrumb() {
    let html = '';
    const selLM = CS_USER_CONTEXT.selectedLM;
    const selSM = CS_USER_CONTEXT.selectedSM;
    if (CS_USER_CONTEXT.role === 'SD' && (selLM || selSM)) {
        html = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:1rem;flex-wrap:wrap;font-size:13px;">';
        html += `<span style="color:var(--acc);cursor:pointer;font-weight:600;" onclick="csClearFilters()"><i data-lucide="home" style="width:13px;height:13px;display:inline-block;vertical-align:middle;margin-right:3px;"></i>All</span>`;
        if (selLM) html += `<span style="color:var(--t3);">›</span><span style="color:${selSM?'var(--acc)':'var(--t1)'};cursor:pointer;font-weight:600;" onclick="csClearSMFilter()">${selLM}</span>`;
        if (selSM) html += `<span style="color:var(--t3);">›</span><span style="font-weight:700;color:var(--t1);">${selSM}</span>`;
        html += '</div>';
    } else if (CS_USER_CONTEXT.role === 'LM' && selSM) {
        html = `<div style="display:flex;align-items:center;gap:8px;margin-bottom:1rem;font-size:13px;"><span style="color:var(--acc);cursor:pointer;font-weight:600;" onclick="csClearFilters()">All SMs</span><span style="color:var(--t3);">›</span><span style="font-weight:700;color:var(--t1);">${selSM}</span></div>`;
    }
    document.getElementById('csBreadcrumb').innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function csRefreshAll() {
    csRenderBreadcrumb();
    csRefreshMSRQSRDashboard();
}
window.csSelectLM     = function(lm) { CS_USER_CONTEXT.selectedLM = lm; CS_USER_CONTEXT.selectedSM = null; csRefreshAll(); };
window.csClearLMFilter= function()   { CS_USER_CONTEXT.selectedLM = null; CS_USER_CONTEXT.selectedSM = null; csRefreshAll(); };
window.csSelectSM     = function(sm) { CS_USER_CONTEXT.selectedSM = sm; csRefreshAll(); };
window.csClearSMFilter= function()   { CS_USER_CONTEXT.selectedSM = null; csRefreshAll(); };
window.csClearFilters = function()   {
    CS_USER_CONTEXT.selectedLM = null; CS_USER_CONTEXT.selectedSM = null; CS_USER_CONTEXT.statusFilter = null;
    if (document.getElementById('csStatusFilter')) document.getElementById('csStatusFilter').value = '';
    if (document.getElementById('csReviewTypeFilter')) document.getElementById('csReviewTypeFilter').value = '';
    if (document.getElementById('csPeriodFilter')) document.getElementById('csPeriodFilter').value = '';
    if (document.getElementById('csSearchBox')) document.getElementById('csSearchBox').value = '';
    if (document.getElementById('csTopFiltersSection')) {
        // Reset to current month defaults (not "all time") on clear
        CS_TIME_FILTER_INIT[CS_ACTIVE_TAB] = false;
        csUpdateTopTimeFiltersOptions();
        csInitDefaultTopTimeFiltersForTab();
    }
    csRefreshAll();
};
window.csFilterByStatus = function(s) { CS_USER_CONTEXT.statusFilter = s; document.getElementById('csStatusFilter').value = s||''; csApplyFilters(); };
window.csFilterOverdue  = function()  { CS_USER_CONTEXT.statusFilter = 'OVERDUE'; document.getElementById('csStatusFilter').value = ''; csApplyFilters(); };
window.csToggleHCCharts = function() {
    var section = document.getElementById('csHCChartsSection');
    var icon    = document.getElementById('csHCChartsIcon');
    var btnText = document.getElementById('csHCChartsBtnText');
    if (!section) return;

    var isHidden = section.style.display === 'none';
    section.style.display = isHidden ? 'block' : 'none';
    if (btnText) btnText.textContent = isHidden ? 'Hide Analytics Charts' : 'Show Analytics Charts';
    if (icon) icon.setAttribute('data-lucide', isHidden ? 'eye-off' : 'eye');
    if (typeof lucide !== 'undefined') lucide.createIcons();

    if (!isHidden) return;

    section.innerHTML =
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem;">' +
        '<div class="chart-card"><div class="chart-title">Monthly Interaction Volume</div><div style="height:260px;position:relative;"><canvas id="csHCVC"></canvas></div></div>' +
        '<div class="chart-card"><div class="chart-title">Reachable vs Unreachable</div><div style="height:260px;position:relative;"><canvas id="csHCRC"></canvas></div></div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem;">' +
        '<div class="chart-card"><div class="chart-title">SM Activity League</div><div style="height:260px;position:relative;"><canvas id="csHCSAC"></canvas></div></div>' +
        '<div class="chart-card"><div class="chart-title">Reachability Trend</div><div style="height:260px;position:relative;"><canvas id="csHCRTC"></canvas></div></div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem;">' +
        '<div class="chart-card"><div class="chart-title">Interaction Frequency per Account</div><div style="height:260px;position:relative;"><canvas id="csHCFC"></canvas></div></div>' +
        '<div class="chart-card"><div class="chart-title">Month over Month SM Comparison</div><div style="height:260px;position:relative;"><canvas id="csHCMOMC"></canvas></div></div>' +
        '</div>' +
        '<div class="chart-card" style="margin-bottom:1rem;"><div class="chart-title">Accounts Not Touched This Month</div><div id="csHCNT"></div></div>';

    // Use unique IDs — no conflict with csRenderAnalytics canvases
    setTimeout(function() {
        csRenderHCChartsInto('csHCVC','csHCRC','csHCSAC','csHCRTC','csHCFC','csHCMOMC','csHCNT');
    }, 300);
};
function csRenderHCChartsInto(volId, reachId, smActId, reachTrendId, freqId, momId, notTouchedId) {
    var c = csGetChartColors();
    var du = { p1:'#4c6fff', p2:'#8b5cf6', p3:'#c724b1', p4:'#a855f7', p5:'#7c3aed' };

    var tsmAccts = CS_ACCOUNTS.filter(function(a){ return ['TSM_ME','TSM_SE'].includes(a.team); });
    var relevantAccts = tsmAccts;
    if (CS_USER_CONTEXT.role === 'SM') relevantAccts = tsmAccts.filter(function(a){ return a.sm === CS_USER_CONTEXT.userName; });
    else if (CS_USER_CONTEXT.role === 'LM') relevantAccts = tsmAccts.filter(function(a){ return a.lm === CS_USER_CONTEXT.userName; });
    var codes = relevantAccts.map(function(a){ return a.code; });
    var hcData = CS_HEALTH_CHECKS.filter(function(h){ return codes.includes(h.accountCode); });
    var sms = [...new Set(relevantAccts.map(function(a){ return a.sm; }))].filter(Boolean);

    if (hcData.length === 0) {
        [volId, reachId, smActId, reachTrendId, freqId, momId].forEach(function(id) {
            var el = document.getElementById(id);
            if (el && el.parentElement) el.parentElement.innerHTML = '<div style="text-align:center;padding:60px 20px;color:var(--t3);">No data yet</div>';
        });
        var nt = document.getElementById(notTouchedId);
        if (nt) nt.innerHTML = '<div style="padding:20px;color:var(--t3);text-align:center;">No health check data recorded</div>';
        return;
    }

    // Build month map
    var monthMap = {};
    hcData.forEach(function(h) {
        if (!h.date) return;
        var key = h.date.substring(0, 7);
        monthMap[key] = (monthMap[key] || 0) + 1;
    });
    var monthKeys = Object.keys(monthMap).sort().slice(-8);

    // 1. Volume chart
    var vc = document.getElementById(volId);
    if (vc) {
        var grad = vc.getContext('2d').createLinearGradient(0,0,0,260);
        grad.addColorStop(0,'rgba(76,111,255,0.3)'); grad.addColorStop(1,'rgba(76,111,255,0.02)');
        vc._chart = new Chart(vc, {
            type:'line',
            data:{ labels:monthKeys, datasets:[{ label:'Interactions', data:monthKeys.map(function(k){ return monthMap[k]||0; }), borderColor:du.p1, backgroundColor:grad, fill:true, tension:.35, pointRadius:5, pointBackgroundColor:du.p1, pointBorderColor:'#fff', pointBorderWidth:2, borderWidth:2.5 }]},
            options:{ responsive:true, maintainAspectRatio:false, plugins:{ datalabels:{display:false}, legend:{display:false} }, scales:{ x:{ticks:{color:c.text},grid:{color:c.grid}}, y:{beginAtZero:true,ticks:{color:c.text},grid:{color:c.grid}} }}
        });
    }

    // 2. Reachable donut
    var reachYes = hcData.filter(function(h){ return h.reachable==='Yes'; }).length;
    var reachNo  = hcData.filter(function(h){ return h.reachable==='No'; }).length;
    var rc = document.getElementById(reachId);
    if (rc) rc._chart = new Chart(rc, {
        type:'doughnut',
        data:{ labels:['Reachable','Not Reachable'], datasets:[{ data:[reachYes,reachNo], backgroundColor:[du.p1,du.p3], borderWidth:4, borderColor:'var(--bg-card)', hoverOffset:10 }]},
        options:{ responsive:true, maintainAspectRatio:false, cutout:'55%', plugins:{ datalabels:{display:false}, legend:{position:'bottom', labels:{color:c.text, font:{size:11}, usePointStyle:true}} }}
    });

    // 3. SM Activity bar
    var smActivity = sms.map(function(sm) {
        var smCodes = relevantAccts.filter(function(a){ return a.sm===sm; }).map(function(a){ return a.code; });
        return { sm:sm, count:hcData.filter(function(h){ return smCodes.includes(h.accountCode); }).length };
    }).sort(function(a,b){ return b.count-a.count; });
    var duColors = [du.p1, du.p2, du.p3, du.p4, du.p5];
    var sac = document.getElementById(smActId);
    if (sac) sac._chart = new Chart(sac, {
        type:'bar',
        data:{ labels:smActivity.map(function(s){ return s.sm; }), datasets:[{ label:'Interactions', data:smActivity.map(function(s){ return s.count; }), backgroundColor:smActivity.map(function(_,i){ return duColors[i%5]; }), borderRadius:6, maxBarThickness:28 }]},
        options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false, plugins:{ datalabels:{display:false}, legend:{display:false} }, scales:{ x:{beginAtZero:true,ticks:{color:c.text},grid:{color:c.grid}}, y:{ticks:{color:c.text,font:{size:11}},grid:{display:false}} }}
    });

    // 4. Reachability trend line
    var rtc = document.getElementById(reachTrendId);
    if (rtc) rtc._chart = new Chart(rtc, {
        type:'line',
        data:{ labels:monthKeys, datasets:[
            { label:'Reachable %', data:monthKeys.map(function(k){ var m=hcData.filter(function(h){ return h.date&&h.date.startsWith(k); }); return m.length?+((m.filter(function(h){ return h.reachable==='Yes'; }).length/m.length)*100).toFixed(1):0; }), borderColor:du.p1, backgroundColor:'rgba(76,111,255,0.1)', fill:true, tension:.35, pointRadius:4, pointBackgroundColor:du.p1, borderWidth:2.5 },
            { label:'Not Reachable %', data:monthKeys.map(function(k){ var m=hcData.filter(function(h){ return h.date&&h.date.startsWith(k); }); return m.length?+((m.filter(function(h){ return h.reachable==='No'; }).length/m.length)*100).toFixed(1):0; }), borderColor:du.p3, backgroundColor:'rgba(199,36,177,0.08)', fill:true, tension:.35, pointRadius:4, pointBackgroundColor:du.p3, borderWidth:2.5 }
        ]},
        options:{ responsive:true, maintainAspectRatio:false, plugins:{ datalabels:{display:false}, legend:{position:'top', labels:{color:c.text, font:{size:11}, usePointStyle:true}} }, scales:{ x:{ticks:{color:c.text},grid:{color:c.grid}}, y:{min:0,max:100,ticks:{color:c.text,callback:function(v){ return v+'%'; }},grid:{color:c.grid}} }}
    });

    // 5. Frequency per account
    var freqData = codes.map(function(code) {
        var acct = CS_ACCOUNTS.find(function(a){ return a.code===code; });
        return { label:(acct?acct.customer:'').substring(0,18), count:hcData.filter(function(h){ return h.accountCode===code; }).length };
    }).filter(function(s){ return s.count>0; }).sort(function(a,b){ return b.count-a.count; }).slice(0,10);
    var fc = document.getElementById(freqId);
    if (fc) fc._chart = new Chart(fc, {
        type:'bar',
        data:{ labels:freqData.map(function(s){ return s.label; }), datasets:[{ label:'Interactions', data:freqData.map(function(s){ return s.count; }), backgroundColor:du.p2, borderRadius:6, maxBarThickness:28 }]},
        options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false, plugins:{ datalabels:{display:false}, legend:{display:false} }, scales:{ x:{beginAtZero:true,ticks:{color:c.text},grid:{color:c.grid}}, y:{ticks:{color:c.text,font:{size:10}},grid:{display:false}} }}
    });

    // 6. MoM SM comparison
    var lastMonths = monthKeys.slice(-4);
    var momc = document.getElementById(momId);
    if (momc) momc._chart = new Chart(momc, {
        type:'bar',
        data:{ labels:lastMonths, datasets:sms.map(function(sm,i) {
            var smCodes = relevantAccts.filter(function(a){ return a.sm===sm; }).map(function(a){ return a.code; });
            return { label:sm, data:lastMonths.map(function(k){ return hcData.filter(function(h){ return smCodes.includes(h.accountCode)&&h.date&&h.date.startsWith(k); }).length; }), backgroundColor:duColors[i%5]+'99', borderColor:duColors[i%5], borderWidth:1.5, borderRadius:4, maxBarThickness:20 };
        })},
        options:{ responsive:true, maintainAspectRatio:false, plugins:{ datalabels:{display:false}, legend:{position:'top', labels:{color:c.text, font:{size:10}, usePointStyle:true, padding:10}} }, scales:{ x:{ticks:{color:c.text},grid:{display:false}}, y:{beginAtZero:true,ticks:{color:c.text},grid:{color:c.grid}} }}
    });

    // 7. Not touched
    var nt = document.getElementById(notTouchedId);
    if (nt) {
        var now = new Date();
        var thisMonth = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
        var touchedCodes = new Set(hcData.filter(function(h){ return h.date&&h.date.startsWith(thisMonth); }).map(function(h){ return h.accountCode; }));
        var notTouched = relevantAccts.filter(function(a){ return !touchedCodes.has(a.code); });
        if (!notTouched.length) {
            nt.innerHTML = '<div style="text-align:center;padding:20px;color:'+du.p1+';font-weight:700;">✅ All accounts touched this month!</div>';
        } else {
            nt.innerHTML = '<div style="font-size:12px;color:var(--t3);margin-bottom:8px;">'+notTouched.length+' accounts with no health check this month</div>' +
                '<div style="display:flex;flex-direction:column;gap:6px;max-height:280px;overflow-y:auto;">' +
                notTouched.slice(0,20).map(function(a) {
                    return '<div style="display:flex;align-items:center;gap:12px;padding:8px 12px;background:rgba(76,111,255,0.05);border-radius:8px;border:1px solid rgba(76,111,255,0.15);">' +
                        '<div style="flex:1;"><div style="font-size:.84rem;font-weight:700;color:var(--t1);">'+a.code+'</div><div style="font-size:.72rem;color:var(--t3);">'+a.customer+'</div></div>' +
                        '<div style="font-size:.75rem;color:var(--t3);">'+a.sm+'</div>' +
                        '<div style="font-size:.72rem;font-weight:700;color:'+du.p3+';">No HC this month</div>' +
                        '</div>';
                }).join('') + '</div>';
        }
    }
}
window.csToggleCharts = function() {
    csEnsureAnalyticsHost();
    const wrap = document.getElementById('csChartsWrap');
    const btn  = document.getElementById('csChartsBtnText');
    const icon = document.getElementById('csChartsIcon');
    if (!wrap) {
        CS_CHARTS_VISIBLE = true;
        csRenderAnalytics();
        return;
    }
    CS_CHARTS_VISIBLE = wrap.style.display === 'none';
    wrap.style.display = CS_CHARTS_VISIBLE ? 'block' : 'none';
    if (btn) btn.textContent = CS_CHARTS_VISIBLE ? 'Hide Analytics Charts' : 'Show Analytics Charts';
    if (icon) icon.setAttribute('data-lucide', CS_CHARTS_VISIBLE ? 'eye-off' : 'eye');
    if (typeof lucide !== 'undefined') lucide.createIcons();

    if (CS_CHARTS_VISIBLE) {
        setTimeout(function() { csRenderActiveTabCharts(); }, 100);
    }
};

// ─── APPLY FILTERS ─────────────────────────────────────────────────────────────
window.csApplyFilters = function () {
    try {
        const typeF   = document.getElementById('csReviewTypeFilter').value;
        const statusF = document.getElementById('csStatusFilter').value;
        const searchT = document.getElementById('csSearchBox').value.toLowerCase();

        const filtered = csGetDashboardReviewsFiltered({ typeF, statusF, searchT });

        const rowData = filtered.map(review => {
            const account = CS_ACCOUNTS.find(a => a.code === review.accountCode);
            if (!account) return null;
            const reviewType = account.team==='DSM'?'MSR':'QSR';
            const history = csGetSurveyHistory(account.code);
            let isOverdue = false;
            if (review.dueDate) {
                const due=new Date(review.dueDate),today=new Date(); today.setHours(0,0,0,0);
                isOverdue = due<today&&!['Completed','Not Applicable','Customer Declined','Failed','Unreachable','No Show'].includes(review.status);
            }
            return {
                type:reviewType, period:review.period, accountCode:account.code,
                customer:account.customer, team:account.team, sm:account.sm, lm:account.lm,
                status:review.status, dueDate:review.dueDate||'-',
                reviewId:review.id,
                // Attempt 1
                attempt1Date:review.attempt1Date||'-', eventRef1:review.eventRef1||'-', reachable1:review.reachable1||'-',
                // Attempt 2
                attempt2Date:review.attempt2Date||'-', eventRef2:review.eventRef2||'-', reachable2:review.reachable2||'-',
                // Attempt 3
                attempt3Date:review.attempt3Date||'-', eventRef3:review.eventRef3||'-', reachable3:review.reachable3||'-',
                // Agreed / review day
                reviewDateAgreed:review.reviewDateAgreed||'-',
                agreedDate:review.agreedDate||'-',
                reviewNotes:review.reviewNotes||'-',
                actionItems:review.actionItems||'-',
                // POC
                pocName:account.pocName, pocEmail:account.pocEmail, pocContact:account.pocContact,
                // History
                completedSurveys:history.completedText, notCompleted:history.notCompletedText,
                isOverdue
            };
        }).filter(r=>r!==null);

        if (!csGridApi) { csInitGrid(rowData); }
        else { csGridApi.setGridOption('rowData', rowData); }
        if (CS_CHARTS_VISIBLE && CS_ACTIVE_TAB !== 'HC') {
            setTimeout(function() { csRenderActiveTabCharts(); }, 150);
        }
    } catch (err) { console.error('CS Filter error:', err); }
};;

function csGetSurveyHistory(accountCode) {
    const r = CS_REVIEWS.filter(x=>x.accountCode===accountCode);
    const total=r.length, comp=r.filter(x=>x.status==='Completed').length;
    const pct = total>0?Math.round((comp/total)*100):0;
    return { completedText:`${comp}/${total} (${pct}%)`, notCompletedText:`${total-comp}/${total} (${100-pct}%)` };
}

// ─── AG GRID (SM-style set column filters) ─────────────────────────────────────
(function csRegisterSetColumnFilter() {
    if (typeof window.SmSetColumnFilter === 'function') return;

    function SmSetColumnFilter() {}
    SmSetColumnFilter.prototype.init = function (params) {
        this.params = params;
        this.selected = new Set();
        this.gui = document.createElement('div');
        this.gui.className = 'sm-ag-set-filter';
        this._buildGui();
    };
    SmSetColumnFilter.prototype._cellValue = function (data) {
        var colDef = this.params.colDef;
        var v;
        if (typeof colDef.filterValueGetter === 'function') {
            v = colDef.filterValueGetter({ data: data, colDef: colDef, api: this.params.api, column: this.params.column });
        } else if (typeof colDef.valueGetter === 'function') {
            v = colDef.valueGetter({ data: data, colDef: colDef, api: this.params.api, column: this.params.column });
        } else {
            v = data[colDef.field];
        }
        if (v === null || v === undefined || v === '') return '—';
        if (colDef.type === 'numericColumn' || typeof v === 'number') {
            return typeof formatCurrency === 'function' ? formatCurrency(v) : String(v);
        }
        return String(v);
    };
    SmSetColumnFilter.prototype._allValues = function () {
        var values = new Set(), self = this;
        this.params.api.forEachNode(function (node) {
            if (node.data) values.add(self._cellValue(node.data));
        });
        return Array.from(values).sort(function (a, b) { return a.localeCompare(b); });
    };
    SmSetColumnFilter.prototype._buildGui = function () {
        var self = this, all = this._allValues();
        this.gui.innerHTML = '';
        var search = document.createElement('input');
        search.type = 'text';
        search.placeholder = 'Search...';
        search.className = 'sm-ag-set-search';
        this.gui.appendChild(search);
        var list = document.createElement('div');
        list.className = 'sm-ag-set-list';
        this.gui.appendChild(list);
        var render = function (term) {
            list.innerHTML = '';
            all.filter(function (v) { return !term || v.toLowerCase().indexOf(term.toLowerCase()) >= 0; }).forEach(function (v) {
                var row = document.createElement('label');
                row.className = 'sm-ag-set-option';
                var cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.checked = self.selected.has(v);
                cb.onchange = function () {
                    if (cb.checked) self.selected.add(v); else self.selected.delete(v);
                    self.params.filterChangedCallback();
                };
                row.appendChild(cb);
                row.appendChild(document.createTextNode(' ' + v));
                list.appendChild(row);
            });
        };
        render('');
        search.oninput = function () { render(search.value); };
        var actions = document.createElement('div');
        actions.className = 'sm-ag-set-actions';
        var btnAll = document.createElement('button');
        btnAll.type = 'button';
        btnAll.textContent = 'Select all';
        btnAll.onclick = function () { all.forEach(function (v) { self.selected.add(v); }); render(search.value); self.params.filterChangedCallback(); };
        var btnClear = document.createElement('button');
        btnClear.type = 'button';
        btnClear.textContent = 'Clear';
        btnClear.onclick = function () { self.selected.clear(); render(search.value); self.params.filterChangedCallback(); };
        actions.appendChild(btnAll);
        actions.appendChild(btnClear);
        this.gui.appendChild(actions);
    };
    SmSetColumnFilter.prototype.getGui = function () { return this.gui; };
    SmSetColumnFilter.prototype.isFilterActive = function () { return this.selected.size > 0; };
    SmSetColumnFilter.prototype.doesFilterPass = function (params) {
        if (!this.selected.size) return true;
        return this.selected.has(this._cellValue(params.data));
    };
    SmSetColumnFilter.prototype.getModel = function () { return this.selected.size ? { values: Array.from(this.selected) } : null; };
    SmSetColumnFilter.prototype.setModel = function (model) {
        this.selected = new Set(model && model.values ? model.values : []);
        this._buildGui();
    };
    SmSetColumnFilter.prototype.destroy = function () {};

    window.SmSetColumnFilter = SmSetColumnFilter;
})();

function csEnhanceColDef(col) {
    if (!col.field || col.filter === false) return col;
    var enhanced = Object.assign({}, col);
    enhanced.filter = window.SmSetColumnFilter;
    return enhanced;
}

function csMapColumnDefs(columnDefs) {
    return columnDefs.map(function (col) {
        if (!col.field || col.filter === false) return col;
        return csEnhanceColDef(Object.assign({}, col));
    });
}

function csInitGrid(rowData) {
    const statusMap = {
        'Completed':'cs-badge-completed','In Progress':'cs-badge-in-progress',
        'Pending':'cs-badge-pending','Not Applicable':'cs-badge-not-applicable',
        'Customer Declined':'cs-badge-customer-declined','Failed':'cs-badge-failed',
        'Unreachable':'cs-badge-unreachable','No Show':'cs-badge-no-show'
    };
    const statusIcon = s => ({'Completed':'✓','In Progress':'⟳','Pending':'○','Not Applicable':'∅','Customer Declined':'−','Failed':'✕','Unreachable':'✕','No Show':'○'})[s]||'○';

    const dash = v => (!v || v==='-') ? '<span style="color:var(--t3);">—</span>' : v;
    const reachBadge = v => v==='Yes'
        ? `<span style="font-weight:700;color:#10b981;">Yes</span>`
        : v==='No'
        ? `<span style="font-weight:700;color:#ef4444;">No</span>`
        : '<span style="color:var(--t3);">—</span>';

    const columnDefs = [
        { field:'period',           headerName:'Period',            width:100, pinned:'left' },
        { field:'accountCode',      headerName:'Account',           width:130, pinned:'left', cellStyle:{fontWeight:'700'} },
        { field:'customer',         headerName:'Customer',          flex:1, minWidth:180 },
        { field:'team',             headerName:'Team',              width:85 },
        { field:'sm',               headerName:'Service Manager',   width:155, cellStyle:{fontWeight:'600'} },
        { field:'lm',               headerName:'Line Manager',      width:145 },
        { field:'pocName',          headerName:'POC name',          width:140 },
        { field:'pocContact',       headerName:'POC contact',       width:125 },
        { field:'status',           headerName:'Status',            width:165,
          cellRenderer: p=>`<span class="cs-status-badge ${statusMap[p.value]||'cs-badge-pending'}">${statusIcon(p.value)} ${p.value}</span>` },
        { field:'dueDate',          headerName:'Due date',          width:110 },
        { field:'attempt1Date',     headerName:'Att.1 date',        width:115, cellRenderer: p=>p.value&&p.value!=='-'?`📅 ${p.value}`:dash(p.value) },
        { field:'eventRef1',        headerName:'Att.1 ref',         width:120, cellRenderer: p=>dash(p.value) },
        { field:'reachable1',       headerName:'Reachable 1',       width:110, cellRenderer: p=>reachBadge(p.value) },
        { field:'attempt2Date',     headerName:'Att.2 date',        width:115, cellRenderer: p=>p.value&&p.value!=='-'?`📅 ${p.value}`:dash(p.value) },
        { field:'eventRef2',        headerName:'Att.2 ref',         width:120, cellRenderer: p=>dash(p.value) },
        { field:'reachable2',       headerName:'Reachable 2',       width:110, cellRenderer: p=>reachBadge(p.value) },
        { field:'attempt3Date',     headerName:'Att.3 date',        width:115, cellRenderer: p=>p.value&&p.value!=='-'?`📅 ${p.value}`:dash(p.value) },
        { field:'eventRef3',        headerName:'Att.3 ref',         width:120, cellRenderer: p=>dash(p.value) },
        { field:'reachable3',       headerName:'Reachable 3',       width:110, cellRenderer: p=>reachBadge(p.value) },
        { field:'reviewDateAgreed', headerName:'Date agreed?',      width:115, cellRenderer: p=>reachBadge(p.value) },
        { field:'agreedDate',       headerName:'Agreed date',       width:115, cellRenderer: p=>p.value&&p.value!=='-'?`📅 ${p.value}`:dash(p.value) },
        { field:'reviewNotes',      headerName:'Review notes',      width:180, cellRenderer: p=>p.value&&p.value!=='-'?`<span title="${p.value}">${p.value}</span>`:dash(p.value) },
        { field:'attachments', headerName:'Attachments', width:160, filter:false, sortable:false,
          cellRenderer: p => `<button type="button" onclick="csLoadRowAttachments(${p.data.reviewId}, this)"
              style="padding:4px 10px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:6px;font-size:11px;color:var(--acc);cursor:pointer;">
              📎 View Files
          </button>`
        },
        { field:'completedSurveys', headerName:'Completed',         width:115, filter:false, cellStyle:{fontWeight:'600',color:'#10b981',fontSize:'12px'} },
        { field:'notCompleted',     headerName:'Not completed',     width:125, filter:false, cellStyle:{fontWeight:'600',color:'var(--danger)',fontSize:'12px'} },
        { field:'actions',          headerName:'',                  width:85, pinned:'right', sortable:false, filter:false,
          cellRenderer: p=>`<button type="button" class="export-btn" onclick="csViewDetails('${p.data.period}','${p.data.accountCode}',event)" style="padding:5px 12px;font-size:11px;">View</button>` }
    ];

    const gridDiv = document.getElementById('csGrid');
    if (csGridApi) { try { csGridApi.destroy(); } catch(e){} csGridApi = null; }
    gridDiv.innerHTML = '';

    agGrid.createGrid(gridDiv, {
        columnDefs: csMapColumnDefs(columnDefs),
        rowData,
        defaultColDef: { sortable:true, filter:true, resizable:true, minWidth:80 },
        pagination:true, paginationPageSize:50, paginationPageSizeSelector:[25,50,100,200],
        rowHeight:60, headerHeight:50, animateRows:true, enableCellTextSelection:true,
        suppressMenuHide:false,
        onGridReady: p => {
            csGridApi = p.api;
            // Restore AG Grid search behavior (quick filter)
            const sb = document.getElementById('csSearchBox');
            if (sb) {
                const apply = () => {
                    try { csGridApi.setQuickFilter(sb.value || ''); } catch(e) {}
                };
                // avoid stacking listeners across re-inits
                if (!sb._csQuickFilterBound) {
                    sb.addEventListener('input', () => { apply(); csRenderKPIs(); csRenderTiles(); csRenderAnalytics(); csApplyFilters(); });
                    sb._csQuickFilterBound = true;
                }
                apply();
            }
        },
        getRowStyle: p => p.data.isOverdue ? {background:'rgba(239,68,68,0.06)',borderLeft:'3px solid var(--danger)'} : null,
        getRowId: p => `cs_${p.data.reviewId}`
    });
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ─── VIEW DETAILS MODAL (v3 — clean hide/show) ────────────────────────────────
window.csViewDetails = async function (period, accountCode, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }

    const review  = CS_REVIEWS.find(r => r.period === period && r.accountCode === accountCode);
    const account = CS_ACCOUNTS.find(a => a.code === accountCode);
    if (!review || !account) { alert('Review not found!'); return; }

    csShowLoading('Loading review...');

    const terminal = ['Completed','Customer Declined','Unreachable','Failed','Not Applicable','No Show'];
  const canEdit = !terminal.includes(review.status) &&
    (CS_USER_CONTEXT.role === 'SD' ||
     (CS_USER_CONTEXT.role === 'SM' && account.sm === CS_USER_CONTEXT.userName));

    // Only unlock next attempt if previous one has a date AND reachable=No saved
    const show1 = true;
    const show2 = !!(review.attempt1Date && review.reachable1 === 'No');
    const show3 = !!(review.attempt2Date && review.reachable2 === 'No');

    const S = { // style shortcuts
        inp: `width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;font-family:inherit;background:var(--bg-input);color:var(--t1);box-sizing:border-box;`,
        ro:  `width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg-secondary);color:var(--t2);cursor:not-allowed;box-sizing:border-box;`,
        lbl: `font-size:11px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:0.05em;display:block;margin-bottom:6px;`,
        sec: `background:var(--bg-secondary);padding:16px;border-radius:10px;border:1px solid var(--border);margin-top:14px;`,
        btn: (active, colorY) => active
            ? `flex:1;padding:10px;border-radius:8px;border:2px solid ${colorY};background:${colorY==='#1D9E75'?'#e1f5ee':'#faece7'};color:${colorY==='#1D9E75'?'#085041':'#712b13'};font-size:13px;font-weight:700;cursor:pointer;`
            : `flex:1;padding:10px;border-radius:8px;border:1.5px solid var(--border);background:var(--bg-input);color:var(--t2);font-size:13px;font-weight:600;cursor:pointer;`
    };

    // ── ATTEMPT BLOCK BUILDER — only date, ref, reachable ─────────────────────
    const attemptBlock = (num, colorScheme, data, forceLocked) => {
        const locked = !canEdit || forceLocked;
        const cs = {
            blue:  { border:'#85b7eb', bg:'rgba(230,241,251,0.3)', label:'#185fa5' },
            amber: { border:'#ef9f27', bg:'rgba(250,238,218,0.3)', label:'#854f0b' },
            red:   { border:'#f09595', bg:'rgba(252,235,235,0.3)', label:'#a32d2d' }
        }[colorScheme];

        // Only restore saved reachable if this attempt was actually submitted (date exists)
        const reach = (data.date && (data.reachable === 'Yes' || data.reachable === 'No')) ? data.reachable : '';

        return `
        <div style="border:1.5px dashed ${cs.border};border-radius:12px;padding:18px;background:${cs.bg};margin-bottom:14px;">
                        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:${cs.label};margin-bottom:16px;">
                Attempt ${num}${num>1?' — min 1 day after attempt '+(num-1):''}
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
                <div>
                    <label style="${S.lbl}">Date *</label>
                    ${locked ? `<input type="hidden" id="csA${num}Date" value="${data.date||''}"><div style="${S.ro}">${data.date||'—'}</div>` : `<input type="date" id="csA${num}Date" value="${data.date||''}" style="${S.inp}">`}
                </div>
                <div>
                    <label style="${S.lbl}">Call / event ref no. *</label>
                    ${locked ? `<input type="hidden" id="csA${num}Ref" value="${data.ref||''}"><div style="${S.ro}">${data.ref||'—'}</div>` : `<input type="text" id="csA${num}Ref" value="${data.ref||''}" placeholder="e.g. EVT-20240401-001" style="${S.inp}">`}
                </div>
            </div>
            <div>
                <label style="${S.lbl}">Customer reachable? *</label>
                <input type="hidden" id="csA${num}Reach" value="${reach}">
                ${locked
                    ? `<div style="${S.ro}">${reach||'—'}</div>`
                    : `<div style="display:flex;gap:8px;">
                        <button type="button" id="csA${num}ReachYes" onclick="csSetReachable(${num},'Yes')"
                            style="${S.btn(reach==='Yes','#1D9E75')}">Yes — reachable</button>
                        <button type="button" id="csA${num}ReachNo"  onclick="csSetReachable(${num},'No')"
                            style="${S.btn(reach==='No','#D85A30')}">No — not reachable</button>
                       </div>`
                }
            </div>
        </div>`;
    };

    // ── WHICH ATTEMPT WAS REACHABLE (to restore agreed/outcome section) ────────
    // Find the attempt number that had reachable=Yes (if any)
    // Only count an attempt as reachable if it has a date saved too
    const reachableAttempt = (review.attempt1Date && review.reachable1==='Yes') ? 1
        : (review.attempt2Date && review.reachable2==='Yes') ? 2
        : (review.attempt3Date && review.reachable3==='Yes') ? 3 : 0;
    const savedAgreed  = reachableAttempt > 0 && (review.reviewDateAgreed==='Yes'||review.reviewDateAgreed==='No') ? review.reviewDateAgreed : '';
    const savedOutcome = (reachableAttempt > 0 && savedAgreed==='Yes' && (review.status==='Completed'||review.status==='No Show'))
        ? (review.status==='Completed'?'Yes':'No') : '';

    // ── AGREED + REVIEW DAY SECTION (rendered once, outside attempt blocks) ────
    const agreedSection = !canEdit ? `
        <div style="background:var(--bg-secondary);padding:16px;border-radius:10px;border:1px solid var(--border);margin-bottom:14px;">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:var(--t3);margin-bottom:12px;">Review date agreed</div>
            <div style="${S.ro}">${savedAgreed||'—'}</div>
            ${savedAgreed==='Yes' ? `
            <div style="margin-top:12px;">
                <label style="${S.lbl}">Agreed review date</label>
                <input type="date" value="${review.agreedDate||''}" readonly disabled style="${S.ro}">
            </div>
            <div style="margin-top:14px;background:var(--bg-secondary);padding:14px;border-radius:8px;border:1px solid var(--border);">
                <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:var(--t3);margin-bottom:12px;">On review day</div>
                <div style="${S.ro}">${savedOutcome==='Yes'?'Customer joined':'savedOutcome'==='No'?'No show':'—'}</div>
                ${review.reviewNotes?`<div style="margin-top:10px;"><label style="${S.lbl}">Notes</label><div style="${S.ro}">${review.reviewNotes}</div></div>`:''}
            </div>` : ''}
        </div>` :
    /* EDITABLE version — only show if a reachable attempt exists in saved data OR user just clicked Yes on current form */
    `<div id="csAgreedSection" style="display:${reachableAttempt>0?'block':'none'};">
        <div style="background:var(--bg-secondary);padding:16px;border-radius:10px;border:1px solid var(--border);margin-bottom:14px;">
            <label style="${S.lbl}">Review date agreed? *</label>
            <div style="display:flex;gap:8px;margin-bottom:0;">
                <button type="button" id="csAgreeYesBtn" onclick="csSetAgreed(0,'Yes')"
                    style="${S.btn(savedAgreed==='Yes','#1D9E75')}">Yes — agreed on date</button>
                <button type="button" id="csAgreeNoBtn"  onclick="csSetAgreed(0,'No')"
                    style="${S.btn(savedAgreed==='No','#D85A30')}">No — customer declined</button>
            </div>
            <input type="hidden" id="csAgreedVal" value="${savedAgreed}">

            <div id="csAgreedYesBlock" style="display:${savedAgreed==='Yes'?'block':'none'};margin-top:14px;">
                <label style="${S.lbl}">Agreed review date *</label>
               <input type="date" id="csAgreedDate" value="${review.agreedDate||''}" onchange="csAgreedDateChanged(this)" style="${S.inp}">
            </div>
            <div id="csAgreedNoBlock" style="display:${savedAgreed==='No'?'block':'none'};margin-top:12px;">
                <div style="padding:10px 14px;background:rgba(216,90,48,0.1);border-radius:8px;border-left:3px solid #D85A30;font-size:13px;color:#712b13;">
                    Status will be saved as <strong>Customer Declined</strong>.
                </div>
            </div>
        </div>

        <div id="csReviewDayBlock" style="display:${savedAgreed==='Yes'?'block':'none'};">
            <div style="background:var(--bg-secondary);padding:16px;border-radius:10px;border:1px solid var(--border);margin-bottom:14px;">
                <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:var(--t3);margin-bottom:14px;">On review day</div>
                ${(()=>{
                    const agrD = review.agreedDate ? new Date(review.agreedDate) : null;
                    const tod  = new Date(); tod.setHours(0,0,0,0);
                  if (agrD) agrD.setHours(0,0,0,0);
                    const isFuture = agrD && agrD > tod;
                    return `
                        <div id="csReviewDayFuture" style="display:${isFuture?'block':'none'};padding:10px 14px;background:rgba(59,130,246,0.08);border-radius:8px;border-left:3px solid #3b82f6;font-size:13px;color:#1d4ed8;margin-bottom:12px;">
                            Review date is in the future — come back on the day to mark the outcome.
                        </div>
                       <div id="csJoinDiv" style="display:${isFuture?'none':'block'};">

                            <!-- STEP 1: Review Mode — always first -->
                            <div style="margin-bottom:14px;">
                                <label style="${S.lbl}">Review mode *</label>
                                <input type="hidden" id="csReviewModeVal" value="${review.reviewMode||''}">
                           <div style="display:flex;gap:8px;">
                                    <button type="button" id="csReviewModeOnsite" onclick="csSetReviewMode('Onsite')"
                                        style="${S.btn((review.reviewMode||'')==='Onsite','#1D9E75')}">Onsite</button>
                                    <button type="button" id="csReviewModeOffsite" onclick="csSetReviewMode('Offsite')"
                                        style="${S.btn((review.reviewMode||'')==='Offsite','#D85A30')}">Offsite / Online</button>
                                </div>
                            </div>

                            <!-- STEP 2: Conditional on mode — hidden until mode selected -->
                            <div id="csModeDetailsBlock" style="display:${review.reviewMode?'block':'none'};">

                              <!-- Single csJoinedVal — always present -->
                                <input type="hidden" id="csJoinedVal" value="${savedOutcome}">

                                <!-- For Onsite/Offsite: Did customer join -->
                                <div id="csJoinQuestion" style="display:${['Onsite','Offsite'].includes(review.reviewMode||'')?'block':'none'};margin-bottom:14px;">
                                    <label style="${S.lbl}">Did customer join? *</label>
                                    <div style="display:flex;gap:8px;">
                                        <button type="button" id="csJoinYes" onclick="csSetJoined('Yes')"
                                            style="${S.btn(savedOutcome==='Yes','#1D9E75')}">Yes — joined</button>
                                        <button type="button" id="csJoinNo"  onclick="csSetJoined('No')"
                                            style="${S.btn(savedOutcome==='No','#D85A30')}">No — no show</button>
                                    </div>
                                </div>

                                

                                <!-- LM Attended: only for Onsite/Offsite AND customer joined -->
                                <div id="csLMAttendedBlock" style="display:${(['Onsite','Offsite'].includes(review.reviewMode||'') && savedOutcome==='Yes')?'block':'none'};margin-bottom:14px;">
                                    <label style="${S.lbl}">Line Manager attended? *</label>
                                    <input type="hidden" id="csLMAttendedVal" value="${review.lmAttended||''}">
                                    <div style="display:flex;gap:8px;">
                                        <button type="button" id="csLMAttYes" onclick="csSetLMAttended('Yes')"
                                            style="${S.btn((review.lmAttended||'')==='Yes','#1D9E75')}">Yes</button>
                                        <button type="button" id="csLMAttNo"  onclick="csSetLMAttended('No')"
                                            style="${S.btn((review.lmAttended||'')==='No','#D85A30')}">No</button>
                                    </div>
                                </div>

                            </div>
                        </div>`;
                })()}
                <div style="margin-bottom:12px;">
                    <label style="${S.lbl}">Review notes</label>
                    <textarea id="csReviewNotesFinal" rows="2" placeholder="Summary, feedback, next steps..." style="${S.inp}resize:vertical;">${review.reviewNotes||''}</textarea>
                </div>
               
            </div>
        </div>
    </div>`;

    // ── BUILD MODAL ────────────────────────────────────────────────────────────
    let modal = document.getElementById('csModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'csModal';
        modal.style.cssText = 'display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.65);z-index:10000;padding:20px;overflow-y:auto;';
        document.body.appendChild(modal);
    }

    // Status badge color helper
    const statusColor = s => ({'Completed':'#10b981','Customer Declined':'#D85A30','Unreachable':'#dc2626','No Show':'#b45309','Failed':'#dc2626','In Progress':'#f59e0b'})[s] || 'var(--t3)';

    modal.innerHTML = `
    <div style="background:var(--bg-card);border-radius:16px;padding:28px;max-width:760px;margin:40px auto;box-shadow:var(--ch);border:1px solid var(--border);">

        <!-- Header -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--border);">
            <div>
                <div style="font-size:18px;font-weight:800;color:var(--t1);margin-bottom:4px;">${canEdit?'Edit Review':'View Review'}</div>
                <div style="font-size:12px;color:var(--t3);">${account.customer} &nbsp;·&nbsp; ${period} &nbsp;·&nbsp; ${account.team}</div>
            </div>
            <button type="button" onclick="document.getElementById('csModal').style.display='none'"
                style="background:none;border:none;font-size:26px;cursor:pointer;color:var(--t3);line-height:1;padding:0 4px;">×</button>
        </div>

       

        <!-- Info strip -->
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:20px;">
            <div style="padding:12px;background:var(--bg-secondary);border-radius:10px;">
                <div style="font-size:10px;color:var(--t3);font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">Account</div>
                <div style="font-size:14px;font-weight:700;color:var(--t1);">${account.code}</div>
                <div style="font-size:11px;color:var(--t3);margin-top:2px;">${account.sm}</div>
            </div>
            <div style="padding:12px;background:var(--bg-secondary);border-radius:10px;">
                <div style="font-size:10px;color:var(--t3);font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">POC</div>
                <div style="font-size:13px;font-weight:600;color:var(--t1);">${account.pocName}</div>
                <div style="font-size:11px;color:var(--t3);margin-top:2px;">${account.pocContact}</div>
                <div style="font-size:11px;color:var(--acc);margin-top:2px;">${account.pocEmail !== '-' ? `<a href="mailto:${account.pocEmail}" style="color:var(--acc);text-decoration:none;">${account.pocEmail}</a>` : '—'}</div>
            </div>
            <div style="padding:12px;background:var(--bg-secondary);border-radius:10px;">
                <div style="font-size:10px;color:var(--t3);font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">Status</div>
                <div style="font-size:14px;font-weight:700;color:${statusColor(review.status)};">${review.status}</div>
                <div style="font-size:11px;color:var(--t3);margin-top:2px;">Due: ${review.dueDate||'—'}</div>
            </div>
        </div>
        ${!canEdit && !terminal.includes(review.status) ? `
        <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.3);color:#b45309;padding:10px 14px;border-radius:8px;margin-bottom:16px;font-size:12px;display:flex;align-items:center;gap:8px;">
            <i data-lucide="lock" style="width:14px;height:14px;flex-shrink:0;"></i>
            View only — only the assigned Service Manager can edit this review.
        </div>` : ''}
        ${terminal.includes(review.status) ? `
        <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.3);color:#dc2626;padding:10px 14px;border-radius:8px;margin-bottom:16px;font-size:12px;display:flex;align-items:center;gap:8px;">
            <i data-lucide="lock" style="width:14px;height:14px;flex-shrink:0;"></i>
            Locked — this review has reached a terminal status and cannot be edited.
        </div>` : ''}

       <form id="csReviewForm" onsubmit="csSaveReview(event);return false;">
            <!-- CUSTOMER ELIGIBILITY -->
            <div style="background:var(--bg-secondary);padding:16px;border-radius:10px;border:1px solid var(--border);margin-bottom:16px;">
                <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:var(--t3);margin-bottom:12px;">Customer Eligibility for ${account.team==='DSM'?'MSR':'QSR'}</div>
             <input type="hidden" id="csEligibilityVal" value="${review.eligibility||''}">
                ${!canEdit ? `<div style="padding:9px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg-input);color:var(--t2);">${review.eligibility||'—'}</div>` : `
                <div style="display:flex;gap:8px;margin-bottom:10px;">
                    <button type="button" id="csEligYes" onclick="csSetEligibility('Yes')"
                        style="${S.btn((review.eligibility||'')==='Yes','#1D9E75')}">✓ Eligible</button>
                    <button type="button" id="csEligNo"  onclick="csSetEligibility('No')"
                        style="${S.btn((review.eligibility||'')==='No','#D85A30')}">✗ Not eligible</button>
                </div>
                ${!(review.eligibility) ? `<div style="font-size:11px;color:#b45309;margin-top:4px;">⚠ Select eligibility first to proceed</div>` : ''}`}
                <div id="csEligNoBlock" style="display:${(review.eligibility||'')==='No'?'block':'none'};margin-top:10px;">
                    <label style="${S.lbl}">Reason *</label>
                    ${!canEdit
                        ? `<div style="padding:9px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg-input);color:var(--t2);">${review.eligibilityReason||'—'}</div>`
                        : `<textarea id="csEligReason" rows="2" placeholder="Explain why customer is not eligible..." style="${S.inp}resize:vertical;">${review.eligibilityReason||''}</textarea>`
                    }
                    <div style="margin-top:8px;">
                        <label style="${S.lbl}">Supporting attachment</label>
                        ${!canEdit ? '' : `<label style="display:inline-flex;align-items:center;gap:6px;padding:7px 14px;background:var(--grad);color:#fff;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">
                            <i data-lucide="paperclip" style="width:12px;height:12px;"></i> Attach file
                           <input type="file" id="csEligFile" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.msg,.eml" style="display:none;" onchange="var n=this.files[0]?this.files[0].name:''; document.getElementById('csEligFileName').textContent=n;">
                        </label>`}
                        <div id="csEligFileName" style="font-size:12px;color:var(--t3);margin-top:6px;"></div>
                    </div>
                </div>
            </div>
         <!-- ATTEMPTS BLOCK — hidden until eligibility selected -->
            <div id="csAttemptsBlock" style="display:${(review.eligibility||'')==='Yes'?'block':'none'};">
    <!-- PACK upload — shown when terminal status is reached -->
            <div id="csPackGlobal" style="display:none;background:rgba(239,68,68,0.06);border:1.5px dashed #ef4444;border-radius:10px;padding:16px;margin-bottom:14px;">
                <div style="font-size:11px;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:8px;">
                    ⚠️ PACK / MOM Attachment — Required
                </div>
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                    <label style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;background:var(--grad);color:#fff;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">
                        <i data-lucide="plus" style="width:13px;height:13px;"></i> Add Files
                        <input type="file" id="csPackFilesGlobal" multiple accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.msg,.eml" style="display:none;" onchange="csHandlePackFiles(this)">
                    </label>
                    <span style="font-size:11px;color:#dc2626;">Required for: Completed, No Show, Customer Declined, Unreachable, Failed</span>
                </div>
                <div id="csPackFilesList" style="display:flex;flex-direction:column;gap:6px;"></div>
            </div>
            <input type="hidden" id="csReviewId"         value="${review.id}">
            <input type="hidden" id="csPeriodHidden"      value="${period}">
            <input type="hidden" id="csAccountCodeHidden" value="${accountCode}">
            <input type="hidden" id="csShow2" value="${show2?'1':'0'}">
            <input type="hidden" id="csShow3" value="${show3?'1':'0'}">

            ${show1 ? attemptBlock(1,'blue',  {date:review.attempt1Date,ref:review.eventRef1,reachable:review.reachable1}, show2||show3) : ''}
            ${show2 ? attemptBlock(2,'amber', {date:review.attempt2Date,ref:review.eventRef2,reachable:review.reachable2}, show3) : ''}
            ${show3 ? attemptBlock(3,'red',   {date:review.attempt3Date,ref:review.eventRef3,reachable:review.reachable3}, false) : ''}

            ${!show2 && canEdit && review.reachable1==='No' ? `
            <div style="padding:12px 16px;background:rgba(245,158,11,0.07);border-radius:8px;border:1px dashed #ef9f27;text-align:center;font-size:13px;color:#854f0b;margin-bottom:14px;">
                Save attempt 1 first — Attempt 2 will unlock.
            </div>` : ''}
            ${!show3 && canEdit && review.reachable2==='No' ? `
            <div style="padding:12px 16px;background:rgba(226,75,74,0.07);border-radius:8px;border:1px dashed #f09595;text-align:center;font-size:13px;color:#a32d2d;margin-bottom:14px;">
                Save attempt 2 first — Attempt 3 will unlock.
            </div>` : ''}

            ${agreedSection}

        </div><!-- /csAttemptsBlock -->
           <div id="csAttachmentsSection" style="margin-bottom:16px;">
    <div style="font-size:11px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">Attachments</div>
    <div id="csAttachmentsList" style="font-size:13px;color:var(--t3);">Loading...</div>
</div>
<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:8px;padding-top:16px;border-top:1px solid var(--border);">
    <button type="button" onclick="document.getElementById('csModal').style.display='none'" class="reset-btn">Close</button>
    ${canEdit ? `<button type="submit" class="export-btn" style="min-width:100px;">
        <i data-lucide="save" style="width:13px;height:13px;display:inline-block;vertical-align:middle;margin-right:5px;"></i>Save
    </button>` : ''}
</div>
        </form>
    </div>`;
window._csPackFiles = [];
    csHideLoading();
    modal.style.display = 'block';
    if (typeof lucide !== 'undefined') lucide.createIcons();
    csCheckShowPackGlobal();
// Load attachments
csGetAttachments(review.id).then(atts => {
    const el = document.getElementById('csAttachmentsList');
    if (!el) return;
    if (!atts || atts.length === 0) {
        el.innerHTML = '<span style="color:var(--t3);font-size:12px;">No attachments</span>';
    } else {
        el.innerHTML = atts.map(a =>
            `<a href="http://sharedspaces:8086${a.url}" target="_blank"
                style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:6px;font-size:12px;color:var(--acc);text-decoration:none;margin:3px;">
                📎 ${a.name}
            </a>`
        ).join('');
    }
});
    
    
    
    
    
};

// ─── HELPERS (v3) ─────────────────────────────────────────────────────────────
// Store selected files across multiple selections
window._csPackFiles = [];

window.csHandlePackFiles = function(input) {
    const newFiles = Array.from(input.files);
    newFiles.forEach(f => {
        // avoid duplicates by name
        if (!window._csPackFiles.find(x => x.name === f.name)) {
            window._csPackFiles.push(f);
        }
    });
    // reset input so same file can be re-added if removed
    input.value = '';
    csRenderPackFilesList();
};

window.csRenderPackFilesList = function() {
    const list = document.getElementById('csPackFilesList');
    if (!list) return;
    if (window._csPackFiles.length === 0) {
        list.innerHTML = '<div style="font-size:12px;color:var(--t3);">No files selected</div>';
        return;
    }
    list.innerHTML = window._csPackFiles.map((f, i) => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:7px 10px;background:var(--bg-card);border:1px solid var(--border);border-radius:7px;">
            <div style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--t1);">
                <i data-lucide="paperclip" style="width:13px;height:13px;color:var(--acc);"></i>
                ${f.name}
                <span style="color:var(--t3);font-size:11px;">(${(f.size/1024).toFixed(1)} KB)</span>
            </div>
            <button type="button" onclick="csRemovePackFile(${i})"
                style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:#ef4444;border-radius:6px;padding:3px 8px;font-size:11px;cursor:pointer;">
                Remove
            </button>
        </div>
    `).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.csRemovePackFile = function(index) {
    window._csPackFiles.splice(index, 1);
    csRenderPackFilesList();
};
window.csHCSetReachable = function(val) {
    document.getElementById('csHCReachVal').value = val;
    const yBtn = document.getElementById('csHCReachYes');
    const nBtn = document.getElementById('csHCReachNo');
    csStyleBtn(yBtn, val==='Yes', 'green');
    csStyleBtn(nBtn, val==='No',  'red');
};
var csStyleBtn = function(btn, active, colorKey) {
    if (!btn) return;
    btn.style.borderWidth = active ? '2px' : '1.5px';
    btn.style.borderColor = active ? (colorKey==='green'?'#1D9E75':'#D85A30') : 'var(--border)';
    btn.style.background  = active ? (colorKey==='green'?'#e1f5ee':'#faece7') : 'var(--bg-input)';
    btn.style.color       = active ? (colorKey==='green'?'#085041':'#712b13') : 'var(--t2)';
    btn.style.fontWeight  = active ? '700' : '600';
};

window.csSetReachable = function(num, val) {
    document.getElementById('csA'+num+'Reach').value = val;
    csStyleBtn(document.getElementById('csA'+num+'ReachYes'), val==='Yes', 'green');
    csStyleBtn(document.getElementById('csA'+num+'ReachNo'),  val==='No',  'red');
    // Show the agreed section if any attempt is reachable=Yes
    const agreedSection = document.getElementById('csAgreedSection');
    if (agreedSection) agreedSection.style.display = val === 'Yes' ? 'block' : 'none';
    // Reset agreed/joined when switching
    if (val === 'Yes') {
        const agreedVal = document.getElementById('csAgreedVal');
        if (agreedVal && !agreedVal.value) {
            // Fresh — nothing to restore, keep hidden
            const yb = document.getElementById('csAgreedYesBlock');
            const nb = document.getElementById('csAgreedNoBlock');
            const rd = document.getElementById('csReviewDayBlock');
            if (yb) yb.style.display = 'none';
            if (nb) nb.style.display = 'none';
            if (rd) rd.style.display = 'none';
        }
    }
    csCheckShowPackGlobal();
};

window.csSetAgreed = function(num, val) {
    const hidden = document.getElementById('csAgreedVal');
    if (hidden) hidden.value = val;
    csStyleBtn(document.getElementById('csAgreeYesBtn'), val==='Yes', 'green');
    csStyleBtn(document.getElementById('csAgreeNoBtn'),  val==='No',  'red');
    const yb = document.getElementById('csAgreedYesBlock');
    const nb = document.getElementById('csAgreedNoBlock');
    const rd = document.getElementById('csReviewDayBlock');
    if (yb) yb.style.display = val==='Yes' ? 'block' : 'none';
    if (nb) nb.style.display = val==='No'  ? 'block' : 'none';
    if (rd) rd.style.display = val==='Yes' ? 'block' : 'none';
    const joinedVal = document.getElementById('csJoinedVal');
    if (joinedVal && val !== 'Yes') joinedVal.value = '';
    csCheckShowPackGlobal();
};

// When agreed date input changes, show/hide join fields based on future
window.csAgreedDateChanged = function(input) {
    if (!input.value) return;
   const agrD  = new Date(input.value); agrD.setHours(0,0,0,0);
    const tod   = new Date(); tod.setHours(0,0,0,0);
    const future = agrD > tod;
    const futMsg = document.getElementById('csReviewDayFuture');
    const joinDiv= document.getElementById('csJoinDiv');
    const pack   = document.getElementById('csPackBlock');
    if (futMsg)  futMsg.style.display  = future ? 'block' : 'none';
    if (joinDiv) joinDiv.style.display = future ? 'none'  : 'block';
    if (pack && future) pack.style.display = 'none';
    if (!future) { const jv = document.getElementById('csJoinedVal'); if (jv && !jv.value) {} }
};

window.csSetJoined = function(val) {
    const hidden = document.getElementById('csJoinedVal');
    if (hidden) hidden.value = val;

    // Style whichever buttons are visible
    csStyleBtn(document.getElementById('csJoinYes'), val==='Yes', 'green');
    csStyleBtn(document.getElementById('csJoinNo'),  val==='No',  'red');


    // LM Attended: only for Onsite/Offsite AND customer joined Yes
    const mode    = document.getElementById('csReviewModeVal')?.value || '';
    const lmBlock = document.getElementById('csLMAttendedBlock');
    if (lmBlock) {
        const showLM = (mode === 'Onsite' || mode === 'Offsite') && val === 'Yes';
        lmBlock.style.display = showLM ? 'block' : 'none';
        if (!showLM) {
            // clear LM selection when hidden
            const lmVal = document.getElementById('csLMAttendedVal');
            if (lmVal) lmVal.value = '';
            csStyleBtn(document.getElementById('csLMAttYes'), false, 'green');
            csStyleBtn(document.getElementById('csLMAttNo'),  false, 'red');
        }
    }

    csCheckShowPackGlobal();
};
window.csSetLMAttended = function(val) {
    document.getElementById('csLMAttendedVal').value = val;
    csStyleBtn(document.getElementById('csLMAttYes'), val==='Yes', 'green');
    csStyleBtn(document.getElementById('csLMAttNo'),  val==='No',  'red');
};
window.csSetReviewMode = function(val) {
    document.getElementById('csReviewModeVal').value = val;
    csStyleBtn(document.getElementById('csReviewModeOnsite'),  val==='Onsite',  'green');
    csStyleBtn(document.getElementById('csReviewModeOffsite'), val==='Offsite', 'red');

    const modeBlock = document.getElementById('csModeDetailsBlock');
    const joinQ     = document.getElementById('csJoinQuestion');
    const lmBlock   = document.getElementById('csLMAttendedBlock');
    const joinedVal = document.getElementById('csJoinedVal');

    if (modeBlock) modeBlock.style.display = 'block';
    if (joinQ)     joinQ.style.display     = 'block';
    if (lmBlock)   lmBlock.style.display   = 'none';

    if (joinedVal) joinedVal.value = '';
    csStyleBtn(document.getElementById('csJoinYes'),  false, 'green');
    csStyleBtn(document.getElementById('csJoinNo'),   false, 'red');
    csStyleBtn(document.getElementById('csLMAttYes'), false, 'green');
    csStyleBtn(document.getElementById('csLMAttNo'),  false, 'red');

    csCheckShowPackGlobal();
};
window.csSetEligibility = function(val) {
    document.getElementById('csEligibilityVal').value = val;
    csStyleBtn(document.getElementById('csEligYes'), val==='Yes', 'green');
    csStyleBtn(document.getElementById('csEligNo'),  val==='No',  'red');
    const noBlock     = document.getElementById('csEligNoBlock');
    const attemptsDiv = document.getElementById('csAttemptsBlock');
    if (noBlock)     noBlock.style.display     = val==='No'  ? 'block' : 'none';
    if (attemptsDiv) attemptsDiv.style.display = val==='Yes' ? 'block' : 'none';
};
// ─── SAVE REVIEW (v3) ─────────────────────────────────────────────────────────
window.csSaveReview = async function(event) {
    event.preventDefault();

    const reviewId    = document.getElementById('csReviewId').value;
    const period      = document.getElementById('csPeriodHidden').value;
    const accountCode = document.getElementById('csAccountCodeHidden').value;
    const show2       = document.getElementById('csShow2')?.value === '1';
    const show3       = document.getElementById('csShow3')?.value === '1';

    const a1Date  = document.getElementById('csA1Date')?.value  || '';
    const a1Ref   = document.getElementById('csA1Ref')?.value   || '';
    const a1Reach = document.getElementById('csA1Reach')?.value || '';

    const a2Date  = document.getElementById('csA2Date')?.value  || '';
    const a2Ref   = document.getElementById('csA2Ref')?.value   || '';
    const a2Reach = document.getElementById('csA2Reach')?.value || '';

    const a3Date  = document.getElementById('csA3Date')?.value  || '';
    const a3Ref   = document.getElementById('csA3Ref')?.value   || '';
    const a3Reach = document.getElementById('csA3Reach')?.value || '';

const eligibility     = document.getElementById('csEligibilityVal')?.value || '';
    const eligibilityReason = document.getElementById('csEligReason')?.value   || '';
    const eligFile        = document.getElementById('csEligFile')?.files?.[0]  || null;

    // Eligibility is required before anything else
    if (!eligibility) { alert('Please select customer eligibility before saving.'); return; }

    const agreedVal  = document.getElementById('csAgreedVal')?.value   || '';
    const agreedDate = document.getElementById('csAgreedDate')?.value  || '';
    const actualDate = document.getElementById('csActualDate')?.value  || '';
    const joinedVal  = document.getElementById('csJoinedVal')?.value   || '';
    const reviewNotes= document.getElementById('csReviewNotesFinal')?.value || '';
    const actionItems = '';
    const packFiles       = window._csPackFiles || [];
    const lmAttended      = document.getElementById('csLMAttendedVal')?.value  || '';
    const reviewMode      = document.getElementById('csReviewModeVal')?.value  || '';

// If not eligible — save eligibility fields only, no attempt processing
if (eligibility === 'No') {
    if (!eligibilityReason.trim()) { alert('Please provide a reason for ineligibility.'); return; }
    try {
        csShowLoading('Saving eligibility...');
        const digest = await csGetFormDigest();
        const body = {
            __metadata: { type: 'SP.Data.MSR_x005f_QSR_x005f_ReviewsListItem' },
            Customer_Eligibility: 'No',
            Eligibility_Reason:   eligibilityReason,
            Review_Status:        'Not Applicable'
        };
        const res = await fetch(CS_SP_URL + `/_api/web/lists/getbytitle('${CS_REVIEWS_LIST}')/items(${reviewId})`, {
            method: 'POST',
            headers: { 'Accept':'application/json;odata=verbose','Content-Type':'application/json;odata=verbose','X-RequestDigest':digest,'X-HTTP-Method':'MERGE','If-Match':'*' },
            credentials: 'include', body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error('Update failed');
        if (eligFile) await csUploadPackAttachment(reviewId, eligFile);
        csHideLoading();
        alert('✅ Customer marked as not eligible.');
        document.getElementById('csModal').style.display = 'none';
        await csFetchReviews();
        csRefreshMSRQSRDashboard();
    } catch(err) { csHideLoading(); alert('❌ ' + err.message); }
    return;
}
    // ── VALIDATE ──
    if (!a1Date)  { alert('Attempt 1 date is required.'); return; }
    if (!a1Ref)   { alert('Attempt 1 call reference is required.'); return; }
    if (!a1Reach) { alert('Please select whether the customer was reachable on attempt 1.'); return; }

    // If attempt 2 is visible (show2), it must be fully filled
    if (show2) {
        if (!a2Date)  { alert('Attempt 2 date is required.'); return; }
        if (!a2Ref)   { alert('Attempt 2 call reference is required.'); return; }
        if (!a2Reach) { alert('Please select whether the customer was reachable on attempt 2.'); return; }
    }

    // If attempt 3 is visible (show3), it must be fully filled
    if (show3) {
        if (!a3Date)  { alert('Attempt 3 date is required.'); return; }
        if (!a3Ref)   { alert('Attempt 3 call reference is required.'); return; }
        if (!a3Reach) { alert('Please select whether the customer was reachable on attempt 3.'); return; }
    }

    // Active attempt = last visible one
    const activeReach = show3 ? a3Reach : show2 ? a2Reach : a1Reach;

    // 2-day gap check
 const checkGap = (d1s, d2s, label) => {
        if (!d1s || !d2s) return true;
        const diff = Math.floor((new Date(d2s) - new Date(d1s)) / 86400000);
        if (diff < 1) {
            const e = new Date(d1s); e.setDate(e.getDate() + 1);
            alert(`${label} must be at least 1 day after the previous attempt.\nEarliest: ${e.toLocaleDateString('en-GB')}`);
            return false;
        }
        return true;
    };
    if (!checkGap(a1Date, a2Date, 'Attempt 2')) return;
    if (!checkGap(a2Date, a3Date, 'Attempt 3')) return;

    // Validate agreed/joined only if active attempt is reachable
    if (activeReach === 'Yes') {
        if (!agreedVal) { alert('Please select whether the review date was agreed.'); return; }
        if (agreedVal === 'Yes') {
            if (!agreedDate) { alert('Please enter the agreed review date.'); return; }
            // Only require joined + PACK if review date has passed
           const agreedDateObj = new Date(agreedDate); agreedDateObj.setHours(0,0,0,0);
            const today = new Date(); today.setHours(0,0,0,0);
if (agreedDateObj <= today) {
                if (!reviewMode) { alert('Please select the review mode first.'); return; }
                if (!joinedVal) {
                    alert('Please select whether the customer joined.'); return;
                }
                if ((reviewMode === 'Onsite' || reviewMode === 'Offsite') && joinedVal === 'Yes') {
                    if (!lmAttended) { alert('Please select whether the Line Manager attended.'); return; }
                }
            }
        }
    }

    // ── DETERMINE STATUS ──
    let newStatus = 'In Progress';
    if (activeReach === 'Yes') {
        if (agreedVal === 'No') {
            newStatus = 'Customer Declined';
    } else if (agreedVal === 'Yes' && agreedDate) {
            const agreedDateObj = new Date(agreedDate); agreedDateObj.setHours(0,0,0,0);
            const today = new Date(); today.setHours(0,0,0,0);
            if (agreedDateObj > today) {
                // Future date — still in progress, date booked
                newStatus = 'In Progress';
          } else if (joinedVal === 'Yes') {
                if ((reviewMode === 'Onsite' || reviewMode === 'Offsite') && !lmAttended) {
                    alert('Please select whether the Line Manager attended.'); return;
                }
                newStatus = 'Completed';
            } else if (joinedVal === 'No') {
                newStatus = 'No Show';
            }
        }
    } else if (activeReach === 'No' && a3Date) {
        newStatus = 'Unreachable';
    }
  // ── PACK VALIDATION ──
    const terminalStatuses = ['Completed','Customer Declined','Unreachable','No Show','Failed'];
    if (terminalStatuses.includes(newStatus)) {
        const existingAtts = await csGetAttachments(reviewId);
        if (existingAtts.length === 0 && packFiles.length === 0) {
            alert('PACK / MOM attachment is mandatory for status: ' + newStatus + '\nPlease attach a file before saving.');
            return;
        }
    }
    // ── SAVE ──
    try {
        csShowLoading('Saving...');
        const digest = await csGetFormDigest();
        const body = {
            __metadata: { type: 'SP.Data.MSR_x005f_QSR_x005f_ReviewsListItem' },
            Review_Status:        newStatus,
            Attempt_1_Date:       a1Date ? new Date(a1Date).toISOString() : null,
            Event_Ref_1:          a1Ref,
            Customer_Reachable_1: a1Reach,
            Attempt_2_Date:       a2Date ? new Date(a2Date).toISOString() : null,
            Event_Ref_2:          a2Ref,
            Customer_Reachable_2: a2Reach,
            Attempt_3_Date:       a3Date ? new Date(a3Date).toISOString() : null,
            Event_Ref_3:          a3Ref,
            Customer_Reachable_3: a3Reach,
            Review_Date_Agreed:   agreedVal,
            Agreed_Date:          agreedDate ? new Date(agreedDate).toISOString() : null,
            Actual_Review_Date:   actualDate ? new Date(actualDate).toISOString() : null,
         Review_Notes:           reviewNotes,
            Action_Items:           actionItems,
            LM_Attended:            lmAttended,
            Review_Mode:            reviewMode,
            Customer_Eligibility:   eligibility || 'Yes',
            Eligibility_Reason:     eligibilityReason
        };

        const res = await fetch(CS_SP_URL + `/_api/web/lists/getbytitle('${CS_REVIEWS_LIST}')/items(${reviewId})`, {
            method: 'POST',
            headers: { 'Accept':'application/json;odata=verbose','Content-Type':'application/json;odata=verbose','X-RequestDigest':digest,'X-HTTP-Method':'MERGE','If-Match':'*' },
           credentials: 'include',
            body: JSON.stringify(body)
        });
        if (!res.ok) { const t = await res.text(); throw new Error('Update failed: ' + t); }

        let attOk = true;
        for (let f of packFiles) { if (!await csUploadPackAttachment(reviewId, f)) attOk = false; }

        csHideLoading();
        alert(attOk ? '✅ Review saved!' : '⚠️ Saved, but some attachments failed.');
        document.getElementById('csModal').style.display = 'none';
        await csFetchReviews();
        csRefreshMSRQSRDashboard();

    } catch(err) {
        csHideLoading();
        alert('❌ Error: ' + err.message);
    }
};

// ─── HELPERS: QSR period utilities ────────────────────────────────────────────
function csDestroyChart(id) {
    const c = document.getElementById(id);
    if (c && c._chart) { c._chart.destroy(); c._chart = null; }
}
function csRenderMSRCharts() {
    const c = csGetChartColors();
    const msrReviews = csGetDashboardReviewsFiltered({ searchT:'' }).filter(r => {
        const a = CS_ACCOUNTS.find(x => x.code === r.accountCode);
        return a && a.team === 'DSM';
    });

    // ── 1. COMPLETION RATE TREND ──────────────────────────────
    csDestroyChart('csMSRTrendChart');
    const periods = [...new Set(msrReviews.map(r => r.period))].sort().slice(-8);
    const trendLabels = periods;
    const trendComp = periods.map(p => {
        const pr = msrReviews.filter(r => r.period === p);
        return pr.length ? +((pr.filter(r => r.status === 'Completed').length / pr.length) * 100).toFixed(1) : 0;
    });
    const trendTotal = periods.map(p => msrReviews.filter(r => r.period === p).length);
    const tc = document.getElementById('csMSRTrendChart');
    if (tc) {
        const grad = tc.getContext('2d').createLinearGradient(0,0,0,260);
        grad.addColorStop(0,'rgba(16,185,129,0.3)'); grad.addColorStop(1,'rgba(16,185,129,0.02)');
        tc._chart = new Chart(tc, {
            type: 'line',
            data: { labels: trendLabels, datasets: [
                { label: 'Completion %', data: trendComp, borderColor: '#10b981', backgroundColor: grad, fill: true, tension: 0.35, pointRadius: 5, pointBackgroundColor: '#10b981', pointBorderColor: '#fff', pointBorderWidth: 2, borderWidth: 2.5, yAxisID: 'y' },
                { label: 'Total Reviews', data: trendTotal, borderColor: '#6366f1', backgroundColor: 'transparent', fill: false, tension: 0.35, pointRadius: 4, pointBackgroundColor: '#6366f1', borderWidth: 2, borderDash: [6,3], yAxisID: 'y1' }
            ]},
            options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
                plugins: { legend: { position: 'top', labels: { color: c.text, font: { size: 11, weight: '600' }, usePointStyle: true, padding: 16 } } },
                scales: {
                    x: { ticks: { color: c.text, font: { size: 11 } }, grid: { color: c.grid } },
                    y: { type: 'linear', position: 'left', min: 0, max: 100, ticks: { color: c.text, callback: v => v + '%' }, grid: { color: c.grid } },
                    y1: { type: 'linear', position: 'right', beginAtZero: true, ticks: { color: c.text }, grid: { display: false } }
                }
            }
        });
    }

    // ── 2. STATUS DISTRIBUTION ────────────────────────────────
    csDestroyChart('csMSRStatusChart');
    const statusLabels = ['Completed','In Progress','Pending','Customer Declined','Unreachable','No Show','Failed'];
    const statusColors = ['#10b981','#f59e0b','#6b7280','#8b5cf6','#ef4444','#f97316','#dc2626'];
    const statusData = statusLabels.map(s => msrReviews.filter(r => r.status === s).length);
    const sc = document.getElementById('csMSRStatusChart');
    if (sc) sc._chart = new Chart(sc, {
        type: 'doughnut',
        data: { labels: statusLabels, datasets: [{ data: statusData, backgroundColor: statusColors, borderWidth: 4, borderColor: 'var(--bg-card)', hoverOffset: 10 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '55%',
            plugins: { legend: { position: 'right', labels: { color: c.text, font: { size: 11 }, padding: 12, usePointStyle: true, boxWidth: 10 } } }
        }
    });

    // ── 3. SM PERFORMANCE LEAGUE ──────────────────────────────
    csDestroyChart('csMSRSMLeagueChart');
    const sms = [...new Set(msrReviews.map(r => {
        const a = CS_ACCOUNTS.find(x => x.code === r.accountCode);
        return a ? a.sm : null;
    }))].filter(Boolean);
    const smStats = sms.map(sm => {
        const smR = msrReviews.filter(r => { const a = CS_ACCOUNTS.find(x => x.code === r.accountCode); return a && a.sm === sm; });
        const comp = smR.filter(r => r.status === 'Completed').length;
        return { sm, rate: smR.length ? +((comp / smR.length) * 100).toFixed(1) : 0, total: smR.length };
    }).sort((a, b) => b.rate - a.rate);
    const slc = document.getElementById('csMSRSMLeagueChart');
    if (slc) slc._chart = new Chart(slc, {
        type: 'bar',
        data: { labels: smStats.map(s => s.sm), datasets: [{ label: 'Completion %', data: smStats.map(s => s.rate), backgroundColor: smStats.map(s => s.rate >= 80 ? '#4c6fff' : s.rate >= 50 ? '#8b5cf6' : '#c724b1'), borderRadius: 6, maxBarThickness: 28 }] },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.x}% (${smStats[ctx.dataIndex].total} reviews)` } } },
            scales: { x: { min: 0, max: 100, ticks: { color: c.text, callback: v => v + '%' }, grid: { color: c.grid } }, y: { ticks: { color: c.text, font: { size: 11, weight: '600' } }, grid: { display: false } } }
        }
    });

    // ── 4. OVERDUE BY SM ──────────────────────────────────────
    csDestroyChart('csMSROverdueChart');
    const today = new Date(); today.setHours(0,0,0,0);
    const terminal = ['Completed','Not Applicable','Customer Declined','Failed','Unreachable','No Show'];
    const overdueStats = sms.map(sm => {
        const smR = msrReviews.filter(r => { const a = CS_ACCOUNTS.find(x => x.code === r.accountCode); return a && a.sm === sm; });
        return { sm, overdue: smR.filter(r => { if (!r.dueDate) return false; return new Date(r.dueDate) < today && !terminal.includes(r.status); }).length };
    }).sort((a, b) => b.overdue - a.overdue);
    const oc = document.getElementById('csMSROverdueChart');
    if (oc) oc._chart = new Chart(oc, {
        type: 'bar',
        data: { labels: overdueStats.map(s => s.sm), datasets: [{ label: 'Overdue Reviews', data: overdueStats.map(s => s.overdue), backgroundColor: '#ef4444', borderRadius: 6, maxBarThickness: 32 }] },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { beginAtZero: true, ticks: { color: c.text }, grid: { color: c.grid } }, y: { ticks: { color: c.text, font: { size: 11 } }, grid: { display: false } } }
        }
    });

    // ── 5. MONTHLY VOLUME VS COMPLETION ──────────────────────
    csDestroyChart('csMSRVolumeChart');
    const vc = document.getElementById('csMSRVolumeChart');
    if (vc) vc._chart = new Chart(vc, {
        type: 'bar',
        data: { labels: trendLabels, datasets: [
            { label: 'Total', data: trendTotal, backgroundColor: 'rgba(99,102,241,0.4)', borderColor: '#6366f1', borderWidth: 2, borderRadius: 4 },
            { label: 'Completed', data: periods.map(p => msrReviews.filter(r => r.period === p && r.status === 'Completed').length), backgroundColor: 'rgba(16,185,129,0.5)', borderColor: '#10b981', borderWidth: 2, borderRadius: 4 }
        ]},
        options: { responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'top', labels: { color: c.text, font: { size: 11 }, usePointStyle: true } } },
            scales: { x: { ticks: { color: c.text }, grid: { display: false } }, y: { beginAtZero: true, ticks: { color: c.text }, grid: { color: c.grid } } }
        }
    });

    // ── 6. ATTEMPT ANALYSIS ───────────────────────────────────
    csDestroyChart('csMSRAttemptChart');
    const att1 = msrReviews.filter(r => r.attempt1Date && r.reachable1 === 'Yes').length;
    const att2 = msrReviews.filter(r => r.attempt2Date && r.reachable2 === 'Yes').length;
    const att3 = msrReviews.filter(r => r.attempt3Date && r.reachable3 === 'Yes').length;
    const ac = document.getElementById('csMSRAttemptChart');
    if (ac) ac._chart = new Chart(ac, {
        type: 'bar',
        data: { labels: ['Closed on Attempt 1', 'Closed on Attempt 2', 'Closed on Attempt 3'], datasets: [{ data: [att1, att2, att3], backgroundColor: ['#10b981','#f59e0b','#ef4444'], borderRadius: 8, maxBarThickness: 60 }] },
        options: { responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y} reviews` } } },
            scales: { x: { ticks: { color: c.text, font: { size: 11 } }, grid: { display: false } }, y: { beginAtZero: true, ticks: { color: c.text }, grid: { color: c.grid } } }
        }
    });

    // ── 7. AVG DAYS TO COMPLETE BY SM ────────────────────────
    csDestroyChart('csMSRDaysChart');
    const daysStats = sms.map(sm => {
        const compR = msrReviews.filter(r => {
            const a = CS_ACCOUNTS.find(x => x.code === r.accountCode);
            return a && a.sm === sm && r.status === 'Completed' && r.attempt1Date && r.agreedDate;
        });
        const avgDays = compR.length
            ? compR.reduce((sum, r) => sum + Math.max(0, Math.floor((new Date(r.agreedDate) - new Date(r.attempt1Date)) / 86400000)), 0) / compR.length
            : 0;
        return { sm, avgDays: +avgDays.toFixed(1), count: compR.length };
    }).filter(s => s.count > 0).sort((a, b) => a.avgDays - b.avgDays);
    const dc = document.getElementById('csMSRDaysChart');
    if (dc) dc._chart = new Chart(dc, {
        type: 'bar',
        data: { labels: daysStats.map(s => s.sm), datasets: [{ label: 'Avg Days', data: daysStats.map(s => s.avgDays), backgroundColor: daysStats.map(s => s.avgDays <= 7 ? '#10b981' : s.avgDays <= 14 ? '#f59e0b' : '#ef4444'), borderRadius: 6, maxBarThickness: 32 }] },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.x} days avg (${daysStats[ctx.dataIndex].count} completed)` } } },
            scales: { x: { beginAtZero: true, ticks: { color: c.text }, grid: { color: c.grid } }, y: { ticks: { color: c.text, font: { size: 11 } }, grid: { display: false } } }
        }
    });

    // ── 8. FAILURE REASONS BREAKDOWN ─────────────────────────
    csDestroyChart('csMSRFailureChart');
    const failPeriods = periods;
    const fc = document.getElementById('csMSRFailureChart');
    if (fc) fc._chart = new Chart(fc, {
        type: 'bar',
        data: { labels: failPeriods, datasets: [
            { label: 'Customer Declined', data: failPeriods.map(p => msrReviews.filter(r => r.period === p && r.status === 'Customer Declined').length), backgroundColor: '#8b5cf6', borderRadius: 4 },
            { label: 'Unreachable', data: failPeriods.map(p => msrReviews.filter(r => r.period === p && r.status === 'Unreachable').length), backgroundColor: '#ef4444', borderRadius: 4 },
            { label: 'No Show', data: failPeriods.map(p => msrReviews.filter(r => r.period === p && r.status === 'No Show').length), backgroundColor: '#f97316', borderRadius: 4 },
            { label: 'Failed', data: failPeriods.map(p => msrReviews.filter(r => r.period === p && r.status === 'Failed').length), backgroundColor: '#dc2626', borderRadius: 4 }
        ]},
        options: { responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'top', labels: { color: c.text, font: { size: 11 }, usePointStyle: true, padding: 12 } } },
            scales: { x: { stacked: true, ticks: { color: c.text }, grid: { display: false } }, y: { stacked: true, beginAtZero: true, ticks: { color: c.text }, grid: { color: c.grid } } }
        }
    });

    // ── 9. TOP 5 MOST DIFFICULT ACCOUNTS ─────────────────────
    const difficultEl = document.getElementById('csMSRDifficultAccounts');
    if (difficultEl) {
        const accountStats = [...new Set(msrReviews.map(r => r.accountCode))].map(code => {
            const acctReviews = msrReviews.filter(r => r.accountCode === code);
            const acct = CS_ACCOUNTS.find(a => a.code === code);
            const failures = acctReviews.filter(r => ['Customer Declined','Unreachable','No Show','Failed'].includes(r.status)).length;
            const attempts = acctReviews.reduce((sum, r) => {
                let att = 0;
                if (r.attempt1Date) att++;
                if (r.attempt2Date) att++;
                if (r.attempt3Date) att++;
                return sum + att;
            }, 0);
            return { code, customer: acct ? acct.customer : code, sm: acct ? acct.sm : '', failures, attempts, total: acctReviews.length };
        }).sort((a, b) => b.failures - a.failures || b.attempts - a.attempts).slice(0, 5);

        if (!accountStats.length) {
            difficultEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--t3);">No data</div>';
        } else {
            difficultEl.innerHTML = '<div style="display:flex;flex-direction:column;gap:8px;padding:8px 0;">' +
                accountStats.map((s, i) => `
                <div style="display:flex;align-items:center;gap:14px;padding:10px 14px;background:rgba(239,68,68,0.06);border-radius:10px;border:1px solid rgba(239,68,68,0.15);">
                    <div style="width:28px;height:28px;border-radius:50%;background:#ef444422;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:.8rem;color:#ef4444;flex-shrink:0;">${i+1}</div>
                    <div style="flex:1;min-width:0;">
                        <div style="font-size:.88rem;font-weight:700;color:var(--t1);">${s.code}</div>
                        <div style="font-size:.75rem;color:var(--t3);">${s.customer} · ${s.sm}</div>
                    </div>
                    <div style="text-align:center;min-width:60px;"><div style="font-size:.65rem;color:var(--t3);font-weight:700;text-transform:uppercase;">Failures</div><div style="font-size:1.1rem;font-weight:900;color:#ef4444;">${s.failures}</div></div>
                    <div style="text-align:center;min-width:60px;"><div style="font-size:.65rem;color:var(--t3);font-weight:700;text-transform:uppercase;">Attempts</div><div style="font-size:1.1rem;font-weight:900;color:#f97316;">${s.attempts}</div></div>
                    <div style="text-align:center;min-width:60px;"><div style="font-size:.65rem;color:var(--t3);font-weight:700;text-transform:uppercase;">Total</div><div style="font-size:1.1rem;font-weight:900;color:var(--t2);">${s.total}</div></div>
                </div>`).join('') + '</div>';
        }
    }
}
function csRenderQSRCharts() {
    const c = csGetChartColors();
    const qsrReviews = csGetDashboardReviewsFiltered({ searchT:'' }).filter(r => {
        const a = CS_ACCOUNTS.find(x => x.code === r.accountCode);
        return a && ['TSM_ME','TSM_SE'].includes(a.team);
    });

    const sms = [...new Set(qsrReviews.map(r => {
        const a = CS_ACCOUNTS.find(x => x.code === r.accountCode);
        return a ? a.sm : null;
    }))].filter(Boolean);

    // ── 1. QUARTER OVER QUARTER TREND ────────────────────────
    csDestroyChart('csQSRQoQChart');
    const quarters = [...new Set(qsrReviews.map(r => csQuarterFromPeriod(r.period)))].sort().slice(-6);
    const qc = document.getElementById('csQSRQoQChart');
    if (qc) {
        const grad = qc.getContext('2d').createLinearGradient(0,0,0,260);
        grad.addColorStop(0,'rgba(99,102,241,0.3)'); grad.addColorStop(1,'rgba(99,102,241,0.02)');
        qc._chart = new Chart(qc, {
            type: 'line',
            data: { labels: quarters, datasets: [
                { label: 'Completion %', data: quarters.map(q => {
                    const qr = qsrReviews.filter(r => csQuarterFromPeriod(r.period) === q);
                    const uniqueAccts = [...new Set(qr.map(r => r.accountCode))];
                    const compAccts = uniqueAccts.filter(code => qr.some(r => r.accountCode === code && r.status === 'Completed'));
                    return uniqueAccts.length ? +((compAccts.length / uniqueAccts.length) * 100).toFixed(1) : 0;
                }), borderColor: '#6366f1', backgroundColor: grad, fill: true, tension: 0.35, pointRadius: 5, pointBackgroundColor: '#6366f1', pointBorderColor: '#fff', pointBorderWidth: 2, borderWidth: 2.5 }
            ]},
            options: { responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'top', labels: { color: c.text, font: { size: 11, weight: '600' }, usePointStyle: true } } },
                scales: {
                    x: { ticks: { color: c.text }, grid: { color: c.grid } },
                    y: { min: 0, max: 100, ticks: { color: c.text, callback: v => v + '%' }, grid: { color: c.grid } }
                }
            }
        });
    }

    // ── 2. STATUS DISTRIBUTION ────────────────────────────────
    csDestroyChart('csQSRStatusChart');
    const statusLabels = ['Completed','In Progress','Pending','Customer Declined','Unreachable','No Show','Failed'];
    const statusColors = ['#10b981','#f59e0b','#6b7280','#8b5cf6','#ef4444','#f97316','#dc2626'];
    const sc = document.getElementById('csQSRStatusChart');
    if (sc) sc._chart = new Chart(sc, {
        type: 'doughnut',
        data: { labels: statusLabels, datasets: [{ data: statusLabels.map(s => qsrReviews.filter(r => r.status === s).length), backgroundColor: statusColors, borderWidth: 4, borderColor: 'var(--bg-card)', hoverOffset: 10 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '55%',
            plugins: { legend: { position: 'right', labels: { color: c.text, font: { size: 11 }, padding: 12, usePointStyle: true, boxWidth: 10 } } }
        }
    });

    // ── 3. SM COMPLETION COMPARISON ──────────────────────────
    csDestroyChart('csQSRSMChart');
    const smQSRStats = sms.map(sm => {
        const smR = qsrReviews.filter(r => { const a = CS_ACCOUNTS.find(x => x.code === r.accountCode); return a && a.sm === sm; });
        return { sm, rate: smR.length ? +((smR.filter(r => r.status === 'Completed').length / smR.length) * 100).toFixed(1) : 0 };
    }).sort((a, b) => b.rate - a.rate);
    const smqc = document.getElementById('csQSRSMChart');
    if (smqc) smqc._chart = new Chart(smqc, {
        type: 'bar',
        data: { labels: smQSRStats.map(s => s.sm), datasets: [{ label: 'Completion %', data: smQSRStats.map(s => s.rate),backgroundColor: smQSRStats.map(s => s.rate >= 80 ? '#4c6fff' : s.rate >= 50 ? '#8b5cf6' : '#c724b1'), borderRadius: 6, maxBarThickness: 28 }] },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { min: 0, max: 100, ticks: { color: c.text, callback: v => v + '%' }, grid: { color: c.grid } }, y: { ticks: { color: c.text, font: { size: 11 } }, grid: { display: false } } }
        }
    });

    // ── 4. MONTHLY ATTEMPT DISTRIBUTION ──────────────────────
    csDestroyChart('csQSRAttemptChart');
    const recentQPeriods = [...new Set(qsrReviews.map(r => r.period))].sort().slice(-6);
    const mac = document.getElementById('csQSRAttemptChart');
    if (mac) mac._chart = new Chart(mac, {
        type: 'bar',
        data: { labels: recentQPeriods, datasets: [
            { label: 'Attempt 1 Only', data: recentQPeriods.map(p => qsrReviews.filter(r => r.period === p && r.attempt1Date && !r.attempt2Date).length), backgroundColor: '#10b981', borderRadius: 4 },
            { label: 'Attempt 2', data: recentQPeriods.map(p => qsrReviews.filter(r => r.period === p && r.attempt2Date && !r.attempt3Date).length), backgroundColor: '#f59e0b', borderRadius: 4 },
            { label: 'Attempt 3', data: recentQPeriods.map(p => qsrReviews.filter(r => r.period === p && r.attempt3Date).length), backgroundColor: '#ef4444', borderRadius: 4 }
        ]},
        options: { responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'top', labels: { color: c.text, font: { size: 11 }, usePointStyle: true } } },
            scales: { x: { stacked: true, ticks: { color: c.text, font: { size: 10 } }, grid: { display: false } }, y: { stacked: true, beginAtZero: true, ticks: { color: c.text }, grid: { color: c.grid } } }
        }
    });

    // ── 5. REACHABLE VS UNREACHABLE ───────────────────────────
    csDestroyChart('csQSRReachChart');
    const reachYes = qsrReviews.filter(r => r.reachable1 === 'Yes' || r.reachable2 === 'Yes' || r.reachable3 === 'Yes').length;
    const reachNo = qsrReviews.filter(r => r.status === 'Unreachable').length;
    const rc = document.getElementById('csQSRReachChart');
    if (rc) rc._chart = new Chart(rc, {
        type: 'doughnut',
        data: { labels: ['Reachable', 'Unreachable (All 3 Failed)'], datasets: [{ data: [reachYes, reachNo], backgroundColor: ['#10b981','#ef4444'], borderWidth: 4, borderColor: 'var(--bg-card)', hoverOffset: 10 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '55%',
            plugins: { legend: { position: 'bottom', labels: { color: c.text, font: { size: 11 }, usePointStyle: true } } }
        }
    });

    // ── 6. QUARTER COMPLETION RATE BY SM ─────────────────────
    csDestroyChart('csQSRQtCompChart');
    const lastQuarters = quarters.slice(-4);
    const smColors = ['#4c6fff','#10b981','#f59e0b','#8b5cf6','#ef4444','#f97316'];
    const qtc = document.getElementById('csQSRQtCompChart');
    if (qtc) qtc._chart = new Chart(qtc, {
        type: 'bar',
        data: { labels: lastQuarters, datasets: sms.map((sm, i) => ({
            label: sm,
            data: lastQuarters.map(q => {
                const qr = qsrReviews.filter(r => { const a = CS_ACCOUNTS.find(x => x.code === r.accountCode); return a && a.sm === sm && csQuarterFromPeriod(r.period) === q; });
                const uniqueAccts = [...new Set(qr.map(r => r.accountCode))];
                const compAccts = uniqueAccts.filter(code => qr.some(r => r.accountCode === code && r.status === 'Completed'));
                return uniqueAccts.length ? +((compAccts.length / uniqueAccts.length) * 100).toFixed(1) : 0;
            }),
            backgroundColor: smColors[i % smColors.length] + '99',
            borderColor: smColors[i % smColors.length],
            borderWidth: 1.5,
            borderRadius: 4,
            maxBarThickness: 20
        }))},
        options: { responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'top', labels: { color: c.text, font: { size: 10 }, usePointStyle: true, padding: 10 } } },
            scales: { x: { ticks: { color: c.text }, grid: { display: false } }, y: { min: 0, max: 100, ticks: { color: c.text, callback: v => v + '%' }, grid: { color: c.grid } } }
        }
    });

    // ── 7. ACCOUNTS NEEDING 3 MONTHS ─────────────────────────
    const hardEl = document.getElementById('csQSRHardAccounts');
    if (hardEl) {
        const hardAccts = [...new Set(qsrReviews.map(r => r.accountCode))].map(code => {
            const acctR = qsrReviews.filter(r => r.accountCode === code);
            const quarters = [...new Set(acctR.map(r => csQuarterFromPeriod(r.period)))];
            const hardQuarters = quarters.filter(q => {
                const qr = acctR.filter(r => csQuarterFromPeriod(r.period) === q);
                return qr.length >= 3;
            });
            const acct = CS_ACCOUNTS.find(a => a.code === code);
            return { code, customer: acct ? acct.customer : code, sm: acct ? acct.sm : '', hardQuarters: hardQuarters.length };
        }).filter(s => s.hardQuarters > 0).sort((a, b) => b.hardQuarters - a.hardQuarters).slice(0, 5);

        if (!hardAccts.length) {
            hardEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--t3);">No accounts required 3 monthly attempts</div>';
        } else {
            hardEl.innerHTML = '<div style="display:flex;flex-direction:column;gap:8px;padding:8px 0;">' +
                hardAccts.map((s, i) => `
                <div style="display:flex;align-items:center;gap:14px;padding:10px 14px;background:rgba(239,68,68,0.06);border-radius:10px;border:1px solid rgba(239,68,68,0.15);">
                    <div style="width:28px;height:28px;border-radius:50%;background:#ef444422;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:.8rem;color:#ef4444;flex-shrink:0;">${i+1}</div>
                    <div style="flex:1;"><div style="font-size:.88rem;font-weight:700;color:var(--t1);">${s.code}</div><div style="font-size:.75rem;color:var(--t3);">${s.customer} · ${s.sm}</div></div>
                    <div style="text-align:center;"><div style="font-size:.65rem;color:var(--t3);font-weight:700;text-transform:uppercase;">Quarters Needing 3 Months</div><div style="font-size:1.1rem;font-weight:900;color:#ef4444;">${s.hardQuarters}</div></div>
                </div>`).join('') + '</div>';
        }
    }
}
function csRenderHCCharts() {
    const c = csGetChartColors();
    const tsmAccts = CS_ACCOUNTS.filter(a => ['TSM_ME','TSM_SE'].includes(a.team));
    let relevantAccts = tsmAccts;
    if (CS_USER_CONTEXT.role === 'SM') relevantAccts = tsmAccts.filter(a => a.sm === CS_USER_CONTEXT.userName);
    else if (CS_USER_CONTEXT.role === 'LM') relevantAccts = tsmAccts.filter(a => a.lm === CS_USER_CONTEXT.userName);
    const codes = relevantAccts.map(a => a.code);
    const hcData = CS_HEALTH_CHECKS.filter(h => codes.includes(h.accountCode));

    // Show no-data message if empty
    if (hcData.length === 0) {
        ['csHCVolumeChart','csHCReachChart','csHCSMActivityChart',
         'csHCReachTrendChart','csHCFreqChart','csHCSMMoMChart'].forEach(function(id) {
            const el = document.getElementById(id);
            if (el && el.parentElement) {
                el.parentElement.innerHTML =
                    '<div style="text-align:center;padding:40px;color:var(--t3);font-size:.85rem;">No health check data yet</div>';
            }
        });
        const nt = document.getElementById('csHCNotTouched');
        if (nt) {
            const now = new Date();
            const thisMonth = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
            const notTouched = relevantAccts.filter(a => !CS_HEALTH_CHECKS.some(h => h.accountCode === a.code && h.date && h.date.startsWith(thisMonth)));
            nt.innerHTML = notTouched.length === 0
                ? '<div style="text-align:center;padding:20px;color:#10b981;font-weight:700;">✅ All accounts touched this month!</div>'
                : '<div style="font-size:12px;color:var(--t3);margin-bottom:8px;">' + notTouched.length + ' accounts have had no health check this month</div>' +
                  '<div style="display:flex;flex-direction:column;gap:6px;max-height:280px;overflow-y:auto;">' +
                  notTouched.slice(0,20).map(a =>
                    '<div style="display:flex;align-items:center;gap:12px;padding:8px 12px;background:rgba(239,68,68,0.05);border-radius:8px;border:1px solid rgba(239,68,68,0.12);">' +
                    '<div style="flex:1;"><div style="font-size:.84rem;font-weight:700;color:var(--t1);">' + a.code + '</div><div style="font-size:.72rem;color:var(--t3);">' + a.customer + '</div></div>' +
                    '<div style="font-size:.75rem;color:var(--t3);">' + a.sm + '</div>' +
                    '<div style="font-size:.72rem;font-weight:700;color:#ef4444;">No HC this month</div>' +
                    '</div>'
                  ).join('') + '</div>';
        }
        return;
    }
    const sms = [...new Set(relevantAccts.map(a => a.sm))].filter(Boolean);

    // ── 1. MONTHLY INTERACTION VOLUME ────────────────────────
    csDestroyChart('csHCVolumeChart');
    const monthMap = {};
    hcData.forEach(h => {
        if (!h.date) return;
        const key = h.date.substring(0, 7);
        monthMap[key] = (monthMap[key] || 0) + 1;
    });
    const monthKeys = Object.keys(monthMap).sort().slice(-8);
    const vc = document.getElementById('csHCVolumeChart');
    if (vc) {
        const grad = vc.getContext('2d').createLinearGradient(0,0,0,260);
        grad.addColorStop(0,'rgba(16,185,129,0.3)'); grad.addColorStop(1,'rgba(16,185,129,0.02)');
        vc._chart = new Chart(vc, {
            type: 'line',
            data: { labels: monthKeys, datasets: [{ label: 'Interactions', data: monthKeys.map(k => monthMap[k] || 0), borderColor: '#10b981', backgroundColor: grad, fill: true, tension: 0.35, pointRadius: 5, pointBackgroundColor: '#10b981', pointBorderColor: '#fff', pointBorderWidth: 2, borderWidth: 2.5 }] },
            options: { responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { x: { ticks: { color: c.text }, grid: { color: c.grid } }, y: { beginAtZero: true, ticks: { color: c.text }, grid: { color: c.grid } } }
            }
        });
    }

    // ── 2. REACHABLE VS UNREACHABLE ───────────────────────────
    csDestroyChart('csHCReachChart');
    const reachYes = hcData.filter(h => h.reachable === 'Yes').length;
    const reachNo = hcData.filter(h => h.reachable === 'No').length;
    const rc = document.getElementById('csHCReachChart');
    if (rc) rc._chart = new Chart(rc, {
        type: 'doughnut',
        data: { labels: ['Reachable', 'Not Reachable'], datasets: [{ data: [reachYes, reachNo], backgroundColor: ['#10b981','#ef4444'], borderWidth: 4, borderColor: 'var(--bg-card)', hoverOffset: 10 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '55%',
            plugins: { legend: { position: 'bottom', labels: { color: c.text, font: { size: 11 }, usePointStyle: true } } }
        }
    });

    // ── 3. SM ACTIVITY LEAGUE ────────────────────────────────
    csDestroyChart('csHCSMActivityChart');
    const smActivity = sms.map(sm => {
        const smCodes = relevantAccts.filter(a => a.sm === sm).map(a => a.code);
        return { sm, count: hcData.filter(h => smCodes.includes(h.accountCode)).length };
    }).sort((a, b) => b.count - a.count);
    const sac = document.getElementById('csHCSMActivityChart');
    if (sac) sac._chart = new Chart(sac, {
        type: 'bar',
        data: { labels: smActivity.map(s => s.sm), datasets: [{ label: 'Interactions', data: smActivity.map(s => s.count), backgroundColor: smActivity.map((_, i) => ['#4c6fff','#10b981','#f59e0b','#8b5cf6','#ef4444'][i % 5]), borderRadius: 6, maxBarThickness: 28 }] },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { beginAtZero: true, ticks: { color: c.text }, grid: { color: c.grid } }, y: { ticks: { color: c.text, font: { size: 11 } }, grid: { display: false } } }
        }
    });

    // ── 4. REACHABILITY TREND ────────────────────────────────
    csDestroyChart('csHCReachTrendChart');
    const rtc = document.getElementById('csHCReachTrendChart');
    if (rtc) rtc._chart = new Chart(rtc, {
        type: 'line',
        data: { labels: monthKeys, datasets: [
            { label: 'Reachable %', data: monthKeys.map(k => {
                const m = hcData.filter(h => h.date && h.date.startsWith(k));
                return m.length ? +((m.filter(h => h.reachable === 'Yes').length / m.length) * 100).toFixed(1) : 0;
            }), borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', fill: true, tension: 0.35, pointRadius: 4, pointBackgroundColor: '#10b981', borderWidth: 2.5 },
            { label: 'Not Reachable %', data: monthKeys.map(k => {
                const m = hcData.filter(h => h.date && h.date.startsWith(k));
                return m.length ? +((m.filter(h => h.reachable === 'No').length / m.length) * 100).toFixed(1) : 0;
            }), borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.08)', fill: true, tension: 0.35, pointRadius: 4, pointBackgroundColor: '#ef4444', borderWidth: 2.5 }
        ]},
        options: { responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'top', labels: { color: c.text, font: { size: 11 }, usePointStyle: true } } },
            scales: { x: { ticks: { color: c.text }, grid: { color: c.grid } }, y: { min: 0, max: 100, ticks: { color: c.text, callback: v => v + '%' }, grid: { color: c.grid } } }
        }
    });

    // ── 5. INTERACTION FREQUENCY PER ACCOUNT ─────────────────
    csDestroyChart('csHCFreqChart');
    const freqData = codes.map(code => {
        const acct = CS_ACCOUNTS.find(a => a.code === code);
        return { code, customer: acct ? acct.customer.substring(0, 18) : code, count: hcData.filter(h => h.accountCode === code).length };
    }).filter(s => s.count > 0).sort((a, b) => b.count - a.count).slice(0, 10);
    const fc = document.getElementById('csHCFreqChart');
    if (fc) fc._chart = new Chart(fc, {
        type: 'bar',
        data: { labels: freqData.map(s => s.customer), datasets: [{ label: 'Interactions', data: freqData.map(s => s.count), backgroundColor: '#4c6fff', borderRadius: 6, maxBarThickness: 28 }] },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { beginAtZero: true, ticks: { color: c.text }, grid: { color: c.grid } }, y: { ticks: { color: c.text, font: { size: 10 } }, grid: { display: false } } }
        }
    });

    // ── 6. MONTH OVER MONTH SM COMPARISON ────────────────────
    csDestroyChart('csHCSMMoMChart');
    const lastMonths = monthKeys.slice(-4);
    const smColors = ['#4c6fff','#10b981','#f59e0b','#8b5cf6','#ef4444','#f97316'];
    const momc = document.getElementById('csHCSMMoMChart');
    if (momc) momc._chart = new Chart(momc, {
        type: 'bar',
        data: { labels: lastMonths, datasets: sms.map((sm, i) => {
            const smCodes = relevantAccts.filter(a => a.sm === sm).map(a => a.code);
            return {
                label: sm,
                data: lastMonths.map(k => hcData.filter(h => smCodes.includes(h.accountCode) && h.date && h.date.startsWith(k)).length),
                backgroundColor: smColors[i % smColors.length] + '99',
                borderColor: smColors[i % smColors.length],
                borderWidth: 1.5,
                borderRadius: 4,
                maxBarThickness: 20
            };
        })},
        options: { responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'top', labels: { color: c.text, font: { size: 10 }, usePointStyle: true, padding: 10 } } },
            scales: { x: { ticks: { color: c.text }, grid: { display: false } }, y: { beginAtZero: true, ticks: { color: c.text }, grid: { color: c.grid } } }
        }
    });

    // ── 7. ACCOUNTS NOT TOUCHED THIS MONTH ───────────────────
    const notTouchedEl = document.getElementById('csHCNotTouched');
    if (notTouchedEl) {
        const now = new Date();
        const thisMonth = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
        const touchedCodes = new Set(hcData.filter(h => h.date && h.date.startsWith(thisMonth)).map(h => h.accountCode));
        const notTouched = relevantAccts.filter(a => !touchedCodes.has(a.code));
        if (!notTouched.length) {
            notTouchedEl.innerHTML = '<div style="text-align:center;padding:20px;color:#10b981;font-weight:700;">✅ All accounts touched this month!</div>';
        } else {
            notTouchedEl.innerHTML = `<div style="margin-bottom:8px;font-size:12px;color:var(--t3);">${notTouched.length} accounts have had no health check this month</div>` +
                '<div style="display:flex;flex-direction:column;gap:6px;max-height:280px;overflow-y:auto;">' +
                notTouched.map(a => `
                <div style="display:flex;align-items:center;gap:12px;padding:8px 12px;background:rgba(239,68,68,0.05);border-radius:8px;border:1px solid rgba(239,68,68,0.12);">
                    <div style="flex:1;"><div style="font-size:.84rem;font-weight:700;color:var(--t1);">${a.code}</div><div style="font-size:.72rem;color:var(--t3);">${a.customer}</div></div>
                    <div style="font-size:.75rem;color:var(--t3);">${a.sm}</div>
                    <div style="font-size:.72rem;font-weight:700;color:#ef4444;">No HC this month</div>
                </div>`).join('') + '</div>';
        }
    }
}
window.csSearchAccountHistory = function() {
    const code = (document.getElementById('csAccHistoryInput')?.value || '').trim();
    const el = document.getElementById('csAccHistoryResult');
    if (!el) return;
    if (!code) { el.innerHTML = '<div style="color:var(--t3);font-size:13px;">Please enter an account code.</div>'; return; }

    const acct = CS_ACCOUNTS.find(a => a.code === code);
    if (!acct) { el.innerHTML = `<div style="padding:12px;background:rgba(239,68,68,0.08);border-radius:8px;color:#ef4444;font-size:13px;">Account <strong>${code}</strong> not found.</div>`; return; }

    const reviews = CS_REVIEWS.filter(r => r.accountCode === code).sort((a, b) => a.period > b.period ? -1 : 1);
    const hcs = CS_HEALTH_CHECKS.filter(h => h.accountCode === code).sort((a, b) => a.date > b.date ? -1 : 1);

    const statusColor = s => ({'Completed':'#10b981','Customer Declined':'#D85A30','Unreachable':'#dc2626','No Show':'#b45309','Failed':'#dc2626','In Progress':'#f59e0b','Pending':'#6b7280'})[s] || '#6b7280';
    const statusBg = s => ({'Completed':'rgba(16,185,129,0.1)','Customer Declined':'rgba(216,90,48,0.1)','Unreachable':'rgba(220,38,38,0.1)','No Show':'rgba(180,83,9,0.1)','Failed':'rgba(220,38,38,0.1)','In Progress':'rgba(245,158,11,0.1)','Pending':'rgba(107,114,128,0.1)'})[s] || 'rgba(107,114,128,0.1)';

    let html = `
    <div style="background:var(--bg-secondary);border-radius:10px;padding:14px;margin-bottom:1rem;display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
        <div><div style="font-size:.65rem;font-weight:700;color:var(--t3);text-transform:uppercase;margin-bottom:4px;">Account</div><div style="font-size:.9rem;font-weight:800;color:var(--t1);">${acct.code}</div><div style="font-size:.75rem;color:var(--t3);">${acct.customer}</div></div>
        <div><div style="font-size:.65rem;font-weight:700;color:var(--t3);text-transform:uppercase;margin-bottom:4px;">Service Manager</div><div style="font-size:.88rem;font-weight:700;color:var(--t1);">${acct.sm}</div><div style="font-size:.75rem;color:var(--t3);">${acct.team}</div></div>
        <div><div style="font-size:.65rem;font-weight:700;color:var(--t3);text-transform:uppercase;margin-bottom:4px;">Summary</div><div style="font-size:.84rem;font-weight:700;color:var(--t1);">${reviews.length} reviews · ${hcs.length} health checks</div><div style="font-size:.75rem;color:#10b981;">${reviews.filter(r => r.status === 'Completed').length} completed</div></div>
    </div>`;

    if (reviews.length > 0) {
        html += `<div style="font-size:.75rem;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:.65rem;">Review History (${reviews.length})</div>`;
        html += '<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:1rem;">';
        reviews.forEach(r => {
            const attempts = [r.attempt1Date, r.attempt2Date, r.attempt3Date].filter(Boolean).length;
            html += `
            <div style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:${statusBg(r.status)};border-radius:10px;border:1px solid ${statusColor(r.status)}33;">
                <div style="min-width:80px;font-size:.82rem;font-weight:700;color:var(--t1);">${r.period}</div>
                <div style="flex:1;">
                    <span style="display:inline-block;padding:2px 10px;border-radius:20px;font-size:.72rem;font-weight:700;background:${statusBg(r.status)};color:${statusColor(r.status)};border:1px solid ${statusColor(r.status)}44;">${r.status}</span>
                    ${r.agreedDate ? `<span style="font-size:.72rem;color:var(--t3);margin-left:8px;">📅 ${r.agreedDate}</span>` : ''}
                </div>
                <div style="font-size:.72rem;color:var(--t3);">${attempts} attempt${attempts !== 1 ? 's' : ''}</div>
                ${r.reviewNotes ? `<div style="font-size:.72rem;color:var(--t2);max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${r.reviewNotes}">${r.reviewNotes}</div>` : ''}
                <div style="font-size:.7rem;color:var(--t3);">${r.dueDate || ''}</div>
            </div>`;
        });
        html += '</div>';
    }

    if (hcs.length > 0) {
        html += `<div style="font-size:.75rem;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:.65rem;">Health Check History (${hcs.length})</div>`;
        html += '<div style="display:flex;flex-direction:column;gap:6px;">';
        hcs.forEach(h => {
            html += `
            <div style="display:flex;align-items:center;gap:12px;padding:8px 12px;background:var(--bg-secondary);border-radius:8px;border:1px solid var(--border);">
                <div style="min-width:90px;font-size:.82rem;font-weight:700;color:var(--t1);">${h.date || '-'}</div>
                <div style="flex:1;font-size:.8rem;color:var(--t2);">${h.notes ? h.notes.replace(/<[^>]*>/g,'').substring(0, 60) : '—'}</div>
                <div style="font-size:.72rem;font-weight:700;color:${h.reachable === 'Yes' ? '#10b981' : '#ef4444'};">${h.reachable || '—'}</div>
                <div style="font-size:.72rem;color:var(--t3);">${h.eventRef || ''}</div>
            </div>`;
        });
        html += '</div>';
    }

    if (!reviews.length && !hcs.length) {
        html += '<div style="text-align:center;padding:20px;color:var(--t3);">No reviews or health checks found for this account.</div>';
    }

    el.innerHTML = html;
};

window.csClearAccountHistory = function() {
    const input = document.getElementById('csAccHistoryInput');
    const result = document.getElementById('csAccHistoryResult');
    if (input) input.value = '';
    if (result) result.innerHTML = '';
};
window.csLoadRowAttachments = async function(reviewId, btn) {
    btn.textContent = 'Loading...';
    btn.disabled = true;
    const atts = await csGetAttachments(reviewId);
    
    // Build popup near the button
    let popup = document.getElementById('csAttPopup');
    if (!popup) {
        popup = document.createElement('div');
        popup.id = 'csAttPopup';
        popup.style.cssText = 'position:fixed;z-index:99999;background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:14px;box-shadow:var(--ch);min-width:220px;max-width:320px;';
        document.body.appendChild(popup);
    }

    const rect = btn.getBoundingClientRect();
    popup.style.top  = (rect.bottom + 6) + 'px';
    popup.style.left = rect.left + 'px';

    if (!atts || atts.length === 0) {
        popup.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <div style="font-size:12px;font-weight:700;color:var(--t1);">Attachments</div>
                <button type="button" onclick="document.getElementById('csAttPopup').style.display='none'"
                    style="background:none;border:none;font-size:18px;cursor:pointer;color:var(--t3);line-height:1;">×</button>
            </div>
            <div style="font-size:12px;color:var(--t3);">No attachments</div>`;
    } else {
        popup.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                <div style="font-size:12px;font-weight:700;color:var(--t1);">Attachments (${atts.length})</div>
                <button type="button" onclick="document.getElementById('csAttPopup').style.display='none'"
                    style="background:none;border:none;font-size:18px;cursor:pointer;color:var(--t3);line-height:1;">×</button>
            </div>
            ${atts.map(a => `
                <a href="http://sharedspaces:8086${a.url}" target="_blank"
                    style="display:flex;align-items:center;gap:7px;padding:6px 8px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:7px;font-size:12px;color:var(--acc);text-decoration:none;margin-bottom:5px;">
                    📎 ${a.name}
                </a>`).join('')}`;
    }

    popup.style.display = 'block';
    btn.textContent = '📎 View Files';
    btn.disabled = false;

    // Close popup when clicking outside
    setTimeout(() => {
        document.addEventListener('click', function closePopup(e) {
            if (!popup.contains(e.target) && e.target !== btn) {
                popup.style.display = 'none';
                document.removeEventListener('click', closePopup);
            }
        });
    }, 100);
};
function csCheckShowPackGlobal() {
    const a1Reach = document.getElementById('csA1Reach')?.value || '';
    const a2Reach = document.getElementById('csA2Reach')?.value || '';
    const a3Reach = document.getElementById('csA3Reach')?.value || '';
    const agreedVal = document.getElementById('csAgreedVal')?.value || '';
    const joinedVal = document.getElementById('csJoinedVal')?.value || '';
    const show2 = document.getElementById('csShow2')?.value === '1';
    const show3 = document.getElementById('csShow3')?.value === '1';

    const activeReach = show3 ? a3Reach : show2 ? a2Reach : a1Reach;

    let willBeTerminal = false;
    if (activeReach === 'No' && show3) willBeTerminal = true; // Unreachable
    if (agreedVal === 'No') willBeTerminal = true;            // Customer Declined
    if (joinedVal === 'Yes' || joinedVal === 'No') willBeTerminal = true; // Completed or No Show

    const packDiv = document.getElementById('csPackGlobal');
    if (packDiv) packDiv.style.display = willBeTerminal ? 'block' : 'none';
}
// Quarter info for a given date
function csGetQuarterInfo(date) {
    const q     = Math.ceil((date.getMonth() + 1) / 3);
    const year  = date.getFullYear();
    const qStart= new Date(year, (q - 1) * 3, 1);         // first day of quarter
    const qEnd  = new Date(year, q * 3, 0);               // last day of quarter
    const months= ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return { q, year, qStart, qEnd, label: `Q${q} ${year}` };
}

// Period string for a QSR monthly record: "Q1 2026 - Jan"
function csQSRPeriod(date) {
    const info   = csGetQuarterInfo(date);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${info.label} - ${months[date.getMonth()]}`;
}

// Get the quarter label from a QSR period string "Q1 2026 - Jan" → "Q1 2026"
function csQuarterFromPeriod(period) {
    return period.includes(' - ') ? period.split(' - ')[0] : period;
}

// ─── AUTO CREATE (v3 — Option C QSR monthly) ──────────────────────────────────
window.csAutoCreateReviews = async function () {
    try {
        csShowLoading('Creating reviews...');
        const now    = new Date();
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        let created = 0, skipped = 0;

        for (const account of CS_ACCOUNTS) {
            if (account.serviceRequired !== 'True') { skipped++; continue; }
            if (account.team === 'Call Center')      { skipped++; continue; }

            const isDSM = account.team === 'DSM';
            const isTSM = ['TSM_ME','TSM_SE'].includes(account.team);

            if (CS_ACTIVE_TAB === 'MSR' && !isDSM) { skipped++; continue; }
            if (CS_ACTIVE_TAB === 'QSR' && !isTSM) { skipped++; continue; }

            // ── MSR: unchanged ──────────────────────────────────────────────
            if (isDSM) {
                const period  = now.toLocaleString('en-US', { month:'short', year:'numeric' });
                const dueDate = new Date(now.getFullYear(), now.getMonth(), 25);
                if (CS_REVIEWS.some(r => r.accountCode === account.code && r.period === period)) { skipped++; continue; }
                const digest = await csGetFormDigest();
           const lmId = await csResolveUserId(account.lm);
const smId = await csResolveUserId(account.sm);
const msrBody = {
    __metadata: { type:'SP.Data.MSR_x005f_QSR_x005f_ReviewsListItem' },
    Title:           `MSR-${account.code}-${period.replace(' ','')}`,
    Account_Code:    account.code,
    Review_Type:     'MSR',
    Review_Period:   period,
    Review_Due_Date: dueDate.toISOString(),
    Review_Status:   'Pending'
};
if (lmId) msrBody.Line_ManagerId  = lmId;
if (smId) msrBody.Service_ManagerId = smId;
const res = await fetch(CS_SP_URL + "/_api/web/lists/getbytitle('MSR_QSR_Reviews')/items", {
    method: 'POST',
    headers: { 'Accept':'application/json;odata=verbose','Content-Type':'application/json;odata=verbose','X-RequestDigest':digest },
    credentials: 'include',
    body: JSON.stringify(msrBody)
});
                if (res.ok) created++; else skipped++;
                csUpdateLoadingProgress(`Processing: ${created + skipped} / ${CS_ACCOUNTS.length}`);
                continue;
            }

            // ── QSR: Option C — monthly records within the quarter ──────────
            if (isTSM) {
                const qi      = csGetQuarterInfo(now);
                const qLabel  = qi.label; // e.g. "Q1 2026"

                // Current month's period for this account
                const thisPeriod = csQSRPeriod(now); // e.g. "Q1 2026 - Jan"

                // Get all QSR records for this account in this quarter
                const quarterRecords = CS_REVIEWS.filter(r =>
                    r.accountCode === account.code &&
                    r.reviewType  === 'QSR' &&
                    csQuarterFromPeriod(r.period) === qLabel
                );

                // If any record for this quarter is Completed → skip entire quarter
                if (quarterRecords.some(r => r.status === 'Completed')) { skipped++; continue; }

                // If a record already exists for THIS month → skip
                if (quarterRecords.some(r => r.period === thisPeriod)) { skipped++; continue; }

                // Max 3 monthly records per quarter (Jan, Feb, Mar)
                if (quarterRecords.length >= 3) { skipped++; continue; }

                // Only create if this is month 1 OR previous month's record is not Completed
                // (i.e. previous month failed/declined/unreachable — needs retry this month)
                if (quarterRecords.length > 0) {
                    const lastRecord = quarterRecords[quarterRecords.length - 1];
                    const completedStatuses = ['Completed'];
                    // Don't create next month if previous is still Pending/In Progress
                    // (SM hasn't finished working on it yet)
                    const pendingStatuses = ['Pending', 'In Progress'];
                    if (pendingStatuses.includes(lastRecord.status)) { skipped++; continue; }
                    // If completed → already skipped above
                    // Otherwise (Declined, No Show, Unreachable, Failed) → create this month's record
                }

                // Due date = last day of current month
                const dueDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                dueDate.setHours(23, 59, 59, 0);

                const digest = await csGetFormDigest();
               const lmId = await csResolveUserId(account.lm);
const smId = await csResolveUserId(account.sm);
const qsrBody = {
    __metadata: { type:'SP.Data.MSR_x005f_QSR_x005f_ReviewsListItem' },
    Title:           `QSR-${account.code}-${thisPeriod.replace(/ /g,'')}`,
    Account_Code:    account.code,
    Review_Type:     'QSR',
    Review_Period:   thisPeriod,
    Review_Due_Date: dueDate.toISOString(),
    Review_Status:   'Pending'
};
if (lmId) qsrBody.Line_ManagerId    = lmId;
if (smId) qsrBody.Service_ManagerId = smId;
const res = await fetch(CS_SP_URL + "/_api/web/lists/getbytitle('MSR_QSR_Reviews')/items", {
    method: 'POST',
    headers: { 'Accept':'application/json;odata=verbose','Content-Type':'application/json;odata=verbose','X-RequestDigest':digest },
    credentials: 'include',
    body: JSON.stringify(qsrBody)
});
                if (res.ok) created++; else skipped++;
                csUpdateLoadingProgress(`Processing: ${created + skipped} / ${CS_ACCOUNTS.length}`);
            }
        }

        csHideLoading();
        alert(`✅ Done!\n• Created: ${created}\n• Skipped: ${skipped}`);
        await csFetchReviews();
        csRefreshMSRQSRDashboard();

    } catch (err) {
        csHideLoading();
        alert('❌ ' + err.message);
    }
};

// ─── EXPORT ───────────────────────────────────────────────────────────────────
function csDeriveCustomerJoined(review) {
    if (review.status === 'Completed') return 'Yes';
    if (review.status === 'No Show') return 'No';
    return '';
}

function csEscapeExportCell(v) {
    if (v == null || v === '') return '-';
    return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

window.csExportToExcel = function () {
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-GB') + ' ' + today.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });
    const headers = [
        'S.No', 'Type', 'Period', 'Account', 'Customer', 'Team', 'Service Manager', 'Line Manager',
        'POC Name', 'POC Contact', 'Status', 'Due Date', 'Actual Review Date',
        'Eligibility', 'Eligibility Reason',
        'Attempt 1 Date', 'Att.1 Ref', 'Reachable 1', 'Att.1 Notes',
        'Attempt 2 Date', 'Att.2 Ref', 'Reachable 2', 'Att.2 Notes',
        'Attempt 3 Date', 'Att.3 Ref', 'Reachable 3', 'Att.3 Notes',
        'Date Agreed?', 'Agreed Date', 'Review Mode', 'Customer Joined', 'LM Attended',
        'Review Notes', 'Action Items'
    ];
    const colSpan = headers.length;
    let html = '<html xmlns:o="urn:schemas-microsoft-com:office:office"><head><meta charset="utf-8"></head><body><table border="1">';
    html += `<tr><td colspan="${colSpan}" style="background:#a855f7;color:white;font-size:16px;font-weight:bold;text-align:center;padding:14px;">Customer Service Reviews</td></tr>`;
    html += `<tr><td colspan="${colSpan}" style="background:#f1f5f9;padding:8px;text-align:center;"><b>Generated:</b> ${dateStr}</td></tr><tr><td colspan="${colSpan}"></td></tr>`;
    html += '<tr>' + headers.map(h => `<th style="background:#7F77DD;color:white;font-weight:bold;padding:10px;">${h}</th>`).join('') + '</tr>';

    csGetDashboardReviewsFiltered({}).forEach((r, i) => {
        const a = CS_ACCOUNTS.find(x => x.code === r.accountCode);
        if (!a) return;
        const bg = i % 2 === 0 ? '#f8fafc' : '#ffffff';
        const row = [
            i + 1,
            a.team === 'DSM' ? 'MSR' : 'QSR',
            r.period,
            a.code,
            a.customer,
            a.team,
            a.sm,
            a.lm,
            a.pocName,
            a.pocContact,
            r.status,
            r.dueDate || '-',
            r.reviewDate || '-',
            r.eligibility || '-',
            r.eligibilityReason || '-',
            r.attempt1Date || '-',
            r.eventRef1 || '-',
            r.reachable1 || '-',
            r.attempt1Notes || '-',
            r.attempt2Date || '-',
            r.eventRef2 || '-',
            r.reachable2 || '-',
            r.attempt2Notes || '-',
            r.attempt3Date || '-',
            r.eventRef3 || '-',
            r.reachable3 || '-',
            r.attempt3Notes || '-',
            r.reviewDateAgreed || '-',
            r.agreedDate || '-',
            r.reviewMode || '-',
            csDeriveCustomerJoined(r) || '-',
            r.lmAttended || '-',
            r.reviewNotes || '-',
            r.actionItems || '-'
        ];
        html += `<tr>${row.map(v => `<td style="background:${bg};padding:8px;">${csEscapeExportCell(v)}</td>`).join('')}</tr>`;
    });

    html += '</table></body></html>';
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([html], { type:'application/vnd.ms-excel' }));
    link.download = `CS_Reviews_${today.toISOString().split('T')[0]}.xls`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// ─── ATTACHMENT HELPERS (unchanged) ──────────────────────────────────────────
async function csGetAttachments(itemId) {
    try {
        const res = await fetch(CS_SP_URL + `/_api/web/lists/getbytitle('${CS_REVIEWS_LIST}')/items(${itemId})/AttachmentFiles`, {
            headers: { 'Accept': 'application/json;odata=verbose' }, credentials: 'include'
        });
        if (!res.ok) return [];
        const data = await res.json();
        return data.d.results.map(a => ({ name: a.FileName, url: a.ServerRelativeUrl }));
    } catch (e) { return []; }
}

async function csUploadPackAttachment(itemId, file) {
    try {
        const digest = await csGetFormDigest();
        const res = await fetch(CS_SP_URL + `/_api/web/lists/getbytitle('${CS_REVIEWS_LIST}')/items(${itemId})/AttachmentFiles/add(FileName='${encodeURIComponent(file.name)}')`, {
            method: 'POST',
            headers: { 'Accept': 'application/json;odata=verbose', 'X-RequestDigest': digest },
            credentials: 'include', body: file
        });
        return res.ok;
    } catch (e) { return false; }
}

async function csGetFormDigest() {
    const res = await fetch(CS_SP_URL + '/_api/contextinfo', {
        method: 'POST', headers: { 'Accept': 'application/json;odata=verbose' }, credentials: 'include'
    });
    const data = await res.json();
    return data.d.GetContextWebInformation.FormDigestValue;
}

// ─── LOADING OVERLAY (unchanged) ─────────────────────────────────────────────
function csShowLoading(msg) {
    let o = document.getElementById('csLoadingOverlay');
    if (!o) { o = document.createElement('div'); o.id = 'csLoadingOverlay'; o.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:99999;display:flex;align-items:center;justify-content:center;'; document.body.appendChild(o); }
    o.innerHTML = `<div style="background:var(--bg-card);padding:40px;border-radius:20px;text-align:center;max-width:480px;border:1px solid var(--border);"><i data-lucide="loader-2" style="width:40px;height:40px;color:var(--acc);animation:spin 1s linear infinite;display:block;margin:0 auto 16px;"></i><h3 style="font-size:16px;font-weight:700;color:var(--t1);margin-bottom:8px;">${msg}</h3><p id="csLoadingProgress" style="font-size:13px;color:var(--t3);">Please wait...</p></div>`;
    o.style.display = 'flex';
    if (typeof lucide !== 'undefined') lucide.createIcons();
}
function csUpdateLoadingProgress(msg) { const p = document.getElementById('csLoadingProgress'); if (p) p.textContent = msg; }
function csHideLoading() { const o = document.getElementById('csLoadingOverlay'); if (o) o.style.display = 'none'; }

// ─── HEALTH CHECK (unchanged from v1) ────────────────────────────────────────
async function csFetchHealthChecks() {
    try {
        const url = CS_SP_URL + "/_api/web/lists/getbytitle('" + CS_HEALTH_LIST + "')/items?" +
            "$select=ID,Title,Account_Code,HC_Date,Notes,Customer_Reachable,Event_Ref&$top=20000";
        const res = await fetch(url, { headers: {'Accept':'application/json;odata=verbose'}, credentials:'include' });
        if (!res.ok) return;
        const data = await res.json();
        CS_HEALTH_CHECKS = data.d.results.map(i => ({
            id:         i.ID,
            accountCode: i.Account_Code || '',
            date:       i.HC_Date ? new Date(i.HC_Date).toISOString().split('T')[0] : null,
            reachable:  i.Customer_Reachable || '',
            eventRef:   i.Event_Ref || '',
            notes:      i.Notes || ''
        }));
    } catch(e) { console.warn('HC fetch failed:', e); }
}
function csRenderHCKPIs() {
    const tsmAccounts = CS_ACCOUNTS.filter(a => ['TSM_ME','TSM_SE'].includes(a.team));
    let relevantAccounts = tsmAccounts;
    if (CS_USER_CONTEXT.role === 'SM') relevantAccounts = tsmAccounts.filter(a => a.sm === CS_USER_CONTEXT.userName);
    else if (CS_USER_CONTEXT.role === 'LM') relevantAccounts = tsmAccounts.filter(a => a.lm === CS_USER_CONTEXT.userName);
    const now = new Date();
    const thisMonth = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
    const accountCodes = relevantAccounts.map(a => a.code);
    const allHC = CS_HEALTH_CHECKS.filter(h => accountCodes.includes(h.accountCode));
    const thisMonthHC = allHC.filter(h => h.date && h.date.startsWith(thisMonth));
    const touchedCodes = new Set(thisMonthHC.map(h => h.accountCode));
    const notTouched = relevantAccounts.filter(a => !touchedCodes.has(a.code)).length;
    document.getElementById('csHCKPIs').innerHTML = `
    <div class="top-stats" style="margin-bottom:1rem;">
        <div class="stat-card"><div class="stat-label">Total interactions</div><div class="stat-value">${allHC.length}</div><div class="stat-subtitle">All time</div></div>
        <div class="stat-card"><div class="stat-label">This month</div><div class="stat-value" style="color:var(--acc)">${thisMonthHC.length}</div><div class="stat-subtitle">Interactions logged</div></div>
        <div class="stat-card"><div class="stat-label">Accounts touched</div><div class="stat-value" style="color:#10b981">${touchedCodes.size}</div><div class="stat-subtitle">This month</div></div>
        <div class="stat-card"><div class="stat-label">Not touched</div><div class="stat-value" style="color:var(--danger)">${notTouched}</div><div class="stat-subtitle">No interaction this month</div></div>
    </div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

window.csHCApplyFilters = function() {
    const search = document.getElementById('csHCSearchBox') ? document.getElementById('csHCSearchBox').value.toLowerCase() : '';
    const tsmAccounts = CS_ACCOUNTS.filter(a => ['TSM_ME','TSM_SE'].includes(a.team));
    let relevantAccounts = tsmAccounts;
    if (CS_USER_CONTEXT.role === 'SM') relevantAccounts = tsmAccounts.filter(a => a.sm === CS_USER_CONTEXT.userName);
    else if (CS_USER_CONTEXT.role === 'LM') relevantAccounts = tsmAccounts.filter(a => a.lm === CS_USER_CONTEXT.userName);
    const accountCodes = relevantAccounts.map(a => a.code);
    let rows = CS_HEALTH_CHECKS.filter(h => accountCodes.includes(h.accountCode));
   if (search) {
        rows = rows.filter(h => {
            const a = CS_ACCOUNTS.find(x => x.code === h.accountCode);
            return h.accountCode.toLowerCase().includes(search) ||
                   (a && a.customer.toLowerCase().includes(search)) ||
                   (a && a.sm.toLowerCase().includes(search));
        });
    }
   const rowData = rows.map(h => {
    const a = CS_ACCOUNTS.find(x => x.code === h.accountCode);
    return {
        id:          h.id,
        accountCode: h.accountCode,
        customer:    a ? a.customer : '-',
        team:        a ? a.team : '-',
        sm:          a ? a.sm : '-',
        lm:          a ? a.lm : '-',
        date:        h.date || '-',
        reachable:   h.reachable || '-',
        eventRef:    h.eventRef || '-',
        notes:       h.notes || '-'
    };
});
    if (!csHCGridApi) { csInitHCGrid(rowData); } else { csHCGridApi.setGridOption('rowData', rowData); }
};

function csInitHCGrid(rowData) {
    const gridDiv = document.getElementById('csHCGrid');
    if (csHCGridApi) { try { csHCGridApi.destroy(); } catch(e){} csHCGridApi = null; }
    gridDiv.innerHTML = '';
    var hcColumnDefs = [
        { field:'date', headerName:'Date', width:120 },
        { field:'accountCode', headerName:'Account', width:120, cellStyle:{fontWeight:'700'} },
        { field:'customer', headerName:'Customer', flex:1, minWidth:160 },
        { field:'team', headerName:'Team', width:100 },
        { field:'sm', headerName:'Service Manager', width:160 },
        { field:'lm', headerName:'Line Manager', width:150 },
        { field:'reachable', headerName:'Reachable', width:110,
          cellRenderer: p => p.value==='Yes'
            ? `<span style="font-weight:700;color:#10b981;">Yes</span>`
            : p.value==='No'
            ? `<span style="font-weight:700;color:#ef4444;">No</span>`
            : '<span style="color:var(--t3);">—</span>'
        },
        { field:'eventRef', headerName:'Event Ref', width:140 },
        { field:'notes', headerName:'Notes', flex:1, minWidth:160,
          cellRenderer: p => {
              if (!p.value || p.value === '-') return '<span style="color:var(--t3);">—</span>';
              const clean = p.value.replace(/<[^>]*>/g,'').trim();
              return `<span title="${clean}">${clean}</span>`;
          }
        },
        { field:'edit', headerName:'', width:100, pinned:'right', sortable:false, filter:false,
          cellRenderer: p => {
              const canEdit = CS_USER_CONTEXT.role === 'SD' || CS_USER_CONTEXT.isTSMManager ||
                  (CS_USER_CONTEXT.role === 'SM' && p.data.sm === CS_USER_CONTEXT.userName) ||
                  (CS_USER_CONTEXT.role === 'LM' && p.data.lm === CS_USER_CONTEXT.userName);
              return canEdit ? `<button type="button" class="export-btn" onclick="csShowHCModal(${p.data.id})" style="padding:5px 12px;font-size:11px;">Edit</button>` : '';
          }
        }
    ];
    agGrid.createGrid(gridDiv, {
        columnDefs: csMapColumnDefs(hcColumnDefs),
        rowData,
        defaultColDef:{ sortable:true, filter:true, resizable:true, minWidth:80 },
        pagination:true, paginationPageSize:50, rowHeight:56, headerHeight:48, animateRows:true,
        enableCellTextSelection:true,
        suppressMenuHide:false,
        onGridReady: p => { csHCGridApi = p.api; }
    });
    if (typeof lucide !== 'undefined') lucide.createIcons();
}
window.csShowHCModal = function(hcId) {
    const existing = hcId ? CS_HEALTH_CHECKS.find(h => h.id === hcId) : null;

    // ── CASCADING ACCOUNT FILTER based on role ─────────────────
    let tsmAccounts = CS_ACCOUNTS.filter(a => ['TSM_ME','TSM_SE'].includes(a.team));

    if (CS_USER_CONTEXT.role === 'SM') {
        tsmAccounts = tsmAccounts.filter(a => a.sm === CS_USER_CONTEXT.userName);
    } else if (CS_USER_CONTEXT.role === 'LM') {
        tsmAccounts = tsmAccounts.filter(a => a.lm === CS_USER_CONTEXT.userName);
    } else if (CS_USER_CONTEXT.isTSMManager) {
        // TSM Manager sees TSM_ME, TSM_SE — already filtered above
    }
    // SD/Admin sees all

    const inp = 'width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;font-family:inherit;background:var(--bg-input);color:var(--t1);box-sizing:border-box;';
    const lbl = 'font-size:11px;font-weight:600;color:var(--t3);text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:5px;';
    const sec = 'background:var(--bg-secondary);padding:16px;border-radius:10px;border:1px solid var(--border);margin-bottom:12px;';
    const btnS = (active, colorKey) => active
        ? `flex:1;padding:10px;border-radius:8px;border:2px solid ${colorKey==='green'?'#1D9E75':'#D85A30'};background:${colorKey==='green'?'#e1f5ee':'#faece7'};color:${colorKey==='green'?'#085041':'#712b13'};font-size:13px;font-weight:700;cursor:pointer;`
        : `flex:1;padding:10px;border-radius:8px;border:1.5px solid var(--border);background:var(--bg-input);color:var(--t2);font-size:13px;font-weight:600;cursor:pointer;`;

    const savedReach = existing ? existing.reachable : '';

    // Build account options with customer name for display
    const accountOptions = tsmAccounts
        .sort((a,b) => a.customer.localeCompare(b.customer))
        .map(a => `<option value="${a.code}" ${existing && existing.accountCode === a.code ? 'selected' : ''}>${a.code} — ${a.customer}</option>`)
        .join('');

    let modal = document.getElementById('csHCModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'csHCModal';
        modal.style.cssText = 'display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:10001;padding:20px;overflow-y:auto;';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
<div style="background:var(--bg-card);border-radius:16px;padding:28px;max-width:680px;margin:60px auto;box-shadow:var(--ch);border:1px solid var(--border);">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;padding-bottom:14px;border-bottom:2px solid var(--border);">
        <h2 style="font-size:17px;font-weight:800;color:var(--t1);">${existing ? 'Edit' : 'Add'} Health Check</h2>
        <button type="button" onclick="document.getElementById('csHCModal').style.display='none'" style="background:none;border:none;font-size:26px;cursor:pointer;color:var(--t3);">×</button>
    </div>
    <form id="csHCForm" onsubmit="csSaveHC(event);return false;">

        <div style="${sec}">
            <label style="${lbl}">Account *</label>
            <div style="position:relative;">
                <input type="text" id="csHCAccountSearch" placeholder="Search by code or customer name..."
                    style="${inp}margin-bottom:6px;"
                    oninput="csHCFilterAccounts(this.value)">
                <select id="csHCAccount" required size="6"
                    style="${inp}height:160px;padding:4px;">
                    <option value="">— select account —</option>
                    ${accountOptions}
                </select>
                <div id="csHCAccountCount" style="font-size:11px;color:var(--t3);margin-top:4px;">${tsmAccounts.length} accounts</div>
            </div>
        </div>

        <div style="${sec}">
            <label style="${lbl}">Date *</label>
            <input type="date" id="csHCDate" required
                value="${existing && existing.date ? existing.date : new Date().toISOString().split('T')[0]}"
                style="${inp}">
        </div>

        <div style="${sec}">
            <label style="${lbl}">Was customer reachable? *</label>
            <input type="hidden" id="csHCReachVal" value="${savedReach}">
            <div style="display:flex;gap:8px;">
                <button type="button" id="csHCReachYes" onclick="csHCSetReachable('Yes')"
                    style="${btnS(savedReach==='Yes','green')}">Yes — reachable</button>
                <button type="button" id="csHCReachNo" onclick="csHCSetReachable('No')"
                    style="${btnS(savedReach==='No','red')}">No — not reachable</button>
            </div>
        </div>

        <div style="${sec}">
            <label style="${lbl}">Event / Call Ref No. *</label>
            <input type="text" id="csHCEventRef" required
                value="${existing ? existing.eventRef : ''}"
                placeholder="e.g. EVT-20240401-001" style="${inp}">
        </div>

        <div style="${sec}">
            <label style="${lbl}">Notes</label>
            <textarea id="csHCNotes" rows="3" style="${inp}resize:vertical;">${existing ? (existing.notes || '').replace(/<[^>]*>/g, '').trim() : ''}</textarea>
        </div>

        <input type="hidden" id="csHCId" value="${hcId||''}">
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;">
            <button type="button" onclick="document.getElementById('csHCModal').style.display='none'" class="reset-btn">Cancel</button>
            <button type="submit" class="export-btn">
                <i data-lucide="save" style="width:13px;height:13px;display:inline-block;vertical-align:middle;margin-right:5px;"></i>Save
            </button>
        </div>
    </form>
</div>`;

    // Store accounts for search filtering
    window._csHCAccountsAll = tsmAccounts;

    modal.style.display = 'block';
    if (typeof lucide !== 'undefined') lucide.createIcons();
};

// ── HC Account search filter ──────────────────────────────────────────────────
window.csHCFilterAccounts = function(query) {
    const select = document.getElementById('csHCAccount');
    const countEl = document.getElementById('csHCAccountCount');
    if (!select || !window._csHCAccountsAll) return;

    const q = query.toLowerCase().trim();
    const filtered = q
        ? window._csHCAccountsAll.filter(a =>
            a.code.toLowerCase().includes(q) ||
            a.customer.toLowerCase().includes(q) ||
            a.sm.toLowerCase().includes(q))
        : window._csHCAccountsAll;

    const current = select.value;
    select.innerHTML = '<option value="">— select account —</option>' +
        filtered
            .sort((a,b) => a.customer.localeCompare(b.customer))
            .map(a => `<option value="${a.code}" ${a.code === current ? 'selected' : ''}>${a.code} — ${a.customer}</option>`)
            .join('');

    if (countEl) countEl.textContent = filtered.length + ' accounts' + (q ? ' (filtered)' : '');
};window.csSaveHC = async function(event) {
    event.preventDefault();
    const hcId        = document.getElementById('csHCId').value;
    const accountCode = document.getElementById('csHCAccount').value;
    const hcDate      = document.getElementById('csHCDate').value;
    const reachable   = document.getElementById('csHCReachVal').value;
    const eventRef    = document.getElementById('csHCEventRef').value;
    const notes       = document.getElementById('csHCNotes').value;

    if (!reachable) { alert('Please select whether the customer was reachable.'); return; }
    if (!eventRef)  { alert('Event / Call Ref No. is required.'); return; }

    csShowLoading('Saving health check...');
    try {
        const digest = await csGetFormDigest();
        const body = JSON.stringify({
            __metadata:          { type:'SP.Data.Health_x005f_Check_x005f_ReviewsListItem' },
            Title:               'HC-' + accountCode + '-' + hcDate,
            Account_Code:        accountCode,
            HC_Date:             new Date(hcDate).toISOString(),
            Interaction_Type:    'Call',
            Customer_Reachable:  reachable,
            Event_Ref:           eventRef,
            Notes:               notes
        });
        const headers = {
            'Accept':       'application/json;odata=verbose',
            'Content-Type': 'application/json;odata=verbose',
            'X-RequestDigest': digest
        };
        let url = CS_SP_URL + "/_api/web/lists/getbytitle('" + CS_HEALTH_LIST + "')/items";
        if (hcId) {
            headers['X-HTTP-Method'] = 'MERGE';
            headers['If-Match']      = '*';
            url += '(' + hcId + ')';
        }
        const res = await fetch(url, { method:'POST', headers, credentials:'include', body });
        csHideLoading();
        if (!res.ok) throw new Error('Save failed');
        alert('✅ Health check saved!');
        document.getElementById('csHCModal').style.display = 'none';
        await csFetchHealthChecks();
        csRenderHCKPIs();
        csHCApplyFilters();
    } catch(err) { csHideLoading(); alert('❌ ' + err.message); }
};
window.csExportHCToExcel = function() {
    const today = new Date();
    let html = '<html><head><meta charset="utf-8"></head><body><table border="1">';
    html += `<tr><td colspan="8" style="background:#10b981;color:white;font-size:16px;font-weight:bold;text-align:center;padding:14px;">Health Check Interactions</td></tr>`;
    html += '<tr>' + ['Date','Account','Customer','Team','Service Manager','Interaction Type','Notes','Action Items'].map(h=>`<th style="background:#10b981;color:white;font-weight:bold;padding:10px;">${h}</th>`).join('') + '</tr>';
    CS_HEALTH_CHECKS.forEach((h,i) => {
        const a = CS_ACCOUNTS.find(x => x.code === h.accountCode);
        const bg = i%2===0?'#f8fafc':'#fff';
        html += `<tr>${[h.date||'-',h.accountCode,a?a.customer:'-',a?a.team:'-',a?a.sm:'-',h.type,h.notes,h.actions].map(v=>`<td style="background:${bg};padding:8px;">${v}</td>`).join('')}</tr>`;
    });
    html += '</table></body></html>';
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([html],{type:'application/vnd.ms-excel'}));
    link.download = 'HealthCheck_'+today.toISOString().split('T')[0]+'.xls';
    link.style.display='none'; document.body.appendChild(link); link.click(); document.body.removeChild(link);
};
