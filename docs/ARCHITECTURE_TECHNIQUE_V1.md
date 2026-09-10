**ARCHITECTURE TECHNIQUE V1**

**Application PWA d\'Activités Physiques Adaptées à la Santé en
Rhumatologie**

*Document produit en réponse à la « Première consigne à Claude » (§80 du
cahier des charges V1.0)*

  ------------------------- ---------------------------------------------
  **Concepteur médical et   Dr Wendtongo Brice Florent NIKIEMA, médecin
  scientifique**            rhumatologue

  **Développeur IA**        Claude

  **Document de référence** Cahier des charges complet --- V1.0

  **Statut**                Proposition d\'architecture --- en attente de
                            validation avant développement

  **Date**                  18 août 2026
  ------------------------- ---------------------------------------------

1\. Objet du document et méthode

Conformément à la « Première consigne à Claude » (§80), ce document
constitue le premier livrable du projet, avant toute écriture de code
applicatif ou de règle médicale. Il répond point par point à la demande
: proposer l\'architecture technique, proposer la structure de la base
de données, proposer l\'arborescence du projet, et identifier les
paramètres médicaux nécessitant encore une validation.

Ce document ne contient aucune recommandation médicale nouvelle, aucun
seuil clinique, aucune contre-indication et aucun contenu d\'exercice.
Il se limite strictement aux choix techniques et structurels.
Conformément à la règle absolue du §57 et du §59, toute information
médicale non explicitement fournie dans le cahier des charges est
signalée ici comme nécessitant une validation, et non supposée ou
inventée.

Le développement du moteur de personnalisation et des programmes
médicaux ne commencera qu\'après validation de ce document et des
paramètres listés en section 6.

2\. Rappel des principes directeurs retenus pour guider les arbitrages

Tous les choix d\'architecture ci-dessous respectent l\'ordre de
priorité absolu défini au §78 du cahier des charges :

-   1\. Sécurité du patient

-   2\. Exactitude scientifique

-   3\. Respect du cahier des charges médical

-   4\. Confidentialité

-   5\. Fiabilité technique

-   6\. Simplicité d\'utilisation

-   7\. Performance

-   8\. Esthétique

-   9\. Monétisation

-   10\. Fonctionnalités avancées

En particulier, la sécurité du patient et l\'exactitude scientifique
priment sur toute considération de performance, d\'esthétique ou de
monétisation --- y compris dans les choix d\'architecture eux-mêmes (ex.
: le moteur de règles est déterministe et auditable plutôt qu\'opaque ou
probabiliste, §30).

3\. Architecture technique proposée

3.1 Vue d\'ensemble

L\'application est structurée comme un monorepo TypeScript comportant
une application web PWA (frontend + API routes) et plusieurs packages
partagés, dont un moteur de règles médicales isolé et testable
indépendamment de l\'interface. Cette séparation permet de faire évoluer
les règles cliniques (versionnées, validées, traçables) sans toucher à
l\'interface, et inversement.

+-----------------------------------------------------------------------+
| **Choix structurant**                                                 |
|                                                                       |
| Le moteur de personnalisation (§30, §31) est un module « pur » séparé |
| du reste de l\'application : il prend en entrée un profil et des      |
| règles versionnées, et produit une sortie déterministe. Aucun appel à |
| une IA générative n\'intervient dans la décision de prescription,     |
| conformément au §30 et au §59.                                        |
+-----------------------------------------------------------------------+

3.2 Frontend

-   Next.js (React) + TypeScript, App Router --- permet à la fois le
    rendu des pages et l\'hébergement des API routes dans un seul
    projet, ce qui simplifie le déploiement (§9).

-   Interface mobile-first, responsive, conforme aux exigences
    d\'accessibilité du §50 (textes larges, boutons larges, contraste
    suffisant, icônes + texte).

-   Bibliothèque de composants minimaliste et « médicale » plutôt que «
    fitness » (§49), sans dépendance graphique lourde.

-   Système d\'internationalisation (i18n) dès la V1 : aucun texte
    n\'est codé en dur dans les composants ; tous les libellés passent
    par des fichiers de traduction (fr en V1, structure prête pour en et
    langues nationales du Burkina Faso, §53).

-   Génération du manifeste PWA (icônes, écran d\'accueil) et
    enregistrement du service worker (§10).

3.3 Backend / API

-   API routes Next.js exposées en HTTPS uniquement, avec validation
    systématique côté serveur (jamais de confiance uniquement dans le
    frontend, §46).

-   Contrôle d\'accès par rôle (patient / professionnel /
    administrateur) appliqué au niveau du middleware et de chaque route
    (§42, §45, §46).

-   Le moteur de règles (package rules-engine) est appelé côté serveur
    uniquement : les règles médicales et leurs seuils ne sont jamais
    exposés tels quels au client.

-   Toute action sensible (connexion, export de données, suppression de
    compte, modification d\'une règle médicale) est journalisée dans
    audit_logs (§45).

3.4 Base de données

-   Supabase (PostgreSQL managé) recommandé en premier choix : base
    relationnelle structurée adaptée à l\'intégrité des données de
    santé, authentification intégrée, stockage de fichiers
    (vidéos/audio), et compatible avec un hébergement peu coûteux (§9).

-   Firebase reste une alternative technique si une contrainte de projet
    l\'impose, mais une base relationnelle est préférable ici compte
    tenu du grand nombre de relations entre entités (profils, règles,
    programmes, séances, mesures).

-   Chiffrement en transit (TLS) systématique et chiffrement au repos
    activé lorsque le fournisseur le permet (§45).

3.5 Hébergement et déploiement

-   Vercel pour l\'application Next.js (déploiement continu, adapté aux
    PWA), ou Netlify en alternative.

-   Variables d\'environnement séparées par environnement
    (développement, recette, production) --- voir infra/env/.env.example
    dans l\'arborescence.

-   Aucun secret ni clé API dans le code source versionné.

3.6 PWA et mode hors connexion

-   Service worker avec stratégie de cache differenciée : interface
    applicative en cache-first, contenu médical (exercices, programmes
    actifs, vidéos sélectionnées) mis en cache explicitement après
    téléchargement (§54).

-   Stockage local temporaire (IndexedDB) pour les données saisies hors
    connexion (feedback de séance, mesures), avec file d\'attente de
    synchronisation dès le retour de connexion.

-   Gestion des conflits de synchronisation par horodatage + règle « la
    donnée la plus récente et la plus complète l\'emporte », avec
    conservation d\'un journal en cas de conflit non résolu
    automatiquement (§54).

3.7 Moteur de règles médicales (architecture, pas de contenu médical)

Le moteur de règles est un évaluateur déterministe de type « moteur de
règles métier » : chaque règle clinique (table clinical_rules) est une
donnée versionnée, pas du code. Le moteur lit les règles actives
correspondant à une pathologie, évalue leurs conditions sur le profil et
les réponses de l\'utilisateur, et produit une décision explicable
(programme proposé, statut de sécurité, message).

SI pathologie = arthrose_genou

ET niveau = débutant

ET screening = vert

ET douleur dans la plage autorisée

ALORS programme = OA_GENOU_DEBUTANT_01

Cette structure (reprise directement du §30) permet de modifier un seuil
médical en éditant une donnée dans clinical_rules --- sans redéploiement
de code --- et de conserver un historique de version pour audit
scientifique (§65, §66). Chaque décision du moteur enregistre la version
de règle utilisée (champ engine_version dans clinical_assessments).

3.8 Paiement

Le paiement est abstrait derrière une interface PaymentService, sans
implémentation de paiement fictif (§47). Les fournisseurs Orange Money,
Moov Money, Mobile Money ou autres pourront être connectés
ultérieurement comme implémentations de cette interface, sans changer le
reste de l\'application. Les tarifs (2 000 FCFA/mois, 10 000 FCFA/an,
§48) sont stockés comme paramètres configurables en base, jamais codés
en dur.

3.9 Sécurité, confidentialité et conformité

-   Mots de passe hashés (argon2/bcrypt) ou authentification déléguée
    sécurisée.

-   Accès par rôle et principe du moindre privilège à chaque couche
    (API, base de données).

-   Aucune donnée médicale en clair dans les logs publics (§45) ; les
    audit_logs stockent des identifiants et actions, pas de contenu
    clinique.

-   Export et suppression de compte disponibles pour l\'utilisateur
    (droit à la portabilité et à l\'effacement).

-   Politique de confidentialité et conditions d\'utilisation présentées
    avant toute collecte de données sensibles (texte juridique final à
    faire relire par un professionnel compétent avant commercialisation,
    §72).

4\. Schéma de base de données proposé

Le schéma ci-dessous couvre, au minimum, les entités listées au §44 du
cahier des charges, en reprenant explicitement les champs imposés par
les sections dédiées (fiche exercice §26, moteur de règles §31,
bibliothèque scientifique §32, versionning §43/§66, structure de
programme §67). Des tables de jointure et une table de versionning de la
base médicale ont été ajoutées pour respecter les contraintes de
traçabilité et d\'évolutivité du §63 et du §65, sans introduire de
contenu médical.

users

*Comptes utilisateurs (patients, professionnels futurs,
administrateurs).*

  ----------------------------------------------------------------------------------------
  **Champ**                             **Type**        **Notes**
  ------------------------------------- --------------- ----------------------------------
  user_id                               UUID (PK)       Identifiant unique.

  first_name                            string          Prénom (obligatoire).

  last_name                             string,         Nom (facultatif, §12).
                                        nullable        

  birth_date                            date, nullable  Âge/date de naissance (§12).

  sex                                   enum, nullable  Sexe déclaré.

  email                                 string,         Facultatif (§12).
                                        nullable,       
                                        unique          

  phone                                 string,         Facultatif (§12).
                                        nullable,       
                                        unique          

  password_hash                         string,         Hashé (bcrypt/argon2) si auth par
                                        nullable        mot de passe (§46).

  auth_provider                         enum            password \| magic_link \| oauth
                                                        (extensible).

  role                                  enum            patient \| professional \| admin
                                                        (§41, §42).

  locale                                string          Langue préférée, ex. fr (§53,
                                                        i18n).

  consent_terms_accepted_at             timestamp,      Consentement CGU (§12).
                                        nullable        

  consent_data_processing_accepted_at   timestamp,      Consentement traitement des
                                        nullable        données (§12, §45).

  status                                enum            active \| suspended \| deleted.

  deleted_at                            timestamp,      Suppression de compte (§45).
                                        nullable        

  created_at / updated_at               timestamp       Horodatage standard.
  ----------------------------------------------------------------------------------------

patient_profiles

*Profil santé déclaratif du patient (§13).*

  ---------------------------------------------------------------------------------
  **Champ**                 **Type**             **Notes**
  ------------------------- -------------------- ----------------------------------
  profile_id                UUID (PK)            

  user_id                   UUID (FK users)      

  height_cm                 numeric, nullable    

  weight_kg                 numeric, nullable    Valeur courante ; historique dans
                                                 measurements.

  bmi                       numeric, calculé     IMC = poids / taille² (§35). Champ
                                                 dérivé, recalculé, jamais
                                                 interprété comme diagnostic.

  waist_circumference_cm    numeric, nullable    

  physical_activity_level   enum 1-5             Niveau initial (§23).

  main_pathology_id         UUID (FK             §14 Bloc A.
                            pathologies)         

  objectives                table de jointure    Un ou plusieurs objectifs (§22).
                            patient_objectives   

  functional_limitations    text, nullable       

  pain_baseline             int 0-10, nullable   

  fatigue_baseline          int 0-10, nullable   

  track_cardio_params       boolean              Opt-in suivi tension/glycémie
                                                 (§13, §37, §38).

  created_at / updated_at   timestamp            
  ---------------------------------------------------------------------------------

patient_other_pathologies

*Table de jointure : comorbidités déclarées (§13 « autres pathologies
»).*

  ---------------------------------------------------------------------------
  **Champ**            **Type**            **Notes**
  -------------------- ------------------- ----------------------------------
  id                   UUID (PK)           

  profile_id           UUID (FK            
                       patient_profiles)   

  pathology_id         UUID (FK            
                       pathologies)        

  notes                text, nullable      
  ---------------------------------------------------------------------------

pathologies

*Table de référence des pathologies prises en charge (§7). Conçue pour
être étendue sans migration lourde.*

  -----------------------------------------------------------------------
  **Champ**            **Type**        **Notes**
  -------------------- --------------- ----------------------------------
  pathology_id         UUID (PK)       

  code                 string, unique  Ex. LOMBALGIE_COMMUNE,
                                       ARTHROSE_GENOU, ARTHROSE_HANCHE,
                                       POLYARTHRITE_RHUMATOIDE,
                                       SPONDYLOARTHRITE_AXIALE,
                                       OSTEOPOROSE.

  name_fr              string          

  description          text            

  module_version       string          Version du module médical (lié à
                                       §66).

  active               boolean         Permet de désactiver une
                                       pathologie sans la supprimer (§7 :
                                       pas d\'ajout sans validation).

  created_at /         timestamp       
  updated_at                           
  -----------------------------------------------------------------------

clinical_assessments

*Évaluations initiales, réévaluations et dépistage de sécurité (§14,
§15).*

  ------------------------------------------------------------------------------
  **Champ**                   **Type**        **Notes**
  --------------------------- --------------- ----------------------------------
  assessment_id               UUID (PK)       

  user_id                     UUID (FK users) 

  pathology_id                UUID (FK        
                              pathologies)    

  assessment_type             enum            initial \| reassessment \|
                                              safety_screening.

  responses                   JSON            Réponses brutes aux questionnaires
                                              (structure versionnée par
                                              pathologie).

  safety_status               enum, nullable  vert \| orange \| rouge (§15).

  red_flags_detected          JSON, nullable  Liste des drapeaux rouges
                                              déclenchés (§16, etc.).

  functional_level_snapshot   JSON, nullable  Photo du niveau fonctionnel à cet
                                              instant.

  engine_version              string          Version du moteur de règles
                                              utilisée (traçabilité §65).

  created_at                  timestamp       
  ------------------------------------------------------------------------------

clinical_rules

*Moteur de règles médicales déterministe (§30, §31). Aucune règle n\'est
codée en dur dans l\'application.*

  ---------------------------------------------------------------------------------
  **Champ**            **Type**                  **Notes**
  -------------------- ------------------------- ----------------------------------
  rule_id              string (PK)               Ex. LBP_RED_FLAG_001.

  pathology            string (FK                
                       pathologies.code)         

  condition            JSON / DSL                Condition structurée évaluable par
                                                 le moteur (voir §3.7).

  severity             enum                      info \| warning \| critical.

  action               enum                      allow_program \|
                                                 require_precaution \|
                                                 medical_referral \|
                                                 adjust_progression \|
                                                 stop_program.

  message              text                      Message affiché à l\'utilisateur,
                                                 ton non culpabilisant (§39).

  reference_id         UUID (FK                  
                       scientific_references),   
                       nullable                  

  active               boolean                   

  version              string                    

  validated_by         string, nullable          Nom du concepteur médical.

  validated_date       date, nullable            

  created_at /         timestamp                 
  updated_at                                     
  ---------------------------------------------------------------------------------

exercise_library

*Bibliothèque d\'exercices (§25, §26). Champs strictement conformes à la
liste imposée par le cahier des charges.*

  -------------------------------------------------------------------------------------
  **Champ**                   **Type**               **Notes**
  --------------------------- ---------------------- ----------------------------------
  exercise_id                 UUID (PK)              

  name                        string                 

  short_description           string                 

  detailed_description        text                   

  pathologies                 jointure               
                              exercise_pathologies   

  objectives                  jointure               
                              exercise_objectives    

  category                    enum                   aérobique \| renforcement \|
                                                     mobilité \| équilibre \| contrôle
                                                     moteur \| fonctionnel (§25).

  difficulty                  enum                   

  starting_position           text                   

  execution_steps             text / JSON ordonné    

  breathing_instruction       text, nullable         

  duration                    int, nullable          

  repetitions                 int, nullable          

  sets                        int, nullable          

  rest_time                   int, nullable          

  frequency                   string, nullable       

  intensity                   string, nullable       

  progression                 text, nullable         

  regression                  text, nullable         

  contraindications           text                   

  precautions                 text                   

  stop_criteria               text                   

  target_muscles              text                   

  equipment_required          enum multiple          chaise \| mur \| tapis \|
                                                     serviette \| bouteille d\'eau \|
                                                     élastique \| aucun (§27).

  video_url                   string, nullable       

  audio_preparation_url       string, nullable       coach vocal (Sprint 20) —
                                                     audio avant l\'exercice.

  audio_exercise_url          string, nullable       coach vocal (Sprint 20) —
                                                     audio pendant l\'exercice.

  thumbnail                   string, nullable       

  scientific_references       jointure               
                              exercise_references    

  last_reviewed               date, nullable         

  medical_validation_status   enum                   draft \| pending_validation \|
                                                     validated (§57, §58).
  -------------------------------------------------------------------------------------

programs

*Modèles de programmes générés par le moteur de règles (§67).*

  ---------------------------------------------------------------------------------
  **Champ**              **Type**                **Notes**
  ---------------------- ----------------------- ----------------------------------
  program_id             string (PK)             Ex. OA_GENOU_DEBUTANT_01 (§30).

  pathology              string (FK              
                         pathologies.code)       

  profile_level          string                  

  objective              string                  

  duration               string                  

  frequency              string                  Paramètre F du FITT-VP (§24).

  intensity              string                  Paramètre I.

  aerobic_component      JSON, nullable          

  strength_component     JSON, nullable          

  mobility_component     JSON, nullable          

  balance_component      JSON, nullable          

  functional_component   JSON, nullable          

  progression_rule       JSON / FK               
                         clinical_rules          

  regression_rule        JSON / FK               
                         clinical_rules          

  safety_rules           jointure                
                         program_safety_rules →  
                         clinical_rules          

  references             jointure                
                         program_references →    
                         scientific_references   

  version                string                  

  medical_validation     enum                    draft \| pending_validation \|
                                                 validated.

  created_at /           timestamp               
  updated_at                                     
  ---------------------------------------------------------------------------------

program_exercises

*Table de jointure ordonnée : composition détaillée d\'un programme.*

  ----------------------------------------------------------------------------
  **Champ**             **Type**            **Notes**
  --------------------- ------------------- ----------------------------------
  program_exercise_id   UUID (PK)           

  program_id            string (FK          
                        programs)           

  exercise_id           UUID (FK            
                        exercise_library)   

  week_number           int                 

  day_number            int                 

  order_index           int                 

  sets_override /       int, nullable       Surcharge éventuelle des valeurs
  reps_override /                           par défaut de l\'exercice.
  duration_override                         

  notes                 text, nullable      
  ----------------------------------------------------------------------------

sessions

*Instances de séances planifiées/réalisées par un utilisateur (§28).*

  ----------------------------------------------------------------------------
  **Champ**                 **Type**        **Notes**
  ------------------------- --------------- ----------------------------------
  session_id                UUID (PK)       

  user_id                   UUID (FK users) 

  program_id                string (FK      
                            programs)       

  scheduled_date            date            

  status                    enum            planned \| completed \| skipped \|
                                            in_progress.

  pre_check_pain /          int/enum,       Vérification rapide en début de
  pre_check_fatigue /       nullable        séance (§28.2).
  pre_check_general_state                   

  started_at / completed_at timestamp,      
                            nullable        

  offline_created           boolean         Indique si la séance a été
                                            enregistrée hors connexion avant
                                            synchronisation (§54).

  created_at                timestamp       
  ----------------------------------------------------------------------------

session_feedback

*Feedback post-séance (§28.6, §69).*

  -----------------------------------------------------------------------
  **Champ**            **Type**        **Notes**
  -------------------- --------------- ----------------------------------
  feedback_id          UUID (PK)       

  session_id           UUID (FK        
                       sessions)       

  completed            boolean         

  pain_before          int 0-10        

  pain_after           int 0-10        

  fatigue              int 0-10        

  difficulty           enum            facile \| adaptée \| difficile \|
                                       très difficile.

  free_text_feeling    text, nullable  « Comment vous sentez-vous ? »

  created_at           timestamp       
  -----------------------------------------------------------------------

measurements

*Mesures corporelles/physiologiques génériques (§35-§38) : poids, tour
de taille, tension, glycémie.*

  -----------------------------------------------------------------------
  **Champ**            **Type**        **Notes**
  -------------------- --------------- ----------------------------------
  measurement_id       UUID (PK)       

  user_id              UUID (FK users) 

  type                 enum            weight \| waist_circumference \|
                                       blood_pressure_systolic \|
                                       blood_pressure_diastolic \|
                                       heart_rate \| glycemia.

  value                numeric         

  unit                 string          kg, cm, mmHg, bpm, mmol/L
                                       (conversion g/L↔mmol/L
                                       automatique, §38).

  recorded_at          timestamp       

  source               enum            manual \| device (préparation §63
                                       objets connectés).
  -----------------------------------------------------------------------

pain_scores

*Suivi dédié de la douleur (§34), séparé pour faciliter les courbes
dédiées du tableau de bord.*

  -----------------------------------------------------------------------
  **Champ**            **Type**        **Notes**
  -------------------- --------------- ----------------------------------
  pain_score_id        UUID (PK)       

  user_id              UUID (FK users) 

  session_id           UUID (FK        
                       sessions),      
                       nullable        

  score                int 0-10        

  context              enum            daily \| pre_session \|
                                       post_session.

  recorded_at          timestamp       
  -----------------------------------------------------------------------

functional_scores

*Indicateurs de capacité fonctionnelle dans le temps (§33 « capacité
fonctionnelle »).*

  ---------------------------------------------------------------------------------
  **Champ**             **Type**                 **Notes**
  --------------------- ------------------------ ----------------------------------
  functional_score_id   UUID (PK)                

  user_id               UUID (FK users)          

  assessment_id         UUID (FK                 
                        clinical_assessments),   
                        nullable                 

  metric_code           string                   Ex. capacité_marche,
                                                 lever_de_chaise (définition exacte
                                                 à valider médicalement, §58).

  value                 numeric                  

  recorded_at           timestamp                
  ---------------------------------------------------------------------------------

notifications

*Rappels et messages (§39).*

  -----------------------------------------------------------------------
  **Champ**            **Type**        **Notes**
  -------------------- --------------- ----------------------------------
  notification_id      UUID (PK)       

  user_id              UUID (FK users) 

  type                 enum            reminder_session \|
                                       reminder_assessment \|
                                       reminder_measurement \|
                                       encouragement \| re_engagement \|
                                       congratulation.

  title / body         string / text   Ton non culpabilisant obligatoire
                                       (§39).

  channel              enum            push \| email \| sms (futur).

  scheduled_at         timestamp       

  sent_at / read_at    timestamp,      
                       nullable        

  created_at           timestamp       
  -----------------------------------------------------------------------

scientific_references

*Base documentaire scientifique (§2, §32). Aucun DOI ne doit être
inventé.*

  -----------------------------------------------------------------------------------
  **Champ**                **Type**                **Notes**
  ------------------------ ----------------------- ----------------------------------
  reference_id             UUID (PK)               

  title                    string                  

  authors                  string                  

  journal                  string                  

  year                     int                     

  doi                      string, nullable        

  url                      string, nullable        

  organization             string                  OMS \| EULAR \| ACR \| ASAS-EULAR
                                                   \| autre.

  pathologies              jointure                
                           reference_pathologies   

  recommendation_summary   text                    

  evidence_level           string, nullable        

  last_checked             date                    
  -----------------------------------------------------------------------------------

medical_knowledge_base_versions

*Historique de version de la base médicale globale (§43, §66).*

  -----------------------------------------------------------------------
  **Champ**            **Type**        **Notes**
  -------------------- --------------- ----------------------------------
  kb_version_id        UUID (PK)       

  version_label        string          Ex. Medical Knowledge Base V1.0,
                                       V1.1, V2.0.

  release_date         date            

  change_summary       text            

  validated_by         string,         
                       nullable        

  created_at           timestamp       Aucune modification silencieuse
                                       (§66) : chaque ligne est immuable.
  -----------------------------------------------------------------------

subscriptions

*Abonnements (§48).*

  -----------------------------------------------------------------------
  **Champ**            **Type**        **Notes**
  -------------------- --------------- ----------------------------------
  subscription_id      UUID (PK)       

  user_id              UUID (FK users) 

  plan                 enum            free \| premium_monthly \|
                                       premium_annual (extensible).

  price_amount         numeric         Paramètre configurable, pas de
                                       valeur codée en dur (§48).

  currency             string          Ex. XOF.

  status               enum            active \| canceled \| expired \|
                                       trial.

  started_at /         timestamp       
  current_period_end                   

  created_at /         timestamp       
  updated_at                           
  -----------------------------------------------------------------------

payments

*Transactions, découplées via PaymentService (§47).*

  ------------------------------------------------------------------------------
  **Champ**                 **Type**          **Notes**
  ------------------------- ----------------- ----------------------------------
  payment_id                UUID (PK)         

  user_id                   UUID (FK users)   

  subscription_id           UUID (FK          
                            subscriptions),   
                            nullable          

  provider                  enum              orange_money \| moov_money \|
                                              mobile_money \| autre (adapté au
                                              contexte burkinabè, §47).

  provider_transaction_id   string, nullable  

  amount / currency         numeric / string  

  status                    enum              pending \| succeeded \| failed \|
                                              refunded.

  created_at                timestamp         
  ------------------------------------------------------------------------------

reports

*Rapports PDF générés (§40, §71).*

  -----------------------------------------------------------------------
  **Champ**            **Type**        **Notes**
  -------------------- --------------- ----------------------------------
  report_id            UUID (PK)       

  user_id              UUID (FK users) 

  period_start /       date            
  period_end                           

  pdf_url              string          

  content_snapshot     JSON            Copie figée des données au moment
                                       de la génération (traçabilité).

  generated_at         timestamp       
  -----------------------------------------------------------------------

professional_profiles

*Espace professionnel --- schéma prévu mais non activé en V1 (§41).*

  -----------------------------------------------------------------------
  **Champ**            **Type**        **Notes**
  -------------------- --------------- ----------------------------------
  professional_id      UUID (PK)       

  user_id              UUID (FK users) 

  profession           enum            médecin \| kinésithérapeute \|
                                       autre professionnel autorisé.

  license_number       string,         
                       nullable        

  verified             boolean         
  -----------------------------------------------------------------------

patient_professional_links

*Liaison patient ↔ professionnel autorisé --- schéma prévu, non activé
en V1 (§41).*

  --------------------------------------------------------------------------------
  **Champ**            **Type**                 **Notes**
  -------------------- ------------------------ ----------------------------------
  link_id              UUID (PK)                

  user_id              UUID (FK users, patient) 

  professional_id      UUID (FK                 
                       professional_profiles)   

  status               enum                     pending \| authorized \| revoked.

  authorized_at        timestamp, nullable      
  --------------------------------------------------------------------------------

audit_logs

*Journalisation des actions sensibles (§45).*

  -----------------------------------------------------------------------
  **Champ**            **Type**        **Notes**
  -------------------- --------------- ----------------------------------
  audit_log_id         UUID (PK)       

  user_id              UUID (FK        Nullable pour les actions système.
                       users),         
                       nullable        

  action               string          Ex. login, export_data,
                                       delete_account, rule_updated.

  entity_type /        string / UUID,  
  entity_id            nullable        

  ip_address /         string,         Jamais de donnée médicale en clair
  user_agent           nullable        dans les logs (§45).

  metadata             JSON, nullable  

  created_at           timestamp       
  -----------------------------------------------------------------------

5\. Arborescence du projet proposée

Organisation en monorepo (workspaces) séparant clairement l\'application
(apps/web), les modules réutilisables et testables isolément (packages/,
notamment rules-engine et payment-service), l\'infrastructure (infra/)
et la documentation vivante (docs/) demandée au §79.

apa-rhumato-pwa/

├── apps/

│ └── web/ \# Application Next.js (frontend + API routes)

│ ├── public/

│ │ ├── icons/ \# Icônes PWA (192, 512, maskable)

│ │ ├── manifest.webmanifest

│ │ └── sw.js \# Service worker (généré/compilé)

│ ├── src/

│ │ ├── app/ \# Routing Next.js (App Router)

│ │ │ ├── (auth)/

│ │ │ ├── (onboarding)/ \# Création de compte, profil, évaluation
initiale

│ │ │ ├── (dashboard)/ \# Tableau de bord utilisateur

│ │ │ ├── session/\[id\]/ \# Écran de séance guidée

│ │ │ ├── admin/ \# Espace administrateur (§42)

│ │ │ ├── professional/ \# Espace professionnel (préparé, non activé V1,
§41)

│ │ │ └── api/ \# API routes (proxy sécurisé vers services)

│ │ ├── components/

│ │ │ ├── ui/ \# Composants génériques (boutons, cartes, graphes)

│ │ │ ├── session/

│ │ │ ├── charts/

│ │ │ └── forms/

│ │ ├── features/

│ │ │ ├── assessment/ \# Évaluation initiale + réévaluation (§14)

│ │ │ ├── safety-screening/ \# Dépistage de sécurité (§15-§21)

│ │ │ ├── programs/

│ │ │ ├── exercises/

│ │ │ ├── tracking/ \# Douleur, poids, tour de taille, TA, glycémie

│ │ │ ├── notifications/

│ │ │ ├── reports/ \# Génération PDF (§40)

│ │ │ └── subscriptions/

│ │ ├── lib/

│ │ │ ├── i18n/ \# Système de traduction (§53)

│ │ │ ├── offline/ \# Cache, file d\'attente de synchro (§54)

│ │ │ └── analytics/

│ │ ├── styles/

│ │ └── middleware.ts \# Contrôle d\'accès par rôle (§46)

│ └── tests/

│ ├── unit/

│ ├── functional/

│ └── security/

├── packages/

│ ├── rules-engine/ \# Moteur de règles médicales déterministe (§30,
§31)

│ │ ├── src/

│ │ │ ├── engine.ts \# Évaluateur de règles (pur, testable, sans IA)

│ │ │ ├── conditions/

│ │ │ ├── rule-schema.ts

│ │ │ └── \_\_tests\_\_/ \# Cas de test du moteur médical (§56)

│ │ └── package.json

│ ├── domain/ \# Types et entités partagés (patients, programmes...)

│ ├── payment-service/ \# Abstraction PaymentService (§47)

│ │ └── src/providers/ \# orange-money.ts, moov-money.ts,
mobile-money.ts (stubs)

│ ├── pdf-report/ \# Génération des rapports PDF (§40, §71)

│ └── config/ \# ESLint, TypeScript, Tailwind partagés

├── infra/

│ ├── db/

│ │ ├── migrations/ \# Migrations SQL versionnées

│ │ └── seed/ \# Données de référence (pathologies, catégories)

│ └── env/

│ ├── .env.example

│ └── README.md

├── docs/

│ ├── ARCHITECTURE_TECHNIQUE_V1.md

│ ├── MEDICAL_VALIDATION_NEEDED.md \# Miroir vivant de la section 6 de
ce document

│ ├── DEPLOYMENT.md

│ └── DECISIONS.md \# Journal des décisions techniques (§79)

├── package.json \# Monorepo (workspaces)

└── README.md

6\. Paramètres médicaux nécessitant validation du concepteur médical

+-----------------------------------------------------------------------+
| **Rappel du §57 et du §59**                                           |
|                                                                       |
| Aucune information médicale absente du cahier des charges n\'a été    |
| inventée dans ce document ou dans le schéma de la section 4.          |
|                                                                       |
| Chaque point ci-dessous doit être validé par le Dr Wendtongo Brice    |
| Florent NIKIEMA avant que le moteur de personnalisation ne soit       |
| activé pour la pathologie concernée.                                  |
|                                                                       |
| Dans le code, chaque paramètre en attente sera matérialisé par un     |
| marqueur explicite TODO_MEDICAL_VALIDATION ou                         |
| MEDICAL_PARAMETER_REQUIRED (§57), et non par une valeur par défaut    |
| arbitraire.                                                           |
+-----------------------------------------------------------------------+

Transversal --- toutes pathologies (§58)

-   Seuils exacts de douleur (ex. seuil au-delà duquel une séance doit
    être interrompue ou adaptée).

-   Critères précis de progression (valeurs seuils d\'adhésion, de
    tolérance, de fatigue déclenchant un passage de niveau).

-   Critères d\'arrêt d\'une séance ou d\'un programme.

-   Liste complète et formulation exacte des red flags par pathologie.

-   Contre-indications précises par exercice et par pathologie.

-   Choix définitif des exercices spécifiques à inclure par module et
    par niveau.

-   Définition précise des niveaux de difficulté (1 à N) et de leurs
    critères de passage.

-   Intensités cibles (échelle de perception de l\'effort, % FC max, ou
    autre échelle retenue).

-   Contenu exact des questionnaires d\'évaluation initiale et de
    réévaluation.

-   Formulation exacte des règles et messages de sécurité affichés à
    l\'utilisateur.

-   Contenu définitif de chaque programme par pathologie (FITT-VP
    complet).

Module 1 --- Lombalgie commune / lombosciatique commune (§16)

-   Liste et seuils exacts des red flags (traumatisme, douleur
    inhabituelle, fièvre, antécédent de cancer, perte de poids
    inexpliquée, déficit moteur/neurologique, troubles sphinctériens,
    anesthésie en selle, suspicion de syndrome de la queue de cheval) :
    formulation clinique précise de chaque question de dépistage.

-   Critères précis distinguant lombalgie commune vs lombosciatique
    commune pour l\'orientation du programme.

Module 2 --- Arthrose du genou (§17)

-   Seuils de douleur/gonflement/instabilité déclenchant une orientation
    orange/rouge.

-   Critères précis liés à une chirurgie ou un traumatisme récent (délai
    post-opératoire à respecter avant reprise).

Module 3 --- Arthrose de hanche (§18)

-   Critères précis de sécurité en cas de prothèse de hanche (délai,
    mouvements à éviter).

-   Seuils de limitation de marche/mobilité déclenchant une orientation.

Module 4 --- Polyarthrite rhumatoïde (§19)

-   Définition précise d\'une « poussée récente » (délai, intensité) et
    impact sur le programme.

-   Liste des comorbidités à surveiller particulièrement.

-   Confirmation que le moteur ne doit produire aucune recommandation
    pouvant être interprétée comme une modification du traitement de
    fond (§19 rappelé comme contrainte absolue).

Module 5 --- Spondyloarthrite axiale (§20)

-   Critères précis de tolérance à l\'effort et de mobilité rachidienne
    déclenchant une adaptation.

-   Prise en compte exacte des symptômes périphériques dans le
    screening.

Module 6 --- Ostéoporose (§21)

-   Définition précise du « risque de chute » et de son évaluation.

-   Liste des mouvements/exercices contre-indiqués selon le risque
    fracturaire (flexions/torsions du rachis notamment).

-   Délai de sécurité après une fracture récente avant reprise d\'un
    programme.

7\. Prochaines étapes

Conformément au §80, le développement ne débutera pas sur l\'ensemble
des fonctionnalités simultanément. L\'ordre de développement défini au
§60 est repris tel quel, en commençant par le Sprint 1 (architecture
technique --- ce document) puis le Sprint 2 (authentification et
profil), sans implémenter le moteur de personnalisation avant que les
structures ci-dessus soient jugées cohérentes et que les paramètres de
la section 6 aient commencé à être validés.

7.1 Validations attendues avant la suite

-   Confirmation ou ajustement de l\'architecture technique proposée
    (section 3).

-   Confirmation ou ajustement du schéma de base de données (section 4).

-   Premiers retours sur la liste des paramètres médicaux à valider
    (section 6), même partiels --- la validation peut être progressive,
    module par module.

7.2 Ce que Claude ne commencera pas avant validation

-   Le contenu détaillé des programmes par pathologie (FITT-VP complet).

-   Les seuils et règles de clinical_rules.

-   Les contre-indications et critères d\'arrêt spécifiques par
    exercice.

En revanche, le Sprint 2 (authentification, création de compte, profil
patient) peut démarrer dès validation de ce document, car il ne comporte
aucune décision médicale.
