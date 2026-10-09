/* ============================================================
   DABALICOSTER V2 — Adaptateur Store ↔ Supabase
   Stratégie « cache + écritures synchronisées » :
   - boot() : hydrate le cache localStorage depuis la base (lectures
     synchrones inchangées pour tout le UI) ;
   - wrapWrites() : chaque mutation Store met à jour le cache PUIS
     réplique vers Supabase (fire-and-forget, toast en cas d'échec).
   - Les comptes (utilisateurs) ne passent QUE par les fonctions SQL
     bcrypt (register_user / login_user / admin_* / update_profile).
   ============================================================ */
const StoreDB = (() => {

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  let connected = false;

  const newUuid = () => (window.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });
  const ensureUuid = (obj) => { if (!obj.id || !UUID_RE.test(obj.id)) obj.id = newUuid(); return obj; };
  const today = () => new Date().toISOString().slice(0, 10);

  /* Ligne utilisateur « champs publics » → objet du cache V1 */
  function mapUser(u) {
    return {
      id: u.id, prenom: u.prenom, nom: u.nom, email: u.email,
      contact: u.contact || '', role: u.role, statut: u.statut,
      photo: u.photo || '', cree_le: String(u.cree_le || '').slice(0, 10),
    };
  }
  function cacheUser(u) {
    const users = Store.getUsers().filter(x => x.id !== u.id);
    users.push(u);
    Store.saveUsers(users);
  }

  /* ---------- Hydratation du cache depuis la base ---------- */
  async function hydrate() {
    // Paramètres
    const ps = await Supabase.select('parametres', 'id=eq.1');
    if (ps && ps[0]) Store.saveParams({ devise: ps[0].devise, objectif_food_cost: +ps[0].objectif_food_cost, tva: +ps[0].tva });

    // Ingrédients + historique 30 j
    const ings = await Supabase.select('ingredients', 'order=nom');
    const hist = await Supabase.select('historique_prix', 'order=date_prix');
    const byIng = {};
    hist.forEach(h => (byIng[h.ingredient_id] = byIng[h.ingredient_id] || []).push({ date: h.date_prix, prix: +h.prix }));
    ings.forEach(i => {
      i.prix_unitaire = +i.prix_unitaire;
      i.historique = byIng[i.id] || [];
      i.nutrition = i.nutrition || null;
    });
    Store.saveIngredients(ings);

    // Recettes + lignes
    const recs = await Supabase.select('recettes', 'order=nom');
    const lines = await Supabase.select('lignes_recette');
    const byRec = {};
    lines.forEach(l => (byRec[l.recette_id] = byRec[l.recette_id] || []).push({
      ingredient_id: l.ingredient_id, quantite: +l.quantite, unite: l.unite,
    }));
    recs.forEach(r => {
      r.portions = +r.portions; r.temps = +r.temps; r.prix_vente_ht = +r.prix_vente_ht;
      r.lignes = byRec[r.id] || [];
    });
    Store.saveRecipes(recs);

    // Menus + lignes
    const menus = await Supabase.select('menus', 'order=nom');
    const mlines = await Supabase.select('lignes_menu');
    const byMenu = {};
    mlines.forEach(l => (byMenu[l.menu_id] = byMenu[l.menu_id] || []).push({ recette_id: l.recette_id, quantite: +l.quantite }));
    menus.forEach(m => { m.lignes = byMenu[m.id] || []; });
    Store.saveMenus(menus);

    // Utilisateurs : jamais de SELECT direct (RLS). Selon le rôle :
    const s = Store.getSession();
    if (s) {
      if (s.role === 'administrateur') {
        const list = await Supabase.rpc('admin_list_users', { p_caller_id: s.userId });
        Store.saveUsers((list || []).map(mapUser));
      } else {
        const me = await Supabase.rpc('get_user', { p_id: s.userId });
        if (me && me[0]) Store.saveUsers([mapUser(me[0])]);
        else Store.clearSession();
      }
    }
  }

  /* ---------- Réplication des écritures vers Supabase ---------- */
  function remote(promiseFn) {
    promiseFn().catch(err => {
      console.error('[DABALI] Écriture Supabase en échec :', err);
      if (window.UI) UI.toast('⚠ Synchronisation base impossible : ' + Supabase.sqlMessage(err), 'error', 5000);
    });
  }

  const dbIng = i => ({
    id: i.id, nom: i.nom, categorie: i.categorie, unite: i.unite,
    prix_unitaire: i.prix_unitaire, fournisseur: i.fournisseur || null, nutrition: i.nutrition || null,
  });
  const dbRec = r => ({
    id: r.id, nom: r.nom, categorie: r.categorie, portions: r.portions, temps: r.temps,
    instructions: r.instructions || null, prix_vente_ht: r.prix_vente_ht, actif: true,
  });

  function wrapWrites() {
    const orig = {
      upsertIngredient: Store.upsertIngredient,
      updateIngredientPrice: Store.updateIngredientPrice,
      deleteIngredient: Store.deleteIngredient,
      upsertRecipe: Store.upsertRecipe,
      deleteRecipe: Store.deleteRecipe,
      addMenu: Store.addMenu,
      deleteMenu: Store.deleteMenu,
      saveParams: Store.saveParams,
      addUser: Store.addUser,
      updateUser: Store.updateUser,
      deleteUser: Store.deleteUser,
    };
    StoreDB.local = orig; // exposé pour le mode dégradé (Auth)

    Store.upsertIngredient = function (data) {
      ensureUuid(data);
      const r = orig.upsertIngredient(data);
      const row = Store.getIngredients().find(i => i.id === r.id);
      remote(() => Supabase.upsert('ingredients', [dbIng(row)]));
      return r;
    };
    Store.updateIngredientPrice = function (id, price) {
      const r = orig.updateIngredientPrice(id, price);
      remote(async () => {
        await Supabase.update('ingredients', 'id=eq.' + id, { prix_unitaire: price, date_prix: today() });
        await Supabase.upsert('historique_prix', [{ ingredient_id: id, date_prix: today(), prix: price }]);
      });
      return r;
    };
    Store.deleteIngredient = function (id) {
      const r = orig.deleteIngredient(id);
      remote(() => Supabase.del('ingredients', 'id=eq.' + id));
      return r;
    };
    Store.upsertRecipe = function (data) {
      ensureUuid(data);
      const r = orig.upsertRecipe(data);
      const row = Store.getRecipe(r.id);
      remote(async () => {
        await Supabase.upsert('recettes', [dbRec(row)]);
        if (data.lignes) {
          await Supabase.del('lignes_recette', 'recette_id=eq.' + r.id);
          if (row.lignes.length) {
            await Supabase.insert('lignes_recette', row.lignes.map(l => ({
              recette_id: r.id, ingredient_id: l.ingredient_id, quantite: l.quantite, unite: l.unite,
            })));
          }
        }
      });
      return r;
    };
    Store.deleteRecipe = function (id) {
      const r = orig.deleteRecipe(id);
      remote(() => Supabase.del('recettes', 'id=eq.' + id));
      return r;
    };
    Store.addMenu = function (name, lignes) {
      const m = orig.addMenu(name, lignes);
      const fixed = ensureUuid(Object.assign({}, m));
      if (fixed.id !== m.id) {
        const ms = Store.getMenus().map(x => (x.id === m.id ? Object.assign({}, x, { id: fixed.id }) : x));
        Store.saveMenus(ms);
        fixed.lignes = m.lignes;
      }
      remote(async () => {
        await Supabase.insert('menus', [{ id: fixed.id, nom: fixed.nom }]);
        if ((fixed.lignes || []).length) {
          await Supabase.insert('lignes_menu', fixed.lignes.map(l => ({
            menu_id: fixed.id, recette_id: l.recette_id, quantite: l.quantite,
          })));
        }
      });
      return fixed;
    };
    Store.deleteMenu = function (id) {
      const r = orig.deleteMenu(id);
      remote(() => Supabase.del('menus', 'id=eq.' + id));
      return r;
    };
    Store.saveParams = function (p) {
      const r = orig.saveParams(p);
      const cur = Store.getParams();
      remote(() => Supabase.upsert('parametres', [{
        id: 1, devise: cur.devise, objectif_food_cost: cur.objectif_food_cost, tva: cur.tva,
      }]));
      return r;
    };

    /* --- Comptes : fonctions SQL bcrypt uniquement --- */
    const callerId = () => { const s = Store.getSession(); return s ? s.userId : null; };
    const usersChanged = () => document.dispatchEvent(new CustomEvent('db:users-changed'));

    Store.addUser = function (data) {
      const temp = orig.addUser(data);                 // optimiste (cache)
      remote(async () => {
        const rows = await Supabase.rpc('admin_upsert_user', {
          p_caller_id: callerId(), p_id: null,
          p_prenom: data.prenom, p_nom: data.nom, p_email: data.email, p_contact: data.contact || null,
          p_role: data.role || 'utilisateur', p_statut: data.statut || 'actif',
          p_photo: data.photo || null, p_pwd: data.mot_de_passe || null,
        });
        const u = mapUser(rows[0]);
        Store.saveUsers(Store.getUsers().filter(x => x.id !== temp.id).concat([u]));
        usersChanged();
      });
      return temp;
    };
    Store.updateUser = function (id, patch) {
      const r = orig.updateUser(id, patch);
      remote(async () => {
        const merged = Store.findUserById(id) || r;
        const fn = (id === callerId()) ? 'update_profile' : 'admin_upsert_user';
        const params = (fn === 'update_profile')
          ? {
              p_id: id, p_prenom: merged.prenom, p_nom: merged.nom, p_email: merged.email,
              p_contact: merged.contact || null, p_photo: merged.photo || null,
              p_pwd: patch.mot_de_passe || null,
            }
          : {
              p_caller_id: callerId(), p_id: id,
              p_prenom: merged.prenom, p_nom: merged.nom, p_email: merged.email,
              p_contact: merged.contact || null, p_role: merged.role, p_statut: merged.statut,
              p_photo: merged.photo || null, p_pwd: patch.mot_de_passe || null,
            };
        const rows = await Supabase.rpc(fn, params);
        if (rows && rows[0]) cacheUser(mapUser(rows[0]));
        usersChanged();
      });
      return r;
    };
    Store.deleteUser = function (id) {
      const r = orig.deleteUser(id);
      remote(async () => {
        await Supabase.rpc('admin_delete_user', { p_caller_id: callerId(), p_id: id });
        usersChanged();
      });
      return r;
    };
  }

  /* ---------- Démarrage ---------- */
  async function boot() {
    try {
      await hydrate();
      connected = true;
      console.info('[DABALI] Connecté à Supabase — données hydratées depuis la base.');
    } catch (err) {
      connected = false;
      console.warn('[DABALI] Supabase injoignable (' + (err && err.message) + ') — mode local localStorage.');
    }
    if (!wrapped) { wrapped = true; wrapWrites(); }
    return connected;
  }
  let wrapped = false;

  const isConnected = () => connected;

  return { boot, hydrate, mapUser, cacheUser, isConnected, ensureUuid, local: null };
})();
