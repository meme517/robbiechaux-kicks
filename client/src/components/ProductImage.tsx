import { useEffect, useState } from 'react';
import CategoryIcon from './CategoryIcon';

interface ProductImageProps {
  src?: string | null;
  providerProductId?: string | null;
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
  providerProductId,
  alt,
  category = 'sneakers',
  className = '',
  lazy = true,
  width = 480,
  height = 360,
}: ProductImageProps) {
  const [imageIndex, setImageIndex] = useState(0);

  useEffect(() => {
    setImageIndex(0);
  }, [src, providerProductId]);

  const localImages = /^shopping-[a-f0-9]+$/i.test(providerProductId ?? '')
    ? ['webp', 'jpg', 'jpeg', 'png'].map(
      (extension) => `/images/products/${providerProductId}.${extension}`,
    )
    : [];
  const imageSources = [
    ...(src && src !== 'unavailable' ? [src] : []),
    ...localImages.filter((image) => image !== src),
  ];
  const imageSrc = imageSources[imageIndex];

  if (!imageSrc) {
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
      src={imageSrc}
      alt={alt}
      width={width}
      height={height}
      loading={lazy ? 'lazy' : 'eager'}
      decoding="async"
      onError={() => setImageIndex((index) => index + 1)}
    />
  );
}
