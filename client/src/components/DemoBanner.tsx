/**
 * Persistent note shown while the site runs on demo inventory so no visitor
 * mistakes placeholder products or prices for confirmed store stock.
 */
export default function DemoBanner() {
  return (
    <p className="demo-banner" role="note">
      <strong>Demo catalog.</strong> Product names, images and RWF prices on this site are
      placeholders for design preview — they are not confirmed Robbiechaux Kicks inventory, and no
      order placed from demo data is treated as real.
    </p>
  );
}
