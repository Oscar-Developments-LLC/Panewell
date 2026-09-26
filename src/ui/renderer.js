'use strict';

const api = window.panewell;

const $ = (id) => document.getElementById(id);
const tabsEl = $('tabs');
const addressEl = $('address');

/** @type {Map<number, {id:number,title:string,url:string,favicon:string|null,loading:boolean}>} */
const tabs = new Map();
let activeId = null;
let addressDirty = false;

// ----------------------------------------------------------------- tabs

function renderTabs() {
  tabsEl.textContent = '';

  for (const tab of tabs.values()) {
    const el = document.createElement('div');
    el.className = 'tab' + (tab.id === activeId ? ' active' : '');
    el.title = tab.title || 'New tab';
    el.addEventListener('mousedown', (e) => {
      if (e.button === 1) {
        api.closeTab(tab.id);
        e.preventDefault();
        return;
      }
      if (e.button === 0) api.activateTab(tab.id);
    });

    if (tab.loading) {
      const spin = document.createElement('div');
      spin.className = 'spinner';
      el.appendChild(spin);
    } else if (tab.favicon) {
      const img = document.createElement('img');
      img.className = 'favicon';
      img.src = tab.favicon;
      img.addEventListener('error', () => img.classList.add('placeholder'));
      el.appendChild(img);
    } else {
      const ph = document.createElement('div');
      ph.className = 'favicon placeholder';
      el.appendChild(ph);
    }

    const title = document.createElement('span');
    title.className = 'title';
    title.textContent = tab.title || 'New tab';
    el.appendChild(title);

    const close = document.createElement('button');
    close.className = 'close';
    close.title = 'Close tab (Ctrl+W)';
    close.innerHTML =
      '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>';
    close.addEventListener('click', (e) => {
      e.stopPropagation();
      api.closeTab(tab.id);
    });
    el.appendChild(close);

    tabsEl.appendChild(el);
  }
}

function setAddress(url) {
  if (addressDirty || document.activeElement === addressEl) return;
  addressEl.value = isInternal(url) ? '' : url || '';
}

function isInternal(url) {
  return !url || url.startsWith('file://') || url === 'about:blank';
}

function setNavState({ canGoBack, canGoForward }) {
  if (typeof canGoBack === 'boolean') $('back').disabled = !canGoBack;
  if (typeof canGoForward === 'boolean') $('forward').disabled = !canGoForward;
}

// -------------------------------------------------------------- events

api.on('tab:created', ({ id, title, url }) => {
  tabs.set(id, { id, title: title || 'New tab', url, favicon: null, loading: false });
  renderTabs();
});

api.on('tab:updated', (patch) => {
  const tab = tabs.get(patch.id);
  if (!tab) return;
  Object.assign(tab, patch);
  renderTabs();
  if (patch.id === activeId) {
    if (patch.url !== undefined) setAddress(patch.url);
    setNavState(patch);
  }
});

api.on('tab:closed', ({ id }) => {
  tabs.delete(id);
  renderTabs();
});

api.on('tab:activated', ({ id, url, canGoBack, canGoForward }) => {
  activeId = id;
  addressDirty = false;
  renderTabs();
  setAddress(url);
  setNavState({ canGoBack, canGoForward });
});

api.on('chrome:immersive', ({ immersive }) => {
  // The main process resizes the page view; the chrome window itself just
  // needs to stop drawing so the page owns the full window.
  document.body.style.visibility = immersive ? 'hidden' : 'visible';
});

api.on('chrome:focus-address', () => {
  addressEl.focus();
  addressEl.select();
});

api.on('window:state', ({ maximized }) => {
  $('max').title = maximized ? 'Restore' : 'Maximize';
});

// ------------------------------------------------------------- controls

$('newTab').addEventListener('click', () => api.newTab());
$('back').addEventListener('click', () => api.back());
$('forward').addEventListener('click', () => api.forward());
$('reload').addEventListener('click', () => api.reload());
$('immersive').addEventListener('click', () => api.toggleImmersive());

$('min').addEventListener('click', () => api.minimize());
$('max').addEventListener('click', () => api.toggleMaximize());
$('close').addEventListener('click', () => api.close());

addressEl.addEventListener('input', () => { addressDirty = true; });
addressEl.addEventListener('focus', () => addressEl.select());
addressEl.addEventListener('blur', () => { addressDirty = false; });

addressEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    addressDirty = false;
    api.go(addressEl.value);
    addressEl.blur();
  } else if (e.key === 'Escape') {
    addressDirty = false;
    addressEl.blur();
  }
});

// Shortcuts that fire while the chrome UI has focus. The main process
// handles the same keys while a page has focus.
window.addEventListener('keydown', (e) => {
  const mod = api.platform === 'darwin' ? e.metaKey : e.ctrlKey;
  if (e.key === 'F11') {
    api.toggleImmersive();
    e.preventDefault();
  } else if (mod && e.key.toLowerCase() === 't') {
    api.newTab();
    e.preventDefault();
  } else if (mod && e.key.toLowerCase() === 'w') {
    if (activeId !== null) api.closeTab(activeId);
    e.preventDefault();
  } else if (mod && e.key.toLowerCase() === 'l') {
    addressEl.focus();
    addressEl.select();
    e.preventDefault();
  }
});

// ----------------------------------------------------------- first run

const HINT_KEY = 'panewell.hintSeen';
if (!localStorage.getItem(HINT_KEY)) {
  $('hint').hidden = false;
  $('hintClose').addEventListener('click', () => {
    $('hint').hidden = true;
    localStorage.setItem(HINT_KEY, '1');
  });
}
