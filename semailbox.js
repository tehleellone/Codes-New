/* ═══════════════════════════════════════════════════════════════
   SEMAILBOX.JS — SE Mailbox Intelligence v6.1
   BA-grade: SLA · Agent drilldown · Forecasting · Insights
   Rules: Unassigned = no Agent/Citrix · Assigned = Agent/Citrix
          Completed = Flag date · Assigned date = Received + 1 day
   ═══════════════════════════════════════════════════════════════ */
'use strict';

/* ── CONFIG ──────────────────────────────────────────────────── */
const MB_CONFIG = {
    SP_SITE:      (typeof _spPageContextInfo !== 'undefined' && _spPageContextInfo)
                    ? _spPageContextInfo.webAbsoluteUrl
                    : (window.location.origin + '/sites/SM'),
    SP_DOC_LIB:  'Shared Documents',
    SP_FILE_NAME: 'SEMailbox_Data.xlsx',
    ACCT_MAP_LIST:'Account Mapping',
    STORAGE_KEY:  'semailbox_last_file_name',
};

/* ── COLOURS ─────────────────────────────────────────────────── */
const MB_CLR = {
    unassigned: '#e74c3c',
    inprogress: '#f39c12',
    closed:     '#27ae60',
    sent:       '#3498db',
    acc:        '#a855f7',
    acc2:       '#4c6fff',
    grid:       'rgba(168,85,247,0.08)',
    smColors:   ['#4c6fff','#a855f7','#c724b1','#27ae60','#e74c3c','#f39c12','#3498db','#9b59b6','#1abc9c','#e67e22','#16a085','#8e44ad'],
};

/* ── STATE ───────────────────────────────────────────────────── */
let MB = {
    allTickets:      [],   // all parsed (excl Sent tab)
    sentTickets:     [],   // Sent tab only
    filteredTickets: [],
    accountMapping:  [],
    charts:          {},
    gridApi:         null,
    chartsVisible:   false,
    hasSentTab:      false,

    // top filters — applied to everything
    filterSMs:       [],   // agent names — [] = all
    filterLocations: [],   // [] = all
    filterSlaStatus: [],   // [] = all
    filterYears:  [],
    filterMonths: [],
    filterWeeks:  [],
    filterDays:   [],

    // secondary filters
    activeKpiFilter: null,
    activeSlaFilter: null,
    ageFilter:       null,
    ageStatusToggle: 'both',
    workloadStatus:  'inprogress',
    trendPeriod:     'W',
    drillAgent:      null,

    dataLoaded:   false,
    lastFileName: localStorage.getItem(MB_CONFIG.STORAGE_KEY) || '',
};

/* ══════════════════════════════════════════════════════════════
   VALUE HELPERS
   ══════════════════════════════════════════════════════════════ */
function mbHasValue(v) {
    const s = String(v ?? '').trim();
    return s !== '' && s.toLowerCase() !== 'none';
}
function mbExtractCitrix(raw) {
    if (!raw) return '';
    const m = String(raw).match(/CNFX[A-Z0-9]+/i);
    return m ? m[0].toUpperCase() : '';
}

/* ══════════════════════════════════════════════════════════════
   CATEGORY / SM PARSER
   ══════════════════════════════════════════════════════════════ */
function mbParseCategories(raw) {
    if (!raw || String(raw).trim() === '') return { category: '', smCode: '', smName: '' };
    const s = String(raw).trim();
    const citrix = mbExtractCitrix(s);
    const match = s.match(/([A-Z0-9]{4,12})\s*[-–]\s*(.+)$/i);
    let smCode = '', smName = '', category = '';
    if (citrix) {
        smCode = citrix;
        const idx = s.toUpperCase().indexOf(citrix);
        const tail = s.substring(idx + citrix.length).replace(/^[\s\-–]+/, '').trim();
        smName = tail.replace(/[\s\-–]+ME\s*$/i, '').trim();
        const before = s.substring(0, idx).replace(/[,;\s]+$/, '').trim();
        category = before || 'General';
    } else if (match) {
        smCode = match[1].trim();
        smName = match[2].trim();
        const before = s.substring(0, s.indexOf(match[0])).replace(/[,;\s]+$/, '').trim();
        category = before || 'General';
    } else {
        category = s;
    }
    return { category, smCode, smName };
}

/* ══════════════════════════════════════════════════════════════
   STATUS LOGIC — Agent/Citrix based (new template)
   Unassigned: no Agent Name AND no Citrix ID
   Assigned:   Agent Name OR Citrix ID (shown as In Progress)
   Completed:  Flag Completed Date set
   Legacy tabs (Unassigned/Assigned/Closed) still supported
   ══════════════════════════════════════════════════════════════ */
function mbResolveStatus(tabName, flagDate, agentName, citrixId) {
    const tabL     = (tabName || '').toLowerCase().trim();
    const hasFlag  = mbHasValue(flagDate);
    const hasAgent = mbHasValue(agentName) || mbHasValue(citrixId);

    if (tabL === 'unassigned') return 'Unassigned';
    if (tabL === 'assigned')   return hasFlag ? 'Completed' : 'In Progress';
    if (tabL === 'closed')     return 'Closed';
    if (tabL === 'sent')       return 'Sent';

    if (hasFlag)  return 'Completed';
    if (hasAgent) return 'In Progress';
    return 'Unassigned';
}

/* ══════════════════════════════════════════════════════════════
   DATE HELPERS
   ══════════════════════════════════════════════════════════════ */
function mbParseDate(val) {
    if (!val || val === 'None') return null;
    if (typeof val === 'string' && val.includes('/')) {
        const parts = val.split(' ');
        const [d, m, y] = parts[0].split('/');
        if (!y) return null;
        return new Date(`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}T${parts[1]||'00:00'}:00`);
    }
    if (typeof val === 'number') return new Date((val - 25569) * 86400 * 1000);
    const d = new Date(val);
    return isNaN(d) ? null : d;
}
function mbDaysSince(v) {
    const d = mbParseDate(v); if (!d) return null;
    return Math.floor((new Date() - d) / 86400000 * 10) / 10;
}
/** Assigned date = Received + 1 calendar day */
function mbAssignedDate(received) {
    const d = mbParseDate(received);
    if (!d) return null;
    return new Date(d.getTime() + 86400000);
}
function mbAssignedDateRaw(received) {
    const d = mbAssignedDate(received);
    if (!d) return '';
    return (d.getTime() / 86400000) + 25569;
}
function mbComputeAgeDays(status, received, assignedRaw) {
    if (status === 'Completed' || status === 'Closed') return null;
    if (status === 'Unassigned') return mbDaysSince(received);
    return mbDaysSince(assignedRaw || mbAssignedDateRaw(received));
}
function mbFmtDate(v) {
    const d = mbParseDate(v); if (!d) return '—';
    return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})
        + ' ' + d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
}
function mbDateToYM(v)   { const d = mbParseDate(v); return d ? d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0') : null; }
function mbDateToYear(v) { const d = mbParseDate(v); return d ? String(d.getFullYear()) : null; }
function mbDateToDay(v)  { const d = mbParseDate(v); return d ? d.toISOString().split('T')[0] : null; }
function mbDateToWeek(v) {
    const d = mbParseDate(v); if (!d) return null;
    const wk = Math.ceil((d - new Date(d.getFullYear(),0,1)) / 6048e5);
    return `${d.getFullYear()}-W${String(wk).padStart(2,'0')}`;
}

/* ══════════════════════════════════════════════════════════════
   ACCOUNT MAPPING
   ══════════════════════════════════════════════════════════════ */
async function mbLoadAccountMapping() {
    try {
        const url = `${MB_CONFIG.SP_SITE}/_api/web/lists/getbytitle('${MB_CONFIG.ACCT_MAP_LIST}')/items?$select=User_ID,Service_Manager_Name,Email_ID,Team,Status&$top=500`;
        const res = await fetch(url, { headers:{ Accept:'application/json;odata=verbose' }, credentials:'include' });
        const json = await res.json();
        MB.accountMapping = (json?.d?.results||[]).filter(r => r.Status !== 'Inactive');
    } catch(e) { MB.accountMapping = []; }
}
function mbMatchByUserId(rawId) {
    if (!rawId || String(rawId).trim() === '') return null;
    const id = String(rawId).trim().toLowerCase();
    const rows = MB.accountMapping || [];
    const uid = r => (r.User_ID != null ? String(r.User_ID).trim().toLowerCase() : '');
    let r = rows.find(r => uid(r) && uid(r) === id);
    if (r) return r;
    r = rows.find(r => uid(r) && uid(r).includes(id));
    if (r) return r;
    r = rows.find(r => uid(r) && id.includes(uid(r)));
    return r || null;
}
function mbMatchSM(smCode, smName) {
    if (smCode) {
        const code = String(smCode).trim().toLowerCase();
        const r = MB.accountMapping.find(r => {
            const u = r.User_ID != null ? String(r.User_ID).trim().toLowerCase() : '';
            return u && u.includes(code);
        });
        if (r) return r;
    }
    if (smName) {
        const first = smName.split(' ')[0].toLowerCase();
        const r = MB.accountMapping.find(r => {
            const n = r.Service_Manager_Name != null ? String(r.Service_Manager_Name).trim().toLowerCase() : '';
            return n && n.includes(first);
        });
        if (r) return r;
    }
    return null;
}

/* ══════════════════════════════════════════════════════════════
   EXCEL PARSER
   ══════════════════════════════════════════════════════════════ */
function mbParseSheet(sheet, tabName) {
    if (!sheet) return [];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval:'' });
    const out  = [];
    rows.forEach((row, idx) => {
        const n = {};
        Object.keys(row).forEach(k => { n[k.trim().toLowerCase()] = row[k]; });

        const from      = String(n['from']||n['to']||n['sender']||'');
        const subject   = String(n['subject']||n['title']||'');
        const received  = n['received']||n['date received']||n['date']||n['sent']||'';
        const flagDate  = n['completed date']||n['flag completed date']||n['flag completed']||'';
        const catRaw    = String(n['categories']||'').trim();
        const parsedCat = String(n['category']||'').trim();
        const agentName = String(n['agent name']||n['agent']||'').trim();
        let citrixId    = String(n['citrix id']||n['citrix']||'').trim();
        const location  = String(n['location']||'').trim();
        const sla       = n['sla'] ?? '';
        const slaDue    = n['sla due']||'';
        const ageing    = String(n['ageing']||'').trim();
        const ageingHrs = n['ageing hours'];
        const slaStatus = String(n['sla status']||'').trim();
        const pendingReason = String(n['pending reason']||n['pendingreason']||'').trim();
        const owner     = String(n['owner']||'').trim();

        const parsed    = mbParseCategories(catRaw);
        // Only accept a REAL Citrix code (CNFX…) from the category text as a fallback.
        // Never fabricate assignment from free-text names in Categories.
        if (!citrixId) citrixId = mbExtractCitrix(catRaw);

        const status    = mbResolveStatus(tabName, flagDate, agentName, citrixId);
        const assignedRaw = mbAssignedDateRaw(received);
        const assignedDate = mbAssignedDate(received);
        const ageDays   = mbComputeAgeDays(status, received, assignedRaw);

        const mapped    = mbMatchByUserId(citrixId || owner) || mbMatchByUserId(owner) || mbMatchSM(citrixId, agentName || parsed.smName);
        let smFullName  = agentName || mapped?.Service_Manager_Name || parsed.smName || '';
        if (!smFullName && citrixId) smFullName = citrixId;
        if (!smFullName && status === 'In Progress') smFullName = 'Unknown Agent';

        const issueCategory = parsedCat || parsed.category || '';
        const recvD = mbParseDate(received);

        // Resolution time (completed): flag - received, in days
        let resolveDays = null;
        if (status === 'Completed') {
            const r = mbParseDate(received), f = mbParseDate(flagDate);
            if (r && f) resolveDays = Math.round((f - r) / 86400000 * 10) / 10;
        }

        out.push({
            id: `${tabName}-${idx}`, tab: tabName,
            from, subject, received, receivedFmt: mbFmtDate(received),
            flagDate, flagDateFmt: mbFmtDate(flagDate),
            assignedDate, assignedDateFmt: mbFmtDate(assignedRaw),
            catRaw, category: issueCategory, smCode: citrixId, smName: agentName || parsed.smName,
            smFullName, agentName, citrixId, location,
            sla, slaDue, slaDueFmt: mbFmtDate(slaDue),
            ageing, ageingHours: ageingHrs !== '' && ageingHrs != null ? Number(ageingHrs) : null,
            slaStatus, resolveDays,
            smEmail: mapped?.Email_ID||'', smTeam: mapped?.Team||location||'',
            status, ageDays,
            owner, pendingReason,
            recvYear:  recvD ? String(recvD.getFullYear()) : '',
            recvYM:    mbDateToYM(received)   || '',
            recvWeek:  mbDateToWeek(received) || '',
            recvDay:   mbDateToDay(received)  || '',
            flagDay:   mbDateToDay(flagDate)  || '',
            flagWeek:  mbDateToWeek(flagDate) || '',
            flagYM:    mbDateToYM(flagDate)   || '',
        });
    });
    return out;
}

const MB_SKIP_SHEETS = new Set(['master categories','active list','sheet1','sheet2','sheet3']);

function mbProcessWorkbook(wb) {
    const knownMap = {
        'Raw Data':'raw_data',
        'Unassigned':'unassigned',
        'Assigned':'assigned',
        'Closed':'closed',
        'Inbox':'inbox',
        'Pending':'pending',
        'Sent':'sent',
    };
    let all = [], sent = [];
    let hasSent = false;
    const hasRawData = wb.SheetNames.some(n => n.toLowerCase() === 'raw data');

    wb.SheetNames.forEach(name => {
        if (MB_SKIP_SHEETS.has(name.toLowerCase())) return;
        if (hasRawData && name.toLowerCase() !== 'raw data') return;

        const key = knownMap[name] || name.toLowerCase().replace(/\s+/g,'_');
        const rows = mbParseSheet(wb.Sheets[name], key);
        if (!rows.length) return;
        if (key === 'sent') { sent = sent.concat(rows); hasSent = true; }
        else all = all.concat(rows);
    });

    MB.allTickets   = all;
    MB.sentTickets  = sent;
    MB.hasSentTab   = hasSent;
    MB.activeKpiFilter = null;
    MB.activeSlaFilter = null;
    MB.ageFilter    = null;
    MB.drillAgent   = null;
    MB.filterSMs    = [];
    MB.filterLocations = [];
    MB.filterSlaStatus = [];
    MB.filterYears  = [];
    MB.filterMonths = [];
    MB.filterWeeks  = [];
    MB.filterDays   = [];
    MB.dataLoaded   = true;
    if (MB.gridApi) { try { MB.gridApi.destroy(); } catch(e) {} MB.gridApi = null; }
    mbApplyFilters();
    mbRenderAll();
}

/* ══════════════════════════════════════════════════════════════
   SP SAVE / LOAD
   ══════════════════════════════════════════════════════════════ */
async function mbSaveToSP(arrayBuffer, fileName) {
    try {
        const digestRes = await fetch(`${MB_CONFIG.SP_SITE}/_api/contextinfo`,{ method:'POST', headers:{Accept:'application/json;odata=verbose'}, credentials:'include' });
        const digest    = (await digestRes.json()).d.GetContextWebInformation.FormDigestValue;
        const siteRel   = MB_CONFIG.SP_SITE.replace(window.location.origin,'');
        const lib       = MB_CONFIG.SP_DOC_LIB.replace(/ /g,'%20');
        const res       = await fetch(`${MB_CONFIG.SP_SITE}/_api/web/getfolderbyserverrelativeurl('${siteRel}/${lib}')/files/add(overwrite=true,url='${MB_CONFIG.SP_FILE_NAME}')`,{
            method:'POST', headers:{Accept:'application/json;odata=verbose','X-RequestDigest':digest,'Content-Length':arrayBuffer.byteLength},
            credentials:'include', body:arrayBuffer,
        });
        if (!res.ok) throw new Error('Upload failed');
        localStorage.setItem(MB_CONFIG.STORAGE_KEY, fileName);
        MB.lastFileName = fileName;
        mbShowToast('✅ Saved to SharePoint','success');
    } catch(e) { mbShowToast('⚠ SP save failed','warning'); }
}
async function mbLoadFromSP() {
    try {
        mbShowStatus('Loading mailbox data...');
        const siteRel = MB_CONFIG.SP_SITE.replace(window.location.origin,'');
        const lib     = MB_CONFIG.SP_DOC_LIB.replace(/ /g,'%20');
        const file    = MB_CONFIG.SP_FILE_NAME.replace(/ /g,'%20');
        const res     = await fetch(`${MB_CONFIG.SP_SITE}/_api/web/getfilebyserverrelativeurl('${siteRel}/${lib}/${file}')/$value`,{
            headers:{Accept:'application/octet-stream'}, credentials:'include'
        });
        if (!res.ok) throw new Error('Not found');
        const wb = XLSX.read(new Uint8Array(await res.arrayBuffer()),{type:'array',cellDates:false});
        mbProcessWorkbook(wb);
        mbShowStatus(''); return true;
    } catch(e) { mbShowStatus(''); return false; }
}

/* ══════════════════════════════════════════════════════════════
   FILE UPLOAD
   ══════════════════════════════════════════════════════════════ */
function mbHandleFile(file) {
    if (!file) return;
    const prev = MB.lastFileName;
    const area = document.getElementById('mb-upload-area');
    if (area) area.innerHTML = `<span style="font-size:12px;color:var(--t2);">${prev?`Replacing <b>${prev}</b> → `:''}⏳ Uploading <b>${file.name}</b></span>`;
    const reader = new FileReader();
    reader.onload = async(e) => {
        try {
            const buf = e.target.result;
            await mbSaveToSP(buf, file.name);
            const wb = XLSX.read(new Uint8Array(buf),{type:'array',cellDates:false});
            mbProcessWorkbook(wb);
            mbBuildUploadBtn(file.name);
        } catch(err) { mbShowToast('❌ Failed to process file','error'); mbBuildUploadBtn(prev); }
    };
    reader.readAsArrayBuffer(file);
}
function mbBuildUploadBtn(name) {
    const area = document.getElementById('mb-upload-area');
    if (!area) return;
    area.innerHTML = `<div style="display:flex;align-items:center;gap:10px;">
        <button type="button" class="export-btn" id="mb-upload-btn" style="font-size:12px;padding:7px 14px;">
            <i data-lucide="upload-cloud" style="width:13px;height:13px;display:inline-block;vertical-align:middle;margin-right:4px;"></i>${name?'Replace File':'Upload Excel'}
        </button>
        <input type="file" id="mb-file-input" accept=".xlsx,.xls,.xlsm" style="display:none;">
        ${name?`<span style="font-size:11px;color:var(--t3);">📄 <b style="color:var(--t2);">${name}</b></span>`:''}
    </div>`;
    const btn = document.getElementById('mb-upload-btn');
    const inp = document.getElementById('mb-file-input');
    if (btn&&inp) { btn.onclick=()=>inp.click(); inp.onchange=e=>{if(e.target.files[0])mbHandleFile(e.target.files[0]);}; }
    if (typeof lucide!=='undefined') lucide.createIcons();
}

/* ══════════════════════════════════════════════════════════════
   FILTERS
   ══════════════════════════════════════════════════════════════ */
function mbApplyFilters() {
    let data = [...MB.allTickets];

    if (MB.filterSMs.length > 0)
        data = data.filter(t => MB.filterSMs.includes(t.smFullName));
    if (MB.filterLocations.length > 0)
        data = data.filter(t => MB.filterLocations.includes(t.location || 'Unknown'));
    if (MB.filterSlaStatus.length > 0)
        data = data.filter(t => MB.filterSlaStatus.includes(t.slaStatus || 'Unknown'));

    if (MB.filterYears.length > 0)  data = data.filter(t => MB.filterYears.includes(t.recvYear));
    if (MB.filterMonths.length > 0) data = data.filter(t => MB.filterMonths.includes(t.recvYM));
    if (MB.filterWeeks.length > 0)  data = data.filter(t => MB.filterWeeks.includes(t.recvWeek));
    if (MB.filterDays.length > 0)   data = data.filter(t => MB.filterDays.includes(t.recvDay));

    if (MB.activeKpiFilter) {
        const fn = {
            unassigned: t => t.status==='Unassigned',
            inprogress: t => t.status==='In Progress',
            closed:     t => t.status==='Closed'||t.status==='Completed',
        }[MB.activeKpiFilter];
        if (fn) data = data.filter(fn);
    }
    if (MB.activeSlaFilter) {
        const fn = {
            within:  t => (t.slaStatus||'').toLowerCase().includes('within') && t.status!=='Completed',
            outside: t => (t.slaStatus||'').toLowerCase().includes('outside') && t.status!=='Completed',
        }[MB.activeSlaFilter];
        if (fn) data = data.filter(fn);
    }
    if (MB.drillAgent) data = data.filter(t => t.smFullName === MB.drillAgent);

    if (MB.ageFilter) {
        const statusOk = t => {
            if (MB.ageStatusToggle==='unassigned') return t.status==='Unassigned';
            if (MB.ageStatusToggle==='inprogress') return t.status==='In Progress';
            return t.status==='Unassigned'||t.status==='In Progress';
        };
        const ageOk = t => {
            if (t.ageDays===null||t.ageDays===undefined) return false;
            if (MB.ageFilter==='0-2') return t.ageDays>=0&&t.ageDays<2;
            if (MB.ageFilter==='2-5') return t.ageDays>=2&&t.ageDays<5;
            return t.ageDays>=5;
        };
        data = data.filter(t => statusOk(t)&&ageOk(t));
    }

    MB.filteredTickets = data;
    if (MB.gridApi) MB.gridApi.setGridOption('rowData', data);
}

/* ══════════════════════════════════════════════════════════════
   KPI + METRIC ENGINE
   ══════════════════════════════════════════════════════════════ */
function mbIsOutside(t) { return (t.slaStatus||'').toLowerCase().includes('outside'); }
function mbIsWithin(t)  { return (t.slaStatus||'').toLowerCase().includes('within'); }
function mbIsOpen(t)    { return t.status==='In Progress' || t.status==='Unassigned'; }

function mbGetKPIs(t) {
    t = t || MB.filteredTickets;
    const open    = t.filter(mbIsOpen);
    const within  = open.filter(mbIsWithin).length;
    const outside = open.filter(mbIsOutside).length;
    const slaTotal = within + outside;
    const openAges = open.map(x=>x.ageDays).filter(v=>v!=null);
    const avgAge = openAges.length ? (openAges.reduce((a,b)=>a+b,0)/openAges.length) : null;
    const completed = t.filter(x=>x.status==='Completed');
    const resDays = completed.map(x=>x.resolveDays).filter(v=>v!=null);
    const avgResolve = resDays.length ? (resDays.reduce((a,b)=>a+b,0)/resDays.length) : null;
    return {
        total:      t.length,
        unassigned: t.filter(x=>x.status==='Unassigned').length,
        inprogress: t.filter(x=>x.status==='In Progress').length,
        completed:  completed.length,
        closed:     t.filter(x=>x.status==='Closed'||x.status==='Completed').length,
        sent:       MB.hasSentTab ? MB.sentTickets.length : 0,
        slaWithin:  within,
        slaOutside: outside,
        slaCompliance: slaTotal ? Math.round((within/slaTotal)*100) : null,
        avgAge:     avgAge,
        avgResolve: avgResolve,
        dueSoon:    open.filter(x=>{ const d=mbParseDate(x.slaDue); return d && (d-new Date())>0 && (d-new Date())<=24*3600*1000; }).length,
    };
}

/* Linear regression → {slope, intercept, predict(x)} */
function mbLinReg(ys) {
    const n = ys.length;
    if (n < 2) return { slope:0, intercept: n?ys[0]:0, predict:()=> n?ys[0]:0 };
    let sx=0, sy=0, sxy=0, sxx=0;
    ys.forEach((y,i)=>{ sx+=i; sy+=y; sxy+=i*y; sxx+=i*i; });
    const slope = (n*sxy - sx*sy) / (n*sxx - sx*sx || 1);
    const intercept = (sy - slope*sx) / n;
    return { slope, intercept, predict:x => Math.max(0, slope*x + intercept) };
}

/* Period bucketing helper: returns sorted [{key,label,recv,done}] */
function mbBucketByPeriod(t, per) {
    const map = {};
    const keyLbl = (d) => {
        if (per==='D') return [d.toISOString().split('T')[0], d.toLocaleDateString('en-GB',{day:'2-digit',month:'short'})];
        if (per==='W') { const yr=d.getFullYear(); const wk=Math.ceil((d-new Date(yr,0,1))/6048e5); return [`${yr}-W${String(wk).padStart(2,'0')}`, `W${wk} ${String(yr).slice(2)}`]; }
        return [d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'), d.toLocaleDateString('en-GB',{month:'short',year:'2-digit'})];
    };
    t.forEach(x => {
        const rd = mbParseDate(x.received);
        if (rd) { const [k,l]=keyLbl(rd); (map[k]=map[k]||{key:k,label:l,recv:0,done:0}).recv++; }
        if (x.status==='Completed') { const fd=mbParseDate(x.flagDate); if (fd){ const [k,l]=keyLbl(fd); (map[k]=map[k]||{key:k,label:l,recv:0,done:0}).done++; } }
    });
    return Object.values(map).sort((a,b)=>a.key<b.key?-1:1);
}

/* ══════════════════════════════════════════════════════════════
   RENDER ALL
   ══════════════════════════════════════════════════════════════ */
function mbRenderAll() {
    mbRenderTopFilters();
    mbRenderInsights();
    mbRenderKPIs();
    mbRenderSlaPanel();
    mbRenderAgentTable();
    if (MB.chartsVisible) {
        mbRenderAgeTiles();
        mbRenderTrend();
        mbRenderForecast();
        mbRenderCategories();
    } else {
        mbDestroyCharts();
    }
    if (!MB.gridApi) mbRenderGrid();
    else MB.gridApi.setGridOption('rowData', MB.filteredTickets);

    const rc = document.getElementById('mb-record-count');
    if (rc) rc.textContent = `${MB.filteredTickets.length} of ${MB.allTickets.length} emails`;
    if (typeof lucide!=='undefined') lucide.createIcons();
}

/* ══════════════════════════════════════════════════════════════
   1 — EXECUTIVE INSIGHTS (auto-generated narrative)
   ══════════════════════════════════════════════════════════════ */
function mbRenderInsights() {
    const el = document.getElementById('mb-insights');
    if (!el) return;
    const t = MB.filteredTickets;
    if (!t.length) { el.innerHTML=''; return; }
    const k = mbGetKPIs(t);
    const cards = [];

    // SLA breach
    if (k.slaOutside>0) {
        const pct = k.slaCompliance!=null ? (100-k.slaCompliance) : null;
        cards.push({icon:'shield-alert', color:'#e74c3c',
            title:`${k.slaOutside} emails outside SLA`,
            sub: pct!=null?`${pct}% of open emails need action`:'Open SLA breaches'});
    }
    const load = {};
    t.filter(x=>x.status==='In Progress').forEach(x=>{ const n=x.smFullName; if(n&&n!=='Unknown Agent') load[n]=(load[n]||0)+1; });
    const top = Object.entries(load).sort((a,b)=>b[1]-a[1])[0];
    if (top) cards.push({icon:'user', color:'#f39c12', title:`${top[0].split(' ').slice(0,2).join(' ')} has most open emails`, sub:`${top[1]} assigned and still open`});

    const wk = mbBucketByPeriod(t,'W').filter(b=>b.recv>0);
    if (wk.length>=2) {
        const prev=wk[wk.length-2], cur=wk[wk.length-1];
        cards.push({icon: cur.recv>=prev.recv?'trending-up':'trending-down', color: cur.recv>=prev.recv?'#e67e22':'#27ae60',
            title:`${cur.recv} emails last week`,
            sub:`${cur.recv>=prev.recv?'Up from':'Down from'} ${prev.recv} the week before`});
    } else if (wk.length===1) {
        cards.push({icon:'mail', color:'#4c6fff', title:`${wk[0].recv} emails last week`, sub:'Latest week in this file'});
    }
    if (k.unassigned>0) {
        const un = t.filter(x=>x.status==='Unassigned');
        const oldest = Math.max(...un.map(x=>x.ageDays||0));
        cards.push({icon:'inbox', color:'#9b59b6', title:`${k.unassigned} unassigned emails`, sub:`Oldest waiting ${oldest.toFixed(1)} days — assign now`});
    }
    if (k.avgAge!=null) cards.push({icon:'clock', color:'#4c6fff', title:`Avg ${k.avgAge.toFixed(1)} days open`, sub: k.avgResolve!=null?`Completed emails avg ${k.avgResolve.toFixed(1)} days`:'Across open emails'});

    el.innerHTML = cards.slice(0,4).map(c=>`
        <div style="flex:1;min-width:200px;background:var(--bg-card);border:1px solid var(--border);border-left:3px solid ${c.color};border-radius:12px;padding:12px 14px;box-shadow:var(--cs);">
            <div style="display:flex;align-items:center;gap:8px;">
                <div style="width:30px;height:30px;border-radius:8px;background:${c.color}18;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                    <i data-lucide="${c.icon}" style="width:16px;height:16px;color:${c.color};"></i>
                </div>
                <div style="min-width:0;">
                    <div style="font-size:13px;font-weight:800;color:var(--t1);line-height:1.2;">${c.title}</div>
                    <div style="font-size:11px;color:var(--t3);margin-top:2px;">${c.sub}</div>
                </div>
            </div>
        </div>`).join('');
    if (typeof lucide!=='undefined') lucide.createIcons();
}

/* ══════════════════════════════════════════════════════════════
   2 — TOP FILTERS
   ══════════════════════════════════════════════════════════════ */
function mbRenderTopFilters() {
    const container = document.getElementById('mb-top-filters');
    if (!container) return;

    const allAgents = [...new Set(MB.allTickets.map(t=>t.smFullName).filter(n=>n&&n!=='Unknown Agent'))].sort();
    const allLocs   = [...new Set(MB.allTickets.map(t=>t.location||'Unknown').filter(Boolean))].sort();
    const allSla    = [...new Set(MB.allTickets.map(t=>t.slaStatus||'Unknown').filter(Boolean))].sort();
    const allYears  = [...new Set(MB.allTickets.map(t=>t.recvYear).filter(Boolean))].sort().reverse();
    const allYMs    = [...new Set(MB.allTickets.map(t=>t.recvYM).filter(Boolean))].sort().reverse();
    const allWeeks  = [...new Set(MB.allTickets.map(t=>t.recvWeek).filter(Boolean))].sort().reverse().slice(0,20);
    const allDays   = [...new Set(MB.allTickets.map(t=>t.recvDay).filter(Boolean))].sort().reverse().slice(0,30);

    function dd(id, label, opts, selected, onChangeFn) {
        const selCount = selected.length;
        const btnLabel = selCount===0 ? `All ${label}` : `${selCount} selected`;
        return `<div style="flex:1;min-width:130px;">
            <div style="font-size:.62rem;font-weight:700;text-transform:uppercase;color:var(--t3);letter-spacing:.05em;margin-bottom:4px;">${label}</div>
            <div style="position:relative;">
                <div id="${id}-trigger" onclick="mbToggleDD('${id}')" style="display:flex;align-items:center;justify-content:space-between;padding:7px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg-input);cursor:pointer;font-size:12px;color:var(--t1);white-space:nowrap;">
                    <span style="overflow:hidden;text-overflow:ellipsis;">${btnLabel}</span>
                    <i data-lucide="chevron-down" style="width:12px;height:12px;flex-shrink:0;margin-left:4px;"></i>
                </div>
                <div id="${id}-dd" style="display:none;position:absolute;top:calc(100% + 4px);left:0;min-width:180px;z-index:9999;background:var(--bg-card);border:1px solid var(--border);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.18);max-height:240px;overflow-y:auto;">
                    <div style="padding:6px 10px;border-bottom:1px solid var(--border);">
                        <label style="display:flex;align-items:center;gap:7px;font-size:12px;cursor:pointer;font-weight:700;color:var(--t1);">
                            <input type="checkbox" ${selCount===0?'checked':''} onchange="${onChangeFn}('__all__',this)" style="accent-color:var(--acc);">All
                        </label>
                    </div>
                    ${opts.map(o=>{
                        const lbl = label==='Week' ? o : (label==='Day' ? new Date(o+'T00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : o);
                        return `<div style="padding:5px 10px;">
                            <label style="display:flex;align-items:center;gap:7px;font-size:12px;cursor:pointer;color:var(--t1);">
                                <input type="checkbox" value="${o}" ${selected.includes(o)?'checked':''} onchange="${onChangeFn}('${String(o).replace(/'/g,"\\'")}',this)" style="accent-color:var(--acc);">${lbl}
                            </label>
                        </div>`;
                    }).join('')}
                </div>
            </div>
        </div>`;
    }

    container.innerHTML = `
    <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;padding:12px 16px;background:var(--bg-card);border:1px solid var(--border);border-radius:12px;box-shadow:var(--cs);margin-bottom:1rem;">
        ${dd('mb-f-sm',   'Agent',      allAgents, MB.filterSMs,       'mbFilterSM')}
        ${dd('mb-f-loc',  'Location',   allLocs,   MB.filterLocations, 'mbFilterLoc')}
        ${dd('mb-f-sla',  'SLA Status', allSla,    MB.filterSlaStatus, 'mbFilterSla')}
        ${dd('mb-f-year', 'Year',       allYears,  MB.filterYears,     'mbFilterYear')}
        ${dd('mb-f-month','Month',      allYMs,    MB.filterMonths,    'mbFilterMonth')}
        ${dd('mb-f-week', 'Week',       allWeeks,  MB.filterWeeks,     'mbFilterWeek')}
        ${dd('mb-f-day',  'Day',        allDays,   MB.filterDays,      'mbFilterDay')}
        <button type="button" class="reset-btn" onclick="mbClearAllFilters()" style="padding:7px 12px;font-size:11px;align-self:flex-end;white-space:nowrap;">
            <i data-lucide="rotate-ccw" style="width:11px;height:11px;display:inline-block;vertical-align:middle;margin-right:3px;"></i>Clear All
        </button>
    </div>`;
    if (typeof lucide!=='undefined') lucide.createIcons();
}

window.mbToggleDD = function(id) {
    const dd = document.getElementById(id+'-dd');
    if (!dd) return;
    document.querySelectorAll('[id$="-dd"]').forEach(el => { if (el.id!==id+'-dd') el.style.display='none'; });
    dd.style.display = dd.style.display==='none' ? 'block' : 'none';
};
document.addEventListener('click', e => {
    if (!e.target.closest('[id$="-trigger"]')&&!e.target.closest('[id$="-dd"]'))
        document.querySelectorAll('[id$="-dd"]').forEach(el=>el.style.display='none');
});
function _mbSetFilter(arr, val, cb) {
    if (val==='__all__') { arr.length=0; }
    else if (cb.checked) { if (!arr.includes(val)) arr.push(val); }
    else { const i=arr.indexOf(val); if(i>-1) arr.splice(i,1); }
    mbApplyFilters(); mbRenderAll();
}
window.mbFilterSM    = (v,cb) => _mbSetFilter(MB.filterSMs,       v, cb);
window.mbFilterLoc   = (v,cb) => _mbSetFilter(MB.filterLocations, v, cb);
window.mbFilterSla   = (v,cb) => _mbSetFilter(MB.filterSlaStatus, v, cb);
window.mbFilterYear  = (v,cb) => _mbSetFilter(MB.filterYears,  v, cb);
window.mbFilterMonth = (v,cb) => _mbSetFilter(MB.filterMonths, v, cb);
window.mbFilterWeek  = (v,cb) => _mbSetFilter(MB.filterWeeks,  v, cb);
window.mbFilterDay   = (v,cb) => _mbSetFilter(MB.filterDays,   v, cb);
window.mbClearAllFilters = () => {
    MB.filterSMs=[]; MB.filterLocations=[]; MB.filterSlaStatus=[];
    MB.filterYears=[]; MB.filterMonths=[]; MB.filterWeeks=[]; MB.filterDays=[];
    MB.activeKpiFilter=null; MB.activeSlaFilter=null; MB.ageFilter=null; MB.drillAgent=null;
    mbApplyFilters(); mbRenderAll();
};

/* ══════════════════════════════════════════════════════════════
   3 — KPI STRIP
   ══════════════════════════════════════════════════════════════ */
function mbRenderKPIs() {
    const k  = mbGetKPIs();
    const af = MB.activeKpiFilter;
    const tiles = [
        { id:'mb-kpi-total',      val:k.total,      filter:null,         color:'#4c6fff', sub:'All received' },
        { id:'mb-kpi-unassigned', val:k.unassigned, filter:'unassigned', color:'#e74c3c', sub:'No agent / Citrix' },
        { id:'mb-kpi-inprogress', val:k.inprogress, filter:'inprogress', color:'#f39c12', sub:'Assigned, open' },
        { id:'mb-kpi-closed',     val:k.completed,  filter:'closed',     color:'#27ae60', sub:'Flag completed' },
        { id:'mb-kpi-age',        val:k.avgAge!=null?k.avgAge.toFixed(1)+'d':'—', filter:null, color:'#a855f7', sub:'Avg days open' },
    ];
    tiles.forEach(tile => {
        const el = document.getElementById(tile.id), sub=document.getElementById(tile.id+'-sub');
        if (el) el.textContent = tile.val;
        if (sub) sub.textContent = tile.sub;
        const card = el ? (el.closest('.kpi-card')||el.parentElement) : null;
        if (!card||!tile.filter) return;
        card.style.cursor='pointer';
        card.style.outline    = af===tile.filter ? `2px solid ${tile.color}` : '';
        card.style.background  = af===tile.filter ? `${tile.color}18` : '';
        card.onclick = () => {
            MB.activeKpiFilter = MB.activeKpiFilter===tile.filter ? null : tile.filter;
            MB.activeSlaFilter = null;
            mbApplyFilters(); mbRenderAll();
            mbScrollToGrid();
        };
    });
}
function mbScrollToGrid(){ const g=document.getElementById('mb-ag-grid'); if(g) g.scrollIntoView({behavior:'smooth',block:'start'}); }

/* ══════════════════════════════════════════════════════════════
   4 — SLA PANEL
   ══════════════════════════════════════════════════════════════ */
function mbRenderSlaPanel() {
    const el = document.getElementById('mb-sla-panel');
    if (!el) return;
    const k = mbGetKPIs();
    const sf = MB.activeSlaFilter;
    const compColor = k.slaCompliance==null?'#95a5a6':k.slaCompliance>=90?'#27ae60':k.slaCompliance>=70?'#f39c12':'#e74c3c';

    el.innerHTML = `
    <div class="table-section" style="margin-bottom:1rem;">
        <div class="table-header" style="margin-bottom:.75rem;">
            <h3 class="table-title"><i data-lucide="shield-check" style="width:18px;height:18px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>SLA Command Center</h3>
            <div style="font-size:12px;color:var(--t3);">Open emails only</div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.75rem;">
            <div onclick="mbToggleSla('within')" style="cursor:pointer;background:var(--bg-card);border:2px solid ${sf==='within'?'#27ae60':'var(--border)'};border-radius:12px;padding:1rem;${sf==='within'?'background:#27ae6018;':''}box-shadow:var(--cs);">
                <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;color:var(--t3);margin-bottom:.3rem;">✅ Within SLA</div>
                <div style="font-size:1.7rem;font-weight:900;color:#27ae60;line-height:1;">${k.slaWithin}</div>
            </div>
            <div onclick="mbToggleSla('outside')" style="cursor:pointer;background:var(--bg-card);border:2px solid ${sf==='outside'?'#e74c3c':'var(--border)'};border-radius:12px;padding:1rem;${sf==='outside'?'background:#e74c3c18;':''}box-shadow:var(--cs);">
                <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;color:var(--t3);margin-bottom:.3rem;">🔴 Outside SLA</div>
                <div style="font-size:1.7rem;font-weight:900;color:#e74c3c;line-height:1;">${k.slaOutside}</div>
            </div>
            <div style="background:var(--bg-card);border:2px solid var(--border);border-radius:12px;padding:1rem;box-shadow:var(--cs);">
                <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;color:var(--t3);margin-bottom:.3rem;">🎯 Compliance</div>
                <div style="font-size:1.7rem;font-weight:900;color:${compColor};line-height:1;">${k.slaCompliance!=null?k.slaCompliance+'%':'—'}</div>
            </div>
            <div style="background:var(--bg-card);border:2px solid ${k.dueSoon?'#e67e22':'var(--border)'};border-radius:12px;padding:1rem;box-shadow:var(--cs);">
                <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;color:var(--t3);margin-bottom:.3rem;">⏰ Due in 24h</div>
                <div style="font-size:1.7rem;font-weight:900;color:${k.dueSoon?'#e67e22':'var(--t2)'};line-height:1;">${k.dueSoon}</div>
            </div>
        </div>
    </div>`;
    if (typeof lucide!=='undefined') lucide.createIcons();
}
window.mbToggleSla = function(v){
    MB.activeSlaFilter = MB.activeSlaFilter===v?null:v;
    MB.activeKpiFilter = null;
    mbApplyFilters(); mbRenderAll(); mbScrollToGrid();
};

/* ══════════════════════════════════════════════════════════════
   5 — AGE VISIBILITY
   ══════════════════════════════════════════════════════════════ */
function mbRenderAgeTiles() {
    const container = document.getElementById('mb-age-section');
    if (!container) return;
    const tog = MB.ageStatusToggle||'both';
    const af  = MB.ageFilter;
    const src = MB.filteredTickets.filter(x => {
        if (tog==='unassigned') return x.status==='Unassigned';
        if (tog==='inprogress') return x.status==='In Progress';
        return x.status==='Unassigned'||x.status==='In Progress';
    });
    const b02 = src.filter(x=>x.ageDays!=null&&x.ageDays<2).length;
    const b25 = src.filter(x=>x.ageDays!=null&&x.ageDays>=2&&x.ageDays<5).length;
    const b5p = src.filter(x=>x.ageDays!=null&&x.ageDays>=5).length;

    const togBtns = [['both','Both'],['unassigned','Unassigned'],['inprogress','Assigned']].map(([v,l])=>
        `<button type="button" onclick="MB.ageStatusToggle='${v}';mbRenderAgeTiles();"
        style="padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;
        border:1px solid ${v===tog?'transparent':'var(--border)'};background:${v===tog?'var(--grad)':'var(--bg-secondary)'};color:${v===tog?'#fff':'var(--t3)'};">${l}</button>`
    ).join('');

    container.innerHTML = `
    <div class="table-section" style="margin-bottom:1rem;">
        <div class="table-header" style="margin-bottom:.75rem;">
            <h3 class="table-title"><i data-lucide="clock" style="width:18px;height:18px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Email Age Visibility</h3>
            <div style="display:flex;gap:6px;align-items:center;">
                <span style="font-size:11px;color:var(--t3);">Show:</span>${togBtns}
                ${af?`<button type="button" class="reset-btn" onclick="MB.ageFilter=null;mbApplyFilters();mbRenderAll();" style="padding:3px 9px;font-size:11px;">✕ Clear</button>`:''}
            </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.75rem;margin-bottom:1rem;">
            ${[['0-2','0–2 Days',b02,'#27ae60','✅'],['2-5','2–5 Days',b25,'#f39c12','⚠️'],['5+','5+ Days',b5p,'#e74c3c','🔴']].map(([bucket,label,val,color,icon])=>`
            <div onclick="mbToggleAgeFilter('${bucket}')" style="background:var(--bg-card);border:2px solid ${af===bucket?color:'var(--border)'};border-radius:12px;padding:1rem;cursor:pointer;${af===bucket?`background:${color}18;`:''}box-shadow:var(--cs);">
                <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;color:var(--t3);margin-bottom:.3rem;">${icon} ${label}</div>
                <div style="font-size:1.7rem;font-weight:900;color:${color};line-height:1;">${val}</div>
                <div style="font-size:.7rem;color:var(--t3);margin-top:.2rem;">emails</div>
            </div>`).join('')}
        </div>
        <div style="font-size:.75rem;font-weight:700;color:var(--t2);margin-bottom:.5rem;">Age breakdown per agent</div>
        <div style="position:relative;height:300px;overflow:hidden;"><canvas id="mb-chart-age"></canvas></div>
    </div>`;
    if (typeof lucide!=='undefined') lucide.createIcons();
    mbRenderAgeChart();
}
window.mbToggleAgeFilter = function(bucket) {
    MB.ageFilter = MB.ageFilter===bucket ? null : bucket;
    mbApplyFilters(); mbRenderAll(); mbScrollToGrid();
};

/* ══════════════════════════════════════════════════════════════
   CHART INFRA
   ══════════════════════════════════════════════════════════════ */
const MB_AX = {
    x:{ grid:{display:false}, ticks:{font:{size:10},color:'rgba(160,160,180,0.8)'} },
    y:{ grid:{color:'rgba(168,85,247,0.08)'}, ticks:{font:{size:10},color:'rgba(160,160,180,0.8)',precision:0} },
};
const MB_LEG = { position:'bottom', labels:{font:{size:10},padding:8,boxWidth:9,boxHeight:9,color:'rgba(160,160,180,0.9)'} };
function mbMakeChart(key, config) {
    const canvas = document.getElementById('mb-chart-'+key);
    if (!canvas || typeof Chart==='undefined') return;
    if (MB.charts[key]) { try{MB.charts[key].destroy();}catch(e){} }
    if (!config.options) config.options={};
    if (!config.options.plugins) config.options.plugins={};
    config.options.plugins.datalabels = {display:false};
    config.options.animation = {duration:0};
    MB.charts[key] = new Chart(canvas, config);
}

function mbRenderAgeChart() {
    const tog = MB.ageStatusToggle||'both';
    const src = MB.filteredTickets.filter(x=>{
        if (tog==='unassigned') return x.status==='Unassigned';
        if (tog==='inprogress') return x.status==='In Progress';
        return x.status==='Unassigned'||x.status==='In Progress';
    });
    const smMap = {};
    src.forEach(t=>{
        const n = t.smFullName||'Unassigned';
        if (!smMap[n]) smMap[n]={b02:0,b25:0,b5p:0};
        if (t.ageDays==null) return;
        if (t.ageDays<2) smMap[n].b02++; else if (t.ageDays<5) smMap[n].b25++; else smMap[n].b5p++;
    });
    const names = Object.keys(smMap).sort((a,b)=>(smMap[b].b02+smMap[b].b25+smMap[b].b5p)-(smMap[a].b02+smMap[a].b25+smMap[a].b5p)).slice(0,15);
    mbMakeChart('age',{
        type:'bar',
        data:{ labels:names, datasets:[
            {label:'0–2 Days',data:names.map(n=>smMap[n].b02),backgroundColor:'rgba(39,174,96,0.8)',borderRadius:3,borderSkipped:false},
            {label:'2–5 Days',data:names.map(n=>smMap[n].b25),backgroundColor:'rgba(243,156,18,0.8)',borderRadius:3,borderSkipped:false},
            {label:'5+ Days', data:names.map(n=>smMap[n].b5p),backgroundColor:'rgba(231,76,60,0.8)', borderRadius:3,borderSkipped:false},
        ]},
        options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,
            plugins:{legend:{position:'top',labels:{font:{size:10},padding:8,boxWidth:9,boxHeight:9,color:'rgba(160,160,180,0.9)'}}},
            scales:{x:{stacked:true,...MB_AX.y},y:{stacked:true,grid:{display:false},ticks:{font:{size:10},color:'rgba(160,160,180,0.8)'}}}},
    });
}

/* ══════════════════════════════════════════════════════════════
   6 — TREND (Received vs Completed + backlog) with D/W/M toggle
   ══════════════════════════════════════════════════════════════ */
function mbRenderTrend() {
    const wrap = document.getElementById('mb-trend-toggles');
    const per  = MB.trendPeriod;
    if (wrap) wrap.innerHTML = [['D','Daily'],['W','Weekly'],['M','Monthly']].map(([v,l])=>
        `<button type="button" onclick="MB.trendPeriod='${v}';mbRenderTrend();"
        style="padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;
        border:1px solid ${v===per?'transparent':'var(--border)'};background:${v===per?'var(--grad)':'var(--bg-secondary)'};color:${v===per?'#fff':'var(--t3)'};">${l}</button>`
    ).join('');

    const buckets = mbBucketByPeriod(MB.filteredTickets, per);
    const labels  = buckets.map(b=>b.label);
    const recv    = buckets.map(b=>b.recv);
    const done    = buckets.map(b=>b.done);
    let running=0; const backlog = buckets.map(b=>{ running += b.recv - b.done; return running; });

    mbMakeChart('trend',{
        type:'bar',
        data:{ labels, datasets:[
            {type:'bar', label:'Received', data:recv, backgroundColor:'rgba(76,111,255,0.75)', borderRadius:4, order:2},
            {type:'bar', label:'Completed', data:done, backgroundColor:'rgba(39,174,96,0.8)', borderRadius:4, order:2},
            {type:'line', label:'Still open (running total)', data:backlog, borderColor:'#e74c3c', backgroundColor:'rgba(231,76,60,0.1)', borderWidth:2.5, pointRadius:3, tension:0.3, fill:false, order:1, yAxisID:'y1'},
        ]},
        options:{responsive:true,maintainAspectRatio:false,
            plugins:{legend:MB_LEG},
            scales:{
                x:{...MB_AX.x, ticks:{...MB_AX.x.ticks,maxRotation:45,maxTicksLimit:20}},
                y:{...MB_AX.y, title:{display:true,text:'Emails',font:{size:10},color:'rgba(160,160,180,0.7)'}},
                y1:{position:'right',grid:{display:false},ticks:{font:{size:10},color:'rgba(231,76,60,0.8)',precision:0},title:{display:true,text:'Still open',font:{size:10},color:'rgba(231,76,60,0.7)'}},
            }},
    });
}

/* ══════════════════════════════════════════════════════════════
   7 — FORECAST (volume + backlog projection)
   ══════════════════════════════════════════════════════════════ */
function mbRenderForecast() {
    const el = document.getElementById('mb-forecast');
    if (!el) return;
    const buckets = mbBucketByPeriod(MB.filteredTickets, 'W');
    const k = mbGetKPIs();
    if (buckets.length < 2) { el.innerHTML = '<div style="color:var(--t3);padding:16px;font-size:13px;">Not enough history for forecast.</div>'; return; }

    const recv = buckets.map(b=>b.recv);
    const done = buckets.map(b=>b.done);
    const reg  = mbLinReg(recv);
    const N    = recv.length;
    const proj = [reg.predict(N), reg.predict(N+1), reg.predict(N+2)].map(v=>Math.round(v));
    const avgIntake  = recv.reduce((a,b)=>a+b,0)/N;
    const avgClosure = done.reduce((a,b)=>a+b,0)/N;
    const openNow = k.unassigned + k.inprogress;
    const netPerWk = avgIntake - avgClosure;
    const clearWeeks = avgClosure>0 ? Math.ceil(openNow/avgClosure) : null;
    const dir = reg.slope>0.5?'rising':reg.slope<-0.5?'falling':'stable';
    const dirColor = dir==='rising'?'#e67e22':dir==='falling'?'#27ae60':'#4c6fff';

    // chart: history + projected
    const labels = buckets.map(b=>b.label).concat(['+1w','+2w','+3w']);
    const histData = recv.concat([null,null,null]);
    const projData = new Array(N-1).fill(null).concat([recv[N-1], ...proj]);

    el.innerHTML = `
    <div class="table-section" style="margin-bottom:1rem;">
        <div class="table-header" style="margin-bottom:.75rem;">
            <h3 class="table-title"><i data-lucide="trending-up" style="width:18px;height:18px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Forecast &amp; Capacity</h3>
            <div style="font-size:12px;color:var(--t3);">Linear projection · weekly</div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.75rem;margin-bottom:1rem;">
            <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:1rem;box-shadow:var(--cs);">
                <div style="font-size:.66rem;font-weight:700;text-transform:uppercase;color:var(--t3);margin-bottom:.3rem;">Next Week (est.)</div>
                <div style="font-size:1.6rem;font-weight:900;color:${dirColor};line-height:1;">${proj[0]}</div>
                <div style="font-size:.7rem;color:var(--t3);margin-top:.2rem;">emails per week</div>
            </div>
            <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:1rem;box-shadow:var(--cs);">
                <div style="font-size:.66rem;font-weight:700;text-transform:uppercase;color:var(--t3);margin-bottom:.3rem;">Avg Intake / wk</div>
                <div style="font-size:1.6rem;font-weight:900;color:#4c6fff;line-height:1;">${avgIntake.toFixed(0)}</div>
                <div style="font-size:.7rem;color:var(--t3);margin-top:.2rem;">vs ${avgClosure.toFixed(0)} closed</div>
            </div>
            <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:1rem;box-shadow:var(--cs);">
                <div style="font-size:.66rem;font-weight:700;text-transform:uppercase;color:var(--t3);margin-bottom:.3rem;">Open queue trend</div>
                <div style="font-size:1.6rem;font-weight:900;color:${netPerWk>0?'#e74c3c':'#27ae60'};line-height:1;">${netPerWk>0?'+':''}${netPerWk.toFixed(0)}/wk</div>
                <div style="font-size:.7rem;color:var(--t3);margin-top:.2rem;">${netPerWk>0?'growing':'shrinking'}</div>
            </div>
            <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:1rem;box-shadow:var(--cs);">
                <div style="font-size:.66rem;font-weight:700;text-transform:uppercase;color:var(--t3);margin-bottom:.3rem;">Time to clear open</div>
                <div style="font-size:1.6rem;font-weight:900;color:#a855f7;line-height:1;">${clearWeeks!=null?clearWeeks+'w':'—'}</div>
                <div style="font-size:.7rem;color:var(--t3);margin-top:.2rem;">${openNow} open @ current rate</div>
            </div>
        </div>
        <div style="position:relative;height:240px;overflow:hidden;"><canvas id="mb-chart-forecast"></canvas></div>
    </div>`;
    if (typeof lucide!=='undefined') lucide.createIcons();

    mbMakeChart('forecast',{
        type:'line',
        data:{ labels, datasets:[
            {label:'Actual received', data:histData, borderColor:'#4c6fff', backgroundColor:'rgba(76,111,255,0.12)', borderWidth:2.5, pointRadius:3, tension:0.3, fill:true},
            {label:'Forecast', data:projData, borderColor:'#e67e22', borderDash:[6,4], borderWidth:2.5, pointRadius:3, tension:0.3, fill:false},
        ]},
        options:{responsive:true,maintainAspectRatio:false,plugins:{legend:MB_LEG},
            scales:{x:{...MB_AX.x,ticks:{...MB_AX.x.ticks,maxRotation:45,maxTicksLimit:20}},y:{...MB_AX.y}}},
    });
}

/* ══════════════════════════════════════════════════════════════
   8 — AGENT LEADERBOARD + DRILLDOWN
   ══════════════════════════════════════════════════════════════ */
function mbBuildAgentStats(list) {
    const map = {};
    list.forEach(t => {
        if (t.status==='Unassigned' || !t.smFullName || t.smFullName==='Unknown Agent') return;
        const n = t.smFullName;
        if (!map[n]) map[n] = { name:n, location:t.location||t.smTeam||'—', total:0, open:0, completed:0, outside:0, within:0, ages:[], res:[], cats:{} };
        const s = map[n];
        s.total++;
        if (t.status==='In Progress') s.open++;
        if (t.status==='Completed'||t.status==='Closed') s.completed++;
        if (t.status!=='Completed' && mbIsOutside(t)) s.outside++;
        if (t.status!=='Completed' && mbIsWithin(t)) s.within++;
        if (t.ageDays!=null) s.ages.push(t.ageDays);
        if (t.resolveDays!=null) s.res.push(t.resolveDays);
        if (t.category) s.cats[t.category]=(s.cats[t.category]||0)+1;
    });
    return Object.values(map).map(s=>({
        ...s,
        avgAge: s.ages.length ? s.ages.reduce((a,b)=>a+b,0)/s.ages.length : null,
        avgRes: s.res.length ? s.res.reduce((a,b)=>a+b,0)/s.res.length : null,
        slaPct: (s.within+s.outside) ? Math.round(s.within/(s.within+s.outside)*100) : null,
        topCat: Object.entries(s.cats).sort((a,b)=>b[1]-a[1])[0]?.[0] || '—',
    }));
}

function mbRenderAgentTable() {
    const el = document.getElementById('mb-agent-table');
    if (!el) return;
    const stats = mbBuildAgentStats(MB.filteredTickets).sort((a,b)=>b.open-a.open || b.outside-a.outside || b.total-a.total);

    if (!stats.length) { el.innerHTML = '<div style="color:var(--t3);padding:20px;text-align:center;">No agent data.</div>'; return; }

    const maxOpen = Math.max(...stats.map(s=>s.open), 1);
    const rows = stats.map((s,i)=>{
        const grad = MB_CLR.smColors[i%MB_CLR.smColors.length];
        const initials = s.name.split(' ').filter(Boolean).map(w=>w[0]).join('').substring(0,2).toUpperCase();
        const ageColor = s.avgAge==null?'var(--t3)':s.avgAge>7?'#e74c3c':s.avgAge>3?'#f39c12':'#27ae60';
        const slaColor = s.slaPct==null?'var(--t3)':s.slaPct>=90?'#27ae60':s.slaPct>=70?'#f39c12':'#e74c3c';
        const sel = MB.drillAgent===s.name;
        const safe = s.name.replace(/'/g,"\\'");
        return `<tr onclick="mbDrillAgent('${safe}')" style="cursor:pointer;border-bottom:1px solid var(--border);${sel?'background:rgba(168,85,247,0.08);':''}">
            <td style="padding:8px 10px;"><div style="display:flex;align-items:center;gap:8px;">
                <div style="width:30px;height:30px;border-radius:50%;background:${grad};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;color:#fff;flex-shrink:0;">${initials}</div>
                <div><div style="font-size:12px;font-weight:700;color:var(--t1);">${s.name}</div><div style="font-size:10px;color:var(--t3);">${s.location}</div></div>
            </div></td>
            <td style="padding:8px 10px;"><div style="display:flex;align-items:center;gap:6px;">
                <div style="flex:1;height:6px;background:var(--bg-secondary);border-radius:4px;overflow:hidden;min-width:40px;"><div style="height:100%;width:${s.open/maxOpen*100}%;background:${grad};"></div></div>
                <span style="font-size:12px;font-weight:800;color:var(--t1);min-width:22px;text-align:right;">${s.open}</span>
            </div></td>
            <td style="padding:8px 10px;text-align:center;font-size:12px;font-weight:700;color:#27ae60;">${s.completed}</td>
            <td style="padding:8px 10px;text-align:center;font-size:12px;font-weight:800;color:${s.outside?'#e74c3c':'var(--t3)'};">${s.outside}</td>
            <td style="padding:8px 10px;text-align:center;font-size:12px;font-weight:800;color:${slaColor};">${s.slaPct!=null?s.slaPct+'%':'—'}</td>
            <td style="padding:8px 10px;text-align:center;font-size:12px;font-weight:800;color:${ageColor};">${s.avgAge!=null?s.avgAge.toFixed(1)+'d':'—'}</td>
            <td style="padding:8px 10px;font-size:11px;color:var(--t2);max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${s.topCat}</td>
        </tr>`;
    }).join('');

    el.innerHTML = `
    <div style="max-height:420px;overflow-y:auto;overflow-x:auto;border:1px solid var(--border);border-radius:10px;">
    <table style="width:100%;border-collapse:collapse;">
        <thead><tr style="border-bottom:2px solid var(--border);">
            <th style="padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;color:var(--t3);font-weight:700;">Agent</th>
            <th style="padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;color:var(--t3);font-weight:700;">Open Load</th>
            <th style="padding:8px 10px;text-align:center;font-size:10px;text-transform:uppercase;color:var(--t3);font-weight:700;">Done</th>
            <th style="padding:8px 10px;text-align:center;font-size:10px;text-transform:uppercase;color:var(--t3);font-weight:700;">Outside SLA</th>
            <th style="padding:8px 10px;text-align:center;font-size:10px;text-transform:uppercase;color:var(--t3);font-weight:700;">SLA %</th>
            <th style="padding:8px 10px;text-align:center;font-size:10px;text-transform:uppercase;color:var(--t3);font-weight:700;">Avg Age</th>
            <th style="padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;color:var(--t3);font-weight:700;">Top Issue</th>
        </tr></thead>
        <tbody>${rows}</tbody>
    </table>
    </div>`;

    mbRenderAgentDrill();
}

window.mbDrillAgent = function(name){
    MB.drillAgent = MB.drillAgent===name ? null : name;
    mbApplyFilters(); mbRenderAll();
};

function mbRenderAgentDrill() {
    const el = document.getElementById('mb-agent-drill');
    if (!el) return;
    if (!MB.drillAgent) { el.style.display='none'; el.innerHTML=''; return; }
    el.style.display='block';
    // drilldown uses unfiltered-by-agent data so it always shows the agent fully within other filters
    const base = MB.allTickets.filter(t => t.smFullName===MB.drillAgent);
    const s = mbBuildAgentStats(base)[0];
    if (!s) { el.style.display='none'; return; }
    const topCats = Object.entries(s.cats).sort((a,b)=>b[1]-a[1]).slice(0,6);
    const openList = base.filter(mbIsOpen).sort((a,b)=>(b.ageDays||0)-(a.ageDays||0)).slice(0,8);

    el.innerHTML = `
    <div style="background:var(--bg-card);border:1px solid var(--acc);border-radius:12px;padding:1rem;margin-top:.75rem;box-shadow:var(--cs);">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem;">
            <div style="font-size:14px;font-weight:800;color:var(--t1);"><i data-lucide="user-circle" style="width:16px;height:16px;display:inline-block;vertical-align:middle;margin-right:6px;color:var(--acc);"></i>${s.name} · ${s.location}</div>
            <button type="button" class="reset-btn" onclick="mbDrillAgent('${s.name.replace(/'/g,"\\'")}')" style="padding:3px 10px;font-size:11px;">✕ Close</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:.6rem;margin-bottom:1rem;">
            ${[['Open',s.open,'#f39c12'],['Completed',s.completed,'#27ae60'],['Outside SLA',s.outside,'#e74c3c'],['SLA %',s.slaPct!=null?s.slaPct+'%':'—','#4c6fff'],['Avg Age',s.avgAge!=null?s.avgAge.toFixed(1)+'d':'—','#a855f7']].map(([l,v,c])=>`
            <div style="background:var(--bg-secondary);border-radius:10px;padding:.7rem;text-align:center;">
                <div style="font-size:.62rem;font-weight:700;text-transform:uppercase;color:var(--t3);">${l}</div>
                <div style="font-size:1.3rem;font-weight:900;color:${c};line-height:1.3;">${v}</div>
            </div>`).join('')}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
            <div>
                <div style="font-size:11px;font-weight:700;color:var(--t2);margin-bottom:.5rem;">Issue mix</div>
                ${topCats.map(([c,n])=>`<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px;"><span style="color:var(--t2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px;">${c}</span><span style="color:var(--acc);font-weight:700;">${n}</span></div>`).join('')||'<span style="font-size:11px;color:var(--t3);">—</span>'}
            </div>
            <div>
                <div style="font-size:11px;font-weight:700;color:var(--t2);margin-bottom:.5rem;">Oldest open emails</div>
                ${openList.map(x=>`<div style="display:flex;justify-content:space-between;gap:8px;font-size:11px;margin-bottom:4px;">
                    <span style="color:var(--t2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${x.subject||x.from||'—'}</span>
                    <span style="color:${(x.ageDays||0)>5?'#e74c3c':'var(--t3)'};font-weight:700;white-space:nowrap;">${x.ageDays!=null?x.ageDays.toFixed(1)+'d':'—'}</span>
                </div>`).join('')||'<span style="font-size:11px;color:var(--t3);">None open</span>'}
            </div>
        </div>
    </div>`;
    if (typeof lucide!=='undefined') lucide.createIcons();
}

/* ══════════════════════════════════════════════════════════════
   9 — CATEGORY & DISTRIBUTION CHARTS
   ══════════════════════════════════════════════════════════════ */
function mbRenderCategories() {
    const t = MB.filteredTickets;
    // Status donut
    const u=t.filter(x=>x.status==='Unassigned').length;
    const i=t.filter(x=>x.status==='In Progress').length;
    const c=t.filter(x=>x.status==='Completed'||x.status==='Closed').length;
    mbMakeChart('status',{ type:'doughnut',
        data:{labels:['Unassigned','Assigned (Open)','Completed'],datasets:[{data:[u,i,c],backgroundColor:['#e74c3c','#f39c12','#27ae60'],borderWidth:3,borderColor:'var(--bg-card)',hoverOffset:8}]},
        options:{responsive:true,maintainAspectRatio:false,cutout:'62%',plugins:{legend:MB_LEG}} });

    // Location donut
    const locMap={}; t.forEach(x=>{ const l=x.location||'Unknown'; locMap[l]=(locMap[l]||0)+1; });
    const locNames=Object.keys(locMap);
    mbMakeChart('location',{ type:'doughnut',
        data:{labels:locNames,datasets:[{data:locNames.map(l=>locMap[l]),backgroundColor:locNames.map((_,idx)=>MB_CLR.smColors[idx%MB_CLR.smColors.length]),borderWidth:3,borderColor:'var(--bg-card)',hoverOffset:8}]},
        options:{responsive:true,maintainAspectRatio:false,cutout:'62%',plugins:{legend:MB_LEG}} });

    // Top categories (with outside-SLA overlay)
    const catMap={};
    t.forEach(x=>{ if(!x.category) return; if(!catMap[x.category]) catMap[x.category]={total:0,outside:0}; catMap[x.category].total++; if(x.status!=='Completed'&&mbIsOutside(x)) catMap[x.category].outside++; });
    const sorted=Object.entries(catMap).sort((a,b)=>b[1].total-a[1].total).slice(0,10);
    mbMakeChart('categories',{ type:'bar',
        data:{labels:sorted.map(e=>e[0]),datasets:[
            {label:'Total',data:sorted.map(e=>e[1].total),backgroundColor:'rgba(76,111,255,0.75)',borderRadius:4,borderSkipped:false},
            {label:'Outside SLA',data:sorted.map(e=>e[1].outside),backgroundColor:'rgba(231,76,60,0.85)',borderRadius:4,borderSkipped:false},
        ]},
        options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:MB_LEG},
            scales:{x:{...MB_AX.x,grid:{color:'rgba(168,85,247,0.08)'}},y:{...MB_AX.y,grid:{display:false}}}} });

    // Agent workload bar (toggle)
    mbRenderWorkloadChart();
}

function mbRenderWorkloadChart() {
    const ws = MB.workloadStatus||'inprogress';
    const wrap = document.getElementById('mb-workload-toggles');
    if (wrap) wrap.innerHTML = [['inprogress','Open'],['completed','Completed'],['outside','Outside SLA'],['all','All']].map(([v,l])=>
        `<button type="button" onclick="MB.workloadStatus='${v}';mbRenderWorkloadChart();"
        style="padding:3px 9px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;
        border:1px solid ${v===ws?'transparent':'var(--border)'};background:${v===ws?'var(--grad)':'var(--bg-secondary)'};color:${v===ws?'#fff':'var(--t3)'};">${l}</button>`
    ).join('');

    const stats = mbBuildAgentStats(MB.filteredTickets);
    let sorted, datasets;
    if (ws==='all') {
        sorted = stats.sort((a,b)=>b.total-a.total).slice(0,15);
        datasets=[
            {label:'Open',data:sorted.map(s=>s.open),backgroundColor:'rgba(243,156,18,0.85)',borderRadius:4,borderSkipped:false},
            {label:'Completed',data:sorted.map(s=>s.completed),backgroundColor:'rgba(39,174,96,0.85)',borderRadius:4,borderSkipped:false},
        ];
    } else {
        const key = ws==='completed'?'completed':ws==='outside'?'outside':'open';
        sorted = stats.sort((a,b)=>b[key]-a[key]).slice(0,15);
        const color = ws==='completed'?'rgba(39,174,96,0.85)':ws==='outside'?'rgba(231,76,60,0.85)':'rgba(243,156,18,0.85)';
        datasets=[{label:ws==='completed'?'Completed':ws==='outside'?'Outside SLA':'Open',data:sorted.map(s=>s[key]),backgroundColor:color,borderRadius:4,borderSkipped:false}];
    }
    mbMakeChart('workload',{ type:'bar',
        data:{labels:sorted.map(s=>s.name),datasets},
        options:{responsive:true,maintainAspectRatio:false,
            plugins:{legend:{display:ws==='all',...MB_LEG}},
            scales:{x:{...(ws==='all'?{stacked:true}:{}),grid:{display:false},ticks:{font:{size:10},color:'rgba(160,160,180,0.8)',maxRotation:40}},
                    y:{...(ws==='all'?{stacked:true}:{}),...MB_AX.y}}} });
}

/* ══════════════════════════════════════════════════════════════
   GRID SEARCH
   ══════════════════════════════════════════════════════════════ */
window.mbSearch = function(val) { if(MB.gridApi) MB.gridApi.setGridOption('quickFilterText',val); };

/* ══════════════════════════════════════════════════════════════
   SHOW / HIDE GRAPHS
   ══════════════════════════════════════════════════════════════ */
window.mbToggleCharts = function() {
    MB.chartsVisible = !MB.chartsVisible;
    const section = document.getElementById('mb-charts-section');
    const btn     = document.getElementById('mb-toggle-charts-btn');
    if (section) section.style.display = MB.chartsVisible ? 'block' : 'none';
    if (btn) {
        btn.innerHTML = MB.chartsVisible
            ? '<i data-lucide="eye-off" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Hide Analytics Charts'
            : '<i data-lucide="bar-chart-2" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Show Analytics Charts';
        if (typeof lucide!=='undefined') lucide.createIcons();
    }
    if (MB.chartsVisible) {
        mbRenderAgeTiles();
        mbRenderTrend();
        mbRenderForecast();
        mbRenderCategories();
    } else {
        mbDestroyCharts();
    }
};

/* ══════════════════════════════════════════════════════════════
   AG GRID — SM-style set filter (checkbox list, not "contains")
   ══════════════════════════════════════════════════════════════ */
function MbSetColumnFilter() {}
MbSetColumnFilter.prototype.init = function(params) {
    this.params = params;
    this.selected = new Set();
    this.gui = document.createElement('div');
    this.gui.className = 'sm-ag-set-filter';
    this._buildGui();
};
MbSetColumnFilter.prototype._cellValue = function(data) {
    const field = this.params.colDef.field;
    let v = data[field];
    if (v === null || v === undefined || v === '') return '—';
    if (field === 'ageDays' && typeof v === 'number') return v + 'd';
    return String(v);
};
MbSetColumnFilter.prototype._allValues = function() {
    const values = new Set(), self = this;
    this.params.api.forEachNode(function(node) {
        if (node.data) values.add(self._cellValue(node.data));
    });
    return Array.from(values).sort((a,b)=>a.localeCompare(b));
};
MbSetColumnFilter.prototype._buildGui = function() {
    const self = this, all = this._allValues();
    this.gui.innerHTML = '';
    const search = document.createElement('input');
    search.type = 'text';
    search.placeholder = 'Search...';
    search.className = 'sm-ag-set-search';
    this.gui.appendChild(search);
    const list = document.createElement('div');
    list.className = 'sm-ag-set-list';
    this.gui.appendChild(list);
    const render = function(term) {
        list.innerHTML = '';
        all.filter(v => !term || v.toLowerCase().includes(term.toLowerCase())).forEach(v => {
            const row = document.createElement('label');
            row.className = 'sm-ag-set-option';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = self.selected.has(v);
            cb.onchange = function() {
                if (cb.checked) self.selected.add(v); else self.selected.delete(v);
                self.params.filterChangedCallback();
            };
            row.appendChild(cb);
            row.appendChild(document.createTextNode(' ' + v));
            list.appendChild(row);
        });
    };
    render('');
    search.oninput = function() { render(search.value); };
    const actions = document.createElement('div');
    actions.className = 'sm-ag-set-actions';
    const btnAll = document.createElement('button');
    btnAll.type = 'button'; btnAll.textContent = 'Select all';
    btnAll.onclick = function() { all.forEach(v => self.selected.add(v)); render(search.value); self.params.filterChangedCallback(); };
    const btnClear = document.createElement('button');
    btnClear.type = 'button'; btnClear.textContent = 'Clear';
    btnClear.onclick = function() { self.selected.clear(); render(search.value); self.params.filterChangedCallback(); };
    actions.appendChild(btnAll); actions.appendChild(btnClear);
    this.gui.appendChild(actions);
};
MbSetColumnFilter.prototype.getGui = function() { return this.gui; };
MbSetColumnFilter.prototype.isFilterActive = function() { return this.selected.size > 0; };
MbSetColumnFilter.prototype.doesFilterPass = function(params) {
    if (!this.selected.size) return true;
    return this.selected.has(this._cellValue(params.data));
};
MbSetColumnFilter.prototype.getModel = function() { return this.selected.size ? { values: Array.from(this.selected) } : null; };
MbSetColumnFilter.prototype.setModel = function(model) {
    this.selected = new Set(model && model.values ? model.values : []);
    this._buildGui();
};
MbSetColumnFilter.prototype.destroy = function() {};

function mbEnhanceCol(col) {
    col.filter = MbSetColumnFilter;
    col.floatingFilter = false;
    col.menuTabs = ['filterMenuTab'];
    return col;
}

function mbInjectGridStyles() {
    if (document.getElementById('mb-ag-grid-styles')) return;
    const style = document.createElement('style');
    style.id = 'mb-ag-grid-styles';
    style.textContent = `
        .sm-ag-set-filter { padding:.5rem; min-width:200px; max-width:260px; }
        .sm-ag-set-search { width:100%; box-sizing:border-box; margin-bottom:.45rem; padding:.35rem .5rem; border:1px solid var(--border); border-radius:8px; font-size:.75rem; background:var(--bg-card); color:var(--t1); }
        .sm-ag-set-list { max-height:180px; overflow-y:auto; display:flex; flex-direction:column; gap:.2rem; }
        .sm-ag-set-option { display:flex; align-items:center; gap:.35rem; font-size:.75rem; cursor:pointer; padding:.15rem 0; color:var(--t1); }
        .sm-ag-set-actions { display:flex; gap:.35rem; margin-top:.45rem; }
        .sm-ag-set-actions button { flex:1; padding:.25rem .4rem; font-size:.68rem; font-weight:700; border:1px solid var(--border); border-radius:6px; background:rgba(168,85,247,.08); color:var(--acc); cursor:pointer; }
    `;
    document.head.appendChild(style);
}

function mbRenderGrid() {
    const el = document.getElementById('mb-ag-grid');
    if (!el || typeof agGrid==='undefined') return;
    const statusR = p => {
        if (!p.value) return '—';
        const cls={'Unassigned':'badge-danger','In Progress':'badge-warning','Closed':'badge-success','Completed':'badge-success'}[p.value]||'';
        return `<span class="status-badge ${cls}" style="font-size:10px;">${p.value}</span>`;
    };
    const slaR = p => {
        if (!p.value) return '—';
        const v=String(p.value);
        const color = v.toLowerCase().includes('outside')?'#e74c3c':v.toLowerCase().includes('within')?'#27ae60':'var(--t2)';
        return `<span style="font-size:10px;font-weight:700;color:${color};">${v}</span>`;
    };
    mbInjectGridStyles();
    const cols=[
        mbEnhanceCol({field:'status',        headerName:'Status',        width:130,pinned:'left',cellRenderer:statusR}),
        mbEnhanceCol({field:'smFullName',    headerName:'Agent',         width:160}),
        mbEnhanceCol({field:'citrixId',      headerName:'Citrix ID',     width:105}),
        mbEnhanceCol({field:'location',      headerName:'Location',      width:95}),
        mbEnhanceCol({field:'slaStatus',     headerName:'SLA Status',    width:150,cellRenderer:slaR}),
        mbEnhanceCol({field:'from',          headerName:'From',          width:170}),
        mbEnhanceCol({field:'subject',       headerName:'Subject',       flex:1,tooltipField:'subject',minWidth:220}),
        mbEnhanceCol({field:'category',      headerName:'Category',      width:185}),
        mbEnhanceCol({field:'receivedFmt',   headerName:'Received',      width:150,sort:'desc'}),
        mbEnhanceCol({field:'assignedDateFmt',headerName:'Assigned',     width:150}),
        mbEnhanceCol({field:'ageDays',       headerName:'Age (d)',       width:95,comparator:(a,b)=>(a||0)-(b||0),
         cellRenderer:p=>p.value==null?'—':`<span style="font-size:12px;font-weight:700;color:${p.value>7?'#e74c3c':p.value>3?'#f39c12':'var(--t2)'};">${p.value}d</span>`}),
        mbEnhanceCol({field:'slaDueFmt',     headerName:'SLA Due',       width:150}),
        mbEnhanceCol({field:'flagDateFmt',   headerName:'Completed',     width:150}),
    ];
    if (MB.gridApi) { try{MB.gridApi.destroy();}catch(e){} MB.gridApi=null; }
    el.innerHTML='';
    agGrid.createGrid(el,{
        columnDefs:cols, rowData:MB.filteredTickets,
        defaultColDef:{sortable:true,resizable:true,minWidth:80,filter:true,floatingFilter:false},
        pagination:true,paginationPageSize:50,paginationPageSizeSelector:[25,50,100,200],
        rowHeight:42,headerHeight:42,animateRows:true,enableCellTextSelection:true,
        getRowStyle:p=>p.data?.status==='Unassigned'?{background:'rgba(231,76,60,0.05)'}:null,
        onGridReady:p=>{MB.gridApi=p.api;},
    });
}

/* ══════════════════════════════════════════════════════════════
   UI HELPERS
   ══════════════════════════════════════════════════════════════ */
function mbShowStatus(msg) {
    const el=document.getElementById('mb-status-bar');
    if (!el) return;
    el.textContent=msg; el.style.display=msg?'block':'none';
}
function mbShowToast(msg,type) {
    if (typeof showToast==='function'){showToast(msg,type);return;}
    console.log('[SEMailbox]',msg);
}

/* ══════════════════════════════════════════════════════════════
   HTML SHELL
   ══════════════════════════════════════════════════════════════ */
function mbInjectShell() {
    const root=document.getElementById('semailbox-root');
    if (!root) return;
    root.innerHTML=`
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.75rem;margin-bottom:1rem;">
        <div>
            <h2 class="section-title" style="margin:0!important;">
                <i data-lucide="inbox" style="width:20px;height:20px;display:inline-block;vertical-align:middle;margin-right:8px;"></i>SE Mailbox Intelligence
            </h2>
            <div style="font-size:.75rem;color:var(--t3);">Agent/Citrix assignment · Assigned date = Received + 1 day</div>
        </div>
    </div>

    <div id="mb-status-bar" style="display:none;background:rgba(168,85,247,0.1);border:1px solid rgba(168,85,247,0.25);border-radius:8px;padding:10px 14px;font-size:13px;color:var(--t2);margin-bottom:12px;"></div>
    <div id="mb-upload-area" style="display:none;margin-bottom:1rem;padding:12px 16px;background:var(--bg-card);border:1px solid var(--border);border-radius:12px;box-shadow:var(--cs);"></div>

    <!-- Executive insights -->
    <div id="mb-insights" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:1rem;"></div>

    <!-- Filters -->
    <div id="mb-top-filters"></div>

    <!-- KPI strip -->
    <div class="top-stats" style="grid-template-columns:repeat(5,1fr);margin-bottom:1rem;">
        <div class="stat-card kpi-card"><div class="stat-label">Total Emails</div><div class="stat-value" id="mb-kpi-total" style="color:var(--acc);">—</div><div class="stat-subtitle" id="mb-kpi-total-sub">All received</div></div>
        <div class="stat-card kpi-card"><div class="stat-label">Unassigned</div><div class="stat-value" id="mb-kpi-unassigned" style="color:#e74c3c;">—</div><div class="stat-subtitle" id="mb-kpi-unassigned-sub">No agent</div></div>
        <div class="stat-card kpi-card"><div class="stat-label">Assigned (Open)</div><div class="stat-value" id="mb-kpi-inprogress" style="color:#f39c12;">—</div><div class="stat-subtitle" id="mb-kpi-inprogress-sub">Agent assigned</div></div>
        <div class="stat-card kpi-card"><div class="stat-label">Completed</div><div class="stat-value" id="mb-kpi-closed" style="color:#27ae60;">—</div><div class="stat-subtitle" id="mb-kpi-closed-sub">Flag completed</div></div>
        <div class="stat-card kpi-card"><div class="stat-label">Avg Age</div><div class="stat-value" id="mb-kpi-age" style="color:#a855f7;">—</div><div class="stat-subtitle" id="mb-kpi-age-sub">Days open</div></div>
    </div>

    <!-- SLA panel -->
    <div id="mb-sla-panel"></div>

    <!-- Agent leaderboard -->
    <div class="table-section" style="margin-bottom:1rem;">
        <div class="table-header" style="margin-bottom:.75rem;">
            <h3 class="table-title"><i data-lucide="users" style="width:18px;height:18px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Agent Leaderboard</h3>
            <div style="font-size:12px;color:var(--t3);">Click a row to drill down</div>
        </div>
        <div id="mb-agent-table"></div>
        <div id="mb-agent-drill" style="display:none;"></div>
    </div>

    <!-- Show / hide charts -->
    <div style="text-align:center;margin-bottom:1rem;">
        <button type="button" id="mb-toggle-charts-btn" class="export-btn" onclick="mbToggleCharts()" style="padding:12px 24px;font-size:14px;">
            <i data-lucide="bar-chart-2" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>Show Analytics Charts
        </button>
    </div>

    <!-- All charts (hidden by default) -->
    <div id="mb-charts-section" style="display:none;">
        <div id="mb-age-section"></div>

        <div class="chart-card" style="margin-bottom:1rem;">
            <div class="chart-title" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
                <span><i data-lucide="activity" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:5px;"></i>Received vs Completed &amp; Open Queue</span>
                <div id="mb-trend-toggles" style="display:flex;gap:5px;"></div>
            </div>
            <div style="position:relative;height:280px;overflow:hidden;"><canvas id="mb-chart-trend"></canvas></div>
        </div>

        <div id="mb-forecast"></div>

        <div class="charts-section" style="grid-template-columns:1fr 1fr 2fr;margin-bottom:1rem;">
            <div class="chart-card">
                <div class="chart-title"><i data-lucide="pie-chart" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:5px;"></i>Status Split</div>
                <div style="position:relative;height:240px;overflow:hidden;"><canvas id="mb-chart-status"></canvas></div>
            </div>
            <div class="chart-card">
                <div class="chart-title"><i data-lucide="map-pin" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:5px;"></i>By Location</div>
                <div style="position:relative;height:240px;overflow:hidden;"><canvas id="mb-chart-location"></canvas></div>
            </div>
            <div class="chart-card">
                <div class="chart-title" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px;">
                    <span><i data-lucide="bar-chart-2" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:5px;"></i>Agent Workload</span>
                    <div id="mb-workload-toggles" style="display:flex;gap:5px;flex-wrap:wrap;"></div>
                </div>
                <div style="position:relative;height:240px;overflow:hidden;"><canvas id="mb-chart-workload"></canvas></div>
            </div>
        </div>

        <div class="chart-card" style="margin-bottom:1rem;">
            <div class="chart-title"><i data-lucide="tag" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:5px;"></i>Top Issue Categories (Total vs Outside SLA)</div>
            <div style="position:relative;height:320px;overflow:hidden;"><canvas id="mb-chart-categories"></canvas></div>
        </div>
    </div>

    <!-- Grid -->
    <div class="table-section">
        <div class="table-header">
            <h3 class="table-title"><i data-lucide="table" style="width:18px;height:18px;display:inline-block;vertical-align:middle;margin-right:6px;"></i>All Emails</h3>
            <div class="table-actions">
                <input type="text" class="search-box" id="mb-ag-search" placeholder="Search all columns..." style="min-width:180px;">
                <span id="mb-record-count" style="font-size:12px;color:var(--t3);white-space:nowrap;">No data</span>
            </div>
        </div>
        <div id="mb-ag-grid" class="ag-theme-alpine" style="height:600px;width:100%;"></div>
    </div>`;
}

/* ══════════════════════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════════════════════ */
let _mbInited = false;
const SEMailbox = {
    async init() {
        const isAdmin = window.USER_CONTEXT && window.USER_CONTEXT.isAdmin;
        mbInjectShell();

        document.getElementById('mb-ag-search').oninput   = e => mbSearch(e.target.value);

        if (isAdmin) {
            const area = document.getElementById('mb-upload-area');
            if (area) { area.style.display='block'; mbBuildUploadBtn(MB.lastFileName); }
        }
        if (typeof lucide!=='undefined') lucide.createIcons();

        if (_mbInited && MB.dataLoaded) { mbRenderAll(); return; }
        _mbInited = true;

        await mbLoadAccountMapping();
        const loaded = await mbLoadFromSP();
        if (!loaded) mbShowStatus(isAdmin
            ? 'No saved data — upload the TSM SE MailBox Excel file.'
            : 'No mailbox data available.');
    }
};
function initSEMailbox() { SEMailbox.init(); }
