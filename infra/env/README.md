# Variables d'environnement

Copier `.env.example` vers `apps/web/.env.local` puis renseigner :

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` : disponibles dans le tableau de bord Supabase (Project Settings → API).
- `SUPABASE_SERVICE_ROLE_KEY` : clé serveur uniquement — ne doit jamais être exposée au client ni committée. Utilisée uniquement dans les API routes (ex. tâches d'administration, Sprint 13).

Aucune valeur réelle ne doit être committée dans le dépôt (§45, §46 du cahier des charges — confidentialité et sécurité des comptes).
