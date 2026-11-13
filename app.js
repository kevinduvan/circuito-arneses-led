/*
 * app.js — Estado de la selección, interfaz y mensajes de WhatsApp.
 * Las reglas de precios están en pricing.js y las tarifas en config.js.
 *
 * Estructura:
 *   1. Lógica pura: cantidades, lista, mensajes, WhatsApp (se prueba con Node).
 *   2. Interfaz: catálogo, combos, panel "Mi selección", diálogos y mayoreo.
 */
(function () {
  "use strict";

  /* ───────────────────────── 1. LÓGICA PURA ───────────────────────── */

  var MAX_QTY = 999;

  // Valida una cantidad escrita por el visitante: entero de 1 a `max` (por defecto 999).
  function parseQuantity(raw, max) {
    var limit = max || MAX_QTY;
    var s = String(raw === null || raw === undefined ? "" : raw).trim();
    if (s === "") return { ok: false, error: "Escribe una cantidad (un número entero de 1 en adelante)." };
    if (!/^\d+$/.test(s)) return { ok: false, error: "Usa solo números enteros, sin signos, puntos ni letras." };
    if (s.length > 6) return { ok: false, error: "La cantidad máxima es " + limit + "." };
    var n = parseInt(s, 10);
    if (n < 1) return { ok: false, error: "La cantidad mínima es 1." };
    if (n > limit) return { ok: false, error: "La cantidad máxima es " + limit + "." };
    return { ok: true, value: n };
  }

  // La lista es un arreglo [{id, qty}] que conserva el orden de llegada.
  function addItem(list, id, qty) {
    var next = list.map(function (i) { return { id: i.id, qty: i.qty }; });
    var found = next.filter(function (i) { return i.id === id; })[0];
    if (found) found.qty = Math.min(MAX_QTY, found.qty + qty);
    else next.push({ id: id, qty: Math.min(MAX_QTY, qty) });
    return next;
  }
  function setQty(list, id, qty) {
    return list.map(function (i) { return i.id === id ? { id: i.id, qty: qty } : { id: i.id, qty: i.qty }; });
  }
  function removeItem(list, id) {
    return list.filter(function (i) { return i.id !== id; });
  }
  function summarize(list) {
    var units = 0;
    list.forEach(function (i) { units += i.qty; });
    return { items: list.length, units: units };
  }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }
  function summaryText(list) {
    if (!list.length) return "Aún no hay productos.";
    var s = summarize(list);
    return plural(s.items, "artículo", "artículos") + " · " + plural(s.units, "unidad", "unidades");
  }

  // Número de WhatsApp: solo dígitos; 8 dígitos = número local de El Salvador (+503).
  function normalizeWhatsApp(raw) {
    var s = String(raw === null || raw === undefined ? "" : raw).trim();
    if (s === "") return { valid: false, reason: "empty" };
    if (/[^\d\s()+\-.]/.test(s)) return { valid: false, reason: "invalid" };
    var d = s.replace(/\D/g, "");
    if (d.indexOf("00") === 0) d = d.slice(2);
    if (/^\d{8}$/.test(d)) d = "503" + d;
    if (!/^[1-9]\d{9,14}$/.test(d)) return { valid: false, reason: "invalid" };
    return { valid: true, number: d };
  }

  /*
   * Mensaje de cotización.
   *   q:     resultado de CatalogPricing.quote()
   *   lines: [{name, color, qty}]  (color es opcional: si falta se usa el nombre)
   *   fmt:   función (centavos) -> "$18.00"
   *   brand: nombre del negocio para el saludo (por defecto "CIRCUITO")
   * Solo incluye importes que existen: nunca imprime valores vacíos ni inventados.
   */
  function buildQuoteMessage(q, lines, fmt, brand) {
    var out = ["Hola, quiero solicitar una cotización de arneses reflectivos LED de " + (brand || "CIRCUITO") + ".", "", "Mi selección:"];
    lines.forEach(function (l) { out.push("- Color: " + (l.color || l.name) + " — Cantidad: " + l.qty); });
    out.push("", "Total de unidades: " + q.units);

    if (q.groups.length === 1 && !q.hasUnpriced) {
      var G = q.groups[0];
      if (G.status === "priced") {
        out.push("Precio por unidad: " + fmt(G.unitCents));
        out.push("Total estimado: " + fmt(q.subtotalCents));
        if (q.savingsCents > 0) out.push("Ahorro: " + fmt(q.savingsCents));
      } else {
        out.push("Cotización personalizada: por favor indíquenme el precio para esta cantidad.");
      }
    } else {
      q.groups.forEach(function (G) {
        out.push("- " + G.label + ": " + plural(G.units, "unidad", "unidades") + " — " +
          (G.status === "priced" ? G.tierName + ", " + fmt(G.unitCents) + " c/u" : "cotización personalizada"));
      });
      if (q.hasUnpriced) out.push("Algunos productos no tienen precio publicado: por favor indíquenme el precio.");
      if (q.subtotalCents !== null) out.push("Total estimado: " + fmt(q.subtotalCents));
      if (q.subtotalCents !== null && q.savingsCents > 0) out.push("Ahorro: " + fmt(q.savingsCents));
    }

    out.push("", "Quisiera confirmar disponibilidad y opciones de entrega.",
      "(Esto es una solicitud de cotización, no un pedido confirmado.)", "", "Gracias.");
    return out.join("\n");
  }

  function buildWhatsAppUrl(number, text) {
    return "https://wa.me/" + number + "?text=" + encodeURIComponent(text);
  }

  var logic = {
    MAX_QTY: MAX_QTY, parseQuantity: parseQuantity, addItem: addItem, setQty: setQty,
    removeItem: removeItem, summarize: summarize, summaryText: summaryText,
    normalizeWhatsApp: normalizeWhatsApp, buildQuoteMessage: buildQuoteMessage, buildWhatsAppUrl: buildWhatsAppUrl
  };

  if (typeof module !== "undefined" && module.exports) module.exports = logic;
  if (typeof document === "undefined") return;

  /* ───────────────────────── 2. INTERFAZ ───────────────────────── */

  var CFG = window.CATALOG_CONFIG || {};
  var Pricing = window.CatalogPricing;
  var PRICING = CFG.pricing || { groups: {} };
  var CUR = PRICING.currency || "$";
  var MAX_ADD = Math.min(MAX_QTY, Math.max(1, parseInt(CFG.maxPerAdd, 10) || MAX_QTY));
  var ALL = Array.isArray(window.CATALOG_PRODUCTS) ? window.CATALOG_PRODUCTS : [];
  var seen = Object.create(null);
  var PRODUCTS = ALL.filter(function (p) {
    var ok = p && p.id && p.name && p.ref && !seen[p.id];
    if (!ok) console.warn("Producto omitido (faltan id, name o ref, o el id está repetido).", p);
    else seen[p.id] = true;
    return ok;
  });
  if (PRODUCTS.length > 10) console.warn("Hay más de 10 productos; la plantilla está pensada para 10 como máximo.");
  var byId = Object.create(null);
  PRODUCTS.forEach(function (p) { byId[p.id] = p; });

  var STORAGE_KEY = "catalogo-seleccion";
  var list = loadList();
  var wa = normalizeWhatsApp(CFG.whatsappNumber);
  var dialogOpener = null;
  var drawerOpener = null;
  var comboOpener = null;
  var flashTimers = {};
  var toastTimer = null;
  var lastQuote = null;
  var reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  // Solo rutas locales: evita que una URL externa filtre la IP del visitante a terceros.
  function localSrc(src) {
    var s = String(src || "");
    return /^([a-z][a-z0-9+.-]*:|\/\/)/i.test(s) ? "" : s;
  }
  function safeColor(c) { return /^#[0-9a-f]{3,8}$/i.test(String(c || "")) ? c : "#D4D4DC"; }
  function money(cents) { return Pricing.formatMoney(cents, CUR); }
  function colorName(p) { return p.short || p.name; }
  // Reinicia una animación CSS de un solo disparo.
  function pulse(node, cls) {
    if (!node || reduceMotion) return;
    node.classList.remove(cls);
    void node.offsetWidth;
    node.classList.add(cls);
  }

  function loadList() {
    try {
      var raw = sessionStorage.getItem(STORAGE_KEY);
      var data = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(data)) return [];
      var seenIds = Object.create(null);
      return data.filter(function (i) {
        if (!i || !byId[i.id] || seenIds[i.id] || !parseQuantity(i.qty).ok) return false;
        seenIds[i.id] = true; return true;
      }).map(function (i) { return { id: i.id, qty: Number(i.qty) }; });
    } catch (e) { return []; }
  }
  function saveList() {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch (e) { /* sin almacenamiento: la lista sigue en memoria */ }
  }

  function currentQuote() {
    return Pricing.quote(list.map(function (i) {
      return { id: i.id, qty: i.qty, group: byId[i.id].priceGroup || null };
    }), PRICING);
  }

  // Tramos de tarifa del primer grupo de precios (los arneses).
  function mainTiers() {
    var key = Object.keys(PRICING.groups || {})[0];
    return key ? Pricing.normalizeTiers(PRICING.groups[key].tiers) : [];
  }
  function baseTier() {
    return mainTiers().filter(function (t) { return t.min === 1 && !t.manual; })[0] || null;
  }
  // Precio de un combo de `n` unidades solo si existe una tarifa confirmada para esa cantidad.
  function comboPrice(n) {
    var t = mainTiers().filter(function (x) { return n >= x.min && n <= x.max; })[0];
    if (!t || t.manual) return null;
    return { unitCents: t.unitCents, totalCents: t.unitCents * n };
  }

  // Tarifas de mayoreo declaradas en config.js, de la forma "Desde 10 unidades a $16.00 c/u".
  function wholesaleTiers() {
    var res = [];
    Object.keys(PRICING.groups || {}).forEach(function (k) {
      Pricing.normalizeTiers(PRICING.groups[k].tiers).forEach(function (t) {
        if (t.wholesale && !t.manual) res.push({ min: t.min, cents: t.unitCents });
      });
    });
    return res.sort(function (a, b) { return a.min - b.min; });
  }

  // ── Identidad desde config.js ──
  function applyConfig() {
    if (CFG.demoMode) {
      var demo = $("demo-bar");
      demo.textContent = CFG.demoNotice || "Sitio de demostración.";
      demo.hidden = false;
    }
    if (CFG.catalogIntro) $("catalog-intro").textContent = CFG.catalogIntro;

    // Bloque de mayoreo
    $("ws-title").textContent = CFG.wholesaleTitle || "¿Compras para tu equipo o negocio?";
    var tiers = wholesaleTiers();
    var wsText = "Tenemos precios especiales por volumen.";
    if (tiers.length) {
      wsText += " " + tiers.map(function (t, i) {
        return (i === 0 ? "Desde " : "desde ") + t.min + " unidades a " + money(t.cents) + " c/u";
      }).join(" y ") + ".";
    }
    $("ws-text").textContent = wsText;
    $("btn-wholesale").textContent = CFG.wholesaleButton || "Consultar mayoreo por WhatsApp";
    $("contacto").hidden = !(CFG.wholesaleMessage);
  }

  // Texto neutro para el público; el detalle técnico va solo a la consola.
  if (!wa.valid) {
    console.warn(wa.reason === "empty"
      ? "WhatsApp desactivado: falta el número en config.js (whatsappNumber)."
      : "WhatsApp desactivado: el número de config.js no es válido (solo dígitos con código de país; 8 dígitos = +503).");
  }
  function waNote(short) {
    if (wa.valid) return "";
    return short ? "WhatsApp no está disponible por ahora."
      : "WhatsApp no está disponible por ahora. Puedes copiar tu solicitud y enviarla por tu cuenta.";
  }

  // ── Portada: datos que salen de los productos y tarifas reales ──
  function renderHero() {
    var p = byId[CFG.heroProductId] || PRODUCTS[0];
    if (p && localSrc(p.image)) {
      var img = $("hero-img");
      if (img.getAttribute("src") !== localSrc(p.image)) img.src = localSrc(p.image);
      img.alt = p.alt || p.name;
    }
    var base = baseTier();
    if (base) { $("hero-price-v").textContent = money(base.unitCents); $("hero-price").hidden = false; }
    var duo = comboPrice(2);
    if (duo && base && duo.unitCents < base.unitCents) {
      $("hero-promo-k").textContent = "Desde 2 uds";
      $("hero-promo-v").textContent = money(duo.unitCents);
      $("hero-promo").hidden = false;
    }
    if (wa.valid) {
      var fw = $("footer-wa");
      fw.href = "https://wa.me/" + wa.number; fw.target = "_blank"; fw.rel = "noopener";
      fw.hidden = false;
    }
    if (PRODUCTS.length) {
      var sw = $("hero-swatches");
      sw.textContent = "";
      PRODUCTS.forEach(function (x) {
        var d = el("span", "swatch");
        d.style.background = safeColor(x.swatch);
        sw.appendChild(d);
      });
      $("hero-colors-text").textContent = plural(PRODUCTS.length, "color", "colores");
      $("hero-colors-card").hidden = false;
    }
  }

  // ── Control de cantidad reutilizable (tarjeta y lista) ──
  // opts: {value, label, max, hint, onCommit(valor), onStep(delta)}
  var stepperCount = 0;
  function makeStepper(opts) {
    var max = opts.max || MAX_QTY;
    var wrap = el("div", "stepper-wrap");
    var box = el("div", "stepper");
    var minus = el("button", "stepper-btn", "−");
    minus.type = "button";
    minus.setAttribute("aria-label", "Disminuir cantidad de " + opts.label);
    var input = el("input", "stepper-input");
    input.type = "text";
    input.inputMode = "numeric";
    input.autocomplete = "off";
    input.name = "cantidad-" + (opts.id || String(opts.label).toLowerCase().replace(/[^a-z0-9]+/g, "-"));
    input.value = String(opts.value);
    input.setAttribute("aria-label", "Cantidad de " + opts.label);
    var plus = el("button", "stepper-btn", "+");
    plus.type = "button";
    plus.setAttribute("aria-label", "Aumentar cantidad de " + opts.label);
    var err = el("p", "field-error");
    err.id = "err-" + (++stepperCount);
    input.setAttribute("aria-describedby", err.id);
    err.setAttribute("role", "alert");
    box.appendChild(minus); box.appendChild(input); box.appendChild(plus);
    wrap.appendChild(box); wrap.appendChild(err);

    function showError(msg) {
      err.textContent = msg || "";
      if (msg) input.setAttribute("aria-invalid", "true"); else input.removeAttribute("aria-invalid");
    }
    function validate() {
      var r = parseQuantity(input.value, max);
      if (!r.ok && opts.hint && /^\d+$/.test(input.value.trim()) && Number(input.value) > max) r.error += " " + opts.hint;
      return r;
    }
    var lastValid = opts.value;
    function step(delta) {
      // Si el campo tiene texto inválido, los botones vuelven al último valor válido.
      var r = parseQuantity(input.value, max);
      var base = r.ok ? r.value : lastValid;
      showError("");
      var next = base + delta;
      if (next < 1 || next > max) { input.value = String(base); return; }
      input.value = String(next);
      lastValid = next;
      pulse(input, "is-bump");
      opts.onStep(delta, input);
    }
    minus.addEventListener("click", function () { step(-1); });
    plus.addEventListener("click", function () { step(1); });
    input.addEventListener("change", function () {
      var r = validate();
      if (!r.ok) { showError(r.error); return; }
      showError("");
      input.value = String(r.value);
      lastValid = r.value;
      opts.onCommit(r.value, input);
    });
    input.addEventListener("input", function () {
      if (input.getAttribute("aria-invalid") && parseQuantity(input.value, max).ok) showError("");
    });
    function reset(v) { input.value = String(v); lastValid = v; showError(""); }
    return { el: wrap, input: input, showError: showError, validate: validate, reset: reset };
  }

  // ── Catálogo ──
  function cardPriceNodes(p) {
    var g = p.priceGroup && PRICING.groups && PRICING.groups[p.priceGroup];
    var wrap = el("div", "card-price");
    if (!g) { wrap.appendChild(el("span", "price-main", CFG.priceLabel || "Precio a consultar")); return wrap; }
    var tiers = Pricing.normalizeTiers(g.tiers).filter(function (t) { return !t.manual; });
    var base = tiers.filter(function (t) { return t.min === 1; })[0];
    if (!base) { wrap.appendChild(el("span", "price-main", CFG.priceLabel || "Precio a consultar")); return wrap; }
    var main = el("span", "price-main", money(base.unitCents));
    main.appendChild(el("small", "", " c/u"));
    wrap.appendChild(main);
    var next = tiers.filter(function (t) { return t.min > 1; })[0];
    if (next) wrap.appendChild(el("span", "price-note", "Desde " + next.min + " unidades: " + money(next.unitCents) + " c/u"));
    return wrap;
  }

  // Paneles laterales de la sección de productos: solo datos reales de config.js y products.js.
  function renderSide() {
    var left = $("side-tiers"), right = $("side-colors");
    if (left) {
      left.textContent = "";
      left.appendChild(el("p", "side-kicker", "Precio por cantidad"));
      left.appendChild(el("h3", "side-title", "Más unidades, mejor precio"));
      var ul = el("ul", "tier-list");
      mainTiers().forEach(function (t) {
        var li = el("li", "tier-row");
        var range = t.max === Infinity || t.max == null ? t.min + "+ uds" : (t.max === t.min ? t.min + " ud" : t.min + "–" + t.max + " uds");
        li.appendChild(el("span", "tier-range", range));
        li.appendChild(el("span", "tier-price", t.manual ? "Cotización" : money(t.unitCents) + " c/u"));
        ul.appendChild(li);
      });
      left.appendChild(ul);
      left.appendChild(el("p", "side-note", "Las unidades de todos los colores se suman."));
    }
    if (right) {
      right.textContent = "";
      right.appendChild(el("p", "side-kicker", "Colores disponibles"));
      right.appendChild(el("h3", "side-title", PRODUCTS.length + " colores para elegir"));
      var cl = el("ul", "color-list");
      PRODUCTS.forEach(function (p) {
        var li = el("li", "color-row");
        var dot = el("span", "swatch");
        dot.style.background = safeColor(p.swatch);
        li.appendChild(dot);
        li.appendChild(el("span", "", colorName(p)));
        cl.appendChild(li);
      });
      right.appendChild(cl);
      var a = el("a", "side-link", "Ver combos →");
      a.href = "#combos";
      right.appendChild(a);
    }
  }

  function renderCatalog() {
    var grid = $("product-grid");
    grid.textContent = "";
    if (!PRODUCTS.length) {
      grid.appendChild(el("li", "empty-block", "Aún no hay productos configurados. Edita products.js para agregarlos."));
      return;
    }
    PRODUCTS.forEach(function (p) {
      var card = el("li", "card reveal");
      card.id = "card-" + p.id;

      var fig = el("div", "card-media");
      var img = document.createElement("img");
      img.width = 347; img.height = 347;
      img.loading = "lazy"; img.decoding = "async";
      img.alt = p.alt || p.name;
      img.src = localSrc(p.image);
      img.addEventListener("error", function () { fig.classList.add("is-missing"); img.hidden = true; });
      fig.appendChild(img);
      var tag = el("span", "card-tag");
      var dot = el("span", "swatch");
      dot.style.background = safeColor(p.swatch);
      tag.appendChild(dot);
      tag.appendChild(document.createTextNode(" " + colorName(p)));
      fig.appendChild(tag);
      card.appendChild(fig);

      var body = el("div", "card-body");
      body.appendChild(el("h3", "card-title", p.name));
      body.appendChild(el("p", "card-colorline", "Color: " + colorName(p)));
      body.appendChild(cardPriceNodes(p));
      var inCart = el("p", "in-cart");
      inCart.id = "incart-" + p.id;
      body.appendChild(inCart);

      var row = el("div", "card-actions");
      var stepper = makeStepper({
        value: 1, label: p.name, max: MAX_ADD,
        hint: "Para más, agrégalo varias veces o edítalo en Mi selección.",
        onStep: function () {}, onCommit: function () {}
      });
      var add = el("button", "add-circle");
      add.type = "button";
      add.setAttribute("aria-label", "Agregar " + p.name + " a mi selección");
      add.innerHTML = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
      add.addEventListener("click", function () {
        var r = stepper.validate();
        if (!r.ok) { stepper.showError(r.error); stepper.input.focus(); return; }
        stepper.showError("");
        var before = list.filter(function (i) { return i.id === p.id; })[0];
        var prevQty = before ? before.qty : 0;
        list = addItem(list, p.id, r.value);
        var after = list.filter(function (i) { return i.id === p.id; })[0];
        stepper.reset(1);
        saveList();
        renderList();
        flashAdded(add, p, after.qty - prevQty, after.qty - prevQty < r.value);
      });
      row.appendChild(stepper.el);
      row.appendChild(add);
      body.appendChild(row);
      card.appendChild(body);
      grid.appendChild(card);
    });
    updateInCartBadges();
  }

  function updateInCartBadges() {
    PRODUCTS.forEach(function (p) {
      var n = $("incart-" + p.id);
      if (!n) return;
      var it = list.filter(function (i) { return i.id === p.id; })[0];
      n.textContent = it ? "En tu selección: " + it.qty : "";
    });
  }

  // Aviso breve (región con aria-live) con acceso al panel.
  function showToast(text, withLink) {
    var t = $("toast");
    t.textContent = "";
    t.appendChild(el("span", "", text));
    if (withLink) {
      var b = el("button", "toast-link", "Ver mi selección");
      b.type = "button";
      b.addEventListener("click", function () { openDrawer(b); });
      t.appendChild(b);
    }
    t.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("is-on"); }, 4200);
  }
  function hideToast() { clearTimeout(toastTimer); $("toast").classList.remove("is-on"); }

  function flashAdded(btn, p, qty, capped) {
    btn.classList.add("is-done");
    pulse(btn, "is-bump");
    clearTimeout(flashTimers[p.id]);
    flashTimers[p.id] = setTimeout(function () { btn.classList.remove("is-done"); }, 2000);
    var s = summarize(list);
    showToast(colorName(p) + " agregado (" + plural(qty, "unidad", "unidades") +
      (capped ? ", se alcanzó el máximo de " + MAX_QTY : "") + "). Total: " + plural(s.units, "unidad", "unidades") + ".", true);
  }

  // ── Combos ──
  var COMBOS = [
    { n: 1, name: "Individual", noun: "1 arnés" },
    { n: 2, name: "Combo Dúo", noun: "2 arneses" },
    { n: 3, name: "Combo Trío", noun: "3 arneses" },
    { n: 4, name: "Combo Cuarteto", noun: "4 arneses" }
  ];
  var comboState = { n: 0, picks: [] };

  function renderCombos() {
    var grid = $("combo-grid");
    grid.textContent = "";
    var priced = COMBOS.filter(function (c) { return comboPrice(c.n); });
    if (!priced.length || !PRODUCTS.length) { $("combos").hidden = true; return; }
    var lowest = Math.min.apply(null, priced.map(function (c) { return comboPrice(c.n).unitCents; }));
    var tints = ["tint-lilac", "tint-blue", "tint-mint", "tint-pink"];
    priced.forEach(function (c, idx) {
      var pr = comboPrice(c.n);
      var best = pr.unitCents === lowest && c.n > 1 && pr.unitCents < comboPrice(1).unitCents;
      var feature = c.n >= 3 && best;
      var li = el("li", "combo reveal " + tints[idx % tints.length] + "");
      if (feature) li.appendChild(el("span", "combo-badge", "Mejor precio por unidad"));

      var art = el("div", "combo-art");
      art.setAttribute("aria-hidden", "true");
      for (var k = 0; k < c.n; k++) {
        var p = PRODUCTS[k % PRODUCTS.length];
        var im = document.createElement("img");
        im.width = 347; im.height = 347;
        im.loading = "lazy"; im.decoding = "async";
        im.alt = ""; im.src = localSrc(p.image);
        im.style.setProperty("--i", k); im.style.setProperty("--n", c.n);
        art.appendChild(im);
      }
      li.appendChild(art);

      li.appendChild(el("h3", "combo-title", c.name));
      li.appendChild(el("p", "combo-units", c.noun));
      li.appendChild(el("p", "combo-total", money(pr.totalCents)));
      li.appendChild(el("p", "combo-unit", money(pr.unitCents) + " por unidad"));
      var btn = el("button", "combo-link", "Elegir combo");
      btn.innerHTML += ' <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
      btn.type = "button";
      btn.setAttribute("aria-label", "Elegir " + c.name + ", " + c.noun + " por " + money(pr.totalCents));
      btn.addEventListener("click", function () { openCombo(c, btn); });
      li.appendChild(btn);
      grid.appendChild(li);
    });
    var manual = mainTiers().filter(function (t) { return t.manual; })[0];
    $("combo-note").textContent = manual
      ? "Para " + manual.min + (manual.max !== Infinity ? " a " + manual.max : " o más") +
        " unidades te preparamos una cotización personalizada por WhatsApp."
      : "";
  }

  var comboDlg = $("combo-dialog");
  function openCombo(c, opener) {
    comboOpener = opener;
    comboState.n = c.n;
    // Colores distintos por defecto (el visitante puede cambiarlos).
    comboState.picks = [];
    for (var k = 0; k < c.n; k++) comboState.picks.push(PRODUCTS[k % PRODUCTS.length].id);
    $("combo-dlg-title").textContent = c.name + ": elige tus colores";
    $("combo-dlg-sub").textContent = c.noun + ". Puedes repetir colores o combinarlos como quieras.";
    renderSlots();
    updateComboSum();
    if (typeof comboDlg.showModal === "function") comboDlg.showModal(); else comboDlg.setAttribute("open", "");
    var first = comboDlg.querySelector("input[type=radio]:checked");
    if (first) first.focus();
  }
  function closeCombo() {
    if (typeof comboDlg.close === "function") comboDlg.close(); else comboDlg.removeAttribute("open");
  }
  function renderSlots() {
    var box = $("combo-slots");
    box.textContent = "";
    for (var k = 0; k < comboState.n; k++) {
      (function (slot) {
        var fs = el("fieldset", "slot");
        fs.appendChild(el("legend", "slot-legend", "Arnés " + (slot + 1)));
        var opts = el("div", "slot-opts");
        PRODUCTS.forEach(function (p) {
          var lab = el("label", "swatch-opt");
          var inp = document.createElement("input");
          inp.type = "radio"; inp.name = "slot-" + slot; inp.value = p.id;
          inp.checked = comboState.picks[slot] === p.id;
          inp.addEventListener("change", function () { comboState.picks[slot] = p.id; updateComboSum(); });
          var dot = el("span", "swatch-dot");
          dot.style.background = safeColor(p.swatch);
          lab.appendChild(inp); lab.appendChild(dot);
          lab.appendChild(el("span", "swatch-name", colorName(p)));
          opts.appendChild(lab);
        });
        fs.appendChild(opts);
        box.appendChild(fs);
      })(k);
    }
  }
  function updateComboSum() {
    var pr = comboPrice(comboState.n);
    var s = $("combo-sum");
    if (!pr) { s.textContent = ""; return; }
    var txt = plural(comboState.n, "arnés", "arneses") + " · " + money(pr.unitCents) + " c/u · " + money(pr.totalCents);
    if (list.length) txt += ". Se suman a tu selección actual: el precio final depende del total de unidades.";
    s.textContent = txt;
  }
  $("combo-close-x").addEventListener("click", closeCombo);
  $("combo-cancel").addEventListener("click", closeCombo);
  comboDlg.addEventListener("close", function () {
    if (comboOpener && document.contains(comboOpener)) comboOpener.focus();
    comboOpener = null;
  });
  var downOnComboBackdrop = false;
  comboDlg.addEventListener("mousedown", function (e) { downOnComboBackdrop = e.target === comboDlg; });
  comboDlg.addEventListener("click", function (e) { if (e.target === comboDlg && downOnComboBackdrop) closeCombo(); });
  $("combo-add").addEventListener("click", function () {
    comboState.picks.forEach(function (id) { list = addItem(list, id, 1); });
    var n = comboState.n;
    saveList();
    renderList();
    comboOpener = null;           // el foco pasa al panel, no al botón del combo
    closeCombo();
    openDrawer($("header-selection"));
    showToast(plural(n, "arnés agregado", "arneses agregados") + " a tu selección.", false);
  });

  // ── Panel "Mi selección" ──
  function renderList() {
    var ul = $("sel-list");
    var has = list.length > 0;
    $("sel-empty").hidden = has;
    ul.hidden = !has;
    $("sel-actions").hidden = !has;
    $("sel-quote").hidden = !has;
    $("sel-summary").textContent = summaryText(list);
    ul.textContent = "";

    list.forEach(function (it) {
      var p = byId[it.id];
      var li = el("li", "sel-item");
      li.setAttribute("data-id", p.id);
      var thumb = el("div", "sel-thumb");
      var img = document.createElement("img");
      img.src = localSrc(p.image); img.alt = ""; img.width = 347; img.height = 347;
      img.addEventListener("error", function () { img.hidden = true; });
      thumb.appendChild(img);
      li.appendChild(thumb);

      var info = el("div", "sel-info");
      info.appendChild(el("p", "sel-name", p.name));
      var meta = el("p", "sel-ref");
      var dot = el("span", "swatch");
      dot.style.background = safeColor(p.swatch);
      meta.appendChild(dot);
      meta.appendChild(document.createTextNode(" " + colorName(p) + " · Ref. " + p.ref));
      info.appendChild(meta);
      var stepper = makeStepper({
        value: it.qty, label: p.name,
        onStep: function (d) { changeQty(p.id, d, null); },
        onCommit: function (v) { changeQty(p.id, 0, v); }
      });
      info.appendChild(stepper.el);
      info.appendChild(el("p", "sel-price"));
      li.appendChild(info);

      var rm = el("button", "btn-remove", "Quitar");
      rm.type = "button";
      rm.setAttribute("aria-label", "Quitar " + p.name + " de mi selección");
      rm.addEventListener("click", function () {
        var idx = list.map(function (i) { return i.id; }).indexOf(p.id);
        list = removeItem(list, p.id);
        saveList(); hideToast(); renderList();
        var rest = $("sel-list").querySelectorAll(".btn-remove");
        if (rest.length) rest[Math.min(idx, rest.length - 1)].focus();
        else $("seleccion").focus();
      });
      li.appendChild(rm);
      ul.appendChild(li);
    });

    $("clear-confirm").hidden = true;
    $("clear-row").hidden = false;
    $("wa-note-panel").textContent = waNote(true);
    updatePricing();
    updateHeader();
    updateInCartBadges();
  }

  // Recalcula precios y refresca líneas y resumen sin perder el foco.
  function updatePricing() {
    var q = currentQuote();
    lastQuote = q;
    var items = $("sel-list").querySelectorAll(".sel-item");
    q.lines.forEach(function (ln, idx) {
      var node = items[idx] && items[idx].querySelector(".sel-price");
      if (!node) return;
      var before = node.textContent;
      if (ln.status === "priced") node.textContent = money(ln.unitCents) + " c/u · " + money(ln.subtotalCents);
      else if (ln.status === "manual") node.textContent = "Precio por cotizar";
      else node.textContent = CFG.priceLabel || "Precio a consultar";
      node.classList.toggle("is-pending", ln.status !== "priced");
      if (before && before !== node.textContent) pulse(node, "is-bump");
    });
    renderQuote(q);
    updateFloat(q);
  }

  function renderQuote(q) {
    var box = $("quote-rows");
    box.textContent = "";
    function row(label, value, cls) {
      var d = el("div", "quote-row" + (cls ? " " + cls : ""));
      d.appendChild(el("dt", "", label));
      d.appendChild(el("dd", "", value));
      box.appendChild(d);
    }
    row("Total de unidades", String(q.units));
    q.groups.forEach(function (G) {
      if (G.status === "priced") {
        row(G.combo ? "Combo aplicado" : "Tarifa aplicada", G.tierName);
        row("Precio por unidad", money(G.unitCents));
      } else {
        row("Tarifa", "Cotización personalizada");
      }
    });
    if (q.savingsCents > 0) row("Ahorro", money(q.savingsCents), "is-saving");

    var hint = $("quote-hint");
    hint.textContent = "";
    var G0 = q.groups.length === 1 ? q.groups[0] : null;
    if (G0 && G0.next) {
      var need = G0.next.min - G0.units;
      hint.textContent = "Con " + plural(G0.next.min, "unidad", "unidades") + " pagas " + money(G0.next.unitCents) +
        " c/u (te " + (need === 1 ? "falta " : "faltan ") + need + ").";
    }

    var total = $("quote-total");
    var prev = total.textContent;
    total.textContent = "";
    var label = el("span", "quote-total-label");
    var val = el("span", "quote-total-value");
    if (q.subtotalCents !== null) {
      label.textContent = "Total estimado";
      val.textContent = money(q.subtotalCents);
      total.classList.remove("is-manual");
    } else if (q.hasManual) {
      label.textContent = "Cotización personalizada";
      val.textContent = "Te confirmamos el precio por WhatsApp";
      total.classList.add("is-manual");
    } else {
      label.textContent = "Precio";
      val.textContent = CFG.priceLabel || "Precio a consultar";
      total.classList.add("is-manual");
    }
    total.appendChild(label); total.appendChild(val);
    if (prev && prev !== total.textContent) pulse(val, "is-bump");
    $("quote-ship").textContent = CFG.shippingNote || "";
  }

  // Cambio de cantidad: no reconstruye la lista para no perder el foco.
  function changeQty(id, delta, absolute) {
    var it = list.filter(function (i) { return i.id === id; })[0];
    if (!it) return;
    var v = absolute !== null ? absolute : it.qty + delta;
    list = setQty(list, id, Math.max(1, Math.min(MAX_QTY, v)));
    saveList();
    hideToast();
    $("sel-summary").textContent = summaryText(list);
    updatePricing();
    updateHeader();
    updateInCartBadges();
  }

  function updateHeader() {
    var s = summarize(list);
    var cnt = $("header-count");
    var changed = cnt.textContent !== String(s.units);
    cnt.textContent = String(s.units);
    $("header-count-sr").textContent = s.items
      ? ", " + plural(s.items, "artículo", "artículos") + ", " + plural(s.units, "unidad", "unidades")
      : ", vacía";
    cnt.classList.toggle("has-items", s.items > 0);
    if (changed) pulse(cnt, "is-bump");
  }

  // Barra flotante para móvil: solo cuando hay productos y el panel está cerrado.
  function updateFloat(q) {
    var s = summarize(list);
    var bar = $("float-bar");
    var open = $("seleccion").classList.contains("is-open");
    bar.hidden = !(s.items > 0) || open;
    $("float-count").textContent = String(s.units);
    $("float-total").textContent = q && q.subtotalCents !== null ? money(q.subtotalCents) : "";
    bar.setAttribute("aria-label", "Ver mi selección: " + plural(s.units, "unidad", "unidades") +
      (q && q.subtotalCents !== null ? ", " + money(q.subtotalCents) : ""));
  }

  // ── Panel lateral: abrir, cerrar y manejar el foco ──
  var drawer = $("seleccion");
  var scrim = $("scrim");
  var page = $("page");
  function openDrawer(opener) {
    if (drawer.classList.contains("is-open")) return;
    drawerOpener = opener || $("header-selection");
    hideToast();
    scrim.hidden = false;
    drawer.inert = false;
    page.inert = true;
    $("skip-link").inert = true;
    document.body.classList.add("no-scroll");
    // Un fotograma de espera para que la transición de entrada se vea.
    requestAnimationFrame(function () {
      scrim.classList.add("is-on");
      drawer.classList.add("is-open");
      $("header-selection").setAttribute("aria-expanded", "true");
      updateFloat(lastQuote);
      $("drawer-close").focus();
    });
  }
  function closeDrawer() {
    if (!drawer.classList.contains("is-open")) return;
    drawer.classList.remove("is-open");
    scrim.classList.remove("is-on");
    $("header-selection").setAttribute("aria-expanded", "false");
    page.inert = false;
    $("skip-link").inert = false;
    drawer.inert = true;
    document.body.classList.remove("no-scroll");
    setTimeout(function () { if (!scrim.classList.contains("is-on")) scrim.hidden = true; }, reduceMotion ? 0 : 280);
    updateFloat(lastQuote);
    var o = drawerOpener;
    drawerOpener = null;
    if (o && document.contains(o) && !o.hidden) o.focus(); else $("header-selection").focus();
  }
  $("header-selection").addEventListener("click", function (e) { openDrawer(e.currentTarget); });
  $("float-bar").addEventListener("click", function (e) { openDrawer(e.currentTarget); });
  $("drawer-close").addEventListener("click", closeDrawer);
  scrim.addEventListener("click", closeDrawer);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && drawer.classList.contains("is-open") && !dlg.open && !comboDlg.open) closeDrawer();
  });
  $("btn-go-catalog").addEventListener("click", function () {
    closeDrawer();
    $("productos").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
  });

  // ── Menú móvil ──
  var menuBtn = $("menu-btn");
  var nav = $("main-nav");
  function setMenu(open) {
    nav.classList.toggle("is-open", open);
    menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    menuBtn.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
  }
  menuBtn.addEventListener("click", function () { setMenu(!nav.classList.contains("is-open")); });
  nav.addEventListener("click", function (e) { if (e.target.closest("a")) setMenu(false); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && nav.classList.contains("is-open")) { setMenu(false); menuBtn.focus(); }
  });

  // ── Vaciar con confirmación en línea ──
  $("btn-clear").addEventListener("click", function () {
    $("clear-row").hidden = true;
    $("clear-confirm").hidden = false;
    $("btn-clear-no").focus();
  });
  $("btn-clear-no").addEventListener("click", function () {
    $("clear-confirm").hidden = true;
    $("clear-row").hidden = false;
    $("btn-clear").focus();
  });
  $("btn-clear-yes").addEventListener("click", function () {
    list = [];
    saveList(); renderList();
    $("seleccion").focus();
  });

  // ── Diálogo de solicitud ──
  var dlg = $("request-dialog");
  function currentMessage() {
    var q = currentQuote();
    var lines = list.map(function (i) { var p = byId[i.id]; return { name: p.name, color: colorName(p), qty: i.qty }; });
    return buildQuoteMessage(q, lines, money, String(CFG.businessName || "CIRCUITO").toUpperCase());
  }
  function openDialog(opener) {
    if (!list.length) return;
    dialogOpener = opener;
    $("dlg-text").value = currentMessage();
    var note = waNote();
    $("dlg-note").textContent = note;
    $("dlg-feedback").textContent = "";
    $("btn-whatsapp").disabled = !wa.valid;
    if (typeof dlg.showModal === "function") dlg.showModal();
    else dlg.setAttribute("open", "");
    $("btn-copy").focus();
  }
  function closeDialog() {
    if (typeof dlg.close === "function") dlg.close(); else dlg.removeAttribute("open");
  }
  dlg.addEventListener("close", function () {
    if (dialogOpener && document.contains(dialogOpener)) dialogOpener.focus();
    dialogOpener = null;
  });
  // Cierra al pulsar el fondo solo si el clic empezó y terminó allí (no al soltar una selección de texto).
  var downOnBackdrop = false;
  dlg.addEventListener("mousedown", function (e) { downOnBackdrop = e.target === dlg; });
  dlg.addEventListener("click", function (e) { if (e.target === dlg && downOnBackdrop) closeDialog(); });
  $("dlg-close").addEventListener("click", closeDialog);
  $("dlg-close-x").addEventListener("click", closeDialog);
  $("btn-review").addEventListener("click", function (e) { openDialog(e.currentTarget); });

  $("btn-whatsapp").addEventListener("click", function () {
    if (!wa.valid || !list.length) return;
    // Con "noopener" window.open siempre devuelve null: no sirve para saber si se abrió.
    window.open(buildWhatsAppUrl(wa.number, $("dlg-text").value), "_blank", "noopener");
    $("dlg-feedback").textContent = "Abriendo WhatsApp con tu mensaje. Si no se abre, permite ventanas emergentes o copia la solicitud.";
  });

  $("btn-copy").addEventListener("click", function () {
    var ta = $("dlg-text");
    function ok() { $("dlg-feedback").textContent = "Solicitud copiada. Puedes pegarla en WhatsApp."; }
    function fail() {
      ta.focus(); ta.select();
      $("dlg-feedback").textContent = "No se pudo copiar automáticamente. El texto quedó seleccionado: cópialo con Ctrl+C (o mantén presionado en el teléfono).";
    }
    function legacy() {
      try { ta.focus(); ta.select(); if (document.execCommand("copy")) ok(); else fail(); } catch (e) { fail(); }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(ok, legacy);
    else legacy();
  });

  // ── Mayoreo: conversación distinta al pedido normal ──
  $("ws-note").textContent = waNote(true);
  $("btn-wholesale").disabled = !wa.valid;
  $("btn-wholesale").addEventListener("click", function () {
    if (!wa.valid) return;
    window.open(buildWhatsAppUrl(wa.number, CFG.wholesaleMessage || ""), "_blank", "noopener");
    $("ws-note").textContent = "Abriendo WhatsApp con tu consulta. Si no se abre, permite ventanas emergentes e inténtalo de nuevo.";
  });

  // ── Entrada discreta de elementos al hacer scroll ──
  function setupReveal() {
    var nodes = document.querySelectorAll(".reveal, .section-head, .step-card, .banner, .ws-card");
    if (reduceMotion || !("IntersectionObserver" in window)) {
      Array.prototype.forEach.call(nodes, function (n) { n.classList.add("in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    Array.prototype.forEach.call(nodes, function (n, i) {
      n.style.setProperty("--d", (i % 6) * 60 + "ms");
      io.observe(n);
    });
  }

  // Partículas decorativas del hero (solo CSS animado; los spans se crean aquí para no ensuciar el HTML).
  function initParticles() {
    var box = $("hero-particles");
    if (!box || reduceMotion) return;
    var n = window.innerWidth < 640 ? 14 : 26;
    for (var i = 0; i < n; i++) {
      var s = el("span", "particle" + (i % 7 === 0 ? " is-red" : ""));
      var size = 4 + Math.random() * 10;
      s.style.width = s.style.height = size.toFixed(1) + "px";
      s.style.left = (Math.random() * 100).toFixed(1) + "%";
      s.style.animationDuration = (10 + Math.random() * 12).toFixed(1) + "s";
      s.style.animationDelay = "-" + (Math.random() * 20).toFixed(1) + "s";
      s.style.setProperty("--drift", (Math.random() * 80 - 40).toFixed(0) + "px");
      box.appendChild(s);
    }
  }

  // ── Inicio ──
  initParticles();
  applyConfig();
  renderHero();
  renderCatalog();
  renderSide();
  renderCombos();
  renderList();
  setupReveal();
})();
