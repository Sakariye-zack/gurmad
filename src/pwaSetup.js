// Makes /portal or /staff installable as a standalone app on the phone it's opened on — Samsung/
// Android via Chrome's "Install app" prompt, iPhone via Safari's "Add to Home Screen". index.html
// is shared by all three apps (Admin, Customer Portal, Staff Portal) at one URL, so the manifest/
// meta tags can't just live in index.html — each portal injects its own at mount instead, and
// removes them on unmount so the two portals never fight over which manifest is active.
export function installPortalPWA({ manifestHref, appleTitle, themeColor = '#3FAE2A', scope }) {
  const created = [];

  const addLink = (rel, href, extra = {}) => {
    const el = document.createElement('link');
    el.rel = rel;
    el.href = href;
    Object.entries(extra).forEach(([k, v]) => el.setAttribute(k, v));
    document.head.appendChild(el);
    created.push(el);
  };
  const addMeta = (name, content) => {
    const el = document.createElement('meta');
    el.name = name;
    el.content = content;
    document.head.appendChild(el);
    created.push(el);
  };

  addLink('manifest', manifestHref);
  addLink('apple-touch-icon', '/favicon.png');
  addMeta('theme-color', themeColor);
  addMeta('apple-mobile-web-app-capable', 'yes');
  addMeta('apple-mobile-web-app-status-bar-style', 'black-translucent');
  addMeta('apple-mobile-web-app-title', appleTitle);
  addMeta('mobile-web-app-capable', 'yes');

  // Chrome/Samsung Internet require an active service worker before they'll offer the install
  // prompt at all; iOS's Add to Home Screen doesn't need one, but registering is harmless there.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js', { scope }).catch(() => {
      // Not fatal — Add to Home Screen (iOS) and the manual "Install" menu item (desktop Chrome)
      // still work without an active service worker; only the automatic Android install banner
      // needs it.
    });
  }

  return () => created.forEach(el => el.remove());
}
