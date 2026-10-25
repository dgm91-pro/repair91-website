/* ============================================================
   Repair91 — logique d'interface (panneaux, shop, contact, thème)
   La scène 3D (scene.js) appelle window.R91.openPanel()/closePanel()
   et cet écran écoute les boutons de nav pour déclencher la 3D.
   ============================================================ */

let PRODUCTS = [];

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const grid = $("#product-grid");
const search = $("#search");
const model = $("#model");
const part = $("#part");
const empty = $("#empty");
const contactForm = $("#contact-form");
const formStatus = $("#form-status");
const reportDialog = $("#report-dialog");
const reportLink = $("#report-link");
const panelBackdrop = $("#panel-backdrop");

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
    model.insertAdjacentHTML("beforeend", `<option value="${escapeHTML(value)}">${escapeHTML(value)}</option>`);
  });
  uniqueValues("part").forEach((value) => {
    part.insertAdjacentHTML("beforeend", `<option value="${escapeHTML(value)}">${escapeHTML(value)}</option>`);
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
      <img class="product-image" src="${escapeHTML(product.image)}" alt="${escapeHTML(product.title)}" loading="lazy" referrerpolicy="no-referrer" decoding="async">
      <div class="product-body">
        <span class="tag">${escapeHTML(product.part)} · ${escapeHTML(product.model)}</span>
        <h3>${escapeHTML(product.title)}</h3>
        <p>${escapeHTML(product.description)}</p>
        <div class="card-actions">
          <a class="button primary" href="${escapeHTML(product.amazon)}" target="_blank" rel="noopener noreferrer sponsored">Voir l'article <span class="material-symbols-outlined" aria-hidden="true">arrow_outward</span></a>
          <button class="button report" type="button" data-report="${escapeHTML(product.id)}">Signaler</button>
        </div>
      </div>
    </article>
  `).join("");

  if (empty) {
    empty.hidden = products.length !== 0;
    if (products.length === 0) {
      empty.textContent = "Ton article n'est pas inscrit dans le Shop, contacte-moi pour la réparation.";
    }
  }
}

function prepareReport(product) {
  const messageField = contactForm.querySelector('[name="message"]');
  if (!messageField) return;

  messageField.value = [
    `Bonjour,`, ``,
    `Je signale que le lien suivant semble indisponible :`,
    product.amazon, ``,
    `Article : ${product.title}`,
    `Modèle : ${product.model}`,
    `Pièce : ${product.part}`, ``,
    `Merci.`
  ].join("\n");

  reportDialog.close();
  window.R91.openPanel("contact");
  setTimeout(() => messageField.focus(), 400);
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
  setTimeout(() => {
    if (captchaState === "pending") {
      captchaState = "unavailable";
      observer.disconnect();
    }
  }, 4000);
}

/* Réduit le captcha (303px de large) pour qu'il tienne dans le formulaire */
function setupCaptchaFit() {
  const wrap = $("#captcha-wrap");
  const widget = wrap?.querySelector(".h-captcha");
  if (!wrap || !widget) return;
  const NATIVE_WIDTH = 303;

  const fit = () => {
    const available = wrap.clientWidth;
    if (!available) return;
    const scale = Math.min(1, available / NATIVE_WIDTH);
    widget.style.transform = scale < 1 ? `scale(${scale})` : "";
    const height = widget.offsetHeight || 78;
    wrap.style.height = scale < 1 ? `${Math.ceil(height * scale)}px` : "";
  };

  // Un seul observateur suffit pour les deux éléments et limite les callbacks.
  if ("ResizeObserver" in window) {
    const observer = new ResizeObserver(fit);
    observer.observe(wrap);
    observer.observe(widget);
  }
  window.addEventListener("resize", fit, { passive: true });
  // Le panneau est caché au chargement : on recalcule à l'ouverture
  document.addEventListener("transitionend", fit);
  fit();
}

function getCaptchaResponse() {
  const captcha = contactForm?.querySelector('textarea[name="h-captcha-response"]');
  if (captcha && captcha.value && captcha.value.trim().length > 0) return captcha.value.trim();
  const hidden = contactForm?.querySelector('input[name="h-captcha-response"]');
  if (hidden && hidden.value && hidden.value.trim().length > 0) return hidden.value.trim();
  return "";
}

async function submitContactForm(event) {
  event.preventDefault();
  if (!contactForm.reportValidity()) return;

  const isFileProtocol = location.protocol === "file:";
  const captchaResponse = getCaptchaResponse();

  if (!captchaResponse && captchaState !== "unavailable") {
    formStatus.className = "form-status is-error";
    if (isFileProtocol) {
      formStatus.textContent = "Le captcha ne fonctionne pas en ouvrant le fichier localement. Déploie le site (GitHub Pages) ou utilise un serveur local (Live Server).";
    } else if (captchaState === "pending") {
      formStatus.textContent = "Le contrôle anti-robot se charge encore, réessaie dans un instant.";
    } else {
      formStatus.textContent = "Merci de valider le contrôle anti-robot (captcha) avant d'envoyer.";
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
      formStatus.textContent = "Merci de valider le contrôle anti-robot (captcha) avant d'envoyer.";
    } else if (msg === "RATE_LIMIT" || msg.toLowerCase().includes("too many") || msg.includes("429")) {
      formStatus.textContent = "Trop de tentatives. Attends un moment avant de réessayer.";
    } else if (msg === "SEND_FAILED" || !navigator.onLine) {
      formStatus.textContent = "Impossible d'envoyer le message. Vérifie ta connexion puis réessaie.";
    } else {
      formStatus.textContent = "Impossible d'envoyer le message. Vérifie le captcha et ta connexion, puis réessaie.";
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

/* ---------- Panels (Shop / Fonctionnement / Contact) ---------- */

const PANEL_IDS = ["shop", "fonctionnement", "contact", "avis"];
let activePanel = null;

function openPanel(name) {
  if (!PANEL_IDS.includes(name)) return;
  const el = $(`#panel-${name}`);
  if (!el) return;

  if (activePanel && activePanel !== name) {
    $(`#panel-${activePanel}`)?.classList.remove("is-open");
  }

  activePanel = name;
  el.classList.add("is-open");
  el.setAttribute("aria-hidden", "false");
  panelBackdrop.hidden = false;
  requestAnimationFrame(() => panelBackdrop.classList.add("is-visible"));
  document.body.classList.add("panel-open");

  const closeBtn = el.querySelector(".panel-close");
  if (closeBtn) setTimeout(() => closeBtn.focus(), 350);
}

function closePanel() {
  if (!activePanel) return;
  const el = $(`#panel-${activePanel}`);
  el?.classList.remove("is-open");
  el?.setAttribute("aria-hidden", "true");
  panelBackdrop.classList.remove("is-visible");
  document.body.classList.remove("panel-open");
  setTimeout(() => { panelBackdrop.hidden = true; }, 300);
  activePanel = null;
  document.dispatchEvent(new CustomEvent("r91:panelclosed"));
}

window.R91 = { openPanel, closePanel };

function setupPanels() {
  $$("[data-close-panel]").forEach((btn) => btn.addEventListener("click", closePanel));
  panelBackdrop.addEventListener("click", closePanel);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && activePanel) closePanel();
  });
}

/* ---------- Navigation (works whether 3D is active or not) ---------- */

function gotoSection(name) {
  if (name === "accueil") {
    // resetView() ferme lui-même le panneau (sans relancer la vue rapprochée)
    if (window.R91Scene?.resetView) window.R91Scene.resetView();
    closePanel();
    return;
  }
  if (window.R91Scene?.focusAndOpen) {
    window.R91Scene.focusAndOpen(name);
  } else {
    openPanel(name);
  }
}

function setupNavigation() {
  $$("[data-goto]").forEach((btn) => {
    btn.addEventListener("click", () => {
      gotoSection(btn.dataset.goto);
      const nav = $("#main-nav");
      const toggle = $("#menu-toggle");
      if (nav?.classList.contains("open")) {
        nav.classList.remove("open");
        toggle?.setAttribute("aria-expanded", "false");
      }
    });
  });

  $("#logo-link")?.addEventListener("click", (e) => { e.preventDefault(); gotoSection("accueil"); });

  const toggle = $("#menu-toggle");
  const nav = $("#main-nav");
  toggle?.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(isOpen));
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

function setupEvents() {
  // Le champ de recherche réagit à la saisie ; les filtres, à leur changement.
  // Évite deux rendus identiques lorsqu'un navigateur émet input puis change.
  search?.addEventListener("input", renderProducts);
  model?.addEventListener("change", renderProducts);
  part?.addEventListener("change", renderProducts);

  if (grid) {
    grid.addEventListener("click", (event) => {
      const button = event.target.closest("[data-report]");
      if (!button) return;
      const product = PRODUCTS.find(({ id }) => id === button.dataset.report);
      if (product) openReport(product);
    });
  }

  if (contactForm) contactForm.addEventListener("submit", submitContactForm);
}

function loadProducts() {
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

function setupRetry3D() {
  $("#retry-3d")?.addEventListener("click", () => window.location.reload());
}

function init() {
  setupPanels();
  setupNavigation();
  setupCompatibilityPanel();
  setupRetry3D();
  setupEvents();
  watchCaptcha();
  setupCaptchaFit();

  const yearEl = $("#year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  loadProducts();
  populateFilters();
  renderProducts();
}

init();
