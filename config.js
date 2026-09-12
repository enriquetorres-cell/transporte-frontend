// =====================================================================
//  Configuración del frontend · transporte urbano · CS2032
//  TODA URL sale de aquí, nunca escrita en el código (Contrato Cero).
//
//  - En LOCAL (con los MS en tu laptop):   http://localhost
//  - En PRODUCCIÓN (detrás del API Gateway): https://xxxx.execute-api.us-east-1.amazonaws.com
//
//  El Gateway monta cada microservicio bajo su prefijo /ms1 .. /ms5,
//  así que basta cambiar API_BASE y todo el resto sigue funcionando.
// =====================================================================
window.APP_CONFIG = {
  // URL del API Gateway (HTTPS + CORS) → VPC Link → ALB interno → prod MVs.
  API_BASE: "https://h4sh35u9ac.execute-api.us-east-1.amazonaws.com",

  // Puertos locales (solo se usan cuando API_BASE es localhost).
  PUERTOS_LOCAL: { ms1: 8001, ms2: 8002, ms3: 8003, ms4: 8004, ms5: 8005 },
};

// Devuelve la URL base de un microservicio segun el entorno.
window.urlDe = function (ms) {
  const base = window.APP_CONFIG.API_BASE;
  if (base.startsWith("http://localhost")) {
    return `http://localhost:${window.APP_CONFIG.PUERTOS_LOCAL[ms]}/${ms}`;
  }
  return `${base}/${ms}`;
};
