const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, '..', 'public', 'images');
const dirs = [
  baseDir,
  path.join(baseDir, 'items'),
  path.join(baseDir, 'lostfound'),
  path.join(baseDir, 'complaints'),
  path.join(baseDir, 'events')
];

dirs.forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

function createSvg(title, icon, color1, color2) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 250" width="100%" height="100%">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${color1}"/>
      <stop offset="100%" stop-color="${color2}"/>
    </linearGradient>
  </defs>
  <rect width="400" height="250" fill="url(#g)" rx="12"/>
  <circle cx="200" cy="100" r="50" fill="rgba(255,255,255,0.18)"/>
  <text x="200" y="115" font-size="44" text-anchor="middle" fill="#ffffff">${icon}</text>
  <text x="200" y="180" font-size="18" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="600" text-anchor="middle" fill="#ffffff">${title}</text>
  <text x="200" y="205" font-size="12" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" text-anchor="middle" fill="rgba(255,255,255,0.8)">CampusCare Official Asset</text>
</svg>`;
}

const svgs = {
  'logo.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 60" width="260" height="60">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#1e40af"/>
        <stop offset="100%" stop-color="#0284c7"/>
      </linearGradient>
    </defs>
    <rect x="5" y="8" width="44" height="44" rx="10" fill="url(#grad)"/>
    <path d="M27 18 L38 27 L33 27 L33 38 L21 38 L21 27 L16 27 Z" fill="#ffffff"/>
    <circle cx="27" cy="33" r="3" fill="#38bdf8"/>
    <text x="60" y="34" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="22" font-weight="800" fill="#0f172a">Campus<tspan fill="#0284c7">Care</tspan></text>
    <text x="60" y="47" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="9" font-weight="600" fill="#64748b" letter-spacing="1">TRCAC PORTAL</text>
  </svg>`,
  'default-avatar.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
    <circle cx="60" cy="60" r="60" fill="#e2e8f0"/>
    <circle cx="60" cy="45" r="22" fill="#94a3b8"/>
    <path d="M24 102 C24 82 40 75 60 75 C80 75 96 82 96 102 Z" fill="#94a3b8"/>
  </svg>`,
  'items/book-dsa.svg': createSvg('DSA Java Textbook', '📚', '#3b82f6', '#1d4ed8'),
  'items/calculator.svg': createSvg('Casio fx-991EX', '🔢', '#059669', '#047857'),
  'items/labcoat.svg': createSvg('Lab Coat Size L', '🥼', '#6366f1', '#4338ca'),
  'items/arduino.svg': createSvg('Arduino Uno Starter Kit', '⚡', '#0284c7', '#0369a1'),
  'items/drafter.svg': createSvg('Mini Drafter Scale', '📐', '#d97706', '#b45309'),
  'items/racket.svg': createSvg('Yonex Badminton Racket', '🏸', '#e11d48', '#be123c'),
  'items/default-item.svg': createSvg('Campus Listing', '📦', '#475569', '#334155'),
  'lostfound/bottle.svg': createSvg('Blue Milton Bottle', '🍶', '#0284c7', '#0369a1'),
  'lostfound/charger.svg': createSvg('HP Laptop Charger', '🔌', '#475569', '#1e293b'),
  'lostfound/earbuds.svg': createSvg('boAt Wireless Earbuds', '🎧', '#7c3aed', '#6d28d9'),
  'lostfound/default.svg': createSvg('Lost / Found Item', '🔍', '#64748b', '#475569'),
  'complaints/lab.svg': createSvg('CS Lab 2 Projector', '🖥️', '#dc2626', '#991b1b'),
  'complaints/plumbing.svg': createSvg('Restroom Tap Leakage', '🚰', '#2563eb', '#1d4ed8'),
  'complaints/wifi.svg': createSvg('Library Wi-Fi Repeater', '📶', '#7c3aed', '#5b21b6'),
  'complaints/cooler.svg': createSvg('Water Cooler Filter', '💧', '#0891b2', '#0e7490'),
  'events/techspark.svg': createSvg('TechSpark Symposium 2026', '🚀', '#4f46e5', '#3730a3'),
  'events/workshop.svg': createSvg('Cloud & Docker Masterclass', '☁️', '#0d9488', '#0f766e'),
  'events/healthcamp.svg': createSvg('Blood Donation Drive', '❤️', '#e11d48', '#9f1239'),
  'events/default-event.svg': createSvg('TRCAC Campus Event', '🎓', '#1e40af', '#1e3a8a')
};

for (const [file, content] of Object.entries(svgs)) {
  fs.writeFileSync(path.join(baseDir, file), content, 'utf8');
}
console.log('Generated all SVG placeholder images successfully!');
