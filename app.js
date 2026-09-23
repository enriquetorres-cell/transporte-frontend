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
  const d = await pedir(`${urlDe("ms2")}/viajes?page=${estado.viajes}&limit=${LIMIT}${filtros.viajes}`);
  if (!d) { tb.innerHTML = ""; return; }
  if (!d.items.length) sinResultados(tb, 5); else
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
  const d = await pedir(`${urlDe("ms3")}/calificaciones?page=${estado.calificaciones}&limit=${LIMIT}${filtros.calificaciones}`);
  if (!d) { tb.innerHTML = ""; return; }
  if (!d.items.length) sinResultados(tb, 5); else
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
      <td>${i + 1}</td><td>${x.nombre} <span style="color:var(--faint)">#${x.conductor_id}</span></td>
      <td>${x.distrito_base ?? "—"}</td><td>${x.rating_promedio ?? "—"}</td>
      <td>${badges(x.servicios_habilitados)}</td><td><b>${x.puntaje}</b></td>
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

// MS5 · 2 métodos: consulta estrella (ingresos) + rating por distrito (Athena)
async function cargarAnalitica() {
  const cont = document.getElementById("analitica-cont");
  cont.innerHTML = `<div class="cargando">Cargando analítica… (Athena puede tardar unos segundos)</div>`;
  const [ingresos, rating] = await Promise.all([
    pedir(`${urlDe("ms5")}/ingresos/por-hora-distrito`),
    pedir(`${urlDe("ms5")}/conductores/rating-por-distrito`),
  ]);
  let html = "";

  if (ingresos && ingresos.items && ingresos.items.length) {
    html += `<h3 style="margin:8px 0 12px;font-size:14px;font-weight:600">Ingreso promedio por hora del día
      <span class="metodos">GET /ms5/ingresos/por-hora-distrito</span></h3>
      <div style="height:300px;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px">
        <canvas id="chart-ingresos"></canvas>
      </div>`;
  }

  if (rating && rating.items && rating.items.length) {
    html += `<h3 style="margin:24px 0 10px;font-size:14px;font-weight:600">Rating por distrito del conductor
      <span class="metodos">GET /ms5/conductores/rating-por-distrito</span></h3>
      <div class="tablewrap"><table><thead><tr>
        <th>Distrito</th><th>Conductores</th><th>Calificaciones</th><th>Rating prom.</th>
      </tr></thead><tbody>` + rating.items.map((x) =>
        `<tr><td>${x.distrito_base ?? "—"}</td><td>${x.conductores ?? "—"}</td><td>${x.calificaciones ?? "—"}</td><td class="rating">${x.rating_promedio ?? "—"}</td></tr>`
      ).join("") + `</tbody></table></div>`;
  }

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
        datasets: [{ label: "Ingreso promedio (S/)", data: valores, backgroundColor: "#34cedd", borderRadius: 4 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: "#93a3b5" } } },
        scales: {
          x: { ticks: { color: "#93a3b5" }, grid: { color: "#243242" } },
          y: { ticks: { color: "#93a3b5" }, grid: { color: "#243242" }, beginAtZero: true },
        },
      },
    });
  }
}

// arranque: autenticación (muestra el login o restaura la sesión guardada)
iniciarGoogle();
restaurar();
