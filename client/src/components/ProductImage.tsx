import { useEffect, useState } from 'react';

interface ProductImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  lazy?: boolean;
  width?: number;
  height?: number;
}

/**
 * Product image with reserved dimensions (no layout shift), lazy loading and a
 * neutral "Image unavailable" fallback. Never substitutes an unrelated shoe.
 */
export default function ProductImage({
  src,
  alt,
  className = '',
  lazy = true,
  width = 480,
  height = 360,
}: ProductImageProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || src === 'unavailable' || failed) {
    return (
      <div
        className={`product-image product-image--fallback ${className}`.trim()}
        style={{ aspectRatio: `${width} / ${height}` }}
        role="img"
        aria-label={alt ? `${alt} — image unavailable` : 'Image unavailable'}
      >
        <svg viewBox="0 0 24 24" width="40" height="40" aria-hidden="true" focusable="false">
          <rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M3 16l5-4 4 3 3-2 6 5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="9" cy="10" r="1.5" fill="currentColor" />
        </svg>
        <span>Image unavailable</span>
      </div>
    );
  }

  return (
    <img
      className={`product-image ${className}`.trim()}
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading={lazy ? 'lazy' : 'eager'}
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
