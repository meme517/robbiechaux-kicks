import { useState } from 'react';
import { storeConfig } from '../config/storeConfig';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
  className?: string;
}

/**
 * Logo area used in the header and footer.
 * Reads storeConfig.logoPath (drop-in file: public/images/logo.png). When the
 * file is missing the component renders an intentionally designed monogram —
 * a broken-image icon must never appear. The store name stays visible.
 */
export default function Logo({ size = 'md', showName = true, className = '' }: LogoProps) {
  const [failed, setFailed] = useState(false);
  const dims = size === 'lg' ? 56 : size === 'sm' ? 36 : 44;

  return (
    <span className={`logo logo--${size} ${className}`.trim()}>
      {failed ? (
        <span
          className="logo__placeholder"
          style={{ width: dims, height: dims }}
          role="img"
          aria-label={`${storeConfig.storeName} logo placeholder`}
        >
          <svg viewBox="0 0 64 64" width={dims} height={dims} aria-hidden="true" focusable="false">
            <rect width="64" height="64" rx="14" fill="#f5b301" />
            <text
              x="32"
              y="42"
              textAnchor="middle"
              fontFamily="Archivo, Arial, sans-serif"
              fontWeight="900"
              fontSize="26"
              fill="#0e0e0e"
            >
              RK
            </text>
          </svg>
        </span>
      ) : (
        <img
          className="logo__img"
          src={storeConfig.logoPath}
          width={dims}
          height={dims}
          alt=""
          onError={() => setFailed(true)}
        />
      )}
      {showName && <span className="logo__name">{storeConfig.storeName}</span>}
    </span>
  );
}
