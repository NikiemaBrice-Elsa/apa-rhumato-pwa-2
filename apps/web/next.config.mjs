/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @apa/pdf-report expose sa source TS brute (comme @apa/domain et
  // @apa/rules-engine) : sans transpilePackages, Next.js ne la compile pas.
  transpilePackages: ["@apa/domain", "@apa/rules-engine", "@apa/pdf-report"],
  experimental: {
    // Correctif (07/09/2026, complété le 08/09/2026) : « Échec lors de la
    // génération du rapport PDF » en production sur Vercel.
    //
    // Cause réelle (confirmée via les journaux d'exécution Vercel du
    // 08/09/2026) : pdfkit localise ses fichiers de métriques de polices
    // (*.afm, polices standards Helvetica/Times/Courier) avec
    // `fs.readFileSync(__dirname + "/data/...")`. Or Next.js regroupe
    // (« bundle ») le code de pdfkit directement à l'intérieur du fichier
    // `route.js` de la fonction serverless : une fois regroupé, `__dirname`
    // ne pointe plus vers le dossier de pdfkit dans node_modules mais vers
    // le dossier de la fonction elle-même (ex.
    // `/var/task/apps/web/.next/server/app/api/reports/pdf/`), qui ne
    // contient évidemment pas de sous-dossier `data/`. D'où l'erreur
    // `ENOENT` uniquement en production (en local, `next dev` ne regroupe
    // pas le code de la même façon).
    //
    // `serverComponentsExternalPackages` indique à Next.js de NE PAS
    // regrouper pdfkit et de le laisser en `require("pdfkit")` normal au
    // moment de l'exécution : `__dirname` redevient alors correct (le
    // dossier réel de pdfkit dans node_modules).
    serverComponentsExternalPackages: ["pdfkit"],
    // `outputFileTracingIncludes` reste nécessaire en complément : comme la
    // lecture des fichiers .afm se fait de façon dynamique (pas via
    // `import`/`require` statique), le traceur de fichiers de Next.js
    // (@vercel/nft) ne les détecte pas tout seul et ne les inclurait pas
    // dans le paquet déployé sans cette inclusion explicite.
    outputFileTracingIncludes: {
      "/api/reports/pdf": ["../../node_modules/pdfkit/js/data/**/*"],
    },
  },
};

export default nextConfig;
