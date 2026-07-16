// Custom theme entry. Keeps the whole original theme and adds a site footer
// with the author credit and a Ko-fi link, wired through the Layout `bottom`
// slot. See https://rspress.rs/guide/basic/custom-theme
import './index.css';
import { Layout as OriginalLayout } from '@rspress/core/theme-original';

export * from '@rspress/core/theme-original';

function SiteFooter() {
  return (
    <footer className="site-footer">
      <span>
        Developed by{' '}
        <a
          className="site-footer__name"
          href="https://abdulkadersafi.com"
          target="_blank"
          rel="noreferrer"
        >
          Abdulkader Safi
        </a>
      </span>
      <a
        className="site-footer__kofi"
        href="https://ko-fi.com/abdulkadersafi"
        target="_blank"
        rel="noreferrer"
      >
        Buy me a coffee →
      </a>
    </footer>
  );
}

export function Layout() {
  return <OriginalLayout bottom={<SiteFooter />} />;
}
