import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getDictionary } from "@/lib/i18n";
import { RecoveryRedirect } from "@/components/RecoveryRedirect";
import { ReadAloudButton } from "@/components/ReadAloudButton";

const dict = getDictionary();

export const metadata: Metadata = {
  title: dict.app.name,
  description: dict.app.tagline,
  manifest: "/manifest.webmanifest",
  applicationName: dict.app.name,
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: dict.app.name,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1e4e9e",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <RecoveryRedirect />
        {children}
        <ReadAloudButton />
        <script
          // Enregistrement du service worker (§10). Stratégie de cache
          // complète (§54) : voir public/sw.js, Sprint 12.
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function () {
                  navigator.serviceWorker.register('/sw.js').catch(function () {});
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
