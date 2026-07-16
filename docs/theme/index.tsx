// Custom theme entry. Keeps the whole original theme and adds a site footer
// with the author credit and a Ko-fi link, wired through the Layout `bottom`
// slot. See https://rspress.rs/guide/basic/custom-theme
import './index.css';
import { Layout as OriginalLayout } from '@rspress/core/theme-original';

export * from '@rspress/core/theme-original';

function SiteFooter() {
  return (
    <footer
      style={{
        borderTop: '1px solid var(--rp-c-divider-light)',
        padding: '28px 24px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px 20px',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontFamily: 'var(--rp-font-family-mono)',
        fontSize: '0.78rem',
        letterSpacing: '0.04em',
        color: 'var(--rp-c-text-2)',
      }}
    >
      <span>
        Developed by{' '}
        <a
          href="https://abdulkadersafi.com"
          target="_blank"
          rel="noreferrer"
          style={{ color: 'var(--rp-c-text-1)' }}
        >
          Abdulkader Safi
        </a>
      </span>
      <a
        href="https://ko-fi.com/abdulkadersafi"
        target="_blank"
        rel="noreferrer"
        style={{ color: 'var(--rp-c-brand)' }}
      >
        Buy me a coffee →
      </a>
    </footer>
  );
}

export function Layout() {
  return <OriginalLayout bottom={<SiteFooter />} />;
}
