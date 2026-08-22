const PRODUCTS = [
  {
    id: "ip12-battery",
    model: "iPhone 12",
    part: "Batterie",
    title: "Batterie compatible iPhone 12",
    description: "Exemple de fiche produit à remplacer par ton vrai article.",
    image: "https://images.unsplash.com/photo-1609592424824-3e5f4f1f8c9d?auto=format&fit=crop&w=900&q=80",
    amazon: "https://www.amazon.fr/"
  },
  {
    id: "ip13-screen",
    model: "iPhone 13",
    part: "Écran",
    title: "Écran compatible iPhone 13",
    description: "Exemple de fiche produit à remplacer par ton vrai article.",
    image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=80",
    amazon: "https://www.amazon.fr/"
  },
  {
    id: "s22-battery",
    model: "Galaxy S22",
    part: "Batterie",
    title: "Batterie compatible Galaxy S22",
    description: "Exemple de fiche produit à remplacer par ton vrai article.",
    image: "https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=900&q=80",
    amazon: "https://www.amazon.fr/"
  },
  {
    id: "s21-back",
    model: "Galaxy S21",
    part: "Vitre arrière",
    title: "Vitre arrière compatible Galaxy S21",
    description: "Exemple de fiche produit à remplacer par ton vrai article.",
    image: "https://images.unsplash.com/photo-1585060544812-6b45742d762f?auto=format&fit=crop&w=900&q=80",
    amazon: "https://www.amazon.fr/"
  },
  {
    id: "ip11-camera",
    model: "iPhone 11",
    part: "Caméra",
    title: "Module caméra compatible iPhone 11",
    description: "Exemple de fiche produit à remplacer par ton vrai article.",
    image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=900&q=80",
    amazon: "https://www.amazon.fr/"
  },
  {
    id: "a54-screen",
    model: "Galaxy A54",
    part: "Écran",
    title: "Écran compatible Galaxy A54",
    description: "Exemple de fiche produit à remplacer par ton vrai article.",
    image: "https://images.unsplash.com/photo-1523206489230-c012c64b2b48?auto=format&fit=crop&w=900&q=80",
    amazon: "https://www.amazon.fr/"
  }
];

const CONTACT_EMAIL = "dgm91.pro@gmail.com";

const $ = (selector) => document.querySelector(selector);

const grid = $("#product-grid");
const search = $("#search");
const model = $("#model");
const part = $("#part");
const empty = $("#empty");
const contactForm = $("#contact-form");
const formStatus = $("#form-status");
const reportDialog = $("#report-dialog");
const reportLink = $("#report-link");

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[character]));
}

function uniqueValues(key) {
  return [...new Set(PRODUCTS.map((product) => product[key]))].sort();
}

function populateFilters() {
  uniqueValues("model").forEach((value) => {
    model.insertAdjacentHTML(
      "beforeend",
      `<option value="${escapeHTML(value)}">${escapeHTML(value)}</option>`
    );
  });

  uniqueValues("part").forEach((value) => {
    part.insertAdjacentHTML(
      "beforeend",
      `<option value="${escapeHTML(value)}">${escapeHTML(value)}</option>`
    );
  });
}

function renderProducts() {
  const query = search.value.trim().toLowerCase();

  const products = PRODUCTS.filter((product) => {
    const matchesModel = model.value === "all" || product.model === model.value;
    const matchesPart = part.value === "all" || product.part === part.value;
    const haystack = `${product.title} ${product.model} ${product.part} ${product.description}`.toLowerCase();
    const matchesSearch = !query || haystack.includes(query);

    return matchesModel && matchesPart && matchesSearch;
  });

  grid.innerHTML = products.map((product) => `
    <article class="product-card">
      <img
        class="product-image"
        src="${escapeHTML(product.image)}"
        alt="${escapeHTML(product.title)}"
        loading="lazy"
        referrerpolicy="no-referrer"
      >
      <div class="product-body">
        <span class="tag">${escapeHTML(product.part)} · ${escapeHTML(product.model)}</span>
        <h3>${escapeHTML(product.title)}</h3>
        <p>${escapeHTML(product.description)}</p>
        <div class="card-actions">
          <a
            class="button primary"
            href="${escapeHTML(product.amazon)}"
            target="_blank"
            rel="noopener noreferrer sponsored"
          >Voir l’article ↗</a>
          <button class="button report" type="button" data-report="${escapeHTML(product.id)}">Signaler</button>
        </div>
      </div>
    </article>
  `).join("");

  empty.hidden = products.length !== 0;
}

function prepareReport(product) {
  const messageField = contactForm.querySelector('[name="message"]');
  if (!messageField) return;

  messageField.value = [
    `Bonjour,`,
    ``,
    `Je signale que le lien suivant semble indisponible :`,
    product.amazon,
    ``,
    `Article : ${product.title}`,
    `Modèle : ${product.model}`,
    `Pièce : ${product.part}`,
    ``,
    `Merci.`
  ].join('\n');

  reportDialog.close();
  document.querySelector('#contact').scrollIntoView({ behavior: 'smooth', block: 'start' });
  setTimeout(() => messageField.focus(), 500);
}

async function submitContactForm(event) {
  event.preventDefault();

  if (!contactForm.reportValidity()) return;

  const submitButton = contactForm.querySelector('button[type="submit"]');
  const originalText = submitButton.innerHTML;
  const formData = new FormData(contactForm);

  submitButton.disabled = true;
  submitButton.innerHTML = 'Envoi en cours…';
  formStatus.className = 'form-status is-loading';
  formStatus.textContent = 'Envoi en cours…';

  try {
    const response = await fetch(contactForm.action, {
      method: 'POST',
      body: formData,
      headers: { Accept: 'application/json' }
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result.errors?.[0]?.message || result.error || 'Impossible d’envoyer le message.');
    }

    contactForm.reset();
    formStatus.className = 'form-status is-success';
    formStatus.textContent = 'Message envoyé avec succès !';
  } catch (error) {
    console.error('Erreur formulaire de contact:', error);
    formStatus.className = 'form-status is-error';
    formStatus.textContent = 'Impossible d’envoyer le message. Vérifie ta connexion puis réessaie.';
  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML = originalText;
  }
}

function openReport(product) {
  reportLink.onclick = (event) => {
    event.preventDefault();
    prepareReport(product);
  };
  reportDialog.showModal();
}

function setupNavigation() {
  const toggle = $(".menu-toggle");
  const nav = $(".nav");

  toggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });

  nav.addEventListener("click", (event) => {
    if (event.target.matches("a")) {
      nav.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    }
  });
}

function setupCompatibilityPanel() {
  const toggle = $("#compat-toggle");
  const panel = $("#compat-panel");

  if (!toggle || !panel) return;

  toggle.addEventListener("click", () => {
    const isOpening = panel.hasAttribute("hidden");

    panel.toggleAttribute("hidden", !isOpening);
    toggle.setAttribute("aria-expanded", String(isOpening));
  });
}

function setupRevealAnimations() {
  const elements = document.querySelectorAll(".reveal");

  if (!("IntersectionObserver" in window)) {
    elements.forEach((element) => element.classList.add("visible"));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;

      entry.target.classList.add("visible");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12 });

  elements.forEach((element) => observer.observe(element));
}

function setupEvents() {
  [search, model, part].forEach((element) => {
    element.addEventListener("input", renderProducts);
    element.addEventListener("change", renderProducts);
  });

  grid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-report]");
    if (!button) return;

    const product = PRODUCTS.find(({ id }) => id === button.dataset.report);
    if (product) openReport(product);
  });

  contactForm.addEventListener("submit", submitContactForm);
}

function init() {
  populateFilters();
  setupEvents();
  setupNavigation();
  setupCompatibilityPanel();
  setupRevealAnimations();

  $("#year").textContent = new Date().getFullYear();
  renderProducts();
}

init();
