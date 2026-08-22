export const ESTADOS_NEGOCIO = {
    ACTIVA: 13,
    PENDIENTE_PAGO: 29,
    CORTESIA: 16,
    EXPIRADA: 14,
    EN_PROCESO: 30,
    SUSPENDIDA: 31,
    EN_REVISION: 32,
    VENCIDA: 33,
    CANCELADA: 34,
    RECHAZADA: 35,

  };

  // JLP-QUOTA — LIMITE_NEGOCIOS_POR_MEMBRESIA se eliminó: era código muerto
  // (declarado, nunca importado en ningún lado) y sus valores ya no reflejan
  // la config real. El límite de negocios por membresía ahora vive en la
  // tabla `membresia_cuotas` (columna max_negocios) y se aplica de verdad en
  // NegociosController.crear() vía SuscripcionesService.consumirCuota().
  