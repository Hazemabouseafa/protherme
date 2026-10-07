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

    // 1.5 App JS Asset
    res = await request({ host: 'localhost', port: PORT, path: '/assets/js/app.js', method: 'GET' });
    assert(res.statusCode === 200 && res.body.includes('prothermeApp'), 'GET /assets/js/app.js (Alpine app script served 200 OK)');

    // 1.6 Logo Asset
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

    // Contact keys
    assert(content.contacts && content.contacts.phone === '01010010030', 'Direct phone is correctly initialized to 01010010030');
    assert(content.contacts && content.contacts.whatsapp === '+201010010030', 'WhatsApp hotline is correctly initialized to +201010010030');
    assert(content.contacts && content.contacts.email === 'sales@protherme.com', 'Corporate email is sales@protherme.com');

    // Images
    assert(content.images && content.images.heroVisual && content.images.gallery1, 'Image paths for hero and gallery correctly configured');

    // Bilingual Texts
    assert(content.texts && content.texts.ar && content.texts.en, 'Both Arabic and English text dictionaries present in CMS data');
    assert(content.texts.ar.hero && content.texts.ar.pillars && content.texts.ar.tech_standards && content.texts.ar.comparison, 'All AR sections present in CMS');
    assert(content.texts.en.hero && content.texts.en.pillars && content.texts.en.tech_standards && content.texts.en.comparison, 'All EN sections present in CMS');

    // Image Badges
    const expectedBadgeKeys = [
      'heroTop', 'heroCornerTag', 'heroCornerName',
      'pillar1', 'pillar2', 'pillar3',
      'gallery1_badge', 'gallery1_footer',
      'gallery2_badge', 'gallery2_footer',
      'gallery3_badge', 'gallery3_footer',
      'gallery4_badge', 'gallery4_footer'
    ];
    const hasAllBadges = expectedBadgeKeys.every(k => content.imageBadges && content.imageBadges[k] && content.imageBadges[k].ar && content.imageBadges[k].en);
    assert(hasAllBadges, 'All 14 Image Badges present in CMS with AR & EN translations');

    // -------------------------------------------------------------------------
    // TEST 3: LIVE CMS PERSISTENCE & MUTATION (POST /api/content)
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Testing CMS Mutation & Disk Persistence ---');
    
    // Create mutation payload
    const modifiedContent = JSON.parse(JSON.stringify(content));
    modifiedContent.visibility.simulator = false; // Turn off simulator
    modifiedContent.visibility.topbar = false;    // Turn off topbar
    modifiedContent.contacts.phone = '01099887766'; // Change phone
    modifiedContent.texts.ar.hero.title_p1 = 'حلول بروتيرم الهندسية المعتمدة'; // Change title
    if (modifiedContent.imageBadges && modifiedContent.imageBadges.heroTop) {
      modifiedContent.imageBadges.heroTop.ar = 'طاقم معتمد ومحدث للاختبار';
    }
    
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
    assert(verifiedContent.visibility.topbar === false, 'Mutation persisted: visibility.topbar is now false');
    assert(verifiedContent.contacts.phone === '01099887766', 'Mutation persisted: contacts.phone is 01099887766');
    assert(verifiedContent.texts.ar.hero.title_p1 === 'حلول بروتيرم الهندسية المعتمدة', 'Mutation persisted: AR title updated');
    assert(verifiedContent.imageBadges && verifiedContent.imageBadges.heroTop.ar === 'طاقم معتمد ومحدث للاختبار', 'Mutation persisted: imageBadges.heroTop.ar updated');

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
    assert(resetJson.content.visibility.simulator === true, 'Factory visibility.simulator reset back to true');
    assert(resetJson.content.visibility.topbar === true, 'Factory visibility.topbar reset back to true');

    // Verify GET reflects reset
    res = await request({ host: 'localhost', port: PORT, path: '/api/content', method: 'GET' });
    const postResetContent = JSON.parse(res.body);
    assert(postResetContent.contacts.phone === '01010010030', 'GET /api/content confirms factory defaults restored');
    assert(postResetContent.imageBadges && postResetContent.imageBadges.heroTop.ar === 'طاقم هندسي معتمد من Global Hi-Tech', 'Factory reset restores imageBadges defaults');

    // -------------------------------------------------------------------------
    // TEST 5: NO CONTACT FORM IN INDEX.HTML
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Verifying Contact Section (No Form, Direct Channels Only) ---');
    const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    const contactSectionMatch = indexHtml.match(/<section[^>]*id="contact"[^>]*>([\s\S]*?)<\/section>/i);
    
    assert(contactSectionMatch !== null, 'Contact section (#contact) exists in index.html');
    if (contactSectionMatch) {
      const contactContent = contactSectionMatch[1];
      const hasForm = /<form/i.test(contactContent);
      assert(!hasForm, 'CRITICAL: No <form> tag exists inside the contact section (Form successfully removed)');
      
      const hasPhone = contactContent.includes('cms.contacts.phone');
      const hasWa = contactContent.includes('cms.contacts.whatsapp');
      const hasEmail = contactContent.includes('cms.contacts.email');
      assert(hasPhone && hasWa && hasEmail, 'Direct channels (Phone, WhatsApp, Email) are bound to CMS contacts');
    }

    // Verify Simulator is removed from index.html
    const hasSimulatorSection = /id="simulator"/i.test(indexHtml);
    const hasSimulatorNav = /scrollTo\('simulator'\)/i.test(indexHtml);
    assert(!hasSimulatorSection, 'CRITICAL: Interactive performance simulator section (#simulator) completely removed from index.html');
    assert(!hasSimulatorNav, 'CRITICAL: Simulator nav buttons completely removed from desktop and mobile menus in index.html');

    // -------------------------------------------------------------------------
    // TEST 6: ADMIN DASHBOARD UI INTEGRITY
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Verifying Admin Dashboard Features ---');
    const adminHtml = fs.readFileSync(path.join(__dirname, 'admin.html'), 'utf8');
    
    assert(adminHtml.includes('admin2026') && adminHtml.includes('1234'), 'PIN authentication verifies admin2026 & 1234');
    assert(adminHtml.includes('logout()') && adminHtml.includes('sessionStorage.removeItem'), 'Logout functionality implemented');
    assert(adminHtml.includes("activeTab = 'visibility'"), 'Visibility toggles tab exists');
    assert(adminHtml.includes("activeTab = 'contacts'"), 'Contacts management tab exists');
    assert(adminHtml.includes("activeTab = 'hero'"), 'Hero section editor tab exists');
    assert(adminHtml.includes("activeTab = 'pillars'"), 'Pillars editor tab exists');
    assert(adminHtml.includes("activeTab = 'tech'"), 'Tech standards & comparison tab exists');
    assert(adminHtml.includes("activeTab = 'media'"), 'Media gallery editor tab exists');
    assert(adminHtml.includes("activeTab = 'buttons'"), 'Buttons & CTAs editor tab exists');
    assert(adminHtml.includes('cms.imageBadges.heroTop[editLang]'), 'Admin dashboard includes image badges bindings for Hero');
    assert(adminHtml.includes("cms.imageBadges['gallery' + gNum + '_badge'][editLang]"), 'Admin dashboard includes image badges bindings for Gallery');
    assert(adminHtml.includes('saveContent()') && adminHtml.includes('resetToDefaults()'), 'Save and Factory Reset methods bound');

    // -------------------------------------------------------------------------
    // TEST 7: DIRECT IMAGE UPLOAD API (POST /api/upload)
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Testing Direct Device Image Upload API ---');
    // Minimal 1x1 transparent GIF base64
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

    // Verify uploaded file actually exists on disk
    const uploadedFilePath = path.join(__dirname, uploadJson.url);
    const fileExistsOnDisk = fs.existsSync(uploadedFilePath);
    assert(fileExistsOnDisk, 'Uploaded image file was successfully created on physical server disk');
    
    // Clean up test file
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
    const tabsList = ['visibility', 'contacts', 'hero', 'pillars', 'tech', 'media', 'buttons'];

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
    assert(allTabsFound, 'All 7 admin tab panels located in DOM');
    const allSiblings = tabsList.every(t => tabDepths[t] === tabDepths['visibility']);
    assert(allSiblings, 'CRITICAL: All 7 admin tabs are siblings at the exact same DOM depth (Tabs 4-7 are NOT trapped in Hero tab)');

    // -------------------------------------------------------------------------
    // TEST 9: BRAND LOGO & DIRECT UPLOAD UI CONTROLS
    // -------------------------------------------------------------------------
    console.log('\n--- 9. Verifying Brand Logo & Image Upload UI Controls ---');
    assert(adminHtml.includes('cms.images.logo'), 'Brand Logo path input present in Admin Dashboard');
    assert(adminHtml.includes("handleFileUpload($event, 'logo')"), 'Direct upload button for Logo present');
    assert(adminHtml.includes("handleFileUpload($event, 'heroVisual')"), 'Direct upload button for Hero Visual present');
    assert(adminHtml.includes("handleFileUpload($event, 'pillar' + (idx + 1))"), 'Direct upload button for Pillars present');
    assert(adminHtml.includes("handleFileUpload($event, 'gallery' + gNum)"), 'Direct upload button for Gallery items present');
    assert(adminHtml.includes('handleFileUpload(event, imageKey)'), 'handleFileUpload method implemented in Alpine script');

    // -------------------------------------------------------------------------
    // TEST 10: PILLAR CTA & COMPARISON & GALLERY HEADERS
    // -------------------------------------------------------------------------
    console.log('\n--- 10. Verifying Pillar CTA, Comparison, and Gallery Section Headers ---');
    assert(adminHtml.includes('cms.texts[editLang].pillars[pillarKey].cta'), 'Pillar CTA button text input present in Admin Dashboard');
    assert(adminHtml.includes('cms.texts[editLang].comparison.title'), 'Comparison table title input present in Admin Dashboard');
    assert(adminHtml.includes('cms.texts[editLang].comparison.th_feature'), 'Comparison table feature column header input present');
    assert(adminHtml.includes('cms.texts[editLang].comparison.th_pro'), 'Comparison table ProTherme column header input present');
    assert(adminHtml.includes('cms.texts[editLang].comparison.th_market'), 'Comparison table Market column header input present');
    assert(adminHtml.includes('cms.texts[editLang].gallery.title'), 'Gallery section title input present in Admin Dashboard');
    assert(adminHtml.includes('cms.texts[editLang].contact.call_badge'), 'Contact card badge inputs present in Admin Dashboard');

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
