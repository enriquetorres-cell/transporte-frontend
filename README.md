# transporte-frontend (P4)

Panel web (SPA) del proyecto de transporte urbano · CS2032. Consume los 5
microservicios. Sitio **estático** (HTML/CSS/JS sin build), listo para AWS Amplify.

## Qué consume (≥2 métodos REST por microservicio)

| Vista | Microservicio | Métodos REST |
|-------|---------------|--------------|
| Usuarios | MS1 | `GET /ms1/usuarios` · `GET /ms1/usuarios/{id}` |
| Viajes | MS2 | `GET /ms2/viajes` · `GET /ms2/viajes/{id}` |
| Calificaciones | MS3 | `GET /ms3/calificaciones` · `GET /ms3/calificaciones/{id}` |
| Resumen conductor | MS3 | `GET /ms3/conductores/{id}/resumen` |
| Analítica (consulta estrella) | MS5 | `GET /ms5/ingresos/por-hora-distrito` |

## Configuración (Contrato Cero: ninguna URL escrita en el código)

Todo sale de [`config.js`](config.js):

```js
window.APP_CONFIG = { API_BASE: "http://localhost", ... };
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

1. Sube este repo a GitHub (público).
2. Consola AWS → **Amplify** → *Deploy an app* → **GitHub** → autoriza y elige este repo.
3. Build settings: Amplify detecta el `amplify.yml` (sitio estático, sin build).
4. En **Environment variables** no hace falta nada: la URL se edita en `config.js`.
   (Cuando exista el API Gateway, cambia `API_BASE` en `config.js`, haz commit y Amplify redespliega.)
5. Deploy → obtienes una URL `https://<rama>.<id>.amplifyapp.com`.

**Importante:** pásale a **P3** tu dominio de Amplify para que lo agregue al **CORS**
del API Gateway; si no, el navegador bloqueará las llamadas.

## Estructura

```
index.html     · las 5 vistas en pestañas
styles.css     · tema oscuro
app.js         · fetch a los MS + render + paginación + manejo de errores
config.js      · API_BASE (único lugar con URLs)
amplify.yml    · build spec (sitio estático)
```
