// =====================================================================
//  Lógica del panel · consume los microservicios vía window.urlDe(ms)
//  Formato de respuesta (Contrato Cero):
//    Listado -> { total, page, limit, items: [...] }
//    Error   -> { error, detalle? }
// =====================================================================

document.getElementById("api-actual").textContent = window.APP_CONFIG.API_BASE;

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

// arranque
cargarUsuarios();
