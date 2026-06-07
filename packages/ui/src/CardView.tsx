import { motion } from "framer-motion";
import type { Card } from "@cornerstone3/game";
import bowUrl from "./assets/card-art/bow.png";
import shieldUrl from "./assets/card-art/shield.png";
import swordUrl from "./assets/card-art/sword.png";
import wingedShoeUrl from "./assets/card-art/winged-shoe.png";
import "./cards.css";

const cardArtUrls = {
  bow: bowUrl,
  shield: shieldUrl,
  sword: swordUrl,
  "winged-shoe": wingedShoeUrl
} satisfies Partial<Record<Card["art"], string>>;

export interface CardViewProps {
  readonly card: Card;
  readonly selected?: boolean;
  readonly disabled?: boolean;
  readonly onClick?: (card: Card) => void;
}

function normalizeTag(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function SwordGlyph() {
  return (
    <>
      <path className="cornerstone-card-glyph-metal" d="M60 20 L70 83 L60 105 L50 83 Z" />
      <path className="cornerstone-card-glyph-line" d="M60 28 L60 99" />
      <path className="cornerstone-card-glyph-line" d="M39 103 L81 103" />
      <path className="cornerstone-card-glyph-metal" d="M53 109 L67 109 L65 137 L55 137 Z" />
    </>
  );
}

function ShieldGlyph() {
  return (
    <>
      <path
        className="cornerstone-card-glyph-metal"
        d="M60 18 L96 34 L90 88 C85 113 74 129 60 140 C46 129 35 113 30 88 L24 34 Z"
      />
      <path className="cornerstone-card-glyph-highlight" d="M60 28 L84 39 L80 83 C76 102 70 115 60 125 Z" />
      <path className="cornerstone-card-glyph-line" d="M60 28 L60 125" />
    </>
  );
}

function BowGlyph() {
  return (
    <>
      <path className="cornerstone-card-glyph-line" d="M76 22 C38 39 38 119 76 136" />
      <path className="cornerstone-card-glyph-line" d="M76 22 C96 58 96 100 76 136" />
      <path className="cornerstone-card-glyph-line" d="M76 22 L76 136" />
      <path className="cornerstone-card-glyph-accent" d="M24 79 H82 L70 68 M82 79 L70 90" />
    </>
  );
}

function WingedShoeGlyph() {
  return (
    <>
      <path
        className="cornerstone-card-glyph-metal"
        d="M28 103 C48 110 73 111 95 98 L103 112 C76 129 42 127 20 114 Z"
      />
      <path className="cornerstone-card-glyph-line" d="M46 91 L63 104 M58 87 L75 100" />
      <path className="cornerstone-card-glyph-accent" d="M42 64 C28 49 24 36 25 22 C42 33 52 45 56 62 Z" />
      <path className="cornerstone-card-glyph-highlight" d="M61 65 C55 47 57 33 65 20 C79 37 83 52 78 69 Z" />
    </>
  );
}

function CardGlyph({ card }: { readonly card: Card }) {
  const artUrl = cardArtUrls[card.art];

  if (artUrl !== undefined) {
    return (
      <image
        className="cornerstone-card-art-image"
        href={artUrl}
        x="24"
        y="24"
        width="72"
        height="72"
        preserveAspectRatio="xMidYMid meet"
      />
    );
  }

  return (
    <g className={`cornerstone-card-glyph cornerstone-card-glyph-${card.art}`} transform="translate(0 2)">
      {card.art === "sword" ? <SwordGlyph /> : null}
      {card.art === "shield" ? <ShieldGlyph /> : null}
      {card.art === "bow" ? <BowGlyph /> : null}
      {card.art === "winged-shoe" ? <WingedShoeGlyph /> : null}
    </g>
  );
}

export function CardView({ card, selected = false, disabled = false, onClick }: CardViewProps) {
  const classLabel = card.classTitle ?? card.classId ?? "";
  const classTagValues = new Set([card.classTitle, card.classId].filter((value): value is string => value !== undefined).map(normalizeTag));
  const visibleTags = card.tags?.filter((tag) => !classTagValues.has(normalizeTag(tag))) ?? [];
  const tagsLabel = visibleTags.join(" - ");
  const titleText = [classLabel, tagsLabel, card.longDescription].filter((text) => text.length > 0).join("\n");
  const tapAndHoverProps = disabled
    ? {}
    : {
        whileHover: selected ? {} : { y: -8 },
        whileTap: { scale: 0.96 }
      };

  return (
    <motion.button
      layout
      {...tapAndHoverProps}
      animate={{ scale: selected ? 1.95 : 1, y: selected ? -44 : 0 }}
      className={`cornerstone-card cornerstone-card-${card.art} ${selected ? "is-selected" : ""}`}
      disabled={disabled}
      style={{ zIndex: selected ? 30 : 1 }}
      type="button"
      onClick={() => onClick?.(card)}
      aria-pressed={selected}
      aria-label={card.title}
      title={titleText}
    >
      <svg viewBox="0 0 120 168" role="img" aria-hidden="true">
        <rect x="2" y="2" width="116" height="164" rx="10" />
        <text x="60" y="24" className="cornerstone-card-title" textAnchor="middle">
          {card.title}
        </text>
        {classLabel.length > 0 ? (
          <text x="60" y="36" className="cornerstone-card-class" textAnchor="middle">
            {classLabel}
          </text>
        ) : null}
        <g transform="translate(0 23) scale(0.58)">
          <CardGlyph card={card} />
        </g>
        {tagsLabel.length > 0 ? (
          <foreignObject x="11" y="96" width="98" height="19">
            <p className="cornerstone-card-tags">{tagsLabel}</p>
          </foreignObject>
        ) : null}
        <text x="60" y="122" className="cornerstone-card-short" textAnchor="middle">
          {card.shortDescription}
        </text>
        <foreignObject x="13" y="130" width="94" height="27">
          <p className="cornerstone-card-long">{card.longDescription}</p>
        </foreignObject>
      </svg>
    </motion.button>
  );
}
