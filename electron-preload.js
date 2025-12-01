const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    generateVideo: (url) => ipcRenderer.invoke('generate-video', url),
    onLog: (callback) => ipcRenderer.on('log-message', (_event, value) => callback(value))
});
