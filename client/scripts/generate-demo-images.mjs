/**
 * Generates the DEMO product placeholder images used while the catalog is in
 * demo mode. These are intentionally designed illustration panels — they are
 * NOT photographs of store stock and are labelled "DEMO IMAGE" on every file.
 *
 * Run: npm run generate:demo-images
 * OWNER: real product photography replaces these files via the catalog records
 * once approved inventory exists (Phase 2 backend or owner-supplied photos).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT_DIR = fileURLToPath(new URL('../public/images/products/', import.meta.url));
mkdirSync(OUT_DIR, { recursive: true });

const ICONS = {
  Sneakers: `
    <path d="M14 96c-4 0-6-4-5-8 2-10 8-20 18-29 12-11 28-18 46-18 14 0 27 4 38 11l18 12c6 4 13 7 21 8l22 3c10 1 18 7 20 15 1 4-2 8-6 8H16z" />
    <path d="M10 98h216c6 0 10 4 10 9s-4 9-10 9H18c-6 0-10-4-10-9s2-9 8-9z" />
    <path d="M70 52l16 12M88 44l18 14M106 40l18 14" />
    <path d="M50 84c16-14 34-22 56-24" />`,
  HighTop: `
    <path d="M40 30c-8 0-13 6-11 14 2 10 4 20 8 30 6 14 20 22 40 24 14 1 26-2 38-9l24-15c8-5 17-8 27-8l24 3c10 1 18 7 20 15 1 4-2 8-6 8H48" />
    <path d="M44 44h26" />
    <path d="M10 98h216c6 0 10 4 10 9s-4 9-10 9H18c-6 0-10-4-10-9s2-9 8-9z" />
    <path d="M60 66l16 10M74 80l16 8" />`,
  Formal: `
    <path d="M18 92c0-14 10-24 28-30 20-7 42-8 60-3 12 3 22 9 30 17 8 8 18 13 30 15 8 2 12 7 12 14H22c-4 0-6-3-4-8z" />
    <path d="M10 105h218c5 0 8 3 8 7s-3 6-8 6H18c-5 0-8-2-8-6s1-7 4-7z" />
    <path d="M70 70h40M78 60h34" />`,
  Loafer: `
    <path d="M20 94c2-12 12-22 30-28 22-8 46-8 66-1 10 4 18 10 24 18 8 9 18 14 30 16 6 1 10 5 10 11H24c-6 0-8-8-4-16z" />
    <path d="M10 106h220c5 0 8 3 8 7s-3 7-8 7H18c-5 0-8-3-8-7s2-7 6-7z" />
    <path d="M92 74c12-6 28-6 40 0" />
    <circle cx="112" cy="81" r="4" />`,
  Slide: `
    <path d="M14 92h212c8 0 12 5 12 11s-4 12-12 12H22c-8 0-12-6-12-12s4-11 12-11z" />
    <path d="M64 92c0-18 12-32 30-32s30 14 30 32" />
    <path d="M124 92c0-16 10-28 26-28s26 12 26 28" />`,
  Clog: `
    <path d="M30 100c-10-8-14-22-8-36 7-16 26-26 50-26 22 0 40 6 54 18 10 8 20 13 32 16 10 2 16 9 16 18 0 4-3 8-8 8H36c-4 0-6-2-6-6z" />
    <path d="M14 107h214c5 0 8 3 8 7s-3 7-8 7H20c-5 0-8-3-8-7s2-7 6-7z" />
    <path d="M56 58c8-6 20-8 32-6" />`,
};

const products = [
  { file: 'demo-court-low-white-gold.svg', icon: 'Sneakers', label: 'White / Gold', accent: '#f5b301', swatches: ['#f7f7f5', '#f5b301', '#c9c9c4'] },
  { file: 'demo-flight-high-black-red.svg', icon: 'HighTop', label: 'Black / Red', accent: '#d7263d', swatches: ['#131313', '#d7263d', '#3a3a3a'] },
  { file: 'demo-gel-runner-grey-navy.svg', icon: 'Sneakers', label: 'Grey / Navy', accent: '#26406e', swatches: ['#9aa1ab', '#26406e', '#d7dade'] },
  { file: 'demo-classic-grey-silver.svg', icon: 'Sneakers', label: 'Grey / Silver', accent: '#7d858f', swatches: ['#8d949c', '#c9ced4', '#5c636b'] },
  { file: 'demo-suede-strap-tan.svg', icon: 'Sneakers', label: 'Tan / Brown', accent: '#a4703a', swatches: ['#d8a86c', '#a4703a', '#6f4a24'] },
  { file: 'demo-air-court-mid-white-red.svg', icon: 'HighTop', label: 'White / Red', accent: '#d7263d', swatches: ['#f7f7f5', '#d7263d', '#131313'] },
  { file: 'demo-oxford-black.svg', icon: 'Formal', label: 'Black', accent: '#4b4b52', swatches: ['#131313', '#4b4b52', '#8a8a92'] },
  { file: 'demo-derby-brown.svg', icon: 'Formal', label: 'Brown', accent: '#7a4a24', swatches: ['#7a4a24', '#a4703a', '#402614'] },
  { file: 'demo-penny-loafer-tan.svg', icon: 'Loafer', label: 'Tan', accent: '#c08a45', swatches: ['#d8a86c', '#c08a45', '#7a4a24'] },
  { file: 'demo-suede-loafer-navy.svg', icon: 'Loafer', label: 'Navy', accent: '#233a63', swatches: ['#233a63', '#3d5a8a', '#101a2e'] },
  { file: 'demo-double-slide-black.svg', icon: 'Slide', label: 'Black', accent: '#3a3a40', swatches: ['#131313', '#3a3a40', '#6f6f78'] },
  { file: 'demo-clog-cream.svg', icon: 'Clog', label: 'Cream', accent: '#c9b48a', swatches: ['#efe6d3', '#c9b48a', '#8f7f5e'] },
];

function svg({ icon, label, accent, swatches }) {
  const dots = swatches
    .map(
      (color, i) =>
        `<circle cx="${40 + i * 34}" cy="322" r="11" fill="${color}" stroke="#131313" stroke-opacity="0.25" stroke-width="2"/>`,
    )
    .join('\n  ');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 360" width="480" height="360" role="img" aria-label="Demo catalogue placeholder image for ${label}">
  <title>Demo catalogue image — ${label}</title>
  <rect width="480" height="360" fill="#f8f4ea"/>
  <path d="M0 250 L480 176 L480 360 L0 360 Z" fill="${accent}" fill-opacity="0.18"/>
  <circle cx="420" cy="64" r="96" fill="${accent}" fill-opacity="0.22"/>
  <circle cx="52" cy="86" r="54" fill="${accent}" fill-opacity="0.14"/>
  <g transform="translate(120 78)" fill="none" stroke="#131313" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">
    ${ICONS[icon]}
  </g>
  ${dots}
  <rect x="330" y="300" width="128" height="34" rx="17" fill="#131313"/>
  <text x="394" y="322" text-anchor="middle" font-family="Archivo, Arial, sans-serif" font-size="14" font-weight="800" letter-spacing="2" fill="#f5b301">DEMO IMAGE</text>
  <text x="40" y="46" font-family="Archivo, Arial, sans-serif" font-size="20" font-weight="900" fill="#131313">${label}</text>
  <text x="40" y="70" font-family="Archivo, Arial, sans-serif" font-size="13" font-weight="600" fill="#6a6a75">Placeholder art — not a photo of store stock</text>
</svg>
`;
}

for (const product of products) {
  writeFileSync(`${OUT_DIR}${product.file}`, svg(product), 'utf8');
}
console.log(`Generated ${products.length} demo images in public/images/products/`);
