const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
// In production (built app), we use the compiled JS in dist.
// In dev (ts-node), we might need to adjust, but for now let's point to dist
// assuming tsc is run before start.
const { runAutomation } = require('./out/notebooklm_bot'); // We will compile TS to JS

function createWindow() {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'electron-preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    win.loadFile('index.html');
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

ipcMain.handle('generate-video', async (event, url) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const userDataDir = path.join(app.getPath('userData'), 'bot_session');
    const outputDir = app.getPath('downloads'); // Save to Downloads folder

    try {
        await runAutomation(url, (msg) => {
            win.webContents.send('log-message', msg);
        }, userDataDir, outputDir);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});
