/**
 * Size selector. Renders radio inputs for keyboard/screen-reader support.
 * Unavailable variants (stock 0) are disabled and cannot be selected, so an
 * unavailable size can never reach the cart.
 */
import type { Variant } from '../types/product';

interface SizePickerProps {
  variants: Variant[];
  value: string | null;
  onChange: (size: string) => void;
  name?: string;
  legend?: string;
}

export default function SizePicker({
  variants,
  value,
  onChange,
  name = 'size',
  legend = 'Select a size',
}: SizePickerProps) {
  const available = variants.filter((v) => v.stock > 0);

  return (
    <fieldset className="size-picker">
      <legend className="size-picker__legend">{legend}</legend>
      <div className="size-picker__options">
        {variants.map((variant) => {
          const id = `${name}-${variant.id}`;
          const inStock = variant.stock > 0;
          const checked = value === variant.size;
          return (
            <span className="size-picker__item" key={variant.id}>
              <input
                type="radio"
                id={id}
                name={name}
                value={variant.size}
                checked={checked}
                disabled={!inStock}
                onChange={() => onChange(variant.size)}
                className="size-picker__input"
              />
              <label htmlFor={id} className={`size-picker__label ${!inStock ? 'is-unavailable' : ''}`}>
                {variant.size}
                {!inStock && <span className="sr-only"> (unavailable)</span>}
              </label>
            </span>
          );
        })}
      </div>
      {available.length === 0 && (
        <p className="size-picker__notice">No sizes are currently available for this product.</p>
      )}
    </fieldset>
  );
}
