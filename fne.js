  // ══════════════════════════════════════════════════════════════════
  //  fnetracker.js  —  FNE Tracker Form + List module  (v2)
  //  Depends on: SP_SITE constant, USER object, spGet, spPost,
  //              getDigest, fmt, fmtDate, num  (all from dashboard.js)
  // ══════════════════════════════════════════════════════════════════
  
  const FNE_LIST = 'FNE Tracker GKLA 23-24';
  const FNE_SP   = window.SP_SITE || 'http://sharedspaces:8081/sites/FGKA';
  
  // ─── Choice values (fallback hardcoded; also fetched from SP dynamically) ──
  const FNE_CHOICES = {
    subRequest:      ['Site Feasibility Check','Activation Survey','Wireless Survey','Wireless Implementation','Fiber Implementation'],
    implType:        ['Shortfall','FNE','Site Office','Wireless Implementation'],
    buildingStatus:  ['RFS','Partial RFS','Not Connected'],
    sof:             ['Yes','No'],
    vertical:        [],
    requestStatus:   ['In Progress','Completed','Cancelled','On Hold'],
    assignedBy:      ['Service Manager','Account Manager','Solution Manager','Project Manager'],
    projectType:     ['FNE','PIS','Rollout','Taawun','Site Office','Wireless'],
    ospCivil:        ['Yes','No'],
    accountDirector: [],
    fneManager:      ['Arafat Wanchoo','Husham Salih','Jamal Sattar','Ishfaq Deen'],
    tempConnType:    ['Wireless','Fibre'],
    blocker:         ['Customer','Infra'],
    criticalProjects:['Yes','No'],
   projectHealth: [
  'Green',
  'Amber',
  'Red',
  'No Expected RFS to calculate Project Health'
],
  };

  // Vertical → Account Director (auto-select on form & bulk tables)
  // Keys are normalized (lowercase, no spaces/dashes) — SP uses KeyA, KeyB, HUNT, F-NE, etc.
  const FNE_VERTICAL_DIRECTOR_MAP = {
    'auh':     'Fatma Almheiri',
    'dxb':     'Mohamad Amer Sibai',
    'keya':    'Hany Jawee',
    'keyb':    'Mazen Adem',
    'le':      'Muhammad Shahzad Hasan',
    'hunt':    'Khalid Karmastaji',
    'hunting': 'Khalid Karmastaji',
    'fne':     'Majd Nairoukh',
    'nef':     'Majd Nairoukh',
    // legacy vertical codes still in some records
    'fogh':    'Hany Jawee',
    'tre':     'Hany Jawee',
    'trm':     'Mazen Adem',
  };

  const FNE_POWER_EMAILS = ['husham.salih@du.ae', 'tehleel.lone@du.ae'];
  const FNE_STATUS_COMPLETED = ['Completed'];

  const FNE_MGR_EMAIL_MAP = {
    'husham salih': 'husham.salih@du.ae',
    'tehleel lone': 'tehleel.lone@du.ae',
    'jamal sattar': 'jamal.sattar@du.ae',
    'arafat wanchoo': 'arafat.wanchoo@du.ae',
    'ishfaq deen': 'ishfaq.deen@du.ae',
  };

  const FNE_LIST_MS_STATE = {
    status: new Set(), implType: new Set(), vertical: new Set(),
    fneManager: new Set(), buildStatus: new Set(), projType: new Set(),
    subReq: new Set(), assignedBy: new Set(), accDir: new Set(),
    osp: new Set(), sof: new Set(), health: new Set(), blocker: new Set(),
    critical: new Set(), year: new Set(),
  };

  const FNE_LIST_MS_CFG = {
    status:     { field: 'requestStatus',   txtId: 'fne-mstxt-status',     dropId: 'fne-msd-status',     mstId: 'fne-mst-status' },
    implType:   { field: 'implType',        txtId: 'fne-mstxt-implType',   dropId: 'fne-msd-implType',   mstId: 'fne-mst-implType' },
    vertical:   { field: 'vertical',        txtId: 'fne-mstxt-vertical',   dropId: 'fne-msd-vertical',   mstId: 'fne-mst-vertical' },
    fneManager: { field: 'fneManager',      txtId: 'fne-mstxt-fneManager', dropId: 'fne-msd-fneManager', mstId: 'fne-mst-fneManager' },
    buildStatus:{ field: 'buildingStatus',  txtId: 'fne-mstxt-buildStatus',dropId: 'fne-msd-buildStatus',mstId: 'fne-mst-buildStatus' },
    projType:   { field: 'projectType',     txtId: 'fne-mstxt-projType',   dropId: 'fne-msd-projType',   mstId: 'fne-mst-projType' },
    subReq:     { field: 'subRequest',      txtId: 'fne-mstxt-subReq',     dropId: 'fne-msd-subReq',     mstId: 'fne-mst-subReq' },
    assignedBy: { field: 'assignedBy',      txtId: 'fne-mstxt-assignedBy', dropId: 'fne-msd-assignedBy', mstId: 'fne-mst-assignedBy' },
    accDir:     { field: 'accountDirector', txtId: 'fne-mstxt-accDir',     dropId: 'fne-msd-accDir',     mstId: 'fne-mst-accDir' },
    osp:        { field: 'ospRequired',     txtId: 'fne-mstxt-osp',        dropId: 'fne-msd-osp',        mstId: 'fne-mst-osp' },
    sof:        { field: 'sof',             txtId: 'fne-mstxt-sof',        dropId: 'fne-msd-sof',        mstId: 'fne-mst-sof' },
    health:     { field: 'projectHealth',   txtId: 'fne-mstxt-health',     dropId: 'fne-msd-health',     mstId: 'fne-mst-health' },
    blocker:    { field: 'blocker',         txtId: 'fne-mstxt-blocker',    dropId: 'fne-msd-blocker',    mstId: 'fne-mst-blocker' },
    critical:   { field: 'criticalProjects',txtId: 'fne-mstxt-critical',   dropId: 'fne-msd-critical',   mstId: 'fne-mst-critical' },
    year:       { field: 'year',            txtId: 'fne-mstxt-year',       dropId: 'fne-msd-year',       mstId: 'fne-mst-year', numeric: true },
  };

  const FNE_FORM_SEL_MAP = {
    subRequest: 'fne_sub_req', implType: 'fne_impl_type',
    buildingStatus: 'fne_build_status', sof: 'fne_sof',
    vertical: 'fne_vertical', requestStatus: 'fne_req_status',
    assignedBy: 'fne_assigned_by', projectType: 'fne_proj_type',
    ospCivil: 'fne_osp', accountDirector: 'fne_acc_dir',
    fneManager: 'fne_fne_mgr', tempConnType: 'fne_temp_conn',
    blocker: 'fne_blocker', criticalProjects: 'fne_critical_projects',
  };

  const FNE_FILTER_SEL_MAP = {
    status: 'requestStatus', implType: 'implType', vertical: 'vertical',
    fneManager: 'fneManager', buildStatus: 'buildingStatus', projType: 'projectType',
    subReq: 'subRequest', assignedBy: 'assignedBy', accDir: 'accountDirector',
    osp: 'ospCivil', sof: 'sof', health: 'projectHealth', blocker: 'blocker',
    critical: 'criticalProjects',
  };

  // ─── SP Field internal name map ────────────────────────────────────
  const FNE_F = {
    FES:          'Title',
    SUB_REQ:      'Sub_x0020_Request_x0020_',
    IMPL_TYPE:    'Implementation_x0020_Type',
    START_DATE:   'Recived_x0020_Date',
    SLA:          'SAL',
    EXP_RFS:      'Expected_x0020_RSF_x0020_Date',
    BUILD_STATUS: 'Building_x0020_Connectivity',
    CUST_NAME:    'Customer_x0020_Name',
    SOF:          'SOF_x0020_',
    MRC:          'MRC',
    EST_COST:     'Estimated_x0020_Cost',
    VERTICAL:     'Vertical',
    COMMENTS:     'Comments',
    REQ_STATUS:   'Request_x0020_Status',
    CUST_ADDR:    'CustomerAddress',
    ACC_CODE:     'AccountCode',
    ASSIGNED_BY:  'AssignedBy',
    PROJ_TYPE:    'ProjectType',
    UNIT_NO:      'UnitNo',
    OTC:          'OTC',
    TCV:          'TCV0',
    OSP_REQ:      'OSPandCivilRequired',
    OSP_ET:       'OSPCivilET',
    FES_REF:      'FESShortfalReference',
    SURVEY_REF:   'SiteSurveyReference',
    GAID:         'GAID0',
    BID_REF:      'BidRef',
    WO_NUM:       'WONumber',
    ACC_DIR:      'AccountDirector',
    CONTRACT_DUR: 'ContractDuration0',
    FNE_MGR:      'FNEManager',
    RFS_BASELINE: 'RFS_x0020_Baseline',
    CRITICAL_PROJ:'Critical_x0020_Projects',
    COMMENTS_NEW: 'Comments_New',
    IMPL_START:   'Implementation_Start_Date',
    PROJ_HEALTH:  'Project_x0020_Health',
    SPI:          'SPI',
    TEMP_CONN:    'Current_x0020_Temporary_x0020_Co',
    TARGET_MIG:   'Target_x0020_Migration_x0020_Dat',
    BLOCKER:      'Current_x0020_Blocker',
    PM_MAN_DAYS:  'PM_x0020_Man_x0020_days_x002f_Ac', // display: Project Duration
  };
  
  // ─── State ─────────────────────────────────────────────────────────
  let FNE_EDIT_ID        = null;
  let FNE_EDIT_CRITICAL_PREV = '';
  let FNE_LIST_DATA      = [];
  let FNE_GRID_API       = null;
  let FNE_CAME_FROM_LIST = false;
  let FNE_LIST_ITEM_TYPE = '';   // fetched dynamically on init
  
  // One-time lock state: tracks which fields are locked for this item
  // key = itemId, value = { expRfsLocked, implStartLocked }
  let FNE_LOCK_STATE = {};
  
  // Pending attachments for new/edit
  let FNE_PENDING_ATTACH  = [];   // { file, name } to upload
  let FNE_EXISTING_ATTACH = [];   // { FileName, ServerRelativeUrl } from SP

  function fneTodayDateStr() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function fneIsFutureDate(dateStr) {
    if (!dateStr) return false;
    return dateStr > fneTodayDateStr();
  }

  function fneSetActualRfsMaxDate() {
    const el = document.getElementById('fne_rfs_baseline');
    if (el) el.max = fneTodayDateStr();
  }

  // SharePoint rich-text fields (Comments_New, etc.) are stored as HTML
  function fneHtmlToPlain(html) {
    if (html === null || html === undefined || html === '' || html === '—') return '';
    const s = String(html);
    if (!s.includes('<')) return s.trim();
    const el = document.createElement('div');
    el.innerHTML = s;
    return (el.textContent || el.innerText || '')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

function fneIsAdmin() {
  const role = (USER && USER.role ? String(USER.role) : '').toLowerCase();
  return !!(
    USER &&
    (
      USER.IsAdmin === true ||
      role === 'admin' ||
      role === 'director'
    )
  );
}

function fneNormEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function fneCurrentUser() {
  return window.USER || (typeof USER !== 'undefined' ? USER : null);
}

function fneIsPowerUser() {
  const u = fneCurrentUser();
  const email = fneNormEmail(u && u.email);
  if (FNE_POWER_EMAILS.indexOf(email) >= 0) return true;
  const name = fneNormStr(u && u.name);
  if (name.indexOf('husham') >= 0 && name.indexOf('salih') >= 0) return true;
  if (name.indexOf('tehleel') >= 0 && name.indexOf('lone') >= 0) return true;
  return false;
}

function fneParseSpDateLocal(val) {
  if (val === null || val === undefined || val === '') return null;
  let raw = val;
  if (typeof raw === 'string' && raw.indexOf('/Date(') >= 0) {
    const m = raw.match(/\/Date\((-?\d+)\)\//);
    if (m) raw = new Date(parseInt(m[1], 10)).toISOString();
  }
  const d = new Date(raw);
  if (isNaN(d)) return null;
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function fneGetRfsMigrationFilter() {
  const listEl = document.getElementById('fnel_rfsMigration');
  if (listEl) return listEl.value || '';
  const dashEl = document.getElementById('dashRfsMigration');
  return dashEl ? (dashEl.value || '') : '';
}

function fneIsActiveRfsStatus(status) {
  const s = String(status || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return s !== 'completed' && s !== 'cancelled';
}

function fneHeaderMinWidth(headerName) {
  return Math.max(100, Math.ceil(String(headerName || '').length * 7.5) + 36);
}

function fneApplyHeaderSizing(col) {
  if (col.headerName && col.colId !== 'fne_select' && col.colId !== 'fne_reminder') {
    col.wrapHeaderText = true;
    col.autoHeaderHeight = true;
    const mw = fneHeaderMinWidth(col.headerName);
    if (!col.minWidth || col.minWidth < mw) col.minWidth = mw;
  }
  return col;
}

function fneDaysUntilExpectedRfs(iso) {
  const expStr = fneParseSpDateLocal(iso);
  if (!expStr) return null;
  const todayStr = fneTodayDateStr();
  const exp = new Date(expStr + 'T12:00:00');
  const today = new Date(todayStr + 'T12:00:00');
  return Math.round((exp - today) / 86400000);
}

function fneIsApproachingRfs(item) {
  if (!item || !fneIsActiveRfsStatus(item.requestStatus)) return false;
  const d = fneDaysUntilExpectedRfs(item.expectedRFS);
  return d !== null && d >= 0 && d <= 4;
}

function fneIsOverdueRfs(item) {
  if (!item || !fneIsActiveRfsStatus(item.requestStatus)) return false;
  const d = fneDaysUntilExpectedRfs(item.expectedRFS);
  return d !== null && d < 0;
}

function fneRfsAlertKind(item) {
  if (fneIsOverdueRfs(item)) return 'overdue';
  if (fneIsApproachingRfs(item)) return 'approaching';
  return null;
}

function fneFmtDateShort(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d) ? '—' : d.toLocaleDateString('en-GB');
}

function fneMgrMailto(name) {
  const key = String(name || '').toLowerCase().trim();
  return FNE_MGR_EMAIL_MAP[key] || '';
}

function fneOpenOutlookMail(to, subject, body, highPriority) {
  let href = 'mailto:';
  if (to) href += encodeURIComponent(to);
  href += '?subject=' + encodeURIComponent(subject);
  href += '&body=' + encodeURIComponent(body);
  if (highPriority) href += '&X-Priority=1';
  const link = document.createElement('a');
  link.href = href;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function fneNormCriticalVal(v) {
  return String(v || '').trim().toLowerCase();
}

function fneIsCriticalYes(v) {
  return fneNormCriticalVal(v) === 'yes';
}

function fneOpenRfsReminder(row, kind) {
  if (!row) return;
  kind = kind || fneRfsAlertKind(row);
  if (!kind) return;
  const mgr = row.fneManager && row.fneManager !== '—' ? row.fneManager : 'FNE Manager';
  const to = fneMgrMailto(mgr);
  const cust = row.customerName && row.customerName !== '—' ? row.customerName : 'Customer';
  const exp = fneFmtDateShort(row.expectedRFS);
  const status = row.requestStatus || '—';
  const refLine = row.fesRef && row.fesRef !== '—' ? 'FES / Shortfall Ref: ' + row.fesRef + '\n' : '';
  const idLine = row.id ? 'Record ID: ' + row.id + '\n' : '';
  if (kind === 'approaching') {
    const days = fneDaysUntilExpectedRfs(row.expectedRFS);
    fneOpenOutlookMail(to,
      '[Reminder] Expected RFS approaching — ' + cust,
      'Dear ' + mgr + ',\n\nThis is a reminder that the Expected RFS date is approaching for the following project:\n\n' +
      idLine + 'Customer: ' + cust + '\nExpected RFS: ' + exp + ' (' + days + ' day(s) remaining)\nStatus: ' + status + '\n' +
      refLine + '\nPlease review and take necessary action.\n\nThank you.',
      false);
  } else {
    const daysOver = Math.abs(fneDaysUntilExpectedRfs(row.expectedRFS));
    fneOpenOutlookMail(to,
      '[Overdue] Expected RFS date passed — ' + cust,
      'Dear ' + mgr + ',\n\nThe Expected RFS date has passed and the project is not yet completed:\n\n' +
      idLine + 'Customer: ' + cust + '\nExpected RFS: ' + exp + ' (' + daysOver + ' day(s) overdue)\nStatus: ' + status + '\n' +
      refLine + '\nPlease urgently follow up and update the tracker.\n\nThank you.',
      true);
  }
}

function fneNotifyCriticalProjectYes(row) {
  if (!row) return;
  const mgr = row.fneManager && row.fneManager !== '—' ? row.fneManager : 'FNE Manager';
  const to = fneMgrMailto(mgr);
  const cust = row.customerName && row.customerName !== '—' ? row.customerName : 'Customer';
  const refLine = row.fesRef && row.fesRef !== '—' ? 'FES / Shortfall Ref: ' + row.fesRef + '\n' : '';
  fneOpenOutlookMail(to,
    '[HIGH PRIORITY] Critical Project — ' + cust,
    'Dear ' + mgr + ',\n\nA project has been flagged as CRITICAL and requires your immediate attention:\n\n' +
    (row.id ? 'Record ID: ' + row.id + '\n' : '') +
    'Customer: ' + cust + '\nCritical Project: Yes\nStatus: ' + (row.requestStatus || '—') + '\n' +
    refLine + '\nPlease prioritize review and action.\n\nThank you.',
    true);
}

function fneReminderCellRenderer(params) {
  if (!params || !params.data) return document.createTextNode('—');
  const filter = fneGetRfsMigrationFilter();
  let kind = null;
  if (filter === 'approaching' || filter === 'overdue') {
    kind = filter;
  } else {
    kind = fneRfsAlertKind(params.data);
  }
  if (!kind) return document.createTextNode('—');
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'fne-btn fne-btn-secondary';
  btn.style.cssText = 'padding:.22rem .55rem;font-size:.68rem;white-space:nowrap;';
  btn.textContent = 'Send Reminder';
  btn.title = kind === 'approaching'
    ? 'Send approaching Expected RFS reminder to FNE Manager'
    : 'Send overdue Expected RFS reminder to FNE Manager';
  btn.onclick = function(e) {
    e.stopPropagation();
    fneOpenRfsReminder(params.data, kind);
  };
  return btn;
}

function fneEnsurePowerUserUi() {
  if (!fneIsPowerUser()) return;

  const dashMig = document.getElementById('fbRfsMigration');
  if (dashMig) dashMig.style.display = 'block';

  const grid = document.querySelector('#viewFneList .filter-bar-grid');
  if (grid && !document.getElementById('fnel_rfsMigration')) {
    const wrap = document.createElement('div');
    wrap.className = 'fb-group';
    wrap.innerHTML =
      '<div class="fb-group-label">Target Migration</div>' +
      '<select id="fnel_rfsMigration" class="fb-select" onchange="fneListApplyFilter()">' +
      '<option value="">All</option>' +
      '<option value="approaching">Approaching (≤4 days)</option>' +
      '<option value="overdue">Overdue (past Expected RFS)</option>' +
      '</select>';
    grid.appendChild(wrap);
  }
}

function fneNormStr(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function fneNormVerticalKey(vertical) {
  return String(vertical || '').toLowerCase().replace(/[\s\-_]/g, '');
}

function fneResolveDirectorForVertical(vertical) {
  const key = fneNormVerticalKey(vertical);
  return key ? (FNE_VERTICAL_DIRECTOR_MAP[key] || null) : null;
}

function fneMatchSelectOption(selectEl, targetName) {
  if (!selectEl || !targetName) return false;
  const t = fneNormStr(targetName);
  const tTokens = t.split(' ').filter(Boolean);

  for (let i = 0; i < selectEl.options.length; i++) {
    const opt = selectEl.options[i];
    if (!opt.value) continue;
    const v = fneNormStr(opt.value);
    if (v === t || v.includes(t) || t.includes(v)) {
      selectEl.value = opt.value;
      return true;
    }
  }

  // Match by last name or first name (handles Mazen Adem vs Mazen Adam, etc.)
  for (let i = 0; i < selectEl.options.length; i++) {
    const opt = selectEl.options[i];
    if (!opt.value) continue;
    const vTokens = fneNormStr(opt.value).split(' ').filter(Boolean);
    if (!vTokens.length || !tTokens.length) continue;
    const tLast = tTokens[tTokens.length - 1];
    const vLast = vTokens[vTokens.length - 1];
    if (tLast.length >= 3 && vLast.length >= 3 &&
        (tLast === vLast || tLast.indexOf(vLast) >= 0 || vLast.indexOf(tLast) >= 0)) {
      selectEl.value = opt.value;
      return true;
    }
    if (tTokens[0].length >= 4 && vTokens[0] === tTokens[0]) {
      selectEl.value = opt.value;
      return true;
    }
  }
  return false;
}

function fneSetDirectorForVertical(vertical, directorEl) {
  if (!directorEl || !vertical) return;
  const director = fneResolveDirectorForVertical(vertical);
  if (!director) return;
  if (fneMatchSelectOption(directorEl, director)) return;
  // Short-name fallback for Key A / Key B directors
  const vk = fneNormVerticalKey(vertical);
  if (vk === 'keya' || vk === 'fogh' || vk === 'tre') fneMatchSelectOption(directorEl, 'Hany');
  else if (vk === 'keyb' || vk === 'trm') fneMatchSelectOption(directorEl, 'Mazen');
}

function fneWireVerticalDirector() {
  const vEl = document.getElementById('fne_vertical');
  const dEl = document.getElementById('fne_acc_dir');
  if (!vEl || !dEl || vEl.dataset.vdWired) return;
  vEl.dataset.vdWired = '1';
  vEl.addEventListener('change', function() {
    fneSetDirectorForVertical(vEl.value, dEl);
  });
  if (vEl.value) fneSetDirectorForVertical(vEl.value, dEl);
}

function fneReapplyVerticalDirectors() {
  const vEl = document.getElementById('fne_vertical');
  const dEl = document.getElementById('fne_acc_dir');
  if (vEl && dEl && vEl.value) fneSetDirectorForVertical(vEl.value, dEl);
  ['fneBulkTableBody', 'fneBulkEditTableBody'].forEach(function(bodyId) {
    const body = document.getElementById(bodyId);
    if (!body) return;
    [...body.rows].forEach(function(tr) {
      const v = tr.querySelector('[data-key="vertical"]');
      const d = tr.querySelector('[data-key="accountDirector"]');
      if (v && d && v.value) fneSetDirectorForVertical(v.value, d);
    });
  });
}

function fneRefreshSelectOptions(selEl, choices) {
  if (!selEl || !choices || !choices.length) return;
  const cur = selEl.value;
  const isFilter = selEl.id.indexOf('fnel_') === 0;
  selEl.innerHTML = '<option value="">' + (isFilter ? 'All' : '— Select —') + '</option>' +
    choices.map(c => '<option value="' + c + '">' + c + '</option>').join('');
  if (cur && choices.indexOf(cur) >= 0) selEl.value = cur;
}

function fneRefreshBulkTableChoiceSelects() {
  ['fneBulkTableBody', 'fneBulkEditTableBody'].forEach(function(bodyId) {
    const body = document.getElementById(bodyId);
    if (!body) return;
    fneBulkTableCols().forEach(function(col) {
      if (col.type !== 'choice' || !col.choicesKey) return;
      const choices = FNE_CHOICES[col.choicesKey];
      if (!choices || !choices.length) return;
      body.querySelectorAll('[data-key="' + col.key + '"]').forEach(function(sel) {
        const cur = sel.value;
        sel.innerHTML = '<option value=""></option>' +
          choices.map(function(c) { return '<option value="' + c + '">' + c + '</option>'; }).join('');
        if (cur && choices.indexOf(cur) >= 0) sel.value = cur;
      });
    });
  });
}

function fneRefreshAllChoiceDropdowns() {
  Object.keys(FNE_FORM_SEL_MAP).forEach(function(key) {
    const id = FNE_FORM_SEL_MAP[key];
    const choices = FNE_CHOICES[key];
    if (choices && choices.length) fneRefreshSelectOptions(document.getElementById(id), choices);
  });
  fneListBuildAllFilters();
  fneRefreshBulkTableChoiceSelects();
  fneReapplyVerticalDirectors();
}

function fneListMsHtml(key, label) {
  return `
      <div class="fb-group">
        <div class="fb-group-label">${label}</div>
        <div class="ms-wrap" id="fne-ms-${key}">
          <div class="ms-trigger" id="fne-mst-${key}" onclick="fneToggleListMs('${key}')">
            <span id="fne-mstxt-${key}">All</span>
            <svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          <div class="ms-dropdown" id="fne-msd-${key}"></div>
        </div>
      </div>`;
}

function fneListBuildMsDropdown(key) {
  const cfg = FNE_LIST_MS_CFG[key];
  if (!cfg) return;
  const drop = document.getElementById(cfg.dropId);
  if (!drop) return;
  const vals = [...new Set(FNE_LIST_DATA.map(function(i) { return i[cfg.field]; })
    .filter(function(v) { return v !== null && v !== undefined && v !== '' && v !== '—'; }))];
  vals.sort(function(a, b) {
    if (cfg.numeric) return parseFloat(a) - parseFloat(b);
    return String(a).localeCompare(String(b));
  });
  drop.innerHTML = '';
  vals.forEach(function(v) {
    const opt = document.createElement('div');
    opt.className = 'ms-option';
    const cid = 'fne_cb_' + key + '_' + String(v).replace(/[^a-zA-Z0-9]/g, '_');
    opt.innerHTML = '<input type="checkbox" id="' + cid + '" value="' + String(v).replace(/"/g, '&quot;') +
      '" onchange="fneOnListMsChange(\'' + key + '\',this)"><label for="' + cid + '">' + v + '</label>';
    drop.appendChild(opt);
  });
}

function fneListBuildAllFilters() {
  Object.keys(FNE_LIST_MS_CFG).forEach(function(k) { fneListBuildMsDropdown(k); });
}

function fneUpdateListMsLabel(key) {
  const cfg = FNE_LIST_MS_CFG[key];
  const sel = FNE_LIST_MS_STATE[key];
  const trig = document.getElementById(cfg.mstId);
  const txt = document.getElementById(cfg.txtId);
  if (!txt || !trig) return;
  if (!sel.size) {
    txt.textContent = 'All';
    trig.classList.remove('has-sel');
  } else if (sel.size === 1) {
    txt.textContent = [...sel][0];
    trig.classList.add('has-sel');
  } else {
    txt.textContent = sel.size + ' selected';
    trig.classList.add('has-sel');
  }
}

function fneToggleListMs(key) {
  const cfg = FNE_LIST_MS_CFG[key];
  const drop = document.getElementById(cfg.dropId);
  const trig = document.getElementById(cfg.mstId);
  if (!drop || !trig) return;
  const isOpen = drop.classList.contains('open');
  document.querySelectorAll('.ms-dropdown.open').forEach(function(d) { d.classList.remove('open'); });
  document.querySelectorAll('.ms-trigger.open').forEach(function(t) { t.classList.remove('open'); });
  if (!isOpen) {
    const rect = trig.getBoundingClientRect();
    drop.style.top = (rect.bottom + 4) + 'px';
    drop.style.left = rect.left + 'px';
    drop.style.width = Math.max(rect.width, 180) + 'px';
    drop.classList.add('open');
    trig.classList.add('open');
  }
}

function fneOnListMsChange(key, cb) {
  if (cb.checked) FNE_LIST_MS_STATE[key].add(cb.value);
  else FNE_LIST_MS_STATE[key].delete(cb.value);
  fneUpdateListMsLabel(key);
  fneListApplyFilter();
}

function fneApplyCriticalProjectsAccess() {
  const el = document.getElementById('fne_critical_projects');
  if (!el) return;
  if (fneIsPowerUser()) {
    el.removeAttribute('readonly');
    el.removeAttribute('tabindex');
  } else {
    el.setAttribute('readonly', 'readonly');
    el.setAttribute('tabindex', '-1');
  }
}
  // ══════════════════════════════════════════════════════════════════
  //  NAV INJECTION
  // ══════════════════════════════════════════════════════════════════
  function fneInjectNav() {
    const navItems = document.querySelector('.nav-items');
    if (!navItems || document.getElementById('navFneForm')) return;
  
    const lbl = document.createElement('div');
    lbl.className = 'nav-section-label';
    lbl.textContent = 'FNE Tracker';
    navItems.appendChild(lbl);
  
if (fneIsAdmin()) {
  const navForm = document.createElement('div');
  navForm.className = 'nav-item';
  navForm.id = 'navFneForm';
  navForm.innerHTML = `
    <div class="nav-icon">
      <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
    </div>
    <div class="nav-label">New Entry</div>`;
  navForm.onclick = () => { fneOpenForm(null); showFneView('form', navForm); };
  navItems.appendChild(navForm);
}

  
    const navList = document.createElement('div');
    navList.className = 'nav-item';
    navList.id = 'navFneList';
    navList.innerHTML = `
      <div class="nav-icon">
        <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
      </div>
      <div class="nav-label">Tracker List</div>`;
    navList.onclick = () => { fneEnsurePowerUserUi(); fneLoadList(); showFneView('list', navList); };
    navItems.appendChild(navList);
  }
  
  // ══════════════════════════════════════════════════════════════════
  //  VIEW SWITCHING
  // ══════════════════════════════════════════════════════════════════
  function showFneView(view, navEl) {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    if (navEl) navEl.classList.add('active');
    ['viewDashboard','viewAnalytics','viewFneForm','viewFneList'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    if (view === 'form') document.getElementById('viewFneForm').style.display = 'block';
    if (view === 'list') document.getElementById('viewFneList').style.display = 'block';
  }
  
  // ══════════════════════════════════════════════════════════════════
  //  INJECT VIEW CONTAINERS
  // ══════════════════════════════════════════════════════════════════
  function fneInjectViews() {
    const content = document.querySelector('.content');
    if (!content || document.getElementById('viewFneForm')) return;
  
    const formView = document.createElement('div');
    formView.id = 'viewFneForm';
    formView.className = 'dashboard-section';
    formView.style.display = 'none';
    formView.innerHTML = fneFormHTML();
    content.appendChild(formView);
  
    const listView = document.createElement('div');
    listView.id = 'viewFneList';
    listView.className = 'dashboard-section';
    listView.style.display = 'none';
    listView.innerHTML = fneListHTML();
    content.appendChild(listView);
  
    // Wire TCV auto-calc
    ['fne_mrc','fne_otc','fne_contract_dur'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', fneTcvCalc);
    });
  
    // Wire attachment input
    const attachInput = document.getElementById('fneAttachInput');
    if (attachInput) attachInput.addEventListener('change', fneHandleAttachPick);
  
    // Load SP choices dynamically (fire-and-forget)
    fneLoadSpChoices();
    fneWireVerticalDirector();
    fneApplyCriticalProjectsAccess();
    fneEnsurePowerUserUi();
  }
  
  // ══════════════════════════════════════════════════════════════════
  //  LOAD SP CHOICES DYNAMICALLY
  // ══════════════════════════════════════════════════════════════════
  function fneLoadSpChoices() {
    const fieldMap = {
      [FNE_F.SUB_REQ]:      'subRequest',
      [FNE_F.IMPL_TYPE]:    'implType',
      [FNE_F.BUILD_STATUS]: 'buildingStatus',
      [FNE_F.SOF]:          'sof',
      [FNE_F.VERTICAL]:     'vertical',
      [FNE_F.REQ_STATUS]:   'requestStatus',
      [FNE_F.ASSIGNED_BY]:  'assignedBy',
      [FNE_F.PROJ_TYPE]:    'projectType',
      [FNE_F.OSP_REQ]:      'ospCivil',
      [FNE_F.ACC_DIR]:      'accountDirector',
      [FNE_F.FNE_MGR]:      'fneManager',
      [FNE_F.TEMP_CONN]:    'tempConnType',
      [FNE_F.BLOCKER]:      'blocker',
      [FNE_F.CRITICAL_PROJ]:'criticalProjects',
    };
    const internalNames = Object.keys(fieldMap);
    const url = FNE_SP + "/_api/web/lists/getbytitle('" + encodeURIComponent(FNE_LIST) +
      "')/fields?$select=InternalName,Choices&$filter=" +
      internalNames.map(n => "InternalName eq '" + n + "'").join(' or ');
  
    spGet(url, function(err, data) {
      if (err || !data || !data.d) return;
      data.d.results.forEach(function(f) {
        const key = fieldMap[f.InternalName];
        if (key && f.Choices && f.Choices.results && f.Choices.results.length) {
          FNE_CHOICES[key] = f.Choices.results;
        }
      });
      fneRefreshAllChoiceDropdowns();
      if (document.getElementById('fneBulkTableHead')) fneBulkRenderHead();
    });
  }
  
  // ══════════════════════════════════════════════════════════════════
  //  FORM HTML
  // ══════════════════════════════════════════════════════════════════
  function fneFormHTML() {
    const sel = (id, choices, req = '') => `
      <select id="${id}" class="fne-input" ${req}>
        <option value="">— Select —</option>
        ${choices.map(c => `<option value="${c}">${c}</option>`).join('')}
      </select>`;
  
    const inp = (id, type = 'text', req = '', placeholder = '') =>
      `<input id="${id}" type="${type}" class="fne-input" placeholder="${placeholder}" ${req}>`;
  
    const grp = (label, content, req = false, hint = '') => `
      <div class="fne-group${req ? ' fne-group-req' : ''}">
        <label class="fne-label">${label}${req ? '<span class="fne-req-dot"></span>' : ''}</label>
        ${content}
        ${hint ? `<div class="fne-hint">${hint}</div>` : ''}
      </div>`;
  
    const lockWrap = (id, inner) =>
      `<div class="fne-lock-wrap" id="lockwrap_${id}">${inner}<span class="fne-lock-icon" id="lockicon_${id}" style="display:none;" title="This field cannot be modified after initial entry">🔒</span></div>`;
  
    return `
  <style>
  /* ══ FNE FORM v2 STYLES ══ */
  .fne-view-wrap { max-width: 100%; }
  
  /* Header Banner */
  .fne-header-banner {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 1.4rem 1.8rem;
    margin-bottom: 1.2rem;
    box-shadow: var(--cs);
    position: relative;
    overflow: hidden;
  }
  .fne-header-banner::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 4px;
    background: var(--grad);
  }
  .fne-header-banner::after {
    content: '';
    position: absolute;
    top: -40px; right: -40px;
    width: 160px; height: 160px;
    border-radius: 50%;
    background: var(--glow);
    opacity: 0.18;
    pointer-events: none;
  }
  .fne-banner-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: .85rem;
  }
  .fne-banner-left { display: flex; align-items: center; gap: 1rem; }
  .fne-banner-icon {
    width: 52px; height: 52px;
    border-radius: 14px;
    background: var(--grad);
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 0 20px var(--glow);
    flex-shrink: 0;
  }
  .fne-banner-icon svg { width: 26px; height: 26px; stroke: #fff; fill: none; stroke-width: 2; }
  .fne-banner-title {
    font-size: 1.35rem;
    font-weight: 900;
    background: var(--grad);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    line-height: 1.1;
  }
  .fne-banner-sub { font-size: .78rem; color: var(--t3); margin-top: .2rem; font-weight: 600; }
  .fne-banner-badges { display: flex; align-items: center; gap: .55rem; flex-wrap: wrap; }
  .fne-banner-badge {
    display: inline-flex; align-items: center; gap: .3rem;
    padding: .3rem .75rem;
    border-radius: 20px;
    background: var(--nab);
    border: 1px solid var(--nab2);
    font-size: .73rem; font-weight: 700; color: var(--acc);
  }
  .fne-banner-badge svg { width: 13px; height: 13px; stroke: currentColor; fill: none; stroke-width: 2; }
  .fne-banner-datetime { font-size: .73rem; color: var(--t3); font-weight: 600; }
  
  /* Mode banner (edit) */
  .fne-edit-banner {
    display: none;
    background: rgba(37,99,235,.07);
    border: 1px solid var(--nab2);
    border-left: 4px solid var(--acc);
    border-radius: 10px;
    padding: .65rem 1rem;
    margin-bottom: .9rem;
    font-size: .82rem; font-weight: 600; color: var(--acc);
    align-items: center; gap: .55rem;
  }
  .fne-edit-banner svg { width: 16px; height: 16px; stroke: currentColor; fill: none; stroke-width: 2; flex-shrink: 0; }
  
  /* Section cards */
  .fne-form-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 1.4rem 1.6rem;
    box-shadow: var(--cs);
    margin-bottom: 1rem;
    position: relative;
    overflow: hidden;
  }
  .fne-form-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0;
    width: 4px; height: 100%;
    background: var(--grad);
    border-radius: 14px 0 0 14px;
  }
  .fne-form-card.accent-green::before  { background: linear-gradient(180deg, #10b981, #059669); }
  .fne-form-card.accent-amber::before  { background: linear-gradient(180deg, #f59e0b, #d97706); }
  .fne-form-card.accent-purple::before { background: linear-gradient(180deg, #8b5cf6, #7c3aed); }
  .fne-form-card.accent-cyan::before   { background: linear-gradient(180deg, #06b6d4, #0891b2); }
  .fne-form-card.accent-rose::before   { background: linear-gradient(180deg, #f43f5e, #e11d48); }
  
  .fne-section-hdr {
    display: flex; align-items: center; gap: .5rem;
    font-size: .8rem; font-weight: 800; text-transform: uppercase;
    letter-spacing: .08em; color: var(--acc);
    margin: 0 0 1rem !important;
    padding-bottom: .65rem;
    border-bottom: 1px solid var(--border);
  }
  .fne-section-hdr svg { width: 17px; height: 17px; stroke: currentColor; fill: none; stroke-width: 2; flex-shrink: 0; }
  .fne-section-count {
    margin-left: auto;
    background: var(--nab); border: 1px solid var(--nab2);
    border-radius: 20px; padding: 1px 8px;
    font-size: .65rem; font-weight: 700; color: var(--acc);
  }
  
  /* Grid layouts */
  .fne-grid { display: grid; gap: .9rem 1rem; }
  .fne-grid-2 { grid-template-columns: 1fr 1fr; }
  .fne-grid-3 { grid-template-columns: 1fr 1fr 1fr; }
  .fne-grid-4 { grid-template-columns: repeat(4, 1fr); }
  .fne-grid-span2 { grid-column: span 2; }
  @media(max-width: 960px) {
    .fne-grid-3, .fne-grid-4 { grid-template-columns: 1fr 1fr; }
    .fne-grid-span2 { grid-column: span 1; }
  }
  @media(max-width: 600px) {
    .fne-grid-2, .fne-grid-3, .fne-grid-4 { grid-template-columns: 1fr; }
    .fne-grid-span2 { grid-column: span 1; }
  }
  
  /* Groups & labels */
  .fne-group { display: flex; flex-direction: column; gap: .32rem; }
  .fne-label {
    font-size: .78rem; font-weight: 700;
    color: var(--t2);
    display: flex; align-items: center; gap: .3rem;
  }
  .fne-group-req .fne-label { color: var(--t1); }
  .fne-req-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: #dc2626; flex-shrink: 0; margin-left: 2px;
  }
  .fne-hint { font-size: .68rem; color: var(--t3); margin-top: .15rem; }
  
  /* Inputs */
  .fne-input {
    padding: .52rem .8rem;
    border-radius: 9px;
    border: 1.5px solid var(--border);
    background: var(--bg-input);
    color: var(--t1);
    font-size: .86rem;
    font-family: inherit;
    transition: border-color .18s, box-shadow .18s, background .18s;
    width: 100%;
  }
  .fne-input:focus {
    outline: none;
    border-color: var(--acc);
    box-shadow: 0 0 0 3px var(--glow);
    background: var(--bg-card);
  }
  .fne-input::placeholder { color: var(--t3); }
  .fne-input[readonly] {
    background: var(--bg-secondary);
    color: var(--t3);
    cursor: default;
    border-style: dashed;
  }
  .fne-input[readonly].fne-tcv-out {
    color: var(--acc);
    font-weight: 800;
    font-size: .95rem;
  }
  .fne-group-req .fne-input {
    border-color: rgba(37,99,235,.3);
  }
  .fne-group-req .fne-input:focus {
    border-color: var(--acc);
  }
  .fne-textarea { min-height: 90px; resize: vertical; }
  
  /* Lock wrap */
  .fne-lock-wrap { position: relative; display: flex; align-items: center; gap: .4rem; }
  .fne-lock-wrap .fne-input { flex: 1; }
  .fne-lock-icon {
    font-size: 1rem; flex-shrink: 0; cursor: help;
    filter: grayscale(.3);
  }
  .fne-locked .fne-input {
    background: var(--bg-secondary) !important;
    color: var(--t3) !important;
    cursor: not-allowed !important;
    border-style: dashed !important;
    pointer-events: none;
  }
  
  /* Actions bar */
  .fne-actions {
    display: flex; gap: .75rem;
    justify-content: flex-end;
    align-items: center;
    margin-top: .5rem;
    flex-wrap: wrap;
  }
  .fne-btn {
    padding: .6rem 1.4rem;
    border-radius: 9px;
    font-size: .86rem; font-weight: 700;
    cursor: pointer; border: none;
    transition: all .2s;
    display: inline-flex; align-items: center; gap: .4rem;
    white-space: nowrap;
  }
  .fne-btn svg { width: 15px; height: 15px; stroke: currentColor; fill: none; stroke-width: 2; }
  .fne-btn-primary {
    background: var(--grad); color: #fff;
    box-shadow: 0 2px 10px var(--glow);
  }
  .fne-btn-primary:hover { box-shadow: 0 4px 18px var(--glow); transform: translateY(-1px); }
  .fne-btn-primary:disabled { opacity: .5; cursor: not-allowed; transform: none; }
  .fne-btn-secondary {
    background: var(--bg-secondary); color: var(--t1);
    border: 1.5px solid var(--border);
  }
  .fne-btn-secondary:hover { border-color: var(--border-s); }
  .fne-btn-danger {
    background: rgba(220,38,38,.08); color: #dc2626;
    border: 1.5px solid rgba(220,38,38,.25);
  }
  .fne-btn-danger:hover { background: rgba(220,38,38,.16); }
  .fne-btn-cancel {
    background: var(--bg-secondary); color: var(--t2);
    border: 1.5px solid var(--border);
  }
  .fne-btn-cancel:hover { border-color: var(--border-s); color: var(--t1); }
  
  /* Toast */
  .fne-toast {
    position: fixed; bottom: 24px; left: 50%;
    transform: translateX(-50%) translateY(80px);
    background: var(--bg-card);
    border: 1px solid var(--border-s);
    border-radius: 12px;
    padding: .8rem 1.4rem;
    box-shadow: 0 8px 32px rgba(0,0,0,.28);
    font-size: .86rem; font-weight: 600; color: var(--t1);
    z-index: 99999;
    transition: transform .35s cubic-bezier(.34,1.56,.64,1), opacity .3s;
    opacity: 0;
    display: flex; align-items: center; gap: .5rem;
    max-width: 420px;
  }
  .fne-toast.show { transform: translateX(-50%) translateY(0); opacity: 1; }
  .fne-toast.success { border-color: rgba(22,163,74,.4); color: #16a34a; }
  .fne-toast.error   { border-color: rgba(220,38,38,.4); color: #dc2626; }
  
  /* Health indicator strip */
  .fne-health-strip {
    display: flex; align-items: center; gap: .75rem;
    padding: .65rem 1rem;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: var(--bg-secondary);
    margin-bottom: 1rem;
  }
  .fne-health-dot {
    width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0;
    transition: background .3s;
  }
  .fne-health-strip.health-green { background: rgba(16,185,129,.08); border-color: rgba(16,185,129,.3); }
  .fne-health-strip.health-amber { background: rgba(245,158,11,.08); border-color: rgba(245,158,11,.3); }
  .fne-health-strip.health-red   { background: rgba(220,38,38,.08);  border-color: rgba(220,38,38,.3);  }
  .fne-health-strip.health-green .fne-health-dot { background: #10b981; }
  .fne-health-strip.health-amber .fne-health-dot { background: #f59e0b; }
  .fne-health-strip.health-red   .fne-health-dot { background: #ef4444; }
  .fne-health-text { font-size: .82rem; font-weight: 700; color: var(--t1); }
  .fne-health-sub  { font-size: .72rem; color: var(--t3); margin-left: auto; }
  
  /* Attachment zone */
  .fne-attach-zone {
    border: 2px dashed var(--border);
    border-radius: 10px;
    padding: 1rem 1.2rem;
    cursor: pointer;
    transition: border-color .2s, background .2s;
    text-align: center;
    background: var(--bg-input);
  }
  .fne-attach-zone:hover { border-color: var(--acc); background: var(--nab); }
  .fne-attach-zone-inner { display: flex; align-items: center; justify-content: center; gap: .6rem; color: var(--t3); font-size: .82rem; font-weight: 600; }
  .fne-attach-zone-inner svg { width: 20px; height: 20px; stroke: var(--acc); fill: none; stroke-width: 2; }
  .fne-attach-zone.drag-over { border-color: var(--acc); background: var(--nab); }
  
  .fne-attach-list { margin-top: .75rem; display: flex; flex-direction: column; gap: .4rem; }
  .fne-attach-item {
    display: flex; align-items: center; gap: .55rem;
    padding: .45rem .75rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: .8rem;
  }
  .fne-attach-item svg { width: 15px; height: 15px; stroke: var(--acc); fill: none; stroke-width: 2; flex-shrink: 0; }
  .fne-attach-name { flex: 1; color: var(--t1); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .fne-attach-size { color: var(--t3); font-size: .72rem; white-space: nowrap; }
  .fne-attach-remove {
    width: 22px; height: 22px; border-radius: 50%;
    background: rgba(220,38,38,.1); border: none;
    color: #dc2626; cursor: pointer; display: flex; align-items: center; justify-content: center;
    font-size: .75rem; font-weight: 800; flex-shrink: 0;
    transition: background .2s;
  }
  .fne-attach-remove:hover { background: rgba(220,38,38,.2); }
  .fne-attach-existing-badge {
    font-size: .65rem; padding: 1px 6px; border-radius: 20px;
    background: rgba(16,185,129,.12); color: #16a34a;
    border: 1px solid rgba(16,185,129,.25); font-weight: 700;
    white-space: nowrap;
  }
  .fne-attach-download { color: var(--acc); text-decoration: none; font-size: .72rem; font-weight: 700; white-space: nowrap; }
  .fne-attach-download:hover { text-decoration: underline; }
  
  /* Record count badge in header */
  #fneRecordCount { font-size: .75rem; color: var(--t3); font-weight: 600; }

  /* AG Grid multi-select column filter */
  .fne-ag-set-filter { padding: .5rem; min-width: 200px; max-width: 260px; }
  .fne-ag-set-search {
    width: 100%; box-sizing: border-box; margin-bottom: .45rem;
    padding: .35rem .5rem; border: 1px solid var(--border); border-radius: 8px;
    font-size: .75rem; background: var(--bg-card); color: var(--t1);
  }
  .fne-ag-set-list { max-height: 180px; overflow-y: auto; display: flex; flex-direction: column; gap: .2rem; }
  .fne-ag-set-option { display: flex; align-items: center; gap: .35rem; font-size: .75rem; cursor: pointer; padding: .15rem 0; }
  .fne-ag-set-actions { display: flex; gap: .35rem; margin-top: .45rem; }
  .fne-ag-set-actions button {
    flex: 1; padding: .25rem .4rem; font-size: .68rem; font-weight: 700;
    border: 1px solid var(--border); border-radius: 6px; background: var(--nab); color: var(--acc); cursor: pointer;
  }

  /* Bulk update bar */
  .fne-bulk-bar {
    display: flex; align-items: center; flex-wrap: wrap; gap: .55rem;
    padding: .65rem .85rem; margin-bottom: .75rem;
    background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px;
  }
  .fne-bulk-label { font-size: .68rem; font-weight: 700; color: var(--t3); text-transform: uppercase; letter-spacing: .05em; }
  .fne-bulk-count { font-size: .72rem; color: var(--t3); font-weight: 600; margin-left: auto; }
  .fne-bulk-hint { font-size: .72rem; color: var(--t3); font-weight: 600; flex: 1 1 100%; }
  /* AG Grid row selection checkboxes */
  #fneGrid .ag-checkbox-input-wrapper {
    opacity: 1 !important;
    width: 16px; height: 16px;
  }
  #fneGrid .ag-header-select-all .ag-checkbox-input-wrapper {
    opacity: 1 !important;
  }
  #fneGrid .ag-cell[col-id="fne_select"],
  #fneGrid .ag-header-cell[col-id="fne_select"] {
    display: flex; align-items: center; justify-content: center;
  }

  /* Bulk entry table (New Entry) */
  .fne-entry-tabs {
    display: flex; gap: .5rem; margin-bottom: 1rem; flex-wrap: wrap;
  }
  .fne-entry-tab {
    padding: .45rem 1rem; border-radius: 999px; border: 1px solid var(--border);
    background: var(--bg-card); color: var(--t2); font-size: .78rem; font-weight: 700; cursor: pointer;
  }
  .fne-entry-tab.active {
    background: var(--grad); color: #fff; border-color: transparent;
  }
  .fne-bulk-table-hint { font-size: .78rem; color: var(--t3); margin: 0 0 .75rem; line-height: 1.5; }
  .fne-bulk-table-toolbar {
    display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; margin-bottom: .65rem;
  }
  .fne-bulk-table-wrap {
    overflow: auto; max-height: 520px; border: 1px solid var(--border); border-radius: 10px;
  }
  .fne-bulk-table {
    width: max-content; min-width: 100%; border-collapse: collapse; font-size: .75rem;
  }
  .fne-bulk-table th {
    position: sticky; top: 0; z-index: 2;
    background: var(--nab); color: var(--acc); font-weight: 700;
    padding: .45rem .4rem; border-bottom: 1px solid var(--border); white-space: nowrap; text-align: left;
  }
  .fne-bulk-table td { padding: .25rem .3rem; border-bottom: 1px solid var(--border); vertical-align: middle; }
  .fne-bulk-table tr:hover td { background: var(--bg-hover); }
  .fne-bulk-cell {
    min-width: 110px; width: 130px; padding: .3rem .4rem;
    border: 1px solid var(--border); border-radius: 6px; font-size: .72rem;
    background: var(--bg-card); color: var(--t1); box-sizing: border-box;
  }
  .fne-bulk-cell-date { min-width: 120px; width: 130px; }
  .fne-bulk-cell-num { min-width: 80px; width: 90px; }
  .fne-bulk-cell-comments { min-width: 180px; width: 200px; }
  .fne-bulk-cell-readonly {
    background: var(--nab) !important; color: var(--t3) !important;
    cursor: default !important; border-style: dashed !important;
  }
  .fne-bulk-cell-readonly.fne-bulk-tcv {
    color: var(--acc) !important; font-weight: 700;
  }
  .fne-bulk-auto-tag {
    display: block; font-size: .58rem; font-weight: 600; color: var(--t3);
    text-transform: uppercase; letter-spacing: .03em; margin-top: .1rem;
  }
  .fne-bulk-del {
    padding: .2rem .45rem; font-size: .68rem; border: 1px solid rgba(220,38,38,.35);
    background: rgba(220,38,38,.08); color: #dc2626; border-radius: 6px; cursor: pointer; font-weight: 700;
  }
  .fne-bulk-copy {
    padding: .2rem .4rem; font-size: .68rem; border: 1px solid var(--nab2);
    background: var(--nab); color: var(--acc); border-radius: 6px; cursor: pointer; font-weight: 700; margin-right: .2rem;
  }
  .fne-bulk-copy:disabled { opacity: .35; cursor: not-allowed; }
  .fne-bulk-row-actions { white-space: nowrap; text-align: center; }
  .fne-bulk-upload-status { font-size: .78rem; font-weight: 600; margin-top: .65rem; color: var(--t3); }

  /* Bulk edit modal (list view) */
  .fne-modal-overlay {
    position: fixed; inset: 0; z-index: 10050;
    background: rgba(15, 23, 42, .55);
    display: none; align-items: center; justify-content: center;
    padding: 1rem;
  }
  .fne-modal-overlay.open { display: flex; }
  .fne-modal-panel {
    background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px;
    width: min(96vw, 1400px); max-height: 92vh; display: flex; flex-direction: column;
    box-shadow: 0 24px 48px rgba(0,0,0,.25);
  }
  .fne-modal-header {
    display: flex; align-items: center; justify-content: space-between; gap: .75rem;
    padding: .85rem 1rem; border-bottom: 1px solid var(--border);
  }
  .fne-modal-header h3 { margin: 0; font-size: 1rem; color: var(--t1); }
  .fne-modal-close {
    border: none; background: transparent; font-size: 1.35rem; line-height: 1;
    cursor: pointer; color: var(--t3); padding: .15rem .35rem;
  }
  .fne-modal-body { padding: .85rem 1rem 1rem; overflow: auto; }
  .fne-modal-footer {
    display: flex; align-items: center; justify-content: flex-end; gap: .55rem;
    padding: .75rem 1rem; border-top: 1px solid var(--border);
  }
  .fne-bulk-id { background: var(--nab) !important; color: var(--acc); font-weight: 700; cursor: default; }
  .ag-theme-alpine .ag-cell-wrapper.ag-row-group { align-items: center; }
  .ms-wrap { position: relative; z-index: auto; }
  .ms-trigger {
    padding: .38rem .7rem; border-radius: 8px; border: 1px solid var(--border);
    background: var(--bg-input); color: var(--t1); font-size: .8rem; cursor: pointer;
    display: flex; align-items: center; justify-content: space-between; gap: .5rem;
    transition: border-color .18s, box-shadow .18s; user-select: none; width: 100%;
  }
  .ms-trigger:hover, .ms-trigger.open { border-color: var(--border-s); box-shadow: 0 0 0 3px var(--glow); }
  .ms-trigger.has-sel { border-color: var(--acc); background: var(--nab); color: var(--acc); font-weight: 600; }
  .ms-trigger svg { width: 13px; height: 13px; stroke: var(--t3); fill: none; stroke-width: 2; transition: transform .2s; flex-shrink: 0; }
  .ms-trigger.open svg { transform: rotate(180deg); }
  .ms-dropdown {
    position: fixed; background: var(--bg-card); border: 1px solid var(--border-s); border-radius: 8px;
    max-height: 230px; overflow-y: auto; z-index: 99999; box-shadow: 0 8px 32px rgba(0,0,0,.28);
    display: none; min-width: 180px;
  }
  .ms-dropdown.open { display: block; }
  .ms-option { display: flex; align-items: center; gap: .45rem; padding: .42rem .65rem; cursor: pointer; font-size: .8rem; }
  .ms-option:hover { background: var(--nab); }
  .ms-option input { accent-color: var(--acc); }
  </style>
  
  <div id="fneToast" class="fne-toast"></div>
  
  <div class="fne-view-wrap">
  
    <!-- ══ HEADER BANNER ══ -->
    <div class="fne-header-banner">
      <div class="fne-banner-inner">
        <div class="fne-banner-left">
          <div class="fne-banner-icon">
            <svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </div>
          <div>
            <div class="fne-banner-title">GKLA FNE Tracker</div>
            <div class="fne-banner-sub">Fixed Network Expansion — Project Entry Form</div>
          </div>
        </div>
        <div class="fne-banner-badges">
          <div class="fne-banner-badge">
            <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span id="fneBannerDate">—</span>
          </div>
          <div class="fne-banner-badge">
            <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <span id="fneBannerCount">— records</span>
          </div>
          <div class="fne-banner-badge" id="fneBannerMode">
            <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span>New Entry</span>
          </div>
        </div>
      </div>
      <div style="margin-top:.6rem; display:flex; align-items:center; gap:1rem;">
        <div style="font-size:.72rem; color:var(--t3);" id="fneFormId"></div>
      </div>
    </div>
  
    <!-- Edit mode banner -->
    <div id="fneEditBanner" class="fne-edit-banner">
      <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      <span id="fneEditBannerTxt">Editing record —</span>
      <button class="fne-btn fne-btn-secondary" style="padding:.25rem .65rem;font-size:.72rem;margin-left:auto;" onclick="fneOpenForm(null)">
        + New Instead
      </button>
    </div>
  
    <!-- Health indicator strip -->
    <div class="fne-health-strip" id="fneHealthStrip">
      <div class="fne-health-dot"></div>
      <div class="fne-health-text" id="fneHealthTxt">Project Health: —</div>
      <div class="fne-health-sub" id="fneHealthSub">Set Expected RFS and Building Status to calculate</div>
    </div>

    <div id="fneEntryModeTabs" class="fne-entry-tabs" style="display:none;">
      <button type="button" id="fneTabSingle" class="fne-entry-tab active" onclick="fneSetEntryMode('single')">Single Entry</button>
      <button type="button" id="fneTabBulk" class="fne-entry-tab" onclick="fneSetEntryMode('bulk')">Bulk Entry</button>
    </div>

    <div id="fneSingleEntryWrap">
  
    <!-- ══ CUSTOMER DETAILS ══ -->
    <div class="fne-form-card">
      <div class="fne-section-hdr">
        <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        Customer Details
        <span class="fne-section-count">5 fields</span>
      </div>
      <div class="fne-grid fne-grid-2">
        ${grp('FES / Shortfall Ref', inp('fne_fes_ref','text','','REF-XXXX'))}
        ${grp('Site Survey Reference', inp('fne_site_ref','text','','REF-XXXX'))}
      </div>
      <div class="fne-grid fne-grid-3" style="margin-top:.9rem;">
        ${grp('Account Code', inp('fne_acc_code','number','','e.g. 100123'))}
        ${grp('Customer Name', inp('fne_cust_name','text','required','Full customer name'), true)}
        ${grp('Customer Address', inp('fne_cust_addr','text','','Street, Area, City'))}
      </div>
      <div class="fne-grid fne-grid-2" style="margin-top:.9rem;" id="fne_pm_row" style="display:none;">
        ${grp('Project Duration', `<input id="fne_pm_man_days" type="text" class="fne-input" readonly placeholder="Auto-calculated by SharePoint">`, false, 'Read-only — auto-calculated by SharePoint')}
      </div>
    </div>
  
    <!-- ══ REQUEST TYPE / STATUS ══ -->
    <div class="fne-form-card accent-amber">
      <div class="fne-section-hdr" style="color:#d97706;">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        Request Type &amp; Status
        <span class="fne-section-count" style="color:#d97706;background:rgba(245,158,11,.1);border-color:rgba(245,158,11,.3);">11 fields</span>
      </div>
      <div class="fne-grid fne-grid-3">
        ${grp('Request Status', sel('fne_req_status', FNE_CHOICES.requestStatus, 'required'), true)}
        ${grp('Request Type', sel('fne_sub_req', FNE_CHOICES.subRequest))}
        ${grp('Implementation Type', sel('fne_impl_type', FNE_CHOICES.implType, 'required'), true)}
      </div>
      <div class="fne-grid fne-grid-3" style="margin-top:.9rem;">
        ${grp('Building Status', sel('fne_build_status', FNE_CHOICES.buildingStatus, 'required'), true)}
        ${grp('Connectivity Type', sel('fne_proj_type', FNE_CHOICES.projectType))}
        ${grp('Assigned By', sel('fne_assigned_by', FNE_CHOICES.assignedBy))}
      </div>
      <div class="fne-grid fne-grid-4" style="margin-top:.9rem;">
        ${grp('SOF', sel('fne_sof', FNE_CHOICES.sof))}
        ${grp('Critical Project', fneIsPowerUser()
          ? sel('fne_critical_projects', FNE_CHOICES.criticalProjects)
          : '<input id="fne_critical_projects" type="text" class="fne-input" readonly tabindex="-1" placeholder="—">')}
        ${grp('SLA (days)', inp('fne_sla','number','','e.g. 30'))}
        ${grp('Unit No', inp('fne_unit_no','number'))}
        ${grp('WO Number', inp('fne_wo_num','text','','WO-XXXX'))}
      </div>
      <div class="fne-grid fne-grid-3" style="margin-top:.9rem;">
        ${grp('Bid Number', inp('fne_bid_ref','text','','BID-XXXX'))}
        ${grp('GAID', inp('fne_gaid','text','','Plain text only'))}
        ${grp('Est. Cost', inp('fne_est_cost','number','','0.00'))}
      </div>
      <div class="fne-grid fne-grid-3" style="margin-top:.9rem;">
        ${grp('OSP &amp; Civil Required', sel('fne_osp', FNE_CHOICES.ospCivil))}
        ${grp('OSP Civil Est. Timeline (days)', inp('fne_osp_et','number','','Days'))}
        ${grp('Current Blocker', sel('fne_blocker', FNE_CHOICES.blocker))}
      </div>
    </div>
  
    <!-- ══ SEGMENTATION ══ -->
    <div class="fne-form-card accent-purple">
      <div class="fne-section-hdr" style="color:#8b5cf6;">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
        Segmentation &amp; Ownership
        <span class="fne-section-count" style="color:#8b5cf6;background:rgba(139,92,246,.1);border-color:rgba(139,92,246,.3);">4 fields</span>
      </div>
      <div class="fne-grid fne-grid-2">
        ${grp('Vertical', sel('fne_vertical', FNE_CHOICES.vertical, 'required'), true)}
        ${grp('Account Director', sel('fne_acc_dir', FNE_CHOICES.accountDirector))}
      </div>
      <div class="fne-grid fne-grid-2" style="margin-top:.9rem;">
        ${grp('Account Manager (Email)', inp('fne_am_email','email','','manager@example.com'))}
        ${grp('FNE Manager', sel('fne_fne_mgr', FNE_CHOICES.fneManager, 'required'), true)}
      </div>
    </div>
  
    <!-- ══ DATES & REVENUE ══ -->
    <div class="fne-form-card accent-green">
      <div class="fne-section-hdr" style="color:#10b981;">
        <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        Dates &amp; Revenue
        <span class="fne-section-count" style="color:#10b981;background:rgba(16,185,129,.1);border-color:rgba(16,185,129,.3);">8 fields</span>
      </div>
      <div class="fne-grid fne-grid-2">
        ${grp('Received Date', inp('fne_start_date','date'))}
        ${grp('Expected RFS Date',
          lockWrap('exp_rfs', `<input id="fne_exp_rfs" type="date" class="fne-input">`),
          false, 'Locked after first save'
        )}
      </div>
      <div class="fne-grid fne-grid-2" style="margin-top:.9rem;">
        ${grp('Actual RFS Date',
          inp('fne_rfs_baseline','date'),
          false,
          'Today or past dates only'
        )}
        ${grp('Implementation Start Date',
          lockWrap('impl_start', `<input id="fne_impl_start" type="date" class="fne-input">`),
          false, 'Locked after first save. Required if FES Ref is set.'
        )}
      </div>
      <div class="fne-grid fne-grid-2" style="margin-top:.9rem;">
        ${grp('Current Temp Connectivity Type', sel('fne_temp_conn', FNE_CHOICES.tempConnType))}
        ${grp('Target Migration Date', inp('fne_target_mig','date'))}
      </div>
      <div class="fne-grid fne-grid-4" style="margin-top:.9rem;">
        ${grp('Contract Duration (months)', inp('fne_contract_dur','number','','0'))}
        ${grp('OTC', inp('fne_otc','number','','0.00'))}
        ${grp('MRC', inp('fne_mrc','number','','0.00'))}
        ${grp('TCV (Auto-Calculated)', `<input id="fne_tcv" type="number" class="fne-input fne-tcv-out" readonly placeholder="Auto">`)}
      </div>
    </div>
  
    <!-- ══ COMMENTS ══ -->
    <div class="fne-form-card accent-cyan">
      <div class="fne-section-hdr" style="color:#06b6d4;">
        <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        Comments
      </div>
      <textarea id="fne_comments_new" class="fne-input fne-textarea" placeholder="Enter notes, comments or updates about this project..."></textarea>
    </div>
  
    <!-- ══ ATTACHMENTS ══ -->
    <div class="fne-form-card accent-rose">
      <div class="fne-section-hdr" style="color:#f43f5e;">
        <svg viewBox="0 0 24 24"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
        Attachments
        <span class="fne-section-count" id="fneAttachCount" style="color:#f43f5e;background:rgba(244,63,94,.1);border-color:rgba(244,63,94,.3);">0 files</span>
      </div>
      <div class="fne-attach-zone" id="fneAttachZone" onclick="document.getElementById('fneAttachInput').click()"
           ondragover="event.preventDefault();this.classList.add('drag-over')"
           ondragleave="this.classList.remove('drag-over')"
           ondrop="fneHandleAttachDrop(event)">
        <div class="fne-attach-zone-inner">
          <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          <span>Click to attach files or drag &amp; drop here</span>
        </div>
        <input type="file" id="fneAttachInput" multiple style="display:none;" accept="*/*">
      </div>
      <div class="fne-attach-list" id="fneAttachList"></div>
    </div>

    </div><!-- end fneSingleEntryWrap -->

    <div id="fneBulkEntryWrap" style="display:none;">
      <div class="fne-form-card accent-green">
        <div class="fne-section-hdr" style="color:#10b981;">
          <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
          Bulk New Entries
        </div>
        <p class="fne-bulk-table-hint">Fill row 1, then use <strong>Copy ↑</strong> on the next row to duplicate it and tweak only what changed — or click <strong>Add Row (copy last)</strong>. You can also paste from Excel (Ctrl+V). Columns marked <strong>Auto-calculated</strong> (TCV, Project Duration, Project Health, SPI) are read-only and filled by SharePoint or formula. Attachments are added per record after upload.</p>
        <div class="fne-bulk-table-toolbar">
          <button type="button" class="fne-btn fne-btn-secondary" style="padding:.35rem .75rem;font-size:.75rem;" onclick="fneBulkAddRow()">+ Add Row</button>
          <button type="button" class="fne-btn fne-btn-secondary" style="padding:.35rem .75rem;font-size:.75rem;" onclick="fneBulkAddRowCopyLast()">+ Add Row (copy last)</button>
          <button type="button" class="fne-btn fne-btn-secondary" style="padding:.35rem .75rem;font-size:.75rem;" onclick="fneBulkClearTable()">Clear Table</button>
          <span id="fneBulkRowCount" style="font-size:.75rem;color:var(--t3);font-weight:600;"></span>
        </div>
        <div class="fne-bulk-table-wrap" id="fneBulkTableWrap">
          <table class="fne-bulk-table" id="fneBulkTable">
            <thead id="fneBulkTableHead"></thead>
            <tbody id="fneBulkTableBody"></tbody>
          </table>
        </div>
        <div id="fneBulkUploadStatus" class="fne-bulk-upload-status"></div>
      </div>
    </div>
  
    <!-- ══ ACTIONS ══ -->
    <div class="fne-actions">
      <button type="button" class="fne-btn fne-btn-cancel" id="fneCancelBtn" onclick="fneCancelForm()">
        <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        Cancel
      </button>
      <button type="button" class="fne-btn fne-btn-secondary" onclick="fneResetForm()">
        <svg viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/></svg>
        Clear
      </button>
      <button type="button" id="fneDeleteBtn" class="fne-btn fne-btn-danger" style="display:none;" onclick="fneDeleteItem()">
        <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        Delete
      </button>
      <button type="button" class="fne-btn fne-btn-primary" id="fneSaveBtn" onclick="fneSave()">
        <svg viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
        <span id="fneSaveBtnTxt">Save Entry</span>
      </button>
      <button type="button" class="fne-btn fne-btn-primary" id="fneBulkUploadBtn" style="display:none;" onclick="fneBulkUploadAll()">
        <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        Upload All Entries
      </button>
    </div>
  
  </div><!-- end fne-view-wrap -->
  `;
  }
  
  // ══════════════════════════════════════════════════════════════════
  //  LIST VIEW HTML
  // ══════════════════════════════════════════════════════════════════
  function fneListHTML() {
    return `
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;flex-wrap:wrap;gap:.65rem;">
    <h2 class="section-title" style="margin:0!important;">
      <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
      FNE Tracker — All Records
    </h2>
    ${fneIsAdmin() ? `
    <button type="button" class="fne-btn fne-btn-primary" onclick="fneOpenForm(null);showFneView('form',document.getElementById('navFneForm'))">
      <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      New Entry
    </button>` : ''}
  </div>
  
  <!-- Filters -->
  <div class="filter-bar" style="margin-bottom:.85rem;">
    <div class="filter-bar-header">
      <span class="filter-bar-label">
        <svg viewBox="0 0 24 24" style="width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:2;display:inline;vertical-align:middle;margin-right:.3rem"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
        Filters
      </span>
      <button type="button" class="reset-btn" onclick="fneListReset()">
        <svg viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/></svg>
        Reset
      </button>
    </div>
    <div class="filter-bar-grid">
      ${fneListMsHtml('status', 'Request Status')}
      ${fneListMsHtml('implType', 'Impl. Type')}
      ${fneListMsHtml('vertical', 'Vertical')}
      ${fneListMsHtml('fneManager', 'FNE Manager')}
      ${fneListMsHtml('buildStatus', 'Building')}
      ${fneListMsHtml('projType', 'Connectivity Type')}
      ${fneListMsHtml('subReq', 'Request Type')}
      ${fneListMsHtml('assignedBy', 'Assigned By')}
      ${fneListMsHtml('accDir', 'Account Director')}
      ${fneListMsHtml('osp', 'OSP Civil')}
      ${fneListMsHtml('sof', 'SOF')}
      ${fneListMsHtml('health', 'Project Health')}
      ${fneListMsHtml('blocker', 'Blocker')}
      ${fneListMsHtml('critical', 'Critical Project')}
      ${fneListMsHtml('year', 'Year')}
      ${fneIsPowerUser() ? `
      <div class="fb-group">
        <div class="fb-group-label">Target Migration</div>
        <select id="fnel_rfsMigration" class="fb-select" onchange="fneListApplyFilter()">
          <option value="">All</option>
          <option value="approaching">Approaching (≤4 days)</option>
          <option value="overdue">Overdue (past Expected RFS)</option>
        </select>
      </div>` : ''}
    </div>
  </div>

  ${fneIsAdmin() || fneIsPowerUser() ? `
  <div class="fne-bulk-bar" id="fneBulkBar">
    ${fneIsAdmin() ? `
    <span class="fne-bulk-label">Bulk edit</span>
    <button type="button" class="fne-btn fne-btn-primary" style="padding:.35rem .85rem;font-size:.75rem;" onclick="fneBulkEditOpen()">
      Bulk Edit
    </button>` : ''}
    ${fneIsPowerUser() ? `
    <button type="button" class="fne-btn fne-btn-danger" style="padding:.35rem .85rem;font-size:.75rem;" onclick="fneBulkDeleteSelected()">
      Bulk Delete
    </button>` : ''}
    <span class="fne-bulk-hint">Tick the checkboxes on the far left of the grid${fneIsAdmin() ? ', then Bulk Edit to update selected records in a spreadsheet table' : ''}${fneIsPowerUser() ? (fneIsAdmin() ? ', or Bulk Delete to remove them' : ' — then Bulk Delete to remove selected records') : ''}.</span>
    <span id="fneBulkSelCount" class="fne-bulk-count">0 selected</span>
  </div>` : ''}
  
  <!-- Table -->
  <div class="table-section">
    <div class="table-header">
      <h3 class="table-title">
        <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <span id="fneListCount">Loading...</span>
      </h3>
      <div class="table-actions">
        <button type="button" class="export-btn" onclick="fneExportExcel()">
          <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export Excel
        </button>
        <input type="text" class="search-box" id="fneListSearch" placeholder="Search all columns..."
               oninput="if(FNE_GRID_API) FNE_GRID_API.setGridOption('quickFilterText',this.value)">
      </div>
    </div>
    <div id="fneListSpinner" style="display:none;padding:2rem;text-align:center;">
      <div style="display:inline-flex;flex-direction:column;align-items:center;gap:.75rem;">
        <svg style="width:36px;height:36px;stroke:var(--acc);fill:none;stroke-width:2;animation:spin 1s linear infinite" viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
        <span style="font-size:.82rem;color:var(--t3);font-weight:600;">Loading tracker records...</span>
      </div>
    </div>
    <div id="fneGrid" class="ag-theme-alpine" style="height:640px;width:100%;"></div>
  </div>

  <div id="fneBulkEditModal" class="fne-modal-overlay" onclick="if(event.target===this)fneBulkEditClose()">
    <div class="fne-modal-panel" onclick="event.stopPropagation()">
      <div class="fne-modal-header">
        <h3 id="fneBulkEditTitle">Bulk Edit Selected Records</h3>
        <button type="button" class="fne-modal-close" onclick="fneBulkEditClose()" title="Close">&times;</button>
      </div>
      <div class="fne-modal-body">
        <p class="fne-bulk-table-hint">Edit any cells below, use <strong>↑</strong> to copy from the row above, then click <strong>Update All</strong>. Columns marked <strong>Auto-calculated</strong> are read-only. Paste from Excel (Ctrl+V) is supported.</p>
        <div class="fne-bulk-table-wrap" id="fneBulkEditTableWrap" style="max-height:58vh;">
          <table class="fne-bulk-table" id="fneBulkEditTable">
            <thead id="fneBulkEditTableHead"></thead>
            <tbody id="fneBulkEditTableBody"></tbody>
          </table>
        </div>
        <div id="fneBulkEditStatus" class="fne-bulk-upload-status"></div>
      </div>
      <div class="fne-modal-footer">
        <button type="button" class="fne-btn fne-btn-cancel" onclick="fneBulkEditClose()">Cancel</button>
        <button type="button" class="fne-btn fne-btn-primary" onclick="fneBulkEditSaveAll()">Update All</button>
      </div>
    </div>
  </div>
  `;
  }
  
  // ══════════════════════════════════════════════════════════════════
  //  BANNER CLOCK
  // ══════════════════════════════════════════════════════════════════
  function fneStartBannerClock() {
    function update() {
      const el = document.getElementById('fneBannerDate');
      if (!el) return;
      const now = new Date();
      el.textContent = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
        ' ' + now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    }
    update();
    setInterval(update, 30000);
  }
  
  // ══════════════════════════════════════════════════════════════════
  //  TCV AUTO CALC
  // ══════════════════════════════════════════════════════════════════
  function fneTcvCalc() {
    const mrc = parseFloat(document.getElementById('fne_mrc')?.value) || 0;
    const otc = parseFloat(document.getElementById('fne_otc')?.value) || 0;
    const dur = parseFloat(document.getElementById('fne_contract_dur')?.value) || 0;
    const tcv = dur * mrc + otc;
    const tcvEl = document.getElementById('fne_tcv');
    if (tcvEl) tcvEl.value = tcv ? tcv.toFixed(2) : '';
  }
  
  // ══════════════════════════════════════════════════════════════════
  //  PROJECT HEALTH CALC (client-side estimate)
  // ══════════════════════════════════════════════════════════════════
function fneCalcHealth() {
  const expRfs = document.getElementById('fne_exp_rfs')?.value;
  const strip  = document.getElementById('fneHealthStrip');
  const txt    = document.getElementById('fneHealthTxt');
  const sub    = document.getElementById('fneHealthSub');

  if (!strip || !txt || !sub) return;

  strip.className = 'fne-health-strip';

  if (!expRfs) {
    txt.textContent = 'Project Health: No Expected RFS to calculate Project Health';
    sub.textContent = 'Expected RFS date is missing';
    return;
  }

  const today = new Date(); today.setHours(0,0,0,0);
  const exp   = new Date(expRfs); exp.setHours(0,0,0,0);

  if (exp > today) {
    strip.classList.add('health-green');
    txt.textContent = 'Project Health: Green';
    sub.textContent = 'Expected RFS is in the future';
  } 
  else if (+exp === +today) {
    strip.classList.add('health-amber');
    txt.textContent = 'Project Health: Amber';
    sub.textContent = 'Expected RFS is today';
  } 
  else {
    strip.classList.add('health-red');
    txt.textContent = 'Project Health: Red';
    sub.textContent = 'Expected RFS is overdue';
  }
}
  
  // ══════════════════════════════════════════════════════════════════
  //  OPEN FORM (new or edit)
  // ══════════════════════════════════════════════════════════════════

    
function fneOpenForm(itemId, fromList) {
  if (itemId && !fneIsAdmin()) {
    fneToast('You do not have permission to edit this record', 'error');
    return;
  }

    FNE_EDIT_ID = itemId;
    FNE_CAME_FROM_LIST = !!fromList;
    FNE_PENDING_ATTACH = [];
    FNE_EXISTING_ATTACH = [];
    fneResetForm();
    fneRenderAttachList();
  
    const bannerBadge = document.getElementById('fneBannerMode');
    const idLabel     = document.getElementById('fneFormId');
    const banner      = document.getElementById('fneEditBanner');
    const bannerTxt   = document.getElementById('fneEditBannerTxt');
    const saveBtn     = document.getElementById('fneSaveBtnTxt');
    const delBtn      = document.getElementById('fneDeleteBtn');
  
    // Update banner count
    const countEl = document.getElementById('fneBannerCount');
    if (countEl) countEl.textContent = FNE_LIST_DATA.length + ' records';
  
    if (!itemId) {
      if (bannerBadge) bannerBadge.innerHTML = `<svg viewBox="0 0 24 24" style="width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg><span>New Entry</span>`;
      if (idLabel)   idLabel.textContent = '';
      if (banner)    banner.style.display = 'none';
      if (saveBtn)   saveBtn.textContent  = 'Save Entry';
      if (delBtn)    delBtn.style.display = 'none';
      // Unlock all one-time fields
      fneSetLockState('exp_rfs', false);
      fneSetLockState('impl_start', false);
      fneSetActualRfsMaxDate();
      fneCalcHealth();
      const tabs = document.getElementById('fneEntryModeTabs');
      if (tabs) tabs.style.display = fneIsAdmin() ? 'flex' : 'none';
      fneSetEntryMode('single');
      FNE_EDIT_CRITICAL_PREV = '';
      fneApplyCriticalProjectsAccess();
      return;
    }
  
    const item = FNE_LIST_DATA.find(i => i.id === itemId);
    if (!item) { fneToast('Item not found in cache — reload list', 'error'); return; }
  
    if (bannerBadge) bannerBadge.innerHTML = `<svg viewBox="0 0 24 24" style="width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg><span>Edit Mode</span>`;
    if (idLabel)   idLabel.textContent  = 'Record ID: ' + itemId;
    if (saveBtn)   saveBtn.textContent  = 'Update Entry';
    if (delBtn)    delBtn.style.display = 'inline-flex';
    if (banner) {
      banner.style.display = 'flex';
      bannerTxt.textContent = 'Editing ID ' + itemId + ' — ' + (item.customerName || '');
    }
  
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
    const clean = v => (v === '—' ? '' : v) || '';
  
    
    set('fne_fes_ref',      clean(item.fesRef));
    set('fne_site_ref',     clean(item.siteRef));
    set('fne_acc_code',     item.accountCode || '');
    set('fne_cust_name',    clean(item.customerName));
    set('fne_cust_addr',    clean(item.customerAddress));
    // Show Project Duration (read-only, SP calculated)
    const pmRow = document.getElementById('fne_pm_row');
    if (pmRow) pmRow.style.display = 'block';
    set('fne_pm_man_days',  clean(item.pmManDays));
    set('fne_osp',          clean(item.ospRequired));
    set('fne_osp_et',       item.ospCivilET || '');
    set('fne_est_cost',     item.estimatedCost || '');
    set('fne_req_status',   clean(item.requestStatus));
    set('fne_wo_num',       clean(item.woNumber));
    set('fne_sub_req',      clean(item.subRequest));
    set('fne_bid_ref',      clean(item.bidRef));
    set('fne_impl_type',    clean(item.implType));
    set('fne_gaid',         clean(item.gaid));
    set('fne_build_status', clean(item.buildingStatus));
    set('fne_sla',          item.sla || '');
    set('fne_unit_no',      item.unitNo || '');
    set('fne_assigned_by',  clean(item.assignedBy));
    set('fne_proj_type',    clean(item.projectType));
    set('fne_sof',          clean(item.sof));
    if (fneIsPowerUser()) set('fne_critical_projects', clean(item.criticalProjects));
    else set('fne_critical_projects', clean(item.criticalProjects) || '—');
    FNE_EDIT_CRITICAL_PREV = fneIsCriticalYes(clean(item.criticalProjects)) ? 'Yes' : (clean(item.criticalProjects) || '');
    set('fne_vertical',     clean(item.vertical));
    set('fne_acc_dir',      clean(item.accountDirector));
    set('fne_am_email',     item.amEmail || '');
    set('fne_fne_mgr',      clean(item.fneManager));
    set('fne_comments_new', fneHtmlToPlain(item.commentsNew));
    set('fne_blocker',      clean(item.blocker));
    set('fne_temp_conn',    clean(item.tempConnType));
  
    const toDateVal = iso => iso ? new Date(iso).toISOString().split('T')[0] : '';
    set('fne_start_date',   toDateVal(item.startDate));
    set('fne_exp_rfs',      toDateVal(item.expectedRFS));
    set('fne_rfs_baseline', toDateVal(item.rfsBaseline));
    set('fne_impl_start',   toDateVal(item.implStart));
    set('fne_target_mig',   toDateVal(item.targetMigDate));
    set('fne_contract_dur', item.contractDuration || '');
    set('fne_otc',          item.otc || '');
    set('fne_mrc',          item.mrc || '');
    fneTcvCalc();
  
    // One-time field locking
    const locks = FNE_LOCK_STATE[itemId] || {};
    fneSetLockState('exp_rfs',    !!(item.expectedRFS && item.expectedRFS !== null));
    fneSetLockState('impl_start', !!(item.implStart   && item.implStart   !== null));
  
    // Fetch existing attachments
    fneLoadExistingAttachments(itemId);
  
    fneSetActualRfsMaxDate();
    fneCalcHealth();
    const tabs = document.getElementById('fneEntryModeTabs');
    if (tabs) tabs.style.display = 'none';
    fneSetEntryMode('single');
    fneApplyCriticalProjectsAccess();
  }
  // ══════════════════════════════════════════════════════════════════
  function fneSetLockState(fieldKey, locked) {
    const wrap  = document.getElementById('lockwrap_' + fieldKey);
    const icon  = document.getElementById('lockicon_' + fieldKey);
    const input = document.getElementById('fne_' + fieldKey.replace('_', '_')); // same key
  
    // Map keys to actual input IDs
    const inputIdMap = { 'exp_rfs': 'fne_exp_rfs', 'impl_start': 'fne_impl_start' };
    const inp = document.getElementById(inputIdMap[fieldKey]);
  
    if (!wrap || !inp) return;
    if (locked) {
      wrap.classList.add('fne-locked');
      inp.readOnly = true;
      if (icon) icon.style.display = 'inline-flex';
    } else {
      wrap.classList.remove('fne-locked');
      inp.readOnly = false;
      if (icon) icon.style.display = 'none';
    }
  }
  
  // ══════════════════════════════════════════════════════════════════
  //  RESET FORM
  // ══════════════════════════════════════════════════════════════════
  function fneResetForm() {
    [
      'fne_fes_ref','fne_site_ref','fne_acc_code','fne_cust_name','fne_cust_addr',
      'fne_osp','fne_osp_et','fne_est_cost','fne_req_status','fne_wo_num',
      'fne_sub_req','fne_bid_ref','fne_impl_type','fne_gaid','fne_build_status',
      'fne_sla','fne_unit_no','fne_assigned_by','fne_proj_type','fne_sof',
      'fne_vertical','fne_acc_dir','fne_am_email','fne_fne_mgr','fne_comments_new',
      'fne_critical_projects',
      'fne_start_date','fne_exp_rfs','fne_rfs_baseline','fne_impl_start',
      'fne_contract_dur','fne_otc','fne_mrc','fne_tcv',
      'fne_blocker','fne_temp_conn','fne_target_mig','fne_pm_man_days',
    ].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const pmRow = document.getElementById('fne_pm_row');
    if (pmRow) pmRow.style.display = 'none';
  
    // Reset health strip
    const strip = document.getElementById('fneHealthStrip');
    if (strip) strip.className = 'fne-health-strip';
    const txt = document.getElementById('fneHealthTxt');
    if (txt) txt.textContent = 'Project Health: —';
    const sub = document.getElementById('fneHealthSub');
    if (sub) sub.textContent = 'Set Expected RFS and Building Status to calculate';
  }
  
  // ══════════════════════════════════════════════════════════════════
  //  CANCEL FORM
  // ══════════════════════════════════════════════════════════════════
  function fneCancelForm() {
    FNE_EDIT_ID = null;
    FNE_PENDING_ATTACH = [];
    FNE_EXISTING_ATTACH = [];
    fneResetForm();
    if (FNE_CAME_FROM_LIST) {
      showFneView('list', document.getElementById('navFneList'));
    } else {
      fneResetForm();
    }
  }
  
  // ══════════════════════════════════════════════════════════════════
  //  ATTACHMENTS
  // ══════════════════════════════════════════════════════════════════
  function fneHandleAttachPick(evt) {
    const files = Array.from(evt.target.files || []);
    files.forEach(f => FNE_PENDING_ATTACH.push({ file: f, name: f.name }));
    evt.target.value = ''; // allow re-picking same file
    fneRenderAttachList();
  }
  
  function fneHandleAttachDrop(evt) {
    evt.preventDefault();
    document.getElementById('fneAttachZone').classList.remove('drag-over');
    const files = Array.from(evt.dataTransfer.files || []);
    files.forEach(f => FNE_PENDING_ATTACH.push({ file: f, name: f.name }));
    fneRenderAttachList();
  }
  
  function fneRenderAttachList() {
    const list = document.getElementById('fneAttachList');
    const countEl = document.getElementById('fneAttachCount');
    if (!list) return;
    list.innerHTML = '';
  
    const total = FNE_EXISTING_ATTACH.length + FNE_PENDING_ATTACH.length;
    if (countEl) countEl.textContent = total + ' file' + (total !== 1 ? 's' : '');
  
    // Existing attachments from SP
    FNE_EXISTING_ATTACH.forEach((att, idx) => {
      const item = document.createElement('div');
      item.className = 'fne-attach-item';
      const fileUrl = FNE_SP + att.ServerRelativeUrl;
      item.innerHTML = `
        <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <span class="fne-attach-name">${att.FileName}</span>
        <span class="fne-attach-existing-badge">Saved</span>
        <a href="${fileUrl}" target="_blank" class="fne-attach-download">Download</a>
        <button type="button" class="fne-attach-remove" onclick="fneRemoveExistingAttach(${idx},event)" title="Delete">×</button>`;
      list.appendChild(item);
    });
  
    // Pending (new) attachments
    FNE_PENDING_ATTACH.forEach((att, idx) => {
      const sizeFmt = att.file.size > 1048576
        ? (att.file.size / 1048576).toFixed(1) + ' MB'
        : Math.round(att.file.size / 1024) + ' KB';
      const item = document.createElement('div');
      item.className = 'fne-attach-item';
      item.innerHTML = `
        <svg viewBox="0 0 24 24"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
        <span class="fne-attach-name">${att.name}</span>
        <span class="fne-attach-size">${sizeFmt}</span>
        <button type="button" class="fne-attach-remove" onclick="fneRemovePendingAttach(${idx})" title="Remove">×</button>`;
      list.appendChild(item);
    });
  }
  
  function fneRemovePendingAttach(idx) {
    FNE_PENDING_ATTACH.splice(idx, 1);
    fneRenderAttachList();
  }
  
  function fneRemoveExistingAttach(idx, evt) {
    if (evt) { evt.preventDefault(); evt.stopPropagation(); }
    const att = FNE_EXISTING_ATTACH[idx];
    if (!att || !FNE_EDIT_ID) return;
    if (!confirm('Delete attachment "' + att.FileName + '" permanently?')) return;
  
    const url = FNE_SP + "/_api/web/lists/getbytitle('" + encodeURIComponent(FNE_LIST) +
      "')/items(" + FNE_EDIT_ID + ")/AttachmentFiles/getByFileName('" +
      encodeURIComponent(att.FileName) + "')";
  
    getDigest(function(digest) {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.setRequestHeader('Accept', 'application/json;odata=verbose');
      xhr.setRequestHeader('Content-Type', 'application/json;odata=verbose');
      xhr.setRequestHeader('X-HTTP-Method', 'DELETE');
      xhr.setRequestHeader('IF-MATCH', '*');
      if (digest) xhr.setRequestHeader('X-RequestDigest', digest);
      xhr.onreadystatechange = function() {
        if (xhr.readyState !== 4) return;
        if (xhr.status >= 200 && xhr.status < 300) {
          FNE_EXISTING_ATTACH.splice(idx, 1);
          fneRenderAttachList();
          fneToast('Attachment deleted', 'success');
        } else {
          fneToast('Delete failed: HTTP ' + xhr.status, 'error');
        }
      };
      xhr.send();
    });
  }
  
  function fneLoadExistingAttachments(itemId) {
    const url = FNE_SP + "/_api/web/lists/getbytitle('" + encodeURIComponent(FNE_LIST) +
      "')/items(" + itemId + ")/AttachmentFiles?$select=FileName,ServerRelativeUrl";
    spGet(url, function(err, data) {
      if (err || !data || !data.d) return;
      FNE_EXISTING_ATTACH = data.d.results || [];
      fneRenderAttachList();
    });
  }
  
  function fneUploadAttachments(itemId, callback) {
    if (!FNE_PENDING_ATTACH.length) { callback(); return; }
    const attach = FNE_PENDING_ATTACH.slice();
    let i = 0;
    function uploadNext() {
      if (i >= attach.length) { FNE_PENDING_ATTACH = []; fneRenderAttachList(); callback(); return; }
      const att = attach[i++];
      const reader = new FileReader();
      reader.onload = function(e) {
        const arrayBuffer = e.target.result;
        const url = FNE_SP + "/_api/web/lists/getbytitle('" + encodeURIComponent(FNE_LIST) +
          "')/items(" + itemId + ")/AttachmentFiles/add(FileName='" +
          encodeURIComponent(att.name) + "')";
        getDigest(function(digest) {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', url, true);
          xhr.setRequestHeader('Accept', 'application/json;odata=verbose');
          if (digest) xhr.setRequestHeader('X-RequestDigest', digest);
          xhr.onreadystatechange = function() {
            if (xhr.readyState !== 4) return;
            if (xhr.status >= 200 && xhr.status < 300) {
              fneToast('Uploaded: ' + att.name, 'success');
            } else {
              fneToast('Upload failed: ' + att.name, 'error');
              console.warn('[FNE Attach] Failed', xhr.status, xhr.responseText);
            }
            uploadNext();
          };
          xhr.send(arrayBuffer);
        });
      };
      reader.readAsArrayBuffer(att.file);
    }
    uploadNext();
  }
  
  // ══════════════════════════════════════════════════════════════════
  //  SAVE (create or update)
  // ══════════════════════════════════════════════════════════════════
  function fneSave() {
    
if (!fneIsAdmin()) {
    fneToast('You do not have permission to modify records', 'error');
    return;
  }

    // Validation
    const required = [
      ['fne_cust_name',    'Customer Name'],
      ['fne_req_status',   'Request Status'],
      ['fne_impl_type',    'Implementation Type'],
      ['fne_build_status', 'Building Status'],
      ['fne_vertical',     'Vertical'],
      ['fne_fne_mgr',      'FNE Manager'],
    ];
    for (const [id, label] of required) {
      const el = document.getElementById(id);
      if (!el || !el.value.trim()) {
        fneToast(label + ' is required', 'error');
        el && el.focus();
        return;
      }
    }
  
    // If FES Ref filled and not locked — Implementation Start Date should be set
    const fesVal   = document.getElementById('fne_fes_ref')?.value.trim();
    const implLock = document.getElementById('lockwrap_impl_start')?.classList.contains('fne-locked');
    const implVal  = document.getElementById('fne_impl_start')?.value.trim();
    if (fesVal && !implLock && !implVal) {
      fneToast('Implementation Start Date is required when FES Reference is filled', 'error');
      document.getElementById('fne_impl_start')?.focus();
      return;
    }
  
    const gv = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
    const gn = id => { const v = parseFloat(gv(id)); return isNaN(v) ? null : v; };

    const critSnapshot = fneIsPowerUser() ? gv('fne_critical_projects') : '';
    const shouldNotifyCritical = fneIsPowerUser() &&
      fneIsCriticalYes(critSnapshot) &&
      !fneIsCriticalYes(FNE_EDIT_CRITICAL_PREV);
    const criticalNotifyRow = shouldNotifyCritical ? {
      id: FNE_EDIT_ID,
      fneManager: gv('fne_fne_mgr'),
      customerName: gv('fne_cust_name'),
      requestStatus: gv('fne_req_status'),
      fesRef: gv('fne_fes_ref'),
    } : null;

    const actualRfsVal = gv('fne_rfs_baseline');
    if (actualRfsVal && fneIsFutureDate(actualRfsVal)) {
      fneToast('Actual RFS Date cannot be in the future', 'error');
      document.getElementById('fne_rfs_baseline')?.focus();
      return;
    }
  
    // Strip HTML tags from GAID
    const gaid = gv('fne_gaid').replace(/<[^>]*>/g, '').trim();
  
    const body = {
      '__metadata': { 'type': FNE_LIST_ITEM_TYPE },
  
      [FNE_F.SURVEY_REF]:   gv('fne_site_ref')     || null,
      [FNE_F.ACC_CODE]:     gn('fne_acc_code'),
      [FNE_F.CUST_NAME]:    gv('fne_cust_name'),
      [FNE_F.CUST_ADDR]:    gv('fne_cust_addr')    || null,
      [FNE_F.OSP_REQ]:      gv('fne_osp')          || null,
      [FNE_F.OSP_ET]:       gn('fne_osp_et'),
      [FNE_F.EST_COST]:     gn('fne_est_cost'),
      [FNE_F.REQ_STATUS]:   gv('fne_req_status'),
      [FNE_F.WO_NUM]:       gv('fne_wo_num')       || null,
      [FNE_F.SUB_REQ]:      gv('fne_sub_req')      || null,
      [FNE_F.BID_REF]:      gv('fne_bid_ref')      || null,
      [FNE_F.IMPL_TYPE]:    gv('fne_impl_type'),
      [FNE_F.GAID]:         gaid                   || null,
      [FNE_F.BUILD_STATUS]: gv('fne_build_status'),
      [FNE_F.SLA]:          gn('fne_sla'),
      [FNE_F.UNIT_NO]:      gn('fne_unit_no'),
      [FNE_F.ASSIGNED_BY]:  gv('fne_assigned_by')  || null,
      [FNE_F.PROJ_TYPE]:    gv('fne_proj_type')    || null,
      [FNE_F.SOF]:          gv('fne_sof')          || null,
      [FNE_F.VERTICAL]:     gv('fne_vertical'),
      [FNE_F.ACC_DIR]:      gv('fne_acc_dir')      || null,
      [FNE_F.FNE_MGR]:      gv('fne_fne_mgr'),
      [FNE_F.COMMENTS_NEW]: gv('fne_comments_new') || null,
      [FNE_F.CONTRACT_DUR]: gn('fne_contract_dur'),
      [FNE_F.OTC]:          gn('fne_otc'),
      [FNE_F.MRC]:          gn('fne_mrc'),
      [FNE_F.TCV]:          gn('fne_tcv'),
      [FNE_F.BLOCKER]:      gv('fne_blocker')      || null,
      [FNE_F.TEMP_CONN]:    gv('fne_temp_conn')    || null,
      [FNE_F.FES_REF]:      gv('fne_fes_ref')      || null,
    };
    if (fneIsPowerUser()) {
      body[FNE_F.CRITICAL_PROJ] = gv('fne_critical_projects') || null;
    }
    // Note: PROJ_HEALTH (Project_x0020_Health) is a SP calculated column — read-only, not written here
    // Note: PM_MAN_DAYS (Project Duration display) is a SP calculated column — read-only, not written here
    // Note: Account_x0020_Manager (Person field) is set separately via user ID lookup below
  
    // Date fields — only include if not locked (for one-time fields)
    const expRfsLocked = document.getElementById('lockwrap_exp_rfs')?.classList.contains('fne-locked');
    const implLocked   = document.getElementById('lockwrap_impl_start')?.classList.contains('fne-locked');
  
    const dateFields = [
      ['fne_start_date',   FNE_F.START_DATE,   false],
      ['fne_exp_rfs',      FNE_F.EXP_RFS,      expRfsLocked],
      ['fne_rfs_baseline', FNE_F.RFS_BASELINE, false],
      ['fne_impl_start',   FNE_F.IMPL_START,   implLocked],
      ['fne_target_mig',   FNE_F.TARGET_MIG,   false],
    ];
    dateFields.forEach(([id, field, locked]) => {
      if (locked) return; // don't overwrite locked fields
      const v = gv(id);
      body[field] = v ? new Date(v).toISOString() : null;
    });
  
    const saveBtn = document.getElementById('fneSaveBtnTxt');
    const saveBtnEl = document.getElementById('fneSaveBtn');
    if (saveBtn) saveBtn.textContent = 'Saving...';
    if (saveBtnEl) saveBtnEl.disabled = true;
  
    // Resolve Account Manager email → SP user ID, then save
    const amEmail = gv('fne_am_email');
    function doSave(amUserId) {
      if (amUserId) body['Account_x0020_ManagerId'] = amUserId;
  
      const afterSave = (savedId) => {
        if (criticalNotifyRow) {
          criticalNotifyRow.id = savedId || criticalNotifyRow.id;
          fneNotifyCriticalProjectYes(criticalNotifyRow);
          fneToast('Critical Project set to Yes — Outlook email opened for the FNE Manager', 'success');
        }
        if (fneIsPowerUser()) FNE_EDIT_CRITICAL_PREV = critSnapshot;
        fneUploadAttachments(savedId, function() {
          if (saveBtn) saveBtn.textContent = FNE_EDIT_ID ? 'Update Entry' : 'Save Entry';
          if (saveBtnEl) saveBtnEl.disabled = false;
          fneLoadList();
          const countEl = document.getElementById('fneBannerCount');
          if (countEl) countEl.textContent = FNE_LIST_DATA.length + ' records';
        });
      };
  
      if (FNE_EDIT_ID) {
        const url = FNE_SP + "/_api/web/lists/getbytitle('" + encodeURIComponent(FNE_LIST) +
          "')/items(" + FNE_EDIT_ID + ")";
        getDigest(function(digest) {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', url, true);
          xhr.setRequestHeader('Accept', 'application/json;odata=verbose');
          xhr.setRequestHeader('Content-Type', 'application/json;odata=verbose');
          xhr.setRequestHeader('X-HTTP-Method', 'MERGE');
          xhr.setRequestHeader('IF-MATCH', '*');
          if (digest) xhr.setRequestHeader('X-RequestDigest', digest);
          xhr.onreadystatechange = function() {
            if (xhr.readyState !== 4) return;
            if (xhr.status >= 200 && xhr.status < 300) {
              fneToast('Record updated successfully', 'success');
              afterSave(FNE_EDIT_ID);
            } else {
              if (saveBtn) saveBtn.textContent = 'Update Entry';
              if (saveBtnEl) saveBtnEl.disabled = false;
              fneToast('Update failed: HTTP ' + xhr.status, 'error');
              console.error('[FNE] Update error', xhr.responseText);
            }
          };
          xhr.send(JSON.stringify(body));
        });
      } else {
        const url = FNE_SP + "/_api/web/lists/getbytitle('" + encodeURIComponent(FNE_LIST) + "')/items";
        spPost(url, body, function(err, data) {
          if (err) {
            if (saveBtn) saveBtn.textContent = 'Save Entry';
            if (saveBtnEl) saveBtnEl.disabled = false;
            fneToast('Save failed: ' + err.message, 'error');
            console.error('[FNE] Save error', err);
            return;
          }
          fneToast('Record saved successfully', 'success');
          const newId = data && data.d ? data.d.Id : null;
          fneResetForm();
          fneSetLockState('exp_rfs', false);
          fneSetLockState('impl_start', false);
          if (newId) afterSave(newId);
          else { fneLoadList(); if (saveBtnEl) saveBtnEl.disabled = false; }
        });
      }
    }
  
    if (amEmail) {
      // Resolve email to SP user ID via ensureUser
      const ensureUrl = FNE_SP + "/_api/web/ensureuser";
      getDigest(function(digest) {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', ensureUrl, true);
        xhr.setRequestHeader('Accept', 'application/json;odata=verbose');
        xhr.setRequestHeader('Content-Type', 'application/json;odata=verbose');
        if (digest) xhr.setRequestHeader('X-RequestDigest', digest);
        xhr.onreadystatechange = function() {
          if (xhr.readyState !== 4) return;
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const d = JSON.parse(xhr.responseText);
              doSave(d.d.Id);
            } catch(e) { doSave(null); }
          } else {
            console.warn('[FNE] ensureUser failed for:', amEmail, xhr.status);
            doSave(null); // save without AM rather than blocking
          }
        };
        xhr.send(JSON.stringify({ 'logonName': amEmail }));
      });
    } else {
      doSave(null);
    }
  }
  
  // ══════════════════════════════════════════════════════════════════
  //  DELETE
  // ══════════════════════════════════════════════════════════════════
  function fneDeleteItem() {
    if (!fneIsAdmin()) {
  fneToast('You do not have permission to delete records', 'error');
  return;
}
    if (!FNE_EDIT_ID) return;
    if (!confirm('Delete record ID ' + FNE_EDIT_ID + '? This cannot be undone.')) return;
  
    const url = FNE_SP + "/_api/web/lists/getbytitle('" + encodeURIComponent(FNE_LIST) +
      "')/items(" + FNE_EDIT_ID + ")";
    getDigest(function(digest) {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.setRequestHeader('Accept', 'application/json;odata=verbose');
      xhr.setRequestHeader('Content-Type', 'application/json;odata=verbose');
      xhr.setRequestHeader('X-HTTP-Method', 'DELETE');
      xhr.setRequestHeader('IF-MATCH', '*');
      if (digest) xhr.setRequestHeader('X-RequestDigest', digest);
      xhr.onreadystatechange = function() {
        if (xhr.readyState !== 4) return;
        if (xhr.status >= 200 && xhr.status < 300) {
          fneToast('Record deleted', 'success');
          FNE_EDIT_ID = null;
          FNE_PENDING_ATTACH = [];
          FNE_EXISTING_ATTACH = [];
          fneResetForm();
          fneRenderAttachList();
          document.getElementById('fneEditBanner').style.display = 'none';
          document.getElementById('fneDeleteBtn').style.display  = 'none';
          document.getElementById('fneSaveBtnTxt').textContent   = 'Save Entry';
          document.getElementById('fneBannerMode').innerHTML     = `<svg viewBox="0 0 24 24" style="width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg><span>New Entry</span>`;
          fneSetLockState('exp_rfs',   false);
          fneSetLockState('impl_start', false);
          fneLoadList();
        } else {
          fneToast('Delete failed: HTTP ' + xhr.status, 'error');
        }
      };
      xhr.send();
    });
  }
  
  // ══════════════════════════════════════════════════════════════════
  //  LOAD LIST DATA
  // ══════════════════════════════════════════════════════════════════
  function fneLoadList() {
    const countEl   = document.getElementById('fneListCount');
    const spinner   = document.getElementById('fneListSpinner');
    const gridEl    = document.getElementById('fneGrid');
    if (countEl) countEl.textContent = 'Loading...';
    if (spinner) spinner.style.display = 'block';
    if (gridEl)  gridEl.style.display  = 'none';
  
    const select = [
      'Id', FNE_F.SUB_REQ, FNE_F.IMPL_TYPE, FNE_F.START_DATE,
      FNE_F.SLA, FNE_F.EXP_RFS, FNE_F.BUILD_STATUS, FNE_F.CUST_NAME,
      FNE_F.SOF, FNE_F.MRC, FNE_F.EST_COST, FNE_F.VERTICAL, FNE_F.COMMENTS,
      FNE_F.REQ_STATUS, FNE_F.CUST_ADDR, FNE_F.ACC_CODE, FNE_F.ASSIGNED_BY,
      FNE_F.PROJ_TYPE, FNE_F.UNIT_NO, FNE_F.OTC, FNE_F.TCV, FNE_F.OSP_REQ,
      FNE_F.OSP_ET, FNE_F.FES_REF, FNE_F.SURVEY_REF, FNE_F.GAID, FNE_F.BID_REF,
      FNE_F.WO_NUM, FNE_F.ACC_DIR, FNE_F.CONTRACT_DUR, FNE_F.FNE_MGR,
      FNE_F.RFS_BASELINE, FNE_F.CRITICAL_PROJ, FNE_F.COMMENTS_NEW, FNE_F.IMPL_START, FNE_F.PROJ_HEALTH,
      FNE_F.SPI, FNE_F.TEMP_CONN, FNE_F.TARGET_MIG, FNE_F.BLOCKER, FNE_F.PM_MAN_DAYS,
      'Account_x0020_Manager/Id', 'Account_x0020_Manager/Title', 'Account_x0020_Manager/EMail'
    ].join(',');
  
    let all = [];
    function fetchPage(url) {
      spGet(url, function(err, data) {
        if (err) {
          fneToast('Failed to load list: ' + err.message, 'error');
          if (countEl) countEl.textContent = '0 records';
          if (spinner) spinner.style.display = 'none';
          if (gridEl)  gridEl.style.display  = 'block';
          return;
        }
        all = all.concat(data.d.results);
        if (data.d.__next) { fetchPage(data.d.__next); return; }
        FNE_LIST_DATA = all.map(fneMapItem);
        fneListBuildAllFilters();
        fneListApplyFilter();
        if (spinner) spinner.style.display = 'none';
        if (gridEl)  gridEl.style.display  = 'block';
        const countBanner = document.getElementById('fneBannerCount');
        if (countBanner) countBanner.textContent = FNE_LIST_DATA.length + ' records';
      });
    }
  
    const url = FNE_SP + "/_api/web/lists/getbytitle('" + encodeURIComponent(FNE_LIST) +
      "')/items?$select=" + encodeURIComponent(select) +
      "&$expand=Account_x0020_Manager&$top=5000&$orderby=Id desc";
    fetchPage(url);
  }
  
  function fneMapItem(it) {
    const n  = v => { const f = parseFloat(v); return isNaN(f) ? 0 : f; };
    const sd = it[FNE_F.START_DATE] || null;
    const yr = sd ? new Date(sd).getFullYear() : null;
    return {
      id:              it.Id,
      subRequest:      it[FNE_F.SUB_REQ]      || '—',
      implType:        it[FNE_F.IMPL_TYPE]    || '—',
      startDate:       sd,
      year:            yr,
      sla:             n(it[FNE_F.SLA]),
      expectedRFS:     it[FNE_F.EXP_RFS]      || null,
      buildingStatus:  it[FNE_F.BUILD_STATUS] || '—',
      customerName:    it[FNE_F.CUST_NAME]    || '—',
      sof:             it[FNE_F.SOF]          || '—',
      mrc:             n(it[FNE_F.MRC]),
      estimatedCost:   n(it[FNE_F.EST_COST]),
      vertical:        it[FNE_F.VERTICAL]     || '—',
      requestStatus:   it[FNE_F.REQ_STATUS]   || '—',
      customerAddress: it[FNE_F.CUST_ADDR]    || '—',
      accountCode:     n(it[FNE_F.ACC_CODE]),
      assignedBy:      it[FNE_F.ASSIGNED_BY]  || '—',
      projectType:     it[FNE_F.PROJ_TYPE]    || '—',
      unitNo:          n(it[FNE_F.UNIT_NO]),
      otc:             n(it[FNE_F.OTC]),
      tcv:             n(it[FNE_F.TCV]),
      ospRequired:     it[FNE_F.OSP_REQ]      || '—',
      ospCivilET:      n(it[FNE_F.OSP_ET]),
      fesRef:          it[FNE_F.FES_REF]      || '—',
      siteRef:         it[FNE_F.SURVEY_REF]   || '—',
      gaid:            (it[FNE_F.GAID] || '—').replace(/<[^>]*>/g, ''),
      bidRef:          it[FNE_F.BID_REF]      || '—',
      woNumber:        it[FNE_F.WO_NUM]       || '—',
      accountDirector: it[FNE_F.ACC_DIR]      || '—',
      contractDuration:n(it[FNE_F.CONTRACT_DUR]),
      fneManager:      it[FNE_F.FNE_MGR]      || '—',
      rfsBaseline:     it[FNE_F.RFS_BASELINE] || null,
      criticalProjects:it[FNE_F.CRITICAL_PROJ]|| '—',
      commentsNew:     fneHtmlToPlain(it[FNE_F.COMMENTS_NEW]) || '—',
      implStart:       it[FNE_F.IMPL_START]   || null,
      projectHealth:   it[FNE_F.PROJ_HEALTH]  || '—',
      spi:             n(it[FNE_F.SPI]),
      tempConnType:    it[FNE_F.TEMP_CONN]    || '—',
      targetMigDate:   it[FNE_F.TARGET_MIG]   || null,
      blocker:         it[FNE_F.BLOCKER]      || '—',
      pmManDays:       it[FNE_F.PM_MAN_DAYS]  || '—',
      amName:          it.Account_x0020_Manager ? (it.Account_x0020_Manager.Title || '—') : '—',
      amEmail:         it.Account_x0020_Manager ? (it.Account_x0020_Manager.EMail || '')  : '',
    };
  }
  
  function fneListApplyFilter() {
    fneEnsurePowerUserUi();
    const rfsMig = fneGetRfsMigrationFilter();
    const filtered = FNE_LIST_DATA.filter(function(item) {
      for (const key in FNE_LIST_MS_CFG) {
        const cfg = FNE_LIST_MS_CFG[key];
        const sel = FNE_LIST_MS_STATE[key];
        if (!sel || sel.size === 0) continue;
        const val = item[cfg.field];
        if (!sel.has(val) && !sel.has(String(val))) return false;
      }
      if (rfsMig === 'approaching' && !fneIsApproachingRfs(item)) return false;
      if (rfsMig === 'overdue' && !fneIsOverdueRfs(item)) return false;
      return true;
    });
    fneRenderGrid(filtered);
  }

  function fneListReset() {
    Object.keys(FNE_LIST_MS_STATE).forEach(function(key) {
      FNE_LIST_MS_STATE[key].clear();
      const cfg = FNE_LIST_MS_CFG[key];
      if (cfg) {
        const drop = document.getElementById(cfg.dropId);
        if (drop) drop.querySelectorAll('input[type=checkbox]').forEach(function(cb) { cb.checked = false; });
        fneUpdateListMsLabel(key);
      }
    });
    const rfsMig = document.getElementById('fnel_rfsMigration');
    if (rfsMig) rfsMig.value = '';
    const search = document.getElementById('fneListSearch');
    if (search) search.value = '';
    if (FNE_GRID_API) FNE_GRID_API.setGridOption('quickFilterText', '');
    fneRenderGrid(FNE_LIST_DATA);
  }
  
  // ══════════════════════════════════════════════════════════════════
  //  AG GRID — MULTI-SELECT COLUMN FILTER (SharePoint-style)
  // ══════════════════════════════════════════════════════════════════
  class FneSetColumnFilter {
    init(params) {
      this.params = params;
      this.selected = new Set();
      this.gui = document.createElement('div');
      this.gui.className = 'fne-ag-set-filter';
      this._buildGui();
    }

    _cellValue(data) {
      let v = data[this.params.colDef.field];
      if (v === null || v === undefined || v === '') return '—';
      return String(v);
    }

    _allValues() {
      const values = new Set();
      this.params.api.forEachNode(node => {
        if (node.data) values.add(this._cellValue(node.data));
      });
      return [...values].sort((a, b) => a.localeCompare(b));
    }

    _buildGui() {
      const all = this._allValues();
      this.gui.innerHTML = '';

      const search = document.createElement('input');
      search.type = 'text';
      search.placeholder = 'Search...';
      search.className = 'fne-ag-set-search';
      this.gui.appendChild(search);

      const list = document.createElement('div');
      list.className = 'fne-ag-set-list';
      this.gui.appendChild(list);

      const render = (term) => {
        list.innerHTML = '';
        all.filter(v => !term || v.toLowerCase().includes(term.toLowerCase())).forEach(v => {
          const row = document.createElement('label');
          row.className = 'fne-ag-set-option';
          const cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.checked = this.selected.has(v);
          cb.onchange = () => {
            if (cb.checked) this.selected.add(v);
            else this.selected.delete(v);
            this.params.filterChangedCallback();
          };
          row.appendChild(cb);
          row.appendChild(document.createTextNode(' ' + v));
          list.appendChild(row);
        });
      };
      render('');
      search.oninput = () => render(search.value);

      const actions = document.createElement('div');
      actions.className = 'fne-ag-set-actions';
      const btnAll = document.createElement('button');
      btnAll.type = 'button';
      btnAll.textContent = 'Select all';
      btnAll.onclick = () => { all.forEach(v => this.selected.add(v)); render(search.value); this.params.filterChangedCallback(); };
      const btnClear = document.createElement('button');
      btnClear.type = 'button';
      btnClear.textContent = 'Clear';
      btnClear.onclick = () => { this.selected.clear(); render(search.value); this.params.filterChangedCallback(); };
      actions.appendChild(btnAll);
      actions.appendChild(btnClear);
      this.gui.appendChild(actions);
    }

    getGui() { return this.gui; }
    isFilterActive() { return this.selected.size > 0; }
    doesFilterPass(params) {
      if (!this.selected.size) return true;
      return this.selected.has(this._cellValue(params.data));
    }
    getModel() { return this.selected.size ? { values: [...this.selected] } : null; }
    setModel(model) {
      this.selected = new Set(model && model.values ? model.values : []);
      this._buildGui();
    }
    destroy() {}
  }
  window.FneSetColumnFilter = FneSetColumnFilter;

  const FNE_MS_FILTER_FIELDS = new Set([
    'fneManager', 'customerName', 'requestStatus', 'projectHealth', 'buildingStatus',
    'fesRef', 'vertical', 'implType', 'subRequest', 'projectType',
    'accountDirector', 'amName', 'assignedBy', 'tempConnType', 'blocker',
    'sof', 'ospRequired', 'gaid', 'woNumber', 'bidRef', 'siteRef', 'criticalProjects', 'year',
  ]);

  const FNE_DATE_FILTER_FIELDS = new Set(['startDate', 'expectedRFS', 'rfsBaseline', 'implStart', 'targetMigDate']);

  function fneEnhanceColDef(col) {
    fneApplyHeaderSizing(col);
    if (FNE_MS_FILTER_FIELDS.has(col.field)) {
      col.filter = FneSetColumnFilter;
    } else if (col.type === 'numericColumn') {
      col.filter = 'agNumberColumnFilter';
    } else if (FNE_DATE_FILTER_FIELDS.has(col.field)) {
      col.filter = 'agDateColumnFilter';
    }
    return col;
  }

  // ══════════════════════════════════════════════════════════════════
  //  BULK EDIT — grid selection helpers
  // ══════════════════════════════════════════════════════════════════
  function fneUpdateBulkSelectionCount() {
    const el = document.getElementById('fneBulkSelCount');
    if (!el || !FNE_GRID_API) return;
    const n = fneGetSelectedGridRows().length;
    el.textContent = n + ' selected';
  }

  function fneGetSelectedGridRows() {
    if (!FNE_GRID_API) return [];
    if (typeof FNE_GRID_API.getSelectedRows === 'function') {
      return FNE_GRID_API.getSelectedRows() || [];
    }
    const rows = [];
    FNE_GRID_API.forEachNode(node => {
      if (node.isSelected && node.isSelected() && node.data) rows.push(node.data);
    });
    return rows;
  }

  function fneDeleteSpItem(itemId, cb) {
    const url = FNE_SP + "/_api/web/lists/getbytitle('" + encodeURIComponent(FNE_LIST) +
      "')/items(" + itemId + ")";
    getDigest(function(digest) {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.setRequestHeader('Accept', 'application/json;odata=verbose');
      xhr.setRequestHeader('Content-Type', 'application/json;odata=verbose');
      xhr.setRequestHeader('X-HTTP-Method', 'DELETE');
      xhr.setRequestHeader('IF-MATCH', '*');
      if (digest) xhr.setRequestHeader('X-RequestDigest', digest);
      xhr.onreadystatechange = function() {
        if (xhr.readyState !== 4) return;
        cb(xhr.status >= 200 && xhr.status < 300 ? null : new Error('HTTP ' + xhr.status));
      };
      xhr.send();
    });
  }

  function fneBulkDeleteSelected() {
    if (!fneIsPowerUser()) {
      fneToast('You do not have permission to bulk delete records', 'error');
      return;
    }
    const rows = fneGetSelectedGridRows();
    if (!rows.length) {
      fneToast('Select at least one row using the checkboxes on the left', 'error');
      return;
    }
    if (!confirm('Delete ' + rows.length + ' selected record(s)? This cannot be undone.')) return;

    let done = 0, failed = 0;
    const total = rows.length;

    function deleteNext(i) {
      if (i >= total) {
        fneToast('Deleted ' + done + ' record(s)' + (failed ? ', ' + failed + ' failed' : ''), failed ? 'error' : 'success');
        fneLoadList();
        return;
      }
      fneDeleteSpItem(rows[i].id, function(err) {
        if (err) failed++; else done++;
        deleteNext(i + 1);
      });
    }
    deleteNext(0);
  }

  // ══════════════════════════════════════════════════════════════════
  //  BULK ENTRY TABLE (New Entry — spreadsheet style)
  // ══════════════════════════════════════════════════════════════════
  const FNE_BULK_TABLE_COLS = [
    { key: 'fesRef',           label: 'FES / Shortfall Ref', type: 'text' },
    { key: 'siteRef',          label: 'Site Survey Ref',   type: 'text' },
    { key: 'accountCode',      label: 'Account Code',      type: 'number' },
    { key: 'customerName',     label: 'Customer Name *',   type: 'text', required: true },
    { key: 'customerAddress',  label: 'Address',           type: 'text', wide: true },
    { key: 'requestStatus',    label: 'Status *',          type: 'choice', choicesKey: 'requestStatus', required: true },
    { key: 'subRequest',       label: 'Request Type',      type: 'choice', choicesKey: 'subRequest' },
    { key: 'implType',         label: 'Impl. Type *',      type: 'choice', choicesKey: 'implType', required: true },
    { key: 'buildingStatus',   label: 'Building *',        type: 'choice', choicesKey: 'buildingStatus', required: true },
    { key: 'projectType',      label: 'Connectivity Type', type: 'choice', choicesKey: 'projectType' },
    { key: 'assignedBy',       label: 'Assigned By',       type: 'choice', choicesKey: 'assignedBy' },
    { key: 'sof',              label: 'SOF',               type: 'choice', choicesKey: 'sof' },
    { key: 'criticalProjects', label: 'Critical Project',  type: 'choice', choicesKey: 'criticalProjects', powerEditOnly: true },
    { key: 'sla',              label: 'SLA (days)',        type: 'number' },
    { key: 'unitNo',           label: 'Unit No',           type: 'number' },
    { key: 'woNumber',         label: 'WO Number',         type: 'text' },
    { key: 'bidRef',           label: 'Bid Number',        type: 'text' },
    { key: 'gaid',             label: 'GAID',              type: 'text' },
    { key: 'estimatedCost',    label: 'Est. Cost',         type: 'number' },
    { key: 'ospRequired',      label: 'OSP Civil',         type: 'choice', choicesKey: 'ospCivil' },
    { key: 'ospCivilET',       label: 'OSP ET (days)',     type: 'number' },
    { key: 'blocker',          label: 'Blocker',           type: 'choice', choicesKey: 'blocker' },
    { key: 'vertical',         label: 'Vertical *',        type: 'choice', choicesKey: 'vertical', required: true },
    { key: 'accountDirector',  label: 'Acct. Director',    type: 'choice', choicesKey: 'accountDirector' },
    { key: 'amEmail',          label: 'AM Email',          type: 'email' },
    { key: 'fneManager',       label: 'FNE Manager *',     type: 'choice', choicesKey: 'fneManager', required: true },
    { key: 'startDate',        label: 'Received Date',     type: 'date' },
    { key: 'expectedRFS',      label: 'Exp. RFS Date',     type: 'date' },
    { key: 'rfsBaseline',      label: 'Actual RFS Date',   type: 'date', noFuture: true },
    { key: 'implStart',        label: 'Impl. Start',       type: 'date' },
    { key: 'tempConnType',     label: 'Temp Conn.',        type: 'choice', choicesKey: 'tempConnType' },
    { key: 'targetMigDate',    label: 'Target Mig. Date',  type: 'date' },
    { key: 'contractDuration', label: 'Duration (mo)',     type: 'number' },
    { key: 'otc',              label: 'OTC',               type: 'number' },
    { key: 'mrc',              label: 'MRC',               type: 'number' },
    { key: 'tcv',              label: 'TCV',               type: 'number', readonly: true, autoCalc: true },
    { key: 'pmManDays',        label: 'Project Duration',  type: 'text',   readonly: true, autoCalc: true },
    { key: 'projectHealth',    label: 'Project Health',    type: 'text',   readonly: true, autoCalc: true },
    { key: 'spi',              label: 'SPI',               type: 'number', readonly: true, autoCalc: true },
    { key: 'commentsNew',      label: 'Comments',          type: 'text', wide: true },
  ];

  function fneBulkTableCols() {
    return FNE_BULK_TABLE_COLS;
  }

  const FNE_IMPORT_COLUMNS = [
    { key: 'customerName',     sp: () => FNE_F.CUST_NAME,    required: true,  type: 'text' },
    { key: 'requestStatus',    sp: () => FNE_F.REQ_STATUS,   required: true,  type: 'text' },
    { key: 'implType',         sp: () => FNE_F.IMPL_TYPE,    required: true,  type: 'text' },
    { key: 'buildingStatus',   sp: () => FNE_F.BUILD_STATUS, required: true,  type: 'text' },
    { key: 'vertical',         sp: () => FNE_F.VERTICAL,     required: true,  type: 'text' },
    { key: 'fneManager',       sp: () => FNE_F.FNE_MGR,      required: true,  type: 'text' },
    { key: 'fesRef',           sp: () => FNE_F.FES_REF,      required: false, type: 'text' },
    { key: 'siteRef',          sp: () => FNE_F.SURVEY_REF,   required: false, type: 'text' },
    { key: 'accountCode',      sp: () => FNE_F.ACC_CODE,     required: false, type: 'number' },
    { key: 'customerAddress',  sp: () => FNE_F.CUST_ADDR,    required: false, type: 'text' },
    { key: 'subRequest',       sp: () => FNE_F.SUB_REQ,      required: false, type: 'text' },
    { key: 'projectType',      sp: () => FNE_F.PROJ_TYPE,    required: false, type: 'text' },
    { key: 'assignedBy',       sp: () => FNE_F.ASSIGNED_BY,  required: false, type: 'text' },
    { key: 'sof',              sp: () => FNE_F.SOF,          required: false, type: 'text' },
    { key: 'criticalProjects', sp: () => FNE_F.CRITICAL_PROJ, required: false, type: 'text' },
    { key: 'sla',              sp: () => FNE_F.SLA,          required: false, type: 'number' },
    { key: 'unitNo',           sp: () => FNE_F.UNIT_NO,      required: false, type: 'number' },
    { key: 'woNumber',         sp: () => FNE_F.WO_NUM,       required: false, type: 'text' },
    { key: 'bidRef',           sp: () => FNE_F.BID_REF,      required: false, type: 'text' },
    { key: 'gaid',             sp: () => FNE_F.GAID,         required: false, type: 'text' },
    { key: 'estimatedCost',    sp: () => FNE_F.EST_COST,     required: false, type: 'number' },
    { key: 'ospRequired',      sp: () => FNE_F.OSP_REQ,      required: false, type: 'text' },
    { key: 'ospCivilET',       sp: () => FNE_F.OSP_ET,       required: false, type: 'number' },
    { key: 'blocker',          sp: () => FNE_F.BLOCKER,      required: false, type: 'text' },
    { key: 'accountDirector',  sp: () => FNE_F.ACC_DIR,      required: false, type: 'text' },
    { key: 'startDate',        sp: () => FNE_F.START_DATE,   required: false, type: 'date' },
    { key: 'expectedRFS',      sp: () => FNE_F.EXP_RFS,      required: false, type: 'date' },
    { key: 'rfsBaseline',      sp: () => FNE_F.RFS_BASELINE, required: false, type: 'date', noFuture: true },
    { key: 'implStart',        sp: () => FNE_F.IMPL_START,   required: false, type: 'date' },
    { key: 'tempConnType',     sp: () => FNE_F.TEMP_CONN,    required: false, type: 'text' },
    { key: 'targetMigDate',    sp: () => FNE_F.TARGET_MIG,   required: false, type: 'date' },
    { key: 'contractDuration', sp: () => FNE_F.CONTRACT_DUR, required: false, type: 'number' },
    { key: 'otc',              sp: () => FNE_F.OTC,          required: false, type: 'number' },
    { key: 'mrc',              sp: () => FNE_F.MRC,          required: false, type: 'number' },
    { key: 'commentsNew',      sp: () => FNE_F.COMMENTS_NEW, required: false, type: 'text' },
  ];

  let FNE_BULK_TABLE_READY = false;
  let FNE_BULK_TABLE_CTX = 'new';

  const FNE_BULK_TABLE_IDS = {
    new:  { head: 'fneBulkTableHead', body: 'fneBulkTableBody', wrap: 'fneBulkTableWrap', status: 'fneBulkUploadStatus', count: 'fneBulkRowCount' },
    edit: { head: 'fneBulkEditTableHead', body: 'fneBulkEditTableBody', wrap: 'fneBulkEditTableWrap', status: 'fneBulkEditStatus', count: 'fneBulkEditRowCount' },
  };

  function fneBulkSetCtx(ctx) { FNE_BULK_TABLE_CTX = ctx === 'edit' ? 'edit' : 'new'; }
  function fneBulkIsEdit() { return FNE_BULK_TABLE_CTX === 'edit'; }
  function fneBulkEl(key) {
    const ids = FNE_BULK_TABLE_IDS[FNE_BULK_TABLE_CTX];
    return ids ? document.getElementById(ids[key]) : null;
  }
  function fneBulkBodyId() { return FNE_BULK_TABLE_IDS[FNE_BULK_TABLE_CTX].body; }

  function fneBulkPlainVal(v) {
    if (v === null || v === undefined || v === '—' || v === '') return '';
    return String(v);
  }
  function fneBulkPlainDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return isNaN(d) ? '' : d.toISOString().split('T')[0];
  }
  function fneGridRowToBulkEdit(row) {
    const rec = { _id: row.id };
    fneBulkTableCols().forEach(col => {
      const v = row[col.key];
      if (col.type === 'date') rec[col.key] = fneBulkPlainDate(v);
      else if (col.type === 'number') rec[col.key] = (v === '—' || v === null || v === undefined || v === '') ? '' : String(v);
      else rec[col.key] = fneBulkPlainVal(v);
    });
    return rec;
  }

  function fneBulkRecalcRowTcv(tr) {
    if (!tr) return;
    const gn = key => parseFloat(tr.querySelector('[data-key="' + key + '"]')?.value) || 0;
    const tcv = gn('contractDuration') * gn('mrc') + gn('otc');
    const el = tr.querySelector('[data-key="tcv"]');
    if (el) el.value = tcv ? tcv.toFixed(2) : '';
  }

  function fneBulkWireRowCalc(tr) {
    if (!tr) return;
    ['contractDuration', 'otc', 'mrc'].forEach(key => {
      const el = tr.querySelector('[data-key="' + key + '"]');
      if (!el || el.dataset.tcvWired) return;
      el.dataset.tcvWired = '1';
      el.addEventListener('input', () => fneBulkRecalcRowTcv(tr));
    });
    fneBulkRecalcRowTcv(tr);
  }

  function fneBulkWireVerticalDirector(tr) {
    if (!tr) return;
    const vEl = tr.querySelector('[data-key="vertical"]');
    const dEl = tr.querySelector('[data-key="accountDirector"]');
    if (!vEl || !dEl || vEl.dataset.vdWired) return;
    vEl.dataset.vdWired = '1';
    vEl.addEventListener('change', function() {
      fneSetDirectorForVertical(vEl.value, dEl);
    });
    if (vEl.value) fneSetDirectorForVertical(vEl.value, dEl);
  }

  function fneBulkStripAutoCalc(data) {
    if (!data) return data;
    fneBulkTableCols().forEach(col => {
      if (col.readonly) data[col.key] = '';
    });
    return data;
  }

  function fneSetEntryMode(mode) {
    const single = document.getElementById('fneSingleEntryWrap');
    const bulk = document.getElementById('fneBulkEntryWrap');
    const health = document.getElementById('fneHealthStrip');
    const saveBtn = document.getElementById('fneSaveBtn');
    const bulkBtn = document.getElementById('fneBulkUploadBtn');
    const tabS = document.getElementById('fneTabSingle');
    const tabB = document.getElementById('fneTabBulk');
    const isBulk = mode === 'bulk';

    if (single) single.style.display = isBulk ? 'none' : 'block';
    if (bulk) bulk.style.display = isBulk ? 'block' : 'none';
    if (health) health.style.display = isBulk ? 'none' : 'flex';
    if (saveBtn) saveBtn.style.display = isBulk ? 'none' : 'inline-flex';
    if (bulkBtn) bulkBtn.style.display = isBulk ? 'inline-flex' : 'none';
    if (tabS) tabS.classList.toggle('active', !isBulk);
    if (tabB) tabB.classList.toggle('active', isBulk);

    if (isBulk) {
      fneBulkInitTable('new');
    }
  }

  function fneBulkCellHtml(col, val) {
    const v = val || '';
    const cls = col.wide ? 'fne-bulk-cell fne-bulk-cell-comments' : (col.type === 'date' ? 'fne-bulk-cell fne-bulk-cell-date' : (col.type === 'number' ? 'fne-bulk-cell fne-bulk-cell-num' : 'fne-bulk-cell'));
    if (col.readonly) {
      const roCls = cls + ' fne-bulk-cell-readonly' + (col.key === 'tcv' ? ' fne-bulk-tcv' : '');
      const ph = v ? '' : ' placeholder="Auto-calculated"';
      return '<input type="text" class="' + roCls + '" data-key="' + col.key + '" value="' + String(v).replace(/"/g, '&quot;') + '" readonly tabindex="-1" title="Auto-calculated — not editable"' + ph + '>';
    }
    if (col.type === 'choice') {
      if (col.powerEditOnly && !fneIsPowerUser()) {
        const disp = v || '—';
        return '<input type="text" class="' + cls + ' fne-bulk-cell-readonly" data-key="' + col.key +
          '" value="' + String(disp).replace(/"/g, '&quot;') + '" readonly tabindex="-1">';
      }
      const opts = (FNE_CHOICES[col.choicesKey] || []);
      return '<select class="' + cls + '" data-key="' + col.key + '"><option value=""></option>' +
        opts.map(c => '<option value="' + c + '"' + (c === v ? ' selected' : '') + '>' + c + '</option>').join('') + '</select>';
    }
    if (col.type === 'date') {
      const iso = v ? (fneParseImportDate(v) || v) : '';
      const max = col.noFuture ? ' max="' + fneTodayDateStr() + '"' : '';
      return '<input type="date" class="' + cls + '" data-key="' + col.key + '" value="' + iso + '"' + max + '>';
    }
    if (col.type === 'number') {
      return '<input type="number" class="' + cls + '" data-key="' + col.key + '" value="' + v + '">';
    }
    if (col.type === 'email') {
      return '<input type="email" class="' + cls + '" data-key="' + col.key + '" value="' + String(v).replace(/"/g, '&quot;') + '" placeholder="email@company.com">';
    }
    return '<input type="text" class="' + cls + '" data-key="' + col.key + '" value="' + String(v).replace(/"/g, '&quot;') + '">';
  }

  function fneBulkRowActionsHtml(isFirst) {
    let html = '<td class="fne-bulk-row-actions">' +
      '<button type="button" class="fne-bulk-copy" onclick="fneBulkCopyRowAbove(this)" title="Copy values from row above"' +
      (isFirst ? ' disabled' : '') + '>↑</button>';
    if (!fneBulkIsEdit()) {
      html += '<button type="button" class="fne-bulk-del" onclick="fneBulkRemoveRow(this)" title="Remove row">×</button>';
    }
    return html + '</td>';
  }

  function fneBulkReadRowData(tr) {
    const data = {};
    if (!tr) return data;
    if (tr.dataset.recordId) data._id = tr.dataset.recordId;
    else {
      const idEl = tr.querySelector('.fne-bulk-id');
      if (idEl && idEl.value) data._id = idEl.value;
    }
    fneBulkTableCols().forEach(col => {
      const el = tr.querySelector('[data-key="' + col.key + '"]');
      data[col.key] = el ? String(el.value || '').trim() : '';
    });
    return data;
  }

  function fneBulkApplyRowData(tr, data) {
    if (!tr || !data) return;
    fneBulkTableCols().forEach(col => {
      if (col.readonly) return;
      const el = tr.querySelector('[data-key="' + col.key + '"]');
      if (!el || data[col.key] === undefined) return;
      el.value = data[col.key] || '';
    });
    fneBulkRecalcRowTcv(tr);
  }

  function fneBulkRenumberRows() {
    const body = fneBulkEl('body');
    if (!body) return;
    [...body.rows].forEach((row, i) => {
      row.cells[0].textContent = i + 1;
      const copyBtn = row.querySelector('.fne-bulk-copy');
      if (copyBtn) copyBtn.disabled = i === 0;
    });
  }

  function fneBulkRenderHead() {
    const head = fneBulkEl('head');
    if (!head) return;
    let html = '<tr><th style="width:36px;">#</th>';
    if (fneBulkIsEdit()) html += '<th style="width:56px;">ID</th>';
    html += fneBulkTableCols().map(c =>
      c.readonly
        ? '<th>' + c.label + '<span class="fne-bulk-auto-tag">Auto-calculated</span></th>'
        : '<th>' + c.label + '</th>'
    ).join('') +
      '<th style="width:' + (fneBulkIsEdit() ? '48' : '72') + 'px;">Actions</th></tr>';
    head.innerHTML = html;
  }

  function fneBulkAddRow(data) {
    const body = fneBulkEl('body');
    if (!body) return;
    const tr = document.createElement('tr');
    if (data && data._id) tr.dataset.recordId = String(data._id);
    let html = '<td style="color:var(--t3);font-weight:700;text-align:center;">1</td>';
    if (fneBulkIsEdit()) {
      const idVal = data && data._id ? String(data._id) : '';
      html += '<td><input type="text" class="fne-bulk-cell fne-bulk-id" readonly tabindex="-1" value="' + idVal + '"></td>';
    }
    html += fneBulkTableCols().map(col => '<td>' + fneBulkCellHtml(col, data ? data[col.key] : '') + '</td>').join('') +
      fneBulkRowActionsHtml(body.rows.length === 0);
    tr.innerHTML = html;
    body.appendChild(tr);
    fneBulkWireRowCalc(tr);
    fneBulkWireVerticalDirector(tr);
    fneBulkRenumberRows();
    fneBulkUpdateRowCount();
  }

  function fneBulkAddRowCopyLast() {
    if (fneBulkIsEdit()) return;
    const body = fneBulkEl('body');
    if (!body || !body.rows.length) { fneBulkAddRow(); return; }
    const last = body.rows[body.rows.length - 1];
    fneBulkAddRow(fneBulkStripAutoCalc(fneBulkReadRowData(last)));
  }

  function fneBulkCopyRowAbove(btn) {
    const tr = btn.closest('tr');
    const prev = tr && tr.previousElementSibling;
    if (!tr || !prev) return;
    fneBulkApplyRowData(tr, fneBulkReadRowData(prev));
    const vEl = tr.querySelector('[data-key="vertical"]');
    const dEl = tr.querySelector('[data-key="accountDirector"]');
    if (vEl && dEl && vEl.value && !dEl.value) fneSetDirectorForVertical(vEl.value, dEl);
  }

  function fneBulkRemoveRow(btn) {
    if (fneBulkIsEdit()) return;
    const body = fneBulkEl('body');
    if (!body || body.rows.length <= 1) {
      fneToast('At least one row is required', 'error');
      return;
    }
    const tr = btn.closest('tr');
    if (tr) tr.remove();
    fneBulkRenumberRows();
    fneBulkUpdateRowCount();
  }

  function fneBulkUpdateRowCount() {
    const el = fneBulkEl('count');
    const n = fneBulkEl('body')?.rows.length || 0;
    if (el) el.textContent = n + ' row' + (n !== 1 ? 's' : '');
  }

  function fneBulkClearTable() {
    fneBulkSetCtx('new');
    const body = fneBulkEl('body');
    if (body) body.innerHTML = '';
    fneBulkAddRow();
    const st = fneBulkEl('status');
    if (st) st.textContent = '';
  }

  function fneBulkInitTable(ctx) {
    fneBulkSetCtx(ctx || 'new');
    fneBulkRenderHead();
    if (!FNE_BULK_TABLE_READY) {
      Object.values(FNE_BULK_TABLE_IDS).forEach(ids => {
        const wrap = document.getElementById(ids.wrap);
        if (wrap) wrap.addEventListener('paste', fneBulkHandlePaste);
      });
      FNE_BULK_TABLE_READY = true;
    }
    if (fneBulkIsEdit()) return;
    const body = fneBulkEl('body');
    if (body && !body.rows.length) fneBulkClearTable();
    else fneBulkUpdateRowCount();
  }

  function fneBulkReadAllRows() {
    const body = fneBulkEl('body');
    if (!body) return [];
    const isEdit = fneBulkIsEdit();
    const rows = [];
    [...body.rows].forEach((tr, i) => {
      const rec = { _line: i + 1, _errors: [] };
      let hasAny = false;
      if (isEdit) {
        rec._id = tr.dataset.recordId || tr.querySelector('.fne-bulk-id')?.value || '';
        if (!rec._id) rec._errors.push('Record ID missing');
      }
      fneBulkTableCols().forEach(col => {
        const el = tr.querySelector('[data-key="' + col.key + '"]');
        const val = el ? String(el.value || '').trim() : '';
        rec[col.key] = val;
        if (!col.readonly && val) hasAny = true;
        if (col.readonly) return;
        if (col.required && !val) rec._errors.push(col.label.replace(' *', '') + ' required');
        if (col.type === 'date' && val) {
          const parsed = fneParseImportDate(val);
          if (!parsed) rec._errors.push(col.label + ' invalid date');
          else {
            rec[col.key + '_iso'] = parsed;
            if (col.noFuture && fneIsFutureDate(parsed)) rec._errors.push(col.label + ' cannot be future');
          }
        }
      });
      if (isEdit || hasAny) rows.push(rec);
    });
    return rows;
  }

  function fneBulkHandlePaste(e) {
    const wrap = e.currentTarget;
    fneBulkSetCtx(wrap && wrap.id === 'fneBulkEditTableWrap' ? 'edit' : 'new');
    const text = e.clipboardData && e.clipboardData.getData('text');
    if (!text || text.indexOf('\t') < 0) return;
    e.preventDefault();
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (!lines.length) return;
    const body = fneBulkEl('body');
    if (!body) return;

    let startRow = 0;
    const active = document.activeElement;
    const bodyId = fneBulkBodyId();
    if (active && active.closest && active.closest('#' + bodyId + ' tr')) {
      startRow = [...body.rows].indexOf(active.closest('tr'));
      if (startRow < 0) startRow = 0;
    }

    if (!fneBulkIsEdit()) {
      while (body.rows.length < startRow + lines.length) fneBulkAddRow();
    } else {
      if (startRow + lines.length > body.rows.length) lines.splice(body.rows.length - startRow);
    }

    lines.forEach((line, li) => {
      const cells = line.split('\t').map(c => c.trim());
      const tr = body.rows[startRow + li];
      if (!tr) return;
      let colOffset = 0;
      if (fneBulkIsEdit() && cells[0] && /^\d+$/.test(cells[0])) colOffset = 1;
      fneBulkTableCols().forEach((col, ci) => {
        if (col.readonly) return;
        const cellIdx = ci + colOffset;
        if (cellIdx >= cells.length) return;
        const el = tr.querySelector('[data-key="' + col.key + '"]');
        if (!el) return;
        if (col.type === 'date') {
          const parsed = fneParseImportDate(cells[cellIdx]);
          el.value = parsed || cells[cellIdx];
        } else {
          el.value = cells[cellIdx];
        }
      });
    });
    fneBulkUpdateRowCount();
    [...body.rows].forEach(tr => fneBulkRecalcRowTcv(tr));
    fneToast('Pasted ' + lines.length + ' row(s) from Excel', 'success');
  }

  function fneEnsureUserId(email, cb) {
    const amEmail = String(email || '').trim();
    if (!amEmail) { cb(null); return; }
    getDigest(function(digest) {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', FNE_SP + '/_api/web/ensureuser', true);
      xhr.setRequestHeader('Accept', 'application/json;odata=verbose');
      xhr.setRequestHeader('Content-Type', 'application/json;odata=verbose');
      if (digest) xhr.setRequestHeader('X-RequestDigest', digest);
      xhr.onreadystatechange = function() {
        if (xhr.readyState !== 4) return;
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            cb(JSON.parse(xhr.responseText).d.Id);
          } catch (e) { cb(null); }
        } else {
          console.warn('[FNE] ensureUser failed for:', amEmail, xhr.status);
          cb(null);
        }
      };
      xhr.send(JSON.stringify({ logonName: amEmail }));
    });
  }

  function fneBulkUploadAll() {
    if (!fneIsAdmin()) return;
    fneBulkSetCtx('new');
    const rows = fneBulkReadAllRows();
    const st = fneBulkEl('status');
    if (!rows.length) {
      fneToast('Add at least one row with data', 'error');
      return;
    }
    const valid = rows.filter(r => !r._errors.length);
    const invalid = rows.length - valid.length;
    if (!valid.length) {
      if (st) st.textContent = 'Fix errors before upload. First issue: ' + (rows[0]._errors[0] || 'unknown');
      fneToast('No valid rows — check required fields', 'error');
      return;
    }
    if (!confirm('Create ' + valid.length + ' new record(s)?' + (invalid ? ' (' + invalid + ' row(s) skipped due to errors)' : ''))) return;

    const url = FNE_SP + "/_api/web/lists/getbytitle('" + encodeURIComponent(FNE_LIST) + "')/items";
    let done = 0, failed = 0;

    function createNext(i) {
      if (i >= valid.length) {
        const msg = 'Uploaded ' + done + ' record(s)' + (failed ? ', ' + failed + ' failed' : '');
        if (st) st.textContent = msg;
        fneToast(msg, failed ? 'error' : 'success');
        fneLoadList();
        if (done > 0) fneBulkClearTable();
        return;
      }
      if (st) st.textContent = 'Uploading ' + (i + 1) + ' / ' + valid.length + '…';
      const rec = valid[i];
      const body = fneBuildImportSpBody(rec);
      fneEnsureUserId(rec.amEmail, function(amUserId) {
        if (amUserId) body['Account_x0020_ManagerId'] = amUserId;
        spPost(url, body, function(err) {
          if (err) failed++; else done++;
          createNext(i + 1);
        });
      });
    }
    createNext(0);
  }

  function fneBulkEditOpen() {
    if (!fneIsAdmin()) {
      fneToast('You do not have permission to bulk edit records', 'error');
      return;
    }
    const selected = fneGetSelectedGridRows();
    if (!selected.length) {
      fneToast('Select at least one row using the checkboxes on the left', 'error');
      return;
    }
    fneBulkSetCtx('edit');
    fneBulkInitTable('edit');
    const body = fneBulkEl('body');
    if (body) body.innerHTML = '';
    selected.forEach(row => fneBulkAddRow(fneGridRowToBulkEdit(row)));
    const st = fneBulkEl('status');
    if (st) st.textContent = selected.length + ' record(s) loaded — edit and click Update All';
    const title = document.getElementById('fneBulkEditTitle');
    if (title) title.textContent = 'Bulk Edit — ' + selected.length + ' record(s)';
    const modal = document.getElementById('fneBulkEditModal');
    if (modal) modal.classList.add('open');
  }

  function fneBulkEditClose() {
    const modal = document.getElementById('fneBulkEditModal');
    if (modal) modal.classList.remove('open');
    const editBody = document.getElementById('fneBulkEditTableBody');
    if (editBody) editBody.innerHTML = '';
    const st = document.getElementById('fneBulkEditStatus');
    if (st) st.textContent = '';
    fneBulkSetCtx('new');
  }

  function fneMergeSpItem(itemId, body, cb) {
    const url = FNE_SP + "/_api/web/lists/getbytitle('" + encodeURIComponent(FNE_LIST) +
      "')/items(" + itemId + ")";
    getDigest(function(digest) {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.setRequestHeader('Accept', 'application/json;odata=verbose');
      xhr.setRequestHeader('Content-Type', 'application/json;odata=verbose');
      xhr.setRequestHeader('X-HTTP-Method', 'MERGE');
      xhr.setRequestHeader('IF-MATCH', '*');
      if (digest) xhr.setRequestHeader('X-RequestDigest', digest);
      xhr.onreadystatechange = function() {
        if (xhr.readyState !== 4) return;
        cb(xhr.status >= 200 && xhr.status < 300 ? null : new Error('HTTP ' + xhr.status));
      };
      xhr.send(JSON.stringify(body));
    });
  }

  function fneBulkEditSaveAll() {
    if (!fneIsAdmin()) return;
    fneBulkSetCtx('edit');
    const rows = fneBulkReadAllRows();
    const st = document.getElementById('fneBulkEditStatus');
    if (!rows.length) {
      fneToast('No records to update', 'error');
      return;
    }
    const valid = rows.filter(r => !r._errors.length);
    const invalid = rows.length - valid.length;
    if (!valid.length) {
      if (st) st.textContent = 'Fix errors before update. First issue: ' + (rows[0]._errors[0] || 'unknown');
      fneToast('No valid rows — check required fields', 'error');
      return;
    }
    if (!confirm('Update ' + valid.length + ' record(s)?' + (invalid ? ' (' + invalid + ' row(s) skipped due to errors)' : ''))) return;

    let done = 0, failed = 0;

    function updateNext(i) {
      if (i >= valid.length) {
        const msg = 'Updated ' + done + ' record(s)' + (failed ? ', ' + failed + ' failed' : '');
        if (st) st.textContent = msg;
        fneToast(msg, failed ? 'error' : 'success');
        fneLoadList();
        if (done > 0) fneBulkEditClose();
        return;
      }
      if (st) st.textContent = 'Updating ' + (i + 1) + ' / ' + valid.length + '…';
      const rec = valid[i];
      const body = fneBuildImportSpBody(rec);
      fneEnsureUserId(rec.amEmail, function(amUserId) {
        if (amUserId) body['Account_x0020_ManagerId'] = amUserId;
        fneMergeSpItem(rec._id, body, function(err) {
          if (err) failed++; else done++;
          updateNext(i + 1);
        });
      });
    }
    updateNext(0);
  }

  // Shared import helpers (dates + SP body)
  function fneParseImportDate(val) {
    if (!val) return null;
    const s = String(val).trim();
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const dmY = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (dmY) {
      let y = parseInt(dmY[3], 10);
      if (y < 100) y += 2000;
      const d = new Date(y, parseInt(dmY[2], 10) - 1, parseInt(dmY[1], 10));
      if (!isNaN(d)) return d.toISOString().split('T')[0];
    }
    const d = new Date(s);
    if (!isNaN(d)) return d.toISOString().split('T')[0];
    return null;
  }

  function fneBuildImportSpBody(rec) {
    const gn = v => { const n = parseFloat(v); return isNaN(n) ? null : n; };
    const body = {
      '__metadata': { 'type': FNE_LIST_ITEM_TYPE },
      [FNE_F.CUST_NAME]:    String(rec.customerName || '').trim(),
      [FNE_F.REQ_STATUS]:   String(rec.requestStatus || '').trim(),
      [FNE_F.IMPL_TYPE]:    String(rec.implType || '').trim(),
      [FNE_F.BUILD_STATUS]: String(rec.buildingStatus || '').trim(),
      [FNE_F.VERTICAL]:     String(rec.vertical || '').trim(),
      [FNE_F.FNE_MGR]:      String(rec.fneManager || '').trim(),
    };
    FNE_IMPORT_COLUMNS.forEach(col => {
      if (col.required) return;
      if (col.key === 'criticalProjects' && !fneIsPowerUser()) return;
      const raw = rec[col.key];
      if (!String(raw || '').trim()) return;
      if (col.type === 'date') {
        const iso = rec[col.key + '_iso'] || fneParseImportDate(raw);
        if (iso) body[col.sp()] = new Date(iso).toISOString();
        return;
      }
      if (col.type === 'number') body[col.sp()] = gn(raw);
      else if (col.key === 'gaid') body[col.sp()] = String(raw).replace(/<[^>]*>/g, '').trim();
      else body[col.sp()] = String(raw).trim();
    });
    const mrc = gn(rec.mrc), otc = gn(rec.otc), dur = gn(rec.contractDuration);
    if (mrc !== null || otc !== null || dur !== null) {
      body[FNE_F.TCV] = (dur || 0) * (mrc || 0) + (otc || 0);
    }
    return body;
  }

  // ══════════════════════════════════════════════════════════════════
  //  AG GRID RENDER
  // ══════════════════════════════════════════════════════════════════
  function fneRenderGrid(data) {
    if (typeof agGrid === 'undefined') return;
  
    const countEl = document.getElementById('fneListCount');
    const rfsMigHint = fneGetRfsMigrationFilter();
    if (countEl) {
      let txt = data.length + ' record' + (data.length !== 1 ? 's' : '');
      if (rfsMigHint === 'approaching') txt += ' · Target Migration: Approaching';
      else if (rfsMigHint === 'overdue') txt += ' · Target Migration: Overdue';
      countEl.textContent = txt;
    }
  
    const fmt2  = v => { const n = parseFloat(v); if (isNaN(n)) return '—'; if (n >= 1e6) return (n/1e6).toFixed(2)+'M'; if (n >= 1e3) return (n/1e3).toFixed(1)+'K'; return n.toFixed(0); };
    const fmtD  = iso => { if (!iso) return '—'; const d = new Date(iso); return isNaN(d) ? '—' : d.toLocaleDateString('en-GB'); };
  
    const statusBadge = v => {
      const map = { 'Completed':'badge-success', 'In Progress':'badge-info', 'Inprogress':'badge-info', 'On Hold':'badge-warning', 'Cancelled':'badge-danger' };
      return `<span class="status-badge ${map[v]||'badge-neutral'}">${v||'—'}</span>`;
    };
    const buildBadge = v => {
      const map = { 'RFS':'badge-success', 'Partial RFS':'badge-warning', 'Not Connected':'badge-danger' };
      return `<span class="status-badge ${map[v]||'badge-neutral'}">${v||'—'}</span>`;
    };
    const healthBadge = v => {
  const map = {
    'Green': 'badge-success',
    'Amber': 'badge-warning',
    'Red': 'badge-danger',
    'No Expected RFS to calculate Project Health': 'badge-neutral'
  };
  return `<span class="status-badge ${map[v] || 'badge-neutral'}">${v || '—'}</span>`;
};
  
    const editBtn = params => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'fne-btn fne-btn-secondary';
      btn.style.cssText = 'padding:.25rem .75rem;font-size:.72rem;';
      btn.innerHTML = '<svg style="width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit';
      btn.onclick = () => {
        fneOpenForm(params.data.id, true);
        showFneView('form', document.getElementById('navFneForm'));
      };
      return btn;
    };

    const adminUser = fneIsAdmin();
    const canSelectRows = adminUser || fneIsPowerUser();
    const cols = [];

    if (canSelectRows) {
      cols.push({
        colId: 'fne_select',
        headerName: '',
        width: 48,
        minWidth: 48,
        maxWidth: 48,
        pinned: 'left',
        lockPosition: 'left',
        suppressMovable: true,
        sortable: false,
        filter: false,
        resizable: false,
        checkboxSelection: true,
        headerCheckboxSelection: true,
        headerCheckboxSelectionFilteredOnly: true,
        suppressHeaderMenuButton: true,
        showDisabledCheckboxes: true,
        cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
      });
    }

    if (fneIsPowerUser()) {
      cols.push({
        colId: 'fne_reminder',
        headerName: 'Send Reminder',
        width: 130,
        minWidth: fneHeaderMinWidth('Send Reminder'),
        maxWidth: 150,
        pinned: 'left',
        lockPosition: 'left',
        suppressMovable: true,
        sortable: false,
        filter: false,
        resizable: false,
        suppressHeaderMenuButton: true,
        wrapHeaderText: true,
        autoHeaderHeight: true,
        cellRenderer: fneReminderCellRenderer,
        cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
      });
    }

    cols.push(
    {
  headerName: '✏',
  width: 72,
  sortable: false,
  filter: false,
  pinned: 'left',
  suppressSizeToFit: true,
  cellRenderer: params => adminUser ? editBtn(params) : null
},
      { field: 'id',              headerName: 'ID',             width: 70,  minWidth: 70,  maxWidth: 80,  type: 'numericColumn', pinned: 'left', suppressSizeToFit: true },
      { field: 'fneManager',      headerName: 'FNE Manager',    width: 150, minWidth: 130, pinned: 'left' },
      { field: 'customerName',    headerName: 'Customer Name',  width: 200, minWidth: 160 },
      { field: 'requestStatus',   headerName: 'Request Status', width: 140, minWidth: 130, cellRenderer: p => statusBadge(p.value) },
      { field: 'projectHealth',   headerName: 'Project Health', width: 130, minWidth: 120, cellRenderer: p => healthBadge(p.value) },
      { field: 'buildingStatus',  headerName: 'Building Status',width: 145, minWidth: 130, cellRenderer: p => buildBadge(p.value) },
      { field: 'fesRef',          headerName: 'FES / Shortfall Ref', width: 175, minWidth: 165 },
      { field: 'vertical',        headerName: 'Vertical',       width: 100, minWidth: 90  },
      { field: 'implType',        headerName: 'Implementation Type', width: 175, minWidth: 165 },
      { field: 'subRequest',      headerName: 'Request Type',   width: 165, minWidth: 140 },
      { field: 'projectType',     headerName: 'Connectivity Type', width: 155, minWidth: 145 },
      { field: 'accountDirector', headerName: 'Account Director', width: 165, minWidth: 150 },
      { field: 'amName',          headerName: 'Account Manager',  width: 165, minWidth: 150 },
      { field: 'assignedBy',      headerName: 'Assigned By',    width: 145, minWidth: 130 },
      { field: 'sla',             headerName: 'SLA (days)',     width: 110, minWidth: 100, type: 'numericColumn' },
      { field: 'mrc',             headerName: 'MRC',            width: 115, minWidth: 90,  type: 'numericColumn', valueFormatter: p => fmt2(p.value) },
      { field: 'otc',             headerName: 'OTC',            width: 115, minWidth: 90,  type: 'numericColumn', valueFormatter: p => fmt2(p.value) },
      { field: 'tcv',             headerName: 'TCV',            width: 125, minWidth: 100, type: 'numericColumn', valueFormatter: p => fmt2(p.value), cellStyle: { fontWeight: '700', color: 'var(--acc)' } },
      { field: 'contractDuration',headerName: 'Duration (mo)', width: 130, minWidth: 120, type: 'numericColumn' },
      { field: 'estimatedCost',   headerName: 'Estimated Cost', width: 130, minWidth: 120, type: 'numericColumn', valueFormatter: p => fmt2(p.value) },
      { field: 'pmManDays',       headerName: 'Project Duration', width: 150, minWidth: 140 },
      { field: 'startDate',       headerName: 'Received Date',  width: 140, minWidth: 130, valueFormatter: p => fmtD(p.value) },
      { field: 'expectedRFS',     headerName: 'Expected RFS Date', width: 155, minWidth: 145, valueFormatter: p => fmtD(p.value) },
      { field: 'rfsBaseline',     headerName: 'Actual RFS Date',width: 150, minWidth: 140, valueFormatter: p => fmtD(p.value) },
      { field: 'implStart',       headerName: 'Implementation Start', width: 165, minWidth: 155, valueFormatter: p => fmtD(p.value) },
      { field: 'targetMigDate',   headerName: 'Target Migration Date', width: 175, minWidth: 165, valueFormatter: p => fmtD(p.value) },
      { field: 'tempConnType',    headerName: 'Temporary Connection Type',width: 195, minWidth: 185 },
      { field: 'blocker',         headerName: 'Blocker',        width: 120, minWidth: 100 },
      { field: 'criticalProjects',headerName: 'Critical Project', width: 140, minWidth: 130 },
      { field: 'sof',             headerName: 'SOF',            width: 90,  minWidth: 80  },
      { field: 'ospRequired',     headerName: 'OSP Civil',      width: 110, minWidth: 100  },
      { field: 'ospCivilET',      headerName: 'OSP Civil ET (days)', width: 155, minWidth: 145, type: 'numericColumn' },
      { field: 'gaid',            headerName: 'GAID',           width: 130, minWidth: 110 },
      { field: 'woNumber',        headerName: 'WO Number',      width: 130, minWidth: 120 },
      { field: 'bidRef',          headerName: 'Bid Reference',  width: 135, minWidth: 125 },
      { field: 'siteRef',         headerName: 'Site Survey Reference',width: 185, minWidth: 175 },
      { field: 'accountCode',     headerName: 'Account Code',   width: 125, minWidth: 115, type: 'numericColumn' },
      { field: 'unitNo',          headerName: 'Unit Number',    width: 120, minWidth: 110, type: 'numericColumn' },
      { field: 'customerAddress', headerName: 'Customer Address', width: 220, minWidth: 170 },
      { field: 'commentsNew',     headerName: 'Comments',       width: 250, minWidth: 120 },
      { field: 'year',            headerName: 'Year',           width: 90,  minWidth: 80,  type: 'numericColumn' },
    );
    const enhancedCols = cols.map(col => col.colId === 'fne_select' ? col : fneEnhanceColDef(col));
  
    if (FNE_GRID_API) { try { FNE_GRID_API.destroy(); } catch(e) {} FNE_GRID_API = null; }
    const gridEl = document.getElementById('fneGrid');
    if (!gridEl) return;
    gridEl.innerHTML = '';
  
    FNE_GRID_API = agGrid.createGrid(gridEl, {
      columnDefs: enhancedCols,
      rowData: data,
      defaultColDef: {
        sortable: true,
        filter: true,
        resizable: true,
        wrapHeaderText: true,
        autoHeaderHeight: true,
        suppressSizeToFit: false,
        cellStyle: { display: 'flex', alignItems: 'center' },
      },
      rowSelection: canSelectRows ? 'multiple' : undefined,
      suppressRowClickSelection: true,
      isRowSelectable: () => canSelectRows,
      pagination: true,
      paginationPageSize: 50,
      paginationPageSizeSelector: [25, 50, 100, 250],
      rowHeight: 46,
      headerHeight: 56,
      animateRows: true,
      enableCellTextSelection: true,
      suppressColumnVirtualisation: false,
      onGridReady: p => {
        FNE_GRID_API = p.api;
        fneUpdateBulkSelectionCount();
        setTimeout(() => {
          p.api.autoSizeColumns(['fneManager','customerName','fesRef','amName','accountDirector'], false);
        }, 150);
      },
      onSelectionChanged: () => fneUpdateBulkSelectionCount(),
    });
  }
  
  // ══════════════════════════════════════════════════════════════════
  //  EXPORT EXCEL
  // ══════════════════════════════════════════════════════════════════
  function fneExportExcel() {
    const data  = FNE_LIST_DATA;
    const cols  = ['id','fneManager','amName','customerName','subRequest','implType','projectType',
                    'vertical','accountDirector','requestStatus','projectHealth','buildingStatus','sla',
                    'mrc','otc','tcv','contractDuration','estimatedCost','pmManDays','startDate','expectedRFS',
                    'rfsBaseline','implStart','targetMigDate','tempConnType','blocker','criticalProjects','sof','ospRequired',
                    'ospCivilET','gaid','woNumber','bidRef','fesRef','siteRef','accountCode','unitNo',
                    'customerAddress','commentsNew','year'];
    const hdrs  = ['ID','FNE Manager','Account Manager','Customer Name','Request Type','Implementation Type','Connectivity Type',
                    'Vertical','Account Director','Request Status','Project Health','Building Status','SLA (days)','MRC','OTC','TCV',
                    'Duration (mo)','Estimated Cost','Project Duration','Received Date','Expected RFS Date','Actual RFS Date','Implementation Start','Target Migration Date',
                    'Temporary Connection Type','Blocker','Critical Project','SOF','OSP Civil','OSP Civil ET (days)','GAID','WO Number','Bid Reference','FES / Shortfall Ref',
                    'Site Survey Reference','Account Code','Unit Number','Customer Address','Comments','Year'];
    const fmt2  = v => { const n=parseFloat(v); if(isNaN(n))return'—'; if(n>=1e6)return(n/1e6).toFixed(2)+'M'; if(n>=1e3)return(n/1e3).toFixed(1)+'K'; return n.toFixed(0); };
    const fmtD  = iso => { if(!iso)return'—'; const d=new Date(iso); return isNaN(d)?'—':d.toLocaleDateString('en-GB'); };
    const numFlds  = new Set(['mrc','otc','tcv','estimatedCost','ospCivilET']);
    const dateFlds = new Set(['startDate','expectedRFS','rfsBaseline','implStart','targetMigDate']);
  
    let html = '<html><head><meta charset="utf-8"></head><body><table border="1" cellpadding="4" cellspacing="0">';
    html += '<tr>' + hdrs.map(h => `<th style="background:#2563eb;color:white;font-weight:bold;padding:10px;">${h}</th>`).join('') + '</tr>';
    data.forEach((row, i) => {
      const bg = i % 2 === 0 ? '#f8faff' : '#ffffff';
      html += '<tr>' + cols.map(c => {
        let v = row[c];
        if (v === undefined || v === null) v = '—';
        if (numFlds.has(c))  v = fmt2(v);
        if (dateFlds.has(c)) v = fmtD(v);
        return `<td style="background:${bg};padding:8px;">${v}</td>`;
      }).join('') + '</tr>';
    });
    html += '</table></body></html>';
  
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = 'FNE_Tracker_' + new Date().toISOString().split('T')[0] + '.xls';
    a.click();
  }
  
  // ══════════════════════════════════════════════════════════════════
  //  TOAST NOTIFICATION
  // ══════════════════════════════════════════════════════════════════
  function fneToast(msg, type = 'success') {
    let toast = document.getElementById('fneToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'fneToast';
      toast.className = 'fne-toast';
      document.body.appendChild(toast);
    }
    const icon = type === 'success'
      ? '<svg style="width:18px;height:18px;stroke:#16a34a;fill:none;stroke-width:2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>'
      : '<svg style="width:18px;height:18px;stroke:#dc2626;fill:none;stroke-width:2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
    toast.innerHTML = icon + msg;
    toast.className = 'fne-toast ' + type;
    requestAnimationFrame(() => { toast.classList.add('show'); });
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { toast.classList.remove('show'); }, 3500);
  }
  
  // ══════════════════════════════════════════════════════════════════
  //  FETCH LIST ITEM TYPE
  // ══════════════════════════════════════════════════════════════════
  function fneFetchListItemType(callback) {
    const url = FNE_SP + "/_api/web/lists/getbytitle('" +
      encodeURIComponent(FNE_LIST) + "')?$select=ListItemEntityTypeFullName";
    spGet(url, function(err, data) {
      if (!err && data && data.d && data.d.ListItemEntityTypeFullName) {
        FNE_LIST_ITEM_TYPE = data.d.ListItemEntityTypeFullName;
      } else {
        // fallback — construct manually
        FNE_LIST_ITEM_TYPE = 'SP.Data.FNE_x0020_Tracker_x0020_GKLA_x0020_23_x002d_24ListItem';
        console.warn('[FNE] Could not fetch list item type, using fallback');
      }
      if (callback) callback();
    });
  }
  
  
  function fneInit() {
    fneInjectViews();
    fneInjectNav();
    fneStartBannerClock();
    fneFetchListItemType();
  
    // Wire health recalc for new form fields on change
    setTimeout(() => {
      fneSetActualRfsMaxDate();
      fneApplyCriticalProjectsAccess();
      document.addEventListener('click', function(e) {
        if (!e.target.closest('.ms-wrap')) {
          document.querySelectorAll('.ms-dropdown.open').forEach(function(d) { d.classList.remove('open'); });
          document.querySelectorAll('.ms-trigger.open').forEach(function(t) { t.classList.remove('open'); });
        }
      });
      const rfsEl = document.getElementById('fne_rfs_baseline');
      if (rfsEl) {
        rfsEl.addEventListener('change', function() {
          if (fneIsFutureDate(rfsEl.value)) {
            fneToast('Actual RFS Date cannot be in the future', 'error');
            rfsEl.value = '';
          }
          fneCalcHealth();
        });
      }
      ['fne_exp_rfs','fne_build_status','fne_req_status'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', fneCalcHealth);
      });
    }, 500);
  }
  
  // ── Expose globals ──────────────────────────────────────────────
  window.fneOpenForm        = fneOpenForm;
  window.fneResetForm       = fneResetForm;
  window.fneCancelForm      = fneCancelForm;
  window.fneSave            = fneSave;
  window.fneDeleteItem      = fneDeleteItem;
  window.fneLoadList        = fneLoadList;
  window.fneListApplyFilter = fneListApplyFilter;
  window.fneListReset       = fneListReset;
  window.fneExportExcel     = fneExportExcel;
  window.fneSetEntryMode     = fneSetEntryMode;
  window.fneBulkAddRow       = fneBulkAddRow;
  window.fneBulkAddRowCopyLast = fneBulkAddRowCopyLast;
  window.fneBulkCopyRowAbove = fneBulkCopyRowAbove;
  window.fneBulkRemoveRow    = fneBulkRemoveRow;
  window.fneBulkClearTable   = fneBulkClearTable;
  window.fneBulkUploadAll    = fneBulkUploadAll;
  window.fneBulkEditOpen     = fneBulkEditOpen;
  window.fneBulkEditClose    = fneBulkEditClose;
  window.fneBulkEditSaveAll  = fneBulkEditSaveAll;
  window.fneBulkDeleteSelected = fneBulkDeleteSelected;
  window.showFneView        = showFneView;
  window.fneTcvCalc         = fneTcvCalc;
  window.fneInit            = fneInit;
  window.fneIsPowerUser     = fneIsPowerUser;
  window.fneEnsurePowerUserUi = fneEnsurePowerUserUi;
  window.fneGetRfsMigrationFilter = fneGetRfsMigrationFilter;
  window.fneOpenRfsReminder = fneOpenRfsReminder;
  window.fneRfsAlertKind    = fneRfsAlertKind;
  window.fneIsApproachingRfs = fneIsApproachingRfs;
  window.fneIsOverdueRfs    = fneIsOverdueRfs;
  window.fneReminderCellRenderer = fneReminderCellRenderer;
  window.fneToggleListMs    = fneToggleListMs;
  window.fneOnListMsChange  = fneOnListMsChange;
  window.fneApplyHeaderSizing = fneApplyHeaderSizing;
  window.fneHeaderMinWidth = fneHeaderMinWidth;
  window.fneHandleAttachDrop = fneHandleAttachDrop;
  window.fneRemovePendingAttach  = fneRemovePendingAttach;
  window.fneRemoveExistingAttach = fneRemoveExistingAttach;
  window.fneHtmlToPlain     = fneHtmlToPlain;
  window.FNE_GRID_API       = null;
