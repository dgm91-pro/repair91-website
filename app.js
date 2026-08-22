let PRODUCTS = [];

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
  while (model.options.length > 1) model.remove(1);
  while (part.options.length > 1) part.remove(1);

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
  if (!PRODUCTS.length) {
    grid.innerHTML = "";
    if (empty) {
      empty.hidden = false;
      empty.textContent = "Aucun produit dans le catalogue.";
    }
    return;
  }

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
        decoding="async"
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

  if (empty) {
    empty.hidden = products.length !== 0;
    if (products.length === 0) {
      empty.textContent = "Ton article n’est pas inscrit dans le Shop, contacte-moi pour la réparation.";
    }
  }
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
  ].join("\n");

  reportDialog.close();
  document.querySelector("#contact").scrollIntoView({ behavior: "smooth", block: "start" });
  setTimeout(() => messageField.focus(), 500);
}

let captchaState = "pending"; // "pending" | "ready" | "unavailable"

function watchCaptcha() {
  const container = document.querySelector(".h-captcha");
  if (!container) {
    captchaState = "unavailable";
    return;
  }

  const markReadyIfRendered = () => {
    if (container.querySelector("iframe")) {
      captchaState = "ready";
      return true;
    }
    return false;
  };

  if (markReadyIfRendered()) return;

  const observer = new MutationObserver(() => {
    if (markReadyIfRendered()) observer.disconnect();
  });
  observer.observe(container, { childList: true, subtree: true });

  // Si le widget n'apparaît jamais (bloqueur de pub, captcha non activé sur
  // la clé Web3Forms, CDN hCaptcha injoignable...), on ne bloque pas
  // indéfiniment l'envoi : Web3Forms retombe alors sur le honeypot côté
  // serveur pour filtrer le spam.
  setTimeout(() => {
    if (captchaState === "pending") {
      captchaState = "unavailable";
      observer.disconnect();
    }
  }, 4000);
}

function getCaptchaResponse() {
  const captcha = contactForm?.querySelector('textarea[name="h-captcha-response"]');
  if (captcha && captcha.value && captcha.value.trim().length > 0) {
    return captcha.value.trim();
  }
  const hidden = contactForm?.querySelector('input[name="h-captcha-response"]');
  if (hidden && hidden.value && hidden.value.trim().length > 0) {
    return hidden.value.trim();
  }
  return "";
}

async function submitContactForm(event) {
  event.preventDefault();

  if (!contactForm.reportValidity()) return;

  // Sur file:// le captcha ne charge pas → on prévient clairement
  const isFileProtocol = location.protocol === "file:";
  const captchaResponse = getCaptchaResponse();

  if (!captchaResponse && captchaState !== "unavailable") {
    formStatus.className = "form-status is-error";
    if (isFileProtocol) {
      formStatus.textContent = "Le captcha ne fonctionne pas en ouvrant le fichier localement. Déploie le site (GitHub Pages) ou utilise un serveur local (Live Server).";
    } else if (captchaState === "pending") {
      formStatus.textContent = "Le contrôle anti-robot se charge encore, réessaie dans un instant.";
    } else {
      formStatus.textContent = "Merci de valider le contrôle anti-robot (captcha) avant d’envoyer.";
      contactForm.querySelector(".h-captcha")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    return;
  }

  const submitButton = contactForm.querySelector('button[type="submit"]');
  const originalText = submitButton.innerHTML;
  const formData = new FormData(contactForm);

  submitButton.disabled = true;
  submitButton.innerHTML = "Envoi en cours…";
  formStatus.className = "form-status is-loading";
  formStatus.textContent = "Envoi en cours…";

  try {
    const response = await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { Accept: "application/json" },
      body: formData
    });

    const result = await response.json().catch(() => ({}));
    const message = result?.body?.message || result?.message || result?.error || "";

    if (!response.ok || result.success === false) {
      const lower = String(message).toLowerCase();
      if (lower.includes("captcha") || lower.includes("hcaptcha") || lower.includes("robot") || lower.includes("spam")) {
        throw new Error("CAPTCHA_REQUIRED");
      }
      if (response.status === 429 || lower.includes("too many") || lower.includes("rate")) {
        throw new Error("RATE_LIMIT");
      }
      throw new Error(message || "SEND_FAILED");
    }

    contactForm.reset();
    if (typeof hcaptcha !== "undefined") {
      try { hcaptcha.reset(); } catch (_) {}
    }
    formStatus.className = "form-status is-success";
    formStatus.textContent = "Message envoyé avec succès !";
  } catch (error) {
    console.error("Erreur formulaire de contact:", error);
    formStatus.className = "form-status is-error";

    const msg = error?.message || "";
    if (msg === "CAPTCHA_REQUIRED") {
      formStatus.textContent = "Merci de valider le contrôle anti-robot (captcha) avant d’envoyer.";
    } else if (msg === "RATE_LIMIT" || msg.toLowerCase().includes("too many") || msg.includes("429")) {
      formStatus.textContent = "Trop de tentatives. Attends un moment avant de réessayer.";
    } else if (msg === "SEND_FAILED" || !navigator.onLine) {
      formStatus.textContent = "Impossible d’envoyer le message. Vérifie ta connexion puis réessaie.";
    } else {
      formStatus.textContent = "Impossible d’envoyer le message. Vérifie le captcha et ta connexion, puis réessaie.";
    }
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
  if (!toggle || !nav) return;

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
    elements.forEach((el) => el.classList.add("visible"));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("visible");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12 });
  elements.forEach((el) => observer.observe(el));
}

function setupThemeSwitcher() {
  const switcher = $("#theme-switcher");
  if (!switcher) return;

  const saved = localStorage.getItem("repair91-theme");
  if (saved) {
    document.documentElement.setAttribute("data-theme", saved);
    switcher.value = saved;
  }

  switcher.addEventListener("change", () => {
    const theme = switcher.value;
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("repair91-theme", theme);
  });
}

function setupEvents() {
  [search, model, part].forEach((element) => {
    if (element) {
      element.addEventListener("input", renderProducts);
      element.addEventListener("change", renderProducts);
    }
  });

  if (grid) {
    grid.addEventListener("click", (event) => {
      const button = event.target.closest("[data-report]");
      if (!button) return;
      const product = PRODUCTS.find(({ id }) => id === button.dataset.report);
      if (product) openReport(product);
    });
  }

  if (contactForm) {
    contactForm.addEventListener("submit", submitContactForm);
  }
}

function loadProducts() {
  // products.js définit window.PRODUCTS_DATA (fonctionne en file:// et en https)
  if (Array.isArray(window.PRODUCTS_DATA) && window.PRODUCTS_DATA.length) {
    PRODUCTS = window.PRODUCTS_DATA;
    return true;
  }
  PRODUCTS = [];
  if (empty) {
    empty.hidden = false;
    empty.textContent = "Impossible de charger le catalogue (products.js manquant ou invalide).";
  }
  return false;
}

function init() {
  setupNavigation();
  setupCompatibilityPanel();
  setupRevealAnimations();
  setupThemeSwitcher();
  setupEvents();
  watchCaptcha();

  const yearEl = $("#year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  loadProducts();
  populateFilters();
  renderProducts();
}

init();
