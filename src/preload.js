'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// The chrome UI (tab strip + address bar) runs in its own renderer with
// context isolation on. It gets exactly these calls and nothing else.
contextBridge.exposeInMainWorld('panewell', {
  // Actions
  newTab: (url) => ipcRenderer.invoke('tab:new', url),
  closeTab: (id) => ipcRenderer.invoke('tab:close', id),
  activateTab: (id) => ipcRenderer.invoke('tab:activate', id),

  go: (url) => ipcRenderer.invoke('nav:go', url),
  back: () => ipcRenderer.invoke('nav:back'),
  forward: () => ipcRenderer.invoke('nav:forward'),
  reload: () => ipcRenderer.invoke('nav:reload'),
  stop: () => ipcRenderer.invoke('nav:stop'),

  minimize: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),

  toggleImmersive: () => ipcRenderer.invoke('chrome:toggle-immersive'),

  // Events from the main process
  on: (channel, handler) => {
    const allowed = [
      'tab:created',
      'tab:updated',
      'tab:closed',
      'tab:activated',
      'chrome:immersive',
      'chrome:focus-address',
      'window:state'
    ];
    if (!allowed.includes(channel)) return () => {};
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },

  platform: process.platform
});
