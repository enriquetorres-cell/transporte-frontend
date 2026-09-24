# transporte-frontend (P4)

Panel web (SPA) del proyecto de transporte urbano · CS2032. Consume los 5
microservicios. Sitio **estático** (HTML/CSS/JS sin build), listo para AWS Amplify.

## Qué consume (≥2 métodos REST por microservicio)

| Pestaña | MS | Métodos REST |
|---|---|---|
| Usuarios | MS1 | `GET /ms1/usuarios` · `GET /ms1/usuarios/{id}` · `GET /ms1/usuarios/{id}/validacion` |
| Conductores | MS1 | `GET /ms1/conductores/{id}/elegibilidad` · `/categoria` · `GET /ms1/conductores/disponibles` |
| Viajes | MS2 | `GET /ms2/viajes` (filtros `estado`, `distritoOrigen`, `conductorId`…) · `GET /ms2/viajes/{id}` |
| Calificaciones | MS3 | `GET /ms3/calificaciones` (búsqueda por texto, rating, tag, conductor) |
| Reputación | MS3 | `GET /ms3/conductores/{id}/resumen` |
| Perfil | MS4 | `GET /ms4/usuarios/{id}/perfil` · `/conductores/{id}/hoja-de-vida` · `/viajes/{id}/detalle-completo` |
| Analítica (solo Administrador) | MS5 | `GET /ms5/ingresos/por-hora-distrito` · `/conductores/rating-por-distrito` · `/vistas/…` |
| Menú: red en vivo | MS1–MS5 | `GET /msN/health` cada 30 s |

Acceso: botón **Entrar como Administrador** (o Demo). El buscador superior acepta `695` (usuario),
`C101` (conductor) o `V2044` (viaje).

> **Despliegue completo del proyecto en AWS (paso a paso):** ver la
> [guía principal](https://github.com/Limepal/MS1-Usuarios-y-Conductores#readme), paso 7.

## Configuración (Contrato Cero: ninguna URL escrita en el código)

Todo sale de [`config.js`](config.js):

```js
window.APP_CONFIG = { API_BASE: "https://<api-id>.execute-api.us-east-1.amazonaws.com", ... };
```

- **Local** (microservicios en tu laptop): deja `http://localhost`.
- **Producción**: pon la URL del **API Gateway** cuando P3 lo tenga:
  `https://xxxx.execute-api.us-east-1.amazonaws.com`

## Probar en local

Con los microservicios corriendo (`docker compose` de cada uno), abre `index.html`
con un servidor estático simple:

```bash
python -m http.server 5500
```

Luego entra a http://localhost:5500

> Nota: como el navegador aplica CORS, en producción el **API Gateway** debe tener
> CORS habilitado (es donde va, según el Contrato Cero, nunca en los microservicios).

## Desplegar en AWS Amplify

1. Haz **fork** de este repo y en `config.js` pon en `API_BASE` la URL de **tu** API Gateway (commit).
2. Consola AWS → **Amplify** → *Deploy an app* → **GitHub** → autoriza y elige este repo.
3. Build settings: Amplify detecta el `amplify.yml` (sitio estático, sin build).
4. En **Environment variables** no hace falta nada: la URL se edita en `config.js`.
   (Cuando exista el API Gateway, cambia `API_BASE` en `config.js`, haz commit y Amplify redespliega.)
5. Deploy → obtienes una URL `https://<rama>.<id>.amplifyapp.com`.

El **CORS** está configurado en el API Gateway (`AllowOrigins=*`), así que no hace falta ningún ajuste adicional.

## Estructura

```
index.html     · shell: sidebar (red en vivo + navegación + turno), topbar con buscador, paneles y carril de detalle
styles.css     · diseño VÍA (tokens de color, tipografías Space Grotesk / IBM Plex)
app.js         · fetch a los MS, filtros, paginación, fichas de detalle, gráfico (Chart.js), manejo de errores
config.js      · API_BASE (único lugar con URLs)
amplify.yml    · build spec (sitio estático, sin build)
```
