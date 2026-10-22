/**
 * Size selector. Renders radio inputs for keyboard/screen-reader support.
 * Unavailable variants (stock 0) are disabled. Provider-listed sizes with
 * unknown local stock can be selected for a WhatsApp availability check.
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
  const available = variants.filter((v) => v.stock !== 0);
  const hasUnconfirmedStock = variants.some((v) => v.stock === null);

  return (
    <fieldset className="size-picker">
      <legend className="size-picker__legend">{legend}</legend>
      <div className="size-picker__options">
        {variants.map((variant) => {
          const id = `${name}-${variant.id}`;
          const selectable = variant.stock !== 0;
          const checked = value === variant.size;
          return (
            <span className="size-picker__item" key={variant.id}>
              <input
                type="radio"
                id={id}
                name={name}
                value={variant.size}
                checked={checked}
                disabled={!selectable}
                onChange={() => onChange(variant.size)}
                className="size-picker__input"
              />
              <label htmlFor={id} className={`size-picker__label ${!selectable ? 'is-unavailable' : ''}`}>
                {variant.size}
                {!selectable && <span className="sr-only"> (unavailable)</span>}
                {variant.stock === null && <span className="sr-only"> (availability unconfirmed)</span>}
              </label>
            </span>
          );
        })}
      </div>
      {hasUnconfirmedStock ? (
        <p className="size-picker__notice">Some listed sizes have not been confirmed by the store. Please ask to check availability.</p>
      ) : available.length === 0 ? (
        <p className="size-picker__notice">No sizes are currently available for this product.</p>
      ) : null}
    </fieldset>
  );
}
