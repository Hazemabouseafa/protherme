const fs = require('fs');
const http = require('http');
const vm = require('vm');

console.log('====================================================');
console.log('🔍 PROTHERME ADMIN DASHBOARD DEEP DIAGNOSTIC AUDIT');
console.log('====================================================\n');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ [PASS] ${message}`);
    passCount++;
  } else {
    console.error(`❌ [FAIL] ${message}`);
    failCount++;
  }
}

async function request(options, postData = null) {
  const payload = postData ? (typeof postData === 'string' ? postData : JSON.stringify(postData)) : null;
  if (!options.headers) options.headers = {};
  if (payload) {
    options.headers['Content-Length'] = Buffer.byteLength(payload);
  }
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch(e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function runAudit() {
  const adminHtml = fs.readFileSync('admin.html', 'utf8');

  // --- 1. HTML Syntax & DOM Structure ---
  console.log('--- 1. Testing Admin HTML & DOM Integrity ---');
  
  // Tag balance
  const divOpen = (adminHtml.match(/<div(\s|>)/gi) || []).length;
  const divClose = (adminHtml.match(/<\/div>/gi) || []).length;
  assert(divOpen === divClose, `HTML div tags are balanced (Open: ${divOpen}, Close: ${divClose})`);

  const formOpen = (adminHtml.match(/<form(\s|>)/gi) || []).length;
  const formClose = (adminHtml.match(/<\/form>/gi) || []).length;
  assert(formOpen === formClose, `HTML form tags are balanced (Open: ${formOpen}, Close: ${formClose})`);

  const templateOpen = (adminHtml.match(/<template(\s|>)/gi) || []).length;
  const templateClose = (adminHtml.match(/<\/template>/gi) || []).length;
  assert(templateOpen === templateClose, `HTML template tags are balanced (Open: ${templateOpen}, Close: ${templateClose})`);

  // Verify all declared sidebar tabs exist in <main>
  const sidebarTabsMatches = adminHtml.match(/@click="activeTab\s*=\s*'([a-zA-Z0-9_]+)'/g) || [];
  const tabIds = [...new Set(sidebarTabsMatches.map(m => m.match(/'([a-zA-Z0-9_]+)'/)[1]))];
  console.log(`Found ${tabIds.length} unique tabs in navigation:`, tabIds.join(', '));

  tabIds.forEach(tabId => {
    const hasPanel = adminHtml.includes(`activeTab === '${tabId}'`);
    assert(hasPanel, `Tab '${tabId}' has corresponding panel with activeTab === '${tabId}'`);
  });

  // Verify Depth 2 constraint for all panels inside <main>
  const mainIdx = adminHtml.indexOf('<main');
  const mainEndIdx = adminHtml.indexOf('</main>');
  const mainContent = adminHtml.substring(mainIdx, mainEndIdx);
  
  tabIds.forEach(tabId => {
    const panelDef = `x-show="activeTab === '${tabId}'"`;
    assert(mainContent.includes(panelDef), `Panel for tab '${tabId}' is directly located inside <main>`);
  });

  // --- 2. Testing Alpine Script Functions via JS VM ---
  console.log('\n--- 2. Testing adminCMS() Methods & State in Sandbox ---');
  
  // Extract script
  const scriptStart = adminHtml.indexOf('function adminCMS()');
  const scriptEnd = adminHtml.lastIndexOf('</script>');
  const scriptCode = adminHtml.substring(scriptStart, scriptEnd);

  // Setup fake window / browser environment
  const mockStorage = {};
  const sandbox = {
    sessionStorage: {
      getItem: (k) => mockStorage[k] || null,
      setItem: (k, v) => { mockStorage[k] = v; },
      removeItem: (k) => { delete mockStorage[k]; }
    },
    localStorage: {
      getItem: (k) => mockStorage[k] || null,
      setItem: (k, v) => { mockStorage[k] = v; },
      removeItem: (k) => { delete mockStorage[k]; }
    },
    setInterval: () => {},
    setTimeout: (fn) => fn(),
    confirm: () => true,
    alert: () => {},
    fetch: async () => ({ ok: true, json: async () => ({}) }),
    console: console,
    Date: Date,
    Array: Array,
    Object: Object,
    JSON: JSON
  };
  vm.createContext(sandbox);
  vm.runInContext(scriptCode, sandbox);

  const cmsInstance = sandbox.adminCMS();
  assert(typeof cmsInstance.init === 'function', 'adminCMS() defines init() method');
  assert(typeof cmsInstance.verifyPin === 'function', 'adminCMS() defines verifyPin()');
  assert(typeof cmsInstance.saveContent === 'function', 'adminCMS() defines saveContent()');
  assert(typeof cmsInstance.resetToDefaults === 'function', 'adminCMS() defines resetToDefaults()');

  // Test Authentication
  assert(cmsInstance.authenticated === false, 'Initially unauthenticated');
  cmsInstance.pinInput = 'wrong';
  cmsInstance.verifyPin();
  assert(cmsInstance.authenticated === false, 'Rejects incorrect PIN');
  cmsInstance.pinInput = 'admin2026';
  cmsInstance.verifyPin();
  assert(cmsInstance.authenticated === true, 'Accepts default PIN admin2026');
  cmsInstance.logout();
  assert(cmsInstance.authenticated === false, 'Logout resets authentication');
  cmsInstance.pinInput = '1234';
  cmsInstance.verifyPin();
  assert(cmsInstance.authenticated === true, 'Accepts quick PIN 1234');

  // Test Dynamic List Operations
  console.log('\n--- 3. Testing Add & Delete Handlers Across All Sections ---');
  cmsInstance.ensureDynamicLists();

  // Hero Stats
  const initialHeroStatsCount = (cmsInstance.cms.heroStatsList || []).length;
  cmsInstance.addHeroStat();
  assert(cmsInstance.cms.heroStatsList.length === initialHeroStatsCount + 1, 'addHeroStat() increments heroStatsList');
  cmsInstance.deleteHeroStat(cmsInstance.cms.heroStatsList.length - 1);
  assert(cmsInstance.cms.heroStatsList.length === initialHeroStatsCount, 'deleteHeroStat() decrements heroStatsList');

  // Trust Bar
  const initialTrustCount = (cmsInstance.cms.trustList || []).length;
  cmsInstance.addTrustItem();
  assert(cmsInstance.cms.trustList.length === initialTrustCount + 1, 'addTrustItem() increments trustList');
  cmsInstance.deleteTrustItem(cmsInstance.cms.trustList.length - 1);
  assert(cmsInstance.cms.trustList.length === initialTrustCount, 'deleteTrustItem() decrements trustList');

  // Pillars
  const initialPillarsCount = (cmsInstance.cms.pillarsList || []).length;
  cmsInstance.addPillar();
  assert(cmsInstance.cms.pillarsList.length === initialPillarsCount + 1, 'addPillar() increments pillarsList');
  cmsInstance.deletePillar(cmsInstance.cms.pillarsList.length - 1);
  assert(cmsInstance.cms.pillarsList.length === initialPillarsCount, 'deletePillar() decrements pillarsList');

  // Tech Standards
  const initialTechCount = (cmsInstance.cms.techList || []).length;
  cmsInstance.addTechStandard();
  assert(cmsInstance.cms.techList.length === initialTechCount + 1, 'addTechStandard() increments techList');
  cmsInstance.deleteTechStandard(cmsInstance.cms.techList.length - 1);
  assert(cmsInstance.cms.techList.length === initialTechCount, 'deleteTechStandard() decrements techList');

  // Comparison
  const initialCompCount = (cmsInstance.cms.comparisonList || []).length;
  cmsInstance.addComparisonRow();
  assert(cmsInstance.cms.comparisonList.length === initialCompCount + 1, 'addComparisonRow() increments comparisonList');
  cmsInstance.deleteComparisonRow(cmsInstance.cms.comparisonList.length - 1);
  assert(cmsInstance.cms.comparisonList.length === initialCompCount, 'deleteComparisonRow() decrements comparisonList');

  // Gallery
  const initialGalCount = (cmsInstance.cms.galleryList || []).length;
  cmsInstance.addGalleryItem();
  assert(cmsInstance.cms.galleryList.length === initialGalCount + 1, 'addGalleryItem() increments galleryList');
  cmsInstance.deleteGalleryItem(cmsInstance.cms.galleryList.length - 1);
  assert(cmsInstance.cms.galleryList.length === initialGalCount, 'deleteGalleryItem() decrements galleryList');

  // Video Bullets
  const initialVideoCount = (cmsInstance.cms.videoBulletsList || []).length;
  cmsInstance.addVideoBullet();
  assert(cmsInstance.cms.videoBulletsList.length === initialVideoCount + 1, 'addVideoBullet() increments videoBulletsList');
  cmsInstance.deleteVideoBullet(cmsInstance.cms.videoBulletsList.length - 1);
  assert(cmsInstance.cms.videoBulletsList.length === initialVideoCount, 'deleteVideoBullet() decrements videoBulletsList');

  // Steps
  const initialStepsCount = (cmsInstance.cms.stepsList || []).length;
  cmsInstance.addStep();
  assert(cmsInstance.cms.stepsList.length === initialStepsCount + 1, 'addStep() increments stepsList');
  cmsInstance.deleteStep(cmsInstance.cms.stepsList.length - 1);
  assert(cmsInstance.cms.stepsList.length === initialStepsCount, 'deleteStep() decrements stepsList');

  // Villa Features
  const initialVillaCount = (cmsInstance.cms.villaFeaturesList || []).length;
  cmsInstance.addVillaFeature();
  assert(cmsInstance.cms.villaFeaturesList.length === initialVillaCount + 1, 'addVillaFeature() increments villaFeaturesList');
  cmsInstance.deleteVillaFeature(cmsInstance.cms.villaFeaturesList.length - 1);
  assert(cmsInstance.cms.villaFeaturesList.length === initialVillaCount, 'deleteVillaFeature() decrements villaFeaturesList');

  // Enterprise Features
  const initialEntCount = (cmsInstance.cms.enterpriseFeaturesList || []).length;
  cmsInstance.addEnterpriseFeature();
  assert(cmsInstance.cms.enterpriseFeaturesList.length === initialEntCount + 1, 'addEnterpriseFeature() increments enterpriseFeaturesList');
  cmsInstance.deleteEnterpriseFeature(cmsInstance.cms.enterpriseFeaturesList.length - 1);
  assert(cmsInstance.cms.enterpriseFeaturesList.length === initialEntCount, 'deleteEnterpriseFeature() decrements enterpriseFeaturesList');

  // Custom Buttons
  const initialBtnCount = (cmsInstance.cms.customButtonsList || []).length;
  cmsInstance.addButton();
  assert(cmsInstance.cms.customButtonsList.length === initialBtnCount + 1, 'addButton() increments customButtonsList');
  cmsInstance.deleteButton(cmsInstance.cms.customButtonsList.length - 1);
  assert(cmsInstance.cms.customButtonsList.length === initialBtnCount, 'deleteButton() decrements customButtonsList');

  // FAQ
  const initialFaqCount = (cmsInstance.cms.faqList || []).length;
  cmsInstance.addFaq();
  assert(cmsInstance.cms.faqList.length === initialFaqCount + 1, 'addFaq() increments faqList');
  cmsInstance.deleteFaq(cmsInstance.cms.faqList.length - 1);
  assert(cmsInstance.cms.faqList.length === initialFaqCount, 'deleteFaq() decrements faqList');

  // Sequencer & Custom Blocks
  console.log('\n--- 4. Testing Sequencer & Custom Block Builder ---');
  cmsInstance.ensureSectionOrder();
  const orderedList = cmsInstance.getOrderedPostHeroList();
  assert(Array.isArray(orderedList) && orderedList.length >= 10, `getOrderedPostHeroList() returns all sections (${orderedList.length} items)`);
  
  const originalFirst = cmsInstance.cms.sectionOrder[0].id;
  const originalSecond = cmsInstance.cms.sectionOrder[1].id;
  cmsInstance.movePostHeroItemDown(0);
  assert(cmsInstance.cms.sectionOrder[0].id === originalSecond, 'movePostHeroItemDown(0) reorders elements');
  cmsInstance.movePostHeroItemUp(1);
  assert(cmsInstance.cms.sectionOrder[0].id === originalFirst, 'movePostHeroItemUp(1) restores original order');

  // Create custom block
  cmsInstance.newBlockForm.title.ar = 'بلوك اختبار تدقيقي';
  cmsInstance.newBlockForm.title.en = 'Test Audit Block';
  cmsInstance.createCompleteBlock();
  const foundBlock = (cmsInstance.cms.blocks || []).find(b => b.title.ar === 'بلوك اختبار تدقيقي');
  assert(Boolean(foundBlock), 'createCompleteBlock() adds new block with bilingual fields');
  assert(cmsInstance.cms.sectionOrder.some(s => s.id === foundBlock.id), 'createCompleteBlock() inserts block entry into sectionOrder');

  // Remove custom block
  const blockIdx = cmsInstance.cms.blocks.indexOf(foundBlock);
  cmsInstance.removeBlock(blockIdx);
  assert(!cmsInstance.cms.blocks.some(b => b.title.ar === 'بلوك اختبار تدقيقي'), 'removeBlock() cleanly deletes the block');
  assert(!cmsInstance.cms.sectionOrder.some(s => s.id === foundBlock.id), 'removeBlock() removes block from sectionOrder');

  // Sync legacy keys
  cmsInstance.syncLegacyKeys();
  assert(typeof cmsInstance.cms.texts.ar.hero === 'object', 'syncLegacyKeys() preserves and serializes text dictionaries');

  // --- 5. Testing Inboxes (Leads & Careers) Filters ---
  console.log('\n--- 5. Testing Leads & Careers Filtering & Search ---');
  cmsInstance.leads = [
    { id: 1, name: 'أحمد علي', phone: '01012345678', service: 'عزل زجاج', status: 'new' },
    { id: 2, name: 'سارة محمد', phone: '01087654321', service: 'حماية رخام', status: 'contacted' },
    { id: 3, name: 'خالد عمر', phone: '01099999999', service: 'أفلام سيارات', status: 'archived' }
  ];
  
  cmsInstance.leadFilter = 'all';
  assert(cmsInstance.getFilteredLeads().length === 3, 'Leads filter "all" returns 3 items');
  cmsInstance.leadFilter = 'new';
  assert(cmsInstance.getFilteredLeads().length === 1, 'Leads filter "new" returns 1 item');
  cmsInstance.leadFilter = 'contacted';
  assert(cmsInstance.getFilteredLeads().length === 1, 'Leads filter "contacted" returns 1 item');
  cmsInstance.leadFilter = 'all';
  cmsInstance.leadSearch = 'سارة';
  assert(cmsInstance.getFilteredLeads().length === 1, 'Leads search "سارة" returns 1 item');
  cmsInstance.leadSearch = '';

  cmsInstance.careers = [
    { id: 10, name: 'م. أحمد', role: 'مهندس مبيعات', phone: '01011111111', status: 'new' },
    { id: 20, name: 'د. ياسمين', role: 'فني تركيبات', phone: '01022222222', status: 'reviewed' },
    { id: 30, name: 'أ. محمود', role: 'مطور واجهات', phone: '01033333333', status: 'interviewed' }
  ];
  cmsInstance.careerFilter = 'all';
  assert(cmsInstance.getFilteredCareers().length === 3, 'Careers filter "all" returns 3 items');
  cmsInstance.careerFilter = 'reviewed';
  assert(cmsInstance.getFilteredCareers().length === 1, 'Careers filter "reviewed" returns 1 item');
  cmsInstance.careerFilter = 'interviewed';
  assert(cmsInstance.getFilteredCareers().length === 1, 'Careers filter "interviewed" returns 1 item');
  cmsInstance.careerFilter = 'all';
  cmsInstance.careerSearch = 'مبيعات';
  assert(cmsInstance.getFilteredCareers().length === 1, 'Careers search "مبيعات" returns 1 item');
  cmsInstance.careerSearch = '';

  // --- 6. Live API Roundtrip Testing for Leads, Careers, Content, Reset ---
  console.log('\n--- 6. Testing Live Endpoints Against Server ---');
  
  // Leads PATCH
  const createLeadRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/leads',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { name: 'Audit Test Client', phone: '01000000000', service: 'فحص تجريبي', message: 'تجربة' });
  assert(createLeadRes.status === 200 && createLeadRes.data.success, 'Live POST /api/leads creates lead');

  console.log('createLeadRes data:', JSON.stringify(createLeadRes.data));
  const leadId = (createLeadRes.data.lead && createLeadRes.data.lead.id) || createLeadRes.data.id;
  const patchLeadRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/leads',
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' }
  }, { id: leadId, status: 'contacted' });
  assert(patchLeadRes.status === 200 && patchLeadRes.data.success, 'Live PATCH /api/leads updates lead status to contacted');

  const deleteLeadRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/leads',
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' }
  }, { id: leadId });
  console.log('deleteLeadRes:', deleteLeadRes);
  assert(deleteLeadRes.status === 200 && deleteLeadRes.data.success, 'Live DELETE /api/leads removes lead');

  // Careers PATCH & DELETE
  const createCareerRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/careers',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { name: 'Audit Candidate', phone: '01000000001', role: 'مهندس فحص', experience: '5 سنوات', notes: 'اختبار' });
  assert(createCareerRes.status === 200 && createCareerRes.data.success, 'Live POST /api/careers creates applicant');

  const careerId = (createCareerRes.data.career && createCareerRes.data.career.id) || createCareerRes.data.id;
  const patchCareerRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/careers',
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' }
  }, { id: careerId, status: 'interviewed' });
  assert(patchCareerRes.status === 200 && patchCareerRes.data.success, 'Live PATCH /api/careers updates applicant status');

  const deleteCareerRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/careers',
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' }
  }, { id: careerId });
  assert(deleteCareerRes.status === 200 && deleteCareerRes.data.success, 'Live DELETE /api/careers removes applicant');

  // Reset to default
  const resetRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/reset',
    method: 'POST'
  });
  assert(resetRes.status === 200 && resetRes.data.success, 'Live POST /api/reset resets data to factory defaults');

  console.log('\n====================================================');
  console.log(`🏁 AUDIT COMPLETED: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('====================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

runAudit().catch(err => {
  console.error('Audit encountered unexpected error:', err);
  process.exit(1);
});
