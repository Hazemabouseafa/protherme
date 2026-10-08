const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const edge = spawn(edgePath, [
  '--headless',
  '--remote-debugging-port=9226',
  '--disable-gpu',
  '--no-sandbox',
  '--window-size=1440,900',
  'http://localhost:8080'
]);

async function run() {
  await new Promise(r => setTimeout(r, 4000));
  
  const targets = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9226/json/list', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });

  const page = targets.find(t => t.type === 'page');
  if (!page) {
    console.error('Page not found');
    edge.kill();
    process.exit(1);
  }

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 1;
  const pending = new Map();

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = id++;
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(msg.error);
      else resolve(msg.result);
    }
  };

  await new Promise(r => ws.onopen = r);
  await new Promise(r => setTimeout(r, 2500));

  const artDir = 'C:/Users/w.i/.gemini/antigravity/brain/8179b806-f526-45b3-ad3e-c0ed97677b4b';

  // 1. Capture Arabic at 1440
  let clip = { x: 0, y: 0, width: 1440, height: 200, scale: 1 };
  let shot = await send('Page.captureScreenshot', { clip });
  fs.writeFileSync(artDir + '/nav_ar_1440.png', Buffer.from(shot.data, 'base64'));

  // 2. Switch to English
  await send('Runtime.evaluate', {
    expression: `(() => {
      const app = document.querySelector('[x-data]')?._x_dataStack?.[0];
      if (app && app.switchLang) app.switchLang('en');
    })()`
  });
  await new Promise(r => setTimeout(r, 1000));

  // Capture English at 1440
  shot = await send('Page.captureScreenshot', { clip });
  fs.writeFileSync(artDir + '/nav_en_1440.png', Buffer.from(shot.data, 'base64'));

  // 3. Switch to 1100px width (laptop / medium desktop)
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1100,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false
  });
  await new Promise(r => setTimeout(r, 500));
  clip.width = 1100;
  shot = await send('Page.captureScreenshot', { clip });
  fs.writeFileSync(artDir + '/nav_en_1100.png', Buffer.from(shot.data, 'base64'));

  // Switch back to AR at 1100px
  await send('Runtime.evaluate', {
    expression: `(() => {
      const app = document.querySelector('[x-data]')?._x_dataStack?.[0];
      if (app && app.switchLang) app.switchLang('ar');
    })()`
  });
  await new Promise(r => setTimeout(r, 500));
  shot = await send('Page.captureScreenshot', { clip });
  fs.writeFileSync(artDir + '/nav_ar_1100.png', Buffer.from(shot.data, 'base64'));

  console.log('Screenshots captured successfully!');
  ws.close();
  edge.kill();
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  edge.kill();
  process.exit(1);
});
