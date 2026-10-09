/* ============================================================
   DABALICOSTER — /espace : espace personnel (tout compte connecté)
   Profil + aperçu de la plateforme
   ============================================================ */
(function () {

  const me = Auth.requireAuth(null); // tout compte connecté
  if (!me) return;

  const view = document.getElementById('view');
  const p = Store.getParams();
  document.getElementById('devise-chip').textContent = p.devise;

  // Navigation latérale selon le rôle
  if (me.role !== 'utilisateur') {
    document.getElementById('link-app').hidden = false;
    document.getElementById('sep-app').hidden = false;
  }
  if (me.role === 'administrateur') document.getElementById('link-admin').hidden = false;

  function sideUser(u) {
    document.getElementById('side-user').innerHTML =
      '<span class="avatar">' + (u.photo ? '<img src="' + UI.esc(u.photo) + '" alt="">' : UI.initials(u)) + '</span>' +
      '<span><strong>' + UI.esc(u.prenom + ' ' + u.nom) + '</strong><span>' + Auth.roleLabel(u.role) + '</span></span>';
  }
  sideUser(me);
  document.getElementById('btn-logout').addEventListener('click', () => Auth.logout());

  function render() {
    const user = Store.findUserById(me.id);
    const recipes = Store.getRecipes();
    const ingredients = Store.getIngredients();
    const menus = Store.getMenus();
    const canApp = user.role !== 'utilisateur';

    const avgFC = recipes.length
      ? recipes.reduce((s, r) => s + Core.foodCostPct(Core.portionCost(r, ingredients), r.prix_vente_ht), 0) / recipes.length
      : 0;

    view.innerHTML =
      '<div class="page-head"><div><h1>Espace personnel</h1><p>Votre profil et un aperçu de la plateforme DABALICOSTER.</p></div></div>' +
      '<div class="espace-grid">' +
        '<div style="display:grid;gap:18px;">' +
          '<div class="card profile-card">' +
            '<span class="avatar">' + (user.photo ? '<img src="' + UI.esc(user.photo) + '" alt="">' : UI.initials(user)) + '</span>' +
            '<h2>' + UI.esc(user.prenom + ' ' + user.nom) + '</h2>' +
            '<div class="role-badge"><span class="badge badge-role">' + Auth.roleLabel(user.role) + '</span> <span class="badge badge-statut-' + user.statut + '">' + (user.statut === 'actif' ? 'Actif' : 'Suspendu') + '</span></div>' +
            '<div class="profile-rows">' +
              '<div class="profile-row"><span>E-mail</span><b>' + UI.esc(user.email) + '</b></div>' +
              '<div class="profile-row"><span>Contact</span><b>' + UI.esc(user.contact || '—') + '</b></div>' +
              '<div class="profile-row"><span>Membre depuis</span><b>' + UI.dateFR(user.cree_le) + '</b></div>' +
              '<div class="profile-row"><span>Identifiant</span><b style="font-family:monospace;font-size:12px;">' + UI.esc(user.id) + '</b></div>' +
            '</div>' +
            '<button class="btn btn-primary" id="btn-edit-profile" style="width:100%;margin-top:18px;">✏️ Modifier mon profil</button>' +
          '</div>' +
        '</div>' +
        '<div style="display:grid;gap:18px;">' +
          '<div class="card"><h3>Aperçu de la plateforme</h3><p class="card-sub">Données actuelles de votre établissement (démonstration cuisine ivoirienne).</p>' +
            '<div class="kpi-grid" style="margin-bottom:0;grid-template-columns:repeat(3,1fr);">' +
              '<div class="kpi-mini"><small>Recettes</small><strong>' + recipes.length + '</strong></div>' +
              '<div class="kpi-mini"><small>Ingrédients</small><strong>' + ingredients.length + '</strong></div>' +
              '<div class="kpi-mini"><small>Food Cost moyen</small><strong>' + (recipes.length ? UI.pct(avgFC) : '—') + '</strong></div>' +
            '</div>' +
            '<div style="display:flex;gap:10px;margin-top:18px;flex-wrap:wrap;">' +
              (canApp
                ? '<a class="btn btn-gold" href="app.html#/dashboard">📊 Ouvrir le tableau de bord</a>' +
                  '<a class="btn btn-ghost" href="app.html#/recettes">📋 Voir les recettes</a>' +
                  '<a class="btn btn-ghost" href="app.html#/menus">🍽️ Menu Builder</a>'
                : '<span class="badge badge-role" style="padding:10px 14px;">🔒 Modules métier réservés aux profils Chef et Administrateur</span>') +
              (user.role === 'administrateur' ? '<a class="btn btn-ghost" href="admin.html">🛡️ Administration des comptes</a>' : '') +
            '</div>' +
          '</div>' +
          '<div class="card"><h3>Vos menus enregistrés</h3><p class="card-sub">' + menus.length + ' menu(s) — recalculés en continu selon les prix du référentiel.</p>' +
            (menus.length
              ? '<div class="saved-menus">' + menus.map(m => {
                  const rs = Store.getRecipes();
                  let cout = 0;
                  (m.lignes || []).forEach(l => {
                    const r = rs.find(x => x.id === l.recette_id);
                    if (r) cout += Core.portionCost(r, ingredients) * l.quantite;
                  });
                  return '<div class="saved-menu"><div><strong>' + UI.esc(m.nom) + '</strong><small>' + (m.lignes || []).length + ' recette(s)</small></div><b>' + UI.money(cout) + '</b></div>';
                }).join('') + '</div>'
              : '<div class="empty-state"><span class="big">🍽️</span>Aucun menu enregistré pour le moment.</div>') +
          '</div>' +
        '</div>' +
      '</div>';

    document.getElementById('btn-edit-profile').addEventListener('click', () => profileModal(user));
  }

  function profileModal(user) {
    const body =
      '<div class="form-error" id="m-err"></div>' +
      '<div class="field-row">' +
        '<div class="field"><label>Prénom *</label><input id="f-prenom" value="' + UI.esc(user.prenom) + '"></div>' +
        '<div class="field"><label>Nom *</label><input id="f-nom" value="' + UI.esc(user.nom) + '"></div>' +
      '</div>' +
      '<div class="field"><label>E-mail *</label><input id="f-email" type="email" value="' + UI.esc(user.email) + '"></div>' +
      '<div class="field"><label>Contact téléphonique</label><input id="f-contact" value="' + UI.esc(user.contact || '') + '"></div>' +
      '<div class="field"><label>Photo (URL, optionnel)</label><input id="f-photo" value="' + UI.esc(user.photo || '') + '" placeholder="https://…"></div>' +
      '<div class="field"><label>Nouveau mot de passe (laisser vide pour conserver)</label>' +
        '<input id="f-pwd" type="text" placeholder="6 caractères min. dont 1 chiffre"></div>';

    UI.modal({
      title: 'Modifier mon profil', body,
      actions: [
        { label: 'Annuler', class: 'btn-ghost', value: null },
        {
          label: 'Enregistrer', class: 'btn-gold',
          onClick: (root) => {
            const g = (id) => root.querySelector(id).value.trim();
            const err = root.querySelector('#m-err');
            const fail = (msg) => { err.textContent = msg; err.classList.add('show'); return true; };
            const prenom = g('#f-prenom'), nom = g('#f-nom'), email = g('#f-email').toLowerCase(), pwd = g('#f-pwd');
            if (!prenom || !nom) return fail('Le prénom et le nom sont obligatoires.');
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return fail('Adresse e-mail invalide.');
            const dup = Store.findUserByEmail(email);
            if (dup && dup.id !== user.id) return fail('Cet e-mail est déjà utilisé par un autre compte.');
            if (pwd && (pwd.length < 6 || !/\d/.test(pwd))) return fail('Le mot de passe doit contenir au moins 6 caractères dont 1 chiffre.');
            const patch = { prenom, nom, email, contact: g('#f-contact'), photo: g('#f-photo') };
            if (pwd) patch.mot_de_passe = pwd;
            Store.updateUser(user.id, patch);
            Store.setSession(Store.findUserById(user.id));
            UI.toast('Profil mis à jour.', 'ok');
            return false;
          },
        },
      ],
    }).then((v) => { if (v !== null) { sideUser(Store.findUserById(user.id)); render(); } });
  }

  render();
})();
