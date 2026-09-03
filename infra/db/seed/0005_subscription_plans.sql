-- Sprint 14 (§48) : modèle économique initial. Ces montants sont les prix
-- « envisagés initialement » par le cahier des charges — des PARAMÈTRES,
-- pas des valeurs codées en dur (§48) : modifiables à tout moment depuis
-- `/admin/abonnements`, sans déploiement de code.
--
-- `payment_instructions_fr` est laissé NULL volontairement : ce projet ne
-- dispose d'aucun numéro Mobile Money/Orange Money/Moov Money réel à
-- afficher aux patients (§57/§59, discipline étendue ici aux données
-- produit : ne jamais inventer une coordonnée de paiement qui semblerait
-- officielle). Le concepteur/porteur du projet doit renseigner ce champ
-- avant d'ouvrir les inscriptions premium — voir docs/MEDICAL_VALIDATION_NEEDED.md.
insert into public.subscription_plans (plan_code, name_fr, price_amount, price_currency, billing_period, payment_instructions_fr, active) values
  ('free', 'Gratuit', null, 'XOF', null, null, true),
  ('premium_monthly', 'Premium (mensuel)', 2000, 'XOF', 'monthly', null, true),
  ('premium_yearly', 'Premium (annuel)', 10000, 'XOF', 'yearly', null, true)
on conflict (plan_code) do nothing;
