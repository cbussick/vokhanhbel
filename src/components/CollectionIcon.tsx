import type { CollectionIconKey } from "../contracts/collection";
import styles from "./CollectionIcon.module.css";

/**
 * The flags carry their own colours; the default glyph follows the surrounding text colour. Every
 * icon is drawn without element ids so a list may repeat the same icon without duplicating DOM ids.
 */
function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" className={styles.glyph} focusable="false">
      <path d="M12 5v16" />
      <path d="M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z" />
    </svg>
  );
}

function VietnamFlagIcon() {
  return (
    <svg viewBox="0 0 512 512" className={styles.flag} focusable="false">
      <path fill="#da251d" d="M0 0h512v512H0z" />
      <path
        fill="#ff0"
        d="M256 108l33.2 102.3H396.8l-87 63.2 33.2 102.2-87-63.2-87 63.2 33.2-102.2-87-63.2h107.6z"
      />
    </svg>
  );
}

function UnitedKingdomFlagIcon() {
  return (
    <svg viewBox="0 0 512 512" className={styles.flag} focusable="false">
      <path fill="#012169" d="M0 0h512v512H0z" />
      <path
        fill="#fff"
        d="M512 0v64L322 256l190 187v69h-67L254 324 68 512H0v-68l186-187L0 74V0h62l192 188L440 0z"
      />
      <path
        fill="#c8102e"
        d="m184 324 11 34L42 512H0v-3zm124-12 54 8 150 147v45zM512 0 320 196l-4-44L466 0zM0 1l193 189-59-8L0 49z"
      />
      <path fill="#fff" d="M176 0v512h160V0zM0 176v160h512V176z" />
      <path fill="#c8102e" d="M0 208v96h512v-96zM208 0v512h96V0z" />
    </svg>
  );
}

const iconsByKey = {
  book: BookIcon,
  "flag-vn": VietnamFlagIcon,
  "flag-gb": UnitedKingdomFlagIcon,
} as const satisfies Record<CollectionIconKey, () => React.ReactElement>;

export function CollectionIcon({ icon }: { icon: CollectionIconKey }) {
  const Icon = iconsByKey[icon];

  return (
    <span className={styles.frame} aria-hidden="true">
      <Icon />
    </span>
  );
}
