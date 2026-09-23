// =====================================================================
//  Lógica del panel · consume los microservicios vía window.urlDe(ms)
//  Formato de respuesta (Contrato Cero):
//    Listado -> { total, page, limit, items: [...] }
//    Error   -> { error, detalle? }
// =====================================================================

document.getElementById("api-actual").textContent = window.APP_CONFIG.API_BASE;

// ===== AUTENTICACIÓN (demo / administrador / Gmail) =====
const SESION_KEY = "transporte_sesion";
let sesion = null;

function entrar(nombre, rol) {
  sesion = { nombre, rol };
  try { localStorage.setItem(SESION_KEY, JSON.stringify(sesion)); } catch (e) {}
  aplicarSesion();
}
function salir() {
  sesion = null;
  try { localStorage.removeItem(SESION_KEY); } catch (e) {}
  document.body.classList.add("bloqueado");
}
function aplicarSesion() {
  document.body.classList.remove("bloqueado");
  document.getElementById("uname").textContent = sesion.nombre;
  document.getElementById("urole").textContent = sesion.rol;
  // Restricción por rol: la pestaña Analítica es solo para Administrador
  const esAdmin = sesion.rol === "Administrador";
  document.querySelectorAll('.tab[data-admin="1"]').forEach((t) => { t.hidden = !esAdmin; });
  cargarUsuarios();
}
function restaurar() {
  try {
    const s = JSON.parse(localStorage.getItem(SESION_KEY) || "null");
    if (s && s.nombre) { sesion = s; aplicarSesion(); }
  } catch (e) {}
}
function iniciarGoogle() {
  const cid = window.APP_CONFIG.GOOGLE_CLIENT_ID;
  if (!cid) { document.getElementById("google-nota").hidden = false; return; }
  const arranque = () => {
    if (!(window.google && google.accounts && google.accounts.id)) { setTimeout(arranque, 300); return; }
    google.accounts.id.initialize({ client_id: cid, callback: onGoogle });
    google.accounts.id.renderButton(document.getElementById("google-btn"),
      { theme: "filled_blue", size: "large", text: "continue_with", width: 300 });
  };
  arranque();
}
function onGoogle(resp) {
  // Decodifica el payload del JWT de Google para el nombre/email (demo, sin verificar firma).
  try {
    const p = JSON.parse(atob(resp.credential.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    entrar(p.name || p.email || "Usuario Gmail", "Gmail");
  } catch (e) { entrar("Usuario Gmail", "Gmail"); }
}
document.getElementById("btn-demo").addEventListener("click", () => entrar("Invitado", "Demo"));
document.getElementById("btn-admin").addEventListener("click", () => entrar("Administrador", "Administrador"));
document.getElementById("btn-logout").addEventListener("click", salir);

// --- Cuentas con correo/contraseña (crear cuenta + iniciar sesión) ---
// Demo: se guardan en localStorage del navegador (no hay backend de auth).
const USERS_KEY = "transporte_usuarios";
function getUsuarios() { try { return JSON.parse(localStorage.getItem(USERS_KEY) || "[]"); } catch (e) { return []; } }
function setUsuarios(u) { try { localStorage.setItem(USERS_KEY, JSON.stringify(u)); } catch (e) {} }
function errorLogin(msg) { const e = document.getElementById("login-error"); e.textContent = msg; e.hidden = false; }

// Toggle entre "Iniciar sesión" y "Crear cuenta"
let modoAuth = "login";
const authToggle = document.getElementById("auth-toggle");
const inNombre = document.getElementById("in-nombre");
const btnAuth = document.getElementById("btn-auth");

authToggle.addEventListener("click", (e) => {
  const t = e.target.closest(".auth-tab"); if (!t) return;
  modoAuth = t.dataset.modo;
  authToggle.querySelectorAll(".auth-tab").forEach((x) => x.classList.toggle("activa", x === t));
  inNombre.hidden = modoAuth !== "registro";
  btnAuth.textContent = modoAuth === "registro" ? "Crear cuenta" : "Iniciar sesión";
  document.getElementById("login-error").hidden = true;
});

btnAuth.addEventListener("click", () => {
  const email = document.getElementById("in-email").value.trim().toLowerCase();
  const pass = document.getElementById("in-pass").value;
  if (!email || !pass) return errorLogin("Completa correo y contraseña.");

  if (modoAuth === "registro") {
    if (pass.length < 4) return errorLogin("La contraseña debe tener al menos 4 caracteres.");
    const us = getUsuarios();
    if (us.find((x) => x.email === email)) return errorLogin("Ese correo ya tiene cuenta. Inicia sesión.");
    const nombre = inNombre.value.trim() || email.split("@")[0];
    us.push({ email, pass, nombre });
    setUsuarios(us);
    entrar(nombre, "Usuario");        // crea la cuenta e inicia sesión
  } else {
    const u = getUsuarios().find((x) => x.email === email && x.pass === pass);
    if (!u) return errorLogin("Correo o contraseña incorrectos (o la cuenta no existe).");
    entrar(u.nombre, "Usuario");
  }
});

// --- helper de fetch tolerante a fallos ------------------------------
async function pedir(url) {
  try {
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    const data = await r.json().catch(() => null);
    if (!r.ok) {
      const msg = (data && data.error) ? data.error : `HTTP ${r.status}`;
      throw new Error(msg);
    }
    return data;
  } catch (e) {
    mostrarAviso(`No se pudo cargar ${url} — ${e.message}. ¿Está el microservicio arriba y la API_BASE correcta?`);
    return null;
  }
}
function mostrarAviso(txt) {
  const a = document.getElementById("aviso");
  a.textContent = "⚠ " + txt; a.hidden = false;
}
function limpiarAviso() { document.getElementById("aviso").hidden = true; }
function fmtFecha(iso) { return iso ? String(iso).replace("T", " ").replace("Z", "") : "—"; }
function estrellas(n) { return "★".repeat(n) + "☆".repeat(5 - n); }

const carril = document.getElementById("carril");
const CARRIL_VACIO = carril.innerHTML;

// --- navegación por pestañas -----------------------------------------
const tabs = document.getElementById("tabs");
tabs.addEventListener("click", (e) => {
  const btn = e.target.closest(".tab"); if (!btn) return;
  document.querySelectorAll(".tab").forEach((t) => t.classList.remove("activa"));
  document.querySelectorAll(".panel").forEach((p) => p.classList.remove("activa"));
  btn.classList.add("activa");
  document.getElementById("tab-" + btn.dataset.tab).classList.add("activa");
  document.getElementById("titulo").textContent = btn.dataset.titulo || btn.textContent.trim();
  document.body.dataset.vista = btn.dataset.tab;
  carril.innerHTML = CARRIL_VACIO;
  limpiarAviso();
  cargar(btn.dataset.tab);
});

// Cambia de sección como si se hiciera clic en el menú.
function irA(tab) {
  const btn = document.querySelector(`.tab[data-tab="${tab}"]`);
  if (btn && !btn.hidden) btn.click();
  window.scrollTo({ top: 0 });
}

// --- red en vivo: health de los 5 microservicios (sidebar) --------------
async function pingRed() {
  await Promise.all([...document.querySelectorAll("#red-vivo li")].map(async (li) => {
    const t0 = performance.now();
    let ok = false;
    try { ok = (await fetch(`${urlDe(li.dataset.ms)}/health`, { cache: "no-store" })).ok; } catch (e) {}
    li.classList.toggle("ok", ok);
    li.classList.toggle("caido", !ok);
    li.querySelector(".lat").textContent = ok ? `${Math.round(performance.now() - t0)} ms` : "caído";
  }));
}
function reloj() {
  document.getElementById("reloj").textContent =
    new Date().toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
}

// --- carril de detalle (320px): toda fila tiene destino ------------------

const esc = (x) => String(x ?? "—").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function mostrarCarril(html) {
  carril.innerHTML = `<div class="ficha">${html}</div>`;
  if (window.matchMedia("(max-width:1180px)").matches) carril.scrollIntoView({ behavior: "smooth" });
}
function seleccionarFila(tr) {
  tr.closest("tbody").querySelectorAll("tr.seleccionada").forEach((x) => x.classList.remove("seleccionada"));
  tr.classList.add("seleccionada");
}
// Botones "→ siguiente paso" dentro de la ficha
function destinos(lista) {
  return `<div class="destinos">${lista.map(([txt, fn], i) => `<button data-i="${i}">${txt}</button>`).join("")}</div>`;
}
function conectarDestinos(lista) {
  carril.querySelectorAll(".destinos button").forEach((b) => b.addEventListener("click", lista[b.dataset.i][1]));
}
function abrirPerfilUsuario(id) {
  irA("perfil"); document.getElementById("perfil-usuario-id").value = id; cargarPerfilUsuario();
}
function abrirHojaVida(id) {
  irA("perfil"); document.getElementById("perfil-conductor-id").value = id; cargarHojaVida();
}
function abrirEvaluacion(id) {
  irA("reglas"); document.getElementById("regla-conductor-id").value = id; evaluarConductor();
}
function abrirReputacion(id) {
  irA("conductor"); document.getElementById("conductor-id").value = id; cargarResumenConductor();
}
function abrirCalificacionesDe(id) {
  irA("calificaciones");
  const f = document.getElementById("filtros-calificaciones");
  f.reset(); f.conductor_id.value = id; f.requestSubmit();
}

// --- buscador global: 695 (usuario) · C101 (conductor) · V2044 (viaje) ----
document.getElementById("busqueda-global").addEventListener("submit", (e) => {
  e.preventDefault();
  const q = document.getElementById("busqueda-input").value.trim().toUpperCase().replace(/[\s#-]/g, "");
  const m = q.match(/^([CV]?)(\d+)$/);
  if (!m) { mostrarAviso("Busca por ID: 695 (usuario), C101 (conductor) o V2044 (viaje)."); return; }
  limpiarAviso();
  if (m[1] === "C") abrirEvaluacion(m[2]);
  else if (m[1] === "V") { irA("viajes"); verViaje(m[2]); }
  else { irA("usuarios"); verUsuario(m[2]); }
});

// --- estado de paginación por pestaña --------------------------------
const estado = { usuarios: 1, viajes: 1, calificaciones: 1 };
const LIMIT = 15;

function pintarPaginacion(cont, ms, tab, data) {
  const totalPag = Math.max(1, Math.ceil(data.total / data.limit));
  cont.innerHTML =
    `<button ${data.page <= 1 ? "disabled" : ""} data-d="-1">‹ Anterior</button>` +
    `<span>Página ${data.page} de ${totalPag} · ${data.total.toLocaleString()} registros</span>` +
    `<button ${data.page >= totalPag ? "disabled" : ""} data-d="1">Siguiente ›</button>`;
  cont.querySelectorAll("button").forEach((b) =>
    b.addEventListener("click", () => { estado[tab] += Number(b.dataset.d); cargar(tab); }));
}

// --- filtros de búsqueda (MS2 viajes / MS3 calificaciones) ------------
const filtros = { viajes: "", calificaciones: "" };
function conectarFiltros(tab) {
  const form = document.getElementById("filtros-" + tab);
  const aplicar = () => {
    const q = new URLSearchParams();
    new FormData(form).forEach((v, k) => { if (String(v).trim()) q.set(k, String(v).trim()); });
    filtros[tab] = q.toString() ? "&" + q : "";
    estado[tab] = 1;
    cargar(tab);
  };
  form.addEventListener("submit", (e) => { e.preventDefault(); aplicar(); });
  form.addEventListener("reset", () => setTimeout(aplicar, 0));
}
conectarFiltros("viajes");
conectarFiltros("calificaciones");
function sinResultados(tb, cols) {
  tb.innerHTML = `<tr><td colspan="${cols}" class="cargando">Sin resultados para esos filtros.</td></tr>`;
}

// --- cargadores por pestaña ------------------------------------------
async function cargar(tab) {
  if (tab === "usuarios") return cargarUsuarios();
  if (tab === "viajes") return cargarViajes();
  if (tab === "calificaciones") return cargarCalificaciones();
  if (tab === "conductor") return; // se dispara con el botón
  if (tab === "reglas") return;    // se dispara con los botones
  if (tab === "analitica") return cargarAnalitica();
}

// MS1 · GET /ms1/usuarios  (+ GET /ms1/usuarios/{id} al hacer clic)
async function cargarUsuarios() {
  const tb = document.querySelector("#tabla-usuarios tbody");
  tb.innerHTML = `<tr><td colspan="5" class="cargando">Cargando…</td></tr>`;
  const d = await pedir(`${urlDe("ms1")}/usuarios?page=${estado.usuarios}&limit=${LIMIT}`);
  if (!d) { tb.innerHTML = ""; return; }
  tb.innerHTML = d.items.map((u) => `<tr class="fila-link" data-id="${u.id}">
    <td class="mono">${u.id}</td>
    <td>${esc(u.nombre)} ${esc(u.apellido)}</td>
    <td>${esc(u.distrito)}</td>
    <td class="mono">${fmtFecha(u.fecha_registro).slice(0, 10)}</td>
  </tr>`).join("");
  tb.querySelectorAll("tr.fila-link").forEach((tr) =>
    tr.addEventListener("click", () => { seleccionarFila(tr); verUsuario(tr.dataset.id); }));
  pintarPaginacion(document.getElementById("pag-usuarios"), "ms1", "usuarios", d);
}
async function verUsuario(id) {
  mostrarCarril(`<p class="cargando">Cargando usuario ${esc(id)}…</p>`);
  const [u, v] = await Promise.all([
    pedir(`${urlDe("ms1")}/usuarios/${id}`),
    pedir(`${urlDe("ms1")}/usuarios/${id}/validacion`),
  ]);
  if (!u) { carril.innerHTML = ""; return; }
  const lista = [
    ["Perfil completo (MS4)", () => abrirPerfilUsuario(u.id)],
    ["Sus viajes (MS2)", () => { irA("viajes"); const f = document.getElementById("filtros-viajes"); f.reset(); f.pasajeroId.value = u.id; f.requestSubmit(); }],
  ];
  mostrarCarril(`
    <p class="ficha-eyebrow">Usuario <span class="id">#${u.id}</span></p>
    <h2>${esc(u.nombre)} ${esc(u.apellido)}</h2>
    <p class="sub">${esc(u.distrito)}</p>
    <dl>
      <dt>Email</dt><dd>${esc(u.email)}</dd>
      <dt>Teléfono</dt><dd class="mono">${esc(u.telefono)}</dd>
      <dt>Nacimiento</dt><dd class="mono">${esc(u.fecha_nacimiento)}</dd>
      <dt>Estado</dt><dd>${u.activo ? "activo" : '<span class="badge bad">suspendido</span>'}</dd>
      ${v ? `<dt>¿Puede viajar?</dt><dd>${siNo(v.puede_solicitar_viaje)}</dd>` : ""}
    </dl>
    ${v ? listaMotivos(v.motivos) : ""}
    ${destinos(lista)}`);
  conectarDestinos(lista);
}

// MS2 · GET /ms2/viajes  (+ GET /ms2/viajes/{id})
async function cargarViajes() {
  const tb = document.querySelector("#tabla-viajes tbody");
  tb.innerHTML = `<tr><td colspan="5" class="cargando">Cargando…</td></tr>`;
  const d = await pedir(`${urlDe("ms2")}/viajes?page=${estado.viajes}&limit=${LIMIT}${filtros.viajes}`);
  if (!d) { tb.innerHTML = ""; return; }
  if (!d.items.length) sinResultados(tb, 5); else
  tb.innerHTML = d.items.map((v) => `<tr class="fila-link est-${v.estado}" data-id="${v.id}">
    <td class="mono">V${v.id}</td>
    <td>${esc(v.distrito_origen)} → ${esc(v.distrito_destino)}</td>
    <td>${badgeEstado(v.estado)}</td>
    <td class="mono num">${v.monto_total != null ? "S/ " + Number(v.monto_total).toFixed(2) : "—"}</td>
    <td>${esc(v.metodo_pago)}</td>
  </tr>`).join("");
  tb.querySelectorAll("tr.fila-link").forEach((tr) =>
    tr.addEventListener("click", () => { seleccionarFila(tr); verViaje(tr.dataset.id); }));
  pintarPaginacion(document.getElementById("pag-viajes"), "ms2", "viajes", d);
}
function badgeEstado(estado) {
  if (estado === "en_curso") return `<span class="badge vivo">en ruta</span>`;
  if (estado === "cancelado") return `<span class="badge bad">cancelado</span>`;
  return `<span class="badge">${esc(estado)}</span>`;
}
async function verViaje(id) {
  mostrarCarril(`<p class="cargando">Cargando viaje ${esc(id)}…</p>`);
  const v = await pedir(`${urlDe("ms2")}/viajes/${id}`);
  if (!v) { carril.innerHTML = ""; return; }
  const lista = [
    [`Conductor #${v.conductor_id}: ¿puede operar?`, () => abrirEvaluacion(v.conductor_id)],
    [`Calificaciones del conductor`, () => abrirCalificacionesDe(v.conductor_id)],
    [`Pasajero #${v.pasajero_id}`, () => { irA("usuarios"); verUsuario(v.pasajero_id); }],
    ["Detalle completo (MS4)", async () => {
      const d = await pedir(`${urlDe("ms4")}/viajes/${v.id}/detalle-completo`);
      if (d) mostrarCarril(`<p class="ficha-eyebrow">Viaje <span class="id">V${v.id}</span> · MS4</p>
        <h2>Detalle completo</h2><p class="sub">MS4 unió MS2 + MS1 + MS3</p>
        <dl><dt>Pasajero</dt><dd>${esc(d.pasajero?.nombre)} ${esc(d.pasajero?.apellido)}</dd>
        <dt>Conductor</dt><dd>${esc(d.conductor?.nombre)} ${esc(d.conductor?.apellido)}</dd>
        <dt>Calificación</dt><dd>${d.calificacion ? estrellasHTML(d.calificacion.rating) : "sin calificar"}</dd></dl>
        ${d.calificacion?.comentario ? `<blockquote>${esc(d.calificacion.comentario)}</blockquote>` : ""}${avisosHTML(d.advertencias)}`);
    }],
  ];
  mostrarCarril(`
    <p class="ficha-eyebrow">Viaje <span class="id">V${v.id}</span></p>
    <h2>${badgeEstado(v.estado)}</h2>
    <div class="ruta" style="margin-top:12px"><span>Origen</span><b>${esc(v.distrito_origen)}</b>
      <span>Destino</span><b>${esc(v.distrito_destino)}</b></div>
    <dl>
      <dt>Servicio</dt><dd>${esc(v.tipo_servicio)}</dd>
      <dt>Distancia</dt><dd class="mono">${esc(v.distancia_km)} km</dd>
      <dt>Duración</dt><dd class="mono">${esc(v.duracion_min)} min</dd>
      <dt>Monto</dt><dd class="mono">${v.monto_total != null ? "S/ " + Number(v.monto_total).toFixed(2) : "—"}</dd>
      <dt>Pago</dt><dd>${esc(v.metodo_pago)}</dd>
      <dt>Solicitado</dt><dd class="mono">${fmtFecha(v.solicitado_en).slice(0, 16)}</dd>
    </dl>
    ${destinos(lista)}`);
  conectarDestinos(lista);
}

// MS3 · GET /ms3/calificaciones  (+ GET /ms3/calificaciones/{id})
async function cargarCalificaciones() {
  const tb = document.querySelector("#tabla-calificaciones tbody");
  tb.innerHTML = `<tr><td colspan="5" class="cargando">Cargando…</td></tr>`;
  const d = await pedir(`${urlDe("ms3")}/calificaciones?page=${estado.calificaciones}&limit=${LIMIT}${filtros.calificaciones}`);
  if (!d) { tb.innerHTML = ""; return; }
  if (!d.items.length) sinResultados(tb, 5); else
  tb.innerHTML = d.items.map((c, i) => `<tr class="fila-link ${c.rating < 3 ? "rating-bajo" : ""}" data-i="${i}">
    <td class="mono">V${c.viaje_id}</td>
    <td>${estrellasHTML(c.rating)}</td>
    <td>${esc((c.comentario || "—").slice(0, 60))}</td>
    <td>${(c.tags || []).map((t) => `<span class="badge">${esc(t)}</span>`).join(" ")}</td>
    <td class="mono">${fmtFecha(c.creado_en).slice(0, 10)}</td>
  </tr>`).join("");
  tb.querySelectorAll("tr.fila-link").forEach((tr) =>
    tr.addEventListener("click", () => { seleccionarFila(tr); verCalificacion(d.items[tr.dataset.i]); }));
  pintarPaginacion(document.getElementById("pag-calificaciones"), "ms3", "calificaciones", d);
}

function estrellasHTML(n) {
  return `<span class="rating ${n < 3 ? "bajo" : ""}" title="${n} de 5">${estrellas(n)}</span>`;
}
function verCalificacion(c) {
  const lista = [
    [`Viaje V${c.viaje_id}`, () => { irA("viajes"); verViaje(c.viaje_id); }],
    [`Reputación del conductor #${c.conductor_id}`, () => abrirReputacion(c.conductor_id)],
    [`Pasajero #${c.pasajero_id}`, () => { irA("usuarios"); verUsuario(c.pasajero_id); }],
  ];
  mostrarCarril(`
    <p class="ficha-eyebrow">Calificación · viaje <span class="id">V${c.viaje_id}</span></p>
    <h2>${estrellasHTML(c.rating)}</h2>
    <p class="sub">${c.anonimo ? "Anónima" : `Pasajero #${c.pasajero_id}`} · ${fmtFecha(c.creado_en).slice(0, 10)}</p>
    <blockquote>${esc(c.comentario || "Sin comentario")}</blockquote>
    <p>${(c.tags || []).map((t) => `<span class="badge">${esc(t)}</span>`).join(" ")}</p>
    <dl><dt>Moderación</dt><dd>${esc(c.moderacion?.estado)} · ${c.moderacion?.reportes ?? 0} reportes</dd></dl>
    ${destinos(lista)}`);
  conectarDestinos(lista);
}

// MS3 · GET /ms3/conductores/{id}/resumen
document.getElementById("btn-conductor").addEventListener("click", cargarResumenConductor);
async function cargarResumenConductor() {
  const id = document.getElementById("conductor-id").value || 101;
  const cont = document.getElementById("resumen-conductor");
  cont.innerHTML = `<div class="cargando">Cargando…</div>`;
  const r = await pedir(`${urlDe("ms3")}/conductores/${id}/resumen`);
  if (!r) { cont.innerHTML = ""; return; }
  const items = [
    ["Conductor", r.conductor_id ?? id],
    ["Calificaciones", (r.total ?? r.total_calificaciones ?? 0).toLocaleString()],
    ["Rating promedio", (r.rating_promedio ?? r.promedio ?? 0)],
    ["Reportes", r.reportes ?? 0],
  ];
  cont.innerHTML = items.map(([k, v]) =>
    `<div class="card"><div class="k">${k}</div><div class="v">${v}</div></div>`).join("");
}

// MS1 · reglas de negocio (MS1 consulta el rating real en MS3)
const PCT = (x) => `${Math.round(x * 100)}%`;
const siNo = (ok) => `<span class="badge ${ok ? "ok" : "bad"}">${ok ? "SÍ" : "NO"}</span>`;
const badges = (xs) => (xs || []).map((s) => `<span class="badge">${s}</span>`).join(" ") || "—";
const listaMotivos = (xs) => (xs && xs.length) ? `<ul class="motivos">${xs.map((m) => `<li>${m}</li>`).join("")}</ul>` : "";

document.getElementById("btn-evaluar").addEventListener("click", evaluarConductor);
async function evaluarConductor() {
  const id = document.getElementById("regla-conductor-id").value || 101;
  const cont = document.getElementById("regla-conductor");
  cont.innerHTML = `<div class="cargando">Evaluando… (MS1 consulta el rating en MS3)</div>`;
  const [e, c] = await Promise.all([
    pedir(`${urlDe("ms1")}/conductores/${id}/elegibilidad`),
    pedir(`${urlDe("ms1")}/conductores/${id}/categoria`),
  ]);
  if (!e || !c) { cont.innerHTML = ""; return; }
  const problemas = (e.vehiculos || []).flatMap((v) => v.problemas.map((p) => `${v.placa}: ${p}`));
  cont.innerHTML = `
    <div class="tarjetas">
      <div class="card"><div class="k">¿Puede operar?</div><div class="v">${siNo(e.elegible)}</div></div>
      <div class="card"><div class="k">Nivel</div><div class="v" style="text-transform:capitalize">${c.nivel}</div><div class="k">${c.antiguedad_anios} años en la plataforma</div></div>
      <div class="card"><div class="k">Comisión plataforma</div><div class="v">${PCT(c.comision_plataforma)}</div></div>
      <div class="card"><div class="k">Rating · desde MS3</div><div class="v">${e.rating_promedio ?? "—"}</div><div class="k">${e.total_resenas} reseñas</div></div>
    </div>
    <p style="margin-top:12px;font-size:13px">Servicios habilitados: ${badges(e.servicios_habilitados)}</p>
    ${listaMotivos([...e.motivos, ...problemas])}${avisosHTML(e.advertencias)}`;
}

document.getElementById("btn-disponibles").addEventListener("click", buscarDisponibles);
async function buscarDisponibles() {
  const q = new URLSearchParams({ limit: 10 });
  const dist = document.getElementById("regla-distrito").value;
  const serv = document.getElementById("regla-servicio").value;
  if (dist) q.set("distrito_base", dist);
  if (serv) q.set("tipo_servicio", serv);
  const cont = document.getElementById("regla-disponibles");
  cont.innerHTML = `<div class="cargando">Buscando y rankeando…</div>`;
  const d = await pedir(`${urlDe("ms1")}/conductores/disponibles?${q}`);
  if (!d) { cont.innerHTML = ""; return; }
  if (!d.items.length) { cont.innerHTML = `<div class="cargando">Ningún conductor disponible con esos filtros (${d.evaluados} evaluados).</div>`; return; }
  cont.innerHTML = `<div class="tablewrap"><table><thead><tr>
      <th>#</th><th>Conductor</th><th>Distrito</th><th>Rating</th><th>Servicios</th><th>Puntaje</th>
    </tr></thead><tbody>${d.items.map((x, i) => `<tr>
      <td class="mono">${i + 1}</td><td>${esc(x.nombre)} <span class="id" style="color:var(--faint)">C${x.conductor_id}</span></td>
      <td>${esc(x.distrito_base)}</td><td class="mono">${x.rating_promedio ?? "—"}</td>
      <td>${badges(x.servicios_habilitados)}</td><td class="mono"><b>${x.puntaje}</b></td>
    </tr>`).join("")}</tbody></table></div>
    <p style="color:var(--muted);font-size:13px;margin-top:8px">${d.total} aptos de ${d.evaluados} evaluados · puntaje = 80% rating + 20% antigüedad</p>
    ${avisosHTML(d.advertencias)}`;
}

document.getElementById("btn-validar-usuario").addEventListener("click", validarUsuario);
async function validarUsuario() {
  const id = document.getElementById("regla-usuario-id").value || 2;
  const cont = document.getElementById("regla-usuario");
  cont.innerHTML = `<div class="cargando">Validando…</div>`;
  const v = await pedir(`${urlDe("ms1")}/usuarios/${id}/validacion`);
  if (!v) { cont.innerHTML = ""; return; }
  cont.innerHTML = `
    <div class="tarjetas">
      <div class="card"><div class="k">¿Puede solicitar viaje?</div><div class="v">${siNo(v.puede_solicitar_viaje)}</div></div>
      <div class="card"><div class="k">Edad</div><div class="v">${v.edad ?? "—"}</div></div>
    </div>${listaMotivos(v.motivos)}`;
}

// MS4 · orquestador (perfil = MS1 + MS2 + MS3, sin BD propia)
function avisosHTML(av) {
  return (av && av.length) ? `<div class="aviso" style="display:block;margin-top:14px">⚠ ${av.join(" · ")}</div>` : "";
}
document.getElementById("btn-perfil-usuario").addEventListener("click", cargarPerfilUsuario);
document.getElementById("btn-perfil-conductor").addEventListener("click", cargarHojaVida);

async function cargarPerfilUsuario() {
  const id = document.getElementById("perfil-usuario-id").value || 695;
  const cont = document.getElementById("perfil-resultado");
  cont.innerHTML = `<div class="cargando">Cargando… (MS4 consulta MS1 + MS2 + MS3)</div>`;
  const d = await pedir(`${urlDe("ms4")}/usuarios/${id}/perfil`);
  if (!d) { cont.innerHTML = ""; return; }
  const u = d.usuario || {};
  cont.innerHTML = `
    <div class="tarjetas">
      <div class="card"><div class="k">Usuario · MS1</div><div class="v" style="font-size:17px">${(u.nombre ?? "—") + " " + (u.apellido ?? "")}</div><div class="k">${u.distrito ?? ""}</div></div>
      <div class="card"><div class="k">Últimos viajes · MS2</div><div class="v">${(d.ultimos_viajes || []).length}</div></div>
      <div class="card"><div class="k">Calificaciones · MS3</div><div class="v">${(d.calificaciones || []).length}</div></div>
    </div>${avisosHTML(d.advertencias)}
    <p style="color:var(--muted);font-size:13px;margin-top:14px">MS4 unió los 3 microservicios en una sola respuesta (no tiene base de datos propia).</p>`;
}

async function cargarHojaVida() {
  const id = document.getElementById("perfil-conductor-id").value || 101;
  const cont = document.getElementById("perfil-resultado");
  cont.innerHTML = `<div class="cargando">Cargando… (MS4 consulta MS1 + MS2 + MS3)</div>`;
  const d = await pedir(`${urlDe("ms4")}/conductores/${id}/hoja-de-vida`);
  if (!d) { cont.innerHTML = ""; return; }
  const c = d.conductor || {};
  const r = d.resumen_calificaciones || {};
  cont.innerHTML = `
    <div class="tarjetas">
      <div class="card"><div class="k">Conductor · MS1</div><div class="v" style="font-size:17px">${(c.nombre ?? "—") + " " + (c.apellido ?? "")}</div><div class="k">${c.distrito_base ?? ""}</div></div>
      <div class="card"><div class="k">Vehículos · MS1</div><div class="v">${(d.vehiculos || []).length}</div></div>
      <div class="card"><div class="k">Viajes · MS2</div><div class="v">${(d.ultimos_viajes || []).length}</div></div>
      <div class="card"><div class="k">Rating · MS3</div><div class="v">${r.rating_promedio ?? r.promedio ?? "—"}</div></div>
    </div>${avisosHTML(d.advertencias)}
    <p style="color:var(--muted);font-size:13px;margin-top:14px">MS4 orquestó MS1 + MS2 + MS3 para armar la hoja de vida.</p>`;
}

// MS5 · 2 métodos: consulta estrella (ingresos) + rating por distrito (Athena)
async function cargarAnalitica() {
  const cont = document.getElementById("analitica-cont");
  cont.innerHTML = `<div class="cargando">Cargando analítica… (Athena puede tardar unos segundos)</div>`;
  const [ingresos, rating, vRating, vIngreso] = await Promise.all([
    pedir(`${urlDe("ms5")}/ingresos/por-hora-distrito`),
    pedir(`${urlDe("ms5")}/conductores/rating-por-distrito`),
    pedir(`${urlDe("ms5")}/vistas/rating-conductor?limit=10`),
    pedir(`${urlDe("ms5")}/vistas/ingreso-hora-distrito?limit=10`),
  ]);
  let html = "";

  if (ingresos && ingresos.items && ingresos.items.length) {
    html += `<div class="lienzo-oscuro">
        <h3>Ingreso promedio por hora del día</h3>
        <span class="metodos">GET /ms5/ingresos/por-hora-distrito · viajes finalizados, todos los distritos</span>
        <div class="grafico"><canvas id="chart-ingresos"></canvas></div>
      </div>`;
  }

  if (rating && rating.items && rating.items.length) {
    html += `<h3 class="bloque-titulo">Rating por distrito del conductor
      <span class="metodos">GET /ms5/conductores/rating-por-distrito</span></h3>
      <div class="tablewrap"><table><thead><tr>
        <th>Distrito</th><th>Conductores</th><th>Calificaciones</th><th>Rating prom.</th>
      </tr></thead><tbody>` + rating.items.map((x) =>
        `<tr><td>${esc(x.distrito_base)}</td><td class="mono">${x.conductores ?? "—"}</td><td class="mono">${x.calificaciones ?? "—"}</td><td class="mono">${x.rating_promedio ?? "—"}</td></tr>`
      ).join("") + `</tbody></table></div>`;
  }

  // Vistas de Athena (v_rating_conductor, v_ingreso_hora_distrito)
  const tablaVista = (titulo, ruta, cols, filas) => `<div><h3 class="bloque-titulo">${titulo}
      <span class="metodos">GET ${ruta}</span></h3>
      <div class="tablewrap"><table><thead><tr>${cols.map(([t]) => `<th>${t}</th>`).join("")}</tr></thead><tbody>` +
      filas.map((x) => `<tr>${cols.map(([, k]) => `<td class="${typeof x[k] === "number" ? "mono" : ""}">${esc(x[k])}</td>`).join("")}</tr>`).join("") +
      `</tbody></table></div></div>`;
  let vistas = "";
  if (vRating && vRating.items && vRating.items.length) {
    vistas += tablaVista("Top 10 conductores · vista v_rating_conductor", "/ms5/vistas/rating-conductor",
      [["Conductor", "conductor_id"], ["Nombre", "nombre"], ["Apellido", "apellido"], ["Calificaciones", "calificaciones"], ["Rating prom.", "rating_promedio"]],
      vRating.items);
  }
  if (vIngreso && vIngreso.items && vIngreso.items.length) {
    vistas += tablaVista("Franjas de mayor ingreso · vista v_ingreso_hora_distrito", "/ms5/vistas/ingreso-hora-distrito",
      [["Distrito", "distrito"], ["Hora", "hora"], ["Viajes", "viajes"], ["Ingreso prom. (S/)", "ingreso_promedio"]],
      vIngreso.items);
  }

  if (vistas) html += `<div class="rejilla-2">${vistas}</div>`;
  cont.innerHTML = html || `<div class="cargando">Sin datos de MS5 (¿está desplegado el analítico?).</div>`;

  // Gráfico real (Chart.js): ingreso promedio por hora, agregado de todos los distritos
  if (ingresos && ingresos.items && ingresos.items.length && window.Chart) {
    const porHora = {};
    ingresos.items.forEach((x) => {
      const h = Number(x.hora);
      (porHora[h] = porHora[h] || []).push(x.ingreso_promedio || 0);
    });
    const horas = Object.keys(porHora).map(Number).sort((a, b) => a - b);
    const valores = horas.map((h) => +(porHora[h].reduce((s, v) => s + v, 0) / porHora[h].length).toFixed(2));
    new Chart(document.getElementById("chart-ingresos"), {
      type: "bar",
      data: {
        labels: horas.map((h) => String(h).padStart(2, "0") + "h"),
        datasets: [{ label: "Ingreso promedio (S/)", data: valores, backgroundColor: "#00A8B5",
                     hoverBackgroundColor: "#C8F542", borderRadius: 3, maxBarThickness: 26 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: "#1C2229", titleFont: { family: "IBM Plex Mono" }, bodyFont: { family: "IBM Plex Sans" },
                     callbacks: { label: (c) => ` S/ ${c.parsed.y.toFixed(2)}` } },
        },
        scales: {
          x: { ticks: { color: "#8A94A0", font: { family: "IBM Plex Mono", size: 11 } }, grid: { display: false } },
          y: { ticks: { color: "#8A94A0", font: { family: "IBM Plex Mono", size: 11 }, callback: (v) => "S/ " + v },
               grid: { color: "rgba(255,255,255,.07)" }, border: { display: false }, beginAtZero: true },
        },
      },
    });
  }
}

// arranque: autenticación (muestra el login o restaura la sesión guardada)
iniciarGoogle();
restaurar();
pingRed(); setInterval(pingRed, 30000);
reloj(); setInterval(reloj, 30000);
