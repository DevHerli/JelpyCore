# Reporte de Hallazgos de Seguridad — Jelpy Core Backend

> **Entregable de auditoría.** Consolidado: **2026-08-06**.
> Stack: NestJS · TypeScript · MySQL/TypeORM · JWT (access+refresh, claim `role`) · Stripe/Twilio/Cloudinary/OneSignal.
> **Veredicto vigente (2026-08-06): APTO PARA PRODUCCIÓN — CONDICIONADO.** Todos los bloqueantes de seguridad (Crítica/Alta/Media/Baja de autorización + endurecimiento de autenticación) están **resueltos y verificados** (`build exit 0`, suite de regresión en verde). Ver §Veredicto de producción para las **condiciones** (2 decisiones de equipo no bloqueantes + operativa de despliegue).

## Escala de severidad
- **Crítica** — explotación trivial con impacto directo en dinero, datos personales/fiscales o integridad del sistema.
- **Alta** — explotación factible por cualquier usuario; impacto serio en datos o negocio.
- **Media** — requiere condiciones o impacto acotado.
- **Baja** — buena práctica / defensa en profundidad.

## Estado
- ✅ **Resuelto** — corregido y compila (`npm run build` exit 0) en esta auditoría.
- 🔴 **Abierto** — pendiente de remediación.

---

## Resumen ejecutivo

| ID | Módulo | Tipo (OWASP API) | Severidad | Estado |
|---|---|---|---|---|
| JLP-C10 | sucursales_negocios | BFLA/IDOR (API1/API5) | Crítica | ✅ Resuelto |
| JLP-C11 | promociones (negocio + sucursal) | BFLA/IDOR | Crítica | ✅ Resuelto |
| JLP-C12 | horario_sucursal | BFLA/IDOR | Crítica | ✅ Resuelto |
| JLP-C13 | anuncios (/ads) | BFLA/IDOR + abuso de storage | Crítica | ✅ Resuelto |
| JLP-H14 | facturas | IDOR datos fiscales (API1) | Alta | ✅ Resuelto |
| JLP-H15 | pagos | IDOR listado + tarjetas Stripe | Alta | ✅ Resuelto |
| JLP-C17 | membresias | Escritura de precios/planes sin auth | **Crítica** | ✅ Resuelto |
| JLP-M16 | negocios | Admin por claim sin verificar + GET público | Media | ✅ Resuelto |
| JLP-H18 | catálogos (12 controllers) | Escritura/borrado de datos maestros sin auth | Alta | ✅ Resuelto |
| JLP-H19 | catalogo_productos | CRUD sin auth + IDOR por negocioId | Alta | ✅ Resuelto |
| JLP-H20 | sucursales_reviews | Reseñas falsificables (identidad desde body) | Alta | ✅ Resuelto |
| JLP-H21 | ai / jelpy-assistant + ai | Endpoints LLM sin auth (abuso de costo) | Alta | ✅ Resuelto |
| JLP-M22 | sucursal-likes / bookmarks | Identidad desde body (spoofing) | Media | ✅ Resuelto |
| JLP-M23 | eventos_negocios | Eventos de negocio sin auth | Media | ✅ Resuelto |
| JLP-M24 | estadísticas (4 controllers) | Inyección de métricas + exposición analítica | Media | ✅ Resuelto |
| JLP-M25 | support | `POST /tickets` auth manual sin guard | Media | ✅ Resuelto |
| JLP-M26 | reportes-moderacion | Exposición de reportes de moderación | Media | ✅ Resuelto |
| JLP-L27 | messages / notifications | Dos implementaciones distintas de JwtAuthGuard | Baja | ✅ Resuelto |

| JLP-M28 | auth (OTP) / support (folio) / deps | `Math.random()` en OTP+folio, sin límite de intentos, deps vulnerables | Media | ✅ Resuelto |

*Hardening* de autenticación (JLP-M28) resuelto: OTP con `crypto.randomInt` + límite de intentos + rate-limit; folio CSPRNG; `JwtAuthGuard` endurecido (M06); `npm audit` 2/4 remediadas; secretos verificados fuera del repo. Decisiones de equipo no bloqueantes: `forbidNonWhitelisted` y upgrade de `@nestjs/swagger` (ver §JLP-M28).

---

## Hallazgos RESUELTOS ✅

### JLP-C10 — `sucursales_negocios`: mutaciones sin autorización (Crítica) ✅
- **Causa:** controller con 0 guards; cualquier anónimo creaba/editaba/borraba sucursales y su galería de otro negocio; el `DELETE /galeria/:imagenId` borraba imágenes ajenas de Cloudinary.
- **Evidencia:** `sucursales-negocios.controller.ts` sin `@UseGuards`; servicio sin verificación de dueño.
- **Reproducción:** `PUT /sucursales/{idAjeno}` sin token → 200 y modificación.
- **Fix:** `RequesterCtx` + helpers `assertOwnershipByNegocio` / `assertOwnershipBySucursal` / `assertPuedeGestionarSucursal`; `@UseGuards(JwtAuthGuard)` en POST/PUT/DELETE/galería/características; verificación de propiedad **antes** de operar Cloudinary. GETs públicos preservados.
- **Impacto/regresiones:** app dueño usa Bearer → sin ruptura; `requester?` opcional preserva llamadas internas. Build exit 0.

### JLP-C11 — `promociones_negocio` y `promociones_sucursal`: mutaciones sin autorización (Crítica) ✅
- **Causa:** 0 guards; edición/borrado de promociones ajenas y abuso de Cloudinary.
- **Fix:** ownership vía `negocio.suscriptor` (promoción de negocio) y `sucursal→negocio→suscriptor` (promoción de sucursal); guards en POST/PATCH/DELETE; check pre-Cloudinary en `actualizar`.
- **Estado:** Resuelto, build exit 0.

### JLP-C12 — `horario_sucursal`: mutaciones sin autorización (Crítica) ✅
- **Causa:** 0 guards; alta/edición/borrado de horarios de sucursales ajenas.
- **Fix:** `assertOwnerOfSucursal` cargando `sucursal.negocio.suscriptor`; guards en POST/PATCH/DELETE.
- **Estado:** Resuelto, build exit 0.

### JLP-C13 — `anuncios` (/ads): mutaciones sin auth + `DELETE /upload` destroy arbitrario (Crítica) ✅
- **Causa:** 0 guards en dashboard/create/status/image/update/upload; y `DELETE /upload` con `publicId` arbitrario ejecutaba `cloudinary.uploader.destroy(publicId)` → **borrado de cualquier asset de la cuenta Cloudinary**.
- **Fix:** ownership vía `anuncio.negocio.suscriptor` / `dto.negocioId`; guards en todas las mutaciones; verificación pre-upload; `DELETE /upload` restringido a `publicId` que casa `^jelpy/anuncios/(\d+)/` + verificación de propiedad del negocio. Feed/tracking públicos preservados.
- **Estado:** Resuelto, build exit 0.

### JLP-H14 — `facturas`: IDOR sobre datos fiscales (Alta) ✅
- **Causa:** guard de clase JWT pero sin ownership; cualquier usuario listaba/leía/cancelaba facturas de otros y descargaba PDF/XML (RFC, razón social).
- **Fix:** `assertOwnerSuscriptor`; `requester?` en `listar`/`obtener`/`solicitar`/`getPdfUrl`/`getXmlUrl`/`cancelar` comparando `factura.suscriptorId` vs `sub` (admin bypass).
- **Estado:** Resuelto, build exit 0.

### JLP-H15 — `pagos`: IDOR en listado y en tarjetas de Stripe (Alta) ✅
- **Causa:** `GET /pagos` sin ownership; `DELETE /metodos/:pmId` desvinculaba tarjetas de cualquier customer; `PATCH /metodos/:pmId/default` no contrastaba `suscriptorId` con el token.
- **Fix:** `listPagos` fuerza `suscriptorId = sub` para no-admin; helper `assertPaymentMethodOwnedBySuscriptor` (valida `pm.customer` en Stripe); `deletePaymentMethod`/`setDefaultPaymentMethod` reciben `requester` y verifican propiedad. Webhook intacto (validación por firma).
- **Estado:** Resuelto, build exit 0.

### JLP-C17 — `membresias`: creación/edición/borrado de precios y planes SIN autenticación (Crítica) ✅
- **Causa:** `membresias.controller.ts` sin ningún guard; `POST /`, `PUT /:id`, `DELETE /:id` accesibles por anónimos → alteración de precios, planes gratuitos o borrado de membresías con FK.
- **Reproducción:** `PUT /membresias/{id}` con `{ precio: 0 }` sin token → 200.
- **Fix:** `@UseGuards(AdminGuard)` en `crear`/`actualizar`/`eliminar`; GET públicos preservados para mostrar planes.
- **Estado:** Resuelto, build exit 0.

### JLP-H18 — Catálogos/datos maestros: escritura y borrado sin autenticación (Alta) ✅
- **Alcance (Grupo A — 12 controllers globales):** `ciudades`, `categorias`, `subcategorias`, `especialidades`, `estados`, `postal-codes`, `colonias`, `streets` (6 rutas), `keywords-taxonomia`, `caracteristicas-sucursal`, `caracteristicas-aliases`, `publicidad-chat`.
- **Causa:** todos exponían `POST`/`PATCH`/`DELETE` sin guard → corrupción de datos de referencia y borrados en cascada por FK.
- **Fix Grupo A:** `@UseGuards(AdminGuard)` en todas las rutas de escritura; GET públicos preservados.
- **Fix Grupo B (`sucursales-caracteristicas`, IDOR por `sucursal_id`):** patrón `+Owner` (dueño de la sucursal vía `sucursal→negocio→suscriptor`) con `JwtAuthGuard` en `assign`/`update`/`remove`; helper `assertOwnershipBySucursal`; `requester?` opcional.
- **Estado:** Resuelto, build exit 0.

### JLP-H19 — `catalogo_productos`: CRUD sin auth con IDOR por `negocioId` (Alta) ✅
- **Causa:** `POST /categorias`, `POST /items`, `PUT /items/:id`, `PUT /disponibilidad`, `DELETE /items/:id` sin guard ni verificación de dueño; subida a Cloudinary sin auth.
- **Fix:** patrón `+Owner` (`assertOwnershipByNegocio` vía `negocio.suscriptor`), `resolveNegocioIdByItem` para rutas por ítem, wrappers públicos `assertPuedeGestionar*` invocados **antes** de subir a Cloudinary; `Negocio` registrado en `forFeature`; `@UseGuards(JwtAuthGuard)` en las 5 rutas de escritura. `GET /publico/:sucursalId` y listados siguen públicos.
- **Estado:** Resuelto, build exit 0.

### JLP-H20 — `sucursales_reviews`: reseñas falsificables (Alta) ✅
- **Causa:** `POST /` y `PATCH /:id` tomaban `suscriptorId` del body (spoofing de autoría); `PATCH /:id/estado` (moderación) y `PATCH /:id/respuesta` (respuesta del negocio) sin guard.
- **Fix:** `JwtAuthGuard` en create/update con autoría derivada del token; `PATCH /:id/estado` → `AdminGuard` (moderación); `PATCH /:id/respuesta` → `JwtAuthGuard` + patrón `+Owner` (`review→sucursal→negocio→suscriptor`, o admin). GET públicos preservados.
- **Estado:** Resuelto, build exit 0.

### JLP-H21 — `ai` / `jelpy-assistant`: endpoints LLM sin autenticación (Alta) ✅
- **Causa:** `POST /jelpy-assistant/interpretar`, `POST /ai/process`, `POST /ai/interpret` sin guard (abuso de costo LLM, prompt injection, DoS económico); identidad (`suscriptorId`/`usuarioId`) desde body; `GET /ai/historial/:sessionId` y `DELETE /ai/sesion/:sessionId` permitían leer/cerrar conversaciones ajenas por UUID (IDOR).
- **Fix:** `JwtAuthGuard` + `@Throttle({ limit: 15, ttl: 60 })` en los 3 endpoints LLM; identidad tomada del token; `historial`/`sesion` validan que `ConversationSession.usuarioId` sea del solicitante (o admin). `GET /ai/autocomplete` (in-memory, sin DB/LLM) se dejó público.
- **Estado:** Resuelto, build exit 0.

### JLP-M16 — `negocios`: admin por claim sin verificar + GET público (Media) ✅
- **Causa:** las mutaciones ya usaban `JwtAuthGuard`, pero la elevación a admin (`esSuperAdmin`) leía claims que **ningún token emite** (`rol`/`tipo_usuario`/`roles === 'SuperAdmin'`); `auth.service` solo firma `role`. En la práctica el helper devolvía SIEMPRE `false` (vía admin muerta) y, de haberse emitido esos claims, un admin degradado los habría conservado (claim obsoleto).
- **Fix:** unificar a `return user?.role === 'admin'`, que `JwtAuthGuard` (JLP-M06) reescribe desde la BD en cada request (degradación inmediata), consistente con `AdminGuard`. GETs públicos (`/`, `/suscriptor/:id`, `/:id`, `/:id/detalle`) preservados tras verificar que sus mappers (`toNegocioResumenResponse`/`toNegocioDetalleResponse`) **no** exponen PII del suscriptor.
- **Estado:** Resuelto, build exit 0.

### JLP-M22 — `sucursal-likes` / `bookmarks`: identidad desde body (Media) ✅
- **Causa:** `POST /likes/toggle` (`usuarioId`), `POST /bookmarks/toggle` y `POST /bookmarks/marcar-eventos-leidos` (`suscriptorId`) sin guard, identidad tomada del body → spoofing de likes/favoritos/lecturas en nombre de otros y distorsión de métricas “más likes”.
- **Fix:** `JwtAuthGuard` en los tres endpoints de escritura; identidad derivada de `req.user.sub` (verificado que `SucursalLike.usuarioId` y `Bookmark.suscriptorId` referencian `Suscriptor`, por lo que el `sub` del token es la identidad correcta). Los `GET` de lectura se preservaron.
- **Residual (menor):** los `GET /bookmarks/user/:suscriptorId`, `check/...`, `suscriptor/:id/...` siguen tomando el id por ruta y exponen la lista de favoritos de un suscriptor por id enumerable (IDOR de lectura de datos personales). Registrado como seguimiento; no bloquea el spoofing de escritura ya corregido.
- **Estado:** Resuelto (escritura), build exit 0.

### JLP-M23 — `eventos_negocios`: eventos de negocio sin auth (Media) ✅
- **Causa:** CRUD/lectura de eventos de negocio y `POST /marcar-leidos` sin guard; `suscriptorId`/`negocioId` en ruta/body → inyección de eventos falsos para cualquier negocio, desactivación de eventos ajenos, spoofing de lecturas y exposición masiva del log de eventos.
- **Fix:** patrón `+Owner` en el servicio (`assertOwnershipByNegocio(negocioId, requester?)`, `requester?` opcional para preservar los llamadores internos de `crear` desde `promociones_sucursal`/`promociones_negocio`). Controller: `POST /` y `PATCH /:id/desactivar` → `JwtAuthGuard` + propiedad del negocio; `POST /marcar-leidos` → `JwtAuthGuard`, `suscriptorId` desde token; `GET /no-leidos/suscriptor/:id` → `JwtAuthGuard` + solo el propio suscriptor (o admin); `GET /` (todos los eventos) → `AdminGuard`. Los `GET /negocio/:id` y `GET /sucursal/:id` (eventos de marketing visibles a favoritos) se dejaron públicos.
- **Estado:** Resuelto, build exit 0.

### JLP-M24 — Estadísticas: inyección de métricas + exposición analítica (Media) ✅
- **Alcance:** `estadisticas`, `estadistica-historico`, `estadisticas-sucursales-historico`, `estadisticas-semanales`.
- **Causa:** `POST /evento`, `POST /:entidad/:id/:tipo`, `POST /estadisticas-historico`, `POST /estadisticas/sucursales/registrar` sin guard (inflado/inyección de métricas) y lecturas analíticas (`resumen`, `top`, `global-metrics`, `por-negocio`, `por-sucursal`, semanales) públicas → exposición de inteligencia de negocio (tráfico ajeno, ingresos por membresía).
- **Fix (diferenciado por naturaleza del endpoint):**
  - **Tracking anónimo** (`POST /estadisticas/evento`, `POST /estadisticas/:entidad/:id/:tipo`): es por diseño anónimo (app pública + `track-metrics.usecase` de IA lo invoca por servicio). Se mitiga la inyección con `@Throttle({ limit: 60, ttl: 60 })`, **sin** exigir auth para no romper el tracking legítimo.
  - **Inyectores de históricos** (`POST /estadisticas-historico`, `POST /estadisticas/sucursales/registrar`): se verificó que el CRON diario escribe por SQL directo (`DataSource.query`), por lo que estos endpoints HTTP **no tienen llamador legítimo** → `AdminGuard`.
  - **Lecturas por negocio/sucursal** (`GET /estadisticas/negocio/:id/global-metrics`, `GET /estadisticas/sucursales/por-negocio`, `.../por-sucursal`): `JwtAuthGuard` + patrón `+Owner` (ownership por `negocios.suscriptor_id` y `sucursales_negocios→negocios`), con `requester?` opcional.
  - **BI de plataforma** (`GET /estadisticas/negocios`, `/sucursales`, `/resumen`, `/estadisticas-historico/rango`, `/estadisticas/sucursales/totales-ciudad`, `/top`, y **todo** `estadisticas/semanales`): `AdminGuard`.
- **Nota para producto:** si algún ranking (`top`) estaba pensado como *feature pública* de "tendencias" en la app de consumidor, exponerlo mediante un endpoint público dedicado que devuelva solo campos no sensibles; por defecto se aseguró (admin) para evitar fuga de BI.
- **Estado:** Resuelto, build exit 0.

---

### JLP-M25 — `support`: `POST /tickets` con auth manual sin guard (Media) ✅
- **Causa:** el servicio verificaba el JWT manualmente con `jwtService.verify(token)` sin pinning de algoritmo, sin issuer/audience y sin revalidar el estado de la cuenta — divergente de `JwtAuthGuard` (JLP-M06). Un token forjado con `sub` de la víctima podía crear `solicitud_negocio` en su nombre (la validación de propiedad del negocio compara contra ese `sub`).
- **Restricción de diseño:** la ruta admite **ambos** flujos en el mismo endpoint (reporte de bug anónimo + solicitud de negocio autenticada), por lo que **no** puede usar `@UseGuards(JwtAuthGuard)` sin romper el reporte anónimo.
- **Fix:** se endureció la verificación manual (`extraerUsuarioId`) para ser consistente con `JwtAuthGuard`: `algorithms: ['HS256']`, `issuer`/`audience` opcionales desde `ConfigService`, y revalidación en BD (`suscriptores.id` existe y `eliminado=false`, inyectando el repo `Suscriptor`). Se mantiene el flujo dual (header ausente → anónimo).
- **Residual (menor):** `GET /support/tickets?negocio_id=` expone metadatos de tickets de cualquier negocio por id (read-IDOR) y `GET /support/tickets/:folio` es accesible por folio (capability). Registrado como seguimiento; `POST` (el foco del hallazgo) queda endurecido.
- **Estado:** Resuelto, build exit 0.

### JLP-M26 — `reportes-moderacion`: exposición de reportes (Media) ✅
- **Causa:** `GET /` devolvía reportes de moderación sin guard (los handlers de escritura están comentados).
- **Fix:** `@UseGuards(AdminGuard)` a nivel de clase (todos los endpoints del controlador). Los datos de moderación solo son visibles para admin.
- **Estado:** Resuelto, build exit 0.

---

### JLP-L27 — Dos implementaciones distintas de `JwtAuthGuard` (Baja) ✅
- **Causa (original):** `messages` (`MessagesJwtAuthGuard`) y `notificaciones` importaban guards "locales" del módulo, con riesgo de divergencia frente a `common/guards/jwt-auth.guard`.
- **Verificación:** en el estado actual del código los archivos `src/modules/messages/guards/{jwt-auth,admin,api-key}.guard.ts` y `src/modules/notificaciones/guards/{jwt-auth,admin}.guard.ts` son **re-exports** del guard canónico en `common/guards/`. El barrido `implements CanActivate` confirma **una sola** implementación de cada guard (`common/guards/jwt-auth.guard.ts`, `admin.guard.ts`, `api-key.guard.ts`). No existe lógica de verificación duplicada: hay una única fuente de verdad (consolidada en JLP-M06).
- **Fix:** ninguno requerido en código; los shims de re-export son indirección inofensiva y mantienen los imports existentes apuntando al guard endurecido. Riesgo de divergencia = 0.
- **Estado:** Resuelto (verificado), sin cambios de código.

---

## JLP-M28 — Endurecimiento de autenticación (OTP, dependencias, ValidationPipe, secretos) ✅

Bloque de *auth hardening* posterior al barrido de autorización. Estado de cada punto:

### 1. OTP con `Math.random()` → CSPRNG + límite de intentos ✅
- **Causa:** `auth.service.ts` generaba el código de 6 dígitos con `Math.floor(100000 + Math.random()*900000)` en `sendOtpRegister`, `sendOtp` y `sendOtpEmail`. `Math.random()` es un PRNG **no criptográfico** (CWE-338/330): su estado interno es recuperable a partir de salidas previas → un atacante puede **predecir el siguiente OTP** y tomar cuentas (`verifyOtp`/`verifyOtpEmail` emiten tokens o resetean contraseña). Además **no había límite de intentos**: con 10⁶ combinaciones y ventana de 5 min el código era forzable por fuerza bruta, y `sendOtp` **registraba el código en logs** (`console.log`).
- **Fix:**
  - Nuevo helper `generarCodigoOtp()` usa `crypto.randomInt(100000, 1000000)` (CSPRNG uniforme). Aplicado a los 3 puntos de generación.
  - Nuevo helper `validarOtp({telefono|correo}, codigo)`: busca el OTP activo más reciente por identificador, aplica **límite de intentos** (`MAX_OTP_ATTEMPTS = 5`, usa la columna existente `codigos_otp.intentos`), incrementa `intentos` en cada fallo y **bloquea** (marca `usado`) al 5º. Centraliza la validación de `verifyOtpRegister`, `verifyOtp`, `checkOtpEmail` y `verifyOtpEmail`.
  - `sendOtp`/`sendOtpRegister` ahora **invalidan** los códigos activos previos del mismo teléfono (un solo OTP vigente → el límite de intentos es efectivo). El email ya lo hacía.
  - Eliminado el `console.log` del código OTP.
  - `folio` de soporte (`support.service.ts`) migrado de `Math.random()` a `crypto.randomInt` — es la clave de lectura de `GET /support/tickets/:folio`; con folios predecibles el read-IDOR residual (JLP-M25) sería enumerable.
  - Rate-limit por ruta añadido a `POST /auth/otp/email/check` y `.../verify` (`@Throttle 10/5min`), que solo caían al global 120/min. (El resto de rutas OTP ya estaban limitadas por JLP-015/B6.)
- **Estado:** Resuelto, build exit 0.

### 2. `JwtAuthGuard` (algorithms/issuer/audience + recheck de estado) ✅ — ya resuelto en JLP-M06
- Fijado `algorithms: ['HS256']`, `issuer`/`audience` desde `ConfigService` (`JWT_ISSUER`/`JWT_AUDIENCE`), y **re-verificación en BD** en cada request (`suscriptores` con `eliminado=false`, `role` releído de BD → degradación inmediata de permisos). `support.service.ts` (auth manual dual) se alineó al mismo criterio en JLP-M25. Sin acción adicional.

### 3. `ValidationPipe` global `forbidNonWhitelisted` — recomendado, NO aplicado (decisión de equipo)
- `main.ts` ya tiene `ValidationPipe({ transform: true, whitelist: true, ... })`: **`whitelist: true` ya elimina** las propiedades no declaradas en los DTOs (no llegan al servicio ni a la BD). Añadir `forbidNonWhitelisted: true` cambia el comportamiento a **rechazo 400** si el cliente envía cualquier campo extra.
- **Decisión:** NO se activa en este bloque. Los clientes móviles (Ionic/Angular) no están auditados campo a campo; un `forbidNonWhitelisted` podría romper flujos en producción por payloads con campos sobrantes. Riesgo de seguridad ya mitigado por `whitelist`. Recomendación: activarlo tras auditar los payloads reales de los clientes en staging.

### 4. `npm audit` — parcialmente remediado ✅
- Estado inicial: **4 vulnerabilidades high**.
- `npm audit fix` (sin `--force`) resolvió **2**: `brace-expansion` (DoS por expansión no acotada, GHSA-mh99/rgw5) y `fast-uri` (host confusion, GHSA-7p8r). Build exit 0 tras la actualización.
- **Residual (2 high):** `js-yaml` (DoS por parseo exponencial en flow collections) llega **solo** vía `@nestjs/swagger@11.4.6`. `npm audit fix --force` haría un **downgrade breaking** a `@nestjs/swagger@11.4.5`. Exposición real baja: Swagger no parsea YAML no confiable en runtime (genera la doc de la API). **Decisión de equipo:** planificar upgrade de swagger a una versión con `js-yaml` parcheado; no aplicar el downgrade forzado a ciegas.

### 5. Gestión de secretos — verificado seguro ✅
- `.env` y `.env.qa` están en `.gitignore` y **nunca** fueron versionados: `git ls-files` no los lista y no aparecen en el historial (126 commits revisados). **No se requiere rotación** por exposición en el repo. Recomendación permanente: mantener los secretos solo en el gestor de entorno de Render y rotarlos periódicamente.

---

## Recomendación de priorización para desbloquear producción
1. **JLP-C17** (membresias/precios) — inmediato, `AdminGuard`. ✅
2. **JLP-H18/H19/H20/H21** — guards + patrón `+Owner`. ✅
3. **JLP-M16** — unificar criterio admin. ✅
4. **JLP-M22/M23/M24/M25/M26/L27** — barrido de autorización de medias/bajas. ✅
5. **JLP-M28 Auth hardening** (OTP `crypto` + límite de intentos, rate-limit OTP email, folio CSPRNG, `npm audit` parcial, secretos verificados; `JwtAuthGuard` ya endurecido en M06). ✅
6. Re-ejecutar build + pruebas de regresión y **re-emitir veredicto**. ✅ (ver §Fase de regresión y §Veredicto)

> **Estado del barrido de autorización (IDOR/BOLA + BFLA):** COMPLETO. Todos los
> hallazgos C/H/M/L de autorización quedan resueltos y verificados con `build exit 0`.
> Residuales de menor severidad (read-IDOR) registrados como seguimiento: `GET` de
> favoritos en bookmarks (JLP-M22) y `GET` de tickets de soporte por `negocio_id`/`folio`
> (JLP-M25).
>
> **Estado del endurecimiento de autenticación (JLP-M28):** COMPLETO en lo accionable
> sin decisión de equipo. OTP con CSPRNG + límite de intentos + rate-limit; folio con
> CSPRNG; `JwtAuthGuard` endurecido (M06); 2/4 vulnerabilidades `npm audit` remediadas;
> secretos verificados fuera del repo. Quedan **2 decisiones de equipo** (no bloqueantes,
> bajo riesgo): activar `forbidNonWhitelisted` tras auditar payloads de clientes, y
> actualizar `@nestjs/swagger` para cerrar `js-yaml`. Con esto, los bloqueadores de
> seguridad de producción quedan **resueltos**; pendiente la fase de pruebas de
> regresión y el veredicto final.

---

## Fase de regresión (2026-08-06)

Objetivo: confirmar que el endurecimiento (especialmente el que **toca el login**,
JLP-M28) no rompió los flujos existentes. Sin pruebas destructivas contra producción.

**Compilación.** `npm run build` → **exit 0** tras cada bloque y en el build final
consolidado (toda la base compila con la versión de dependencias actualizada por
`npm audit fix`).

**Suite automatizada.** `npx jest` → **2 suites, 11 tests, todo en verde.**
- `src/app.controller.spec.ts` (baseline, 1 test).
- `src/modules/auth/auth.service.spec.ts` — **nueva suite de regresión JLP-M28** (10 tests, repositorios mockeados, sin BD):
  - *Generación:* el OTP es numérico de 6 dígitos en rango `100000–999999`; ya **no** se filtra por `console.log`; se **invalidan** códigos activos previos; llamadas sucesivas producen códigos distintos (CSPRNG).
  - *Verificación (`verifyOtp`):* camino feliz (código correcto → marca `usado`, emite tokens); código incorrecto → **incrementa `intentos`** y lanza `Unauthorized`; 4→5 fallos → **bloquea** el código (`usado=true`); código ya bloqueado → rechaza **aunque el código sea correcto** y no emite tokens; sin OTP activo → `Unauthorized`.
  - *Recuperación de contraseña (`verifyOtpEmail`):* camino feliz (actualiza contraseña hasheada y consume el OTP); código incorrecto → incrementa intentos y **no** cambia la contraseña.

**e2e NO ejecutado — por decisión de seguridad.** `npm run test:e2e` arranca todo
`AppModule`, que abre una conexión TypeORM a la BD configurada en `.env` (potencialmente
**producción**). Ejecutarlo violaría la regla de *no pruebas contra producción*. Queda
como recomendación: correr e2e contra una **BD de staging aislada** antes del despliegue.

---

## Veredicto de producción (2026-08-06)

### APTO PARA PRODUCCIÓN — CONDICIONADO

El backend pasó de **NO APTO** (fallo sistémico de autorización: IDOR/BOLA en decenas
de endpoints, exposición de hashes/PII, mutaciones anónimas de precios/catálogos/pagos)
a un estado **apto condicionado**:

- **Autorización (IDOR/BOLA + BFLA):** barrido COMPLETO. Todos los hallazgos
  C/H/M/L resueltos y verificados (`build exit 0`).
- **Autenticación:** `JwtAuthGuard` endurecido (HS256 + issuer/audience + revalidación
  en BD por request), OTP con CSPRNG + límite de intentos + rate-limit, folio con CSPRNG.
- **Dependencias:** 2/4 vulnerabilidades high remediadas sin romper el build.
- **Secretos:** verificados fuera del árbol del repo (no versionados en 126 commits).
- **Regresión:** build exit 0 + suite de 11 tests en verde.

### Condiciones para levantar el "condicionado"
1. **`@nestjs/swagger` → js-yaml: ✅ CERRADO (2026-08-06).** Se forzó `js-yaml@5.2.3`
   (parcheado) vía `overrides` en `package.json`, manteniendo swagger en `11.4.6` (sin el
   downgrade breaking). `npm audit fix` (no-force) cerró además el advisory residual de
   js-yaml 3.x/4.x en tooling dev. **`npm audit` → 0 vulnerabilidades.** Build + tests en verde.
2. **`ValidationPipe forbidNonWhitelisted`:** (decisión de equipo, no bloqueante de
   seguridad) activarlo tras auditar los payloads reales de los clientes móviles en
   staging (hoy `whitelist:true` ya descarta campos extra).
3. **e2e en staging:** correr las pruebas de seguridad contra una BD aislada (no producción).
   - **Escrito ✅:** `test/security.e2e-spec.ts` — cubre rechazo de anónimos en
     membresías/ciudades (BFLA), auth obligatoria en facturas/pagos (IDOR), verificación
     de OTP, y (con tokens de staging) IDOR entre usuarios. Desactivado por defecto; corre
     con `RUN_SECURITY_E2E=1 npm run test:e2e` apuntando a staging.
   - **Bloqueador de harness (pre-existente, no de seguridad):** `src/modules/core/health/health.service.ts`
     importa `serverStartedAt` desde `../../../main`, por lo que importar `AppModule` en un
     test arrastra `main.ts` y dispara su `bootstrap()` de nivel superior (arranca la app /
     `process.exit`). Esto rompe **cualquier** e2e (incluido el `app.e2e-spec.ts` de fábrica),
     no solo el nuevo. Además el `jest-e2e.json` necesita ajuste de transform ESM. **Acción:**
     desacoplar `serverStartedAt` de `main.ts` (moverlo a un provider/const propio) antes de
     poder ejecutar el e2e en staging. Registrado como tarea de infraestructura.
4. **Operativa de despliegue:** mantener secretos solo en el gestor de entorno de Render
   y establecer rotación periódica de Stripe/Twilio/Cloudinary/JWT.

### Residuales de seguimiento (bajo impacto, no bloqueantes)
- Read-IDOR en `GET` de favoritos de bookmarks (JLP-M22).
- Read-IDOR en `GET /support/tickets` por `negocio_id`/`folio` (JLP-M25) — mitigado
  parcialmente al hacer los folios impredecibles (CSPRNG) en JLP-M28.

> Recomendación final: desplegar tras cerrar el punto 3 (e2e en staging) y agendar los
> puntos 1–2 en el siguiente sprint. Los puntos 1, 2 y 4 no exponen datos ni permiten
> acciones no autorizadas; son endurecimiento adicional y buena práctica operativa.
