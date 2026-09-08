/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @apa/pdf-report expose sa source TS brute (comme @apa/domain et
  // @apa/rules-engine) : sans transpilePackages, Next.js ne la compile pas.
  transpilePackages: ["@apa/domain", "@apa/rules-engine", "@apa/pdf-report"],
  experimental: {
    // Correctif (07/09/2026) : « Échec lors de la génération du rapport PDF »
    // en production sur Vercel. Cause : pdfkit lit ses fichiers de métriques
    // de polices (*.afm, polices standards Helvetica/Times/Courier) via `fs`
    // au moment de l'exécution, pas via `import`/`require` statique. Le
    // traceur de fichiers de Next.js (@vercel/nft) ne peut donc pas détecter
    // ces lectures dynamiques et n'inclut pas ces fichiers dans le paquet de
    // la fonction serverless déployée — d'où un succès en local (`next dev`,
    // système de fichiers complet) mais un échec une fois déployé. On force
    // ici l'inclusion explicite de ce dossier pour la route concernée.
    outputFileTracingIncludes: {
      "/api/reports/pdf": ["../../node_modules/pdfkit/js/data/**/*"],
    },
  },
};

export default nextConfig;
