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
  
  export const LIMITE_NEGOCIOS_POR_MEMBRESIA: Record<string, number> = {
    free: 1,
    deluxe: 2,
    premium: 3,
    empresarial: 4,
  };
  