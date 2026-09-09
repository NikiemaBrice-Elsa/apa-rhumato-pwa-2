-- Sprint 15 (09/09/2026) : nouvelle périodicité « trimestrielle », à la
-- demande du Dr Nikiema, qui souhaite remplacer l'offre annuelle par une
-- offre trimestrielle. Le plan `premium_yearly` est conservé tel quel comme
-- identifiant technique (clé primaire référencée par `subscriptions.plan_code`)
-- pour ne rien casser côté souscriptions déjà existantes ; seuls son libellé,
-- son prix et sa périodicité changent (voir aussi packages/domain/src/
-- subscriptions.ts, dont le commentaire documente ce choix).

alter table public.subscription_plans
  drop constraint if exists subscription_plans_billing_period_check;

alter table public.subscription_plans
  add constraint subscription_plans_billing_period_check
  check (billing_period in ('monthly', 'quarterly', 'yearly'));

update public.subscription_plans
set
  price_amount = 5000,
  payment_instructions_fr = 'Effectuez un transfert de 5 000 FCFA au nom de NIKIEMA Brice : via Orange Money au +226 76 01 03 06, ou via Moov Money au +226 62 15 22 46. Une fois le transfert effectue, indiquez ci-dessous la reference de la transaction fournie par votre operateur. Votre abonnement sera active apres verification par notre equipe.',
  updated_at = now()
where plan_code = 'premium_monthly';

update public.subscription_plans
set
  name_fr = 'Premium (trimestriel)',
  price_amount = 10000,
  billing_period = 'quarterly',
  updated_at = now()
where plan_code = 'premium_yearly';
