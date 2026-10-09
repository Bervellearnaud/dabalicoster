/* ============================================================
   DABALICOSTER — Store : contexte de données + persistance
   localStorage (équivalent lib/store.tsx de la version Next.js).
   ============================================================ */
const Store = (() => {

  const KEYS = {
    users: 'dabali_users',
    ingredients: 'dabali_ingredients',
    recipes: 'dabali_recipes',
    menus: 'dabali_menus',
    params: 'dabali_params',
    session: 'dabali_session',
    version: 'dabali_version',
  };
  const VERSION = 1;

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* quota */ }
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* ---------- Initialisation + enrichissement automatique ---------- */
  function init() {
    if (!localStorage.getItem(KEYS.ingredients)) write(KEYS.ingredients, clone(Seed.ingredients));
    if (!localStorage.getItem(KEYS.recipes)) write(KEYS.recipes, clone(Seed.recipes));
    if (!localStorage.getItem(KEYS.menus)) write(KEYS.menus, clone(Seed.menus));
    if (!localStorage.getItem(KEYS.users)) write(KEYS.users, clone(Seed.users));
    write(KEYS.params, Object.assign({}, Seed.params, read(KEYS.params, {})));
    enrich();
    write(KEYS.version, VERSION);
  }

  // Enrichissement au chargement : complète les entités existantes
  // avec les champs apportés par le seed (nutrition, historique, défauts).
  function enrich() {
    const ings = read(KEYS.ingredients, []);
    const seedIng = Core.indexById(Seed.ingredients);
    let changed = false;
    ings.forEach(i => {
      const s = seedIng[i.id];
      if (!s) return;
      if (i.nutrition === undefined) { i.nutrition = s.nutrition; changed = true; }
      if (!Array.isArray(i.historique) || i.historique.length === 0) { i.historique = clone(s.historique); changed = true; }
      if (!i.fournisseur) { i.fournisseur = s.fournisseur || ''; changed = true; }
      if (!i.categorie) { i.categorie = s.categorie || 'Autre'; changed = true; }
    });
    if (changed) write(KEYS.ingredients, ings);

    const users = read(KEYS.users, []);
    let uChanged = false;
    users.forEach(u => {
      if (!u.statut) { u.statut = 'actif'; uChanged = true; }
      if (!u.photo) { u.photo = ''; uChanged = true; }
      if (!u.contact) { u.contact = ''; uChanged = true; }
      if (!u.cree_le) { u.cree_le = new Date().toISOString().slice(0, 10); uChanged = true; }
    });
    if (uChanged) write(KEYS.users, users);
  }

  /* ---------- Utilisateurs ---------- */
  const getUsers = () => read(KEYS.users, []);
  const saveUsers = (u) => write(KEYS.users, u);
  function findUserByEmail(email) {
    return getUsers().find(u => u.email.toLowerCase() === String(email || '').trim().toLowerCase()) || null;
  }
  function findUserById(id) {
    return getUsers().find(u => u.id === id) || null;
  }
  function addUser(data) {
    const users = getUsers();
    const u = Object.assign({
      id: Core.uid(), prenom: '', nom: '', email: '', contact: '', mot_de_passe: '',
      role: 'utilisateur', statut: 'actif', photo: '',
      cree_le: new Date().toISOString().slice(0, 10),
    }, data);
    users.push(u); saveUsers(users); return u;
  }
  function updateUser(id, patch) {
    const users = getUsers();
    const i = users.findIndex(u => u.id === id);
    if (i === -1) return null;
    users[i] = Object.assign({}, users[i], patch);
    saveUsers(users); return users[i];
  }
  function deleteUser(id) {
    saveUsers(getUsers().filter(u => u.id !== id));
  }

  /* ---------- Ingrédients ---------- */
  const getIngredients = () => read(KEYS.ingredients, []);
  const saveIngredients = (i) => write(KEYS.ingredients, i);
  function upsertIngredient(data) {
    const ings = getIngredients();
    if (data.id) {
      const i = ings.findIndex(x => x.id === data.id);
      if (i !== -1) ings[i] = Object.assign({}, ings[i], data);
    } else {
      const ing = Object.assign({
        id: Core.uid(), nom: '', categorie: 'Autre', unite: 'kg',
        prix_unitaire: 0, fournisseur: '', nutrition: null,
        historique: [{ date: new Date().toISOString().slice(0, 10), prix: data.prix_unitaire || 0 }],
      }, data);
      ings.push(ing);
    }
    saveIngredients(ings);
    return data.id ? ings.find(x => x.id === data.id) : ings[ings.length - 1];
  }
  // Modification de prix => nouvelle entrée dans l'historique (tendance 30 j)
  function updateIngredientPrice(id, newPrice) {
    const ings = getIngredients();
    const ing = ings.find(x => x.id === id);
    if (!ing) return null;
    const today = new Date().toISOString().slice(0, 10);
    ing.prix_unitaire = newPrice;
    ing.historique = ing.historique || [];
    const last = ing.historique[ing.historique.length - 1];
    if (last && last.date === today) last.prix = newPrice;
    else ing.historique.push({ date: today, prix: newPrice });
    // fenêtre glissante 30 jours
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    ing.historique = ing.historique.filter(h => h.date >= cutoff);
    saveIngredients(ings);
    return ing;
  }
  function deleteIngredient(id) {
    saveIngredients(getIngredients().filter(x => x.id !== id));
  }

  /* ---------- Recettes ---------- */
  const getRecipes = () => read(KEYS.recipes, []);
  const saveRecipes = (r) => write(KEYS.recipes, r);
  function getRecipe(id) { return getRecipes().find(r => r.id === id) || null; }
  function upsertRecipe(data) {
    const rs = getRecipes();
    if (data.id) {
      const i = rs.findIndex(x => x.id === data.id);
      if (i !== -1) rs[i] = Object.assign({}, rs[i], data);
    } else {
      rs.push(Object.assign({
        id: Core.uid(), nom: '', categorie: 'Plats', portions: 4, temps: 30,
        prix_vente_ht: 0, instructions: '', lignes: [],
      }, data));
    }
    saveRecipes(rs);
    return data.id ? rs.find(x => x.id === data.id) : rs[rs.length - 1];
  }
  function deleteRecipe(id) {
    saveRecipes(getRecipes().filter(r => r.id !== id));
    // purge des lignes de menus référençant la recette
    const ms = getMenus();
    ms.forEach(m => { m.lignes = (m.lignes || []).filter(l => l.recette_id !== id); });
    saveMenus(ms);
  }

  /* ---------- Menus ---------- */
  const getMenus = () => read(KEYS.menus, []);
  const saveMenus = (m) => write(KEYS.menus, m);
  function addMenu(name, lignes) {
    const ms = getMenus();
    const m = { id: Core.uid(), nom: name, lignes };
    ms.push(m); saveMenus(ms); return m;
  }
  function deleteMenu(id) { saveMenus(getMenus().filter(m => m.id !== id)); }

  /* ---------- Paramètres ---------- */
  function getParams() {
    return Object.assign({}, Seed.params, read(KEYS.params, {}));
  }
  const saveParams = (p) => write(KEYS.params, Object.assign(getParams(), p));

  /* ---------- Session ---------- */
  const getSession = () => read(KEYS.session, null);
  function setSession(user) {
    write(KEYS.session, { userId: user.id, role: user.role, email: user.email, at: Date.now() });
  }
  function clearSession() { localStorage.removeItem(KEYS.session); }

  /* ---------- Réinitialisation de la démonstration ---------- */
  function resetDemo() {
    Object.values(KEYS).forEach(k => localStorage.removeItem(k));
    init();
  }

  /* ---------- Statistiques transverses ---------- */
  // Nombre de recettes et menus impactés par un ingrédient
  function usageCount(ingredientId) {
    const rec = getRecipes().filter(r => (r.lignes || []).some(l => l.ingredient_id === ingredientId)).length;
    const men = getMenus().filter(m => (m.lignes || []).some(l => {
      const r = getRecipe(l.recette_id);
      return r && (r.lignes || []).some(x => x.ingredient_id === ingredientId);
    })).length;
    return { recettes: rec, menus: men };
  }

  return {
    init, clone,
    getUsers, saveUsers, findUserByEmail, findUserById, addUser, updateUser, deleteUser,
    getIngredients, saveIngredients, upsertIngredient, updateIngredientPrice, deleteIngredient,
    getRecipes, saveRecipes, getRecipe, upsertRecipe, deleteRecipe,
    getMenus, saveMenus, addMenu, deleteMenu,
    getParams, saveParams,
    getSession, setSession, clearSession,
    resetDemo, usageCount,
  };
})();

Store.init();
