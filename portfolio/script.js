const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const prefersReducedMotion = reduceMotionQuery.matches;

const loadingScreen = document.querySelector('.loading-screen');
const cursor = document.querySelector('.cursor');
const cursorGlow = document.querySelector('.cursor-glow');
const navbar = document.querySelector('.navbar');
const hamburger = document.querySelector('.hamburger');
const navLinks = document.querySelector('.nav-links');
const backToTop = document.querySelector('.back-to-top');
const contactForm = document.querySelector('.contact-form');
const sections = document.querySelectorAll('main section[id]');
const navItems = document.querySelectorAll('.nav-link');
const revealItems = document.querySelectorAll('.reveal');
const magneticButtons = document.querySelectorAll('.magnetic');
const tiltItems = document.querySelectorAll('.tilt-card');

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });

revealItems.forEach((item) => revealObserver.observe(item));

if (!prefersReducedMotion) {
  document.body.classList.add('cursor-active');
}

window.addEventListener('mousemove', (event) => {
  if (prefersReducedMotion) return;
  cursor.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
  cursorGlow.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
});

window.addEventListener('scroll', () => {
  navbar.classList.toggle('shrink', window.scrollY > 24);
  backToTop.classList.toggle('visible', window.scrollY > 700);
});

hamburger.addEventListener('click', () => {
  hamburger.classList.toggle('active');
  navLinks.classList.toggle('open');
  hamburger.setAttribute('aria-expanded', hamburger.classList.contains('active'));
});

document.querySelectorAll('.nav-links a').forEach((link) => {
  link.addEventListener('click', () => {
    hamburger.classList.remove('active');
    navLinks.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
  });
});

const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      navItems.forEach((navItem) => navItem.classList.toggle('active', navItem.getAttribute('href') === `#${entry.target.id}`));
    }
  });
}, { threshold: 0.45 });

sections.forEach((section) => sectionObserver.observe(section));

magneticButtons.forEach((button) => {
  button.addEventListener('mousemove', (event) => {
    if (prefersReducedMotion) return;
    const rect = button.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const offsetX = (x / rect.width - 0.5) * 8;
    const offsetY = (y / rect.height - 0.5) * 8;
    button.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
  });

  button.addEventListener('mouseleave', () => {
    button.style.transform = '';
  });

  button.addEventListener('click', (event) => {
    if (prefersReducedMotion) return;
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    const rect = button.getBoundingClientRect();
    ripple.style.left = `${event.clientX - rect.left}px`;
    ripple.style.top = `${event.clientY - rect.top}px`;
    button.appendChild(ripple);
    setTimeout(() => ripple.remove(), 700);
  });
});

if (!prefersReducedMotion && window.VanillaTilt) {
  VanillaTilt.init(tiltItems, {
    max: 14,
    speed: 500,
    glare: true,
    'max-glare': 0.16,
    scale: 1.02
  });
}

if (window.Typed && document.querySelector('.typing-text')) {
  new Typed('.typing-text', {
    strings: ['Full Stack Developer', 'Frontend Engineer', 'AI Developer', 'UI Designer', 'Problem Solver'],
    typeSpeed: 70,
    backSpeed: 45,
    backDelay: 1100,
    loop: true
  });
}

if (window.gsap && window.ScrollTrigger) {
  gsap.registerPlugin(ScrollTrigger);
  gsap.from('.hero-title', { y: 50, opacity: 0, duration: 0.9, ease: 'power3.out', delay: 0.2 });
  gsap.from('.hero-subtitle', { y: 30, opacity: 0, duration: 0.8, ease: 'power3.out', delay: 0.35 });
  gsap.from('.hero-description', { y: 30, opacity: 0, duration: 0.8, ease: 'power3.out', delay: 0.5 });
  gsap.from('.hero-actions .btn', { y: 20, opacity: 0, stagger: 0.12, duration: 0.7, ease: 'power3.out', delay: 0.75 });
  gsap.from('.profile-card', { scale: 0.94, opacity: 0, duration: 1, ease: 'power3.out', delay: 0.5 });

  gsap.utils.toArray('.section-title, .section-subtitle, .glass-card, .skill-card, .project-card, .timeline-item').forEach((el) => {
    gsap.fromTo(el, { y: 28, opacity: 0 }, {
      y: 0,
      opacity: 1,
      duration: 0.8,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: el,
        start: 'top 86%'
      }
    });
  });
}

if (window.Lenis) {
  const lenis = new Lenis({ duration: 1.2, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true });
  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);
}

if (contactForm) {
  contactForm.addEventListener('submit', (event) => {
    event.preventDefault();
    alert('Thank you for reaching out! Your message has been sent. (This is a demo)');
    contactForm.reset();
  });
}

backToTop.addEventListener('click', (event) => {
  event.preventDefault();
  window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
});

window.addEventListener('load', () => {
  setTimeout(() => {
    loadingScreen.classList.add('hidden');
  }, 1300);
});

