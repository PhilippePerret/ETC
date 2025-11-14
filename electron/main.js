const { existsSync } = require('fs');
const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const userDataPath = app.getPath('userData');

// const WITH_CONSOLE_DEV = true;
const WITH_CONSOLE_DEV = false;

let server = null;

const path = require('path');

const ICON_PATH = app.isPackaged
  ? path.join(process.resourcesPath, 'app.asar.unpacked', 'electron', 'icon.png')
  : path.join(__dirname, 'icon.png');

if (existsSync(ICON_PATH)) {
  // console.log("Icon path: ", ICON_PATH);
} else {
  throw new Error("Unfound icon");
}

app.name = "ETC";

const bunPath = app.isPackaged 
? path.join(process.resourcesPath, 'bun')
: 'bun';

let PORT;

if (process.env.NODE_ENV === 'test'){
  PORT = 3004;
} else if (app.isPackaged) {
  PORT = 3003;
} else {
  PORT = 3002;
}
const HOST = `http://localhost:${PORT}`;


const serverPath = path.join(__dirname, '..', 'lib', 'server', 'server.ts').replace('app.asar', 'app.asar.unpacked');
console.info("serverPath:", serverPath);

const cwdPath = path.join(__dirname, '..').replace('app.asar', 'app.asar.unpacked')
console.info("cwdPath:", cwdPath);

const envProps = { 
  ...process.env, 
  USER_DATA_PATH: userDataPath,
  APP_ICON_PATH: ICON_PATH,
  ETC_MODE: app.isPackaged ? 'prod' : 'dev',
  NODE_ENV: process.env.NODE_ENV || (app.isPackaged ? 'prod' : 'dev'),
  PORT: PORT,
  HOST: HOST,
  NODE_PATH: path.join(cwdPath, 'node_modules'),  // Essai pour résoudre bug \#177
  BUN_INSTALL: cwdPath // Essai pour résoudre bug \#177
}

function startAServer(onReady){
  server = spawn(bunPath, ['--no-cache', 'run', serverPath], {
    cwd: cwdPath,
    env: envProps
  });

  if (!server) { return }
  
  server.stdout.on('data', (data) => {
    const message = data.toString();
    console.log(`SERVER STDOUT: ${message}`);
    if (message.includes('Server running on') && onReady) {
      onReady();
      onReady = null;
    }
  });
  server.stderr.on('data', (data) => console.error(`SERVER STDERR: ${data}`));
  server.on('error', (err) => console.error('SERVER FAILED TO START:', err));
  server.on('exit', (code, signal) => {
    console.log('SERVER EXITED - code:', code, 'signal:', signal);
  });
  server.on('close', (code, signal) => {
    console.log('SERVER CLOSED - code:', code, 'signal:', signal);
    if (signal === 'SIGTRAP' || code !== 0) {
      console.log('Restarting server...');
      setTimeout(() => { startAServer()}, 1000);
    }
  });
} // startAServer

app.whenReady().then(() => {
  app.dock.setIcon(ICON_PATH);

  /*
  console.log('Bun path:', bunPath);
  console.log('Server path:', serverPath);
  console.log('CWD:', path.join(__dirname, '..').replace('app.asar', 'app.asar.unpacked'));
  //*/

  const win = new BrowserWindow({
    x: 10,
    y: WITH_CONSOLE_DEV ? 400 : 800,
    height: WITH_CONSOLE_DEV ? 1000 : 700,
    width: 800,
    // width: 1200, // Pour console
    icon: ICON_PATH,
    /** Pour le preload qui doit permettre la communication
     *  entre les éléments pour mettre la fenêtre au premier
     *  plan
     */
    webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true
      }    
  });
  WITH_CONSOLE_DEV && win.webContents.openDevTools({ mode: 'bottom' });

  // Pour mettre au premier plan (communication IPC)
  const { ipcMain } = require('electron');
  ipcMain.on('bring-to-front', () => {
    bringToFront();
  });

  function bringToFront() {
    app.focus({ steal: true });
    win.show();
    win.focus();
  }
  
  win.webContents.session.clearCache();

  startAServer(() => {
    win.loadURL(HOST);
  });

});

console.info("app.getAppPath():", app.getAppPath());
console.info("process.resourcesPath:", process.resourcesPath);

/**
 * Quand on quitte l'application (donc Electron), il faut aussi
 * quitter le processus Bun de l'application (le serveur).
 */
app.on('before-quit', () => {
  console.log('BEFORE QUIT - killing server');
  if (server && server.pid) {
    try {
      // Tuer le groupe de processus entier
      process.kill(-server.pid, 'SIGTERM');
    } catch(e) {
      console.error('Error killing server:', e);
    }
  }
});