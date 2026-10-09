-- ============================================================
-- DABALICOSTER — Schéma relationnel PostgreSQL (prêt Vercel / V2)
-- La V1 HTML/CSS/JS utilise localStorage avec le même modèle.
-- Devise de référence : XOF (FCFA). Aucune conversion automatique.
-- ============================================================

-- Rôles : utilisateur | chef | administrateur
-- Statuts : actif | suspendu
CREATE TABLE IF NOT EXISTS utilisateurs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom             TEXT NOT NULL,
    prenom          TEXT NOT NULL,
    email           TEXT NOT NULL UNIQUE,
    contact         TEXT,
    mot_de_passe    TEXT NOT NULL,               -- à hasher (bcrypt/argon2) côté API
    role            TEXT NOT NULL DEFAULT 'utilisateur'
                    CHECK (role IN ('utilisateur', 'chef', 'administrateur')),
    statut          TEXT NOT NULL DEFAULT 'actif'
                    CHECK (statut IN ('actif', 'suspendu')),
    photo           TEXT,
    cree_le         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unités gérées avec conversions par famille : kg/g (masse), L/ml (volume), piece, sachet
CREATE TABLE IF NOT EXISTS ingredients (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom             TEXT NOT NULL UNIQUE,
    categorie       TEXT NOT NULL DEFAULT 'Autre',
    unite           TEXT NOT NULL CHECK (unite IN ('kg', 'g', 'L', 'ml', 'piece', 'sachet')),
    prix_unitaire   NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (prix_unitaire >= 0),
    fournisseur     TEXT,
    date_prix       DATE NOT NULL DEFAULT CURRENT_DATE,
    -- nutrition par 100 g / 100 ml / piece / sachet ; NULL => « donnée indisponible »
    nutrition       JSONB,
    cree_le         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Historique des prix (tendances 30 jours, alertes hausse > 5 %)
CREATE TABLE IF NOT EXISTS historique_prix (
    id              BIGSERIAL PRIMARY KEY,
    ingredient_id   UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    date_prix       DATE NOT NULL,
    prix            NUMERIC(12, 2) NOT NULL CHECK (prix >= 0),
    UNIQUE (ingredient_id, date_prix)
);

CREATE TABLE IF NOT EXISTS recettes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom             TEXT NOT NULL UNIQUE,
    categorie       TEXT NOT NULL DEFAULT 'Plats',
    portions        INTEGER NOT NULL DEFAULT 1 CHECK (portions > 0),
    temps           INTEGER NOT NULL DEFAULT 0,          -- minutes
    instructions    TEXT,
    prix_vente_ht   NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (prix_vente_ht >= 0),
    actif           BOOLEAN NOT NULL DEFAULT TRUE,
    cree_le         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lignes de recette : quantité exprimée dans une unité compatible
-- avec l'unité de prix de l'ingrédient (conversion par famille)
CREATE TABLE IF NOT EXISTS lignes_recette (
    id              BIGSERIAL PRIMARY KEY,
    recette_id      UUID NOT NULL REFERENCES recettes(id) ON DELETE CASCADE,
    ingredient_id   UUID NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
    quantite        NUMERIC(12, 3) NOT NULL CHECK (quantite > 0),
    unite           TEXT NOT NULL CHECK (unite IN ('kg', 'g', 'L', 'ml', 'piece', 'sachet')),
    UNIQUE (recette_id, ingredient_id)
);

CREATE TABLE IF NOT EXISTS menus (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom             TEXT NOT NULL UNIQUE,
    cree_le         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lignes_menu (
    id              BIGSERIAL PRIMARY KEY,
    menu_id         UUID NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
    recette_id      UUID NOT NULL REFERENCES recettes(id) ON DELETE CASCADE,
    quantite        INTEGER NOT NULL DEFAULT 1 CHECK (quantite > 0),
    UNIQUE (menu_id, recette_id)
);

-- Paramètres par établissement (V1 : un seul enregistrement)
CREATE TABLE IF NOT EXISTS parametres (
    id                  SERIAL PRIMARY KEY,
    devise              TEXT NOT NULL DEFAULT 'XOF' CHECK (devise IN ('XOF', 'EUR', 'USD', 'GBP')),
    objectif_food_cost  NUMERIC(5, 2) NOT NULL DEFAULT 35 CHECK (objectif_food_cost > 0),
    tva                 NUMERIC(5, 2) NOT NULL DEFAULT 18 CHECK (tva >= 0)
);

-- ============================================================
-- Index
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_historique_ing_date   ON historique_prix (ingredient_id, date_prix DESC);
CREATE INDEX IF NOT EXISTS idx_lignes_recette_recette ON lignes_recette (recette_id);
CREATE INDEX IF NOT EXISTS idx_lignes_recette_ing     ON lignes_recette (ingredient_id);
CREATE INDEX IF NOT EXISTS idx_lignes_menu_menu       ON lignes_menu (menu_id);
CREATE INDEX IF NOT EXISTS idx_utilisateurs_role      ON utilisateurs (role);

-- ============================================================
-- Vue de coût par recette (moteur de costing côté base)
-- Facteurs vers l'unité de base de la famille : kg/L = 1000 ; g/ml/piece/sachet = 1
-- ============================================================
CREATE OR REPLACE VIEW v_cout_recettes AS
SELECT
    r.id                                        AS recette_id,
    r.nom,
    r.portions,
    r.prix_vente_ht,
    COALESCE(SUM(
        lr.quantite
        * CASE lr.unite WHEN 'kg' THEN 1000 WHEN 'L' THEN 1000 ELSE 1 END
        / CASE i.unite  WHEN 'kg' THEN 1000 WHEN 'L' THEN 1000 ELSE 1 END
        * i.prix_unitaire
    ), 0)                                       AS cout_recette,
    COALESCE(SUM(
        lr.quantite
        * CASE lr.unite WHEN 'kg' THEN 1000 WHEN 'L' THEN 1000 ELSE 1 END
        / CASE i.unite  WHEN 'kg' THEN 1000 WHEN 'L' THEN 1000 ELSE 1 END
        * i.prix_unitaire
    ), 0) / GREATEST(r.portions, 1)             AS cout_portion,
    CASE WHEN r.prix_vente_ht > 0 THEN
        100.0 * (COALESCE(SUM(
            lr.quantite
            * CASE lr.unite WHEN 'kg' THEN 1000 WHEN 'L' THEN 1000 ELSE 1 END
            / CASE i.unite  WHEN 'kg' THEN 1000 WHEN 'L' THEN 1000 ELSE 1 END
            * i.prix_unitaire
        ), 0) / GREATEST(r.portions, 1)) / r.prix_vente_ht
    ELSE NULL END                               AS food_cost_pct
FROM recettes r
LEFT JOIN lignes_recette lr ON lr.recette_id = r.id
LEFT JOIN ingredients i     ON i.id = lr.ingredient_id
GROUP BY r.id, r.nom, r.portions, r.prix_vente_ht;

-- Alertes : hausse > 5 % sur 30 jours
CREATE OR REPLACE VIEW v_alertes_prix AS
WITH fenetre AS (
    SELECT ingredient_id, prix, date_prix,
           ROW_NUMBER() OVER (PARTITION BY ingredient_id ORDER BY date_prix ASC)  AS rn_first,
           ROW_NUMBER() OVER (PARTITION BY ingredient_id ORDER BY date_prix DESC) AS rn_last
    FROM historique_prix
    WHERE date_prix >= CURRENT_DATE - INTERVAL '30 days'
)
SELECT i.id AS ingredient_id, i.nom, f.prix AS ancien_prix, l.prix AS nouveau_prix,
       ROUND(100.0 * (l.prix - f.prix) / NULLIF(f.prix, 0), 1) AS hausse_pct
FROM ingredients i
JOIN fenetre f ON f.ingredient_id = i.id AND f.rn_first = 1
JOIN fenetre l ON l.ingredient_id = i.id AND l.rn_last = 1
WHERE f.prix > 0 AND (l.prix - f.prix) / f.prix > 0.05;
