/*
 * Repair91 — réglages des objets 3D
 *
 * MODIFIE CE FICHIER POUR DÉPLACER LES OBJETS.
 *
 * position.x : gauche / droite (négatif = gauche, positif = droite)
 * position.z : avant / arrière (négatif = arrière, positif = avant)
 * size       : taille générale (plus grand = plus grand)
 * rotation   : orientation initiale [X, Y, Z], en degrés
 * yaw        : rotation horizontale, en degrés
 *
 * Astuce : change une valeur à la fois, enregistre, puis recharge le site.
 */
export const OBJECTS = {
  table: {
    file: "table.glb",
    position: { x: 0, z: 0 },
    size: 3.6,
    axis: "x",
    rotation: [0, 0, 0],
    yaw: 0,
  },

  mat: {
    file: "mat.glb",
    position: { x: 0.15, z: 0.2 },
    size: 1.45,
    axis: "x",
    rotation: [0, 0, 0],
    yaw: 0,
  },

  laptop: {
    file: "laptop.glb",
    position: { x: 0.85, z: -0.1 },
    size: 0.85,
    axis: "x",
    rotation: [0, 60, 0],
    yaw: 8,
  },

  phone: {
    file: "phone.glb",
    position: { x: 0.5, z: 0.54 },
    size: 0.354,
    axis: "z",
    rotation: [90, 0, 0],
    yaw: 160,
  },

  folder: {
    file: "folder.glb",
    position: { x: -0.1, z: 0.25 },
    size: 0.72,
    axis: "x",
    rotation: [0, -85, 0],
    yaw: 5,
  },

  multimeter: {
    file: "multimeter.glb",
    position: { x: 1.3, z: 0.5 },
    size: 0.4,
    axis: "z",
    rotation: [0, 0, 0],
    yaw: 29,
  },

  solder: {
    file: "solder.glb",
    position: { x: -1.2, z: 0.3 },
    size: 0.95,
    axis: "x",
    rotation: [0, 0, 0],
    yaw: 7,
  },

  lamp: {
    file: "lamp.glb",
    position: { x: -1.3, z: -0.52 },
    size: 1.08,
    axis: "y",
    rotation: [0, -45, 0],
    yaw: 0,
    anchor: "origin",
  },
};
