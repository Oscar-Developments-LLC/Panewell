'use strict';

const path = require('path');
const {
  app,
  BrowserWindow,
  WebContentsView,
  ipcMain,
  shell,
  components
} = require('electron');

// Height of the chrome strip (tab row + address row) in CSS pixels.
// Must match --chrome-height in src/ui/style.css.
const CHROME_HEIGHT = 84;

let win = null;

/** @type {Map<number, WebContentsView>} id -> view */
const tabs = new Map();
let activeTabId = null;
let nextTabId = 1;

// True while a page is using HTML fullscreen (a site's own fullscreen
// button) or while the user has pressed F11. Both hide the chrome strip
// so the page gets the entire window.
let immersive = false;

const NEW_TAB_URL = `file://${path.join(__dirname, 'ui', 'newtab.html')}`;

// ---------------------------------------------------------------------------
// Window + layout
// ---------------------------------------------------------------------------

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 760,
    minWidth: 420,
    minHeight: 300,
    frame: false,

    // THE KEY LINE. Electron's default behavior is to take the whole
    // monitor when a page calls the HTML fullscreen API. With the window
    // marked non-fullscreenable, that request can't resize the window, so
    // the video just expands to fill whatever this window currently is.
    fullscreenable: false,

    backgroundColor: '#101012',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  win.loadFile(path.join(__dirname, 'ui', 'index.html'));

  win.once('ready-to-show', () => {
    win.show();
    createTab(NEW_TAB_URL);
  });

  win.on('resize', layoutActiveTab);
  win.on('maximize', () => {
    layoutActiveTab();
    sendToChrome('window:state', { maximized: true });
  });
  win.on('unmaximize', () => {
    layoutActiveTab();
    sendToChrome('window:state', { maximized: false });
  });

  win.on('closed', () => {
    win = null;
    tabs.clear();
  });
}

/** Area the page content should occupy, given the current chrome state. */
function contentBounds() {
  const [width, height] = win.getContentSize();
  const top = immersive ? 0 : CHROME_HEIGHT;
  return { x: 0, y: top, width, height: Math.max(0, height - top) };
}

function layoutActiveTab() {
  if (!win || activeTabId === null) return;
  const view = tabs.get(activeTabId);
  if (view) view.setBounds(contentBounds());
}

function sendToChrome(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

function createTab(url = NEW_TAB_URL, { activate = true } = {}) {
  const id = nextTabId++;

  const view = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      // Each tab shares the default session, so logins persist across
      // tabs and across launches like a normal browser.
      backgroundThrottling: false
    }
  });

  tabs.set(id, view);
  win.contentView.addChildView(view);

  const wc = view.webContents;

  wc.on('page-title-updated', (_e, title) => {
    sendToChrome('tab:updated', { id, title });
  });

  wc.on('page-favicon-updated', (_e, favicons) => {
    sendToChrome('tab:updated', { id, favicon: favicons[0] || null });
  });

  wc.on('did-start-loading', () => sendToChrome('tab:updated', { id, loading: true }));
  wc.on('did-stop-loading', () => {
    sendToChrome('tab:updated', {
      id,
      loading: false,
      url: wc.getURL(),
      canGoBack: wc.navigationHistory.canGoBack(),
      canGoForward: wc.navigationHistory.canGoForward()
    });
  });

  wc.on('did-navigate', () => pushNavState(id, wc));
  wc.on('did-navigate-in-page', () => pushNavState(id, wc));

  // A site's own fullscreen button. Because the window is not
  // fullscreenable, all that's left to do is hide our chrome strip so the
  // page fills the window edge to edge.
  wc.on('enter-html-full-screen', () => setImmersive(true));
  wc.on('leave-html-full-screen', () => setImmersive(false));

  // Links that would open a new window become new tabs instead.
  wc.setWindowOpenHandler(({ url: target }) => {
    if (target.startsWith('http://') || target.startsWith('https://')) {
      createTab(target);
    } else {
      shell.openExternal(target).catch(() => {});
    }
    return { action: 'deny' };
  });

  // Keyboard shortcuts still work while the page has focus. Without this,
  // F11 and Ctrl+T would only fire when the chrome strip was focused.
  wc.on('before-input-event', (event, input) => {
    if (handleShortcut(input)) event.preventDefault();
  });

  wc.loadURL(url).catch(() => {});

  sendToChrome('tab:created', { id, title: 'New tab', url });
  if (activate) setActiveTab(id);

  return id;
}

function pushNavState(id, wc) {
  sendToChrome('tab:updated', {
    id,
    url: wc.getURL(),
    canGoBack: wc.navigationHistory.canGoBack(),
    canGoForward: wc.navigationHistory.canGoForward()
  });
}

function setActiveTab(id) {
  if (!tabs.has(id)) return;
  activeTabId = id;

  // Only the active view gets real bounds; the others are parked at zero
  // size, which keeps them alive (and still playing audio) without
  // drawing over the active one.
  for (const [tabId, view] of tabs) {
    if (tabId === id) {
      view.setBounds(contentBounds());
      win.contentView.addChildView(view); // re-add raises it to the top
    } else {
      view.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    }
  }

  const wc = tabs.get(id).webContents;
  wc.focus();
  sendToChrome('tab:activated', {
    id,
    url: wc.getURL(),
    canGoBack: wc.navigationHistory.canGoBack(),
    canGoForward: wc.navigationHistory.canGoForward()
  });
}

function closeTab(id) {
  const view = tabs.get(id);
  if (!view) return;

  win.contentView.removeChildView(view);
  view.webContents.close();
  tabs.delete(id);
  sendToChrome('tab:closed', { id });

  if (tabs.size === 0) {
    win.close();
    return;
  }

  if (activeTabId === id) {
    setActiveTab([...tabs.keys()].pop());
  }
}

function activeWebContents() {
  const view = activeTabId !== null ? tabs.get(activeTabId) : null;
  return view ? view.webContents : null;
}

// ---------------------------------------------------------------------------
// Immersive mode (site fullscreen or F11)
// ---------------------------------------------------------------------------

function setImmersive(on) {
  immersive = on;
  sendToChrome('chrome:immersive', { immersive });
  layoutActiveTab();
}

function toggleImmersive() {
  // If a site put itself in fullscreen, F11 should back out of that too,
  // otherwise the page keeps its fullscreen layout with our chrome back
  // on top of it.
  const wc = activeWebContents();
  if (immersive && wc && wc.isCurrentlyAudibleOrFullScreen) {
    // no-op guard; handled below
  }
  if (immersive && wc) {
    wc.executeJavaScript(
      'if (document.fullscreenElement) { document.exitFullscreen(); }',
      true
    ).catch(() => {});
  }
  setImmersive(!immersive);
}

// ---------------------------------------------------------------------------
// Shortcuts
// ---------------------------------------------------------------------------

function handleShortcut(input) {
  if (input.type !== 'keyDown') return false;
  const mod = process.platform === 'darwin' ? input.meta : input.control;

  if (input.key === 'F11') {
    toggleImmersive();
    return true;
  }
  if (input.key === 'Escape' && immersive) {
    toggleImmersive();
    return true;
  }
  if (mod && input.key.toLowerCase() === 't') {
    createTab(NEW_TAB_URL);
    return true;
  }
  if (mod && input.key.toLowerCase() === 'w') {
    if (activeTabId !== null) closeTab(activeTabId);
    return true;
  }
  if (mod && input.key.toLowerCase() === 'l') {
    if (immersive) setImmersive(false);
    sendToChrome('chrome:focus-address', {});
    return true;
  }
  if (mod && input.key.toLowerCase() === 'r') {
    const wc = activeWebContents();
    if (wc) wc.reload();
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// IPC from the chrome UI
// ---------------------------------------------------------------------------

ipcMain.handle('tab:new', (_e, url) => createTab(url || NEW_TAB_URL));
ipcMain.handle('tab:close', (_e, id) => closeTab(id));
ipcMain.handle('tab:activate', (_e, id) => setActiveTab(id));

ipcMain.handle('nav:go', (_e, url) => {
  const wc = activeWebContents();
  if (wc) wc.loadURL(normalizeUrl(url)).catch(() => {});
});
ipcMain.handle('nav:back', () => {
  const wc = activeWebContents();
  if (wc && wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack();
});
ipcMain.handle('nav:forward', () => {
  const wc = activeWebContents();
  if (wc && wc.navigationHistory.canGoForward()) wc.navigationHistory.goForward();
});
ipcMain.handle('nav:reload', () => {
  const wc = activeWebContents();
  if (wc) wc.reload();
});
ipcMain.handle('nav:stop', () => {
  const wc = activeWebContents();
  if (wc) wc.stop();
});

ipcMain.handle('window:minimize', () => win && win.minimize());
ipcMain.handle('window:toggle-maximize', () => {
  if (!win) return;
  if (win.isMaximized()) win.unmaximize();
  else win.maximize();
});
ipcMain.handle('window:close', () => win && win.close());
ipcMain.handle('window:is-maximized', () => (win ? win.isMaximized() : false));

ipcMain.handle('chrome:toggle-immersive', () => toggleImmersive());

/** Turn typed text into either a URL or a search. */
function normalizeUrl(input) {
  const text = String(input || '').trim();
  if (!text) return NEW_TAB_URL;
  if (/^[a-z][a-z0-9+\-.]*:\/\//i.test(text)) return text;
  if (/^(about|file|data):/i.test(text)) return text;

  const looksLikeHost = /^[^\s/]+\.[^\s/]{2,}(\/|$|:)/.test(text);
  if (looksLikeHost) return `https://${text}`;

  return `https://duckduckgo.com/?q=${encodeURIComponent(text)}`;
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

app.whenReady().then(async () => {
  // castlabs ECS: fetch/verify the Widevine CDM before any page loads, so
  // DRM video (Netflix, Disney+, Hulu, Prime) can play. On a stock
  // Electron build `components` is undefined, so this stays optional.
  if (components && typeof components.whenReady === 'function') {
    try {
      await components.whenReady();
    } catch (err) {
      console.error('Widevine components failed to load:', err);
    }
  }
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
