# Matriz de Autorización — Jelpy Core Backend

> **Entregable de auditoría de seguridad.** Fecha de consolidación: **2026-08-05**.
> Estado del backend: **NO APTO PARA PRODUCCIÓN** (ver reporte de hallazgos).
>
> Datos verificados por lectura directa de los 50 `*.controller.ts` + revisión de la
> lógica de propiedad (ownership) en los servicios de los módulos endurecidos.
> **No se asume**: cada celda refleja el código tal como está hoy.

## Leyenda

| Símbolo | Significado |
|---|---|
| **Público** | Sin guard. Accesible sin token. |
| **JWT** | `@UseGuards(JwtAuthGuard)` (de `common/guards/jwt-auth.guard`) — exige token válido. |
| **JWT\*** | ~~Guard JWT local del módulo~~ → **resuelto (JLP-L27)**: `messages`/`notificaciones` re-exportan el guard canónico de `common/guards`. |
| **Admin** | `@UseGuards(AdminGuard)` — exige `role === 'admin'`. |
| **ApiKey** | `@UseGuards(ApiKeyGuard)` — exige header `X-API-Key`. |
| **+Owner** | Además del guard, el servicio verifica **propiedad** (el recurso pertenece al `sub` del token o admin). |
| **Firma** | Sin guard por diseño: validado por firma criptográfica (webhook Stripe). |
| ✅ | Autorización correcta / endurecida en esta auditoría. |
| ⚠️ | Riesgo abierto (ver ID de hallazgo). |

---

## 1. Módulos de negocio ENDURECIDOS en esta auditoría ✅

### `suscriptores` (business/suscriptores) — Bloque 1
| Ruta | Autorización | Estado |
|---|---|---|
| `GET /` | Admin | ✅ |
| `POST /` | Público (registro) | ✅ |
| `GET /:id` | JWT +Owner | ✅ |
| `PUT /:id` | JWT +Owner | ✅ |
| `PUT /:id/completar` | Admin | ✅ |
| `PUT /:id/completar-perfil` | JWT (sub===id) | ✅ |
| `DELETE /me` | JWT | ✅ |
| `DELETE /:id` | Admin | ✅ |
| `GET /:id/permisos` · `PATCH /:id/permisos` | JWT +Owner | ✅ |
| `GET /:id/datos-fiscales` · `PUT /:id/datos-fiscales` | JWT +Owner | ✅ |

### `suscripciones` (suscripciones) — Bloque 2
| Ruta | Autorización | Estado |
|---|---|---|
| `GET /resumen/:suscriptorId` · `GET /activa/:suscriptorId` · `GET /estado-cuenta/:suscriptorId` | JWT +Owner | ✅ |
| `POST /` · `POST /cambiar-plan` · `POST /estado-cuenta/movimiento` · `POST /cuotas` | Admin | ✅ |
| `PATCH /:id/cancelar` | JWT +Owner (en servicio) | ✅ |
| `POST /consumir` | JWT +Owner | ✅ |
| `PATCH /renovacion/:suscriptorId` | JWT +Owner | ✅ |
| `GET /cuotas` · `GET /cuotas/membresia/:membresiaId` | Público (catálogo de precios) | ⚠️ revisar (informativo) |

### `sucursales` (business/sucursales_negocios) — Bloque 3 (JLP-C10)
| Ruta | Autorización | Estado |
|---|---|---|
| `POST /` | JWT +Owner (negocio) | ✅ |
| `POST /:id/galeria` | JWT +Owner (pre-Cloudinary) | ✅ |
| `PUT /:id` | JWT +Owner (pre-Cloudinary) | ✅ |
| `DELETE /:id` | JWT +Owner | ✅ |
| `DELETE /galeria/:imagenId` | JWT +Owner | ✅ |
| `POST /:id/caracteristicas` | JWT +Owner | ✅ |
| `GET /`, `GET /:id`, `GET /negocio/:negocioId`, `GET /:id/kpis-light`, `GET /:id/caracteristicas` | Público | ✅ (lectura pública intencional) |

### `promociones-negocios` (business/promociones_negocio) — Bloque 4 (JLP-C11)
| Ruta | Autorización | Estado |
|---|---|---|
| `POST /` | JWT +Owner (negocio) | ✅ |
| `PATCH /:id` | JWT +Owner (pre-Cloudinary) | ✅ |
| `DELETE /:id` | JWT +Owner | ✅ |
| `GET /negocio/:businessId`, `GET /:id` | Público | ✅ |

### `promociones-sucursales` (business/promociones_sucursal) — Bloque 4 (JLP-C11)
| Ruta | Autorización | Estado |
|---|---|---|
| `POST /` | JWT +Owner (sucursal→negocio→suscriptor) | ✅ |
| `PATCH /:id` | JWT +Owner (pre-Cloudinary) | ✅ |
| `DELETE /:id` | JWT +Owner | ✅ |
| `GET /*` (activas, próximas, resumen, etc.), `POST /:id/vista`, `POST /:id/clic` | Público | ✅ (feed/tracking) |

### `horarios-sucursal` (business/horario_sucursal) — Bloque 4 (JLP-C12)
| Ruta | Autorización | Estado |
|---|---|---|
| `POST /` | JWT +Owner | ✅ |
| `PATCH /:id` | JWT +Owner | ✅ |
| `DELETE /:id` | JWT +Owner | ✅ |
| `GET /`, `GET /sucursal/:sucursalId` | Público | ✅ |

### `ads` (business/anuncios) — Bloque 5 (JLP-C13)
| Ruta | Autorización | Estado |
|---|---|---|
| `GET /dashboard/:negocioId` | JWT +Owner | ✅ |
| `POST /` | JWT +Owner (negocio) | ✅ |
| `PATCH /:id/status` | JWT +Owner | ✅ |
| `PATCH /:id/image` | JWT +Owner | ✅ |
| `PUT /:id` | JWT +Owner | ✅ |
| `POST /upload/:negocioId` | JWT +Owner (pre-Cloudinary) | ✅ |
| `DELETE /upload` | JWT +Owner (publicId acotado a `jelpy/anuncios/{negocioId}/`) | ✅ (era destroy arbitrario) |
| `GET /public`, `GET /placements-permitidos/:negocioId`, `GET /:id`, `POST /:id/impression`, `POST /:id/click`, `POST /:id/track` | Público | ✅ (feed/tracking) |

### `facturas` (facturas) — Bloque financiero (JLP-H14)
| Ruta | Autorización | Estado |
|---|---|---|
| `GET /?suscriptorId=` | JWT +Owner | ✅ |
| `POST /solicitar` | JWT +Owner | ✅ |
| `GET /:id` · `GET /:id/pdf` · `GET /:id/xml` | JWT +Owner | ✅ |
| `PATCH /:id/cancelar` | JWT +Owner | ✅ |

### `pagos` (pagos) — Bloque financiero (JLP-H15)
| Ruta | Autorización | Estado |
|---|---|---|
| `GET /` | JWT +Owner (suscriptorId forzado a `sub`) | ✅ |
| `POST /stripe/customer` · `POST /stripe/setup-intent` · `POST /stripe/checkout` | JWT (sub===suscriptorId) | ✅ |
| `GET /metodos/:suscriptorId` | JWT (sub===suscriptorId) | ✅ |
| `DELETE /metodos/:paymentMethodId` | JWT +Owner (PM pertenece al customer) | ✅ |
| `PATCH /metodos/:paymentMethodId/default` | JWT +Owner (PM + sub===suscriptorId) | ✅ |
| `POST /webhook/stripe` | Firma (constructEvent) | ✅ |

---

## 2. Módulos con autorización PARCIAL / abierta ⚠️ (hallazgos abiertos)

### `negocios` (business/negocios) — JLP-M16 ✅
| Ruta | Autorización | Estado |
|---|---|---|
| `POST /` · `PUT /:id` · `PUT /:id/logo` · `DELETE /:id` | JWT (+owner/`esSuperAdmin` en handler) | ✅ `esSuperAdmin` unificado a `role === 'admin'` (BD vía JwtAuthGuard/JLP-M06) |
| `GET /`, `GET /suscriptor/:id`, `GET /:id`, `GET /:id/detalle` | Público | ✅ mappers sin PII de suscriptor (verificado) |

### Catálogos y datos maestros — escritura endurecida (JLP-C17 / JLP-H18) ✅
Todas las rutas de escritura ahora exigen `AdminGuard` (catálogos globales) u `Owner` (`sucursales-caracteristicas`). GET públicos preservados:

| Controller | Rutas de escritura | Autorización | Estado |
|---|---|---|---|
| `membresias` | `POST /`, `PUT /:id`, `DELETE /:id` (**precios/planes**) | AdminGuard | ✅ JLP-C17 |
| `ciudades` | `POST /`, `PUT /:id`, `DELETE /:id` | AdminGuard | ✅ JLP-H18 |
| `categorias` | `POST /`, `PATCH /:id`, `PATCH /:id/desactivar`, `DELETE /:id/permanente` | AdminGuard | ✅ JLP-H18 |
| `subcategorias` | `POST /`, `PATCH /:id`, `PATCH /:id/desactivar`, `DELETE /:id` | AdminGuard | ✅ JLP-H18 |
| `especialidades` | `POST /`, `PATCH /:id`, `PATCH /:id/desactivar`, `DELETE /:id` | AdminGuard | ✅ JLP-H18 |
| `estados` | `POST /`, `PATCH /:id`, `PATCH /:id/desactivar`, `DELETE /:id` | AdminGuard | ✅ JLP-H18 |
| `postal-codes` | `POST /`, `PATCH /:id`, `DELETE /:id` | AdminGuard | ✅ JLP-H18 |
| `colonias` | `POST /`, `PATCH /:id`, `DELETE /:id` | AdminGuard | ✅ JLP-H18 |
| `streets` | `POST /`, `PATCH /:id`, `DELETE /:id` (+ street-colonies) | AdminGuard | ✅ JLP-H18 |
| `keywords-taxonomia` | `POST /`, `PATCH /:id`, `DELETE /:id` | AdminGuard | ✅ JLP-H18 |
| `caracteristicas-sucursal` | `POST /`, `PATCH /:id`, `DELETE /:id` | AdminGuard | ✅ JLP-H18 |
| `sucursales-caracteristicas` | `POST /:sucursal_id`, `PATCH /detalle/:id`, `DELETE /detalle/:id` | JWT +Owner (sucursal) | ✅ JLP-H18B |
| `caracteristicas-aliases` | `POST /`, `PATCH /:id`, `DELETE /:id` | AdminGuard | ✅ JLP-H18 |
| `publicidad-chat` | `POST /`, `DELETE /:id` | AdminGuard | ✅ JLP-H18 |
| `jerarquia` | `GET /` (solo lectura) | Público | — |

### Otros módulos de negocio ⚠️
| Controller | Problema | Severidad / Estado |
|---|---|---|
| `catalogo-productos` | CRUD de productos por `negocioId`: ahora `JwtAuthGuard` + `+Owner` (dueño del negocio), check pre-Cloudinary | ✅ JLP-H19 |
| `sucursales-reviews` | Autoría desde token; respuesta `+Owner` del negocio; estado con `AdminGuard` | ✅ JLP-H20 |
| `ai` / `jelpy-assistant` | LLM `process`/`interpret`/`interpretar`: `JwtAuthGuard` + `@Throttle`; `historial`/`sesion` con ownership | ✅ JLP-H21 |
| `sucursal-likes` | `POST /toggle`: `JwtAuthGuard`, `usuarioId` desde token (GET `check` público) | ✅ JLP-M22 |
| `bookmarks` | `POST /toggle`, `POST /marcar-eventos-leidos`: `JwtAuthGuard`, `suscriptorId` desde token (GET lista favoritos por id = residual read-IDOR) | ✅ JLP-M22 |
| `eventos-negocios` | `POST /` y `PATCH /:id/desactivar`: JWT +Owner(negocio); `POST /marcar-leidos` y `GET /no-leidos/suscriptor/:id`: JWT + propio suscriptor; `GET /` (todos): AdminGuard. `crear` interno (promociones) preservado con `requester?` | ✅ JLP-M23 |
| `estadisticas` (+historico, sucursales-historico, semanales) | Tracking anónimo `POST /evento`·`/:entidad/:id/:tipo` → `@Throttle`; inyectores de históricos → AdminGuard; lecturas por negocio/sucursal → JWT +Owner; BI de plataforma (resumen/top/semanales/rango/totales-ciudad) → AdminGuard | ✅ JLP-M24 |
| `support` | `POST /tickets`: flujo dual (anónimo/auth) preservado; verificación manual endurecida = JwtAuthGuard (HS256 + issuer/audience + recheck BD). Residual: read-IDOR en GET por negocio_id/folio | ✅ JLP-M25 |
| `reportes-moderacion` | `@UseGuards(AdminGuard)` a nivel de clase | ✅ JLP-M26 |
| `filtros_busqueda`, `search`, `public/sucursales`, `public/ads`, `legal`, `health` | Solo lectura pública | ✅ (intencional) |

---

## 3. Módulos con guard de clase (correctos, pendientes de revisión de ownership)
| Controller | Guard de clase | Nota |
|---|---|---|
| `messages` | JWT (canónico vía re-export) | ✅ JLP-L27: `messages/guards/*` son re-exports de `common/guards/*` (sin divergencia) |
| `notificaciones` | JWT (canónico vía re-export) | ✅ JLP-L27: `notificaciones/guards/*` re-exportan `common/guards/*` |
| `admin/messages` | ApiKey | revisar rotación/fortaleza de API key |
| `admin/notifications` | ApiKey | ídem |
| `ventas/membresias` | ApiKey | ídem |

---

## 4. Resumen de cobertura

| Categoría | Nº controllers |
|---|---|
| Endurecidos con +Owner en esta auditoría | 12 (+`sucursales-caracteristicas`, `catalogo-productos`, `sucursales-reviews`) |
| Endurecidos con AdminGuard en escritura (catálogos/membresias) | 13 |
| Endurecidos LLM (JwtAuthGuard + Throttle) | 2 (`ai`, `jelpy-assistant`) |
| Guard de clase (JWT/ApiKey) | 6 |
| Guard parcial por método | 1 (`negocios` — JLP-M16 resuelto) |
| Endurecidos escritura por token (JwtAuthGuard, id del token) | 2 (`sucursal-likes`, `bookmarks` — JLP-M22) |
| **Aún sin guard** (todos los findings medios de autorización resueltos) | 0 |
| Solo lectura pública (intencional) | subconjunto de los anteriores |

> **Observación transversal:** NestJS es *opt-in* para auth — el único `APP_GUARD`
> global es `ThrottlerGuard`. Todo endpoint sin `@UseGuards` es **anónimo**. La
> mayoría de los controllers de catálogo exponen escritura/borrado sin ninguna
> protección. Ver reporte de hallazgos para plan de remediación.
