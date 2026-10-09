/* ============================================================
   DABALICOSTER — Auth : comptes, session, rôles, protections
   (équivalent components/AuthProvider + RequireAuth)
   ============================================================ */
const Auth = (() => {

  const ROLE_LABELS = {
    utilisateur: 'Utilisateur',
    chef: 'Chef de restaurant',
    administrateur: 'Administrateur',
  };
  // Espace « maison » de chaque rôle après connexion
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

  /* ---------- Garde de route (côté application) ----------
     roles : tableau de rôles autorisés (null = tout compte connecté)
     Retourne l'utilisateur connecté ou redirige. */
  function requireAuth(roles) {
    const user = currentUser();
    if (!user) {
      location.replace('login.html?next=' + encodeURIComponent(currentURL()));
      return null;
    }
    if (roles && !roles.includes(user.role)) {
      // Aucune élévation possible : renvoi vers l'espace du rôle
      location.replace(ROLE_HOME[user.role] || 'espace.html');
      return null;
    }
    return user;
  }

  /* ---------- Connexion ---------- */
  function login(email, password, expectedRole) {
    const user = Store.findUserByEmail(email);
    if (!user || user.mot_de_passe !== password) {
      return { ok: false, error: 'Identifiants incorrects. Vérifiez votre e-mail et votre mot de passe.' };
    }
    if (user.statut !== 'actif') {
      return { ok: false, error: 'Ce compte est suspendu. Contactez un administrateur.' };
    }
    if (expectedRole && user.role !== expectedRole) {
      return { ok: false, error: 'Profil incohérent : ce compte est enregistré comme « ' + (ROLE_LABELS[user.role] || user.role) + ' ». Sélectionnez le bon profil.' };
    }
    Store.setSession(user);
    return { ok: true, user };
  }

  /* ---------- Inscription (réelle, persistée) ---------- */
  function register(data) {
    if (!data.prenom || !data.nom) return { ok: false, error: 'Le prénom et le nom sont obligatoires.' };
    const email = String(data.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, error: 'Adresse e-mail invalide.' };
    if (Store.findUserByEmail(email)) return { ok: false, error: 'Cet e-mail est déjà utilisé par un compte existant.' };
    const pwd = String(data.mot_de_passe || '');
    if (pwd.length < 6 || !/\d/.test(pwd)) return { ok: false, error: 'Le mot de passe doit contenir au moins 6 caractères dont 1 chiffre.' };
    if (pwd !== data.confirmation) return { ok: false, error: 'La confirmation ne correspond pas au mot de passe.' };
    // Sans auto-élévation : uniquement Utilisateur ou Chef à l'inscription
    const role = data.role === 'chef' ? 'chef' : 'utilisateur';
    const user = Store.addUser({
      prenom: data.prenom.trim(), nom: data.nom.trim(), email,
      contact: (data.contact || '').trim(), mot_de_passe: pwd, role,
      statut: 'actif', photo: '',
    });
    return { ok: true, user };
  }

  function logout() {
    Store.clearSession();
    location.href = 'index.html';
  }

  function homeFor(role) { return ROLE_HOME[role] || 'espace.html'; }
  function roleLabel(role) { return ROLE_LABELS[role] || role; }

  return { currentUser, requireAuth, login, register, logout, homeFor, roleLabel, ROLE_LABELS };
})();
