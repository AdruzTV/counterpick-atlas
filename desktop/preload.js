/* Bridge between the pages and the app (desktop/main.js). overlay/js/app.js finds window.cpaDesktop and takes its
   screenshots and window controls from here instead of from Overwolf. */
const { contextBridge, ipcRenderer } = require('electron');

const SITE = 'https://adruztv.github.io/counterpick-atlas/';

contextBridge.exposeInMainWorld('cpaDesktop', {
  keys: ipcRenderer.sendSync('keys'),
  onScan: cb => ipcRenderer.on('scan', (e, result) => cb(result)),
  lastScan: () => ipcRenderer.invoke('last-scan'),
  hideOverlay: () => ipcRenderer.send('hide-overlay'),
  openCalibration: () => ipcRenderer.send('open-calibration'),
  copyText: text => ipcRenderer.invoke('copy-text', text),
});

// A hero newer than this app version has no portrait or artwork in it: take the one on GitHub Pages.
window.addEventListener('error', e => {
  const img = e.target;
  if (!img || img.tagName !== 'IMG' || img.dataset.retry) return;
  const src = img.getAttribute('src') || '';
  if (/^(p|art)\//.test(src)) { img.dataset.retry = '1'; img.src = SITE + src; }
}, true);
