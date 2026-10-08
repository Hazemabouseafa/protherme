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

    // Dynamic CMS Data Store
    cms: {
      visibility: {
        topbar: true,
        heroBadge: true,
        heroStats: true,
        trustBar: true,
        pillar1: true,
        pillar2: true,
        pillar3: true,
        simulator: true,
        technology: true,
        comparisonTable: true,
        gallery: true,
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
        heroVisual: 'assets/images/installation-site-real.jpg',
        pillar1: 'assets/images/arch-glass-villa.jpg',
        pillar2: 'assets/images/marble-surface.jpg',
        pillar3: 'assets/images/supercar-ppf.jpg',
        gallery1: 'assets/images/installation-site-real.jpg',
        gallery2: 'assets/images/marble-surface.jpg',
        gallery3: 'assets/images/arch-glass-villa.jpg',
        gallery4: 'assets/images/supercar-ppf.jpg'
      },
      buttons: {
        heroPrimary: { ar: 'طلب استشارة هندسية فورية', en: 'Request Instant Consultation', target: '#contact', visible: true },
        heroCall: { ar: 'اتصال مباشر', en: 'Direct Call', target: 'tel:01010010030', visible: true },
        navCta: { ar: 'تواصل معنا الآن', en: 'Contact Now', target: '#contact', visible: true }
      },
      heroStats: {
        stat1: { num: '88%', label_ar: 'عزل الأشعة تحت الحمراء (IR)', label_en: 'Infrared Heat Rejection (IRR)' },
        stat2: { num: '99.9%', label_ar: 'حجب الأشعة فوق البنفسجية (UV)', label_en: 'UV Radiation Block Protection' },
        stat3: { num: '10-25', label_ar: 'سنوات ضمان دولي معتمد', label_en: 'Years Certified Global Warranty' },
        stat4: { num: '0%', label_ar: 'تشويش إشارات الاتصال و 5G', label_en: 'Zero 5G & Signal Interference' }
      },
      texts: {},
      imageBadges: {}
    },

    async init() {
      // Set initial direction and lang attribute on root HTML
      this.updateDocumentAttributes();

      // Load cached or API CMS Content
      await this.loadCMSContent();

      // Listen for CMS updates across tabs
      window.addEventListener('storage', (e) => {
        if (e.key === 'protherme_cms_content' && e.newValue) {
          try {
            this.cms = JSON.parse(e.newValue);
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

    // Fetch CMS Content from Server API
    async loadCMSContent() {
      // Check localStorage cache first for instant render
      const cached = localStorage.getItem('protherme_cms_content');
      if (cached) {
        try {
          this.cms = Object.assign({}, this.cms, JSON.parse(cached));
        } catch (e) {}
      }

      try {
        const res = await fetch('/api/content');
        if (res.ok) {
          const remoteData = await res.json();
          this.cms = remoteData;
          localStorage.setItem('protherme_cms_content', JSON.stringify(remoteData));
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
    }
  }));
});
