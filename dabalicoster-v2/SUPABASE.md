# DABALICOSTER V2 — Branchement Supabase

Projet Supabase : `lbeugbapmruljmekokhj` · URL `https://lbeugbapmruljmekokhj.supabase.co`
Clé utilisée : **publishable** (publique par conception, sûre côté navigateur).

> La V1 (`/dabalicoster`, port 8000) reste intacte en localStorage.
> Cette V2 (`/dabalicoster-v2`, port 8001) écrit et lit dans PostgreSQL.

---

## 1. Procédure d'activation (2 collages, ~2 minutes)

La clé publishable ne peut pas créer de tables (DDL) : la structure se pose
depuis le dashboard.

1. Dashboard Supabase → **SQL Editor** → *New query*.
2. Coller **tout** le contenu de `supabase/setup.sql` → **Run**.
   (tables, index, vues de costing, fonctions bcrypt `SECURITY DEFINER`,
   politiques RLS, grants, 4 comptes démo **hachés**)
3. Nouvelle query → coller **tout** le contenu de `supabase/seed_data.sql` → **Run**.
   (18 ingrédients + 540 lignes d'historique 30 j + 4 recettes + lignes + 1 menu + paramètres)
4. Vérifier dans **Table Editor** : `utilisateurs` (4 lignes, colonne
   `mot_de_passe` = hash `$2a$…`), `ingredients` (18), `recettes` (4).

Les deux fichiers sont **idempotents** : un re-collage ne duplique rien
(`ON CONFLICT DO NOTHING`, `CREATE … IF NOT EXISTS`, `OR REPLACE`).

## 2. Tester

```bash
node tools/test_supabase.mjs
```

Le script vérifie de bout en bout : santé GoTrue, `login_user` bcrypt,
compte suspendu, **inscription → ligne visible en base**, doublon refusé,
mot de passe faible refusé, auto-élévation admin refusée, **RLS bloque le
SELECT direct sur `utilisateurs`**, liste/suppression admin, seed métier,
vues `v_cout_recettes` (poulet ≈ 3 120 F) et `v_alertes_prix` (5 alertes),
écritures métier anon.

## 3. Architecture du branchement

| Fichier (V2) | Rôle |
|---|---|
| `js/supabase.js` | Client REST minimal (fetch, sans SDK) : `rpc()`, `select()`, `upsert()`, `update()`, `del()` |
| `js/store.db.js` | Adaptateur : `boot()` hydrate le cache localStorage depuis la base ; `wrapWrites()` réplique chaque mutation `Store.*` vers Supabase (fire-and-forget + toast d'erreur) |
| `js/auth.js` | `login` / `register` **async** via `rpc('login_user' / 'register_user')` ; repli local si Supabase injoignable |
| `js/login.js`, `js/inscription.js` | 1 ligne changée chacun : `await Auth.login/register` |
| `js/admin.js` | 1 ligne : re-rendu sur événement `db:users-changed` |
| `app.html`, `admin.html`, `espace.html` | chargent `supabase.js` + `store.db.js` puis `StoreDB.boot().then(charge l'espace)` |
| `js/app.js`, `js/ui.js`, `js/core.js`, CSS | **inchangés** par rapport à la V1 |

### Modèle de sécurité

- **Mots de passe** : hachés **bcrypt en base** (`crypt` / `gen_salt('bf')`),
  vérifiés par `login_user` — le hash ne transite jamais vers le navigateur.
- **`utilisateurs`** : RLS activé **sans aucune policy** → inaccessible en
  lecture/écriture directe ; tout passe par les fonctions `SECURITY DEFINER`
  (`register_user`, `login_user`, `account_status`, `get_user`,
  `update_profile`, `admin_list_users`, `admin_upsert_user`,
  `admin_delete_user`) qui re-vérifient rôles, e-mail unique, force du mot de
  passe, et interdisent l'auto-élévation / l'auto-suppression.
- **Tables métier** : RLS activé avec policies `anon/authenticated`
  (lecture + écriture) — même niveau de confiance que la V1, assumé pour la
  démo. À durcir en V3 avec de vraies sessions JWT Supabase Auth.
- **Jamais** la clé `service_role` / secret dans le navigateur ou dans un chat.

## 4. Comportement runtime

- Base joignable → toutes les lectures/écritures partent de/vers PostgreSQL
  (console : « Connecté à Supabase — données hydratées depuis la base »).
- Base injoignable → repli automatique localStorage (la démo reste utilisable).
- Une inscription depuis `/inscription.html` insère une ligne hachée dans
  `public.utilisateurs` ; elle apparaît immédiatement dans
  **Table Editor → utilisateurs** et dans `/admin` (connexion administrateur).

## 5. Pistes V3

Sessions JWT Supabase Auth + policies par établissement, remplacement du
repli localStorage par un état d'erreur explicite, exports PDF,
multi-établissements.
