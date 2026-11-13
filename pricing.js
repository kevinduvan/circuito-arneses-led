/*
 * pricing.js — Reglas de precios por volumen (lógica pura, sin DOM).
 *
 * Las tarifas viven en config.js (CATALOG_CONFIG.pricing). Este archivo solo
 * las interpreta. Los importes se manejan en centavos enteros para evitar
 * errores de redondeo con decimales.
 *
 * Elegibilidad: cada producto declara un `priceGroup` en products.js. Las
 * unidades se suman SOLO dentro del mismo grupo; así, productos futuros de
 * otra categoría no heredan por accidente la tabla de los arneses.
 * Un producto sin `priceGroup` (o con un grupo sin tarifas) queda "sin precio".
 */
(function (root) {
  "use strict";

  function toCents(dollars) { return Math.round(Number(dollars) * 100); }

  // 1800 -> "$18.00". Devuelve "" si el valor no es un número.
  function formatMoney(cents, symbol) {
    if (typeof cents !== "number" || !isFinite(cents)) return "";
    var neg = cents < 0;
    var c = Math.abs(Math.round(cents));
    var s = (symbol || "$") + Math.floor(c / 100) + "." + ("0" + (c % 100)).slice(-2);
    return neg ? "-" + s : s;
  }

  function isValidQty(q) {
    return typeof q === "number" && isFinite(q) && Math.floor(q) === q && q >= 1;
  }

  function normalizeTiers(tiers) {
    return (Array.isArray(tiers) ? tiers : []).map(function (t) {
      return {
        min: Number(t.min),
        max: t.max === null || t.max === undefined ? Infinity : Number(t.max),
        manual: !!t.manual,
        unitCents: t.manual ? null : toCents(t.unit),
        name: t.name || "",
        combo: !!t.combo,
        wholesale: !!t.wholesale
      };
    }).filter(function (t) {
      return isFinite(t.min) && t.min >= 1 && t.max >= t.min && (t.manual || (isFinite(t.unitCents) && t.unitCents > 0));
    });
  }

  // Tarifa que corresponde a `units`; null si ningún tramo la cubre.
  function findTier(tiers, units) {
    var list = normalizeTiers(tiers);
    for (var i = 0; i < list.length; i++) {
      if (units >= list[i].min && units <= list[i].max) return list[i];
    }
    return null;
  }

  // Precio individual (tramo que empieza en 1 unidad).
  function baseCents(list) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].min === 1 && !list[i].manual) return list[i].unitCents;
    }
    return null;
  }

  // Siguiente tramo con precio más bajo que el actual (para sugerir al visitante).
  function nextTier(list, units, currentUnitCents) {
    var best = null;
    list.forEach(function (t) {
      if (t.manual || t.min <= units) return;
      if (currentUnitCents !== null && t.unitCents >= currentUnitCents) return;
      if (!best || t.min < best.min) best = t;
    });
    return best ? { min: best.min, unitCents: best.unitCents, name: best.name } : null;
  }

  /*
   * quote(lines, pricing)
   *   lines:   [{id, qty, group}]
   *   pricing: {groups: {grupo: {label, tiers: [...]}}}
   * Devuelve el desglose; `subtotalCents` es null cuando hay algo pendiente de cotizar.
   */
  function quote(lines, pricing) {
    var cfgGroups = (pricing && pricing.groups) || {};
    var out = {
      lines: [], groups: [], items: 0, units: 0,
      subtotalCents: null, savingsCents: 0,
      hasManual: false, hasUnpriced: false, hasInvalid: false
    };
    var acc = {}, order = [];

    (Array.isArray(lines) ? lines : []).forEach(function (l) {
      var ln = { id: l.id, qty: l.qty, group: l.group || null, status: "", unitCents: null, subtotalCents: null };
      out.lines.push(ln);
      if (!isValidQty(l.qty)) { ln.status = "invalid"; out.hasInvalid = true; return; }
      out.items++; out.units += l.qty;
      var g = l.group && cfgGroups[l.group];
      if (!g) { ln.status = "unpriced"; out.hasUnpriced = true; return; }
      ln.status = "pending";
      if (!acc[l.group]) { acc[l.group] = { group: l.group, label: g.label || l.group, units: 0 }; order.push(l.group); }
      acc[l.group].units += l.qty;
    });

    var subtotal = 0, anyPriced = false;
    order.forEach(function (key) {
      var G = acc[key];
      var list = normalizeTiers(cfgGroups[key].tiers);
      var t = null;
      for (var i = 0; i < list.length; i++) { if (G.units >= list[i].min && G.units <= list[i].max) { t = list[i]; break; } }
      G.baseCents = baseCents(list);
      if (!t || t.manual) {
        G.status = "manual";
        G.tierName = (t && t.name) || "Cotización personalizada";
        G.combo = false; G.unitCents = null; G.subtotalCents = null; G.savingsCents = 0;
        out.hasManual = true;
      } else {
        G.status = "priced";
        G.tierName = t.name; G.combo = t.combo;
        G.unitCents = t.unitCents;
        G.subtotalCents = t.unitCents * G.units;
        G.savingsCents = G.baseCents !== null ? Math.max(0, G.baseCents * G.units - G.subtotalCents) : 0;
        subtotal += G.subtotalCents; anyPriced = true;
        out.savingsCents += G.savingsCents;
      }
      G.next = nextTier(list, G.units, G.status === "priced" ? G.unitCents : null);
      out.groups.push(G);
    });

    out.lines.forEach(function (ln) {
      if (ln.status !== "pending") return;
      var G = acc[ln.group];
      if (G.status === "priced") { ln.status = "priced"; ln.unitCents = G.unitCents; ln.subtotalCents = G.unitCents * ln.qty; }
      else ln.status = "manual";
    });

    // Subtotal definitivo solo si todo lo válido tiene precio.
    if (anyPriced && !out.hasManual && !out.hasUnpriced) out.subtotalCents = subtotal;
    return out;
  }

  var api = { toCents: toCents, formatMoney: formatMoney, isValidQty: isValidQty, normalizeTiers: normalizeTiers, findTier: findTier, quote: quote };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.CatalogPricing = api;
})(typeof window !== "undefined" ? window : globalThis);
