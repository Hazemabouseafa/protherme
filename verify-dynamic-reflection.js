const http = require('http');

async function testDynamicReflection() {
  console.log("====================================================");
  console.log("🧪 TESTING DYNAMIC REFLECTION OF CMS ADDITIONS");
  console.log("====================================================");

  // 1. Fetch current content
  const currentContent = await new Promise((resolve, reject) => {
    http.get('http://localhost:8080/api/content', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });

  console.log("Original FAQs count:", (currentContent.faqList || []).length);
  console.log("Original Hero Stats count:", (currentContent.heroStatsList || []).length);
  console.log("Original Pillars count:", (currentContent.pillarsList || []).length);

  // Clone content and simulate adminCMS init() + add methods
  const mutatedContent = JSON.parse(JSON.stringify(currentContent));

  // Initialize defaults if empty (exactly like adminCMS.init does)
  if (!mutatedContent.faqList || mutatedContent.faqList.length === 0) {
    mutatedContent.faqList = [1, 2, 3, 4].map(n => ({
      q: { ar: 'سؤال ' + n, en: 'Question ' + n },
      a: { ar: 'جواب ' + n, en: 'Answer ' + n }
    }));
  }
  if (!mutatedContent.heroStatsList || mutatedContent.heroStatsList.length === 0) {
    mutatedContent.heroStatsList = ['stat1', 'stat2', 'stat3', 'stat4'].map(k => ({
      key: k, num: '88%', label: { ar: 'إحصائية', en: 'Stat' }
    }));
  }
  if (!mutatedContent.trustList || mutatedContent.trustList.length === 0) {
    mutatedContent.trustList = ['t1', 't2', 't3', 't4'].map(k => ({
      key: k, title: { ar: 'اعتماد', en: 'Trust' }, sub: { ar: 'تفاصيل', en: 'Details' }
    }));
  }
  if (!mutatedContent.pillarsList || mutatedContent.pillarsList.length === 0) {
    mutatedContent.pillarsList = ['p1', 'p2', 'p3'].map(k => ({
      key: k, enabled: true, name: { ar: 'خدمة', en: 'Pillar' }, tag: { ar: 'وسم', en: 'Tag' }, desc: { ar: 'وصف', en: 'Desc' }
    }));
  }
  if (!mutatedContent.techList || mutatedContent.techList.length === 0) {
    mutatedContent.techList = ['c1', 'c2', 'c3', 'c4'].map(k => ({
      key: k, title: { ar: 'معيار', en: 'Tech' }, desc: { ar: 'تفاصيل', en: 'Desc' }
    }));
  }
  if (!mutatedContent.comparisonList || mutatedContent.comparisonList.length === 0) {
    mutatedContent.comparisonList = ['r1', 'r2', 'r3', 'r4'].map(k => ({
      key: k, title: { ar: 'مقارنة', en: 'Comp' }, pro: { ar: 'بروتيرم', en: 'Pro' }, std: { ar: 'تقليدي', en: 'Std' }
    }));
  }
  if (!mutatedContent.stepsList || mutatedContent.stepsList.length === 0) {
    mutatedContent.stepsList = ['s1', 's2', 's3'].map(k => ({
      key: k, num: '01', title: { ar: 'خطوة', en: 'Step' }, desc: { ar: 'وصف', en: 'Desc' }
    }));
  }
  if (!mutatedContent.galleryList || mutatedContent.galleryList.length === 0) {
    mutatedContent.galleryList = ['1', '2', '3', '4'].map(k => ({
      id: 'gallery' + k, category: 'arch', title: { ar: 'مشروع', en: 'Proj' }, desc: { ar: 'وصف', en: 'Desc' }
    }));
  }
  if (!mutatedContent.videoBulletsList || mutatedContent.videoBulletsList.length === 0) {
    mutatedContent.videoBulletsList = ['h1', 'h2', 'h3'].map(k => ({
      key: k, title: { ar: 'فيديو', en: 'Video' }, desc: { ar: 'وصف', en: 'Desc' }
    }));
  }
  if (!mutatedContent.villaFeaturesList || mutatedContent.villaFeaturesList.length === 0) {
    mutatedContent.villaFeaturesList = [1, 2, 3].map(k => ({
      title: { ar: 'ميزة فيلا', en: 'Villa' }, desc: { ar: 'وصف', en: 'Desc' }
    }));
  }
  if (!mutatedContent.enterpriseFeaturesList || mutatedContent.enterpriseFeaturesList.length === 0) {
    mutatedContent.enterpriseFeaturesList = [1, 2, 3].map(k => ({
      title: { ar: 'ميزة شركات', en: 'Enterprise' }, desc: { ar: 'وصف', en: 'Desc' }
    }));
  }

  // Now perform the admin additions!
  mutatedContent.faqList.push({
    q: { ar: 'سؤال تجريبي مضاف جديد من لوحة التحكم؟', en: 'New Dynamic FAQ Added from Admin?' },
    a: { ar: 'إجابة تجريبية تؤكد ظهور السؤال بنجاح على الواجهة.', en: 'Dynamic answer confirming successful reflection.' }
  });

  mutatedContent.heroStatsList.push({
    key: 'stat5',
    num: '99.9%',
    label: { ar: 'إحصائية ديناميكية مضافة', en: 'New Dynamic Stat' }
  });

  mutatedContent.trustList.push({
    key: 't5',
    title: { ar: 'اعتماد تجريبي مضاف', en: 'New Trust Certification' },
    sub: { ar: 'تفاصيل الاعتماد التجريبي', en: 'Certification details' }
  });

  mutatedContent.pillarsList.push({
    key: 'p4',
    enabled: true,
    name: { ar: 'خدمة عزل تجريبية مضافة', en: 'New Dynamic Insulation Pillar' },
    tag: { ar: 'نانو حصري', en: 'Exclusive Nano' },
    desc: { ar: 'وصف الخدمة التجريبية المضافة من لوحة التحكم', en: 'Description of new dynamic pillar' },
    specs: { ar: 'IRR: 95%', en: 'IRR: 95%' },
    cta: { ar: 'طلب الخدمة الآن', en: 'Order Now' }
  });

  mutatedContent.techList.push({
    key: 'c5',
    title: { ar: 'معيار تقني إضافي', en: 'Additional Tech Standard' },
    desc: { ar: 'تفاصيل المعيار التقني الخامس', en: 'Fifth technical standard details' }
  });

  mutatedContent.comparisonList.push({
    key: 'r5',
    title: { ar: 'ميزة مقارنة خامسة', en: 'Fifth Comparison Row' },
    pro: { ar: 'أعلى أداء ممكن', en: 'Maximum Performance' },
    std: { ar: 'ضعيف أو غير متوفر', en: 'Weak or Unavailable' }
  });

  mutatedContent.stepsList.push({
    key: 's4',
    num: '04',
    title: { ar: 'خطوة رحلة عميل رابعة', en: 'Step 4 Customer Journey' },
    desc: { ar: 'متابعة دورية وصيانة مجانية', en: 'Periodic checkup' }
  });

  mutatedContent.galleryList.push({
    id: 'gallery5',
    category: 'arch',
    title: { ar: 'مشروع معرض خامس مضاف', en: 'Fifth Gallery Project' },
    desc: { ar: 'تفاصيل المشروع المضاف ديناميكياً', en: 'Project details' },
    badge: { ar: 'معرض جديد', en: 'New Gallery Item' }
  });

  mutatedContent.videoBulletsList.push({
    key: 'h4',
    title: { ar: 'نقطة فيديو رابعة', en: 'Fourth Video Bullet' },
    desc: { ar: 'تفاصيل النقطة الرابعة', en: 'Bullet 4 details' }
  });

  mutatedContent.villaFeaturesList.push({
    title: { ar: 'ميزة فيلا رابعة', en: 'Villa Feature 4' },
    desc: { ar: 'تفاصيل الميزة الرابعة', en: 'Feature 4 desc' }
  });

  mutatedContent.enterpriseFeaturesList.push({
    title: { ar: 'ميزة شركات رابعة', en: 'Enterprise Feature 4' },
    desc: { ar: 'تفاصيل ميزة الشركات الرابعة', en: 'Enterprise 4 desc' }
  });

  if (!mutatedContent.customButtonsList) mutatedContent.customButtonsList = [];
  mutatedContent.customButtonsList.push({
    key: 'btn_test',
    visible: true,
    title: { ar: 'زر تجريبي مخصص', en: 'Dynamic Custom Button' },
    target: '#contact'
  });

  // 2. Save mutated content to server
  const saveRes = await new Promise((resolve, reject) => {
    const postData = JSON.stringify(mutatedContent);
    const req = http.request('http://localhost:8080/api/content', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });

  console.log("CMS Content Saved successfully:", saveRes.success);

  // 3. Verify that index.html Alpine.js dynamic getters return the exact new items
  // We can launch Edge headless using CDP or fetch / and evaluate
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const { spawn } = require('child_process');
  const port = 9225;
  const edgeProc = spawn(edgePath, [
    '--headless',
    '--disable-gpu',
    `--remote-debugging-port=${port}`,
    'http://localhost:8080/'
  ]);

  await new Promise(r => setTimeout(r, 2000));

  let results = {};
  try {
    const tabs = await new Promise((resolve, reject) => {
      http.get(`http://localhost:${port}/json`, res => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => resolve(JSON.parse(data)));
      }).on('error', reject);
    });

    const targetTab = tabs.find(t => t.url.includes('localhost:8080'));
    if (!targetTab) throw new Error("Could not find localhost:8080 tab");

    const ws = new WebSocket(targetTab.webSocketDebuggerUrl);

    let id = 1;
    const pending = new Map();
    function sendCmd(method, params = {}) {
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

    // Wait for Alpine and cmsLoaded to finish fetching
    let cmsLoaded = false;
    for (let i = 0; i < 40; i++) {
      const chk = await sendCmd('Runtime.evaluate', { 
        expression: 'typeof window.Alpine !== "undefined" && !!window.Alpine.$data(document.querySelector("[x-data]"))?.cmsLoaded' 
      });
      if (chk && chk.result && chk.result.value === true) {
        cmsLoaded = true;
        break;
      }
      await new Promise(r => setTimeout(r, 250));
    }
    console.log("CMS Content fully loaded on page:", cmsLoaded);

    const evalRes = await sendCmd('Runtime.evaluate', {
      expression: `(() => {
        const root = document.querySelector('[x-data]') || document.body;
        const app = window.Alpine ? window.Alpine.$data(root) : null;
        if (!app) return { error: 'App not initialized' };
        return {
          faqs: app.getFaqList().length,
          stats: app.getHeroStatsList().length,
          trust: app.getTrustList().length,
          pillars: app.getPillarsList().length,
          tech: app.getTechList().length,
          comparison: app.getComparisonList().length,
          steps: app.getStepsList().length,
          gallery: app.getGalleryList().length,
          videoBullets: app.getVideoBulletsList().length,
          villaFeatures: app.getVillaFeaturesList().length,
          enterpriseFeatures: app.getEnterpriseFeaturesList().length,
          customButtons: (app.cms.customButtonsList || []).length,
          lastFaqQuestion: app.getFaqList().length ? app.getFaqList().slice(-1)[0]?.q?.ar : null,
          lastPillarName: app.getPillarsList().length ? app.getPillarsList().slice(-1)[0]?.name?.ar : null,
          lastStatNum: app.getHeroStatsList().length ? app.getHeroStatsList().slice(-1)[0]?.num : null,
          lastCustomButtonTitle: (app.cms.customButtonsList || []).length ? (app.cms.customButtonsList.slice(-1)[0]?.title?.ar || app.cms.customButtonsList.slice(-1)[0]?.title) : null
        };
      })()`,
      returnByValue: true
    });

    console.log("Raw evalRes:", JSON.stringify(evalRes, null, 2));
    results = evalRes && evalRes.value ? evalRes.value : (evalRes && evalRes.result && evalRes.result.value ? evalRes.result.value : {});
    console.log("Live Evaluated Alpine State from Landing Page DOM:", JSON.stringify(results, null, 2));

    ws.close();
  } catch (err) {
    console.error("CDP Evaluation error:", err);
  } finally {
    edgeProc.kill();
  }

  // 4. Assertions
  const checks = [
    { name: 'FAQ dynamically received added 5th question', pass: results.lastFaqQuestion === 'سؤال تجريبي مضاف جديد من لوحة التحكم؟' },
    { name: 'Pillars dynamically received added 4th pillar', pass: results.lastPillarName === 'خدمة عزل تجريبية مضافة' },
    { name: 'Hero stats dynamically received added 5th stat', pass: results.lastStatNum === '99.9%' },
    { name: 'Custom CTA Button dynamically received added button', pass: results.lastCustomButtonTitle === 'زر تجريبي مخصص' },
    { name: 'Trust items count reflected', pass: results.trust === 5 },
    { name: 'Tech standards count reflected', pass: results.tech === 5 },
    { name: 'Comparison rows count reflected', pass: results.comparison === 5 },
    { name: 'Customer journey steps count reflected', pass: results.steps === 4 },
    { name: 'Gallery items count reflected', pass: results.gallery === 5 },
    { name: 'Video bullets count reflected', pass: results.videoBullets === 4 },
    { name: 'Villa features count reflected', pass: results.villaFeatures === 4 },
    { name: 'Enterprise features count reflected', pass: results.enterpriseFeatures === 4 },
  ];

  console.log("\n--- DYNAMIC REFLECTION VERIFICATION RESULTS ---");
  let allPassed = true;
  for (const c of checks) {
    if (c.pass) {
      console.log(`✅ [PASS] ${c.name}`);
    } else {
      console.log(`❌ [FAIL] ${c.name}`);
      allPassed = false;
    }
  }

  // 5. Clean up - reset back to factory defaults
  console.log("\nResetting to factory defaults...");
  await new Promise((resolve, reject) => {
    const req = http.request('http://localhost:8080/api/reset', { method: 'POST' }, (res) => {
      res.on('data', () => {});
      res.on('end', resolve);
    });
    req.on('error', reject);
    req.end();
  });
  console.log("Factory defaults restored.");

  if (allPassed) {
    console.log("\n🎉 ALL DYNAMIC CMS ADDITIONS ARE 100% REFLECTED ON THE LIVE LANDING PAGE!");
    process.exit(0);
  } else {
    console.error("\n❌ SOME DYNAMIC CMS CHECKS FAILED.");
    process.exit(1);
  }
}

testDynamicReflection().catch(e => {
  console.error("Fatal test error:", e);
  process.exit(1);
});
