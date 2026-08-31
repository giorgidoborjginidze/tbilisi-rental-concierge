import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/strings";

// A small stack of asset cards receding into depth — the product's whole
// premise in one picture: property, vehicles and digital holdings sitting
// in one place. Hovering (or tapping) fans them apart.
export default async function PortfolioDeck() {
  const locale = await getLocale();

  const cards = [
    { label: t(locale, "land_deck_re"), value: "420,000 ₾", accent: "#5ab0e0" },
    { label: t(locale, "land_deck_car"), value: "32,000 ₾", accent: "#23c185" },
    { label: t(locale, "land_deck_digital"), value: "18,400 ₾", accent: "#f97316" },
  ];

  return (
    <div className="deck3d" aria-hidden>
      <div className="deck3d__stack">
        {cards.map((card, i) => (
          <div
            key={card.label}
            className="deck3d__sheet"
            style={{ "--i": i } as React.CSSProperties}
          >
            <span className="deck3d__dot" style={{ background: card.accent }} />
            <div className="deck3d__label">{card.label}</div>
            <div className="deck3d__value">{card.value}</div>
          </div>
        ))}
      </div>
      <div className="deck3d__total">
        {t(locale, "land_deck_total")} · <strong>470,400 ₾</strong>
      </div>
    </div>
  );
}
