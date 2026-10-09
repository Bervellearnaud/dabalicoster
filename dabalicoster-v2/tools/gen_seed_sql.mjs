/* Génère supabase/seed_data.sql depuis js/data.js (données de démo).
   Usage : node tools/gen_seed_sql.mjs  */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(root, 'js/data.js'), 'utf8');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(src + '\n;globalThis.__Seed = Seed;', ctx);
const Seed = ctx.__Seed;

const esc = (s) => String(s == null ? '' : s).replace(/'/g, "''");
const q = (s) => `'${esc(s)}'`;
const uid = (id) => `'${id}'`;
const num = (n) => String(Math.round(n * 1000) / 1000);

// Mapping UUID déterministe (les id V1 type 'i-poulet' ne sont pas des UUID)
const uuidIng = new Map(Seed.ingredients.map((i, k) => [i.id, `00000000-0000-4000-8000-0000000001${String(k + 1).padStart(2, '0')}`]));
const uuidRec = new Map(Seed.recipes.map((r, k) => [r.id, `00000000-0000-4000-8000-0000000002${String(k + 1).padStart(2, '0')}`]));
const uuidMenu = new Map(Seed.menus.map((m, k) => [m.id, `00000000-0000-4000-8000-0000000003${String(k + 1).padStart(2, '0')}`]));

const out = [];
out.push(`-- ============================================================
-- DABALICOSTER V2 — Seed données métier (À COLLER APRÈS setup.sql)
-- Généré automatiquement depuis js/data.js — idempotent.
-- ============================================================`);

// Ingrédients
out.push('\ninsert into public.ingredients (id, nom, categorie, unite, prix_unitaire, fournisseur, nutrition) values');
out.push(Seed.ingredients.map(i =>
  ` (${uid(uuidIng.get(i.id))}, ${q(i.nom)}, ${q(i.categorie)}, ${q(i.unite)}, ${num(i.prix_unitaire)}, ${q(i.fournisseur)}, ` +
  (i.nutrition ? `'${JSON.stringify(i.nutrition)}'::jsonb` : 'null') + ')'
).join(',\n') + '\non conflict (id) do nothing;');

// Historique de prix (30 j)
out.push('\ninsert into public.historique_prix (ingredient_id, date_prix, prix) values');
const histRows = [];
Seed.ingredients.forEach(i => (i.historique || []).forEach(h =>
  histRows.push(` (${uid(uuidIng.get(i.id))}, '${h.date}', ${num(h.prix)})`)));
out.push(histRows.join(',\n') + '\non conflict (ingredient_id, date_prix) do nothing;');

// Recettes
out.push('\ninsert into public.recettes (id, nom, categorie, portions, temps, instructions, prix_vente_ht) values');
out.push(Seed.recipes.map(r =>
  ` (${uid(uuidRec.get(r.id))}, ${q(r.nom)}, ${q(r.categorie)}, ${r.portions}, ${r.temps}, ${q(r.instructions)}, ${num(r.prix_vente_ht)})`
).join(',\n') + '\non conflict (id) do nothing;');

// Lignes de recette
out.push('\ninsert into public.lignes_recette (recette_id, ingredient_id, quantite, unite) values');
const lineRows = [];
Seed.recipes.forEach(r => (r.lignes || []).forEach(l =>
  lineRows.push(` (${uid(uuidRec.get(r.id))}, ${uid(uuidIng.get(l.ingredient_id))}, ${num(l.quantite)}, ${q(l.unite)})`)));
out.push(lineRows.join(',\n') + '\non conflict (recette_id, ingredient_id) do nothing;');

// Menus + lignes
out.push('\ninsert into public.menus (id, nom) values');
out.push(Seed.menus.map(m => ` (${uid(uuidMenu.get(m.id))}, ${q(m.nom)})`).join(',\n') + '\non conflict (id) do nothing;');
out.push('\ninsert into public.lignes_menu (menu_id, recette_id, quantite) values');
const mRows = [];
Seed.menus.forEach(m => (m.lignes || []).forEach(l =>
  mRows.push(` (${uid(uuidMenu.get(m.id))}, ${uid(uuidRec.get(l.recette_id))}, ${l.quantite})`)));
out.push(mRows.join(',\n') + '\non conflict (menu_id, recette_id) do nothing;');

// Paramètres (ligne unique id=1)
out.push(`\ninsert into public.parametres (id, devise, objectif_food_cost, tva) values
 (1, 'XOF', ${Seed.params.objectif_food_cost}, ${Seed.params.tva})
on conflict (id) do nothing;`);

out.push('\n-- Vérification rapide :');
out.push('-- select count(*) from public.ingredients;      -- attendu : 18');
out.push('-- select count(*) from public.recettes;          -- attendu : 4');
out.push('-- select * from public.v_cout_recettes;           -- coûts & food cost');
out.push('-- select * from public.v_alertes_prix;            -- attendu : 5 alertes');

const dest = path.join(root, 'supabase/seed_data.sql');
fs.writeFileSync(dest, out.join('\n') + '\n');
console.log('OK →', dest, fs.statSync(dest).size, 'octets,', histRows.length, 'lignes d\u2019historique');
