/* ═══════════════════════════════════════════════════════
   FM.JS — FreeMove Leads Portal
   Site: http://sharedspaces:8086/sites/FM
   Lists: FM_Leads, FM_Activities
   ═══════════════════════════════════════════════════════ */

'use strict';

/* ── CONFIG ─────────────────────────────────────────── */
const FM_CONFIG = {
  DUMMY_MODE: false,
  SITE_URL:   '/sites/FM',
  LIST_LEADS:  'FM_Leads',
  LIST_ACT:    'FM_Activities',
  LIST_ACCESS: 'FM_Access_Marix',
  ACCESS_CONTACTS: ['Tehleel.Lone@du.ae', 'Abdul.Karim3@du.ae'],
  // Dummy login — switch values to test different roles locally.
  // Examples:
  //   Admin    → name:'Tehleel Lone',  email:'tehleel.lone@du.ae', role:'Admin'
  //   Director → name:'Abdul Karim',   email:'abdul.karim3@du.ae', role:'Director'
  //   AM       → name:'Ali Hassan',    email:'ali.hassan@du.ae',   role:'Account Manager'
  DUMMY_USER: { name:'Tehleel Lone', email:'tehleel.lone@du.ae', role:'Admin' },
  /**
   * Legacy only: set true if Number/Currency columns were created as Single line of text.
   * Production FM_Leads uses real Number/Currency — keep false.
   */
  SP_REST_LEAD_STRINGIFY_NUMBERS: false,
};

/* ── ROLE CONSTANTS ─────────────────────────────────── */
var FM_ROLES = {
  ADMIN:    'Admin',
  DIRECTOR: 'Director',
  AM:       'Account Manager',
  NONE:     'None',
};

/* ── GLOBAL STATE ────────────────────────────────────── */
let FM = {
  allLeads:      [],
  allActivities: [],
  scopedLeads:      [],
  scopedActivities: [],
  filteredLeads:    [],
  charts:        {},
  currentUser:   { name: 'FM User', email: 'fm.user@du.ae', initials: 'FM' },
  leadCounter:   1,

  filters: {
    period:   'thisquarter',
    status:   ['all'],
    imp:      ['all'],
    director: ['all'],
    am:       ['all'],
    account:  ['all'],

    mlStatus: ['all'],
    mlImp:    ['all'],
    mlDir:    ['all'],
    mlAM:     ['all'],
    mlAcct:   ['all'],
    mlOwner:  'all',
    mlSearch: '',

    alLead:   'all',
    alType:   'all',
    alUser:   'all',
    alDir:    'all',
    alPeriod: 'all',
  },

  chartTabs: {
    overview: 'status',
    winloss:  'wl',
    director: 'lb',
    am:       'amlb',
    perf:     'director',
  },

  /** DIP-style chart periods for overview toggles */
  fmTrendPeriod: 'M',
  fmAvcPeriod:   'M',

  grid: {
    leads: null, // { api, columnApi }
  },

  /** SharePoint list item Id when editing; null when creating a new lead */
  editingLeadItemId: null,
  /** SP item Id when Quick Update modal is open */
  modalLeadSpId: null,
};

/* ── USER CONTEXT ─────────────────────────────────── */
var USER_CONTEXT = {
  userName:  '',
  userEmail: '',
  role:      FM_ROLES.NONE,
  hasAccess: false,
  isAdmin:   false,
  isDirector:false,
  isAM:      false,
};
window.USER_CONTEXT = USER_CONTEXT;

/* ── LEAD ID / DATE HELPERS ─────────────────────────── */
function getLeadIdYear() {
  return String(new Date().getFullYear());
}

function getLeadSeqStorageKey(year) {
  return 'fmLeadSeq-' + year;
}

function parseLeadSeqFromTitle(title, year) {
  // Expected: FM-YYYY-0001
  if (!title) return null;
  var m = String(title).match(/^FM-(\d{4})-(\d{4,})$/);
  if (!m) return null;
  if (year && m[1] !== String(year)) return null;
  var n = parseInt(m[2], 10);
  return Number.isFinite(n) ? n : null;
}

function getMaxExistingLeadSeq(year) {
  var maxSeq = 0;
  FM.allLeads.forEach(function(l){
    var seq = parseLeadSeqFromTitle(l.Title, year);
    if (seq && seq > maxSeq) maxSeq = seq;
  });
  return maxSeq;
}

function getStoredLeadSeq(year) {
  try {
    var raw = localStorage.getItem(getLeadSeqStorageKey(year));
    var n = parseInt(raw || '0', 10);
    return Number.isFinite(n) ? n : 0;
  } catch (e) {
    return 0;
  }
}

function setStoredLeadSeq(year, n) {
  try {
    localStorage.setItem(getLeadSeqStorageKey(year), String(n));
  } catch (e) {}
}

function syncLeadSeqFromData() {
  var year = getLeadIdYear();
  var maxExisting = getMaxExistingLeadSeq(year);
  var stored = getStoredLeadSeq(year);
  var maxAll = Math.max(maxExisting, stored, FM.leadCounter - 1);
  FM.leadCounter = maxAll + 1;
  setStoredLeadSeq(year, maxAll);
}

function formatLeadId(year, seq) {
  return 'FM-' + year + '-' + String(seq).padStart(4,'0');
}

function peekNextLeadId() {
  var year = getLeadIdYear();
  var maxExisting = getMaxExistingLeadSeq(year);
  var stored = getStoredLeadSeq(year);
  var nextSeq = Math.max(maxExisting, stored, FM.leadCounter - 1) + 1;
  return formatLeadId(year, nextSeq);
}

function reserveNextLeadId() {
  var year = getLeadIdYear();
  syncLeadSeqFromData();
  var id = formatLeadId(year, FM.leadCounter);
  FM.leadCounter += 1;
  setStoredLeadSeq(year, FM.leadCounter - 1);
  return id;
}

function parseDateOnlyToIso(dateOnly) {
  if (!dateOnly) return null;
  var s = String(dateOnly).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  var d = new Date(s + 'T00:00:00');
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

/* ── EMAIL / NAME UTILS ───────────────────────────── */
function normEmail(e) { return (e || '').toString().trim().toLowerCase(); }
function normName(n)  { return (n || '').toString().trim().toLowerCase(); }
function initialsOf(name) {
  if (!name) return '?';
  return name.split(/\s+/).filter(Boolean).slice(0,2).map(function(w){ return w[0]; }).join('').toUpperCase();
}
function nameFromEmail(email) {
  if (!email) return '';
  var local = email.split('@')[0];
  return local.split(/[._-]/).filter(Boolean).map(function(s){
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  }).join(' ');
}

/* ════════════════════════════════════════════════════════
   DUMMY DATA
   ════════════════════════════════════════════════════════ */
function generateDummyLeads() {
  const statuses    = ['New Lead','Open','In Progress','On Hold','Closed Won','Closed Lost'];
  const importances = ['High','Medium','Low'];
  const directors   = [
    { name:'Tehleel Lone',      email:'tehleel.lone@du.ae'    },
    { name:'Abdul Karim',       email:'abdul.karim3@du.ae'    },
    { name:'Ahmed Al Mansoori', email:'ahmed.mansoori@du.ae'  },
    { name:'Sara Khalid',       email:'sara.khalid@du.ae'     },
    { name:'Omar Rashid',       email:'omar.rashid@du.ae'     },
  ];
  const amsByDir = {
    'Tehleel Lone'     : [ { name:'Ali Hassan',   email:'ali.hassan@du.ae'    }, { name:'Yusuf Khan',  email:'yusuf.khan@du.ae'  } ],
    'Abdul Karim'      : [ { name:'Mariam Saeed', email:'mariam.saeed@du.ae'  }, { name:'Rashed Bin',  email:'rashed.bin@du.ae'  } ],
    'Ahmed Al Mansoori': [ { name:'Layla Hassan', email:'layla.hassan@du.ae'  }, { name:'Khalid Adi',  email:'khalid.adi@du.ae'  } ],
    'Sara Khalid'      : [ { name:'Noura Ali',    email:'noura.ali@du.ae'     }, { name:'Hamad Saif',  email:'hamad.saif@du.ae'  } ],
    'Omar Rashid'      : [ { name:'Fatima Iqbal', email:'fatima.iqbal@du.ae'  }, { name:'Rami Nour',   email:'rami.nour@du.ae'   } ],
  };
  const accounts    = ['Etisalat Corp','Gulf Tech Solutions','Dubai Logistics','Emirates Steel','Al Noor Group','Majid Al Futtaim','DAMAC Properties','Emaar Hospitality','Flydubai','RTA Dubai'];
  const reasons     = ['Price','Competition','Timing','Technical','Relationship','Other'];
  const rels        = ['Strong','Limited','No Relation'];
  const durations   = [12,24,36];

  const leads = [];
  const today = new Date();

  for (let i = 1; i <= 60; i++) {
    const daysAgo    = Math.floor(Math.random() * 120);
    const loggedDate = new Date(today);
    loggedDate.setDate(today.getDate() - daysAgo);

    const status   = statuses[Math.floor(Math.random() * statuses.length)];
    const imp      = importances[Math.floor(Math.random() * importances.length)];
    const dir      = directors[Math.floor(Math.random() * directors.length)];
    const amPool   = amsByDir[dir.name];
    const am       = amPool[Math.floor(Math.random() * amPool.length)];
    const account  = accounts[Math.floor(Math.random() * accounts.length)];
    const oppMRC   = Math.round((Math.random() * 95000 + 5000) / 1000) * 1000;
    const duration = durations[Math.floor(Math.random() * durations.length)];
    const rel      = rels[Math.floor(Math.random() * rels.length)];
    const isClosed = status === 'Closed Won' || status === 'Closed Lost';
    const finalSt  = isClosed ? (status === 'Closed Won' ? 'Won' : 'Lost') : 'In Pipeline';
    const wlReason = isClosed ? reasons[Math.floor(Math.random() * reasons.length)] : '';

    const followDt = new Date(today);
    followDt.setDate(today.getDate() + Math.floor(Math.random() * 30) - 10);

    leads.push({
      ID:                   i,
      Title:                'FM-2026-' + String(i).padStart(4,'0'),
      LeadLoggedDate:       loggedDate.toISOString(),
      Status:               status,
      AccountName:          account,
      AccountCode:          'ACC-' + String(Math.floor(Math.random()*9000)+1000),
      IsNewAccount:         Math.random() > 0.7,
      IsExistingCustomer:   Math.random() > 0.5,
      RequestDetails:       'FreeMove partnership lead for ' + account + '. Opportunity to expand du services.',
      Importance:           imp,
      InterestedInOpp:      Math.random() > 0.2,
      DirectorName:         dir.name,
      DirectorEmail:        dir.email,
      LocalAMName:          am.name,
      LocalAMEmail:         am.email,
      RelationshipStrength: rel,
      CurrentLines:         Math.floor(Math.random() * 500),
      CurrentRevenueMRC:    Math.round(Math.random() * 50000),
      OppLines:             Math.floor(Math.random() * 300 + 10),
      OppMRC:               oppMRC,
      ContractDuration:     duration,
      OppTCV:               oppMRC * duration,
      WinLossReason:        wlReason,
      FinalStatus:          finalSt,
      OppConclusion:        isClosed ? 'Lead ' + finalSt.toLowerCase() + ' after negotiations.' : 'Ongoing discussions.',
      FollowUpDate:         followDt.toISOString(),
      FollowUpNotes:        'Schedule next call with decision maker.',
      SubmittedBy:          dir.name,
    });
  }
  FM.leadCounter = leads.length + 1;
  return leads;
}

function generateDummyActivities(leads) {
  const acts = [];
  let id = 1;

  leads.forEach(function(lead) {
    const created = new Date(lead.LeadLoggedDate);
    var actor = lead.SubmittedBy || lead.DirectorName || lead.LocalAMName || 'Unknown';

    // Created
    acts.push({
      ID: id++,
      Title: 'Lead created: ' + lead.Title,
      LeadRef: lead.Title,
      ChangeField: 'Created',
      OldValue: '',
      NewValue: lead.Status,
      ChangedBy: actor,
      ChangedOn: created.toISOString(),
    });

    // Status change
    if (['In Progress','On Hold','Closed Won','Closed Lost'].includes(lead.Status)) {
      const chDate = new Date(created);
      chDate.setDate(created.getDate() + Math.floor(Math.random() * 14 + 3));
      acts.push({
        ID: id++,
        Title: 'Status \u2192 ' + lead.Status,
        LeadRef: lead.Title,
        ChangeField: 'Status',
        OldValue: 'Open',
        NewValue: lead.Status,
        ChangedBy: actor,
        ChangedOn: chDate.toISOString(),
      });
    }

    // Follow-up set
    if (lead.FollowUpDate) {
      const fuDate = new Date(created);
      fuDate.setDate(created.getDate() + Math.floor(Math.random() * 7 + 1));
      acts.push({
        ID: id++,
        Title: 'Follow-up date set',
        LeadRef: lead.Title,
        ChangeField: 'FollowUpDate',
        OldValue: '',
        NewValue: new Date(lead.FollowUpDate).toLocaleDateString('en-GB'),
        ChangedBy: actor,
        ChangedOn: fuDate.toISOString(),
      });
    }

    // Closed
    if (lead.FinalStatus === 'Won' || lead.FinalStatus === 'Lost') {
      const clDate = new Date(created);
      clDate.setDate(created.getDate() + Math.floor(Math.random() * 30 + 14));
      acts.push({
        ID: id++,
        Title: 'Lead ' + lead.FinalStatus.toLowerCase() + ' \u2014 ' + lead.WinLossReason,
        LeadRef: lead.Title,
        ChangeField: 'FinalStatus',
        OldValue: 'In Pipeline',
        NewValue: lead.FinalStatus,
        ChangedBy: actor,
        ChangedOn: clDate.toISOString(),
      });
    }
  });

  acts.sort(function(a,b) { return new Date(b.ChangedOn) - new Date(a.ChangedOn); });
  return acts;
}

/* ════════════════════════════════════════════════════════
   SHAREPOINT DATA LAYER
   ════════════════════════════════════════════════════════ */
function spGet(list, filter, select, expand) {
  let url = FM_CONFIG.SITE_URL + '/_api/web/lists/getbytitle(\'' + list + '\')/items?$top=2000';
  if (filter) url += '&$filter=' + encodeURIComponent(filter);
  if (select) url += '&$select=' + encodeURIComponent(select);
  if (expand) url += '&$expand=' + encodeURIComponent(expand);
  return fetch(url, { headers: { Accept: 'application/json;odata=verbose' } })
    .then(function(r) { if (!r.ok) throw new Error('SP GET failed: ' + r.status); return r.json(); })
    .then(function(d) { return d.d.results; });
}

/** SharePoint person / text field → display string */
function spFieldPerson(val) {
  if (val == null || val === '') return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'object') {
    if (val.__deferred) return '';
    if (val.results && val.results.length && val.results[0].Title) {
      return String(val.results[0].Title).trim();
    }
    if (val.Title) return String(val.Title).trim();
    if (val.Label) return String(val.Label).trim();
    if (val.Name) return String(val.Name).trim();
    if (val.Email) return String(val.Email).trim();
    return '';
  }
  return String(val).trim();
}

/** Normalize FM_Activities list row (verbose field names vary by column setup). */
function mapActivityFromSharePoint(it) {
  if (!it || typeof it !== 'object') return it;
  var by =
    spFieldPerson(it.ChangedBy) ||
    spFieldPerson(it.Changed_x0020_By) ||
    spFieldPerson(it.Editor) ||
    spFieldPerson(it.Author) ||
    (typeof it.ModifiedBy === 'string' && it.ModifiedBy.trim()) ||
    '';
  var on = it.ChangedOn || it.Modified || it.Created || '';
  var ref = it.LeadRef != null && it.LeadRef !== '' ? it.LeadRef : it.Lead_x0020_Ref || '';
  return Object.assign({}, it, { ChangedBy: by, ChangedOn: on, LeadRef: ref });
}

/** Display / filter key for “who changed it” (dummy + live). */
function activityActorName(a) {
  if (!a) return '';
  var raw =
    a.ChangedBy ||
    a.changedBy ||
    a.Changed_x0020_By ||
    a.Editor ||
    a.Author ||
    a.ModifiedBy ||
    a.CreatedBy ||
    a.UserName ||
    '';
  var n = spFieldPerson(raw);
  if (n) return n;
  var ref = a.LeadRef || a.Lead_x0020_Ref;
  if (ref && FM.scopedLeads) {
    var lead = FM.scopedLeads.find(function (l) {
      return l.Title === ref;
    });
    if (lead) {
      return (
        spFieldPerson(lead.SubmittedBy) ||
        spFieldPerson(lead.LocalAMName) ||
        spFieldPerson(lead.DirectorName) ||
        ''
      );
    }
  }
  return '';
}

function getDigest() {
  return fetch(FM_CONFIG.SITE_URL + '/_api/contextinfo', {
    method: 'POST',
    headers: { Accept: 'application/json;odata=verbose' },
  })
  .then(function(r) { return r.json(); })
  .then(function(d) { return d.d.GetContextWebInformation.FormDigestValue; });
}

function spPost(list, body) {
  return fetch(FM_CONFIG.SITE_URL + '/_api/web/lists/getbytitle(\'' + list + '\')', {
    headers: { Accept: 'application/json;odata=verbose' }
  })
  .then(function(r) { return r.json(); })
  .then(function(meta) {
    return getDigest().then(function(digest) {
      return fetch(FM_CONFIG.SITE_URL + '/_api/web/lists/getbytitle(\'' + list + '\')/items', {
        method: 'POST',
        headers: {
          Accept: 'application/json;odata=verbose',
          'Content-Type': 'application/json;odata=verbose',
          'X-RequestDigest': digest,
        },
        body: JSON.stringify(Object.assign({ __metadata: { type: meta.d.ListItemEntityTypeFullName } }, body)),
      });
    });
  });
}

/** Update existing list item (MERGE). */
function spMerge(list, itemId, body) {
  return fetch(FM_CONFIG.SITE_URL + '/_api/web/lists/getbytitle(\'' + list + '\')', {
    headers: { Accept: 'application/json;odata=verbose' }
  })
  .then(function(r) { return r.json(); })
  .then(function(meta) {
    return getDigest().then(function(digest) {
      return fetch(
        FM_CONFIG.SITE_URL + "/_api/web/lists/getbytitle('" + list + "')/items(" + itemId + ')',
        {
          method: 'POST',
          headers: {
            Accept: 'application/json;odata=verbose',
            'Content-Type': 'application/json;odata=verbose',
            'X-RequestDigest': digest,
            'X-HTTP-Method': 'MERGE',
            'IF-MATCH': '*',
          },
          body: JSON.stringify(Object.assign({ __metadata: { type: meta.d.ListItemEntityTypeFullName } }, body)),
        }
      );
    });
  });
}

/** Drop null/empty optional fields; coerce types for FM_Leads REST (matches list column types). */
function spCleanLeadItemForRest(body, opts) {
  opts = opts || {};
  var o = {};
  Object.keys(body).forEach(function (k) {
    var v = body[k];
    if (v === undefined) return;
    if ((v === null || v === '') && (k === 'FollowUpDate' || k === 'FollowUpNotes' || k === 'WinLossReason' || k === 'OppConclusion' || k === 'AccountCode' || k === 'LocalAMName' || k === 'LocalAMEmail' || k === 'DirectorEmail')) return;
    o[k] = v;
  });
  // Person or Group "SubmittedBy" — OData needs SubmittedById on create only (preserve on MERGE).
  if (Object.prototype.hasOwnProperty.call(o, 'SubmittedBy')) {
    delete o.SubmittedBy;
    if (!opts.isUpdate && FM.currentUser && FM.currentUser.id != null && FM.currentUser.id !== '') {
      o.SubmittedById = FM.currentUser.id;
    }
  }
  // Choice column — must be a string matching a list option (never a JSON number).
  if (o.ContractDuration != null && typeof o.ContractDuration === 'number' && !isNaN(o.ContractDuration)) {
    o.ContractDuration = String(o.ContractDuration);
  }
  if (o.WinLossReason === '') delete o.WinLossReason;
  if (FM_CONFIG.SP_REST_LEAD_STRINGIFY_NUMBERS === true) {
    ['CurrentLines', 'OppLines', 'OppMRC', 'CurrentRevenueMRC', 'OppTCV'].forEach(function (k) {
      if (o[k] != null && typeof o[k] === 'number' && !isNaN(o[k])) o[k] = String(o[k]);
    });
  }
  return o;
}

/** FM_Activities POST — Person column needs ChangedById, not a display string. */
function spCleanActivityItemForRest(body) {
  var o = Object.assign({}, body);
  // ChangedBy is Person/Group — use Id if available, otherwise drop it (SP records Created By automatically)
  if (Object.prototype.hasOwnProperty.call(o, 'ChangedBy')) {
    delete o.ChangedBy;
    if (FM.currentUser && FM.currentUser.id != null && FM.currentUser.id !== '') {
      o.ChangedById = FM.currentUser.id;
    }
    // If no id available, do NOT send ChangedById — SP will still record Created By
  }
  return o;
}

function getCurrentUser() {
  return fetch(FM_CONFIG.SITE_URL + '/_api/web/currentuser', {
    headers: { Accept: 'application/json;odata=verbose' }
  })
  .then(function(r) { return r.json(); })
  .then(function(d) {
    return {
      id: d.d.Id,
      name: d.d.Title,
      email: d.d.Email,
      initials: initialsOf(d.d.Title || ''),
    };
  });
}

/* ════════════════════════════════════════════════════════
   ACCESS CONTROL — FM_Access_Marix
   Columns: Title (name), Email, Role
   ════════════════════════════════════════════════════════ */
function loadUserAccess() {
  if (FM_CONFIG.DUMMY_MODE) {
    var du = FM_CONFIG.DUMMY_USER || {};
    var mockEmail = (du.email || 'demo@du.ae').toLowerCase();
    var mockName  = du.name  || nameFromEmail(mockEmail);
    var role      = du.role  || FM_ROLES.ADMIN;
    USER_CONTEXT.userEmail = mockEmail;
    USER_CONTEXT.userName  = mockName;
    USER_CONTEXT.role      = role;
    USER_CONTEXT.hasAccess = (role && role !== FM_ROLES.NONE);
    USER_CONTEXT.isAdmin    = (role === FM_ROLES.ADMIN);
    USER_CONTEXT.isDirector = (role === FM_ROLES.DIRECTOR);
    USER_CONTEXT.isAM       = (role === FM_ROLES.AM);
    FM.currentUser = { name: mockName, email: mockEmail, initials: initialsOf(mockName) };
    return Promise.resolve(USER_CONTEXT);
  }

  return getCurrentUser()
    .then(function(u){
      USER_CONTEXT.userEmail = normEmail(u.email);
      USER_CONTEXT.userName  = u.name || nameFromEmail(USER_CONTEXT.userEmail);
    FM.currentUser = {
        name: USER_CONTEXT.userName,
        email: USER_CONTEXT.userEmail,
        initials: initialsOf(USER_CONTEXT.userName),
        id: u.id || null,
      };
      return spGet(FM_CONFIG.LIST_ACCESS).catch(function(){ return []; });
    })
    .then(function(rows){
      var hit = (rows || []).find(function(r){
        return normEmail(r.Email) === USER_CONTEXT.userEmail;
      });
      if (hit) {
        var rawRole = (hit.Role || '').toString().trim();
        USER_CONTEXT.role = rawRole || FM_ROLES.NONE;
        if (hit.Title && !USER_CONTEXT.userName) USER_CONTEXT.userName = hit.Title;
      } else {
        USER_CONTEXT.role = FM_ROLES.NONE;
      }
      USER_CONTEXT.hasAccess  = (USER_CONTEXT.role && USER_CONTEXT.role !== FM_ROLES.NONE);
      USER_CONTEXT.isAdmin    = (USER_CONTEXT.role === FM_ROLES.ADMIN);
      USER_CONTEXT.isDirector = (USER_CONTEXT.role === FM_ROLES.DIRECTOR);
      USER_CONTEXT.isAM       = (USER_CONTEXT.role === FM_ROLES.AM);
      return USER_CONTEXT;
    })
    .catch(function(e){
      console.error('Access check failed:', e);
      USER_CONTEXT.role = FM_ROLES.NONE;
      USER_CONTEXT.hasAccess = false;
      return USER_CONTEXT;
    });
}

/* ── DATA SCOPING ────────────────────────────────────
   Admin    → all leads / all activities
   Director → leads where DirectorName/Email matches the user
              (covers all AMs under that director automatically)
   AM       → leads where LocalAMName/Email matches the user
*/
function isMyLead(l) {
  var ue = USER_CONTEXT.userEmail;
  var un = normName(USER_CONTEXT.userName);
  if (USER_CONTEXT.isAdmin) return true;
  if (USER_CONTEXT.isDirector) {
    return normEmail(l.DirectorEmail) === ue || normName(l.DirectorName) === un;
  }
  if (USER_CONTEXT.isAM) {
    return normEmail(l.LocalAMEmail) === ue || normName(l.LocalAMName) === un;
  }
  return false;
}

function applyDataScope() {
  if (USER_CONTEXT.isAdmin) {
    FM.scopedLeads      = FM.allLeads.slice();
    FM.scopedActivities = FM.allActivities.slice();
    return;
  }
  FM.scopedLeads = FM.allLeads.filter(isMyLead);
  var allowedRefs = {};
  FM.scopedLeads.forEach(function(l){ allowedRefs[l.Title] = true; });
  FM.scopedActivities = FM.allActivities.filter(function(a){
    return allowedRefs[a.LeadRef];
  });
}

/* ════════════════════════════════════════════════════════
   LOAD DATA
   ════════════════════════════════════════════════════════ */
function loadAllData() {
  if (FM_CONFIG.DUMMY_MODE) {
    FM.allLeads      = generateDummyLeads();
    FM.allActivities = generateDummyActivities(FM.allLeads);
    applyDataScope();
    FM.filteredLeads = FM.scopedLeads.slice();
    syncLeadSeqFromData();
    updateUI();
    return Promise.resolve();
  }

  return Promise.all([
    spGet(FM_CONFIG.LIST_LEADS),
    /* Avoid $expand=Editor,Author — many lists reject it (400) and it spams the console. */
    spGet(FM_CONFIG.LIST_ACT),
  ])
  .then(function(results) {
    FM.allLeads = (results[0] || []).map(function (l) {
      return Object.assign({}, l, { SubmittedBy: spFieldPerson(l.SubmittedBy) });
    });
    FM.allActivities = (results[1] || []).map(mapActivityFromSharePoint);
    applyDataScope();
    FM.filteredLeads = FM.scopedLeads.slice();
    syncLeadSeqFromData();
    updateUI();
  })
  .catch(function(e) {
    showToast('Failed to load SharePoint data', 'error');
    console.error(e);
  });
}

/* ── TOGGLE DUMMY MODE ────────────────────────────────── */
function toggleDummyMode() {
  FM_CONFIG.DUMMY_MODE = !FM_CONFIG.DUMMY_MODE;
  var btn   = document.getElementById('dummy-toggle-btn');
  var label = document.getElementById('dummy-label');
  if (FM_CONFIG.DUMMY_MODE) {
    btn.classList.remove('live');
    label.textContent = 'Dummy Data';
    showToast('Switched to dummy data mode', 'info');
  } else {
    btn.classList.add('live');
    label.textContent = 'Live SP Data';
    showToast('Connecting to SharePoint...', 'info');
  }
  destroyAllCharts();
  loadAllData();
}

/* ════════════════════════════════════════════════════════
   UPDATE ALL UI
   ════════════════════════════════════════════════════════ */
function updateUI() {
  setUserInfo();
  applyRoleVisibility();
  populateDirectorFilters();
  populateAMFilters();
  populateAccountFilters();
  initLeadsGrid();
  populateActivityLeadFilter();
  populateActivityUserFilter();
  populateActivityDirFilter();
  renderLaunchPage();
  applyFilters();
  renderMyLeads();
  renderActivityLog();
  checkOverdue();
  setFormDefaults();
}

function setUserInfo() {
  var av  = document.getElementById('user-avatar');
  var nm  = document.getElementById('user-name');
  var sbm = document.getElementById('f-submitted-by');
  if (av)  av.textContent  = FM.currentUser.initials || initialsOf(FM.currentUser.name);
  if (nm)  nm.textContent  = FM.currentUser.name || '';
  if (sbm) sbm.value       = FM.currentUser.name || '';

  var role = USER_CONTEXT.role || 'User';
  var pill = document.getElementById('role-pill');
  var pillTxt = document.getElementById('role-pill-txt');
  var ub = document.getElementById('fm-user-badge');
  if (ub) {
    ub.textContent = (FM.currentUser.name || 'User') + (USER_CONTEXT.hasAccess ? ' · ' + role : '');
  }
  if (pill && pillTxt) {
    pill.style.display = USER_CONTEXT.hasAccess ? 'inline-flex' : 'none';
    pill.classList.remove('admin','dir','am');
    if (USER_CONTEXT.isAdmin)    pill.classList.add('admin');
    if (USER_CONTEXT.isDirector) pill.classList.add('dir');
    if (USER_CONTEXT.isAM)       pill.classList.add('am');
    pillTxt.textContent = role;
  }
}

/* ── ROLE-AWARE VISIBILITY ──────────────────────────────
   - AM:       no director performance, director filter hidden (pre-locked)
   - Director: no AM performance from other directors (we scope data anyway)
   - Admin:    everything visible
*/
function applyRoleVisibility() {
  var dirPerfRow = document.getElementById('row-dir-perf');
  var amPerfRow  = document.getElementById('row-am-perf');
  var dashDir    = document.getElementById('ms-dash-dir');
  var dashAM     = document.getElementById('ms-dash-am');
  var mlDir      = document.getElementById('ms-ml-dir');
  var mlAM       = document.getElementById('ms-ml-am');

  if (USER_CONTEXT.isAM) {
    if (dirPerfRow) dirPerfRow.style.display = 'none';
    if (amPerfRow)  amPerfRow.style.display  = 'none';
    if (dashDir && dashDir.parentElement) hideFilterField(dashDir);
    if (mlDir   && mlDir.parentElement)   hideFilterField(mlDir);
    if (dashAM  && dashAM.parentElement)  hideFilterField(dashAM);
    if (mlAM    && mlAM.parentElement)    hideFilterField(mlAM);
  } else if (USER_CONTEXT.isDirector) {
    if (dirPerfRow) dirPerfRow.style.display = 'none';
    if (amPerfRow)  amPerfRow.style.display  = '';
    if (dashDir && dashDir.parentElement) hideFilterField(dashDir);
    if (mlDir   && mlDir.parentElement)   hideFilterField(mlDir);
  } else {
    if (dirPerfRow) dirPerfRow.style.display = '';
    if (amPerfRow)  amPerfRow.style.display  = '';
  }
}

function hideFilterField(wrapEl) {
  var grp = wrapEl.closest('.filter-group');
  if (grp) {
    var sepBefore = grp.previousElementSibling;
    if (sepBefore && sepBefore.classList && sepBefore.classList.contains('filter-sep')) sepBefore.style.display = 'none';
    grp.style.display = 'none';
    return;
  }
  var prev = wrapEl.previousElementSibling;
  if (prev && prev.tagName === 'LABEL') prev.style.display = 'none';
  wrapEl.style.display = 'none';
  var sep = wrapEl.nextElementSibling;
  if (sep && sep.classList && sep.classList.contains('filter-sep')) sep.style.display = 'none';
}

/* ── LAUNCH (home) panel ──────────────────────────── */
function renderLaunchPage() {
  var g  = document.getElementById('launch-greeting');
  var d  = document.getElementById('launch-date');
  var st = document.getElementById('launch-stats');
  var rc = document.getElementById('launch-recents-list');
  if (!g || !d || !st || !rc) return;

  var hour = new Date().getHours();
  var greet = 'Good evening';
  if (hour < 12) greet = 'Good morning';
  else if (hour < 18) greet = 'Good afternoon';
  g.textContent = greet + ', ' + (FM.currentUser.name || 'there') + ' 👋';
  d.textContent = new Date().toLocaleDateString('en-GB',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});

  var open = FM.scopedLeads.filter(function(l){ return l.Status!=='Closed Won' && l.Status!=='Closed Lost'; }).length;
  var hi   = FM.scopedLeads.filter(function(l){ return l.Importance==='High'; }).length;
  var tcv  = FM.scopedLeads.filter(function(l){ return l.FinalStatus!=='Won' && l.FinalStatus!=='Lost'; })
               .reduce(function(s,l){ return s+(l.OppTCV||0); },0);
  st.innerHTML =
    '<div class="launch-stat"><div class="lsv">' + FM.scopedLeads.length + '</div><div class="lsl">Total Leads</div></div>' +
    '<div class="launch-stat"><div class="lsv">' + open + '</div><div class="lsl">Open</div></div>' +
    '<div class="launch-stat"><div class="lsv">' + hi + '</div><div class="lsl">High Importance</div></div>' +
    '<div class="launch-stat"><div class="lsv">' + formatAED(tcv) + '</div><div class="lsl">Pipeline TCV</div></div>';

  var recents = FM.scopedActivities.slice(0, 6);
  rc.innerHTML = recents.length === 0
    ? '<div class="sh-sub" style="padding:8px 0">No recent activity yet.</div>'
    : recents.map(function(a){
        var dt = new Date(a.ChangedOn);
        return '<div class="recent-row" style="padding:8px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;font-size:12px"><span>' +
          a.Title + ' <span style="color:var(--text-muted)">— ' + a.LeadRef + '</span></span>' +
          '<span style="color:var(--text-muted)">' + dt.toLocaleDateString('en-GB',{day:'2-digit',month:'short'}) + '</span></div>';
      }).join('');
}

/* ════════════════════════════════════════════════════════
   PANEL NAVIGATION
   ════════════════════════════════════════════════════════ */
var PANEL_TITLES = {
  'launch':       ['Home',           'Welcome back'],
  'dashboard':    ['Overview',       'FreeMove partner leads'],
  'input-form':   ['Log New Lead',   'Submit a new FreeMove lead'],
  'my-leads':     ['My Leads',       'Leads in the system'],
  'activity-log': ['Activity Log',   'Auto-captured change history'],
};

function switchPanel(id, el, panelOpts) {
  panelOpts = panelOpts || {};
  document.querySelectorAll('.panel').forEach(function(p){ p.classList.remove('active'); });
  document.querySelectorAll('.nav-item').forEach(function(n){ n.classList.remove('active'); });
  var panelEl = document.getElementById('panel-' + id);
  if (panelEl) panelEl.classList.add('active');
  if (el) el.classList.add('active');
  if (id === 'input-form' && panelOpts.resetNewLead !== false) {
    FM.editingLeadItemId = null;
    try {
      resetForm();
    } catch (err) {
      console.error('resetForm (switchPanel):', err);
    }
  }
  var info = PANEL_TITLES[id] || [id, ''];
  var chip = document.getElementById('fm-section-chip');
  if (chip) chip.textContent = info[0];
  var subEl = document.getElementById('header-sub-dynamic');
  if (subEl) subEl.textContent = info[1];
  var legacyTitle = document.getElementById('topbar-title');
  var legacySub = document.getElementById('topbar-sub');
  if (legacyTitle) legacyTitle.textContent = info[0];
  if (legacySub) legacySub.textContent = info[1];
  if (id === 'my-leads') renderMyLeads();
}

/* ── QUICK UPDATE MODAL (fm.html) ─────────────────────── */
function closeModal() {
  var bd = document.getElementById('modal-update');
  if (bd) bd.classList.remove('show');
  FM.modalLeadSpId = null;
}

function modalStatusChange() {
  var statusEl = document.getElementById('modal-status');
  var finalEl = document.getElementById('modal-final-status');
  var wlEl = document.getElementById('modal-wl-reason');
  if (!statusEl || !finalEl || !wlEl) return;
  var status = statusEl.value;
  var isClosed = status === 'Closed Won' || status === 'Closed Lost';
  finalEl.disabled = !isClosed;
  wlEl.disabled = !isClosed;
  if (!isClosed) {
    finalEl.value = '';
    wlEl.value = '';
  }
  if (status === 'Closed Won') finalEl.value = 'Won';
  if (status === 'Closed Lost') finalEl.value = 'Lost';
}

function openQuickUpdateModal(id) {
  var lead = FM.allLeads.find(function (l) {
    return l.ID === id;
  });
  if (!lead) {
    showToast('Lead not found', 'error');
    return;
  }
  FM.modalLeadSpId = id;
  var ttl = document.getElementById('modal-lead-title');
  if (ttl) ttl.textContent = 'Update — ' + (lead.Title || '');
  var st = document.getElementById('modal-status');
  var im = document.getElementById('modal-imp');
  if (st) st.value = lead.Status || 'New Lead';
  if (im) im.value = lead.Importance || 'Medium';
  var fs = document.getElementById('modal-final-status');
  var wl = document.getElementById('modal-wl-reason');
  if (fs) fs.value = lead.FinalStatus || 'In Pipeline';
  if (wl) wl.value = lead.WinLossReason || '';
  modalStatusChange();
  var fd = document.getElementById('modal-followup-date');
  if (fd) {
    fd.value = lead.FollowUpDate ? new Date(lead.FollowUpDate).toISOString().split('T')[0] : '';
  }
  var note = document.getElementById('modal-note');
  if (note) note.value = '';
  var bd = document.getElementById('modal-update');
  if (bd) bd.classList.add('show');
}

function saveModalUpdate() {
  var id = FM.modalLeadSpId;
  if (id == null) {
    showToast('No lead selected', 'error');
    return;
  }
  var lead = FM.allLeads.find(function (l) {
    return l.ID === id;
  });
  if (!lead) {
    showToast('Lead not found', 'error');
    closeModal();
    return;
  }
  var status = (document.getElementById('modal-status') || {}).value;
  var imp = (document.getElementById('modal-imp') || {}).value;
  var finalSt = (document.getElementById('modal-final-status') || {}).value;
  var wl = (document.getElementById('modal-wl-reason') || {}).value;
  var fuRaw = (document.getElementById('modal-followup-date') || {}).value;
  var fuIso = fuRaw ? parseDateOnlyToIso(fuRaw) : '';
  var note = ((document.getElementById('modal-note') || {}).value || '').trim();

  var payload = {
    Title: lead.Title,
    Status: status,
    Importance: imp,
    FinalStatus: finalSt || 'In Pipeline',
    WinLossReason: wl || '',
    FollowUpDate: fuIso || '',
    FollowUpNotes: lead.FollowUpNotes || '',
  };
  if (note) {
    var stamp = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' — ' + (FM.currentUser.name || 'User');
    payload.FollowUpNotes = (lead.FollowUpNotes || '').trim()
      ? lead.FollowUpNotes + '\n\n[' + stamp + ']\n' + note
      : '[' + stamp + ']\n' + note;
  }

  if (FM_CONFIG.DUMMY_MODE) {
    var ix = FM.allLeads.findIndex(function (l) {
      return l.ID === id;
    });
    if (ix !== -1) {
      FM.allLeads[ix] = Object.assign({}, FM.allLeads[ix], payload);
      logActivity('Quick update', lead.Status, status, lead.Title);
      if (note) logActivity('Progress note', '', note, lead.Title);
    }
    applyDataScope();
    renderMyLeads();
    renderActivityLog();
    showToast('Lead updated', 'success');
    closeModal();
    return;
  }

  spMerge(FM_CONFIG.LIST_LEADS, id, spCleanLeadItemForRest(payload, { isUpdate: true }))
    .then(function (res) {
      if (!res.ok) {
        showToast('Update failed — check console', 'error');
        return res.text().then(function (t) {
          console.error(t);
        });
      }
      logActivitySP('Quick update', lead.Status, status, lead.Title);
      if (note) logActivitySP('Progress note', '', note, lead.Title);
      showToast('Lead updated', 'success');
      closeModal();
      return loadAllData();
    })
    .catch(function (e) {
      console.error(e);
      showToast('Network error', 'error');
    });
}

/* ════════════════════════════════════════════════════════
   FILTERS
   ════════════════════════════════════════════════════════ */
function activeMulti(values) {
  return !values || values.length === 0 || values.indexOf('all') !== -1;
}

function fmChartsMasterOpen() {
  var el = document.getElementById('fm-charts-master');
  return !!(el && el.classList.contains('open'));
}

function applyFilters() {
  var f = FM.filters;
  var now = new Date();
  FM.filteredLeads = FM.scopedLeads.filter(function(l) {
    var dt = new Date(l.LeadLoggedDate);
    if (f.period === 'thismonth')   { if (dt.getMonth() !== now.getMonth() || dt.getFullYear() !== now.getFullYear()) return false; }
    if (f.period === 'thisquarter') { var q = Math.floor(now.getMonth()/3); if (Math.floor(dt.getMonth()/3) !== q || dt.getFullYear() !== now.getFullYear()) return false; }
    if (f.period === 'thisyear')    { if (dt.getFullYear() !== now.getFullYear()) return false; }
    if (!activeMulti(f.status)   && f.status.indexOf(l.Status)         === -1) return false;
    if (!activeMulti(f.imp)      && f.imp.indexOf(l.Importance)        === -1) return false;
    if (!activeMulti(f.director) && f.director.indexOf(l.DirectorName) === -1) return false;
    if (!activeMulti(f.am)       && f.am.indexOf(l.LocalAMName)        === -1) return false;
    if (!activeMulti(f.account)  && f.account.indexOf(l.AccountName)   === -1) return false;
    return true;
  });

  renderKPIs();
  destroyFmCharts();
  if (fmChartsMasterOpen()) {
    renderFmOverviewCharts();
    renderDashboardCharts();
  }
  renderFmInsights();
}

function clearDashFilters() {
  FM.filters.period   = 'thisquarter';
  FM.filters.status   = ['all'];
  FM.filters.imp      = ['all'];
  FM.filters.director = ['all'];
  FM.filters.am       = ['all'];
  FM.filters.account  = ['all'];
  resetMSUI('ms-period', 'thisquarter', 'This Quarter');
  resetMSAll('ms-dash-status', 'All Statuses');
  resetMSAll('ms-dash-imp',    'All');
  resetMSAll('ms-dash-dir',    'All Directors');
  resetMSAll('ms-dash-am',     'All Account Managers');
  resetMSAll('ms-dash-acct',   'All Accounts');
  applyFilters();
}

/* Populate director / am / account dropdown options from scoped data */
function populateDirectorFilters() {
  var dirs = unique(FM.scopedLeads.map(function(l){ return l.DirectorName; })).sort();
  ['ms-dash-dir-list', 'ms-ml-dir-list', 'ms-al-dir-list'].forEach(function(listId){
    fillMSList(listId, dirs, function(d, ctxId){
      var ctx = listId === 'ms-dash-dir-list' ? 'Director'
              : listId === 'ms-ml-dir-list'   ? 'MLDir'
              : 'alDir';
      var wrap = listId.replace(/-list$/, '');
      if (listId === 'ms-al-dir-list') {
        return '<div class="ms-option" data-val="' + escapeHtml(d) + '" onclick="selectALFilter(\'' + wrap + '\',\'alDir\',\'' + escapeAttr(d) + '\',\'' + escapeAttr(d) + '\')"><div class="ms-chk"></div>' + escapeHtml(d) + '</div>';
      }
      return '<div class="ms-option" data-val="' + escapeHtml(d) + '" onclick="toggleMSOpt(this,\'' + wrap + '\',\'' + ctx + '\')"><div class="ms-chk"></div>' + escapeHtml(d) + '</div>';
    });
  });
}

function populateAMFilters() {
  var ams = unique(FM.scopedLeads.map(function(l){ return l.LocalAMName; })).sort();
  ['ms-dash-am-list', 'ms-ml-am-list'].forEach(function(listId){
    var wrap = listId.replace(/-list$/, '');
    var ctx  = listId === 'ms-dash-am-list' ? 'AM' : 'MLAM';
    fillMSList(listId, ams, function(am){
      return '<div class="ms-option" data-val="' + escapeHtml(am) + '" onclick="toggleMSOpt(this,\'' + wrap + '\',\'' + ctx + '\')"><div class="ms-chk"></div>' + escapeHtml(am) + '</div>';
    });
  });
}

function populateAccountFilters() {
  var accts = unique(FM.scopedLeads.map(function(l){ return l.AccountName; })).sort();
  [
    { list: 'ms-dash-acct-list', wrap: 'ms-dash-acct', ctx: 'Account' },
    { list: 'ms-ml-acct-list',   wrap: 'ms-ml-acct',   ctx: 'MLAcct'  },
  ].forEach(function(cfg){
    fillMSList(cfg.list, accts, function(a){
      return '<div class="ms-option" data-val="' + escapeHtml(a) + '" onclick="toggleMSOpt(this,\'' + cfg.wrap + '\',\'' + cfg.ctx + '\')"><div class="ms-chk"></div>' + escapeHtml(a) + '</div>';
    });
  });
}

/* MS HELPERS */
function unique(arr) {
  var seen = {}, out = [];
  arr.forEach(function(v){ if (v && !seen[v]) { seen[v] = 1; out.push(v); } });
  return out;
}
function escapeHtml(s) { return String(s||'').replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
function escapeAttr(s) { return escapeHtml(s).replace(/'/g,'&#39;'); }

/* ════════════════════════════════════════════════════════
   AG GRID — LEADS TABLE
   ════════════════════════════════════════════════════════ */
function initLeadsGrid() {
  var el = document.getElementById('leads-grid');
  if (!el) return;
  if (FM.grid.leads && FM.grid.leads.api) return;
  if (typeof agGrid === 'undefined') return;

  var columnDefs = [
    { headerName: 'Lead ID', field: 'Title', minWidth: 140, pinned: 'left' },
    { headerName: 'Account', field: 'AccountName', minWidth: 160, flex: 1 },
    { headerName: 'Status', field: 'Status', minWidth: 120 },
    { headerName: 'Importance', field: 'Importance', minWidth: 110 },
    { headerName: 'Director', field: 'DirectorName', minWidth: 150 },
    { headerName: 'AM', field: 'LocalAMName', minWidth: 140 },
    { headerName: 'Opp MRC', field: 'OppMRC', minWidth: 110, valueFormatter: function(p){ return 'AED ' + ((p.value||0).toLocaleString()); } },
    { headerName: 'TCV', field: 'OppTCV', minWidth: 120, valueFormatter: function(p){ return formatAED(p.value||0); } },
    { headerName: 'Logged', field: 'LeadLoggedDate', minWidth: 110, valueFormatter: function(p){ return p.value ? new Date(p.value).toLocaleDateString('en-GB') : '—'; } },
    {
      headerName: 'Actions',
      field: 'ID',
      minWidth: 150,
      pinned: 'right',
      sortable: false,
      filter: false,
      cellRenderer: function(params) {
        var id = params.data && params.data.ID;
        if (!id) return '';
        return (
          '<div style="display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap">' +
            '<button type="button" class="act-btn" onclick="openQuickUpdateModal(' + id + ');return false;">Update</button>' +
            '<button type="button" class="act-btn" onclick="editLead(' + id + ');return false;">Edit</button>' +
            '<button type="button" class="act-btn" onclick="deleteLead(' + id + ');return false;">Delete</button>' +
          '</div>'
        );
      }
    }
  ];

  var gridOptions = {
    columnDefs: columnDefs,
    rowData: [],
    defaultColDef: { sortable: true, filter: true, resizable: true },
    animateRows: true,
    rowHeight: 38,
    headerHeight: 38,
    pagination: true,
    paginationPageSize: 25,
    suppressCellFocus: true,
  };

  // ag-Grid v31+ returns the Grid API
  var api = agGrid.createGrid(el, gridOptions);
  FM.grid.leads = { api: api, columnApi: null };
}

function fillMSList(listId, items, optionTemplate) {
  var ul = document.getElementById(listId);
  if (!ul) return;
  var allItem = ul.querySelector('.ms-all-item');
  ul.innerHTML = '';
  if (allItem) ul.appendChild(allItem);
  items.forEach(function(it){
    var div = document.createElement('div');
    div.innerHTML = optionTemplate(it);
    ul.appendChild(div.firstChild);
  });
}

function resetMSUI(wrapId, val, label) {
  var wrap = document.getElementById(wrapId);
  if (!wrap) return;
  wrap.querySelectorAll('.ms-option').forEach(function(o){ o.classList.remove('checked'); });
  var sel = wrap.querySelector('.ms-option[data-val="' + val + '"]');
  if (sel) sel.classList.add('checked');
  var trig = wrap.querySelector('.ms-trigger');
  if (trig) trig.textContent = label;
}
function resetMSAll(wrapId, label) {
  var wrap = document.getElementById(wrapId);
  if (!wrap) return;
  wrap.querySelectorAll('.ms-option').forEach(function(o){ o.classList.remove('checked'); });
  var all = wrap.querySelector('.ms-all-item');
  if (all) all.classList.add('checked');
  var trig = wrap.querySelector('.ms-trigger');
  if (trig) trig.textContent = label;
}

/* ════════════════════════════════════════════════════════
   KPI TILES
   ════════════════════════════════════════════════════════ */
function renderKPIs() {
  var leads    = FM.filteredLeads;
  var total    = leads.length;
  var closed   = leads.filter(function(l){ return l.FinalStatus === 'Won' || l.FinalStatus === 'Lost'; });
  var won      = leads.filter(function(l){ return l.FinalStatus === 'Won'; }).length;
  var winRate  = closed.length ? Math.round(won / closed.length * 100) : 0;
  var active   = leads.filter(function(l){ return l.Status !== 'Closed Won' && l.Status !== 'Closed Lost'; });
  var pipeTCV  = active.reduce(function(s,l){ return s + (l.OppTCV||0); }, 0);
  var now      = new Date();
  var thisMonth= FM.allLeads.filter(function(l){
    var d = new Date(l.LeadLoggedDate);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  var closedWithDays = leads.filter(function(l){ return l.FinalStatus === 'Won' || l.FinalStatus === 'Lost'; });
  var avgDays = closedWithDays.length
    ? Math.round(closedWithDays.reduce(function(s,l){
        return s + Math.abs((new Date(l.FollowUpDate || l.LeadLoggedDate) - new Date(l.LeadLoggedDate)) / 86400000);
      }, 0) / closedWithDays.length)
    : 0;

  document.getElementById('kpi-total').textContent  = total;
  document.getElementById('kpi-total-d').textContent = '+' + thisMonth + ' this month';
  document.getElementById('kpi-total-d').className   = 's-sub';
  document.getElementById('kpi-win').textContent     = winRate + '%';
  document.getElementById('kpi-win-d').textContent   = won + ' of ' + closed.length + ' closed';
  document.getElementById('kpi-win-d').className     = 's-sub';
  document.getElementById('kpi-tcv').textContent     = formatAED(pipeTCV);
  document.getElementById('kpi-tcv-d').textContent   = active.length + ' active leads';
  document.getElementById('kpi-tcv-d').className     = 's-sub';
  document.getElementById('kpi-days').textContent    = avgDays || '\u2014';
  document.getElementById('kpi-days-d').textContent  = avgDays ? 'avg. logged \u2192 closed' : 'No closed leads yet';
  document.getElementById('kpi-days-d').className    = 's-sub';
  document.getElementById('badge-my').textContent    = FM.allLeads.length;
}

/* ════════════════════════════════════════════════════════
   CHARTS
   ════════════════════════════════════════════════════════ */

// Chart.js — register datalabels (numbers on charts, DIP parity)
if (typeof Chart !== 'undefined' && typeof ChartDataLabels !== 'undefined') {
  Chart.register(ChartDataLabels);
}

function fmDlText() {
  var t = document.documentElement.getAttribute('data-theme') || '';
  return (t === 'dark' || t === 'teal-dark') ? '#e2e8f0' : '#0f1a3e';
}
function fmDlBar() {
  return {
    display: true,
    color: fmDlText(),
    font: { weight: '700', size: 10 },
    anchor: 'end',
    align: 'end',
    offset: 2,
    clamp: true,
    formatter: function (value, ctx) {
      var y = typeof value === 'number' ? value : ctx && ctx.parsed && typeof ctx.parsed.y === 'number' ? ctx.parsed.y : NaN;
      return typeof y === 'number' && !isNaN(y) && y > 0 ? (Number.isInteger(y) ? y : y.toFixed(1)) : '';
    },
  };
}
function fmDlLine() {
  var isDark = (document.documentElement.getAttribute('data-theme') || '').indexOf('dark') !== -1;
  return {
    display: true,
    color: fmDlText(),
    font: { weight: '700', size: 9 },
    anchor: 'end',
    align: 'top',
    offset: 6,
    clamp: true,
    backgroundColor: isDark ? 'rgba(14,22,48,.7)' : 'rgba(255,255,255,.85)',
    borderRadius: 3,
    padding: { top: 1, bottom: 1, left: 3, right: 3 },
    formatter: function (value, ctx) {
      var y = typeof value === 'number' ? value : ctx && ctx.parsed && typeof ctx.parsed.y === 'number' ? ctx.parsed.y : NaN;
      return typeof y === 'number' && !isNaN(y) && y > 0 ? (Number.isInteger(y) ? y : y.toFixed(1)) : '';
    },
  };
}
function fmDlDoughnut() {
  return {
    display: true,
    color: '#fff',
    font: { weight: '800', size: 11 },
    anchor: 'center',
    align: 'center',
    textShadowBlur: 4,
    textShadowColor: 'rgba(0,0,0,.65)',
    formatter: function (v, ctx) {
      if (typeof v !== 'number' || v <= 0) return '';
      var total = ctx.dataset.data.reduce(function (a, b) {
        return a + (typeof b === 'number' ? b : 0);
      }, 0);
      var pct = total ? (v / total) * 100 : 0;
      if (pct < 3) return '';
      return v;
    },
  };
}
function fmDlLinePct() {
  return {
    display: true,
    color: '#f59e0b',
    font: { weight: '800', size: 9 },
    anchor: 'end',
    align: 'top',
    offset: 6,
    formatter: function (v) {
      return typeof v === 'number' && v > 0 ? v.toFixed(0) + '%' : '';
    },
  };
}

function getWeekOfYearFM(date) {
  var d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  var w1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - w1) / 86400000 - 3 + ((w1.getDay() + 6) % 7)) / 7);
}
function getFmBuckets(period, count) {
  var now = new Date();
  var buckets = [];
  for (var i = count - 1; i >= 0; i--) {
    var label;
    var key;
    if (period === 'D') {
      var d0 = new Date(now);
      d0.setDate(d0.getDate() - i);
      key = d0.toISOString().split('T')[0];
      label = d0.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    } else if (period === 'W') {
      var d1 = new Date(now);
      d1.setDate(d1.getDate() - i * 7);
      key = d1.getFullYear() + '-W' + String(getWeekOfYearFM(d1)).padStart(2, '0');
      label = 'W' + getWeekOfYearFM(d1);
    } else if (period === 'M') {
      var d2 = new Date(now.getFullYear(), now.getMonth() - i, 1);
      key = d2.getFullYear() + '-' + String(d2.getMonth() + 1).padStart(2, '0');
      label = d2.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
    } else if (period === 'Q') {
      var totalQ = now.getFullYear() * 4 + Math.floor(now.getMonth() / 3) - i;
      var yr = Math.floor(totalQ / 4);
      var q = (totalQ % 4) + 1;
      key = yr + '-Q' + q;
      label = 'Q' + q + ' ' + String(yr).slice(2);
    } else {
      var yr2 = now.getFullYear() - i;
      key = String(yr2);
      label = String(yr2);
    }
    buckets.push({ key: key, label: label });
  }
  return buckets;
}
function getFmBucketKey(date, period) {
  var d = new Date(date);
  if (period === 'D') return d.toISOString().split('T')[0];
  if (period === 'W') return d.getFullYear() + '-W' + String(getWeekOfYearFM(d)).padStart(2, '0');
  if (period === 'M') return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  if (period === 'Q') return d.getFullYear() + '-Q' + (Math.floor(d.getMonth() / 3) + 1);
  return String(d.getFullYear());
}

/** Period toggles for FM overview charts (no inline onclick — works under SharePoint CSP). */
function buildFmToggle(wrapId, currentVal, kind, options) {
  var wrap = document.getElementById(wrapId);
  if (!wrap) return;
  wrap.textContent = '';
  options.forEach(function (o) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = currentVal === o.k ? 'active' : '';
    btn.textContent = o.l;
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      if (kind === 'trend') fmSetTrendPeriod(o.k);
      else if (kind === 'avc') fmSetAvcPeriod(o.k);
    });
    wrap.appendChild(btn);
  });
}

function fmChartColors() {
  var t = document.documentElement.getAttribute('data-theme') || '';
  var isDark = t === 'dark' || t === 'teal-dark';
  var isTeal = t === 'teal' || t === 'teal-dark';
  return {
    text: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.55)',
    grid: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
    p1: isTeal ? '#0d9488' : '#2563eb',
    p2: isTeal ? '#0891b2' : '#7c3aed',
  };
}

// Chart.js global polish
Chart.defaults.plugins.datalabels = { display: false };
Chart.defaults.font.family   = "'Inter', system-ui, -apple-system, sans-serif";
Chart.defaults.font.size     = 11;
Chart.defaults.color         = '#3d4f8a';
/* Chart.js v4: use built-in easing names only — invalid easing throws in animation tick (_fn is not a function). */
Chart.defaults.animation     = { duration: 600, easing: 'easeOutQuart' };
Chart.defaults.plugins.tooltip = Object.assign({}, Chart.defaults.plugins.tooltip, {
  backgroundColor:  'rgba(15, 10, 30, 0.92)',
  titleColor:       '#fff',
  bodyColor:        '#e2e8f0',
  borderColor:      'rgba(37,99,235,0.35)',
  borderWidth:      1,
  cornerRadius:     8,
  padding:          10,
  titleFont:        { size: 12, weight: 'bold' },
  bodyFont:         { size: 11 },
  displayColors:    true,
  boxPadding:       4,
});

var CLR = {
  magenta: '#C0006A', magentaL: '#E8A0C4',
  green: '#22C55E', amber: '#F59E0B',
  blue: '#3B82F6', red: '#EF4444',
  purple: '#8B5CF6', gray: '#9CA3AF', teal: '#14B8A6',
};

function destroyAllCharts() {
  Object.keys(FM.charts).forEach(function (k) {
    try {
      FM.charts[k].destroy();
    } catch (e) {}
  });
  FM.charts = {};
}

/** Destroy only extended analytics (keeps DIP-style overview canvases). */
function destroyAnalyticsCharts() {
  var keep = {
    'fm-ch-trend': 1,
    'fm-ch-accounts': 1,
    'fm-ch-importance': 1,
    'fm-ch-status-mix': 1,
    'fm-ch-avc': 1,
    'fm-ch-rel-overview': 1,
  };
  Object.keys(FM.charts).forEach(function (k) {
    if (keep[k]) return;
    try {
      FM.charts[k].destroy();
    } catch (e) {}
    delete FM.charts[k];
  });
}

function destroyFmCharts() {
  [
    'fm-ch-trend',
    'fm-ch-accounts',
    'fm-ch-importance',
    'fm-ch-status-mix',
    'fm-ch-avc',
    'fm-ch-rel-overview',
  ].forEach(function (id) {
    var el = document.getElementById(id);
    var ch = null;
    if (el && typeof Chart !== 'undefined' && Chart.getChart) ch = Chart.getChart(el);
    if (!ch && FM.charts[id]) ch = FM.charts[id];
    if (ch) {
      try {
        ch.destroy();
      } catch (e) {}
    }
    delete FM.charts[id];
  });
}

function fmResizeChartsInTree(root) {
  if (!root || typeof Chart === 'undefined' || !Chart.getChart) return;
  root.querySelectorAll('canvas').forEach(function (cv) {
    if (!cv.getContext) return;
    var st = window.getComputedStyle(cv);
    if (st.display === 'none' || st.visibility === 'hidden' || cv.offsetWidth < 2) return;
    var ch = Chart.getChart(cv);
    if (ch) ch.resize();
  });
}

function fmResizeAnalyticsChartsDeferred() {
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      fmResizeChartsInTree(document.getElementById('fm-charts-master'));
    });
  });
}

function fmDoughnutCenterPlugin(total, uid) {
  var c = fmChartColors();
  return {
    id: 'fmDoughnutCenter_' + (uid || 'x'),
    beforeDraw: function (chart) {
      if (chart.config.type !== 'doughnut' && chart.config.type !== 'pie') return;
      var meta = chart.getDatasetMeta(0);
      if (!meta || !chart.chartArea) return;
      var ca = chart.chartArea;
      var cx = ca.left + ca.width / 2;
      var cy = ca.top + ca.height / 2;
      var ctx = chart.ctx;
      ctx.save();
      ctx.font = 'bold 18px Inter, system-ui, sans-serif';
      ctx.fillStyle = c.text.indexOf('255') !== -1 ? 'rgba(255,255,255,.92)' : 'rgba(0,0,0,.82)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(total), cx, cy - 8);
      ctx.font = '600 10px Inter, system-ui, sans-serif';
      ctx.fillStyle = c.text;
      ctx.fillText('Total', cx, cy + 10);
      ctx.restore();
    },
  };
}

function fmRefreshChartsAfterTheme() {
  renderFmInsights();
  if (!fmChartsMasterOpen()) return;
  destroyFmCharts();
  renderFmOverviewCharts();
  renderDashboardCharts();
}

function fmSetTrendPeriod(p) {
  FM.fmTrendPeriod = p;
  renderFmTrendChart();
  buildFmToggle('fm-trend-period-toggle', FM.fmTrendPeriod, 'trend', [
    { k: 'D', l: 'Day' },{ k: 'W', l: 'Week' },{ k: 'M', l: 'Month' },{ k: 'Q', l: 'Quarter' },{ k: 'Y', l: 'Year' },
  ]);
}
function fmSetAvcPeriod(p) {
  FM.fmAvcPeriod = p;
  renderFmAvcChart();
  buildFmToggle('fm-avc-period-toggle', FM.fmAvcPeriod, 'avc', [
    { k: 'D', l: 'Day' },{ k: 'W', l: 'Week' },{ k: 'M', l: 'Month' },{ k: 'Q', l: 'Quarter' },{ k: 'Y', l: 'Year' },
  ]);
}
window.fmSetTrendPeriod = fmSetTrendPeriod;
window.fmSetAvcPeriod = fmSetAvcPeriod;

/** DIP-style overview row — lead trend, bars, doughnuts, new vs closed, relationship */
function renderFmOverviewCharts() {
  if (!fmChartsMasterOpen()) return;
  var leads = FM.filteredLeads || [];
  destroyFmCharts();

  var c = fmChartColors();
  var p = FM.fmTrendPeriod;
  var count = p === 'D' ? 14 : p === 'W' ? 12 : p === 'M' ? 12 : p === 'Q' ? 8 : 5;
  var buckets = getFmBuckets(p, count);
  var logged = buckets.map(function (b) {
    return leads.filter(function (l) {
      var rd = l.LeadLoggedDate;
      if (!rd) return false;
      return getFmBucketKey(new Date(rd), p) === b.key;
    }).length;
  });

  var trendEl = document.getElementById('fm-ch-trend');
  if (trendEl) {
    var fillRgb = c.p1 === '#0d9488' ? 'rgba(13,148,136,0.16)' : 'rgba(37,99,235,0.16)';
    makeChart('fm-ch-trend', {
      type: 'line',
      data: {
        labels: buckets.map(function (b) {
          return b.label;
        }),
        datasets: [
          {
            label: 'Leads logged',
            data: logged,
            borderColor: c.p1,
            backgroundColor: fillRgb,
            fill: true,
            tension: 0.35,
            pointRadius: 4,
            pointHoverRadius: 7,
            pointBackgroundColor: c.p1,
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            borderWidth: 2.5,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        layout: { padding: { top: 18 } },
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: 'rgba(15,10,30,.85)', padding: 12, cornerRadius: 10 },
          datalabels: fmDlLine(),
        },
        scales: {
          x: { ticks: { color: c.text, font: { size: 10, weight: '600' } }, grid: { color: c.grid }, border: { dash: [4, 4] } },
          y: { ticks: { color: c.text, font: { size: 10 } }, grid: { color: c.grid }, border: { dash: [4, 4] }, beginAtZero: true },
        },
      },
    });
  }

  var acctMap = {};
  leads.forEach(function (l) {
    var a = l.AccountName || '—';
    if (!a || a === '—') return;
    acctMap[a] = (acctMap[a] || 0) + 1;
  });
  var topAccts = Object.keys(acctMap)
    .map(function (k) {
      return { k: k, n: acctMap[k] };
    })
    .sort(function (a, b) {
      return b.n - a.n;
    })
    .slice(0, 10);
  if (topAccts.length === 0) topAccts = [{ k: 'No data', n: 0 }];
  var palBar = ['rgba(37,99,235,.85)', 'rgba(124,58,237,.85)', 'rgba(6,182,212,.85)', 'rgba(16,185,129,.85)', 'rgba(251,146,60,.85)', 'rgba(236,72,153,.85)', 'rgba(239,68,68,.85)'];
  if (c.p1 === '#0d9488') {
    palBar = ['rgba(13,148,136,.88)', 'rgba(8,145,178,.88)', 'rgba(20,184,166,.88)', 'rgba(6,182,212,.88)', 'rgba(16,185,129,.88)', 'rgba(245,158,11,.88)', 'rgba(239,68,68,.88)'];
  }
  makeChart('fm-ch-accounts', {
    type: 'bar',
    data: {
      labels: topAccts.map(function (x) {
        return x.k.length > 22 ? x.k.slice(0, 20) + '…' : x.k;
      }),
      datasets: [
        {
          data: topAccts.map(function (x) {
            return x.n;
          }),
          backgroundColor: topAccts.map(function (_, i) {
            return palBar[i % palBar.length];
          }),
          borderRadius: 8,
          borderSkipped: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 18 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(0,0,0,.75)',
          padding: 12,
          cornerRadius: 10,
          callbacks: { label: function (ctx) { return ctx.parsed.y + ' leads'; } },
        },
        datalabels: fmDlBar(),
      },
      scales: {
        x: { ticks: { color: c.text, font: { size: 10, weight: '600' }, maxRotation: 35 }, grid: { display: false } },
        y: { ticks: { color: c.text }, grid: { color: c.grid }, border: { dash: [4, 4] }, beginAtZero: true },
      },
    },
  });

  var impKeys = ['High', 'Medium', 'Low'];
  var impColors = ['#ef4444', '#f59e0b', '#22c55e'];
  var impCounts = impKeys.map(function (k) {
    return leads.filter(function (l) {
      return l.Importance === k;
    }).length;
  });
  var impTotal = impCounts.reduce(function (a, b) {
    return a + b;
  }, 0);
  makeChart('fm-ch-importance', {
    type: 'doughnut',
    plugins: [fmDoughnutCenterPlugin(impTotal, 'imp')],
    data: {
      labels: impKeys,
      datasets: [
        {
          data: impCounts,
          backgroundColor: impColors,
          borderWidth: 3,
          borderColor: 'var(--bg-card)',
          hoverOffset: 10,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '58%',
      plugins: {
        legend: { position: 'right', labels: { color: c.text, font: { size: 11 }, padding: 10, usePointStyle: true } },
        datalabels: fmDlDoughnut(),
      },
    },
  });

  var statusOrder = ['New Lead', 'Open', 'In Progress', 'On Hold', 'Closed Won', 'Closed Lost'];
  var stColor = {
    'New Lead': '#3b82f6',
    Open: '#22c55e',
    'In Progress': '#f59e0b',
    'On Hold': '#8b5cf6',
    'Closed Won': '#14b8a6',
    'Closed Lost': '#ef4444',
  };
  var stFiltered = statusOrder
    .map(function (s) {
      return { s: s, n: leads.filter(function (l) { return l.Status === s; }).length };
    })
    .filter(function (x) {
      return x.n > 0;
    });
  if (stFiltered.length === 0) stFiltered = [{ s: 'No leads', n: 0 }];
  makeChart('fm-ch-status-mix', {
    type: 'bar',
    data: {
      labels: stFiltered.map(function (x) {
        return x.s;
      }),
      datasets: [
        {
          data: stFiltered.map(function (x) {
            return x.n;
          }),
          backgroundColor: stFiltered.map(function (x) {
            return stColor[x.s] || '#94a3b8';
          }),
          borderRadius: 8,
          borderSkipped: false,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { right: 36 } },
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: 'rgba(0,0,0,.75)', padding: 10, cornerRadius: 8 },
        datalabels: {
          color: fmDlText(),
          font: { weight: '700', size: 10 },
          anchor: 'end',
          align: 'end',
          offset: 4,
          clamp: true,
          formatter: function (value, ctx) {
            var v =
              typeof value === 'number'
                ? value
                : ctx && ctx.parsed
                  ? typeof ctx.parsed.x === 'number'
                    ? ctx.parsed.x
                    : typeof ctx.parsed.y === 'number'
                      ? ctx.parsed.y
                      : NaN
                  : NaN;
            return typeof v === 'number' && !isNaN(v) && v > 0 ? v : '';
          },
        },
      },
      scales: {
        x: { ticks: { color: c.text, font: { size: 10 } }, grid: { color: c.grid }, border: { dash: [4, 4] } },
        y: { ticks: { color: c.text, font: { size: 11, weight: '600' } }, grid: { display: false } },
      },
    },
  });

  var p2 = FM.fmAvcPeriod;
  var count2 = p2 === 'D' ? 14 : p2 === 'W' ? 10 : p2 === 'M' ? 12 : p2 === 'Q' ? 8 : 5;
  var buckets2 = getFmBuckets(p2, count2);
  var opened = buckets2.map(function (b) {
    return leads.filter(function (l) {
      var rd = l.LeadLoggedDate;
      if (!rd) return false;
      return getFmBucketKey(new Date(rd), p2) === b.key;
    }).length;
  });
  var closedB = buckets2.map(function (b) {
    return leads.filter(function (l) {
      if (l.Status !== 'Closed Won' && l.Status !== 'Closed Lost') return false;
      var rd = l.LeadLoggedDate;
      if (!rd) return false;
      return getFmBucketKey(new Date(rd), p2) === b.key;
    }).length;
  });
  makeChart('fm-ch-avc', {
    type: 'bar',
    data: {
      labels: buckets2.map(function (b) {
        return b.label;
      }),
      datasets: [
        {
          label: 'Leads logged',
          data: opened,
          backgroundColor: 'rgba(37,99,235,.82)',
          borderRadius: 6,
          borderSkipped: false,
          barPercentage: 0.55,
          categoryPercentage: 0.7,
        },
        {
          label: 'Closed (Won+Lost)',
          data: closedB,
          backgroundColor: 'rgba(16,185,129,.82)',
          borderRadius: 6,
          borderSkipped: false,
          barPercentage: 0.55,
          categoryPercentage: 0.7,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 18 } },
      plugins: {
        legend: { position: 'top', labels: { color: c.text, font: { size: 11, weight: '600' }, usePointStyle: true, padding: 14 } },
        tooltip: { backgroundColor: 'rgba(0,0,0,.75)', padding: 12, cornerRadius: 10 },
        datalabels: fmDlBar(),
      },
      scales: {
        x: { ticks: { color: c.text, font: { size: 10, weight: '600' } }, grid: { display: false } },
        y: { ticks: { color: c.text }, grid: { color: c.grid }, border: { dash: [4, 4] }, beginAtZero: true },
      },
    },
  });

  var relKeys = ['Strong', 'Limited', 'No Relation'];
  var relColors = ['#22c55e', '#f59e0b', '#94a3b8'];
  var relCounts = relKeys.map(function (k) {
    return leads.filter(function (l) {
      return l.RelationshipStrength === k;
    }).length;
  });
  var relTotal = relCounts.reduce(function (a, b) {
    return a + b;
  }, 0);
  makeChart('fm-ch-rel-overview', {
    type: 'doughnut',
    plugins: [fmDoughnutCenterPlugin(relTotal, 'rel')],
    data: {
      labels: relKeys,
      datasets: [
        {
          data: relCounts,
          backgroundColor: relColors,
          borderWidth: 3,
          borderColor: 'var(--bg-card)',
          hoverOffset: 10,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '55%',
      plugins: {
        legend: { position: 'right', labels: { color: c.text, font: { size: 11 }, padding: 10, usePointStyle: true } },
        datalabels: fmDlDoughnut(),
      },
    },
  });

buildFmToggle('fm-trend-period-toggle', FM.fmTrendPeriod, 'trend', [
    { k: 'D', l: 'Day' },{ k: 'W', l: 'Week' },{ k: 'M', l: 'Month' },{ k: 'Q', l: 'Quarter' },{ k: 'Y', l: 'Year' },
  ]);
  buildFmToggle('fm-avc-period-toggle', FM.fmAvcPeriod, 'avc', [
    { k: 'D', l: 'Day' },{ k: 'W', l: 'Week' },{ k: 'M', l: 'Month' },{ k: 'Q', l: 'Quarter' },{ k: 'Y', l: 'Year' },
  ]);

  fmResizeAnalyticsChartsDeferred();
}

function renderFmTrendChart() {
  var leads = FM.filteredLeads || [];
  var c = fmChartColors();
  var p = FM.fmTrendPeriod;
  var count = p === 'D' ? 14 : p === 'W' ? 12 : p === 'M' ? 12 : p === 'Q' ? 8 : 5;
  var buckets = getFmBuckets(p, count);
  var logged = buckets.map(function(b){
    return leads.filter(function(l){
      var rd = l.LeadLoggedDate; if (!rd) return false;
      return getFmBucketKey(new Date(rd), p) === b.key;
    }).length;
  });
  var trendEl = document.getElementById('fm-ch-trend');
  if (!trendEl) return;
var _oldTrend = FM.charts['fm-ch-trend'] || (typeof Chart !== 'undefined' && Chart.getChart && Chart.getChart(trendEl));
  if (_oldTrend) { try { _oldTrend.destroy(); } catch(e){} }
  delete FM.charts['fm-ch-trend'];
  trendEl.getContext('2d').clearRect(0, 0, trendEl.width, trendEl.height);
  var fillRgb = c.p1 === '#0d9488' ? 'rgba(13,148,136,0.16)' : 'rgba(37,99,235,0.16)';
  makeChart('fm-ch-trend', {
    type: 'line',
    data: {
      labels: buckets.map(function(b){ return b.label; }),
      datasets: [{
        label: 'Leads logged', data: logged,
        borderColor: c.p1, backgroundColor: fillRgb,
        fill: true, tension: 0.35, pointRadius: 4, pointHoverRadius: 7,
        pointBackgroundColor: c.p1, pointBorderColor: '#fff', pointBorderWidth: 2, borderWidth: 2.5,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      layout: { padding: { top: 18 } },
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: 'rgba(15,10,30,.85)', padding: 12, cornerRadius: 10 },
        datalabels: fmDlLine(),
      },
      scales: {
        x: { ticks: { color: c.text, font: { size: 10, weight: '600' } }, grid: { color: c.grid }, border: { dash: [4,4] } },
        y: { ticks: { color: c.text, font: { size: 10 } }, grid: { color: c.grid }, border: { dash: [4,4] }, beginAtZero: true },
      },
    },
  });
}

function renderFmAvcChart() {
  var leads = FM.filteredLeads || [];
  var c = fmChartColors();
  var p = FM.fmAvcPeriod;
  var count = p === 'D' ? 14 : p === 'W' ? 10 : p === 'M' ? 12 : p === 'Q' ? 8 : 5;
  var buckets = getFmBuckets(p, count);
  var opened = buckets.map(function(b){
    return leads.filter(function(l){
      var rd = l.LeadLoggedDate; if (!rd) return false;
      return getFmBucketKey(new Date(rd), p) === b.key;
    }).length;
  });
  var closedB = buckets.map(function(b){
    return leads.filter(function(l){
      if (l.Status !== 'Closed Won' && l.Status !== 'Closed Lost') return false;
      var rd = l.LeadLoggedDate; if (!rd) return false;
      return getFmBucketKey(new Date(rd), p) === b.key;
    }).length;
  });
  var avcEl = document.getElementById('fm-ch-avc');
  if (!avcEl) return;
var _oldAvc = FM.charts['fm-ch-avc'] || (typeof Chart !== 'undefined' && Chart.getChart && Chart.getChart(avcEl));
  if (_oldAvc) { try { _oldAvc.destroy(); } catch(e){} }
  delete FM.charts['fm-ch-avc'];
  avcEl.getContext('2d').clearRect(0, 0, avcEl.width, avcEl.height);
  makeChart('fm-ch-avc', {
    type: 'bar',
    data: {
      labels: buckets.map(function(b){ return b.label; }),
      datasets: [
        { label: 'Leads logged', data: opened, backgroundColor: 'rgba(37,99,235,.82)', borderRadius: 6, borderSkipped: false, barPercentage: 0.55, categoryPercentage: 0.7 },
        { label: 'Closed (Won+Lost)', data: closedB, backgroundColor: 'rgba(16,185,129,.82)', borderRadius: 6, borderSkipped: false, barPercentage: 0.55, categoryPercentage: 0.7 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      layout: { padding: { top: 18 } },
      plugins: {
        legend: { position: 'top', labels: { color: c.text, font: { size: 11, weight: '600' }, usePointStyle: true, padding: 14 } },
        tooltip: { backgroundColor: 'rgba(0,0,0,.75)', padding: 12, cornerRadius: 10 },
        datalabels: fmDlBar(),
      },
      scales: {
        x: { ticks: { color: c.text, font: { size: 10, weight: '600' } }, grid: { display: false } },
        y: { ticks: { color: c.text }, grid: { color: c.grid }, border: { dash: [4,4] }, beginAtZero: true },
      },
    },
  });
}






function renderFmInsights() {
  var el = document.getElementById('fm-insight-grid');
  if (!el) return;
  var leads = FM.filteredLeads || [];
  var dirs = unique(leads.map(function (l) { return l.DirectorName; }).filter(Boolean));
  var acctN = {};
  leads.forEach(function (l) {
    var a = l.AccountName;
    if (!a) return;
    acctN[a] = (acctN[a] || 0) + 1;
  });
  var topAcct = Object.keys(acctN).reduce(
    function (best, k) {
      return acctN[k] > best.c ? { name: k, c: acctN[k] } : best;
    },
    { name: '—', c: 0 }
  );
  var hi = leads.filter(function (l) {
    return l.Importance === 'High';
  }).length;
  var pipe = leads.filter(function (l) {
    return l.Status !== 'Closed Won' && l.Status !== 'Closed Lost';
  });
  var pipeTCV = pipe.reduce(function (s, l) {
    return s + (l.OppTCV || 0);
  }, 0);
  var exist = leads.filter(function (l) {
    return l.IsExistingCustomer;
  }).length;
  var insights = [
    {
      icon: '<svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>',
      label: 'Active Directors',
      value: String(dirs.length),
      sub: 'In filtered scope',
    },
    {
      icon: '<svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
      label: 'Top Account',
      value: topAcct.name.length > 18 ? topAcct.name.slice(0, 16) + '…' : topAcct.name,
      sub: topAcct.c + ' leads',
    },
    {
      icon: '<svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
      label: 'High Importance',
      value: String(hi),
      sub: 'Leads flagged High',
    },
    {
      icon: '<svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
      label: 'Pipeline TCV',
      value: formatAED(pipeTCV),
      sub: pipe.length + ' open leads',
    },
    {
      icon: '<svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/></svg>',
      label: 'Existing vs New',
      value: exist + ' / ' + (leads.length - exist),
      sub: 'Existing / new customers',
    },
  ];
  el.innerHTML = insights
    .map(function (ins) {
      var fs = String(ins.value).length > 10 ? '1rem' : '1.4rem';
      return (
        '<div class="insight-card">' +
        '<div class="insight-icon">' +
        ins.icon +
        '</div>' +
        '<div class="insight-label">' +
        ins.label +
        '</div>' +
        '<div class="insight-value" style="font-size:' +
        fs +
        '">' +
        escapeHtml(ins.value) +
        '</div>' +
        '<div class="insight-sub">' +
        escapeHtml(ins.sub) +
        '</div></div>'
      );
    })
    .join('');
}

var FM_THEME_BASE = 'blue';
var FM_THEME_DARK = false;

function fmApplySchemeToDocument() {
  var html = document.documentElement;
  html.removeAttribute('data-theme');
  if (FM_THEME_BASE === 'teal' && !FM_THEME_DARK) html.setAttribute('data-theme', 'teal');
  else if (FM_THEME_BASE === 'teal' && FM_THEME_DARK) html.setAttribute('data-theme', 'teal-dark');
  else if (FM_THEME_DARK) html.setAttribute('data-theme', 'dark');

  var icon = document.getElementById('fm-theme-icon');
  if (icon) {
    icon.innerHTML = FM_THEME_DARK
      ? '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>'
      : '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
  }
}

function fmChangeScheme(val) {
  FM_THEME_BASE = val === 'teal' ? 'teal' : 'blue';
  try {
    localStorage.setItem('fm_scheme', FM_THEME_BASE);
  } catch (e) {}
  fmApplySchemeToDocument();
  fmRefreshChartsAfterTheme();
}

function fmToggleLightDark() {
  FM_THEME_DARK = !FM_THEME_DARK;
  try {
    localStorage.setItem('fm_dark', String(FM_THEME_DARK));
  } catch (e) {}
  fmApplySchemeToDocument();
  fmRefreshChartsAfterTheme();
}

function fmHydrateThemeFromStorage() {
  try {
    var d = localStorage.getItem('fm_dark') === 'true';
    var s = localStorage.getItem('fm_scheme');
    var leg = localStorage.getItem('fm_theme');
    if (!s && leg) {
      if (leg === 'dark') {
        d = true;
        s = 'blue';
      } else if (leg === 'teal') {
        d = false;
        s = 'teal';
      } else if (leg === 'teal-dark') {
        d = true;
        s = 'teal';
      } else {
        s = 'blue';
      }
    }
    if (s !== 'teal') s = 'blue';
    FM_THEME_BASE = s;
    FM_THEME_DARK = !!d;
    fmApplySchemeToDocument();
    var sel = document.getElementById('fm-scheme-select');
    if (sel) sel.value = FM_THEME_BASE === 'teal' ? 'teal' : 'blue';
  } catch (e2) {}
}

function fmInitHeaderDate() {
  var dEl = document.getElementById('fm-current-date');
  if (dEl) {
    dEl.textContent = new Date().toLocaleDateString('en-GB', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }
}

function makeChart(id, config) {
  var canvas = document.getElementById(id);
  if (!canvas) return null;
  if (typeof Chart !== 'undefined' && Chart.getChart) {
    var old = Chart.getChart(canvas);
    if (old) {
      try { old.destroy(); } catch (e) {}
    }
  }
  delete FM.charts[id];
  var parent = canvas.parentNode;
  var newCanvas = document.createElement('canvas');
  newCanvas.id = id;
  parent.replaceChild(newCanvas, canvas);
  FM.charts[id] = new Chart(newCanvas, config);
  return FM.charts[id];
}

function renderDashboardCharts() {
  if (!fmChartsMasterOpen()) return;
  var sec = document.getElementById('analytics-section');
  if (!sec) return;
  destroyAnalyticsCharts();
  var leads = FM.filteredLeads;
  renderStatusChart(leads);
  renderImpChart(leads);
  renderWLChart(leads);
  renderTrendChart(leads);
  renderMRCChart(leads);
  renderFunnel(leads);
  renderRadar(leads);
  renderReasonsChart(leads);
  renderRelChart(leads);
  renderDuChart(leads);
  if (USER_CONTEXT.isAdmin) {
    renderLeaderboard(leads);
    renderTCVByDir(leads);
  }
  if (!USER_CONTEXT.isAM) {
    renderAMLeaderboard(leads);
    renderAMTCVChart(leads);
    renderAMMixChart(leads);
  }
  renderAging(leads);
  fmResizeAnalyticsChartsDeferred();
}

function renderStatusChart(leads) {
  var order  = ['New Lead','Open','In Progress','On Hold','Closed Won','Closed Lost'];
  var colors = ['#3B82F6','#22C55E','#F59E0B','#8B5CF6','#14B8A6','#EF4444'];
  var counts = order.map(function(s){ return leads.filter(function(l){ return l.Status===s; }).length; });
  makeChart('ch-status', {
    type: 'doughnut',
    data: { labels: order, datasets: [{ data: counts, backgroundColor: colors, borderWidth: 2, borderColor: '#fff', hoverOffset: 5 }] },
    options: { responsive:true, maintainAspectRatio:false, cutout:'65%', plugins:{ legend:{ position:'bottom', labels:{ font:{size:10}, padding:8, boxWidth:10, boxHeight:10 } } } }
  });
}

function renderImpChart(leads) {
  var keys   = ['High','Medium','Low'];
  var colors = ['#EF4444','#F59E0B','#22C55E'];
  var counts = keys.map(function(k){ return leads.filter(function(l){ return l.Importance===k; }).length; });
  makeChart('ch-imp', {
    type: 'doughnut',
    data: { labels: keys, datasets: [{ data: counts, backgroundColor: colors, borderWidth: 2, borderColor: '#fff', hoverOffset: 5 }] },
    options: { responsive:true, maintainAspectRatio:false, cutout:'60%', plugins:{ legend:{ position:'bottom', labels:{ font:{size:10}, padding:8, boxWidth:10, boxHeight:10 } } } }
  });
}

function renderWLChart(leads) {
  var won  = leads.filter(function(l){ return l.FinalStatus==='Won'; }).length;
  var lost = leads.filter(function(l){ return l.FinalStatus==='Lost'; }).length;
  var pipe = leads.filter(function(l){ return l.FinalStatus==='In Pipeline'; }).length;
  makeChart('ch-wl', {
    type: 'bar',
    data: { labels: ['Won','Lost','In Pipeline'], datasets: [{ data:[won,lost,pipe], backgroundColor:['#22C55E','#EF4444','#3B82F6'], borderRadius:5, borderSkipped:false }] },
    options: { indexAxis:'y', responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false} }, scales:{ x:{ grid:{color:'rgba(0,0,0,0.04)'}, ticks:{font:{size:10}} }, y:{ grid:{display:false}, ticks:{font:{size:11}} } } }
  });
}

function renderTrendChart(leads) {
  var months = getLast6Months();
  var data   = months.map(function(m){
    return leads.filter(function(l){ var d=new Date(l.LeadLoggedDate); return d.getMonth()===m.month && d.getFullYear()===m.year; }).length;
  });
  makeChart('ch-trend', {
    type: 'line',
    data: { labels: months.map(function(m){ return m.label; }), datasets: [{
      label:'Leads', data: data,
      borderColor: CLR.magenta, backgroundColor: 'rgba(192,0,106,0.08)',
      borderWidth:2.5, pointRadius:4, pointBackgroundColor: CLR.magenta, tension:0.35, fill:true,
    }] },
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}},
      scales:{ x:{grid:{display:false},ticks:{font:{size:10}}}, y:{grid:{color:'rgba(0,0,0,0.04)'},ticks:{font:{size:10},precision:0}} } }
  });
}

function renderMRCChart(leads) {
  var months = getLast6Months();
  var statGrps = ['Open','In Progress','Closed Won'];
  var stColors = [CLR.blue, CLR.amber, CLR.green];
  var datasets = statGrps.map(function(st, i){
    return {
      label: st,
      data: months.map(function(m){
        var ml = leads.filter(function(l){ var d=new Date(l.LeadLoggedDate); return d.getMonth()===m.month && d.getFullYear()===m.year && l.Status===st; });
        return Math.round(ml.reduce(function(s,l){ return s+(l.OppMRC||0); },0)/1000);
      }),
      backgroundColor: stColors[i], borderRadius: i===2?5:0, borderSkipped:false,
    };
  });
  makeChart('ch-mrc', {
    type: 'bar',
    data: { labels: months.map(function(m){ return m.label; }), datasets: datasets },
    options: { responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ position:'bottom', labels:{ font:{size:10}, boxWidth:10, boxHeight:10, padding:8 } } },
      scales:{ x:{stacked:true,grid:{display:false},ticks:{font:{size:10}}}, y:{stacked:true,grid:{color:'rgba(0,0,0,0.04)'},ticks:{font:{size:10},callback:function(v){return 'AED '+v+'K';}}} }
    }
  });
}

function renderFunnel(leads) {
  var wrap = document.getElementById('funnel-wrap');
  var stages = [
    { label:'Total Leads',  fn: function(l){ return true; },                              color: CLR.magenta },
    { label:'Interested',   fn: function(l){ return l.InterestedInOpp; },                color: CLR.purple },
    { label:'In Progress',  fn: function(l){ return ['In Progress','On Hold','Closed Won','Closed Lost'].includes(l.Status); }, color: CLR.blue },
    { label:'Closed',       fn: function(l){ return ['Closed Won','Closed Lost'].includes(l.Status); }, color: CLR.amber },
    { label:'Won',          fn: function(l){ return l.FinalStatus==='Won'; },             color: CLR.green },
  ];
  var counts = stages.map(function(s){ return leads.filter(s.fn).length; });
  var max    = counts[0] || 1;

  wrap.innerHTML = stages.map(function(s,i){
    var pct = Math.round(counts[i]/max*100);
    var stagePct = i===0 ? 100 : Math.round(counts[i]/((counts[i-1])||1)*100);
    return '<div class="funnel-row">' +
      '<div class="funnel-lbl">' + s.label + '</div>' +
      '<div class="funnel-bw"><div class="funnel-bar" style="width:' + pct + '%;background:' + s.color + '"><span>' + counts[i] + '</span></div></div>' +
      '<div class="funnel-cnt">' + counts[i] + '</div>' +
      '<div class="funnel-pct">' + (i===0?'100%':stagePct+'%') + '</div>' +
      '</div>';
  }).join('');
}

function renderRadar(leads) {
  var relMap = { 'Strong':3, 'Limited':2, 'No Relation':1 };
  var clrMap = { 'High':CLR.red, 'Medium':CLR.amber, 'Low':CLR.green };
  var datasets = ['High','Medium','Low'].map(function(imp){
    var gl = leads.filter(function(l){ return l.Importance===imp && l.OppMRC>0; });
    return {
      label: imp + ' importance',
      data: gl.map(function(l){ return { x: l.OppMRC/1000, y: relMap[l.RelationshipStrength]||1, r: Math.max(4,Math.min(18,l.OppTCV/50000)) }; }),
      backgroundColor: clrMap[imp] + '80',
      borderColor: clrMap[imp], borderWidth:1.5,
    };
  });
  makeChart('ch-radar', {
    type: 'bubble',
    data: { datasets: datasets },
    options: { responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ position:'bottom', labels:{ font:{size:10}, boxWidth:10, boxHeight:10, padding:8 } } },
      scales:{
        x:{ title:{display:true,text:"Opp MRC (AED '000)",font:{size:10}}, grid:{color:'rgba(0,0,0,0.04)'}, ticks:{font:{size:10}} },
        y:{ min:0, max:4, title:{display:true,text:'Relationship',font:{size:10}}, ticks:{stepSize:1,callback:function(v){ return ['','None','Limited','Strong',''][v]||''; },font:{size:10}}, grid:{color:'rgba(0,0,0,0.04)'} }
      }
    }
  });
}

function renderReasonsChart(leads) {
  var keys   = ['Price','Competition','Timing','Technical','Relationship','Other'];
  var colors = ['#EF4444','#F59E0B','#3B82F6','#8B5CF6','#22C55E','#9CA3AF'];
  var counts = keys.map(function(r){ return leads.filter(function(l){ return l.WinLossReason===r; }).length; });
  makeChart('ch-reasons', {
    type: 'doughnut',
    data: { labels: keys, datasets: [{ data: counts, backgroundColor: colors, borderWidth:2, borderColor:'#fff' }] },
    options: { responsive:true, maintainAspectRatio:false, cutout:'60%', plugins:{ legend:{ position:'bottom', labels:{ font:{size:9}, padding:6, boxWidth:8, boxHeight:8 } } } }
  });
}

function renderRelChart(leads) {
  var keys   = ['Strong','Limited','No Relation'];
  var colors = [CLR.green, CLR.amber, CLR.gray];
  var counts = keys.map(function(k){ return leads.filter(function(l){ return l.RelationshipStrength===k; }).length; });
  makeChart('ch-rel', {
    type: 'pie',
    data: { labels: keys, datasets: [{ data: counts, backgroundColor: colors, borderWidth:2, borderColor:'#fff' }] },
    options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom', labels:{ font:{size:10}, padding:8, boxWidth:10, boxHeight:10 } } } }
  });
}

function renderDuChart(leads) {
  var existing = leads.filter(function(l){ return l.IsExistingCustomer; }).length;
  var newCust  = leads.length - existing;
  makeChart('ch-du', {
    type: 'doughnut',
    data: { labels:['Existing du Customer','New Customer'], datasets:[{ data:[existing,newCust], backgroundColor:[CLR.magenta,CLR.blue], borderWidth:2, borderColor:'#fff', hoverOffset:5 }] },
    options: { responsive:true, maintainAspectRatio:false, cutout:'62%', plugins:{ legend:{ position:'bottom', labels:{ font:{size:10}, padding:8, boxWidth:10, boxHeight:10 } } } }
  });
}

function renderLeaderboard(leads) {
  var wrap = document.getElementById('leaderboard');
  var dirs = [];
  leads.forEach(function(l){ if (dirs.indexOf(l.DirectorName)===-1) dirs.push(l.DirectorName); });
  var stats = dirs.map(function(d){
    var dl  = leads.filter(function(l){ return l.DirectorName===d; });
    var tcv = dl.reduce(function(s,l){ return s+(l.OppTCV||0); },0);
    var won = dl.filter(function(l){ return l.FinalStatus==='Won'; }).length;
    var cl  = dl.filter(function(l){ return l.FinalStatus==='Won'||l.FinalStatus==='Lost'; }).length;
    return { name:d, total:dl.length, tcv:tcv, winRate: cl ? Math.round(won/cl*100) : 0 };
  }).sort(function(a,b){ return b.tcv-a.tcv; }).slice(0,6);

  var maxTCV = stats[0] ? stats[0].tcv : 1;
  var rankCls = ['gold','silver','bronze','','',''];

  wrap.innerHTML = stats.map(function(s,i){
    var inits = s.name.split(' ').map(function(w){ return w[0]; }).join('').substring(0,2);
    var shortName = s.name.split(' ')[0] + ' ' + (s.name.split(' ')[1]||'');
    return '<div class="lb-row">' +
      '<div class="lb-rank ' + rankCls[i] + '">' + (i+1) + '</div>' +
      '<div class="lb-av">' + inits + '</div>' +
      '<div class="lb-name">' + shortName + '</div>' +
      '<div class="lb-meta">' +
        '<div class="lb-m"><span class="lb-mv">' + s.total + '</span><span class="lb-ml">Leads</span></div>' +
        '<div class="lb-m"><span class="lb-mv">' + s.winRate + '%</span><span class="lb-ml">Win</span></div>' +
        '<div class="lb-m"><span class="lb-mv">' + formatAED(s.tcv) + '</span><span class="lb-ml">TCV</span></div>' +
      '</div>' +
      '<div class="lb-bw"><div class="lb-bf" style="width:' + Math.round(s.tcv/maxTCV*100) + '%"></div></div>' +
      '</div>';
  }).join('');
}

function renderAging(leads) {
  var tbody = document.getElementById('aging-tbody');
  var today = new Date();
  var open  = leads
    .filter(function(l){ return l.Status!=='Closed Won' && l.Status!=='Closed Lost'; })
    .map(function(l){ return Object.assign({}, l, { ageDays: Math.floor((today - new Date(l.LeadLoggedDate))/86400000) }); })
    .sort(function(a,b){ return b.ageDays-a.ageDays; })
    .slice(0,10);

  tbody.innerHTML = open.map(function(l){
    var cls  = l.ageDays<14 ? 'age-g' : l.ageDays<30 ? 'age-a' : 'age-r';
    var flag = l.ageDays<14 ? '<14d' : l.ageDays<30 ? '14-30d' : '>30d';
    return '<tr>' +
      '<td style="font-weight:700;color:var(--magenta)">' + l.Title + '</td>' +
      '<td>' + l.AccountName + '</td>' +
      '<td><span class="sp ' + statusClass(l.Status) + '">' + l.Status + '</span></td>' +
      '<td>' + l.ageDays + 'd</td>' +
      '<td><span class="' + cls + '">' + flag + '</span></td>' +
      '</tr>';
  }).join('');
}

function renderTCVByDir(leads) {
  var dirs = [];
  leads.forEach(function(l){ if (dirs.indexOf(l.DirectorName)===-1) dirs.push(l.DirectorName); });
  var data = dirs.map(function(d){
    return { name:d, tcv: leads.filter(function(l){ return l.DirectorName===d; }).reduce(function(s,l){ return s+(l.OppTCV||0); },0) };
  }).sort(function(a,b){ return b.tcv-a.tcv; });

  makeChart('ch-tcvdir', {
    type: 'bar',
    data: {
      labels: data.map(function(d){ var p=d.name.split(' '); return p[0]+' '+(p[1]?p[1][0]+'.':''); }),
      datasets: [{ label:'TCV (AED)', data: data.map(function(d){ return Math.round(d.tcv/1000); }),
        backgroundColor: data.map(function(_,i){ return i===0?CLR.magenta:CLR.magentaL; }), borderRadius:6, borderSkipped:false }]
    },
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}},
      scales:{ x:{grid:{display:false},ticks:{font:{size:10}}}, y:{grid:{color:'rgba(0,0,0,0.04)'},ticks:{font:{size:10},callback:function(v){return 'AED '+v+'K';}}} }
    }
  });
}

/* ════════════════════════════════════════════════════════
   ACCOUNT MANAGER PERFORMANCE CHARTS
   ════════════════════════════════════════════════════════ */
function _amStats(leads) {
  var ams = unique(leads.map(function(l){ return l.LocalAMName; })).filter(Boolean);
  return ams.map(function(name){
    var dl  = leads.filter(function(l){ return l.LocalAMName === name; });
    var tcv = dl.reduce(function(s,l){ return s+(l.OppTCV||0); },0);
    var mrc = dl.reduce(function(s,l){ return s+(l.OppMRC||0); },0);
    var won = dl.filter(function(l){ return l.FinalStatus==='Won'; }).length;
    var lost= dl.filter(function(l){ return l.FinalStatus==='Lost'; }).length;
    var cl  = won + lost;
    var dir = (dl[0] && dl[0].DirectorName) || '';
    return { name:name, director:dir, total:dl.length, tcv:tcv, mrc:mrc, won:won, lost:lost, winRate: cl ? Math.round(won/cl*100) : 0 };
  }).sort(function(a,b){ return b.tcv - a.tcv; });
}

function renderAMLeaderboard(leads) {
  var wrap = document.getElementById('am-leaderboard');
  if (!wrap) return;
  var stats = _amStats(leads).slice(0, 8);
  if (stats.length === 0) {
    wrap.innerHTML = '<div class="sh-sub" style="padding:14px;text-align:center">No account managers in scope.</div>';
    return;
  }
  var maxTCV = stats[0].tcv || 1;
  var rankCls = ['gold','silver','bronze','','','','',''];
  wrap.innerHTML = stats.map(function(s,i){
    var inits = initialsOf(s.name);
    var pretty = s.name;
    return '<div class="lb-row">' +
      '<div class="lb-rank ' + rankCls[i] + '">' + (i+1) + '</div>' +
      '<div class="lb-av">' + inits + '</div>' +
      '<div class="lb-name">' + escapeHtml(pretty) + (s.director ? '<div style="font-size:10px;color:var(--text-muted)">Reports to ' + escapeHtml(s.director) + '</div>' : '') + '</div>' +
      '<div class="lb-meta">' +
        '<div class="lb-m"><span class="lb-mv">' + s.total + '</span><span class="lb-ml">Leads</span></div>' +
        '<div class="lb-m"><span class="lb-mv">' + s.winRate + '%</span><span class="lb-ml">Win</span></div>' +
        '<div class="lb-m"><span class="lb-mv">' + formatAED(s.tcv) + '</span><span class="lb-ml">TCV</span></div>' +
      '</div>' +
      '<div class="lb-bw"><div class="lb-bf" style="width:' + Math.round(s.tcv/maxTCV*100) + '%"></div></div>' +
      '</div>';
  }).join('');
}

function renderAMTCVChart(leads) {
  var canvas = document.getElementById('ch-amtcv');
  if (!canvas) return;
  var stats = _amStats(leads);
  var labels = stats.map(function(s){ var p=s.name.split(' '); return p[0]+' '+(p[1]?p[1][0]+'.':''); });
  var data   = stats.map(function(s){ return Math.round((s.tcv||0)/1000); });
  makeChart('ch-amtcv', {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{ label:'TCV (AED K)', data: data,
        backgroundColor: data.map(function(_,i){ return i===0?CLR.magenta:(i===1?CLR.purple:CLR.magentaL); }),
        borderRadius:6, borderSkipped:false }]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label:function(c){ return 'AED ' + c.parsed.y + 'K'; } } } },
      scales:{ x:{grid:{display:false},ticks:{font:{size:10}}}, y:{grid:{color:'rgba(0,0,0,0.04)'},ticks:{font:{size:10},callback:function(v){return 'AED '+v+'K';}}} }
    }
  });
}

function renderAMMixChart(leads) {
  var canvas = document.getElementById('ch-ammix');
  if (!canvas) return;
  var stats = _amStats(leads).slice(0, 6);
  var statuses = ['New Lead','Open','In Progress','On Hold','Closed Won','Closed Lost'];
  var colors   = ['#3B82F6','#22C55E','#F59E0B','#8B5CF6','#14B8A6','#EF4444'];
  var datasets = statuses.map(function(st, i){
    return {
      label: st,
      data: stats.map(function(s){
        return leads.filter(function(l){ return l.LocalAMName === s.name && l.Status === st; }).length;
      }),
      backgroundColor: colors[i], borderRadius: i === statuses.length-1 ? 4 : 0, borderSkipped:false,
    };
  });
  makeChart('ch-ammix', {
    type: 'bar',
    data: {
      labels: stats.map(function(s){ var p=s.name.split(' '); return p[0]+' '+(p[1]?p[1][0]+'.':''); }),
      datasets: datasets,
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ position:'bottom', labels:{ font:{size:10}, boxWidth:10, boxHeight:10, padding:8 } } },
      scales:{ x:{stacked:true,grid:{display:false},ticks:{font:{size:10}}}, y:{stacked:true,grid:{color:'rgba(0,0,0,0.04)'},ticks:{font:{size:10},precision:0}} }
    }
  });
}

/* ════════════════════════════════════════════════════════
   MY LEADS
   ════════════════════════════════════════════════════════ */
function renderMyLeads() {
  var f = FM.filters;
  var ue = USER_CONTEXT.userEmail;
  var un = normName(USER_CONTEXT.userName);
  var leads = FM.scopedLeads.filter(function(l){
    if (!activeMulti(f.mlStatus) && f.mlStatus.indexOf(l.Status)         === -1) return false;
    if (!activeMulti(f.mlImp)    && f.mlImp.indexOf(l.Importance)        === -1) return false;
    if (!activeMulti(f.mlDir)    && f.mlDir.indexOf(l.DirectorName)      === -1) return false;
    if (!activeMulti(f.mlAM)     && f.mlAM.indexOf(l.LocalAMName)        === -1) return false;
    if (!activeMulti(f.mlAcct)   && f.mlAcct.indexOf(l.AccountName)      === -1) return false;
    if (f.mlOwner === 'mine') {
      var mine = normName(l.SubmittedBy) === un ||
                 normEmail(l.DirectorEmail) === ue ||
                 normEmail(l.LocalAMEmail)  === ue;
      if (!mine) return false;
    }
    if (f.mlSearch) {
      var hay = ((l.Title||'') + ' ' + (l.AccountName||'') + ' ' + (l.DirectorName||'') + ' ' + (l.LocalAMName||'') + ' ' + (l.Status||'') + ' ' + (l.Importance||'')).toLowerCase();
      if (hay.indexOf(f.mlSearch.toLowerCase()) === -1) return false;
    }
    return true;
  });

  leads.sort(function(a,b){ return new Date(b.LeadLoggedDate)-new Date(a.LeadLoggedDate); });

  // AG Grid view (primary)
  initLeadsGrid();
  if (FM.grid.leads && FM.grid.leads.api) {
    try {
      FM.grid.leads.api.setGridOption('rowData', leads);
    } catch (e) {
      // Fallback for older API shapes
      try { FM.grid.leads.api.setRowData(leads); } catch (e2) {}
    }
    try {
      FM.grid.leads.api.setGridOption('quickFilterText', f.mlSearch || '');
    } catch (e3) {
      try {
        if (typeof FM.grid.leads.api.setQuickFilter === 'function') {
          FM.grid.leads.api.setQuickFilter(f.mlSearch || '');
        }
      } catch (e4) {}
    }
  }

  var cnt = document.getElementById('my-leads-count');
  if (cnt) cnt.textContent = leads.length + ' lead' + (leads.length!==1?'s':'');
  var badge = document.getElementById('badge-my');
  if (badge) badge.textContent = leads.length;
}

function clearLeadsFilters() {
  FM.filters.mlStatus = ['all'];
  FM.filters.mlImp    = ['all'];
  FM.filters.mlDir    = ['all'];
  FM.filters.mlAM     = ['all'];
  FM.filters.mlAcct   = ['all'];
  FM.filters.mlOwner  = 'all';
  FM.filters.mlSearch = '';
  resetMSAll('ms-ml-status', 'All Statuses');
  resetMSAll('ms-ml-imp',    'All');
  resetMSAll('ms-ml-dir',    'All Directors');
  resetMSAll('ms-ml-am',     'All Account Managers');
  resetMSAll('ms-ml-acct',   'All Accounts');
  var s = document.getElementById('ag-search'); if (s) s.value = '';
  setOwnerFilter('all');
  renderMyLeads();
}

function clearActivityFilters() {
  FM.filters.alLead   = 'all';
  FM.filters.alType   = 'all';
  FM.filters.alUser   = 'all';
  FM.filters.alDir    = 'all';
  FM.filters.alPeriod = 'all';
  resetMSUI('ms-al-lead',   'all', 'All Leads');
  resetMSUI('ms-al-type',   'all', 'All Changes');
  resetMSUI('ms-al-user',   'all', 'All Users');
  resetMSUI('ms-al-dir',    'all', 'All');
  resetMSUI('ms-al-period', 'all', 'All Time');
  var s = document.getElementById('al-text-search'); if (s) s.value = '';
  renderActivityLog();
}

function setOwnerFilter(mode) {
  FM.filters.mlOwner = mode;
  var btnMine = document.getElementById('btn-mine');
  var btnAll  = document.getElementById('btn-all');
  if (btnMine && btnAll) {
    btnMine.classList.toggle('active', mode === 'mine');
    btnAll.classList.toggle('active',  mode === 'all');
  }
  renderMyLeads();
}

function agQuickFilter(val) {
  FM.filters.mlSearch = val || '';
  renderMyLeads();
}

/* ════════════════════════════════════════════════════════
   ACTIVITY LOG
   ════════════════════════════════════════════════════════ */
function populateActivityLeadFilter() {
  var leadRefs = unique(FM.scopedLeads.map(function(l){ return l.Title; }));
  var byTitle = {};
  FM.scopedLeads.forEach(function(l){ byTitle[l.Title] = l.AccountName; });
  fillMSList('ms-al-lead-list', leadRefs, function(t){
    var label = escapeHtml(t) + ' — ' + escapeHtml(byTitle[t] || '');
    return '<div class="ms-option" data-val="' + escapeHtml(t) + '" onclick="selectALFilter(\'ms-al-lead\',\'alLead\',\'' + escapeAttr(t) + '\',\'' + escapeAttr(t) + '\')"><div class="ms-chk"></div>' + label + '</div>';
  });
}

function populateActivityUserFilter() {
  var users = unique(FM.scopedActivities.map(activityActorName).filter(Boolean)).sort();
  fillMSList('ms-al-user-list', users, function(u){
    return '<div class="ms-option" data-val="' + escapeHtml(u) + '" onclick="selectALFilter(\'ms-al-user\',\'alUser\',\'' + escapeAttr(u) + '\',\'' + escapeAttr(u) + '\')"><div class="ms-chk"></div>' + escapeHtml(u) + '</div>';
  });
}

function populateActivityDirFilter() {
  // Directors derived from scoped leads → activity director resolution by LeadRef
  var dirByRef = {};
  FM.scopedLeads.forEach(function(l){ dirByRef[l.Title] = l.DirectorName; });
  FM._dirByRef = dirByRef;
  var dirs = unique(FM.scopedLeads.map(function(l){ return l.DirectorName; })).sort();
  fillMSList('ms-al-dir-list', dirs, function(d){
    return '<div class="ms-option" data-val="' + escapeHtml(d) + '" onclick="selectALFilter(\'ms-al-dir\',\'alDir\',\'' + escapeAttr(d) + '\',\'' + escapeAttr(d) + '\')"><div class="ms-chk"></div>' + escapeHtml(d) + '</div>';
  });
}

function renderActivityLog() {
  var f = FM.filters;
  var now = new Date();
  var search = (document.getElementById('al-text-search') || {}).value || '';
  search = search.trim().toLowerCase();

  var acts = FM.scopedActivities.filter(function(a){
    if (f.alLead !== 'all' && a.LeadRef !== f.alLead) return false;
    if (f.alType !== 'all' && a.ChangeField !== f.alType) return false;
    if (f.alUser !== 'all' && activityActorName(a) !== f.alUser) return false;
    if (f.alDir  !== 'all') {
      var dir = (FM._dirByRef || {})[a.LeadRef];
      if (dir !== f.alDir) return false;
    }
    var p = f.alPeriod;
    if (p === 'today') { var d=new Date(a.ChangedOn); if(d.toDateString()!==now.toDateString()) return false; }
    if (p === 'week')  { if ((now-new Date(a.ChangedOn))/86400000 > 7) return false; }
    if (p === 'month') { var d2=new Date(a.ChangedOn); if(d2.getMonth()!==now.getMonth()||d2.getFullYear()!==now.getFullYear()) return false; }
    if (search) {
      var hay = ((a.Title||'') + ' ' + (a.OldValue||'') + ' ' + (a.NewValue||'') + ' ' + (a.LeadRef||'') + ' ' + activityActorName(a)).toLowerCase();
      if (hay.indexOf(search) === -1) return false;
    }
    return true;
  });

  var container = document.getElementById('activity-timeline');
  if (!container) return;
  if (acts.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);font-size:13px">No activity found for selected filters.</div>';
    return;
  }

  container.innerHTML = acts.slice(0,80).map(function(a){
    var dotCls = activityDotClass(a.ChangeField);
    var dotSVG = activitySVG(a.ChangeField);
    var dt = new Date(a.ChangedOn);
    var dtStr = dt.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) + ' ' + dt.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
    var who = activityActorName(a) || 'Unknown';
    var changeHTML = (a.OldValue && a.NewValue)
      ? '<div class="tl-change"><span class="tl-old">' + escapeHtml(a.OldValue) + '</span><span class="tl-arr">\u2192</span><span class="tl-new">' + escapeHtml(a.NewValue) + '</span></div>'
      : '';
    return '<div class="tl-item">' +
      '<div class="tl-dot ' + dotCls + '">' + dotSVG + '</div>' +
      '<div class="tl-content">' +
        '<div class="tl-hdr"><span class="tl-ttl">' + escapeHtml(a.Title) + '</span><span class="tl-time">' + dtStr + '</span></div>' +
        '<div class="tl-body">By: ' + escapeHtml(who) + '</div>' +
        changeHTML +
        '<span class="tl-ref">' + escapeHtml(a.LeadRef || '') + '</span>' +
      '</div>' +
      '</div>';
  }).join('');
}

function activityDotClass(field) {
  var map = { Created:'tld-create', Status:'tld-status', FollowUpDate:'tld-followup', FinalStatus:'tld-close' };
  return map[field] || 'tld-edit';
}

function activitySVG(field) {
  var svgs = {
    Created:     '<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    Status:      '<svg viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>',
    FollowUpDate:'<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    FinalStatus: '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>',
  };
  return svgs[field] || '<svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
}

/* ════════════════════════════════════════════════════════
   OVERDUE
   ════════════════════════════════════════════════════════ */
function checkOverdue() {
  var today = new Date(); today.setHours(0,0,0,0);
  var overdue = FM.scopedLeads.filter(function(l){
    if (l.Status==='Closed Won'||l.Status==='Closed Lost') return false;
    if (!l.FollowUpDate) return false;
    var fu = new Date(l.FollowUpDate); fu.setHours(0,0,0,0);
    return fu < today;
  });
  var banner = document.getElementById('overdue-banner');
  var badge  = document.getElementById('badge-overdue');
  if (badge) badge.textContent = overdue.length;
  if (!banner) return;
  if (overdue.length > 0) {
    banner.classList.add('show');
    var t = document.getElementById('overdue-text');
    if (t) t.textContent = overdue.length + ' lead' + (overdue.length>1?'s have':' has') + ' overdue follow-up dates';
  } else {
    banner.classList.remove('show');
  }
}

/* ════════════════════════════════════════════════════════
   FORM LOGIC
   ════════════════════════════════════════════════════════ */
function setFormDefaults() {
  FM.editingLeadItemId = null;
  // Lead Date must be user-selected (do not auto-set).
  var lid = document.getElementById('f-lead-id');
  if (lid) lid.value = peekNextLeadId();
  var sbm = document.getElementById('f-submitted-by');
  if (sbm) sbm.value = FM.currentUser.name || '';
}

function onStatusChange() {
  var status    = document.getElementById('f-status').value;
  var isClosed  = status==='Closed Won'||status==='Closed Lost';
  var finalEl   = document.getElementById('f-final-status');
  var wlEl      = document.getElementById('f-wl-reason');
  finalEl.disabled = !isClosed; wlEl.disabled = !isClosed;
  if (!isClosed) { finalEl.value=''; wlEl.value=''; }
  if (status==='Closed Won')  finalEl.value='Won';
  if (status==='Closed Lost') finalEl.value='Lost';
}

function onNewAccountToggle() {
  var isNew = document.getElementById('f-new-account').checked;
  var cEl   = document.getElementById('f-account-code');
  if (isNew) { cEl.value='NEW'; cEl.classList.add('ro'); cEl.readOnly=true; }
  else { if(cEl.value==='NEW') cEl.value=''; cEl.classList.remove('ro'); cEl.readOnly=false; }
}

function onInterestedToggle() {
  var interested = document.getElementById('f-interested').checked;
  var section    = document.getElementById('section-revenue');
  section.style.opacity = interested ? '1' : '0.4';
  section.querySelectorAll('input,select').forEach(function(el){ el.disabled = !interested; });
}

function calcTCV() {
  var mrc  = parseFloat(document.getElementById('f-opp-mrc').value) || 0;
  var dur  = parseInt(document.getElementById('f-duration').value) || 12;
  document.getElementById('tcv-display').textContent = 'AED ' + (mrc*dur).toLocaleString();
}

function checkDuplicate(val) {
  if (!val || val.length < 3) { document.getElementById('dup-warn').classList.remove('show'); return; }
  var dup = FM.allLeads.find(function(l){
    return l.AccountName.toLowerCase().indexOf(val.toLowerCase()) !== -1 &&
           l.Status!=='Closed Won' && l.Status!=='Closed Lost';
  });
  var warn = document.getElementById('dup-warn');
  if (dup) {
    document.getElementById('dup-warn-txt').textContent = 'Possible duplicate \u2014 "' + dup.Title + '" is already open for ' + dup.AccountName;
    warn.classList.add('show');
  } else { warn.classList.remove('show'); }
}

function lookupDirectorEmail() {
  var name = document.getElementById('f-dir-name').value;
  document.getElementById('f-dir-email').value = name.length > 3 ? name.toLowerCase().replace(/ /g,'.') + '@du.ae' : '';
}

function lookupAMEmail() {
  var name = document.getElementById('f-am-name').value;
  document.getElementById('f-am-email').value = name.length > 3 ? name.toLowerCase().replace(/ /g,'.') + '@du.ae' : '';
}

/* ── VALIDATION ──────────────────────────────────────── */
function validateForm() {
  var valid = true;
  var checks = [
    { id:'f-lead-date',        err:'err-lead-date', fn:function(v){ return parseDateOnlyToIso(v) !== null; } },
    { id:'f-imp',             err:'err-imp',      fn:function(v){ return v!==''; } },
    { id:'f-request-details', err:'err-details',  fn:function(v){ return v.trim().length>5; } },
    { id:'f-account-name',    err:'err-account',  fn:function(v){ return v.trim().length>0; } },
    { id:'f-rel',             err:'err-rel',       fn:function(v){ return v!==''; } },
    { id:'f-dir-name',        err:'err-director',  fn:function(v){ return v.trim().length>0; } },
  ];
  checks.forEach(function(c){
    var el  = document.getElementById(c.id);
    var err = document.getElementById(c.err);
    if (!c.fn(el.value)) { err.classList.add('show'); valid=false; }
    else err.classList.remove('show');
  });
  var fuDate = document.getElementById('f-followup-date').value;
  if (fuDate) {
    var fu=new Date(fuDate), now=new Date(); now.setHours(0,0,0,0);
    var errEl = document.getElementById('err-followup');
    if (fu<now) { errEl.classList.add('show'); valid=false; } else errEl.classList.remove('show');
  }
  return valid;
}

/* ── SUBMIT ──────────────────────────────────────────── */
function submitLead() {
  if (!validateForm()) { showToast('Please fix the errors above', 'error'); return; }

  var mrc     = parseFloat(document.getElementById('f-opp-mrc').value) || 0;
  var durStr  = (document.getElementById('f-duration').value || '12').trim();
  var durNum  = parseInt(durStr, 10) || 12;
  var leadDateIso = parseDateOnlyToIso(document.getElementById('f-lead-date').value);
  if (!leadDateIso) { showToast('Please select a Lead Date', 'error'); return; }

  var editingSpId = FM.editingLeadItemId;
  var leadId;
  if (editingSpId != null) {
    leadId = (document.getElementById('f-lead-id').value || '').trim();
    if (!leadId) {
      showToast('Lead ID missing — reopen the lead and try again', 'error');
      return;
    }
  } else {
    leadId = reserveNextLeadId();
    document.getElementById('f-lead-id').value = leadId;
  }

  var payload = {
    Title:               leadId,
    LeadLoggedDate:      leadDateIso,
    Status:              document.getElementById('f-status').value,
    AccountName:         document.getElementById('f-account-name').value,
    AccountCode:         document.getElementById('f-account-code').value,
    IsNewAccount:        document.getElementById('f-new-account').checked,
    IsExistingCustomer:  document.getElementById('f-existing-customer').checked,
    RequestDetails:      document.getElementById('f-request-details').value,
    Importance:          document.getElementById('f-imp').value,
    InterestedInOpp:     document.getElementById('f-interested').checked,
    DirectorName:        document.getElementById('f-dir-name').value,
    DirectorEmail:       document.getElementById('f-dir-email').value,
    LocalAMName:         document.getElementById('f-am-name').value,
    LocalAMEmail:        document.getElementById('f-am-email').value,
    RelationshipStrength:document.getElementById('f-rel').value,
    CurrentLines:        parseInt(document.getElementById('f-cur-lines').value)||0,
    CurrentRevenueMRC:   parseFloat(document.getElementById('f-cur-mrc').value)||0,
    OppLines:            parseInt(document.getElementById('f-opp-lines').value)||0,
    OppMRC:              mrc,
    ContractDuration:    durStr || String(durNum),
    OppTCV:              mrc * durNum,
   WinLossReason:       document.getElementById('f-wl-reason').value,
    FinalStatus:         document.getElementById('f-final-status').value || 'In Pipeline',
    OppConclusion:       document.getElementById('f-conclusion').value,
    FollowUpDate:        parseDateOnlyToIso(document.getElementById('f-followup-date').value) || '',
    FollowUpNotes:       document.getElementById('f-followup-notes').value,
    SubmittedBy:         FM.currentUser.name,
  };

  if (FM_CONFIG.DUMMY_MODE) {
    if (editingSpId != null) {
      var di = FM.allLeads.findIndex(function (l) { return l.ID === editingSpId; });
      if (di === -1) {
        showToast('Lead not found', 'error');
        return;
      }
      payload.ID = editingSpId;
      FM.allLeads[di] = Object.assign({}, FM.allLeads[di], payload);
      FM.editingLeadItemId = null;
      applyDataScope();
      logActivity('Edit', '', payload.Status, payload.Title);
      showToast('Lead ' + leadId + ' updated', 'success');
    } else {
      payload.ID = FM.leadCounter++;
      FM.allLeads.unshift(payload);
      applyDataScope();
      logActivity('Created', '', payload.Status, payload.Title);
      if (payload.Importance === 'High') showToast('High importance lead \u2014 ' + payload.DirectorName + ' would be notified', 'info');
      showToast('Lead ' + leadId + ' submitted successfully', 'success');
    }
    resetForm();
    switchPanel('my-leads', document.querySelector('[data-panel=my-leads]'), { resetNewLead: false });
    populateDirectorFilters();
    populateAMFilters();
    populateAccountFilters();
    populateActivityLeadFilter();
    applyFilters();
    renderMyLeads();
    renderActivityLog();
    checkOverdue();
  } else {
    var saveReq =
      editingSpId != null
        ? spMerge(FM_CONFIG.LIST_LEADS, editingSpId, spCleanLeadItemForRest(payload, { isUpdate: true }))
        : spPost(FM_CONFIG.LIST_LEADS, spCleanLeadItemForRest(payload));
    saveReq
      .then(function (res) {
        if (!res.ok) {
          showToast('Submit failed \u2014 check console', 'error');
          return res.text().then(function (t) { console.error(t); });
        }
        var goMyLeads = function () {
          switchPanel('my-leads', document.querySelector('[data-panel=my-leads]'), { resetNewLead: false });
        };
        if (editingSpId != null) {
          logActivitySP('Updated', '', payload.Status, payload.Title);
          showToast('Lead ' + leadId + ' updated', 'success');
          FM.editingLeadItemId = null;
          resetForm();
          return loadAllData().then(goMyLeads);
        }
        return res.json().then(function () {
          logActivitySP('Created', '', payload.Status, payload.Title);
          showToast('Lead ' + leadId + ' submitted', 'success');
          resetForm();
          return loadAllData();
        }).then(goMyLeads);
      })
      .catch(function (e) { showToast('Network error \u2014 check console', 'error'); console.error(e); });
  }
}

function resetForm() {
  FM.editingLeadItemId = null;
  ['f-lead-date','f-request-details','f-account-name','f-account-code','f-dir-name','f-dir-email','f-am-name','f-am-email','f-cur-lines','f-cur-mrc','f-opp-lines','f-opp-mrc','f-conclusion','f-followup-date','f-followup-notes']
    .forEach(function(id){ var el=document.getElementById(id); if(el) el.value=''; });
  document.getElementById('f-status').value     = 'New Lead';
  document.getElementById('f-imp').value        = '';
  document.getElementById('f-rel').value        = '';
  document.getElementById('f-duration').value   = '12';
  document.getElementById('f-new-account').checked    = false;
  document.getElementById('f-existing-customer').checked = false;
  document.getElementById('f-interested').checked = true;
  document.getElementById('f-final-status').value    = '';
  document.getElementById('f-final-status').disabled  = true;
  document.getElementById('f-wl-reason').value       = '';
  document.getElementById('f-wl-reason').disabled    = true;
  document.getElementById('tcv-display').textContent = 'AED 0';
  document.getElementById('section-revenue').style.opacity = '1';
  document.querySelectorAll('#section-revenue input, #section-revenue select').forEach(function(el){ el.disabled=false; });
  document.querySelectorAll('.ferr').forEach(function(el){ el.classList.remove('show'); });
  document.getElementById('dup-warn').classList.remove('show');
  setFormDefaults();
}

/* ── ACTIVITY LOG ────────────────────────────────────── */
function logActivity(changeField, oldValue, newValue, leadRef) {
  FM.allActivities.unshift({
    ID: FM.allActivities.length+1,
    Title: changeField==='Created' ? 'Lead created: '+leadRef : changeField+' \u2192 '+newValue,
    LeadRef: leadRef, ChangeField: changeField,
    OldValue: oldValue, NewValue: newValue,
    ChangedBy: FM.currentUser.name,
    ChangedOn: new Date().toISOString(),
  });
}

function logActivitySP(changeField, oldValue, newValue, leadRef) {
  var titleSuffix = changeField === 'Created' ? 'Lead created: ' + leadRef : changeField + ' \u2192 ' + (newValue != null ? String(newValue) : '');
  if (titleSuffix.length > 240) titleSuffix = titleSuffix.slice(0, 237) + '...';
  spPost(FM_CONFIG.LIST_ACT, spCleanActivityItemForRest({
    Title: titleSuffix,
    LeadRef: leadRef, ChangeField: changeField,
    OldValue: oldValue, NewValue: newValue,
    ChangedBy: FM.currentUser.name,
    ChangedOn: new Date().toISOString(),
})).catch(function(e){ console.error('Activity log POST failed:', e); showToast('Activity log failed — check console', 'error'); });
}

/* ── EDIT LEAD ───────────────────────────────────────── */
function editLead(id) {
  var lead = FM.allLeads.find(function(l){ return l.ID===id; });
  if (!lead) return;
  switchPanel('input-form', document.querySelector('[data-panel=input-form]'), { resetNewLead: false });
  FM.editingLeadItemId = id;
  document.getElementById('f-lead-id').value       = lead.Title;
  document.getElementById('f-lead-date').value     = new Date(lead.LeadLoggedDate).toISOString().split('T')[0];
  document.getElementById('f-status').value        = lead.Status;
  document.getElementById('f-imp').value           = lead.Importance;
  document.getElementById('f-request-details').value = lead.RequestDetails;
  document.getElementById('f-account-name').value  = lead.AccountName;
  document.getElementById('f-account-code').value  = lead.AccountCode;
  document.getElementById('f-new-account').checked     = lead.IsNewAccount;
  document.getElementById('f-existing-customer').checked = lead.IsExistingCustomer;
  document.getElementById('f-interested').checked  = lead.InterestedInOpp;
  document.getElementById('f-rel').value           = lead.RelationshipStrength;
  document.getElementById('f-dir-name').value      = lead.DirectorName;
  document.getElementById('f-dir-email').value     = lead.DirectorEmail;
  document.getElementById('f-am-name').value       = lead.LocalAMName;
  document.getElementById('f-am-email').value      = lead.LocalAMEmail;
  document.getElementById('f-cur-lines').value     = lead.CurrentLines;
  document.getElementById('f-cur-mrc').value       = lead.CurrentRevenueMRC;
  document.getElementById('f-opp-lines').value     = lead.OppLines;
  document.getElementById('f-opp-mrc').value       = lead.OppMRC;
  document.getElementById('f-duration').value      = lead.ContractDuration;
  calcTCV();
  onStatusChange();
  document.getElementById('f-final-status').value  = lead.FinalStatus;
  document.getElementById('f-wl-reason').value     = lead.WinLossReason;
  document.getElementById('f-conclusion').value    = lead.OppConclusion;
  if (lead.FollowUpDate) document.getElementById('f-followup-date').value = new Date(lead.FollowUpDate).toISOString().split('T')[0];
  document.getElementById('f-followup-notes').value = lead.FollowUpNotes;
}

/* ── DELETE LEAD ─────────────────────────────────────── */
function spDelete(list, itemId) {
  return getDigest().then(function(digest) {
    return fetch(
      FM_CONFIG.SITE_URL + "/_api/web/lists/getbytitle('" + list + "')/items(" + itemId + ")",
      {
        method: 'POST',
        headers: {
          Accept: 'application/json;odata=verbose',
          'X-RequestDigest': digest,
          'X-HTTP-Method': 'DELETE',
          'IF-MATCH': '*',
        },
      }
    );
  });
}

function deleteLead(id) {
  var lead = FM.allLeads.find(function(l){ return l.ID===id; });
  if (!lead) return;
  if (!confirm('Delete lead ' + lead.Title + ' ? This cannot be undone.')) return;

  if (FM_CONFIG.DUMMY_MODE) {
    FM.allLeads = FM.allLeads.filter(function(l){ return l.ID !== id; });
    applyDataScope();
    logActivity('Edit', 'Active', 'Deleted', lead.Title);
    showToast('Lead deleted', 'success');
    populateDirectorFilters();
    populateAMFilters();
    populateAccountFilters();
    populateActivityLeadFilter();
    applyFilters();
    renderMyLeads();
    renderActivityLog();
    checkOverdue();
  } else {
    spDelete(FM_CONFIG.LIST_LEADS, id)
      .then(function(res){
        if (res.ok) {
          logActivitySP('Edit', 'Active', 'Deleted', lead.Title);
          showToast('Lead deleted', 'success');
          return loadAllData();
        } else {
          showToast('Delete failed — check console', 'error');
          res.text().then(function(t){ console.error(t); });
        }
      })
      .catch(function(e){ showToast('Network error — check console','error'); console.error(e); });
  }
}

/* ── EXPORT ──────────────────────────────────────────── */
function exportLeads() {
  var headers = ['Lead ID','Account','Status','Importance','Director','Opp MRC','TCV','Final Status','Logged Date'];
  var rows = FM.filteredLeads.map(function(l){
    return [l.Title, l.AccountName, l.Status, l.Importance, l.DirectorName, l.OppMRC, l.OppTCV, l.FinalStatus, new Date(l.LeadLoggedDate).toLocaleDateString('en-GB')];
  });
  var csv  = [headers].concat(rows).map(function(r){ return r.map(function(v){ return '"'+v+'"'; }).join(','); }).join('\n');
  var blob = new Blob([csv], { type:'text/csv' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href = url; a.download = 'FreeMove_Leads_' + new Date().toLocaleDateString('en-GB').replace(/\//g,'-') + '.csv';
  a.click(); URL.revokeObjectURL(url);
  showToast('Leads exported to CSV', 'success');
}

/* ════════════════════════════════════════════════════════
   HELPERS
   ════════════════════════════════════════════════════════ */
function formatAED(val) {
  if (val >= 1000000) return 'AED ' + (val/1000000).toFixed(1) + 'M';
  if (val >= 1000)    return 'AED ' + Math.round(val/1000) + 'K';
  return 'AED ' + val.toLocaleString();
}

function getLast6Months() {
  var months = [];
  var now    = new Date();
  for (var i=5; i>=0; i--) {
    var d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    months.push({ month:d.getMonth(), year:d.getFullYear(), label:d.toLocaleDateString('en-GB',{month:'short'}) });
  }
  return months;
}

function statusClass(status) {
  var map = { 'New Lead':'sp-new','Open':'sp-open','In Progress':'sp-prog','On Hold':'sp-hold','Closed Won':'sp-won','Closed Lost':'sp-lost' };
  return map[status] || 'sp-new';
}

function impClass(imp) {
  return { High:'imp-h', Medium:'imp-m', Low:'imp-l' }[imp] || '';
}

function showToast(msg, type) {
  type = type || 'info';
  var t = document.getElementById('toast');
  if (!t) { console.log('[toast]', msg); return; }
  t.textContent = msg;
  t.className   = 'show ' + type;
  setTimeout(function(){ t.className = type; }, 3200);
}

/* ════════════════════════════════════════════════════════
   MULTI-SELECT DROPDOWN HANDLERS
   ════════════════════════════════════════════════════════ */
function toggleMS(wrapId) {
  var wrap = document.getElementById(wrapId);
  if (!wrap) return;
  var openOne = wrap.classList.contains('open');
  document.querySelectorAll('.ms-wrap.open').forEach(function(w){ w.classList.remove('open'); });
  if (!openOne) wrap.classList.add('open');
}

document.addEventListener('click', function(e) {
  if (!e.target.closest('.ms-wrap')) {
    document.querySelectorAll('.ms-wrap.open').forEach(function(w){ w.classList.remove('open'); });
  }
});

function filterMSSearch(input, listId) {
  var q = (input.value || '').toLowerCase();
  var list = document.getElementById(listId);
  if (!list) return;
  list.querySelectorAll('.ms-option').forEach(function(opt){
    if (opt.classList.contains('ms-all-item')) return;
    var txt = opt.textContent.toLowerCase();
    opt.style.display = (!q || txt.indexOf(q) !== -1) ? '' : 'none';
  });
}

/* ── Filter state keys used by multi-select widgets ─── */
var MS_FILTER_MAP = {
  Status:     { key: 'status',   wrap: 'ms-dash-status', label: function(arr){ return msLabel(arr, 'All Statuses', 'Statuses'); } },
  Importance: { key: 'imp',      wrap: 'ms-dash-imp',    label: function(arr){ return msLabel(arr, 'All', 'Importance'); } },
  Director:   { key: 'director', wrap: 'ms-dash-dir',    label: function(arr){ return msLabel(arr, 'All Directors', 'Directors'); } },
  AM:         { key: 'am',       wrap: 'ms-dash-am',     label: function(arr){ return msLabel(arr, 'All Account Managers', 'AMs'); } },
  Account:    { key: 'account',  wrap: 'ms-dash-acct',   label: function(arr){ return msLabel(arr, 'All Accounts', 'Accounts'); } },
  MLStatus:   { key: 'mlStatus', wrap: 'ms-ml-status',   label: function(arr){ return msLabel(arr, 'All Statuses', 'Statuses'); } },
  MLImp:      { key: 'mlImp',    wrap: 'ms-ml-imp',      label: function(arr){ return msLabel(arr, 'All', 'Importance'); } },
  MLDir:      { key: 'mlDir',    wrap: 'ms-ml-dir',      label: function(arr){ return msLabel(arr, 'All Directors', 'Directors'); } },
  MLAM:       { key: 'mlAM',     wrap: 'ms-ml-am',       label: function(arr){ return msLabel(arr, 'All Account Managers', 'AMs'); } },
  MLAcct:     { key: 'mlAcct',   wrap: 'ms-ml-acct',     label: function(arr){ return msLabel(arr, 'All Accounts', 'Accounts'); } },
};

var ML_KEYS  = { MLStatus:1, MLImp:1, MLDir:1, MLAM:1, MLAcct:1 };

function msLabel(arr, allLabel, pluralLabel) {
  if (!arr || arr.length === 0 || arr.indexOf('all') !== -1) return allLabel;
  if (arr.length === 1) return arr[0];
  return arr.length + ' ' + pluralLabel;
}

function toggleMSOpt(optEl, wrapId, ctx) {
  var cfg = MS_FILTER_MAP[ctx];
  if (!cfg) return;
  var val = optEl.getAttribute('data-val');
  var wrap = document.getElementById(wrapId);
  var allItem = wrap.querySelector('.ms-all-item');
  var cur = (FM.filters[cfg.key] || []).slice();
  if (cur.indexOf('all') !== -1) cur = [];
  var i = cur.indexOf(val);
  if (i === -1) cur.push(val); else cur.splice(i, 1);
  if (cur.length === 0) cur = ['all'];

  if (cur.indexOf('all') !== -1) {
    wrap.querySelectorAll('.ms-option').forEach(function(o){ o.classList.remove('checked'); });
    if (allItem) allItem.classList.add('checked');
  } else {
    if (allItem) allItem.classList.remove('checked');
    wrap.querySelectorAll('.ms-option').forEach(function(o){
      var v = o.getAttribute('data-val');
      o.classList.toggle('checked', cur.indexOf(v) !== -1 && v !== 'all');
    });
  }
  FM.filters[cfg.key] = cur;
  var trig = wrap.querySelector('.ms-trigger');
  if (trig) trig.textContent = cfg.label(cur);

  if (ML_KEYS[ctx]) renderMyLeads();
  else applyFilters();
}

function toggleMSAll(wrapId, ctx) {
  var cfg = MS_FILTER_MAP[ctx];
  if (!cfg) return;
  var wrap = document.getElementById(wrapId);
  wrap.querySelectorAll('.ms-option').forEach(function(o){ o.classList.remove('checked'); });
  var allItem = wrap.querySelector('.ms-all-item');
  if (allItem) allItem.classList.add('checked');
  FM.filters[cfg.key] = ['all'];
  var trig = wrap.querySelector('.ms-trigger');
  if (trig) trig.textContent = cfg.label(['all']);
  if (ML_KEYS[ctx]) renderMyLeads();
  else applyFilters();
}

function selectPeriod(optEl, label) {
  var val = optEl.getAttribute('data-val');
  FM.filters.period = val;
  var wrap = document.getElementById('ms-period');
  wrap.querySelectorAll('.ms-option').forEach(function(o){ o.classList.remove('checked'); });
  optEl.classList.add('checked');
  var trig = wrap.querySelector('.ms-trigger');
  if (trig) trig.textContent = label;
  applyFilters();
}

/* Activity log single-select filters */
function selectALFilter(wrapId, key, val, label) {
  FM.filters[key] = val;
  var wrap = document.getElementById(wrapId);
  if (wrap) {
    wrap.querySelectorAll('.ms-option').forEach(function(o){ o.classList.remove('checked'); });
    var sel = wrap.querySelector('.ms-option[data-val="' + val.replace(/"/g,'\\"') + '"]');
    if (sel) sel.classList.add('checked');
    var trig = wrap.querySelector('.ms-trigger');
    if (trig) trig.textContent = label;
  }
  renderActivityLog();
}

/* ════════════════════════════════════════════════════════
   CHART TABS / ANALYTICS TOGGLE / SIDEBAR / THEME
   ════════════════════════════════════════════════════════ */
function switchChartTab(group, tab, btnEl) {
  if (!FM.chartTabs[group]) return;
  FM.chartTabs[group] = tab;
  var bar = btnEl.parentElement;
  bar.querySelectorAll('.chart-tab').forEach(function(b){ b.classList.remove('active'); });
  btnEl.classList.add('active');

  var groupMap = {
    overview: { ids: ['ch-status','ch-imp','ch-du'],     active: { status:'ch-status', imp:'ch-imp', du:'ch-du' } },
    winloss:  { ids: ['ch-wl','ch-reasons'],             active: { wl:'ch-wl', reasons:'ch-reasons' } },
    director: { ids: ['leaderboard','ch-tcvdir'],        active: { lb:'leaderboard', tcvdir:'ch-tcvdir' } },
    am:       { ids: ['am-leaderboard','ch-amtcv','ch-ammix'], active: { amlb:'am-leaderboard', amtcv:'ch-amtcv', ammix:'ch-ammix' } },
    perf:     { ids: ['perf-director','perf-am'],        active: { director:'perf-director', am:'perf-am' } },
  };
  var spec = groupMap[group];
  if (!spec) return;

  // Group elements by their shared chart-wrap parent (or the element itself)
  var parents = {};
  var elsById = {};
  spec.ids.forEach(function(id){
    var el = document.getElementById(id);
    if (!el) return;
    elsById[id] = el;
    var p = el.classList && el.classList.contains('chart-wrap') ? el : (el.closest('.chart-wrap') || el);
    if (!parents[id]) parents[id] = p;
  });

  // Count siblings sharing the same chart-wrap parent
  var counts = {};
  var wrapSeq = 0;
  spec.ids.forEach(function (id) {
    var p = parents[id];
    if (!elsById[id]) return;
    var key = p ? p.dataset.fmTag || (p.dataset.fmTag = 'fmwrap_' + ++wrapSeq) : id;
    counts[key] = (counts[key] || 0) + 1;
  });

  var activeId = spec.active[tab];
  spec.ids.forEach(function (id) {
    var el = elsById[id];
    if (!el) return;
    var p = parents[id];
    var key = p && p.dataset.fmTag;
    var shareWrap = key && counts[key] > 1;
    if (shareWrap) {
      el.style.display = id === activeId ? 'block' : 'none';
      p.style.display = 'block';
    } else {
      var target = p || el;
      target.style.display = id === activeId ? 'block' : 'none';
    }
  });
  fmResizeAnalyticsChartsDeferred();
}

function toggleFmChartsMaster() {
  var master = document.getElementById('fm-charts-master');
  var lbl = document.getElementById('analytics-btn-label');
  if (!master) return;
  var shown = master.classList.toggle('open');
  if (lbl) lbl.textContent = shown ? 'Hide analytics charts' : 'Show analytics charts';
  if (shown) {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        renderFmOverviewCharts();
        renderFmInsights();
        renderDashboardCharts();
        fmResizeAnalyticsChartsDeferred();
      });
    });
  } else {
    destroyAnalyticsCharts();
    destroyFmCharts();
  }
}

/** @deprecated use toggleFmChartsMaster; kept for older HTML references */
function toggleAnalytics() {
  toggleFmChartsMaster();
}

function toggleSidebar() {
  var sb = document.getElementById('sidebar');
  if (sb) sb.classList.toggle('collapsed');
}

function toggleThemeDD() {
  var menu = document.getElementById('theme-dd-menu');
  if (menu) menu.classList.toggle('open');
}
function setTheme(theme) {
  var menu = document.getElementById('theme-dd-menu');
  var lbl  = document.getElementById('theme-dd-label');
  if (theme === 'dark') {
    FM_THEME_BASE = 'blue';
    FM_THEME_DARK = true;
  } else if (theme === 'teal-dark') {
    FM_THEME_BASE = 'teal';
    FM_THEME_DARK = true;
  } else if (theme === 'teal') {
    FM_THEME_BASE = 'teal';
    FM_THEME_DARK = false;
  } else {
    FM_THEME_BASE = 'blue';
    FM_THEME_DARK = false;
  }
  fmApplySchemeToDocument();
  var sel = document.getElementById('fm-scheme-select');
  if (sel) sel.value = FM_THEME_BASE === 'teal' ? 'teal' : 'blue';

  var labels = { light: 'Blue (light)', dark: 'Blue (dark)', teal: 'Teal (light)', 'teal-dark': 'Teal (dark)' };
  if (lbl) lbl.textContent = labels[theme] || 'Blue (light)';

  document.querySelectorAll('.theme-dd-item').forEach(function(i){ i.classList.remove('active'); });
  var idMap = { light: 'tdi-light', dark: 'tdi-dark', teal: 'tdi-teal', 'teal-dark': 'tdi-teal-dark' };
  var act = document.getElementById(idMap[theme] || 'tdi-light');
  if (act) act.classList.add('active');
  if (menu) menu.classList.remove('open');
  try { localStorage.setItem('fm_theme', theme); } catch(e){}
  try {
    localStorage.setItem('fm_scheme', FM_THEME_BASE);
    localStorage.setItem('fm_dark', String(FM_THEME_DARK));
  } catch (e2) {}
  fmRefreshChartsAfterTheme();
}

/* ════════════════════════════════════════════════════════
   LANDING PAGE
   ════════════════════════════════════════════════════════ */
function populateLanding() {
  var u  = USER_CONTEXT;
  var av = document.getElementById('lp-avatar');
  var nm = document.getElementById('lp-uname');
  var em = document.getElementById('lp-uemail');
  var rt = document.getElementById('lp-role-txt');
  if (av) av.textContent = initialsOf(u.userName) || '?';
  if (nm) nm.textContent = u.userName || 'Guest';
  if (em) em.textContent = u.userEmail || '—';
  if (rt) rt.textContent = u.hasAccess ? u.role : 'No Access';

  var myCount = FM.allLeads.filter(function(l){
    return normEmail(l.DirectorEmail) === u.userEmail || normEmail(l.LocalAMEmail) === u.userEmail;
  }).length;
  var lpMy   = document.getElementById('lp-my-leads');
  var lpLast = document.getElementById('lp-last-visit');
  if (lpMy)   lpMy.textContent   = u.isAdmin ? FM.allLeads.length : myCount;
  if (lpLast) {
    var last = '';
    try { last = localStorage.getItem('fm_last_visit_' + u.userEmail) || ''; } catch(e){}
    lpLast.textContent = last ? new Date(last).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : 'First visit';
  }

  var btn   = document.getElementById('lp-go');
  var btnTx = document.getElementById('lp-go-txt');
  var note  = document.getElementById('lp-note');
  var noteT = document.getElementById('lp-note-txt');

  if (u.hasAccess) {
    if (btn) { btn.disabled = false; }
    if (btnTx) btnTx.textContent = 'Go to Portal';
    if (note) { note.classList.remove('deny'); }
    if (noteT) noteT.innerHTML = 'Access granted as <b>' + escapeHtml(u.role) + '</b>. Click to launch the portal.';
  } else {
    if (btn) { btn.disabled = true; }
    if (btnTx) btnTx.textContent = 'No Access';
    if (note) note.classList.add('deny');
    if (noteT) {
      noteT.innerHTML = 'You do not have access. Request access from ' +
        FM_CONFIG.ACCESS_CONTACTS.map(function(e){ return '<a href="mailto:' + e + '">' + e + '</a>'; }).join(' or ') + '.';
    }
  }
}

function enterPortal() {
  if (!USER_CONTEXT.hasAccess) return;
  try { localStorage.setItem('fm_last_visit_' + USER_CONTEXT.userEmail, new Date().toISOString()); } catch(e){}
  var lp = document.getElementById('landing-page');
  if (lp) lp.style.display = 'none';
  var app = document.getElementById('app');
  if (app) app.style.display = '';

  if (USER_CONTEXT.isDirector) {
    FM.filters.director = [USER_CONTEXT.userName];
    FM.filters.mlDir    = [USER_CONTEXT.userName];
  }
  if (USER_CONTEXT.isAM) {
    FM.filters.am   = [USER_CONTEXT.userName];
    FM.filters.mlAM = [USER_CONTEXT.userName];
  }
  updateUI();
}

/* ════════════════════════════════════════════════════════
   INIT
   ════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', function() {
  fmInitHeaderDate();
  fmHydrateThemeFromStorage();

  loadUserAccess()
    .then(function(){
      return loadAllData();
    })
    .then(function(){
      populateLanding();
      // Show "Dummy Data" toggle only for the listed owners.
      var owner = ['tehleel.lone@du.ae', 'abdul.karim3@du.ae'];
      if (owner.indexOf((USER_CONTEXT.userEmail||'').toLowerCase()) !== -1) {
        var t = document.getElementById('dummy-toggle-btn');
        if (t) t.style.display = '';
      }
    })
    .catch(function(e){
      console.error('Init failed:', e);
      populateLanding();
    });
});

window.enterPortal = enterPortal;
window.closeModal = closeModal;
window.modalStatusChange = modalStatusChange;
window.openQuickUpdateModal = openQuickUpdateModal;
window.saveModalUpdate = saveModalUpdate;
window.toggleMS = toggleMS;
window.toggleMSAll = toggleMSAll;
window.toggleMSOpt = toggleMSOpt;
window.selectPeriod = selectPeriod;
window.filterMSSearch = filterMSSearch;
window.selectALFilter = selectALFilter;
window.clearDashFilters = clearDashFilters;
window.clearLeadsFilters = clearLeadsFilters;
window.clearActivityFilters = clearActivityFilters;
window.setOwnerFilter = setOwnerFilter;
window.agQuickFilter = agQuickFilter;
window.switchChartTab = switchChartTab;
window.toggleFmChartsMaster = toggleFmChartsMaster;
window.toggleAnalytics = toggleAnalytics;
window.toggleSidebar = toggleSidebar;
window.toggleThemeDD = toggleThemeDD;
window.setTheme = setTheme;
window.fmChangeScheme = fmChangeScheme;
window.fmToggleLightDark = fmToggleLightDark;
