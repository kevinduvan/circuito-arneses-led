/*
 * products.js — Productos del catálogo (máximo recomendado: 10).
 * Campos: id (único, sin espacios), ref, name, short (nombre del color), swatch (color de muestra #RRGGBB, solo visual), category, description, image, alt.
 * Dato confirmado por el negocio: los arnés tienen luces LED. Otras características
 * (materiales, batería, tallas) no se han confirmado: no las agregues sin validarlas.
 */
window.CATALOG_PRODUCTS = [
  {
    id: "arnes-rojo",
    short: "Rojo",
    swatch: "#E53935",
    ref: "CI-001",
    name: "Arnés reflectivo rojo",
    category: "Arnés reflectivos",
    description: "Arnés rojo con luces LED y franjas reflectantes para mayor visibilidad, correas ajustables y cierres de hebilla.",
    image: "assets/arnes-rojo.jpg",
    priceGroup: "arnes",
    alt: "Arnés reflectivo de color rojo con franjas plateadas"
  },
  {
    id: "arnes-naranja",
    short: "Naranja",
    swatch: "#FF7A1A",
    ref: "CI-002",
    name: "Arnés reflectivo naranja",
    category: "Arnés reflectivos",
    description: "Arnés naranja con luces LED y franjas reflectantes para mayor visibilidad, correas ajustables y cierres de hebilla.",
    image: "assets/arnes-naranja.jpg",
    priceGroup: "arnes",
    alt: "Arnés reflectivo de color naranja con franjas plateadas"
  },
  {
    id: "arnes-rosa",
    short: "Rosa",
    swatch: "#FF4F9A",
    ref: "CI-003",
    name: "Arnés reflectivo rosa",
    category: "Arnés reflectivos",
    description: "Arnés rosa con luces LED y franjas reflectantes para mayor visibilidad, correas ajustables y cierres de hebilla.",
    image: "assets/arnes-rosa.jpg",
    priceGroup: "arnes",
    alt: "Arnés reflectivo de color rosa con franjas plateadas"
  },
  {
    id: "arnes-azul",
    short: "Azul",
    swatch: "#2F6BFF",
    ref: "CI-004",
    name: "Arnés reflectivo azul",
    category: "Arnés reflectivos",
    description: "Arnés azul con luces LED y franjas reflectantes para mayor visibilidad, correas ajustables y cierres de hebilla.",
    image: "assets/arnes-azul.jpg",
    priceGroup: "arnes",
    alt: "Arnés reflectivo de color azul con franjas plateadas"
  },
  {
    id: "arnes-negro",
    short: "Negro",
    swatch: "#1B1B1F",
    ref: "CI-005",
    name: "Arnés reflectivo negro",
    category: "Arnés reflectivos",
    description: "Arnés negro con luces LED y franjas reflectantes para mayor visibilidad, correas ajustables y cierres de hebilla.",
    image: "assets/arnes-negro.jpg",
    priceGroup: "arnes",
    alt: "Arnés reflectivo de color negro con franjas plateadas"
  },
  {
    id: "arnes-celeste",
    short: "Celeste",
    swatch: "#5CC8F5",
    ref: "CI-006",
    name: "Arnés reflectivo celeste",
    category: "Arnés reflectivos",
    description: "Arnés celeste con luces LED y franjas reflectantes para mayor visibilidad, correas ajustables y cierres de hebilla.",
    image: "assets/arnes-celeste.png",
    priceGroup: "arnes",
    alt: "Arnés reflectivo de color celeste con franjas plateadas"
  }
];
