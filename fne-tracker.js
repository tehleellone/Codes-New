// fne-tracker.js — bootstrap for standalone GKLA FNE Tracker (entry + list only)
window.FNE_STANDALONE = true;

window.fneOnStandaloneReady = function() {
  const overlay = document.getElementById('loadingOverlay');
  const shell = document.getElementById('trackerContent');
  if (overlay) overlay.style.display = 'none';
  if (shell) {
    shell.style.display = 'flex';
    shell.style.flexDirection = 'column';
  }
};

function launchTracker() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.style.display = 'flex';
  const step = document.getElementById('loadingStep');
  if (step) step.textContent = 'Loading tracker records...';

  const badge = document.getElementById('dbUserBadge');
  if (badge) badge.textContent = USER.name + ' · ' + USER.role;

  const dateEl = document.getElementById('currentDate');
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString('en-US', {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
    });
  }

  try {
    const bt = localStorage.getItem('fne_base_theme') || 'blue';
    const dm = localStorage.getItem('fne_dark_mode') === 'true';
    const sel = document.getElementById('colorSchemeSelector');
    if (sel) sel.value = bt;
    if (typeof applyTheme === 'function') applyTheme(bt, dm);
  } catch (e) {}

  if (typeof fneInit === 'function') fneInit();
  else if (typeof fneOnStandaloneReady === 'function') fneOnStandaloneReady();
}

function initTrackerAccess() {
  spGet(SP_SITE + '/_api/web/currentuser?$select=Title,Email', function(err, data) {
    if (err) {
      showTrackerDenied('Cannot reach SharePoint');
      return;
    }
    USER.email = data.d.Email;
    USER.name = data.d.Title;
    spGet(
      SP_SITE + "/_api/web/lists/getbytitle('" + SP_ACCESS + "')/items?$select=UserEmailID,Role&$filter=UserEmailID eq '" + USER.email + "'",
      function(err2, data2) {
        if (err2 || !data2.d.results.length) {
          showTrackerDenied('No access record found');
          return;
        }
        USER.role = data2.d.results[0].Role || 'Viewer';
        USER.IsAdmin = ['Admin', 'Director'].includes(USER.role);
        launchTracker();
      }
    );
  });
}

function showTrackerDenied(msg) {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.style.display = 'flex';
  const step = document.getElementById('loadingStep');
  if (step) step.textContent = msg;
  const title = document.querySelector('.loading-title');
  if (title) title.textContent = 'Access Denied';
}

document.addEventListener('keydown', function(e) {
  if (e.ctrlKey && e.shiftKey && e.key === 'D') {
    const dc = document.getElementById('devConsole');
    if (dc) dc.style.display = dc.style.display === 'none' ? 'flex' : 'none';
  }
});

function devLogin() {
  const email = document.getElementById('devEmailInput').value.trim();
  if (!email) return;
  USER.email = email;
  USER.name = email.split('@')[0].replace(/\./g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
  USER.role = document.getElementById('devRoleInput').value.trim() || 'Admin';
  USER.IsAdmin = ['Admin', 'Director'].includes(USER.role);
  launchTracker();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTrackerAccess);
} else {
  initTrackerAccess();
}
