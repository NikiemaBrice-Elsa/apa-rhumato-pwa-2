"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Tableau de bord" },
  { href: "/admin/utilisateurs", label: "Utilisateurs" },
  { href: "/admin/pathologies", label: "Pathologies" },
  { href: "/admin/exercices", label: "Exercices" },
  { href: "/admin/programmes", label: "Programmes" },
  { href: "/admin/regles-cliniques", label: "Règles cliniques" },
  { href: "/admin/references", label: "Références scientifiques" },
  { href: "/admin/rapport-scientifique", label: "Rapport scientifique" },
  { href: "/admin/notifications", label: "Notifications" },
  { href: "/admin/audit", label: "Journal d'audit" },
  { href: "/admin/abonnements", label: "Abonnements" },
];

/** §42 : navigation de l'espace administrateur — un lien par fonction listée
 * dans le cahier des charges, plus un lien de retour explicite vers le
 * tableau de bord patient (demande du 09/09/2026 : aucun moyen de quitter
 * l'espace admin n'existait auparavant — ni bouton retour, ni lien vers le
 * reste de l'application depuis les pages internes comme « Abonnements »,
 * « Utilisateurs », etc.). */
export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex shrink-0 flex-row flex-wrap gap-2 lg:w-56 lg:flex-col">
      <Link
        href="/tableau-de-bord"
        className="mb-2 flex items-center gap-1 rounded-lg border border-primary-300 px-3 py-2 text-sm font-medium text-primary-700 hover:bg-primary-100 lg:w-full"
      >
        ← Retour au tableau de bord
      </Link>
      {LINKS.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              active ? "bg-primary-700 text-white" : "text-primary-700 hover:bg-primary-100"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
