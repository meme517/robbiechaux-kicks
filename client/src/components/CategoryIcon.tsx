import type { ReactElement } from 'react';

const ICONS: Record<string, ReactElement> = {
  sneakers: (
    <>
      <path d="M14 96c-4 0-6-4-5-8 2-10 8-20 18-29 12-11 28-18 46-18 14 0 27 4 38 11l18 12c6 4 13 7 21 8l22 3c10 1 18 7 20 15 1 4-2 8-6 8H16z" />
      <path d="M10 98h216c6 0 10 4 10 9s-4 9-10 9H18c-6 0-10-4-10-9s2-9 8-9z" />
      <path d="M70 52l16 12M88 44l18 14M106 40l18 14" />
      <path d="M50 84c16-14 34-22 56-24" />
    </>
  ),
  formal: (
    <>
      <path d="M18 92c0-14 10-24 28-30 20-7 42-8 60-3 12 3 22 9 30 17 8 8 18 13 30 15 8 2 12 7 12 14H22c-4 0-6-3-4-8z" />
      <path d="M10 105h218c5 0 8 3 8 7s-3 6-8 6H18c-5 0-8-2-8-6s1-7 4-7z" />
      <path d="M70 70h40M78 60h34" />
    </>
  ),
  loafers: (
    <>
      <path d="M20 94c2-12 12-22 30-28 22-8 46-8 66-1 10 4 18 10 24 18 8 9 18 14 30 16 6 1 10 5 10 11H24c-6 0-8-8-4-16z" />
      <path d="M10 106h220c5 0 8 3 8 7s-3 7-8 7H18c-5 0-8-3-8-7s2-7 6-7z" />
      <path d="M92 74c12-6 28-6 40 0" />
      <circle cx="112" cy="81" r="4" />
    </>
  ),
  slides: (
    <>
      <path d="M14 92h212c8 0 12 5 12 11s-4 12-12 12H22c-8 0-12-6-12-12s4-11 12-11z" />
      <path d="M64 92c0-18 12-32 30-32s30 14 30 32" />
      <path d="M124 92c0-16 10-28 26-28s26 12 26 28" />
    </>
  ),
  clogs: (
    <>
      <path d="M30 100c-10-8-14-22-8-36 7-16 26-26 50-26 22 0 40 6 54 18 10 8 20 13 32 16 10 2 16 9 16 18 0 4-3 8-8 8H36c-4 0-6-2-6-6z" />
      <path d="M14 107h214c5 0 8 3 8 7s-3 7-8 7H20c-5 0-8-3-8-7s3-7 8-7z" />
      <path d="M56 58c8-6 20-8 32-6" />
    </>
  ),
  boots: (
    <>
      <path d="M46 20h54c7 0 12 5 12 12v44l26 10c10 4 16 12 16 22v6H46z" />
      <path d="M32 110h174c7 0 12 4 12 9s-5 9-12 9H40c-7 0-12-4-12-9s5-9 12-9z" />
      <path d="M46 42h54M46 60h54M46 78h44" />
    </>
  ),
  running: (
    <>
      <path d="M54 96c-4 0-6-4-5-8 2-9 7-18 16-26 11-10 25-16 41-16 13 0 25 4 35 10l16 11c5 4 12 6 19 7l20 3c9 1 16 6 18 13 1 4-2 8-6 8H56z" />
      <path d="M42 104h172c6 0 10 4 10 9s-4 9-10 9H50c-6 0-10-4-10-9s4-9 10-9z" />
      <path d="M66 56l16 12M84 48l18 14M102 44l18 14" />
      <path d="M28 54h18M20 70h22M30 86h16" />
    </>
  ),
  football: (
    <>
      <path d="M52 16h48c7 0 12 5 12 12v34l24 12c12 6 20 14 20 24v6H52z" />
      <path d="M40 104h148c6 0 10 3 10 7s-4 7-10 7H46c-6 0-8-3-8-7s2-7 8-7z" />
      <path d="M58 118v8M84 118v8M110 118v8M136 118v8M162 118v8" />
      <path d="M52 38h48M52 56h40" />
    </>
  ),
  basketball: (
    <>
      <path d="M46 86c0-10 4-18 14-24 10-6 16-14 18-24 2-8 8-14 18-14h28c8 0 12 5 12 12v50l24 10c8 4 14 10 14 18v4H46z" />
      <path d="M32 110h160c6 0 10 3 10 8s-4 8-10 8H40c-6 0-10-3-10-8s4-8 10-8z" />
      <circle cx="200" cy="44" r="20" />
      <path d="M180 44h40M200 24v40M186 30c8 8 8 20 0 28M214 30c-8 8-8 20 0 28" />
    </>
  ),
};

const FALLBACK = ICONS.sneakers;

/** Line-art category icons (decorative — a text label is always provided). */
export default function CategoryIcon({ category, className = '' }: { category: string; className?: string }) {
  const icon = ICONS[category] ?? FALLBACK;
  return (
    <svg
      className={`category-icon ${className}`.trim()}
      viewBox="0 0 240 130"
      aria-hidden="true"
      focusable="false"
    >
      <g fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round">
        {icon}
      </g>
    </svg>
  );
}
