/**
 * Main Application Logic for ProTherme Engineering Solutions
 * Powered by Alpine.js + Live Dynamic CMS Integration
 */
document.addEventListener('alpine:init', () => {
  Alpine.data('prothermeApp', () => ({
    // Language State: 'ar' or 'en'
    lang: localStorage.getItem('protherme_lang') || 'ar',
    activeSector: 'villas',
    activeFaq: 1,
    mobileMenuOpen: false,
    heroVisualTab: 'image', // 'image' or '3d'
    
    // Performance Simulator State
    vlt: 35, // Visible Light Transmission %
    
    // Gallery State
    galleryFilter: 'all',
    lightboxOpen: false,
    lightboxImage: null,
    lightboxTitle: '',
    lightboxDesc: '',

    // Toast Notification
    toastOpen: false,
    toastMessage: '',

    // Scroll To Top Button
    showBackToTop: false,

    // Contact Us Lead Form
    contactForm: {
      name: '',
      phone: '',
      email: '',
      service: 'عزل زجاج المباني والفلل',
      message: ''
    },
    contactSubmitting: false,
    contactSuccess: false,
    contactError: '',

    // Dynamic CMS Data Store
    cms: {
      visibility: {
        topbar: true,
        heroBadge: true,
        heroStats: true,
        trustBar: true,
        video: true,
        steps: true,
        sectors: true,
        pillar1: true,
        pillar2: true,
        pillar3: true,
        simulator: true,
        technology: true,
        comparisonTable: true,
        gallery: true,
        reviews: true,
        faq: true,
        contact: true,
        footer: true,
        speedDial: true
      },
      contacts: {
        phone: '01010010030',
        email: 'sales@protherme.com',
        whatsapp: '+201010010030',
        hours: {
          ar: 'السبت - الخميس: 9:00 ص - 7:00 م',
          en: 'Saturday - Thursday: 9:00 AM - 7:00 PM'
        }
      },
      images: {
        logo: 'assets/images/protherme-logo.jpg',
        heroVisual: 'assets/images/hero-beforeafter.jpg',
        pillar1: 'assets/images/compound-villa-new.jpg',
        pillar2: 'assets/images/marble-surface-new.jpg',
        pillar3: 'assets/images/supercar-ppf-new.jpg',
        gallery1: 'assets/images/hotel-enterprise-new.jpg',
        gallery2: 'assets/images/marble-surface-new.jpg',
        gallery3: 'assets/images/compound-villa-new.jpg',
        gallery4: 'assets/images/supercar-ppf-new.jpg'
      },
      buttons: {
        heroPrimary: { ar: 'احجز معاينة مجانية بالعينات الآن', en: 'Book Free On-Site Survey & Samples', target: '#contact', visible: true },
        heroCall: { ar: 'اتصال بمهندس استشاري: 01010010030', en: 'Direct Advisory Hotline: 01010010030', target: 'tel:01010010030', visible: true },
        navCta: { ar: 'طلب معاينة', en: 'Request Survey', target: '#contact', visible: true }
      },
      heroStats: {
        stat1: { num: '30%', label_ar: 'توفير فاتورة الكهرباء', label_en: 'AC & Electricity Savings' },
        stat2: { num: '88%', label_ar: 'عزل حرارة الشمس (IR)', label_en: 'Sun Heat Rejection (IR)' },
        stat3: { num: '99%', label_ar: 'حماية من الأشعة الضارة (UV)', label_en: 'Harmful UV Shielding' },
        stat4: { num: '100%', label_ar: 'رؤية نقية دون تعتيم', label_en: 'Crystal Optical Clarity' }
      },
      video: {
        url: 'assets/videos/beforeafter.mp4',
        poster: 'assets/images/hero-beforeafter.jpg?v=2',
        autoplay: true
      },
      texts: {},
      imageBadges: {},
      blocks: [],
      sectionOrder: []
    },

    getVideoUrl() {
      if (this.cms && this.cms.video && this.cms.video.url) {
        return this.cms.video.url;
      }
      return 'assets/videos/beforeafter.mp4';
    },

    async init() {
      // Set initial direction and lang attribute on root HTML
      this.updateDocumentAttributes();

      // Watch for dynamic video URL changes
      this.$watch('cms.video.url', (newUrl) => {
        if (!newUrl) return;
        const v = document.getElementById('thermal-demo-video');
        if (v && v.getAttribute('src') !== newUrl) {
          v.src = newUrl;
          v.addEventListener('loadeddata', () => { v.play().catch(() => {}); }, { once: true });
          v.load();
        }
      });

      // Load cached or API CMS Content
      await this.loadCMSContent();

      // Ensure video element loads and plays the CMS configured video
      const v = document.getElementById('thermal-demo-video');
      if (v && this.cms && this.cms.video && this.cms.video.url) {
        if (v.getAttribute('src') !== this.cms.video.url) {
          v.src = this.cms.video.url;
          v.addEventListener('loadeddata', () => { v.play().catch(() => {}); }, { once: true });
          v.load();
        }
      }

      // Scroll listener for back-to-top button
      window.addEventListener('scroll', () => {
        this.showBackToTop = window.scrollY > 300;
      }, { passive: true });

      // Listen for CMS updates across tabs
      window.addEventListener('storage', (e) => {
        if ((e.key === 'protherme_cms_v20261008_rev' || e.key === 'protherme_cms_content') && e.newValue) {
          try {
            this.cms = Object.assign({}, this.cms, JSON.parse(e.newValue));
            const vid = document.getElementById('thermal-demo-video');
            if (vid && this.cms.video && this.cms.video.url && vid.getAttribute('src') !== this.cms.video.url) {
              vid.src = this.cms.video.url;
              vid.addEventListener('loadeddata', () => { vid.play().catch(() => {}); }, { once: true });
              vid.load();
            }
          } catch (err) {}
        }
      });

      // Initialize AOS if loaded
      if (typeof AOS !== 'undefined') {
        AOS.init({
          once: true,
          duration: 800,
          offset: 50,
          easing: 'ease-out-cubic'
        });
      }
    },

    // Fetch CMS Content from Server API (with cache invalidation)
    async loadCMSContent() {
      const CACHE_KEY = 'protherme_cms_v20261008_rev';
      const localAdminSaved = localStorage.getItem('protherme_cms_content');
      if (localAdminSaved) {
        try {
          this.cms = Object.assign({}, this.cms, JSON.parse(localAdminSaved));
        } catch (e) {}
      }

      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        try {
          this.cms = Object.assign({}, this.cms, JSON.parse(cached));
        } catch (e) {}
      }

      try {
        const res = await fetch('/api/content?v=' + Date.now(), { cache: 'no-store' });
        if (res.ok) {
          const remoteData = await res.json();
          this.cms = Object.assign({}, this.cms, remoteData);
          localStorage.setItem(CACHE_KEY, JSON.stringify(this.cms));
        }
      } catch (err) {
        console.warn('API sync unavailable, using default/cached CMS data:', err);
      }
    },

    // Translation Lookup Helper (with CMS overrides support)
    t(keyPath) {
      // Check CMS texts override first
      if (this.cms && this.cms.texts && this.cms.texts[this.lang]) {
        const keys = keyPath.split('.');
        let currentCMS = this.cms.texts[this.lang];
        let foundCMS = true;
        for (const k of keys) {
          if (!currentCMS || currentCMS[k] === undefined) {
            foundCMS = false;
            break;
          }
          currentCMS = currentCMS[k];
        }
        if (foundCMS && typeof currentCMS === 'string') {
          return currentCMS;
        }
      }

      // Fallback to static dictionary
      const keys = keyPath.split('.');
      const dict = (typeof translations !== 'undefined' ? translations : (typeof window !== 'undefined' ? window.translations : {}));
      let current = dict[this.lang];
      for (const key of keys) {
        if (!current || current[key] === undefined) {
          let fallback = dict['en'];
          for (const fbKey of keys) {
            if (!fallback || fallback[fbKey] === undefined) return keyPath;
            fallback = fallback[fbKey];
          }
          return fallback;
        }
        current = current[key];
      }
      return current;
    },

    // Switch Language Dynamically
    switchLang(newLang) {
      if (this.lang === newLang) return;
      this.lang = newLang;
      localStorage.setItem('protherme_lang', newLang);
      this.updateDocumentAttributes();
      
      setTimeout(() => {
        if (typeof AOS !== 'undefined') {
          AOS.refresh();
        }
      }, 150);
    },

    toggleLanguage() {
      this.switchLang(this.lang === 'ar' ? 'en' : 'ar');
    },

    updateDocumentAttributes() {
      const dir = this.lang === 'ar' ? 'rtl' : 'ltr';
      document.documentElement.setAttribute('dir', dir);
      document.documentElement.setAttribute('lang', this.lang);
      document.title = this.t('meta.title');
    },

    // Computed Simulator Metrics
    get irrPercent() {
      if (this.vlt <= 15) return 88;
      if (this.vlt <= 35) return 85;
      if (this.vlt <= 50) return 82;
      return 79;
    },

    get uvPercent() {
      return '99.9%';
    },

    get tserPercent() {
      if (this.vlt <= 10) return 74;
      if (this.vlt <= 20) return 69;
      if (this.vlt <= 35) return 64;
      if (this.vlt <= 50) return 58;
      return 52;
    },

    get tempDrop() {
      if (this.vlt <= 20) return '14 - 16 °C';
      if (this.vlt <= 40) return '12 - 14 °C';
      return '10 - 12 °C';
    },

    get hvacSavings() {
      if (this.vlt <= 20) return '28% - 32%';
      if (this.vlt <= 40) return '24% - 28%';
      return '18% - 22%';
    },

    get vltHint() {
      if (this.vlt <= 20) return this.t('simulator.vlt_hint_dark');
      if (this.vlt <= 50) return this.t('simulator.vlt_hint_mid');
      return this.t('simulator.vlt_hint_clear');
    },

    // Open Lightbox
    openLightbox(imageSrc, titleKey, descKey) {
      this.lightboxImage = imageSrc;
      this.lightboxTitle = this.t(titleKey);
      this.lightboxDesc = this.t(descKey);
      this.lightboxOpen = true;
      document.body.style.overflow = 'hidden';
    },

    closeLightbox() {
      this.lightboxOpen = false;
      document.body.style.overflow = '';
    },

    showToast(message) {
      this.toastMessage = message;
      this.toastOpen = true;
      setTimeout(() => {
        this.toastOpen = false;
      }, 5000);
    },

    // Smooth Scroll Helper
    scrollTo(elementId) {
      this.mobileMenuOpen = false;
      const element = document.getElementById(elementId);
      if (element) {
        const navHeight = 90;
        const targetPosition = element.getBoundingClientRect().top + window.pageYOffset - navHeight;
        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
      }
    },

    // Scroll to Top
    scrollToTop() {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    },

    // Submit Lead Inquiry to /api/leads
    async submitContactForm() {
      if (!this.contactForm.name || !this.contactForm.phone) {
        this.contactError = this.lang === 'ar' ? 'يرجى كتابة الاسم ورقم الهاتف' : 'Please provide name and phone number';
        return;
      }
      this.contactSubmitting = true;
      this.contactError = '';
      try {
        const res = await fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.contactForm)
        });
        const data = await res.json();
        if (res.ok && data.success) {
          this.contactSuccess = true;
          this.contactForm = {
            name: '',
            phone: '',
            email: '',
            service: 'عزل زجاج المباني والفلل',
            message: ''
          };
          this.showToast(this.lang === 'ar' ? 'تم استلام طلبكم بنجاح وسيتواصل معكم فريقنا قريباً' : 'Inquiry received successfully! Our team will contact you shortly.');
        } else {
          this.contactError = data.error || (this.lang === 'ar' ? 'حدث خطأ أثناء الإرسال' : 'Error submitting form');
        }
      } catch (err) {
        console.error('Submit lead error:', err);
        this.contactError = this.lang === 'ar' ? 'تعذر الاتصال بالخادم' : 'Server connection failed';
      } finally {
        this.contactSubmitting = false;
      }
    },

    // Custom Dynamic Blocks Filter
    getBlocksByPosition(position) {
      if (!this.cms || !Array.isArray(this.cms.blocks)) return [];
      return this.cms.blocks.filter(b => b && b.enabled !== false && b.position === position);
    },

    // Dynamic Section Order Resolver
    getSectionOrder(secId) {
      if (this.cms && Array.isArray(this.cms.sectionOrder)) {
        const idx = this.cms.sectionOrder.findIndex(s => {
          if (!s) return false;
          return (typeof s === 'string' ? s : s.id) === secId;
        });
        if (idx !== -1) {
          const item = this.cms.sectionOrder[idx];
          if (item && typeof item.order === 'number') return item.order;
          return idx + 1;
        }
      }
      const defaults = {
        trustBar: 1,
        video: 2,
        steps: 3,
        sectors: 4,
        services: 5,
        technology: 6,
        gallery: 7,
        reviews: 8,
        faq: 9,
        contact: 10
      };
      return defaults[secId] !== undefined ? defaults[secId] : 10;
    },

    // Dynamic Lists Getters
    getFaqs() {
      if (this.cms && Array.isArray(this.cms.faqList) && this.cms.faqList.length > 0) {
        return this.cms.faqList;
      }
      return [1, 2, 3, 4].map(n => ({
        q: { ar: this.t('faq.q' + n), en: this.t('faq.q' + n) },
        a: { ar: this.t('faq.a' + n), en: this.t('faq.a' + n) }
      }));
    },

    getSteps() {
      if (this.cms && Array.isArray(this.cms.stepsList) && this.cms.stepsList.length > 0) {
        return this.cms.stepsList;
      }
      return [1, 2, 3].map(n => ({
        num: this.t('steps.s' + n + '_num'),
        title: { ar: this.t('steps.s' + n + '_title'), en: this.t('steps.s' + n + '_title') },
        desc: { ar: this.t('steps.s' + n + '_desc'), en: this.t('steps.s' + n + '_desc') }
      }));
    },

    getPillars() {
      if (this.cms && Array.isArray(this.cms.pillarsList) && this.cms.pillarsList.length > 0) {
        return this.cms.pillarsList;
      }
      return ['p1', 'p2', 'p3'].map((pKey, i) => ({
        key: pKey,
        enabled: this.cms.visibility ? this.cms.visibility['pillar' + (i + 1)] !== false : true,
        name: { ar: this.t('pillars.' + pKey + '.name'), en: this.t('pillars.' + pKey + '.name') },
        tag: { ar: this.t('pillars.' + pKey + '.tag'), en: this.t('pillars.' + pKey + '.tag') },
        desc: { ar: this.t('pillars.' + pKey + '.desc'), en: this.t('pillars.' + pKey + '.desc') },
        f1: { ar: this.t('pillars.' + pKey + '.f1'), en: this.t('pillars.' + pKey + '.f1') },
        f2: { ar: this.t('pillars.' + pKey + '.f2'), en: this.t('pillars.' + pKey + '.f2') },
        f3: { ar: this.t('pillars.' + pKey + '.f3'), en: this.t('pillars.' + pKey + '.f3') },
        f4: { ar: this.t('pillars.' + pKey + '.f4'), en: this.t('pillars.' + pKey + '.f4') },
        specs: { ar: this.t('pillars.' + pKey + '.specs'), en: this.t('pillars.' + pKey + '.specs') },
        cta: { ar: this.t('pillars.' + pKey + '.cta'), en: this.t('pillars.' + pKey + '.cta') },
        image: this.cms.images ? this.cms.images['pillar' + (i + 1)] : '',
        badge: { ar: this.cms.imageBadges?.['pillar' + (i + 1)]?.ar || '', en: this.cms.imageBadges?.['pillar' + (i + 1)]?.en || '' }
      }));
    },

    getGalleryItems() {
      if (this.cms && Array.isArray(this.cms.galleryList) && this.cms.galleryList.length > 0) {
        return this.cms.galleryList;
      }
      return ['1', '2', '3', '4'].map(gNum => ({
        id: 'gallery' + gNum,
        category: gNum === '1' || gNum === '3' ? 'arch' : gNum === '2' ? 'surface' : 'auto',
        image: this.cms.images ? this.cms.images['gallery' + gNum] : '',
        title: { ar: this.t('gallery.item' + gNum + '_title'), en: this.t('gallery.item' + gNum + '_title') },
        desc: { ar: this.t('gallery.item' + gNum + '_desc'), en: this.t('gallery.item' + gNum + '_desc') },
        badge: { ar: this.cms.imageBadges?.['gallery' + gNum + '_badge']?.ar || '', en: this.cms.imageBadges?.['gallery' + gNum + '_badge']?.en || '' },
        footer: { ar: this.cms.imageBadges?.['gallery' + gNum + '_footer']?.ar || '', en: this.cms.imageBadges?.['gallery' + gNum + '_footer']?.en || '' }
      }));
    },

    getTechStandards() {
      if (this.cms && Array.isArray(this.cms.techList) && this.cms.techList.length > 0) {
        return this.cms.techList;
      }
      return ['c1', 'c2', 'c3', 'c4'].map(cKey => ({
        key: cKey,
        title: { ar: this.t('tech_standards.' + cKey + '_title'), en: this.t('tech_standards.' + cKey + '_title') },
        desc: { ar: this.t('tech_standards.' + cKey + '_desc'), en: this.t('tech_standards.' + cKey + '_desc') }
      }));
    },

    getComparisonRows() {
      if (this.cms && Array.isArray(this.cms.comparisonList) && this.cms.comparisonList.length > 0) {
        return this.cms.comparisonList;
      }
      return ['r1', 'r2', 'r3', 'r4'].map(rKey => ({
        key: rKey,
        title: { ar: this.t('comparison.' + rKey + '_title'), en: this.t('comparison.' + rKey + '_title') },
        pro: { ar: this.t('comparison.' + rKey + '_pro'), en: this.t('comparison.' + rKey + '_pro') },
        std: { ar: this.t('comparison.' + rKey + '_std'), en: this.t('comparison.' + rKey + '_std') }
      }));
    },

    getHeroStats() {
      if (this.cms && Array.isArray(this.cms.heroStatsList) && this.cms.heroStatsList.length > 0) {
        return this.cms.heroStatsList;
      }
      if (this.cms && this.cms.heroStats) {
        return ['stat1', 'stat2', 'stat3', 'stat4'].map(k => ({
          key: k,
          num: this.cms.heroStats[k]?.num || '',
          label: { ar: this.cms.heroStats[k]?.label_ar || '', en: this.cms.heroStats[k]?.label_en || '' }
        }));
      }
      return [];
    },

    getTrustItems() {
      if (this.cms && Array.isArray(this.cms.trustList) && this.cms.trustList.length > 0) {
        return this.cms.trustList;
      }
      return ['t1', 't2', 't3', 't4'].map(tKey => ({
        key: tKey,
        title: { ar: this.t('trust.' + tKey), en: this.t('trust.' + tKey) },
        sub: { ar: this.t('trust.' + tKey + '_sub'), en: this.t('trust.' + tKey + '_sub') }
      }));
    },

    getVideoBullets() {
      if (this.cms && Array.isArray(this.cms.videoBulletsList) && this.cms.videoBulletsList.length > 0) {
        return this.cms.videoBulletsList;
      }
      return ['h1', 'h2', 'h3'].map(hKey => ({
        key: hKey,
        title: { ar: this.cms.video?.[hKey + '_title']?.ar || '', en: this.cms.video?.[hKey + '_title']?.en || '' },
        desc: { ar: this.cms.video?.[hKey + '_desc']?.ar || '', en: this.cms.video?.[hKey + '_desc']?.en || '' }
      }));
    },

    getVillaFeatures() {
      if (this.cms && Array.isArray(this.cms.villaFeaturesList) && this.cms.villaFeaturesList.length > 0) {
        return this.cms.villaFeaturesList;
      }
      return [1, 2, 3].map(n => ({
        title: { ar: this.t('sectors.villa_f' + n + '_title'), en: this.t('sectors.villa_f' + n + '_title') },
        desc: { ar: this.t('sectors.villa_f' + n + '_desc'), en: this.t('sectors.villa_f' + n + '_desc') }
      }));
    },

    getEnterpriseFeatures() {
      if (this.cms && Array.isArray(this.cms.enterpriseFeaturesList) && this.cms.enterpriseFeaturesList.length > 0) {
        return this.cms.enterpriseFeaturesList;
      }
      return [1, 2, 3].map(n => ({
        title: { ar: this.t('sectors.ent_f' + n + '_title'), en: this.t('sectors.ent_f' + n + '_title') },
        desc: { ar: this.t('sectors.ent_f' + n + '_desc'), en: this.t('sectors.ent_f' + n + '_desc') }
      }));
    }
  }));
});
