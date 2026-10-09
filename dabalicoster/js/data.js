/* ============================================================
   DABALICOSTER — Données de démonstration (cuisine ivoirienne)
   Comptes, ingrédients (prix FCFA, historique 30 j, nutrition),
   recettes, menus, paramètres.
   ============================================================ */
const Seed = (() => {

  /* ---------- Générateur d'historique de prix 30 jours (déterministe) ---------- */
  function makeHistory(base, driftPct, seedNum, days = 30) {
    // driftPct : variation totale exacte ancien -> courant sur la période
    // (ex: +11 => le prix est passé de base/1.11 à base => alerte hausse > 5 %)
    let s = seedNum;
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    const start = base / (1 + driftPct / 100);
    const out = [];
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 86400000);
      const t = (days - 1 - i) / (days - 1); // 0 -> 1
      // bruit ±2 % atténué aux extrémités pour des sparklines naturelles
      const noise = (rnd() - 0.5) * 0.04 * start * Math.sin(Math.PI * (1 - t));
      const prix = Math.max(1, Math.round(start + (base - start) * t + noise));
      out.push({ date: d.toISOString().slice(0, 10), prix });
    }
    out[0].prix = Math.max(1, Math.round(start));   // ancien prix exact
    out[out.length - 1].prix = base;                 // prix courant exact
    return out;
  }

  /* ---------- Comptes de démonstration ---------- */
  const users = [
    {
      id: 'u-chef', prenom: "N'Guessan", nom: 'Kouassi', email: 'chef@dabalicoster.ci',
      contact: '+225 07 08 09 10 11', mot_de_passe: 'chef2026', role: 'chef',
      statut: 'actif', photo: '', cree_le: '2026-08-01',
    },
    {
      id: 'u-user', prenom: 'Awa', nom: 'Traoré', email: 'user@dabalicoster.ci',
      contact: '+225 05 06 07 08 09', mot_de_passe: 'user2026', role: 'utilisateur',
      statut: 'actif', photo: '', cree_le: '2026-08-12',
    },
    {
      id: 'u-admin', prenom: 'Yves', nom: 'VOOMNET', email: 'admin@voomnet.ci',
      contact: '+225 27 22 44 55 66', mot_de_passe: 'admin2026', role: 'administrateur',
      statut: 'actif', photo: '', cree_le: '2026-07-15',
    },
    {
      id: 'u-stag', prenom: 'Kouadio', nom: 'Yao', email: 'stagiaire@dabalicoster.ci',
      contact: '+225 01 02 03 04 05', mot_de_passe: 'stagiaire2026', role: 'utilisateur',
      statut: 'suspendu', photo: '', cree_le: '2026-09-02',
    },
  ];

  /* ---------- Référentiel ingrédients (extraits du cahier + compléments) ---------- */
  // nutrition : par 100 g / 100 ml / piece / sachet — le Capitaine est volontairement sans données
  const ingredients = [
    { id: 'i-poulet', nom: 'Poulet entier frais', categorie: 'Viandes & poissons', unite: 'kg', prix_unitaire: 4700, fournisseur: 'Volailles du Bandama',
      historique: makeHistory(4700, 2, 11),
      nutrition: { calories: 215, proteines: 18.6, glucides: 0, lipides: 15, fibres: 0, sucres: 0, sodium: 74 } },
    { id: 'i-thon', nom: 'Thon frais', categorie: 'Viandes & poissons', unite: 'kg', prix_unitaire: 4500, fournisseur: 'Marché de Treichville',
      historique: makeHistory(4500, 3, 12),
      nutrition: { calories: 130, proteines: 28, glucides: 0, lipides: 1.3, fibres: 0, sucres: 0, sodium: 43 } },
    { id: 'i-capitaine', nom: 'Capitaine', categorie: 'Viandes & poissons', unite: 'kg', prix_unitaire: 4000, fournisseur: 'Marché de Treichville',
      historique: makeHistory(4000, -2, 13),
      nutrition: null }, // démonstration « Donnée nutritionnelle indisponible »
    { id: 'i-attieke', nom: 'Attiéké', categorie: 'Féculents', unite: 'kg', prix_unitaire: 800, fournisseur: 'Coopérative d\u2019Adjamé',
      historique: makeHistory(800, 1, 14),
      nutrition: { calories: 190, proteines: 1.5, glucides: 42, lipides: 0.4, fibres: 2, sucres: 0.5, sodium: 10 } },
    { id: 'i-plantain', nom: 'Banane plantain', categorie: 'Féculents', unite: 'kg', prix_unitaire: 700, fournisseur: 'Marché de Cocody',
      historique: makeHistory(700, -3, 15),
      nutrition: { calories: 122, proteines: 1.3, glucides: 32, lipides: 0.4, fibres: 2.3, sucres: 15, sodium: 4 } },
    { id: 'i-huile-ara', nom: 'Huile d\u2019arachide', categorie: 'Huiles & sauces', unite: 'L', prix_unitaire: 1400, fournisseur: 'Distributeur Sania',
      historique: makeHistory(1400, 12, 16), // hausse > 5 % => alerte
      nutrition: { calories: 884, proteines: 0, glucides: 0, lipides: 100, fibres: 0, sucres: 0, sodium: 0 } },
    { id: 'i-huile-palme', nom: 'Huile de palme rouge', categorie: 'Huiles & sauces', unite: 'L', prix_unitaire: 1500, fournisseur: 'Moulin de Bonoua',
      historique: makeHistory(1500, 4, 17),
      nutrition: { calories: 884, proteines: 0, glucides: 0, lipides: 100, fibres: 0, sucres: 0, sodium: 0 } },
    { id: 'i-tomate', nom: 'Tomate fraîche', categorie: 'Légumes', unite: 'kg', prix_unitaire: 1000, fournisseur: 'Marché de Cocody',
      historique: makeHistory(1000, 11, 18), // alerte
      nutrition: { calories: 18, proteines: 0.9, glucides: 3.9, lipides: 0.2, fibres: 1.2, sucres: 2.6, sodium: 5 } },
    { id: 'i-oignon', nom: 'Oignon', categorie: 'Légumes', unite: 'kg', prix_unitaire: 900, fournisseur: 'Grossiste Adjamé',
      historique: makeHistory(900, 12.5, 19), // alerte
      nutrition: { calories: 40, proteines: 1.1, glucides: 9.3, lipides: 0.1, fibres: 1.7, sucres: 4.2, sodium: 4 } },
    { id: 'i-aubergine', nom: 'Aubergine africaine', categorie: 'Légumes', unite: 'kg', prix_unitaire: 1000, fournisseur: 'Marché de Treichville',
      historique: makeHistory(1000, -4, 20),
      nutrition: { calories: 25, proteines: 1, glucides: 6, lipides: 0.2, fibres: 3, sucres: 3.5, sodium: 2 } },
    { id: 'i-piment', nom: 'Piment frais', categorie: 'Légumes', unite: 'kg', prix_unitaire: 1500, fournisseur: 'Marché de Cocody',
      historique: makeHistory(1500, 7, 21), // alerte
      nutrition: { calories: 40, proteines: 2, glucides: 9, lipides: 0.2, fibres: 1.5, sucres: 5, sodium: 7 } },
    { id: 'i-graines', nom: 'Graines de palme', categorie: 'Huiles & sauces', unite: 'kg', prix_unitaire: 1200, fournisseur: 'Moulin de Bonoua',
      historique: makeHistory(1200, 3, 22),
      nutrition: { calories: 250, proteines: 5, glucides: 10, lipides: 20, fibres: 4, sucres: 2, sodium: 3 } },
    { id: 'i-cube', nom: 'Cube assaisonnement', categorie: 'Épices', unite: 'piece', prix_unitaire: 50, fournisseur: 'Grossiste Adjamé',
      historique: makeHistory(50, 0, 23),
      nutrition: { calories: 20, proteines: 1, glucides: 2, lipides: 1, fibres: 0, sucres: 0.5, sodium: 1000 } },
    { id: 'i-sel', nom: 'Sel fin', categorie: 'Épices', unite: 'kg', prix_unitaire: 300, fournisseur: 'Grossiste Adjamé',
      historique: makeHistory(300, 1, 24),
      nutrition: { calories: 0, proteines: 0, glucides: 0, lipides: 0, fibres: 0, sucres: 0, sodium: 38000 } },
    { id: 'i-ail', nom: 'Ail', categorie: 'Épices', unite: 'kg', prix_unitaire: 2500, fournisseur: 'Grossiste Adjamé',
      historique: makeHistory(2500, 2, 25),
      nutrition: { calories: 149, proteines: 6.4, glucides: 33, lipides: 0.5, fibres: 2.1, sucres: 1, sodium: 17 } },
    { id: 'i-gingembre', nom: 'Gingembre', categorie: 'Épices', unite: 'kg', prix_unitaire: 2000, fournisseur: 'Marché de Cocody',
      historique: makeHistory(2000, -1, 26),
      nutrition: { calories: 80, proteines: 1.8, glucides: 18, lipides: 0.8, fibres: 2, sucres: 1.7, sodium: 13 } },
    { id: 'i-poivre', nom: 'Poivre noir (sachet)', categorie: 'Épices', unite: 'sachet', prix_unitaire: 500, fournisseur: 'Grossiste Adjamé',
      historique: makeHistory(500, 0, 27),
      nutrition: { calories: 25, proteines: 1, glucides: 6, lipides: 0.3, fibres: 2.5, sucres: 0.1, sodium: 2 } },
    { id: 'i-mayo', nom: 'Mayonnaise (sachet)', categorie: 'Huiles & sauces', unite: 'sachet', prix_unitaire: 450, fournisseur: 'Distributeur Sania',
      historique: makeHistory(450, 6, 28), // alerte
      nutrition: { calories: 130, proteines: 0.2, glucides: 1, lipides: 14, fibres: 0, sucres: 0.8, sodium: 120 } },
  ];

  /* ---------- Recettes de démonstration ----------
     Coûts recalculés par le moteur (proches du tableau du cahier) :
     Poulet braisé & attiéké ≈ 3 118 F/portion (41,6 %)
     Sauce graine            ≈ 1 227 F/portion (40,9 %)
     Garba thon              ≈ 1 213 F/portion (48,5 %)
     Alloco                  ≈ 617 F/portion  (41,1 %) */
  const recipes = [
    {
      id: 'r-poulet', nom: 'Poulet braisé & attiéké', categorie: 'Grillades',
      portions: 4, temps: 90, prix_vente_ht: 7500,
      instructions: "Mariner le poulet (ail, gingembre, piment, cube) 2 h. Braiser au feu de bois en retournant régulièrement. Servir avec l'attiéké, la sauce tomate-oignon et un citron.",
      lignes: [
        { ingredient_id: 'i-poulet', quantite: 1.8, unite: 'kg' },
        { ingredient_id: 'i-attieke', quantite: 2.5, unite: 'kg' },
        { ingredient_id: 'i-tomate', quantite: 0.6, unite: 'kg' },
        { ingredient_id: 'i-oignon', quantite: 0.5, unite: 'kg' },
        { ingredient_id: 'i-huile-ara', quantite: 0.2, unite: 'L' },
        { ingredient_id: 'i-ail', quantite: 0.1, unite: 'kg' },
        { ingredient_id: 'i-gingembre', quantite: 0.05, unite: 'kg' },
        { ingredient_id: 'i-cube', quantite: 4, unite: 'piece' },
        { ingredient_id: 'i-sel', quantite: 0.03, unite: 'kg' },
        { ingredient_id: 'i-piment', quantite: 0.05, unite: 'kg' },
        { ingredient_id: 'i-poivre', quantite: 0.1, unite: 'sachet' },
      ],
    },
    {
      id: 'r-sauce-graine', nom: 'Sauce graine', categorie: 'Sauces & plats',
      portions: 6, temps: 75, prix_vente_ht: 3000,
      instructions: "Faire bouillir les graines de palme puis les écraser et tamiser pour obtenir le jus. Mijoter le jus avec aubergines, tomate, oignon, poisson et épices 45 min jusqu'à consistance nappante.",
      lignes: [
        { ingredient_id: 'i-graines', quantite: 2, unite: 'kg' },
        { ingredient_id: 'i-capitaine', quantite: 0.5, unite: 'kg' },
        { ingredient_id: 'i-aubergine', quantite: 1, unite: 'kg' },
        { ingredient_id: 'i-tomate', quantite: 0.8, unite: 'kg' },
        { ingredient_id: 'i-oignon', quantite: 0.5, unite: 'kg' },
        { ingredient_id: 'i-huile-palme', quantite: 0.2, unite: 'L' },
        { ingredient_id: 'i-cube', quantite: 4, unite: 'piece' },
        { ingredient_id: 'i-piment', quantite: 0.1, unite: 'kg' },
        { ingredient_id: 'i-sel', quantite: 0.05, unite: 'kg' },
        { ingredient_id: 'i-ail', quantite: 0.02, unite: 'kg' },
      ],
    },
    {
      id: 'r-garba', nom: 'Garba thon', categorie: 'Street food',
      portions: 4, temps: 30, prix_vente_ht: 2500,
      instructions: "Frire le thon en tranches épaisses, bien doré. Servir généreusement sur l'attiéké avec rondelles d'oignon et de tomate, mayonnaise et piment.",
      lignes: [
        { ingredient_id: 'i-thon', quantite: 0.6, unite: 'kg' },
        { ingredient_id: 'i-attieke', quantite: 1.4, unite: 'kg' },
        { ingredient_id: 'i-oignon', quantite: 0.15, unite: 'kg' },
        { ingredient_id: 'i-tomate', quantite: 0.2, unite: 'kg' },
        { ingredient_id: 'i-mayo', quantite: 1, unite: 'sachet' },
        { ingredient_id: 'i-piment', quantite: 0.05, unite: 'kg' },
        { ingredient_id: 'i-cube', quantite: 2, unite: 'piece' },
        { ingredient_id: 'i-huile-ara', quantite: 0.05, unite: 'L' },
      ],
    },
    {
      id: 'r-alloco', nom: 'Alloco', categorie: 'Accompagnements',
      portions: 4, temps: 25, prix_vente_ht: 1500,
      instructions: "Éplucher et couper les plantains mûrs en biseaux. Frire à l'huile chaude jusqu'à coloration dorée. Saler légèrement, accompagner de sauce piment-tomate.",
      lignes: [
        { ingredient_id: 'i-plantain', quantite: 3, unite: 'kg' },
        { ingredient_id: 'i-huile-ara', quantite: 0.2, unite: 'L' },
        { ingredient_id: 'i-sel', quantite: 0.02, unite: 'kg' },
        { ingredient_id: 'i-piment', quantite: 0.02, unite: 'kg' },
        { ingredient_id: 'i-tomate', quantite: 0.05, unite: 'kg' },
      ],
    },
  ];

  /* ---------- Menus de démonstration ---------- */
  const menus = [
    {
      id: 'm-formule-midi', nom: 'Formule Midi Garba',
      lignes: [
        { recette_id: 'r-garba', quantite: 2 },
        { recette_id: 'r-alloco', quantite: 1 },
      ],
    },
  ];

  /* ---------- Paramètres par défaut ---------- */
  const params = { devise: 'XOF', objectif_food_cost: 35, tva: 18 };

  return { users, ingredients, recipes, menus, params, makeHistory };
})();
