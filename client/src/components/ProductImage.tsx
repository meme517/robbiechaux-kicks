import { useEffect, useState } from 'react';
import CategoryIcon from './CategoryIcon';

interface ProductImageProps {
  src?: string | null;
  alt: string;
  category?: string;
  className?: string;
  lazy?: boolean;
  width?: number;
  height?: number;
}

/**
 * Product image with reserved dimensions (no layout shift), lazy loading and a
 * category illustration fallback. It never substitutes an unrelated product photo.
 */
export default function ProductImage({
  src,
  alt,
  category = 'sneakers',
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
        aria-label={`${alt ? `${alt} — ` : ''}${category} illustration, not a product photo`}
      >
        <CategoryIcon category={category} className="product-image__illustration" />
        <span>Illustration only — product photo unavailable</span>
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
