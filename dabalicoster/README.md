# DABALICOSTER — V1 HTML / CSS / JavaScript

> « Votre savoir-faire mérite une gestion à sa hauteur. »

Plateforme SaaS de gestion des recettes, du coût matière et du Food Cost — spécialisée cuisine ivoirienne (hôtels, restaurants, traiteurs). Devise FCFA (XOF).

**Version du dépôt** : V1 « pour commencer » en **HTML + CSS + JavaScript vanilla** (sans framework, sans build, sans dépendance). Le cahier des charges cible Next.js 14 ; cette implémentation respecte la même architecture logique (moteur pur / store / auth / UI séparés) pour permettre la migration Next.js en V2 sans réécrire le métier.

---

## Lancer le projet

Aucune installation n'est requise. Deux options :

```bash
# Option 1 — serveur statique (recommandée)
cd dabalicoster
python3 -m http.server 8000
# → http://localhost:8000

# Option 2 — ouvrir directement index.html dans un navigateur
```

## Arborescence

| Chemin | Rôle |
|---|---|
| `index.html` | Landing publique + intro animée (braises, grille violette, logo glow) |
| `login.html` | Connexion : choix du profil, photos Ken Burns, comptes de démo |
| `inscription.html` | Inscription réelle et persistée (contrôles complets) |
| `app.html` | Espace Chef/Admin : `#/dashboard`, `#/ingredients`, `#/recettes`, `#/recettes/:id`, `#/menus`, `#/parametres` |
| `admin.html` | Administration des comptes (Administrateur uniquement) |
| `espace.html` | Espace personnel (tout compte connecté) |
| `js/core.js` | **Moteur de costing** : fonctions pures, 6 formules, conversions d'unités, nutrition, tendances |
| `js/data.js` | Données de démonstration (cuisine ivoirienne) : comptes, ingrédients, recettes, menus |
| `js/store.js` | Persistance localStorage + enrichissement automatique + reset démo |
| `js/auth.js` | Comptes, session, rôles, gardes de routes (`RequireAuth` équivalent) |
| `js/ui.js` | Toasts, modales, confirmations, sparklines, fil d'Ariane, formats devise |
| `js/app.js` | Routeur hash + les 6 modules métier |
| `css/landing.css` | Design system violet nuit / or champagne |
| `css/app.css` | Design system ivoire / or / graphite |
| `schema.sql` | Schéma PostgreSQL complet (tables, index, vues de coût et d'alertes) — prêt V2 |
| `assets/` | Logo SVG + photographies culinaires |

## Comptes de démonstration

| Profil | E-mail | Mot de passe | Statut |
|---|---|---|---|
| Chef | `chef@dabalicoster.ci` | `chef2026` | Actif |
| Utilisateur | `user@dabalicoster.ci` | `user2026` | Actif |
| Administrateur | `admin@voomnet.ci` | `admin2026` | Actif |
| Utilisateur (test) | `stagiaire@dabalicoster.ci` | `stagiaire2026` | **Suspendu** |

Redirections après connexion : Chef/Administrateur → `app.html` ; Utilisateur → `espace.html`. L'URL demandée est conservée via `?next=`.

## Moteur de costing (formules implémentées)

1. Coût ingrédient = quantité utilisée × coût unitaire
2. Coût recette = somme des coûts ingrédients
3. Coût portion = coût recette ÷ nombre de portions
4. Food Cost (%) = (coût portion ÷ prix de vente HT) × 100
5. Prix de vente théorique = coût portion ÷ objectif Food Cost
6. Marge matière = prix de vente − coût matière

Unités : `kg`/`g` (masse), `L`/`ml` (volume), `piece`, `sachet` — conversions automatiques par famille, unités incompatibles refusées dans les formulaires.

## Périmètre fonctionnel livré

- ✅ Tableau de bord : 4 KPIs + alertes de prix avec sparklines + barres Food Cost vs objectif
- ✅ Référentiel ingrédients : recherche, ajout/modification, tendance 30 j, **propagation instantanée** du recalcul (toast)
- ✅ Recettes : cartes, création en modale avec lignes dynamiques et coûts en direct
- ✅ Fiche recette : lignes éditables, 5 KPIs + Food Cost, **simulation temps réel** (sliders 500–20 000 et 10–70 %, jauge, prix conseillé, « Appliquer le prix simulé »)
- ✅ Carte nutritionnelle dynamique (calories + 6 macros vs repères journaliers ; état « Donnée nutritionnelle indisponible » — démonstré par la Sauce graine qui contient du Capitaine)
- ✅ Menu Builder : assemblage, coût global, prix cumulé, FC du menu, marge, prix minimum conseillé, menus enregistrés (charger/supprimer avec confirmation)
- ✅ Paramètres : objectif Food Cost, TVA, devise XOF/EUR/USD/GBP persistée et utilisée partout (sans conversion), reset de la démonstration
- ✅ Sécurité applicative : rôles vérifiés côté JS au chargement de chaque espace, session persistée, statuts actif/suspendu, inscription sans auto-élévation
- ✅ UX : toasts, confirmations destructives, skeleton d'ouverture, fil d'Ariane dynamique (nom de recette résolu), bouton Retour sur historique réel, responsive complet

## Simplifications assumées de cette V1 (vs cahier des charges Next.js)

- Le routage `/app/recettes/[id]` est remplacé par un **routage hash** (`app.html#/recettes/:id`) — 11 « routes » équivalentes.
- Les rôles sont vérifiés côté navigateur ; à durcir côté serveur (API + PostgreSQL) en V2, comme prévu par le cahier.
- Les mots de passe de démo sont stockés en clair dans localStorage (V1 navigateur uniquement) — hachage obligatoire dès le branchement API.
- La photo de profil accepte une URL (pas d'upload de fichier en V1).

## Pistes V2 (issues du cahier des charges)

1. Branchement API + base PostgreSQL réelle (`schema.sql` fourni et prêt)
2. Source nutritionnelle externe
3. Exports PDF des fiches techniques
4. Multi-établissements

---

© 2026 **DABALICOSTER** — VOOMNET FORMATION · Cuisine · Formation · Gestion — Abidjan, Côte d'Ivoire
