import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ledger — own the hour",
  description:
    "An offline-first daily planner. Tasks, rituals, focus sessions and a streak — everything stays on your device.",
  applicationName: "Ledger",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Ledger",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0e0f12",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* critical shell styles — the page is never a white void, even mid-load */}
        <style>{`html,body{background:#060708;color:#ece9e0;margin:0;min-height:100%}html[data-theme="light"],html[data-theme="light"] body{background:#f1efe9;color:#23262b}`}</style>
        {/* apply saved theme before first paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var p=JSON.parse(localStorage.getItem('ledger-ui-v1')||'{}');if(p.theme==='light'){document.documentElement.dataset.theme='light';}if(p.motion==='reduced'){document.documentElement.dataset.motion='reduced';}}catch(e){}})();`,
          }}
        />
        {/* boot watchdog — if hashed assets ever 404 behind a stale cache,
            force one cache-busting reload instead of showing a dead shell */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var k='ledger-reboot';var last=Number(sessionStorage.getItem(k)||0);
if(Date.now()-last<10000){return;}
window.__ledger_boot_timer=setTimeout(function(){if(!window.__ledger_booted){sessionStorage.setItem(k,String(Date.now()));location.reload();}},6000);
}catch(e){}})();`,
          }}
        />
      </head>
      <body className="antialiased">
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        {children}
      </body>
    </html>
  );
}
