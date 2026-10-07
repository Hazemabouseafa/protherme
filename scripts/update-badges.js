const fs = require('fs');
const path = require('path');

const contentFile = path.join(__dirname, '..', 'content.json');
const defaultContentFile = path.join(__dirname, '..', 'content.default.json');

const content = JSON.parse(fs.readFileSync(contentFile, 'utf8'));

content.imageBadges = {
  heroTop: {
    ar: "طاقم هندسي معتمد من Global Hi-Tech",
    en: "Global Hi-Tech Certified Crew"
  },
  heroCornerTag: {
    ar: "الموزع المعتمد الحصري",
    en: "Official Certified Distributor"
  },
  heroCornerName: {
    ar: "Global Hi-Tech Films",
    en: "Global Hi-Tech Films"
  },
  pillar1: {
    ar: "IRR: 88% | UV: 99.9%",
    en: "IRR: 88% | UV: 99.9%"
  },
  pillar2: {
    ar: "8.5 ميل | TPU معالجة ذاتية",
    en: "8.5 Mil | Self-Healing TPU"
  },
  pillar3: {
    ar: "توريد تجاري مباشر بالجملة",
    en: "Direct Wholesale Supply"
  },
  gallery1_badge: {
    ar: "مشروع رئيسي مميز",
    en: "Featured Landmark Installation"
  },
  gallery1_footer: {
    ar: "الواجهة المعمارية التجارية | مطعم Le Bistro",
    en: "Commercial Plaza | Le Bistro"
  },
  gallery2_badge: {
    ar: "حماية أسطح TPU فائقة",
    en: "Surface Shield TPU"
  },
  gallery2_footer: {
    ar: "مقاوم للأحماض والخدوش | 8.5 ميل TPU",
    en: "Acid-Proof | 8.5 Mil TPU"
  },
  gallery3_badge: {
    ar: "عزل معماري نانو سيراميك للفلل",
    en: "Nano-Ceramic Architectural Glazing"
  },
  gallery3_footer: {
    ar: "انخفاض 14°C | حجب 99% من الأشعة فوق البنفسجية",
    en: "-14°C Temp Drop | 99% UV Block"
  },
  gallery4_badge: {
    ar: "أفلام حماية طلاء السيارات PPF",
    en: "Self-Healing Automotive PPF"
  },
  gallery4_footer: {
    ar: "طارد فائق للمياه والأوساخ | 10 ميل TPU",
    en: "Super-Hydrophobic | 10 Mil TPU"
  }
};

fs.writeFileSync(contentFile, JSON.stringify(content, null, 2), 'utf8');
fs.writeFileSync(defaultContentFile, JSON.stringify(content, null, 2), 'utf8');

console.log('SUCCESS: imageBadges added to content.json and content.default.json');
