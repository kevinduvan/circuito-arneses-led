/*
 * config.js — Identidad, colores y WhatsApp del catálogo.
 * Edita solo este archivo para adaptar la plantilla a otro negocio.
 */
window.CATALOG_CONFIG = {
  // ── Identidad ────────────────────────────────────────────────
  businessName: "Circuito",
  shortName: "Circuito",
  tagline: "Arnés reflectivos con luces LED",
    heroText:
    "Elige el color que prefieras, arma tu selección y pide tu cotización por WhatsApp. " +
    "El precio baja según el total de unidades. El negocio te confirma disponibilidad, envío, pago y entrega.",
  catalogTitle: "Catálogo",
  catalogIntro: "Elige los colores que necesites y pide tu cotización.",
  priceLabel: "Precio a consultar",   // para productos sin grupo de precios
  pageTitle: "Circuito — Catálogo de arnés reflectivos",

  // ── Aviso de demostración ────────────────────────────────────
  // Pon demoMode en false cuando el contenido ya esté confirmado por el negocio.
  demoMode: false,
  demoNotice:
    "Sitio de demostración: las descripciones están pendientes de confirmar por el negocio.",

  // ── Precios por volumen ──────────────────────────────────────
  // Cantidad máxima por cada pulsación de "Agregar" en el catálogo.
  // En "Mi selección" se pueden sumar más agregados o editar la cantidad.
  maxPerAdd: 4,

  // Las unidades se suman dentro de un mismo grupo (priceGroup en products.js).
  // Tramos: min/max en unidades totales del grupo (max: null = sin límite).
  //   unit      precio por unidad en dólares
  //   manual    true = sin tarifa confirmada: se cotiza por WhatsApp
  //   combo     true = se muestra como "Combo aplicado" en el resumen
  //   wholesale true = se menciona en el bloque de mayoreo
  pricing: {
    currency: "$",
    groups: {
      arnes: {
        label: "Arnés reflectivos",
        tiers: [
          { min: 1,  max: 1,    unit: 20, name: "Precio individual" },
          { min: 2,  max: 2,    unit: 19, name: "Combo Dúo",  combo: true },
          { min: 3,  max: 4,    unit: 18, name: "Combo Trío", combo: true },
          { min: 5,  max: 9,    manual: true, name: "Cotización personalizada" },
          { min: 10, max: 15,   unit: 16, name: "Mayoreo 10+", combo: true, wholesale: true },
          { min: 16, max: null, unit: 15, name: "Mayoreo 16+", combo: true, wholesale: true }
        ]
      }
    }
  },
  shippingNote: "Envío por confirmar: el costo de envío no está incluido.",

  // ── Promoción: envío gratis por tiempo limitado ──────────────
  // enabled: false la apaga. until: fecha límite "AAAA-MM-DD" (inclusive); si ya pasó, se oculta sola.
  // Déjala en "" si todavía no tienes fecha de cierre.
  promo: {
    enabled: true,
    until: "",
    badge: "PROMOCIÓN",
    title: "Envío GRATIS por tiempo limitado",
    barText: "Envío GRATIS en todos tus pedidos. ¡Aprovecha esta promoción por tiempo limitado!",
    shippingNote: "🎁 Promoción: envío GRATIS por tiempo limitado.",
    footNote: "Los importes son estimados. Promoción de envío gratis por tiempo limitado.",
    messageLine: "Quiero aprovechar la promoción de envío gratis por tiempo limitado."
  },

  // ── Mayoreo ──────────────────────────────────────────────────
  wholesaleTitle: "¿Compras para tu equipo o negocio?",
  wholesaleButton: "Consultar mayoreo por WhatsApp",
  wholesaleMessage:
    "Hola, estoy interesado en adquirir arneses reflectivos por mayoreo. " +
    "Quisiera conocer disponibilidad, colores, precio total y opciones de entrega.",

  // ── WhatsApp ─────────────────────────────────────────────────
  // Número con código de país, solo dígitos. Ejemplo con formato: "503XXXXXXXX".
  // Si escribes 8 dígitos (número local de El Salvador) se antepone 503.
  // Déjalo vacío ("") hasta tener el número real: el botón quedará desactivado.
  whatsappNumber: "61724199",

  // Producto que se muestra en la tarjeta de la portada (id de products.js).
  heroProductId: "arnes-rosa"
};
