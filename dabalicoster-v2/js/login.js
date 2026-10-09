/* ============================================================
   DABALICOSTER — Page /login
   ============================================================ */
(function () {

  // Déjà connecté ? Retour direct à l'espace du rôle.
  const existing = Auth.currentUser();
  const params = new URLSearchParams(location.search);
  const next = params.get('next');
  if (existing && !next) location.replace(Auth.homeFor(existing.role));

  const errBox = document.getElementById('form-error');
  const form = document.getElementById('login-form');
  const btn = document.getElementById('btn-login');

  function showError(msg) {
    errBox.textContent = msg;
    errBox.classList.add('show');
  }
  function clearError() { errBox.classList.remove('show'); }

  // Erreur de session expirée renvoyée par les gardes
  if (params.get('erreur') === 'session') showError('Votre session a expiré. Veuillez vous reconnecter.');

  // E-mail pré-rempli depuis l'inscription
  if (params.get('email')) {
    document.getElementById('email').value = params.get('email');
    document.getElementById('password').focus();
  }

  /* ---------- Photos en fondu + Ken Burns ---------- */
  const photos = document.querySelectorAll('.auth-photo');
  const dots = document.querySelectorAll('#photo-dots span');
  let pi = 0;
  if (photos.length > 1) {
    setInterval(() => {
      photos[pi].classList.remove('on');
      dots[pi] && dots[pi].classList.remove('on');
      pi = (pi + 1) % photos.length;
      photos[pi].classList.add('on');
      dots[pi] && dots[pi].classList.add('on');
    }, 5200);
  }

  /* ---------- Affichage masquable du mot de passe ---------- */
  document.getElementById('toggle-pwd').addEventListener('click', function () {
    const inp = document.getElementById('password');
    const shown = inp.type === 'text';
    inp.type = shown ? 'password' : 'text';
    this.textContent = shown ? '👁' : '🙈';
    this.setAttribute('aria-label', shown ? 'Afficher le mot de passe' : 'Masquer le mot de passe');
  });

  /* ---------- Comptes de démonstration (pré-remplissage) ---------- */
  document.querySelectorAll('.demo-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      clearError();
      document.getElementById('email').value = chip.dataset.email;
      document.getElementById('password').value = chip.dataset.pwd;
      const radio = form.querySelector('input[name="role"][value="' + chip.dataset.role + '"]');
      if (radio) radio.checked = true;
    });
  });

  /* ---------- Soumission ---------- */
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    clearError();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const role = form.querySelector('input[name="role"]:checked').value;

    if (!email || !password) { showError('Veuillez renseigner votre e-mail et votre mot de passe.'); return; }

    // État de chargement
    btn.classList.add('loading');
    btn.disabled = true;

    setTimeout(async () => {
      const res = await Auth.login(email, password, role);
      btn.classList.remove('loading');
      btn.disabled = false;
      if (!res.ok) { showError(res.error); return; }
      const target = next ? decodeURIComponent(next) : Auth.homeFor(res.user.role);
      location.href = target;
    }, 600);
  });

})();
