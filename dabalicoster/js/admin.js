/* ============================================================
   DABALICOSTER — /admin : gestion complète des comptes
   Accès : Administrateur uniquement
   ============================================================ */
(function () {

  const me = Auth.requireAuth(['administrateur']);
  if (!me) return;

  const view = document.getElementById('view');
  document.getElementById('devise-chip').textContent = Store.getParams().devise;

  document.getElementById('side-user').innerHTML =
    '<span class="avatar">' + (me.photo ? '<img src="' + UI.esc(me.photo) + '" alt="">' : UI.initials(me)) + '</span>' +
    '<span><strong>' + UI.esc(me.prenom + ' ' + me.nom) + '</strong><span>Administrateur</span></span>';
  document.getElementById('btn-logout').addEventListener('click', () => Auth.logout());

  const ROLES = [['utilisateur', 'Utilisateur'], ['chef', 'Chef de restaurant'], ['administrateur', 'Administrateur']];

  function render() {
    const users = Store.getUsers();
    view.innerHTML =
      '<div class="page-head"><div><h1>Administration des comptes</h1><p>' + users.length + ' compte(s) — nom, e-mail, contact, mot de passe, rôle, statut et photo.</p></div>' +
      '<button class="btn btn-gold" id="btn-add-user">+ Ajouter un utilisateur</button></div>' +
      '<div class="card" style="padding:0;"><div class="table-wrap"><table class="data">' +
      '<thead><tr><th>Utilisateur</th><th>E-mail</th><th>Contact</th><th>Rôle</th><th>Statut</th><th>Créé le</th><th></th></tr></thead><tbody>' +
      users.map(u =>
        '<tr>' +
        '<td><div style="display:flex;align-items:center;gap:11px;"><span class="avatar" style="width:34px;height:34px;font-size:12px;">' +
          (u.photo ? '<img src="' + UI.esc(u.photo) + '" alt="">' : UI.initials(u)) + '</span>' +
          '<span><strong>' + UI.esc(u.prenom) + ' ' + UI.esc(u.nom) + '</strong>' + (u.id === me.id ? ' <small style="color:var(--or-app);">(vous)</small>' : '') + '</small></span></div></td>' +
        '<td>' + UI.esc(u.email) + '</td>' +
        '<td>' + UI.esc(u.contact || '—') + '</td>' +
        '<td><span class="badge badge-role">' + Auth.roleLabel(u.role) + '</span></td>' +
        '<td><span class="badge badge-statut-' + u.statut + '">' + (u.statut === 'actif' ? 'Actif' : 'Suspendu') + '</span></td>' +
        '<td>' + UI.dateFR(u.cree_le) + '</td>' +
        '<td><div class="row-actions">' +
          '<button class="btn btn-ghost btn-sm" data-edit="' + u.id + '">Modifier</button>' +
          (u.id !== me.id ? '<button class="btn btn-ghost btn-sm" data-toggle="' + u.id + '">' + (u.statut === 'actif' ? 'Suspendre' : 'Réactiver') + '</button>' +
          '<button class="btn btn-danger btn-sm" data-del="' + u.id + '">Supprimer</button>' : '') +
        '</div></td></tr>'
      ).join('') + '</tbody></table></div></div>';

    document.getElementById('btn-add-user').addEventListener('click', () => userModal(null));
    view.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () =>
      userModal(Store.findUserById(b.dataset.edit))));
    view.querySelectorAll('[data-toggle]').forEach(b => b.addEventListener('click', async () => {
      const u = Store.findUserById(b.dataset.toggle);
      const to = u.statut === 'actif' ? 'suspendu' : 'actif';
      const ok = await UI.confirmDialog(
        to === 'suspendu'
          ? 'Suspendre le compte de ' + UI.esc(u.prenom + ' ' + u.nom) + ' ? Il ne pourra plus se connecter.'
          : 'Réactiver le compte de ' + UI.esc(u.prenom + ' ' + u.nom) + ' ?',
        { title: to === 'suspendu' ? 'Suspendre le compte' : 'Réactiver le compte', danger: to === 'suspendu', okLabel: to === 'suspendu' ? 'Suspendre' : 'Réactiver' });
      if (!ok) return;
      Store.updateUser(u.id, { statut: to });
      UI.toast('Compte ' + (to === 'suspendu' ? 'suspendu' : 'réactivé') + ' : ' + UI.esc(u.prenom + ' ' + u.nom) + '.', 'ok');
      render();
    }));
    view.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
      const u = Store.findUserById(b.dataset.del);
      const ok = await UI.confirmDialog('Supprimer définitivement le compte de ' + UI.esc(u.prenom + ' ' + u.nom) + ' (' + UI.esc(u.email) + ') ?',
        { title: 'Suppression de compte', danger: true, okLabel: 'Supprimer' });
      if (!ok) return;
      Store.deleteUser(u.id);
      UI.toast('Compte supprimé.', 'ok');
      render();
    }));
  }

  function userModal(u) {
    const editing = !!u;
    const isSelf = editing && u.id === me.id;
    const body =
      '<div class="form-error" id="m-err"></div>' +
      '<div class="field-row">' +
        '<div class="field"><label>Prénom *</label><input id="f-prenom" value="' + (editing ? UI.esc(u.prenom) : '') + '"></div>' +
        '<div class="field"><label>Nom *</label><input id="f-nom" value="' + (editing ? UI.esc(u.nom) : '') + '"></div>' +
      '</div>' +
      '<div class="field"><label>E-mail *</label><input id="f-email" type="email" value="' + (editing ? UI.esc(u.email) : '') + '"></div>' +
      '<div class="field"><label>Contact téléphonique</label><input id="f-contact" value="' + (editing ? UI.esc(u.contact || '') : '') + '" placeholder="+225 …"></div>' +
      '<div class="field"><label>' + (editing ? 'Nouveau mot de passe (laisser vide pour conserver)' : 'Mot de passe *') + '</label>' +
        '<input id="f-pwd" type="text" placeholder="6 caractères min. dont 1 chiffre"><p class="field-hint">6 caractères minimum, dont au moins 1 chiffre.</p></div>' +
      '<div class="field-row">' +
        '<div class="field"><label>Rôle *</label><select id="f-role"' + (isSelf ? ' disabled' : '') + '>' +
          ROLES.map(([v, l]) => '<option value="' + v + '"' + (editing && u.role === v ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></div>' +
        '<div class="field"><label>Statut *</label><select id="f-statut"' + (isSelf ? ' disabled' : '') + '>' +
          '<option value="actif"' + (editing && u.statut === 'actif' ? ' selected' : '') + '>Actif</option>' +
          '<option value="suspendu"' + (editing && u.statut === 'suspendu' ? ' selected' : '') + '>Suspendu</option></select></div>' +
      '</div>' +
      '<div class="field"><label>Photo (URL, optionnel)</label><input id="f-photo" value="' + (editing ? UI.esc(u.photo || '') : '') + '" placeholder="https://…"></div>';

    UI.modal({
      title: editing ? 'Modifier — ' + u.prenom + ' ' + u.nom : 'Ajouter un utilisateur',
      body,
      actions: [
        { label: 'Annuler', class: 'btn-ghost', value: null },
        {
          label: editing ? 'Enregistrer' : 'Créer le compte', class: 'btn-gold',
          onClick: (root) => {
            const g = (id) => root.querySelector(id).value.trim();
            const err = root.querySelector('#m-err');
            const fail = (msg) => { err.textContent = msg; err.classList.add('show'); return true; };
            const prenom = g('#f-prenom'), nom = g('#f-nom'), email = g('#f-email').toLowerCase();
            const pwd = g('#f-pwd');
            if (!prenom || !nom) return fail('Le prénom et le nom sont obligatoires.');
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return fail('Adresse e-mail invalide.');
            const dup = Store.findUserByEmail(email);
            if (dup && (!editing || dup.id !== u.id)) return fail('Cet e-mail est déjà utilisé par un autre compte.');
            if (!editing && !pwd) return fail('Le mot de passe est obligatoire à la création.');
            if (pwd && (pwd.length < 6 || !/\d/.test(pwd))) return fail('Le mot de passe doit contenir au moins 6 caractères dont 1 chiffre.');

            const patch = {
              prenom, nom, email,
              contact: g('#f-contact'),
              photo: g('#f-photo'),
              role: isSelf ? u.role : root.querySelector('#f-role').value,
              statut: isSelf ? u.statut : root.querySelector('#f-statut').value,
            };
            if (pwd) patch.mot_de_passe = pwd;

            if (editing) {
              Store.updateUser(u.id, patch);
              UI.toast('Compte de ' + UI.esc(prenom + ' ' + nom) + ' mis à jour.', 'ok');
            } else {
              Store.addUser(Object.assign({ mot_de_passe: pwd }, patch));
              UI.toast('Compte créé : ' + UI.esc(email) + ' (' + Auth.roleLabel(patch.role) + ').', 'ok');
            }
            return false;
          },
        },
      ],
    }).then(() => render());
  }

  render();
})();
