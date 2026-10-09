# DABALICOSTER

> « Votre savoir-faire mérite une gestion à sa hauteur. »

Plateforme SaaS de gestion des recettes, du **coût matière** et du **Food Cost** pour les professionnels de la restauration (hôtels, restaurants, traiteurs) — spécialisée **cuisine ivoirienne**, devise **FCFA (XOF)**.

Dépôt monorepo contenant deux versions complémentaires :

| Dossier | Version | Persistance | Statut |
|---|---|---|---|
| [`dabalicoster/`](dabalicoster/README.md) | **V1** — HTML / CSS / JavaScript vanilla (Next.js-free) | `localStorage` | Stable, conforme au cahier des charges V1 |
| [`dabalicoster-v2/`](dabalicoster-v2/SUPABASE.md) | **V2** — même application branchée sur **Supabase / PostgreSQL** | Base distante (bcrypt + RLS) | Branchement fonctionnel, setup SQL fourni |

## Démarrage rapide

```bash
# V1 (aucune dépendance)
cd dabalicoster && python3 -m http.server 8000

# V2 (Supabase)
cd dabalicoster-v2 && python3 -m http.server 8001
# puis coller supabase/setup.sql et supabase/seed_data.sql
# dans le SQL Editor Supabase (voir dabalicoster-v2/SUPABASE.md)
# et tester : node tools/test_supabase.mjs
```

## Comptes de démonstration

| Profil | E-mail | Mot de passe | Statut |
|---|---|---|---|
| Chef | `chef@dabalicoster.ci` | `chef2026` | Actif |
| Utilisateur | `user@dabalicoster.ci` | `user2026` | Actif |
| Administrateur | `admin@voomnet.ci` | `admin2026` | Actif |
| Utilisateur (test) | `stagiaire@dabalicoster.ci` | `stagiaire2026` | Suspendu |

## Modules livrés

Tableau de bord (4 KPIs + alertes > 5 %/30 j) · Référentiel ingrédients (tendances 30 j, propagation instantanée) · Recettes & fiches techniques (costing automatique) · Simulation temps réel (prix / objectif Food Cost) · Carte nutritionnelle dynamique · Menu Builder · Paramètres (objectif FC, TVA, devise XOF/EUR/USD/GBP) · Rôles Utilisateur / Chef / Administrateur avec espaces protégés · Administration des comptes.

## Moteur de costing

1. Coût ingrédient = quantité × coût unitaire (conversions kg↔g, L↔ml, pièce, sachet)
2. Coût recette = Σ coûts ingrédients
3. Coût portion = coût recette ÷ portions
4. Food Cost (%) = coût portion ÷ prix de vente HT × 100
5. Prix théorique = coût portion ÷ objectif Food Cost
6. Marge matière = prix de vente − coût matière

## Sécurité (V2)

Mots de passe hachés **bcrypt en base** (`crypt`/`gen_salt`), table `utilisateurs` verrouillée par **RLS** (accès uniquement via fonctions `SECURITY DEFINER`), pas d'auto-élévation de rôle, clé Supabase utilisée = clé *publishable* (publique par conception). La clé `service_role` ne doit jamais être exposée.

## Licence & crédits

© 2026 **DABALICOSTER** — VOOMNET FORMATION · Cuisine · Formation · Gestion — Abidjan, Côte d'Ivoire.
Cahier des charges fonctionnel & technique V1 (septembre 2026) : voir `dabalicoster/README.md` et `dabalicoster-v2/SUPABASE.md`.
