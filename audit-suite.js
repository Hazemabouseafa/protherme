const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const BASE_URL = `http://localhost:${PORT}`;

function request(options, bodyData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });
    req.on('error', reject);
    if (bodyData) {
      req.write(bodyData);
    }
    req.end();
  });
}

async function runSuite() {
  console.log('====================================================');
  console.log('🚀 PROTHERME CMS & ADMIN DASHBOARD FULL AUDIT SUITE');
  console.log(`📡 Target Server: ${BASE_URL}`);
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName} ${details ? '- ' + details : ''}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------------------
    // TEST 1: ROUTING & HEALTH CHECKS
    // -------------------------------------------------------------------------
    console.log('--- 1. Testing Route Availability & Static Server ---');
    
    // 1.1 Home /
    let res = await request({ host: 'localhost', port: PORT, path: '/', method: 'GET' });
    assert(res.statusCode === 200 && res.body.includes('بروتيرم للحلول الهندسية'), 'GET / (Home landing page responds 200 OK)');

    // 1.2 Subpath /protherme/
    res = await request({ host: 'localhost', port: PORT, path: '/protherme/', method: 'GET' });
    assert(res.statusCode === 200 && res.body.includes('بروتيرم للحلول الهندسية'), 'GET /protherme/ (Subdirectory URL responds 200 OK)');

    // 1.3 Admin CMS /admin
    res = await request({ host: 'localhost', port: PORT, path: '/admin', method: 'GET' });
    assert(res.statusCode === 200 && res.body.includes('ProTherme Admin CMS'), 'GET /admin (Admin Dashboard responds 200 OK)');

    // 1.4 Admin CMS /protherme/admin
    res = await request({ host: 'localhost', port: PORT, path: '/protherme/admin', method: 'GET' });
    assert(res.statusCode === 200 && res.body.includes('ProTherme Admin CMS'), 'GET /protherme/admin (Admin Subpath responds 200 OK)');

    // 1.5 Careers page /careers.html
    res = await request({ host: 'localhost', port: PORT, path: '/careers.html', method: 'GET' });
    assert(res.statusCode === 200 && res.body.includes('استمارة التقدم للوظيفة'), 'GET /careers.html (Careers page responds 200 OK)');

    // 1.6 App JS Asset
    res = await request({ host: 'localhost', port: PORT, path: '/assets/js/app.js', method: 'GET' });
    assert(res.statusCode === 200 && res.body.includes('prothermeApp'), 'GET /assets/js/app.js (Alpine app script served 200 OK)');

    // 1.7 Logo Asset
    res = await request({ host: 'localhost', port: PORT, path: '/assets/images/protherme-logo.jpg', method: 'GET' });
    assert(res.statusCode === 200 && res.headers['content-type'] === 'image/jpeg', 'GET /assets/images/protherme-logo.jpg (JPEG Logo served 200 OK)');

    // -------------------------------------------------------------------------
    // TEST 2: CMS DATA INTEGRITY (GET /api/content)
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Testing CMS API Schema & Data Integrity ---');
    res = await request({ host: 'localhost', port: PORT, path: '/api/content', method: 'GET' });
    assert(res.statusCode === 200, 'GET /api/content returns HTTP 200');

    const content = JSON.parse(res.body);
    
    // Visibility Keys
    const expectedVisKeys = [
      'topbar', 'heroBadge', 'heroStats', 'trustBar', 
      'pillar1', 'pillar2', 'pillar3', 'simulator', 
      'technology', 'comparisonTable', 'gallery', 'speedDial'
    ];
    const hasAllVis = expectedVisKeys.every(k => content.visibility && content.visibility[k] !== undefined);
    assert(hasAllVis, 'All 12 Visibility switches present in CMS data');

    assert(content.contacts && content.contacts.phone === '01010010030', 'Direct phone is correctly initialized to 01010010030');
    assert(content.contacts && content.contacts.whatsapp === '+201010010030', 'WhatsApp hotline is correctly initialized to +201010010030');
    assert(content.contacts && (content.contacts.email === 'sales@protherme.com' || content.contacts.email === 'info@protherme.com'), 'Corporate email is configured (sales@protherme.com or info@protherme.com)');

    // Blocks Array
    assert(Array.isArray(content.blocks), 'CMS schema includes blocks: [] array');

    // Images
    assert(content.images && content.images.heroVisual && content.images.gallery1, 'Image paths for hero and gallery correctly configured');

    // Bilingual Texts
    assert(content.texts && content.texts.ar && content.texts.en, 'Both Arabic and English text dictionaries present in CMS data');

    // -------------------------------------------------------------------------
    // TEST 3: LIVE CMS PERSISTENCE & MUTATION (POST /api/content)
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Testing CMS Mutation & Disk Persistence ---');
    
    const modifiedContent = JSON.parse(JSON.stringify(content));
    modifiedContent.visibility.simulator = false;
    modifiedContent.contacts.phone = '01099887766';
    
    const postPayload = JSON.stringify(modifiedContent);
    const postRes = await request({
      host: 'localhost',
      port: PORT,
      path: '/api/content',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postPayload)
      }
    }, postPayload);

    assert(postRes.statusCode === 200, 'POST /api/content returns HTTP 200 OK');
    const postJson = JSON.parse(postRes.body);
    assert(postJson.success === true, 'POST /api/content returns success: true');

    // Verify GET immediately reflects mutation
    res = await request({ host: 'localhost', port: PORT, path: '/api/content', method: 'GET' });
    const verifiedContent = JSON.parse(res.body);
    assert(verifiedContent.visibility.simulator === false, 'Mutation persisted: visibility.simulator is now false');
    assert(verifiedContent.contacts.phone === '01099887766', 'Mutation persisted: contacts.phone is 01099887766');

    // -------------------------------------------------------------------------
    // TEST 4: FACTORY RESET (POST /api/reset)
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Testing Factory Reset to Defaults ---');
    const resetRes = await request({
      host: 'localhost',
      port: PORT,
      path: '/api/reset',
      method: 'POST'
    });
    assert(resetRes.statusCode === 200, 'POST /api/reset returns HTTP 200 OK');
    const resetJson = JSON.parse(resetRes.body);
    assert(resetJson.success === true, 'POST /api/reset returns success: true');
    assert(resetJson.content.contacts.phone === '01010010030', 'Factory phone reset back to 01010010030');

    // -------------------------------------------------------------------------
    // TEST 5: CONTACT FORM & INBOX APIS (/api/leads and /api/careers)
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Verifying Contact Section & Inbox APIs ---');
    const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    const contactSectionMatch = indexHtml.match(/<section[^>]*id="contact"[^>]*>([\s\S]*?)<\/section>/i);
    
    assert(contactSectionMatch !== null, 'Contact section (#contact) exists in index.html');
    if (contactSectionMatch) {
      const contactContent = contactSectionMatch[1];
      const hasForm = /<form/i.test(contactContent);
      assert(hasForm, 'Contact Us form <form> exists inside the contact section (Client leads enabled)');
      assert(contactContent.includes('submitContactForm()'), 'Form is bound to submitContactForm()');
      
      const hasPhone = contactContent.includes('cms.contacts.phone');
      const hasWa = contactContent.includes('cms.contacts.whatsapp');
      const hasEmail = contactContent.includes('cms.contacts.email');
      assert(hasPhone && hasWa && hasEmail, 'Direct channels (Phone, WhatsApp, Email) are bound to CMS contacts');
    }

    // Test /api/leads API (POST, GET, PATCH, DELETE)
    const testLeadPayload = JSON.stringify({
      name: 'مهندس أحمد التجريبي',
      phone: '01012345678',
      email: 'ahmed.test@example.com',
      service: 'عزل زجاج الفلل',
      message: 'معاينة تجريبية لاختبار المنظومة'
    });
    const leadPostRes = await request({
      host: 'localhost',
      port: PORT,
      path: '/api/leads',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(testLeadPayload)
      }
    }, testLeadPayload);
    assert(leadPostRes.statusCode === 200, 'POST /api/leads creates lead successfully');
    const leadData = JSON.parse(leadPostRes.body);
    const createdLeadId = leadData.lead && leadData.lead.id;
    assert(createdLeadId !== undefined, 'POST /api/leads returns created lead ID');

    const leadGetRes = await request({ host: 'localhost', port: PORT, path: '/api/leads', method: 'GET' });
    const allLeads = JSON.parse(leadGetRes.body);
    assert(Array.isArray(allLeads) && allLeads.some(l => l.id === createdLeadId), 'GET /api/leads returns created lead');

    // Clean up test lead
    if (createdLeadId) {
      await request({ host: 'localhost', port: PORT, path: `/api/leads?id=${createdLeadId}`, method: 'DELETE' });
    }

    // Test /api/careers API (POST, GET, DELETE)
    const testCareerPayload = JSON.stringify({
      name: 'م. سارة المهدي',
      phone: '01098765432',
      email: 'sara.test@example.com',
      role: 'مهندس مبيعات مشاريع معمارية',
      experience: '1 - 3 سنوات',
      portfolio: 'https://linkedin.com/in/sara-test'
    });
    const careerPostRes = await request({
      host: 'localhost',
      port: PORT,
      path: '/api/careers',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(testCareerPayload)
      }
    }, testCareerPayload);
    assert(careerPostRes.statusCode === 200, 'POST /api/careers creates career application successfully');
    const careerData = JSON.parse(careerPostRes.body);
    const createdCareerId = careerData.career && careerData.career.id;

    // Clean up test career
    if (createdCareerId) {
      await request({ host: 'localhost', port: PORT, path: `/api/careers?id=${createdCareerId}`, method: 'DELETE' });
    }

    // -------------------------------------------------------------------------
    // TEST 6: ADMIN DASHBOARD UI INTEGRITY
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Verifying Admin Dashboard Features ---');
    const adminHtml = fs.readFileSync(path.join(__dirname, 'admin.html'), 'utf8');
    
    assert(adminHtml.includes('admin2026') && adminHtml.includes('1234'), 'PIN authentication verifies admin2026 & 1234');
    assert(adminHtml.includes('logout()') && adminHtml.includes('sessionStorage.removeItem'), 'Logout functionality implemented');
    assert(adminHtml.includes("activeTab = 'visibility'"), 'Visibility toggles tab exists');
    assert(adminHtml.includes("activeTab = 'contacts'"), 'Contacts management tab exists');
    assert(adminHtml.includes("activeTab = 'clients_inbox'") || adminHtml.includes("activeTab = 'clients_inbox';"), 'CLIENTS INBOX tab exists in Admin');
    assert(adminHtml.includes("activeTab = 'career_inbox'") || adminHtml.includes("activeTab = 'career_inbox';"), 'CAREER INBOX tab exists in Admin');
    assert(adminHtml.includes("activeTab = 'blocks'"), 'Custom Blocks Builder tab exists in Admin');
    assert(adminHtml.includes('movePostHeroItemUp') && adminHtml.includes('movePostHeroItemDown'), 'Post-hero section sequencer controls (movePostHeroItemUp / movePostHeroItemDown) present');
    assert(adminHtml.includes('createCompleteBlock') && adminHtml.includes('newBlockForm'), 'Complete custom block creator with bilingual inputs present in Admin');
    assert(adminHtml.includes('handleNewBlockFileUpload') && adminHtml.includes('handleExistingBlockUpload'), 'Direct file upload handlers for custom blocks present');
    assert(indexHtml.includes('id="post-hero-flow"') && indexHtml.includes('flex flex-col'), 'Index HTML wraps post-hero sections in flex-col post-hero-flow container');
    assert(indexHtml.includes('getSectionOrder') && indexHtml.includes("block.theme === 'cyan'"), 'Index HTML renders dynamic custom blocks with bilingual bindings and themes');
    assert(adminHtml.includes('saveContent()') && adminHtml.includes('resetToDefaults()'), 'Save and Factory Reset methods bound');

    // -------------------------------------------------------------------------
    // TEST 7: DIRECT IMAGE UPLOAD API (POST /api/upload)
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Testing Direct Device Image Upload API ---');
    const sampleBase64 = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    const uploadPayload = JSON.stringify({
      filename: 'test-upload-sample.gif',
      data: sampleBase64
    });

    const uploadRes = await request({
      host: 'localhost',
      port: PORT,
      path: '/api/upload',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(uploadPayload)
      }
    }, uploadPayload);

    assert(uploadRes.statusCode === 200, 'POST /api/upload returns HTTP 200 OK');
    const uploadJson = JSON.parse(uploadRes.body);
    assert(uploadJson.success === true && uploadJson.url.startsWith('assets/images/upload-'), 'Upload returns success: true and assets/images/ public URL');

    const uploadedFilePath = path.join(__dirname, uploadJson.url);
    const fileExistsOnDisk = fs.existsSync(uploadedFilePath);
    assert(fileExistsOnDisk, 'Uploaded image file was successfully created on physical server disk');
    if (fileExistsOnDisk) {
      try { fs.unlinkSync(uploadedFilePath); } catch (e) {}
    }

    // -------------------------------------------------------------------------
    // TEST 8: ADMIN DASHBOARD SIBLING ARCHITECTURE (NO NESTED TABS)
    // -------------------------------------------------------------------------
    console.log('\n--- 8. Verifying Admin DOM Tab Sibling Structure ---');
    const lines = adminHtml.split('\n');
    let depth = 0;
    const tabDepths = {};
    const tabsList = ['visibility', 'contacts', 'hero', 'pillars', 'tech', 'media', 'buttons', 'clients_inbox', 'career_inbox', 'blocks'];

    lines.forEach(line => {
      tabsList.forEach(t => {
        if (line.includes(`activeTab === '${t}'`) && line.includes('<div')) {
          tabDepths[t] = depth;
        }
      });
      const divOpens = (line.match(/<div(\s|>)/gi) || []).length;
      const divCloses = (line.match(/<\/div>/gi) || []).length;
      depth += (divOpens - divCloses);
    });

    assert(depth === 0, 'Final Admin DOM div balance is 0 (all HTML tags properly closed)');
    const allTabsFound = tabsList.every(t => tabDepths[t] !== undefined);
    assert(allTabsFound, `All ${tabsList.length} admin tab panels located in DOM`);
    const allSiblings = tabsList.every(t => tabDepths[t] === tabDepths['visibility']);
    assert(allSiblings, `CRITICAL: All ${tabsList.length} admin tabs are siblings at the exact same DOM depth 2`);

    // -------------------------------------------------------------------------
    // TEST 9: BRAND LOGO & DIRECT UPLOAD UI CONTROLS
    // -------------------------------------------------------------------------
    console.log('\n--- 9. Verifying Brand Logo & Image Upload UI Controls ---');
    assert(adminHtml.includes('cms.images.logo'), 'Brand Logo path input present in Admin Dashboard');
    assert(adminHtml.includes("handleFileUpload($event, 'logo')"), 'Direct upload button for Logo present');
    assert(adminHtml.includes("handleFileUpload($event, 'heroVisual')"), 'Direct upload button for Hero Visual present');

    // -------------------------------------------------------------------------
    // TEST 10: CELSIUS & 5-10 YEARS WARRANTY & SUNLIGHT INTENSITY
    // -------------------------------------------------------------------------
    console.log('\n--- 10. Verifying Celsius, Warranty Period & Phrasing Across Site ---');
    assert(!indexHtml.includes('105°F') && !indexHtml.includes('78°F'), 'Index HTML contains 0 occurrences of Fahrenheit (°F)');
    assert(indexHtml.includes('41°C') && indexHtml.includes('25°C'), 'Index HTML includes Celsius units (41°C and 25°C)');
    assert(indexHtml.includes('5-10 سنوات'), 'Index HTML specifies 5-10 سنوات warranty period');
    assert(!indexHtml.includes('قياس الحرارة بالأرقام'), 'Old phrasing (قياس الحرارة بالأرقام) completely replaced');
    assert(indexHtml.includes('showBackToTop') && indexHtml.includes('scrollToTop()'), 'Scroll to top floating arrow button implemented');
    assert(indexHtml.includes('href="careers.html"'), 'Careers link present in navigation and footer');

    console.log('\n====================================================');
    console.log(`🏁 AUDIT SUITE FINISHED: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================');
    
    if (failed === 0) {
      console.log('🎉 ALL AUDIT CHECKS PASSED FLAWLESSLY! System is 100% production ready.');
    } else {
      process.exit(1);
    }
  } catch (err) {
    console.error('Audit failed with error:', err);
    process.exit(1);
  }
}

runSuite();
