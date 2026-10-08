const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const edge = spawn(edgePath, [
  '--headless',
  '--remote-debugging-port=9227',
  '--disable-gpu',
  '--no-sandbox',
  '--window-size=390,844',
  'http://localhost:8080'
]);

async function run() {
  await new Promise(r => setTimeout(r, 4000));
  
  const targets = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9227/json/list', (res) => {
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
  await new Promise(r => setTimeout(r, 1000));

  const artDir = 'C:/Users/w.i/.gemini/antigravity/brain/8179b806-f526-45b3-ad3e-c0ed97677b4b';

  // Mobile Arabic
  let clip = { x: 0, y: 0, width: 390, height: 180, scale: 1 };
  let shot = await send('Page.captureScreenshot', { clip });
  fs.writeFileSync(artDir + '/nav_mobile_ar.png', Buffer.from(shot.data, 'base64'));

  // Mobile English
  await send('Runtime.evaluate', {
    expression: `(() => {
      const app = document.querySelector('[x-data]')?._x_dataStack?.[0];
      if (app && app.switchLang) app.switchLang('en');
    })()`
  });
  await new Promise(r => setTimeout(r, 500));
  shot = await send('Page.captureScreenshot', { clip });
  fs.writeFileSync(artDir + '/nav_mobile_en.png', Buffer.from(shot.data, 'base64'));

  console.log('Mobile screenshots captured!');
  ws.close();
  edge.kill();
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  edge.kill();
  process.exit(1);
});
