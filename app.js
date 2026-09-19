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

// --- navegación por pestañas -----------------------------------------
const tabs = document.getElementById("tabs");
tabs.addEventListener("click", (e) => {
  const btn = e.target.closest(".tab"); if (!btn) return;
  document.querySelectorAll(".tab").forEach((t) => t.classList.remove("activa"));
  document.querySelectorAll(".panel").forEach((p) => p.classList.remove("activa"));
  btn.classList.add("activa");
  document.getElementById("tab-" + btn.dataset.tab).classList.add("activa");
  limpiarAviso();
  cargar(btn.dataset.tab);
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

// --- cargadores por pestaña ------------------------------------------
async function cargar(tab) {
  if (tab === "usuarios") return cargarUsuarios();
  if (tab === "viajes") return cargarViajes();
  if (tab === "calificaciones") return cargarCalificaciones();
  if (tab === "conductor") return; // se dispara con el botón
  if (tab === "analitica") return cargarAnalitica();
}

// MS1 · GET /ms1/usuarios  (+ GET /ms1/usuarios/{id} al hacer clic)
async function cargarUsuarios() {
  const tb = document.querySelector("#tabla-usuarios tbody");
  tb.innerHTML = `<tr><td colspan="5" class="cargando">Cargando…</td></tr>`;
  const d = await pedir(`${urlDe("ms1")}/usuarios?page=${estado.usuarios}&limit=${LIMIT}`);
  if (!d) { tb.innerHTML = ""; return; }
  tb.innerHTML = d.items.map((u) => `<tr>
    <td>${u.id}</td>
    <td>${u.nombre ?? ""} ${u.apellido ?? ""}</td>
    <td>${u.distrito ?? "—"}</td>
    <td>${fmtFecha(u.fecha_registro)}</td>
    <td><a class="link" data-id="${u.id}">ver detalle →</a></td>
  </tr>`).join("");
  tb.querySelectorAll(".link").forEach((a) =>
    a.addEventListener("click", () => verUsuario(a.dataset.id)));
  pintarPaginacion(document.getElementById("pag-usuarios"), "ms1", "usuarios", d);
}
async function verUsuario(id) {
  const u = await pedir(`${urlDe("ms1")}/usuarios/${id}`);
  if (!u) return;
  alert(`Usuario ${u.id}\n${u.nombre} ${u.apellido}\nEmail: ${u.email}\nDistrito: ${u.distrito}\nTeléfono: ${u.telefono ?? "—"}`);
}

// MS2 · GET /ms2/viajes  (+ GET /ms2/viajes/{id})
async function cargarViajes() {
  const tb = document.querySelector("#tabla-viajes tbody");
  tb.innerHTML = `<tr><td colspan="5" class="cargando">Cargando…</td></tr>`;
  const d = await pedir(`${urlDe("ms2")}/viajes?page=${estado.viajes}&limit=${LIMIT}`);
  if (!d) { tb.innerHTML = ""; return; }
  tb.innerHTML = d.items.map((v) => `<tr>
    <td><a class="link" data-id="${v.id}">${v.id}</a></td>
    <td>${v.distrito_origen} → ${v.distrito_destino}</td>
    <td><span class="badge ${v.estado === "finalizado" ? "ok" : v.estado === "cancelado" ? "bad" : ""}">${v.estado}</span></td>
    <td>${v.monto_total != null ? "S/ " + Number(v.monto_total).toFixed(2) : "—"}</td>
    <td>${v.metodo_pago}</td>
  </tr>`).join("");
  tb.querySelectorAll(".link").forEach((a) =>
    a.addEventListener("click", () => verViaje(a.dataset.id)));
  pintarPaginacion(document.getElementById("pag-viajes"), "ms2", "viajes", d);
}
async function verViaje(id) {
  const v = await pedir(`${urlDe("ms2")}/viajes/${id}`);
  if (!v) return;
  alert(`Viaje ${v.id}\n${v.distrito_origen} → ${v.distrito_destino}\nEstado: ${v.estado}\nDistancia: ${v.distancia_km} km · ${v.duracion_min} min\nMonto: S/ ${Number(v.monto_total).toFixed(2)}`);
}

// MS3 · GET /ms3/calificaciones  (+ GET /ms3/calificaciones/{id})
async function cargarCalificaciones() {
  const tb = document.querySelector("#tabla-calificaciones tbody");
  tb.innerHTML = `<tr><td colspan="5" class="cargando">Cargando…</td></tr>`;
  const d = await pedir(`${urlDe("ms3")}/calificaciones?page=${estado.calificaciones}&limit=${LIMIT}`);
  if (!d) { tb.innerHTML = ""; return; }
  tb.innerHTML = d.items.map((c) => `<tr>
    <td>${c.viaje_id}</td>
    <td><span class="rating">${estrellas(c.rating)}</span></td>
    <td>${(c.comentario || "—").slice(0, 60)}</td>
    <td>${(c.tags || []).map((t) => `<span class="badge">${t}</span>`).join(" ")}</td>
    <td>${fmtFecha(c.creado_en)}</td>
  </tr>`).join("");
  pintarPaginacion(document.getElementById("pag-calificaciones"), "ms3", "calificaciones", d);
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

// MS4 · orquestador (perfil = MS1 + MS2 + MS3, sin BD propia)
function avisosHTML(av) {
  return (av && av.length) ? `<div class="aviso" style="display:block;margin-top:14px">⚠ ${av.join(" · ")}</div>` : "";
}
document.getElementById("btn-perfil-usuario").addEventListener("click", cargarPerfilUsuario);
document.getElementById("btn-perfil-conductor").addEventListener("click", cargarHojaVida);

async function cargarPerfilUsuario() {
  const id = document.getElementById("perfil-usuario-id").value || 5;
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

// MS5 · GET /ms5/ingresos/por-hora-distrito  (consulta estrella)
async function cargarAnalitica() {
  const cont = document.getElementById("analitica-cont");
  cont.innerHTML = `<div class="cargando">Cargando analítica…</div>`;
  const d = await pedir(`${urlDe("ms5")}/ingresos/por-hora-distrito`);
  if (!d || !d.items || !d.items.length) {
    cont.innerHTML = `<div class="cargando">Sin datos de MS5 todavía (falta desplegar el analítico / Athena).</div>`;
    return;
  }
  const max = Math.max(...d.items.map((x) => x.ingreso_promedio || 0));
  cont.innerHTML = `<div style="padding:16px">` + d.items.slice(0, 20).map((x) => {
    const pct = max ? Math.round(((x.ingreso_promedio || 0) / max) * 100) : 0;
    return `<div class="barra">
      <span class="etq">${x.distrito} · ${String(x.hora).padStart(2, "0")}h</span>
      <span class="track"><span class="fill" style="width:${pct}%"></span></span>
      <span class="num">S/ ${Number(x.ingreso_promedio || 0).toFixed(2)}</span>
    </div>`;
  }).join("") + `</div>`;
}

// arranque: autenticación (muestra el login o restaura la sesión guardada)
iniciarGoogle();
restaurar();
