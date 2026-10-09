/* ============================================================
   DABALICOSTER — Moteur de costing (lib/core équivalent)
   Fonctions pures, déterministes, centralisées.
   Utilisées par TOUS les modules (tableau de bord, recettes,
   menus, nutrition, simulation).
   ============================================================ */
const Core = (() => {

  /* ---------- Unités & conversions par famille ---------- */
  const UNIT_FAMILIES = {
    masse:  ['kg', 'g'],
    volume: ['L', 'ml'],
    piece:  ['piece'],
    sachet: ['sachet'],
  };
  const ALL_UNITS = ['kg', 'g', 'L', 'ml', 'piece', 'sachet'];
  // Facteur vers l'unité de base de la famille (g, ml, piece, sachet)
  const FACTORS = { kg: 1000, g: 1, L: 1000, ml: 1, piece: 1, sachet: 1 };

  function familyOf(unit) {
    for (const f in UNIT_FAMILIES) if (UNIT_FAMILIES[f].includes(unit)) return f;
    return null;
  }
  function compatibleUnits(unit) {
    const f = familyOf(unit);
    return f ? UNIT_FAMILIES[f].slice() : [unit];
  }
  function canConvert(a, b) {
    const fa = familyOf(a);
    return fa !== null && fa === familyOf(b);
  }
  function convert(qty, from, to) {
    if (from === to) return qty;
    if (!canConvert(from, to)) return null;
    return (qty * FACTORS[from]) / FACTORS[to];
  }

  /* ---------- Formule 1 : Coût ingrédient = quantité utilisée × coût unitaire ---------- */
  function ingredientCost(qty, qtyUnit, unitPrice, priceUnit) {
    if (qtyUnit === priceUnit) return qty * unitPrice;
    const q = convert(qty, qtyUnit, priceUnit);
    return q === null ? NaN : q * unitPrice;
  }

  /* ---------- Formule 2 : Coût recette = somme des coûts ingrédients ---------- */
  function recipeCost(recipe, ingredients) {
    const byId = indexById(ingredients);
    return (recipe.lignes || []).reduce((sum, l) => {
      const ing = byId[l.ingredient_id];
      if (!ing) return sum;
      const c = ingredientCost(l.quantite, l.unite, ing.prix_unitaire, ing.unite);
      return sum + (isNaN(c) ? 0 : c);
    }, 0);
  }

  /* ---------- Formule 3 : Coût portion = coût recette / nombre de portions ---------- */
  function portionCost(recipe, ingredients) {
    return recipeCost(recipe, ingredients) / Math.max(1, recipe.portions || 1);
  }

  /* ---------- Formule 4 : Food Cost (%) = (coût portion / prix de vente HT) × 100 ---------- */
  function foodCostPct(costPortion, prixHT) {
    return prixHT > 0 ? (costPortion / prixHT) * 100 : 0;
  }

  /* ---------- Formule 5 : Prix de vente théorique = coût portion / objectif Food Cost ---------- */
  function theoreticalPrice(costPortion, targetPct) {
    return targetPct > 0 ? costPortion / (targetPct / 100) : 0;
  }

  /* ---------- Formule 6 : Marge matière = prix de vente − coût matière ---------- */
  function marge(prix, cout) { return prix - cout; }

  /* ---------- Coût d'une ligne de recette ---------- */
  function lineCost(line, ingredients) {
    const ing = indexById(ingredients)[line.ingredient_id];
    if (!ing) return 0;
    const c = ingredientCost(line.quantite, line.unite, ing.prix_unitaire, ing.unite);
    return isNaN(c) ? 0 : c;
  }

  /* ---------- Carte nutritionnelle ---------- */
  // Repères journaliers (type INCO / règlement UE 1169-2011)
  const DAILY_REF = {
    calories: 2000, proteines: 50, glucides: 260,
    lipides: 70, fibres: 25, sucres: 90, sodium: 2400,
  };
  const NUTRI_KEYS = ['calories', 'proteines', 'glucides', 'lipides', 'fibres', 'sucres', 'sodium'];

  function recipeNutrition(recipe, ingredients) {
    const byId = indexById(ingredients);
    const totals = { calories: 0, proteines: 0, glucides: 0, lipides: 0, fibres: 0, sucres: 0, sodium: 0 };
    let anyData = false;
    const missing = [];
    (recipe.lignes || []).forEach(l => {
      const ing = byId[l.ingredient_id];
      if (!ing) return;
      if (!ing.nutrition) { missing.push(ing.nom); return; }
      anyData = true;
      // nutrition exprimée par 100 g / 100 ml / piece / sachet
      const u = l.unite;
      let factor;
      if (u === 'kg') factor = l.quantite * 10;
      else if (u === 'g') factor = l.quantite / 100;
      else if (u === 'L') factor = l.quantite * 10;
      else if (u === 'ml') factor = l.quantite / 100;
      else factor = l.quantite; // piece, sachet
      NUTRI_KEYS.forEach(k => { totals[k] += (ing.nutrition[k] || 0) * factor; });
    });
    return { available: anyData, totals, missing: [...new Set(missing)] };
  }

  /* ---------- Tendances de prix (historique 30 jours) ---------- */
  function priceTrend(history) {
    if (!history || history.length < 2) return { pct: 0, old: 0, now: 0, alert: false };
    const old = history[0].prix;
    const now = history[history.length - 1].prix;
    const pct = old > 0 ? ((now - old) / old) * 100 : 0;
    return { pct, old, now, alert: pct > 5 }; // alerte = hausse > 5 % sur 30 jours
  }

  /* ---------- Helpers ---------- */
  function indexById(arr) {
    const o = {};
    (arr || []).forEach(x => { o[x.id] = x; });
    return o;
  }
  function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }
  function round(n, d = 0) { const p = Math.pow(10, d); return Math.round(n * p) / p; }
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  return {
    UNIT_FAMILIES, ALL_UNITS, DAILY_REF, NUTRI_KEYS,
    familyOf, compatibleUnits, canConvert, convert,
    ingredientCost, recipeCost, portionCost, foodCostPct,
    theoreticalPrice, marge, lineCost,
    recipeNutrition, priceTrend,
    indexById, clamp, round, uid,
  };
})();
