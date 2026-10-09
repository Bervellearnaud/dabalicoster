/* ============================================================
   DABALICOSTER — Landing : intro animée, marquee, FAQ, reveal
   ============================================================ */
(function () {

  /* ---------- INTRO : braises champagne + transition ---------- */
  const intro = document.getElementById('intro');
  if (intro && !sessionStorage.getItem('dabali_intro_seen')) {
    const canvas = document.getElementById('embers');
    const ctx = canvas.getContext('2d');
    let W, H, embers = [], raf, done = false;

    function resize() {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    for (let i = 0; i < 70; i++) {
      embers.push({
        x: Math.random() * W,
        y: H + Math.random() * H,
        r: 0.8 + Math.random() * 2.2,
        vy: 0.4 + Math.random() * 1.4,
        vx: (Math.random() - 0.5) * 0.35,
        a: 0.15 + Math.random() * 0.6,
        tw: Math.random() * Math.PI * 2,
      });
    }

    function tick() {
      ctx.clearRect(0, 0, W, H);
      // fumée légère
      const g = ctx.createRadialGradient(W / 2, H * 0.65, 40, W / 2, H * 0.65, Math.max(W, H) * 0.55);
      g.addColorStop(0, 'rgba(109,74,168,0.05)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      // braises
      embers.forEach(e => {
        e.y -= e.vy; e.x += e.vx; e.tw += 0.05;
        if (e.y < -10) { e.y = H + 10; e.x = Math.random() * W; }
        const alpha = e.a * (0.6 + 0.4 * Math.sin(e.tw));
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(228,196,119,' + alpha.toFixed(3) + ')';
        ctx.shadowColor = 'rgba(228,196,119,0.8)';
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
      });
      // vignette profonde
      const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.32, W / 2, H / 2, Math.max(W, H) * 0.75);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, 'rgba(10,5,20,0.5)');
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, W, H);
      if (!done) raf = requestAnimationFrame(tick);
    }
    tick();

    function finish() {
      if (done) return;
      done = true;
      sessionStorage.setItem('dabali_intro_seen', '1');
      intro.classList.add('done');
      cancelAnimationFrame(raf);
      setTimeout(() => intro.remove(), 900);
    }
    document.getElementById('intro-skip').addEventListener('click', finish);
    setTimeout(finish, 4200); // expérience rapide, non bloquante
  } else if (intro) {
    intro.remove();
  }

  /* ---------- Marquee clients : duplication pour boucle ---------- */
  const marquee = document.getElementById('marquee');
  if (marquee) marquee.innerHTML += marquee.innerHTML;

  /* ---------- FAQ accordéons fluides ---------- */
  document.querySelectorAll('.faq-item').forEach(item => {
    const q = item.querySelector('.faq-q');
    const a = item.querySelector('.faq-a');
    q.addEventListener('click', () => {
      const open = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(o => {
        o.classList.remove('open');
        o.querySelector('.faq-a').style.maxHeight = '0px';
      });
      if (!open) {
        item.classList.add('open');
        a.style.maxHeight = a.scrollHeight + 'px';
      }
    });
  });

  /* ---------- Reveal au scroll (fade-up) ---------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add('visible'); io.unobserve(en.target); }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));

  /* ---------- Nav mobile ---------- */
  const burger = document.getElementById('nav-burger');
  if (burger) burger.addEventListener('click', () => {
    document.getElementById('nav').classList.toggle('open');
  });
  document.querySelectorAll('.nav-links a').forEach(a =>
    a.addEventListener('click', () => document.getElementById('nav').classList.remove('open'))
  );

})();
