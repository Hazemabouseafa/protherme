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
      texts: {},
      imageBadges: {},
      blocks: []
    },

    async init() {
      // Set initial direction and lang attribute on root HTML
      this.updateDocumentAttributes();

      // Load cached or API CMS Content
      await this.loadCMSContent();

      // Scroll listener for back-to-top button
      window.addEventListener('scroll', () => {
        this.showBackToTop = window.scrollY > 300;
      }, { passive: true });

      // Listen for CMS updates across tabs
      window.addEventListener('storage', (e) => {
        if (e.key === 'protherme_cms_v20261008_rev' && e.newValue) {
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

    // Fetch CMS Content from Server API (with cache invalidation)
    async loadCMSContent() {
      const CACHE_KEY = 'protherme_cms_v20261008_rev';
      try {
        localStorage.removeItem('protherme_cms_content');
        localStorage.removeItem('protherme_cms_v20261008');
      } catch (e) {}

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
    }
  }));
});
