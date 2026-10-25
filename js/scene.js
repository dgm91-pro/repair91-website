
/*
 * Repair91 — scène 3D de l'établi.
 *
 * Les modèles sont chargés depuis le dossier assets/models/.
 * Les positions et tailles sont définies dans layout.js.
 * Les clics peuvent ouvrir un panneau du site ou un lien externe.
 */

import * as THREE from "three";
import { OBJECTS } from "./layout.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

// Éléments HTML du site
const canvasEl = document.getElementById("scene");
const loadingEl = document.getElementById("loading");
const loadingProgress = document.getElementById("loading-progress");
const heroOverlay = document.getElementById("hero-overlay");
const nearUi = document.getElementById("near-ui");
const tooltipEl = document.getElementById("tooltip");
const body = document.body;

// Vérifie si le navigateur peut afficher la scène 3D.
function supportsWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") ||
        canvas.getContext("experimental-webgl"))
    );
  } catch (error) {
    return false;
  }
}

// Affiche la version sans 3D si nécessaire.
function enableFlatFallback() {
  body.classList.add("no-3d");
  loadingEl.classList.add("is-hidden");
  window.R91Scene = null;
}

if (!supportsWebGL()) {
  enableFlatFallback();
} else {
  try {
    initScene();
  } catch (error) {
    console.error("Scène 3D indisponible :", error);
    enableFlatFallback();
  }
}

document
  .getElementById("skip-3d")
  ?.addEventListener("click", enableFlatFallback);

// ================================================================
// INITIALISATION DE LA SCÈNE
// ================================================================

function initScene() {
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  // --------------------------------------------------------------
  // Rendu, scène et caméra
  // --------------------------------------------------------------

  const renderer = new THREE.WebGLRenderer({
    canvas: canvasEl,
    antialias: true,
    alpha: false,
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07080a);
  scene.fog = new THREE.Fog(0x07080a, 9, 26);

  // FOV de base : plus large en portrait (téléphone) pour mieux voir l'établi.
  const FOV_LANDSCAPE = 42;
  const FOV_PORTRAIT = 54;

  const camera = new THREE.PerspectiveCamera(
    FOV_LANDSCAPE,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );

  // Dimensions de l'établi (recalculées après le chargement des modèles).
  const bench = {
    center: new THREE.Vector3(0, 1.6, 0), // centre de tout l'établi (sol -> lampe)
    top: 1.8, // hauteur du plateau de la table
    halfW: 2.0,
    halfD: 1.0,
    height: 3.2, // hauteur totale, du sol au sommet de la lampe
  };

  // Valeurs animées de la caméra (effets de plongée).
  const fx = {
    fovScale: 1, // < 1 = effet de zoom
    shift: 0, // décalage vertical de l'image en pixels
  };

  // Contrôles de la caméra lorsque l'utilisateur est près de l'établi.
  // Les limites sont définies dans syncCamera() : on n'appelle pas
  // controls.update() ici, sinon la caméra de départ serait « rabattue »
  // dans les limites de la vue rapprochée.
  const controls = new OrbitControls(camera, renderer.domElement);

  controls.enabled = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minPolarAngle = Math.PI * 0.28;
  controls.maxPolarAngle = Math.PI * 0.52;
  controls.minAzimuthAngle = -0.55;
  controls.maxAzimuthAngle = 0.55;

  // Distance nécessaire pour faire rentrer un rectangle dans l'écran.
  function fitDistance(halfW, halfH, fovDeg) {
    const t = Math.tan(THREE.MathUtils.degToRad(fovDeg / 2));
    return Math.max(halfH / t, halfW / (t * camera.aspect));
  }

  function baseFov() {
    return camera.aspect < 1 ? FOV_PORTRAIT : FOV_LANDSCAPE;
  }

  function direction(azimuthDeg, elevationDeg) {
    const az = THREE.MathUtils.degToRad(azimuthDeg);
    const el = THREE.MathUtils.degToRad(elevationDeg);
    return new THREE.Vector3(
      Math.sin(az) * Math.cos(el),
      Math.sin(el),
      Math.cos(az) * Math.cos(el)
    );
  }

  // Vue éloignée : tout l'établi visible, placé dans la partie haute
  // de l'écran pour laisser la place au texte d'accueil.
  function farPose() {
    const portrait = camera.aspect < 1;
    const usable = portrait ? 0.56 : 0.74; // part de l'écran dédiée à l'établi
    const elevation = portrait ? 34 : 30;
    const dir = direction(portrait ? 10 : 16, elevation);

    const sinE = Math.sin(THREE.MathUtils.degToRad(elevation));
    const cosE = Math.cos(THREE.MathUtils.degToRad(elevation));
    const halfH = (bench.halfD * sinE + bench.height * 0.5 * cosE) * 1.08 + 0.2;
    const halfW = (bench.halfW + 0.2) * 1.04;

    const dist = fitDistance(halfW, halfH / usable, baseFov());
    const target = bench.center.clone();

    return {
      position: target.clone().addScaledVector(dir, dist),
      target,
      fovScale: 1,
      shift: ((1 - usable) / 2) * window.innerHeight,
      distance: dist,
    };
  }

  // Vue rapprochée : les objets remplissent l'écran.
  function nearPose() {
    const portrait = camera.aspect < 1;
    const dir = direction(0, portrait ? 30 : 24);

    const halfW = portrait ? 1.15 : bench.halfW * 0.82;
    const halfH = 0.95;

    const dist = fitDistance(halfW, halfH, baseFov());
    const target = bench.center.clone();
    target.y = bench.top + 0.05;
    target.z -= 0.1;

    return {
      position: target.clone().addScaledVector(dir, dist),
      target,
      fovScale: 1,
      shift: 0,
      distance: dist,
    };
  }

  // Plongée : la caméra vient se coller à l'objet cliqué.
  function divePose(object) {
    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z) / 2;

    const portrait = camera.aspect < 1;
    const dir = direction(
      THREE.MathUtils.clamp(center.x * 8, -14, 14),
      portrait ? 38 : 32
    );

    const dist = Math.max(
      fitDistance(radius * 1.5, radius * 1.5, baseFov() * 0.85),
      0.9
    );

    return {
      position: center.clone().addScaledVector(dir, dist),
      target: center,
      fovScale: 0.85,
      shift: 0,
      distance: dist,
    };
  }

  // Applique FOV, ratio et décalage vertical à la caméra.
  function applyProjection() {
    const w = window.innerWidth;
    const h = window.innerHeight;

    camera.aspect = w / h;
    camera.fov = baseFov() * fx.fovScale;

    if (Math.abs(fx.shift) > 0.5) {
      camera.setViewOffset(w, h, 0, fx.shift, w, h);
    } else {
      camera.clearViewOffset();
    }

    camera.updateProjectionMatrix();
  }

  function placeCamera(pose) {
    camera.position.copy(pose.position);
    controls.target.copy(pose.target);
    fx.fovScale = pose.fovScale;
    fx.shift = pose.shift;
    applyProjection();
    camera.lookAt(pose.target);
  }

  // Limites de rotation / zoom en vue rapprochée, adaptées à l'écran.
  function applyNearLimits() {
    const d = nearPose().distance;
    controls.minDistance = d * 0.6;
    controls.maxDistance = d * 1.25;
  }

  // Brouillard qui suit la distance de la vue éloignée.
  function applyFog(farDistance) {
    scene.fog.near = farDistance + 1.5;
    scene.fog.far = farDistance + 18;
  }

  placeCamera(farPose());

  // --------------------------------------------------------------
  // Éclairage
  // --------------------------------------------------------------

  const hemi = new THREE.HemisphereLight(0x8aa0c0, 0x15110b, 0.5);
  scene.add(hemi);

  // Lumière principale et ombres.
  const key = new THREE.DirectionalLight(0xfff0dc, 1.7);

  key.position.set(4.2, 8, 4.5);
  key.target.position.set(0, 1.6, 0);

  scene.add(key.target);

  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  key.shadow.camera.left = -4.2;
  key.shadow.camera.right = 4.2;
  key.shadow.camera.top = 3.8;
  key.shadow.camera.bottom = -3.8;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 22;
  key.shadow.bias = -0.0003;
  key.shadow.normalBias = 0.025;
  key.shadow.radius = 3;

  scene.add(key);

  // Lumière douce au-dessus de l'établi.
  const softbox = new THREE.SpotLight(
    0xfff4e6,
    38,
    0,
    0.55,
    1,
    2
  );

  softbox.position.set(-1.8, 6.2, 2.4);
  softbox.target.position.set(0, 1.8, 0);

  scene.add(softbox.target);

  softbox.castShadow = true;
  softbox.shadow.mapSize.set(2048, 2048);
  softbox.shadow.bias = -0.0004;
  softbox.shadow.normalBias = 0.02;
  softbox.shadow.radius = 5;

  scene.add(softbox);

  // Lumière bleue à l'arrière.
  const rim = new THREE.DirectionalLight(0x6690ff, 0.7);

  rim.position.set(-5, 4, -5);
  scene.add(rim);

  // Lumière de la lampe de bureau.
  const lampLight = new THREE.PointLight(0xffcf8f, 2.4, 6, 2);

  lampLight.position.set(-0.9, 2.7, -0.6);
  scene.add(lampLight);

  // --------------------------------------------------------------
  // Configuration des modèles 3D
  // --------------------------------------------------------------

  // Convertit les degrés en radians pour Three.js.
  const LAYOUT = Object.fromEntries(
    Object.entries(OBJECTS).map(([name, object]) => [
      name,
      {
        ...object,
        pos: [object.position.x, object.position.z],
        rot: object.rotation.map((degrees) =>
          THREE.MathUtils.degToRad(degrees)
        ),
        yaw: THREE.MathUtils.degToRad(object.yaw),
      },
    ])
  );

  const MODEL_DIR = "assets/models/";
  const maxAniso = Math.min(
    8,
    renderer.capabilities.getMaxAnisotropy()
  );

  // Éclairage d'environnement pour améliorer l'apparence des modèles.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(
    new RoomEnvironment(),
    0.04
  ).texture;

  scene.environment = envTex;

  // --------------------------------------------------------------
  // Sol
  // --------------------------------------------------------------

  const floorTexture = (() => {
    const canvas = document.createElement("canvas");

    canvas.width = canvas.height = 512;

    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#0c0d10";
    ctx.fillRect(0, 0, 512, 512);

    ctx.strokeStyle = "rgba(255,255,255,0.035)";
    ctx.lineWidth = 2;

    for (let i = 0; i <= 512; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 512);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(512, i);
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);

    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(10, 10);

    return texture;
  })();

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({
      map: floorTexture,
      roughness: 0.6,
      metalness: 0.15,
      envMapIntensity: 0.35,
    })
  );

  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;

  scene.add(floor);

  // --------------------------------------------------------------
  // Gestion des objets cliquables
  // --------------------------------------------------------------

  const clickable = [];

  // Enregistre un objet et l'action déclenchée lors d'un clic.
  //
  // group : modèle 3D
  // panel : panneau du site à ouvrir
  // label : texte affiché au survol
  // url   : lien externe facultatif
  function registerClickable(group, panel, label, url = null) {
    group.userData.panel = panel;
    group.userData.label = label;
    group.userData.url = url;
    group.userData.baseScale = group.scale.clone();

    clickable.push(group);
  }

  // --------------------------------------------------------------
  // Chargement des modèles 3D
  // --------------------------------------------------------------

  const loader = new GLTFLoader();

  let TABLE_TOP = (LAYOUT.table.size / 1.5) * 0.75;

  function loadGLB(file) {
    return new Promise((resolve, reject) => {
      loader.load(MODEL_DIR + file, resolve, undefined, reject);
    });
  }

  // Active les ombres et prépare les matériaux.
  function prepareMaterials(root) {
    root.traverse((object) => {
      if (!object.isMesh) return;

      object.castShadow = true;
      object.receiveShadow = true;

      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];

      materials.forEach((material) => {
        material.envMapIntensity = 0.5;

        [
          "map",
          "normalMap",
          "metalnessMap",
          "roughnessMap",
          "emissiveMap",
          "aoMap",
        ].forEach((key) => {
          if (material[key]) {
            material[key].anisotropy = maxAniso;
          }
        });
      });
    });
  }

  // Ajuste la taille, l'orientation et le point de contact du modèle.
  function fitModel(root, config) {
    root.rotation.set(
      config.rot[0],
      config.rot[1],
      config.rot[2]
    );

    const outer = new THREE.Group();

    outer.add(root);
    outer.updateMatrixWorld(true);

    let box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());

    root.scale.setScalar(config.size / size[config.axis]);

    outer.updateMatrixWorld(true);

    box = new THREE.Box3().setFromObject(root);

    const center = box.getCenter(new THREE.Vector3());

    if (config.anchor === "origin") {
      root.position.set(0, -box.min.y, 0);
    } else {
      root.position.set(
        -center.x,
        -box.min.y,
        -center.z
      );
    }

    outer.rotation.y = config.yaw;
    outer.updateMatrixWorld(true);

    return outer;
  }

  // Place un objet dans la scène.
  function place(outer, config, y) {
    outer.position.set(
      config.pos[0],
      y,
      config.pos[1]
    );

    scene.add(outer);
    outer.updateMatrixWorld(true);
  }

  // Ajuste l'angle de l'écran du PC portable.
  function prepareLaptop(root) {
    root.updateMatrixWorld(true);

    const lid = root.getObjectByName("Ecran_6");

    if (!lid) {
      console.warn("Écran du PC introuvable dans le modèle.");
      return;
    }

    const hinge = new THREE.Vector3(0.1265, 0.007, 0);
    const pivot = new THREE.Group();

    pivot.position.copy(hinge);
    root.add(pivot);
    pivot.updateMatrixWorld(true);

    pivot.attach(lid);
    pivot.rotation.z = -0.26;
  }

  // Repère la position de l'ampoule de la lampe.
  const bulb = new THREE.Object3D();

  function prepareLamp(root) {
    bulb.position.set(0.799, 3.131, -0.128);
    root.add(bulb);
  }

  // Liste des modèles à charger.
  const JOBS = [
    ["table", null],
    ["mat", null],
    ["laptop", prepareLaptop],
    ["phone", null],
    ["folder", null],
    ["multimeter", null],
    ["solder", null],
    ["lamp", prepareLamp],
  ];

  const placed = {};
  let doneCount = 0;

  const loadedPromise = Promise.allSettled(
    JOBS.map(async ([key, prepare]) => {
      const config = LAYOUT[key];

      try {
        const gltf = await loadGLB(config.file);
        const root = gltf.scene;

        prepareMaterials(root);

        if (prepare) {
          prepare(root);
        }

        placed[key] = {
          outer: fitModel(root, config),
          cfg: config,
        };
      } catch (error) {
        console.warn("Modèle indisponible :", key, error);
      } finally {
        doneCount++;

        loadingProgress.style.width =
          Math.round((doneCount / JOBS.length) * 100) + "%";
      }
    })
  ).then(() => {
    // La table est placée en premier pour calculer sa hauteur.
    if (placed.table) {
      place(placed.table.outer, placed.table.cfg, 0);

      TABLE_TOP = new THREE.Box3()
        .setFromObject(placed.table.outer)
        .max.y;
    }

    // Place le tapis sur la table.
    const mat = placed.mat;

    if (mat) {
      place(mat.outer, mat.cfg, TABLE_TOP);
    }

    const matTop = mat
      ? new THREE.Box3().setFromObject(mat.outer).max.y
      : TABLE_TOP;

    // Détermine si un objet se trouve au-dessus du tapis.
    const onMat = (position) => {
      if (!mat) return TABLE_TOP;

      const box = new THREE.Box3().setFromObject(mat.outer);

      const isOnMat =
        position[0] > box.min.x &&
        position[0] < box.max.x &&
        position[1] > box.min.z &&
        position[1] < box.max.z;

      return isOnMat ? matTop : TABLE_TOP;
    };

    // Place tous les objets sur le tapis ou sur la table.
    [
      "laptop",
      "phone",
      "folder",
      "multimeter",
      "solder",
      "lamp",
    ].forEach((key) => {
      if (placed[key]) {
        place(
          placed[key].outer,
          placed[key].cfg,
          onMat(placed[key].cfg.pos)
        );
      }
    });

    // ============================================================
    // ACTIONS DES OBJETS CLIQUABLES
    // C'est ici que tu modifies les interactions.
    // ============================================================

    // ORDINATEUR : la caméra plonge sur le PC et affiche la carte
    // « avis Google » (le lien se trouve dans index.html, panneau « avis »).
    if (placed.laptop) {
      registerClickable(
        placed.laptop.outer,
        "avis",
        "Laisser un avis Google"
      );
    }

    // TÉLÉPHONE : ouvre le panneau Contact.
    if (placed.phone) {
      registerClickable(
        placed.phone.outer,
        "contact",
        "Contacter"
      );
    }

    // DOSSIER : ouvre le panneau Fonctionnement.
    if (placed.folder) {
      registerClickable(
        placed.folder.outer,
        "fonctionnement",
        "Fonctionnement"
      );
    }

    // FER À SOUDER : ouvre le Shop.
    if (placed.solder) {
      registerClickable(
        placed.solder.outer,
        "shop",
        "Voir le Shop"
      );
    }

    // Place la lumière de la lampe au niveau de son ampoule.
    if (placed.lamp) {
      const position = new THREE.Vector3();

      bulb.getWorldPosition(position);
      lampLight.position.copy(position);
    }

    // Mesure l'établi réel pour cadrer la caméra.
    const benchBox = new THREE.Box3();
    Object.values(placed).forEach(({ outer }) => benchBox.expandByObject(outer));

    if (!benchBox.isEmpty()) {
      const size = benchBox.getSize(new THREE.Vector3());
      const center = benchBox.getCenter(new THREE.Vector3());

      bench.halfW = size.x / 2;
      bench.halfD = size.z / 2;
      bench.center.copy(center);
      bench.top = TABLE_TOP;
      bench.height = size.y;
    }

    syncCamera();

    return Object.keys(placed).length;
  });

  // --------------------------------------------------------------
  // Particules décoratives
  // --------------------------------------------------------------

  const dustGeometry = new THREE.BufferGeometry();
  const dustCount = 160;
  const dustPositions = new Float32Array(dustCount * 3);

  for (let i = 0; i < dustCount; i++) {
    dustPositions[i * 3] = (Math.random() - 0.5) * 8;
    dustPositions[i * 3 + 1] = Math.random() * 3.5;
    dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 8;
  }

  dustGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(dustPositions, 3)
  );

  const dust = new THREE.Points(
    dustGeometry,
    new THREE.PointsMaterial({
      color: 0xffe8c0,
      size: 0.012,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    })
  );

  scene.add(dust);

  // --------------------------------------------------------------
  // Détection des clics et survols
  // --------------------------------------------------------------

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  let hovered = null;
  let pointerDownPos = null;
  let state = "far";

  // Convertit la position de la souris en coordonnées 3D.
  function setPointer(event) {
    const rect = renderer.domElement.getBoundingClientRect();

    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    pointer.x = (x / rect.width) * 2 - 1;
    pointer.y = -(y / rect.height) * 2 + 1;
  }

  // Recherche l'objet cliquable situé sous la souris.
  function pickClickable() {
    raycaster.setFromCamera(pointer, camera);

    const intersections = raycaster.intersectObjects(
      clickable,
      true
    );

    if (!intersections.length) {
      return null;
    }

    let object = intersections[0].object;

    // Remonte jusqu'à l'objet enregistré comme cliquable.
    while (
      object &&
      !object.userData.panel &&
      !object.userData.url
    ) {
      object = object.parent;
    }

    return object || null;
  }

  // Affiche le nom de l'objet survolé.
  canvasEl.addEventListener("pointermove", (event) => {
    setPointer(event);

    if (state === "zooming") return;

    const hit = pickClickable();

    if (hit !== hovered) {
      hovered = hit;

      canvasEl.style.cursor = hovered ? "pointer" : "grab";

      if (hovered) {
        tooltipEl.textContent = hovered.userData.label;
        tooltipEl.hidden = false;
      } else {
        tooltipEl.hidden = true;
      }
    }

    if (hovered) {
      tooltipEl.style.left = event.clientX + "px";
      tooltipEl.style.top = event.clientY + "px";
    }
  });

  canvasEl.addEventListener("pointerleave", () => {
    hovered = null;
    tooltipEl.hidden = true;
  });

  // Enregistre le point de départ du clic.
  canvasEl.addEventListener("pointerdown", (event) => {
    pointerDownPos = {
      x: event.clientX,
      y: event.clientY,
    };
  });

  // Déclenche l'action au clic.
  canvasEl.addEventListener("pointerup", (event) => {
    if (!pointerDownPos) return;

    const dx = event.clientX - pointerDownPos.x;
    const dy = event.clientY - pointerDownPos.y;

    pointerDownPos = null;

    // Ne traite pas un déplacement de caméra comme un clic.
    if (Math.hypot(dx, dy) > 6) return;
    if (state === "zooming") return;

    setPointer(event);

    const hit = pickClickable();

    // Un lien externe est prioritaire.
    if (hit?.userData.url) {
      window.open(
        hit.userData.url,
        "_blank",
        "noopener,noreferrer"
      );

      return;
    }

    // Objet avec panneau : la caméra plonge dessus puis ouvre le panneau.
    if (hit?.userData.panel) {
      diveTo(hit);
      return;
    }

    // Depuis la vue éloignée, rapproche la caméra.
    if (state === "far") {
      zoomIn();
    }
  });

  // --------------------------------------------------------------
  // Déplacements de la caméra
  // --------------------------------------------------------------

  function easeInOutCubic(t) {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  const diveFx = document.getElementById("dive-fx");
  let diveObject = null;
  let pending = null;

  // Déplace la caméra vers une pose, avec arc, roulis et effet de zoom.
  function flyTo(pose, { duration, roll = 0, arc = 0.1, onDone }) {
    state = "zooming";
    controls.enabled = false;

    const fromPos = camera.position.clone();
    const fromTarget = controls.target.clone();
    const fromFov = fx.fovScale;
    const fromShift = fx.shift;

    const lift = fromPos.distanceTo(pose.position) * arc;
    const time = prefersReducedMotion ? 0 : duration;
    const start = performance.now();
    const tmp = new THREE.Vector3();

    function step(now) {
      const t = time === 0 ? 1 : Math.min(1, (now - start) / time);
      const e = easeInOutCubic(t);

      camera.position.lerpVectors(fromPos, pose.position, e);
      camera.position.y += Math.sin(Math.PI * e) * lift;
      controls.target.lerpVectors(fromTarget, pose.target, e);

      fx.fovScale = THREE.MathUtils.lerp(fromFov, pose.fovScale, e);
      fx.shift = THREE.MathUtils.lerp(fromShift, pose.shift, e);
      applyProjection();

      camera.lookAt(controls.target);
      if (roll) camera.rotateZ(Math.sin(Math.PI * e) * roll);

      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        placeCamera(pose);
        onDone();
        runPending();
      }
    }

    requestAnimationFrame(step);
  }

  function runPending() {
    if (!pending) return;
    const action = pending;
    pending = null;
    action();
  }

  function enterNearState() {
    state = "near";
    diveObject = null;
    applyNearLimits();
    controls.enabled = true;
    controls.update();
    nearUi.hidden = false;
  }

  // Vue éloignée -> vue rapprochée.
  function zoomIn() {
    if (state === "zooming") return;
    if (state !== "far") return;

    heroOverlay.classList.add("is-hidden");
    flyTo(nearPose(), { duration: 1800, arc: 0.06, onDone: enterNearState });
  }

  // Plonge sur un objet puis ouvre son panneau.
  function diveTo(object) {
    const panel = object.userData.panel;
    if (!panel) return;

    if (state === "zooming") {
      pending = () => diveTo(object);
      return;
    }

    const wasDived = state === "dived";
    state = "zooming";
    controls.enabled = false;
    nearUi.hidden = true;
    tooltipEl.hidden = true;
    hovered = null;
    heroOverlay.classList.add("is-hidden");

    if (wasDived) window.R91.closePanel();
    diveFx?.classList.add("is-active");

    diveObject = object;

    flyTo(divePose(object), {
      duration: wasDived ? 900 : 1300,
      roll: object.position.x < 0 ? 0.05 : -0.05,
      arc: 0.08,
      onDone: () => {
        state = "dived";
        window.R91.openPanel(panel);
      },
    });
  }

  // Panneau fermé : on quitte l'objet et on revient sur l'établi.
  document.addEventListener("r91:panelclosed", () => {
    if (state !== "dived") return;
    diveFx?.classList.remove("is-active");
    flyTo(nearPose(), { duration: 1000, arc: 0.04, onDone: enterNearState });
  });

  // Retour à la vue générale (même pose que celle de départ).
  function resetView() {
    if (state === "zooming") {
      pending = resetView;
      return;
    }
    if (state === "far") return;

    state = "zooming"; // évite que la fermeture du panneau relance un retour
    window.R91.closePanel();
    nearUi.hidden = true;
    diveFx?.classList.remove("is-active");
    diveObject = null;

    flyTo(farPose(), {
      duration: 1500,
      arc: 0.05,
      onDone: () => {
        state = "far";
        heroOverlay.classList.remove("is-hidden");
      },
    });
  }

  // Ouvre un panneau depuis le menu : plonge sur l'objet correspondant.
  function focusAndOpen(panelName) {
    const target = clickable.find((o) => o.userData.panel === panelName);

    if (target) {
      diveTo(target);
      return;
    }

    // Pas de modèle pour ce panneau : on ouvre simplement le panneau.
    if (state === "far") zoomIn();
    window.R91.openPanel(panelName);
  }

  document
    .getElementById("enter-bench")
    ?.addEventListener("click", zoomIn);

  document
    .getElementById("back-to-overview")
    ?.addEventListener("click", resetView);

  window.R91Scene = {
    focusAndOpen,
    resetView,
  };

  // --------------------------------------------------------------
  // Redimensionnement et animation
  // --------------------------------------------------------------

  // Recalcule la pose de la vue courante (rotation d'écran, resize...).
  function syncCamera() {
    applyFog(farPose().distance);
    applyNearLimits();

    if (state === "far") {
      placeCamera(farPose());
    } else if (state === "near") {
      // Garde la rotation choisie par l'utilisateur, ajuste juste le cadrage.
      applyProjection();
    } else if (state === "dived" && diveObject) {
      placeCamera(divePose(diveObject));
    } else {
      applyProjection();
    }
  }

  let lastAspect = window.innerWidth / window.innerHeight;

  function onResize() {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    const aspect = window.innerWidth / window.innerHeight;
    applyProjection();
    syncCamera();

    // Rotation d'écran / grand changement de format : on recadre la vue
    // rapprochée (sinon on garde la position choisie par l'utilisateur).
    if (state === "near" && Math.abs(aspect - lastAspect) > 0.08) {
      placeCamera(nearPose());
      controls.update();
    }

    lastAspect = aspect;
  }

  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", () => setTimeout(onResize, 250));

  // Léger effet de parallaxe en vue éloignée (souris).
  const parallax = { x: 0, y: 0, tx: 0, ty: 0, weight: 0 };

  window.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch") return;
    parallax.tx = (event.clientX / window.innerWidth) * 2 - 1;
    parallax.ty = (event.clientY / window.innerHeight) * 2 - 1;
  });

  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);

    const time = clock.getElapsedTime();

    // Légère variation de la lumière de la lampe.
    lampLight.intensity =
      1.3 +
      Math.sin(time * 6) * 0.04 +
      Math.sin(time * 1.3) * 0.05;

    // Agrandit légèrement l'objet survolé à proximité.
    clickable.forEach((object) => {
      const base = object.userData.baseScale;

      const targetScale =
        object === hovered && state === "near"
          ? 1.045
          : 1;

      // Interpolation composante par composante : pas de nouveau Vector3
      // alloué pour chaque objet à chaque frame (réduit le travail du GC).
      object.scale.x += (base.x * targetScale - object.scale.x) * 0.15;
      object.scale.y += (base.y * targetScale - object.scale.y) * 0.15;
      object.scale.z += (base.z * targetScale - object.scale.z) * 0.15;
    });

    // Parallaxe douce + respiration de la caméra en vue éloignée.
    parallax.weight += ((state === "far" ? 1 : 0) - parallax.weight) * 0.04;
    parallax.x += (parallax.tx - parallax.x) * 0.05;
    parallax.y += (parallax.ty - parallax.y) * 0.05;

    if (state === "far" && !prefersReducedMotion) {
      const pose = farPose();
      const amp = pose.distance * 0.025 * parallax.weight;

      camera.position.copy(pose.position);
      camera.position.x += (parallax.x + Math.sin(time * 0.25) * 0.35) * amp;
      camera.position.y += (-parallax.y * 0.6 + Math.sin(time * 0.31) * 0.2) * amp;
      camera.lookAt(pose.target);
    }

    // Mouvement discret des particules.
    dust.rotation.y = time * 0.01;

    if (controls.enabled) {
      controls.update();
    }

    renderer.render(scene, camera);
  }

  animate();

  // Cache le chargement lorsque les modèles sont prêts.
  loadedPromise.then((count) => {
    if (count === 0) {
      enableFlatFallback();
      return;
    }

    loadingProgress.style.width = "100%";

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        loadingEl.classList.add("is-hidden");
      });
    });
  });
}
