-- Sprint 14 : abonnements et paiements (§44, §47, §48).
--
-- §47 : « Ne pas coder un système de paiement fictif. » Aucune passerelle
-- externe n'est appelée par ce projet (voir packages/payment-service) : le
-- mécanisme réel du V1 est une réconciliation MANUELLE — le patient
-- transfère via Mobile Money/Orange Money/Moov Money selon les instructions
-- du plan, saisit la référence de transaction reçue, et un administrateur
-- confirme le paiement dans `/admin/abonnements` avant d'activer la
-- souscription. RLS reflète strictement ce circuit à humain dans la
-- boucle : un patient peut UNIQUEMENT créer des lignes à l'état `pending`
-- (jamais `active`/`confirmed`), jamais les faire progresser lui-même.
--
-- §46, leçon du Sprint 13 : la faille corrigée en migration 0010 (un
-- utilisateur pouvait modifier son propre `role`/`status` via la policy
-- `users_update_own`, sans restriction de colonne) est de la MÊME FAMILLE
-- qu'un patient qui s'auto-activerait un abonnement premium. Ici, la
-- prévention est plus simple qu'un trigger : aucune policy UPDATE
-- n'existe pour `authenticated` sur `subscriptions`/`payments`, et les
-- policies INSERT contraignent explicitement `status = 'pending'` — un
-- patient ne peut donc structurellement jamais écrire autre chose qu'une
-- demande en attente, quelle que soit la valeur qu'il tenterait d'envoyer.

create table if not exists public.subscription_plans (
  plan_code text primary key check (plan_code in ('free', 'premium_monthly', 'premium_yearly')),
  name_fr text not null,
  -- §48 : « Ces prix sont des paramètres configurables et non des valeurs
  -- codées en dur. » Null uniquement pour 'free' (garde-fou applicatif :
  -- isValidPlanPricing, packages/domain/src/subscriptions.ts).
  price_amount numeric(10, 2),
  price_currency text not null default 'XOF',
  billing_period text check (billing_period in ('monthly', 'yearly')),
  payment_instructions_fr text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  plan_code text not null references public.subscription_plans (plan_code),
  status text not null default 'pending' check (status in ('pending', 'active', 'expired', 'canceled')),
  started_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  provider text not null check (provider in ('orange_money', 'moov_money', 'mobile_money', 'manual')),
  amount numeric(10, 2) not null check (amount > 0),
  currency text not null default 'XOF',
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'failed', 'refunded')),
  external_reference text,
  recorded_by uuid references public.users (id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_subscriptions_user on public.subscriptions (user_id);
create index if not exists idx_payments_user on public.payments (user_id);
create index if not exists idx_payments_status on public.payments (status);

alter table public.subscription_plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;

-- Tarifs publics une fois authentifié (nécessaire pour afficher l'écran
-- « Mon abonnement ») ; écriture réservée à service_role (admin).
create policy "subscription_plans_read_authenticated" on public.subscription_plans
  for select using (auth.role() = 'authenticated');

create policy "subscriptions_select_own" on public.subscriptions
  for select using (auth.uid() = user_id);

-- Un patient peut demander un plan (statut `pending` forcé) ; il ne peut
-- JAMAIS l'activer lui-même : aucune policy UPDATE n'existe ici pour
-- `authenticated`, l'activation passe exclusivement par service_role
-- (voir apps/web/src/app/api/admin/subscriptions/[id]/route.ts).
create policy "subscriptions_insert_own_pending" on public.subscriptions
  for insert with check (auth.uid() = user_id and status = 'pending');

create policy "payments_select_own" on public.payments
  for select using (auth.uid() = user_id);

-- Même principe : le patient déclare un paiement (`pending`), jamais son
-- issue (`confirmed`/`failed`/`refunded`), qui reste une décision humaine
-- administrateur après vérification réelle du transfert Mobile Money.
create policy "payments_insert_own_pending" on public.payments
  for insert with check (auth.uid() = user_id and status = 'pending');
