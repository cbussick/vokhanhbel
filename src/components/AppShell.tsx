import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { type ReactNode, useRef, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { statsQuery } from "../lib/queries";
import { useReviewSubmissions } from "../state/ReviewSubmissionContext";
import { ConnectivityBanner } from "./ConnectivityBanner";
import styles from "./AppShell.module.css";

interface AppShellProps {
  children: ReactNode;
  title: string;
  variant?: "standard" | "focused";
}

const desktopLayoutQuery = "(min-width: 64rem)";

function subscribeToDesktopLayout(onChange: () => void) {
  const query = window.matchMedia(desktopLayoutQuery);
  query.addEventListener("change", onChange);

  return () => query.removeEventListener("change", onChange);
}

function getDesktopLayoutSnapshot() {
  return window.matchMedia(desktopLayoutQuery).matches;
}

function useDesktopLayout() {
  return useSyncExternalStore(subscribeToDesktopLayout, getDesktopLayoutSnapshot, () => false);
}

function PrimaryNavigation({ className }: { className: string | undefined }) {
  const { t } = useTranslation();

  return (
    <nav className={className} aria-label={t("accessibility.menu")}>
      <Link to="/review" preload={false} activeProps={{ "aria-current": "page" }}>
        <span className={styles.navIcon} aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <rect x="3" y="6.5" width="14" height="15" rx="3" />
            <path d="M8.5 3h9A3.5 3.5 0 0 1 21 6.5V16" />
          </svg>
        </span>
        <span className={styles.navLabel}>{t("nav.review")}</span>
      </Link>
      <Link to="/cards" preload={false} activeProps={{ "aria-current": "page" }}>
        <span className={styles.navIcon} aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <rect x="3" y="4.5" width="18" height="15" rx="3.5" />
            <path d="M7.5 10h9M7.5 14h6" />
          </svg>
        </span>
        <span className={styles.navLabel}>{t("nav.cards")}</span>
      </Link>
      <Link to="/me" preload={false} activeProps={{ "aria-current": "page" }}>
        <span className={styles.navIcon} aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="m12 2.8 2.8 5.6 6.2.9-4.5 4.4 1.1 6.2L12 17l-5.6 2.9 1.1-6.2L3 9.3l6.2-.9Z" />
          </svg>
        </span>
        <span className={styles.navLabel}>{t("nav.me")}</span>
      </Link>
    </nav>
  );
}

function PointsBadge({ points }: { points: number }) {
  const { t } = useTranslation();

  return (
    <span className={styles.points} role="img" aria-label={t("shell.points", { count: points })}>
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="m12 2.8 2.8 5.6 6.2.9-4.5 4.4 1.1 6.2L12 17l-5.6 2.9 1.1-6.2L3 9.3l6.2-.9Z" />
      </svg>
      <span aria-hidden="true">{points}</span>
    </span>
  );
}

export function AppShell({ children, title, variant = "standard" }: AppShellProps) {
  const { t } = useTranslation();
  const desktopLayout = useDesktopLayout();
  const { submissionSync } = useReviewSubmissions();
  const stats = useQuery(statsQuery);
  const mainRef = useRef<HTMLElement>(null);
  const points = (stats.data?.totalPoints ?? 0) + submissionSync.optimisticPoints;

  const focusMainContent = () => {
    const main = mainRef.current;

    if (!main) return;

    main.tabIndex = -1;
    main.focus();
    main.addEventListener("blur", () => main.removeAttribute("tabindex"), { once: true });
  };

  return (
    <div className={styles.viewport}>
      <a className={styles.skip} href="#main-content" onClick={focusMainContent}>
        {t("accessibility.skip")}
      </a>
      <div className={`${styles.app} ${variant === "focused" ? styles.focused : ""}`}>
        <div className={styles.connectivity}>
          <ConnectivityBanner />
        </div>
        {variant === "standard" && (
          <>
            {desktopLayout && (
              <aside className={styles.desktopSidebar}>
                <div className={styles.brand}>{t("appName")}</div>
                <PrimaryNavigation className={styles.desktopNav} />
                <PointsBadge points={points} />
              </aside>
            )}
            <header className={styles.header}>
              <h1>{title}</h1>
              {!desktopLayout && <PointsBadge points={points} />}
            </header>
          </>
        )}
        <main ref={mainRef} id="main-content" className={styles.main}>
          {variant === "focused" && <h1>{title}</h1>}
          {children}
        </main>
        {variant === "standard" && !desktopLayout && (
          <PrimaryNavigation className={styles.mobileNav} />
        )}
      </div>
    </div>
  );
}
