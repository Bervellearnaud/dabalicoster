/* ============================================================
   DABALICOSTER V2 — Auth : inscription & connexion CONTRE LA BASE
   - login_user / register_user / account_status : fonctions SQL
     SECURITY DEFINER, hachage bcrypt côté PostgreSQL (le hash ne
     transite jamais).
   - Repli local (localStorage) si Supabase est injoignable, pour que
     la démo reste utilisable hors ligne.
   ============================================================ */
const Auth = (() => {

  const ROLE_LABELS = {
    utilisateur: 'Utilisateur',
    chef: 'Chef de restaurant',
    administrateur: 'Administrateur',
  };
  const ROLE_HOME = {
    utilisateur: 'espace.html',
    chef: 'app.html',
    administrateur: 'app.html',
  };

  function currentUser() {
    const s = Store.getSession();
    if (!s) return null;
    const u = Store.findUserById(s.userId);
    if (!u || u.statut !== 'actif') { Store.clearSession(); return null; }
    return u;
  }

  function currentURL() {
    const page = location.pathname.split('/').pop() || 'index.html';
    return page + location.search + location.hash;
  }

  function requireAuth(roles) {
    const user = currentUser();
    if (!user) {
      location.replace('login.html?next=' + encodeURIComponent(currentURL()));
      return null;
    }
    if (roles && !roles.includes(user.role)) {
      location.replace(ROLE_HOME[user.role] || 'espace.html');
      return null;
    }
    return user;
  }

  /* ---------- Repli local (mode dégradé hors ligne) ---------- */
  function localLogin(email, password, expectedRole) {
    const user = Store.findUserByEmail(email);
    if (!user || user.mot_de_passe !== password) {
      return { ok: false, error: 'Identifiants incorrects. Vérifiez votre e-mail et votre mot de passe.' };
    }
    if (user.statut !== 'actif') return { ok: false, error: 'Ce compte est suspendu. Contactez un administrateur.' };
    if (expectedRole && user.role !== expectedRole) {
      return { ok: false, error: 'Profil incohérent : ce compte est enregistré comme « ' + (ROLE_LABELS[user.role] || user.role) + ' ». Sélectionnez le bon profil.' };
    }
    Store.setSession(user);
    return { ok: true, user };
  }

  function localRegister(data) {
    if (!data.prenom || !data.nom) return { ok: false, error: 'Le prénom et le nom sont obligatoires.' };
    const email = String(data.email || '').trim().toLowerCase();
    if (Store.findUserByEmail(email)) return { ok: false, error: 'Cet e-mail est déjà utilisé par un compte existant.' };
    const role = data.role === 'chef' ? 'chef' : 'utilisateur';
    const users = Store.getUsers();
    const user = {
      id: StoreDB.ensureUuid({}).id || null, prenom: data.prenom.trim(), nom: data.nom.trim(),
      email, contact: (data.contact || '').trim(), mot_de_passe: data.mot_de_passe,
      role, statut: 'actif', photo: '', cree_le: new Date().toISOString().slice(0, 10),
    };
    user.id = StoreDB.ensureUuid(user).id;
    users.push(user);
    Store.saveUsers(users);
    return { ok: true, user };
  }

  /* ---------- Connexion (bcrypt vérifié EN BASE) ---------- */
  async function login(email, password, expectedRole) {
    let rows;
    try {
      rows = await Supabase.rpc('login_user', { p_email: String(email || '').trim(), p_pwd: password });
    } catch (err) {
      if (Supabase.isNetworkError(err)) return localLogin(email, password, expectedRole);
      return { ok: false, error: Supabase.sqlMessage(err) };
    }
    if (!rows || !rows.length) {
      let statut = 'inconnu';
      try { statut = await Supabase.rpc('account_status', { p_email: String(email || '').trim() }); } catch (e) { /* silencieux */ }
      if (statut === 'suspendu') return { ok: false, error: 'Ce compte est suspendu. Contactez un administrateur.' };
      return { ok: false, error: 'Identifiants incorrects. Vérifiez votre e-mail et votre mot de passe.' };
    }
    const user = StoreDB.mapUser(rows[0]);
    if (expectedRole && user.role !== expectedRole) {
      return { ok: false, error: 'Profil incohérent : ce compte est enregistré comme « ' + (ROLE_LABELS[user.role] || user.role) + ' ». Sélectionnez le bon profil.' };
    }
    StoreDB.cacheUser(user);
    Store.setSession(user);
    return { ok: true, user };
  }

  /* ---------- Inscription réelle (INSERT haché bcrypt en base) ---------- */
  async function register(data) {
    // Contrôles UX côté client (re-vérifiés en base par register_user)
    if (!data.prenom || !data.nom) return { ok: false, error: 'Le prénom et le nom sont obligatoires.' };
    const email = String(data.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, error: 'Adresse e-mail invalide.' };
    const pwd = String(data.mot_de_passe || '');
    if (pwd.length < 6 || !/\d/.test(pwd)) return { ok: false, error: 'Le mot de passe doit contenir au moins 6 caractères dont 1 chiffre.' };
    if (pwd !== data.confirmation) return { ok: false, error: 'La confirmation ne correspond pas au mot de passe.' };

    try {
      const rows = await Supabase.rpc('register_user', {
        p_prenom: data.prenom, p_nom: data.nom, p_email: email,
        p_contact: data.contact || null, p_pwd: pwd,
        p_role: data.role === 'chef' ? 'chef' : 'utilisateur',   // pas d'auto-élévation
      });
      return { ok: true, user: StoreDB.mapUser(rows[0]) };
    } catch (err) {
      if (Supabase.isNetworkError(err)) return localRegister(Object.assign({}, data, { mot_de_passe: pwd }));
      return { ok: false, error: Supabase.sqlMessage(err) };
    }
  }

  function logout() {
    Store.clearSession();
    location.href = 'index.html';
  }

  function homeFor(role) { return ROLE_HOME[role] || 'espace.html'; }
  function roleLabel(role) { return ROLE_LABELS[role] || role; }

  return { currentUser, requireAuth, login, register, logout, homeFor, roleLabel, ROLE_LABELS };
})();
