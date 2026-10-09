/* ============================================================
   DABALICOSTER — Page /inscription (réelle, persistée)
   ============================================================ */
(function () {

  const form = document.getElementById('register-form');
  const errBox = document.getElementById('form-error');
  const okBox = document.getElementById('form-success');
  const btn = document.getElementById('btn-register');

  function showError(msg) {
    okBox.classList.remove('show');
    errBox.textContent = msg;
    errBox.classList.add('show');
    errBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /* ---------- Affichage masquable ---------- */
  document.querySelectorAll('.eye-btn[data-toggle]').forEach(b => {
    b.addEventListener('click', () => {
      const inp = document.getElementById(b.dataset.toggle);
      const shown = inp.type === 'text';
      inp.type = shown ? 'password' : 'text';
      b.textContent = shown ? '👁' : '🙈';
    });
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    errBox.classList.remove('show');
    okBox.classList.remove('show');

    const data = {
      prenom: document.getElementById('prenom').value,
      nom: document.getElementById('nom').value,
      email: document.getElementById('email').value,
      contact: document.getElementById('contact').value,
      role: document.getElementById('role').value,
      mot_de_passe: document.getElementById('password').value,
      confirmation: document.getElementById('confirmation').value,
    };

    // Contrôles côté formulaire (le moteur Auth re-vérifie tout)
    if (!data.prenom.trim() || !data.nom.trim()) { showError('Le prénom et le nom sont obligatoires.'); return; }

    btn.classList.add('loading');
    btn.disabled = true;

    setTimeout(() => {
      const res = Auth.register(data);
      btn.classList.remove('loading');
      btn.disabled = false;
      if (!res.ok) { showError(res.error); return; }

      okBox.textContent = 'Votre compte a été créé avec succès. Vous pouvez maintenant vous connecter.';
      okBox.classList.add('show');
      form.reset();
      // Redirection pré-remplie vers /login
      setTimeout(() => {
        location.href = 'login.html?email=' + encodeURIComponent(res.user.email);
      }, 1800);
    }, 600);
  });

})();
