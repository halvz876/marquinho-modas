/* Navegação e destaques da vitrine. Sem dependências ou chamadas externas. */
(() => {
  'use strict';

  // Start every visit/reload at the storefront, including a restored catalog URL.
  // Category links continue to work normally once the page has opened.
  try {
    window.history.scrollRestoration = 'manual';
    if (window.location.hash) window.history.replaceState(null, '', window.location.href.split('#')[0]);
  } catch (_) { /* Some file:// browsers restrict history updates. */ }
  const startAtTop = () => window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  window.addEventListener('pageshow', startAtTop);
  requestAnimationFrame(startAtTop);

  const header = document.querySelector('.site-header');
  const menuButton = document.getElementById('menu-toggle');
  const mobileMenu = document.getElementById('mobile-navigation');
  const desktop = window.matchMedia('(min-width: 1061px)');

  function closeMenu(restoreFocus = false) {
    if (!menuButton || !mobileMenu) return;
    const wasOpen = !mobileMenu.hidden;
    mobileMenu.hidden = true;
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'Abrir menu de categorias');
    if (restoreFocus && wasOpen && !desktop.matches) menuButton.focus();
  }

  if (header && menuButton && mobileMenu) {
    menuButton.addEventListener('click', () => {
      const opening = mobileMenu.hidden;
      mobileMenu.hidden = !opening;
      menuButton.setAttribute('aria-expanded', String(opening));
      menuButton.setAttribute('aria-label', opening ? 'Fechar menu de categorias' : 'Abrir menu de categorias');
    });
    header.addEventListener('click', event => {
      if (event.target.closest('[data-category], [data-action], .brand')) closeMenu();
    });
    document.addEventListener('click', event => {
      if (!header.contains(event.target)) closeMenu();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !mobileMenu.hidden) {
        closeMenu(true);
        event.preventDefault();
      }
    });
    header.addEventListener('focusout', () => {
      requestAnimationFrame(() => {
        if (!header.contains(document.activeElement)) closeMenu();
      });
    });
    desktop.addEventListener('change', () => closeMenu());
  }

  const carousel = document.getElementById('home-carousel');
  if (!carousel) return;
  const slides = [...carousel.querySelectorAll('[data-slide]')];
  const dots = [...carousel.querySelectorAll('[data-slide-to]')];
  const live = document.getElementById('carousel-status');
  const currentLabel = document.getElementById('carousel-current');
  const help = document.getElementById('carousel-help');
  if (help) help.textContent = 'Cinco destaques da coleção, com troca automática a cada quatro segundos. Use as setas laterais ou os indicadores para escolher um destaque. A troca também pausa enquanto você navega pelo teclado ou usa uma janela da loja.';
  let current = 0;
  let focusPaused = false;
  let focusOverride = null;
  let dialogOpen = Boolean(document.querySelector('dialog[open]'));
  let timer = null;
  let touchStart = null;

  function clearTimer() {
    if (timer !== null) window.clearTimeout(timer);
    timer = null;
  }

  function schedule() {
    clearTimer();
    dialogOpen = Boolean(document.querySelector('dialog[open]'));
    const canRotate = !focusPaused && !document.hidden && !dialogOpen;
    carousel.dataset.rotating = String(canRotate);
    if (canRotate) timer = window.setTimeout(() => showSlide(current + 1), 4000);
  }

  function showSlide(index, announce = false) {
    current = (index + slides.length) % slides.length;
    slides.forEach((slide, i) => {
      const active = i === current;
      slide.classList.toggle('is-active', active);
      slide.setAttribute('aria-hidden', String(!active));
      slide.inert = !active;
    });
    dots.forEach((dot, i) => {
      const active = i === current;
      dot.classList.toggle('is-active', active);
      dot.setAttribute('aria-current', active ? 'true' : 'false');
    });
    currentLabel.textContent = String(current + 1).padStart(2, '0');
    if (announce) live.textContent = `Destaque ${current + 1} de ${slides.length}: ${slides[current].dataset.title}.`;
    schedule();
  }

  carousel.addEventListener('click', event => {
    const control = event.target.closest('button');
    if (!control) return;
    // An explicit action takes precedence over the temporary keyboard-focus pause.
    if (control.hasAttribute('data-slide-to') || control.dataset.carousel) {
      focusOverride = control;
      focusPaused = false;
    }
    if (control.hasAttribute('data-slide-to')) showSlide(Number(control.dataset.slideTo), true);
    if (control.dataset.carousel === 'previous') showSlide(current - 1, true);
    if (control.dataset.carousel === 'next') showSlide(current + 1, true);
  });

  carousel.addEventListener('keydown', event => {
    const dot = event.target.closest('[data-slide-to]');
    if (!dot || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? slides.length - 1 : current + (event.key === 'ArrowRight' ? 1 : -1);
    focusOverride = dots[(index + dots.length) % dots.length];
    focusPaused = false;
    showSlide(index, true);
    dots[current].focus();
  });
  carousel.addEventListener('focusin', event => {
    const control = event.target.closest('button, a');
    focusPaused = Boolean(control && control !== focusOverride);
    schedule();
  });
  carousel.addEventListener('focusout', () => {
    requestAnimationFrame(() => {
      if (!carousel.contains(document.activeElement)) {
        focusPaused = false;
        focusOverride = null;
      } else {
        const control = document.activeElement.closest('button, a');
        focusPaused = Boolean(control && control !== focusOverride);
      }
      schedule();
    });
  });
  document.addEventListener('visibilitychange', schedule);
  window.addEventListener('pagehide', clearTimer);
  window.addEventListener('pageshow', schedule);
  const dialogObserver = new MutationObserver(() => {
    const isOpen = Boolean(document.querySelector('dialog[open]'));
    if (isOpen !== dialogOpen) { dialogOpen = isOpen; schedule(); }
  });
  dialogObserver.observe(document.body, { attributes: true, attributeFilter: ['open'], childList: true, subtree: true });

  const stage = carousel.querySelector('.carousel-stage');
  stage.addEventListener('pointerdown', event => {
    if (event.pointerType === 'touch' && !event.target.closest('a, button')) touchStart = { x: event.clientX, y: event.clientY };
  }, { passive: true });
  stage.addEventListener('pointerup', event => {
    if (!touchStart) return;
    const dx = event.clientX - touchStart.x;
    const dy = event.clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      focusPaused = false;
      focusOverride = carousel.contains(document.activeElement) ? document.activeElement : null;
      showSlide(current + (dx < 0 ? 1 : -1), true);
    }
  }, { passive: true });
  stage.addEventListener('pointercancel', () => { touchStart = null; });

  showSlide(0);
})();
