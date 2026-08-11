/**
 * Pruebas e2e de seguridad — Jelpy Core Backend (auditoría JLP)
 * ------------------------------------------------------------------------------
 * Cubren, extremo a extremo, las defensas endurecidas en la auditoría:
 *   • Rechazo de anónimos en mutaciones de catálogos/precios (BFLA — JLP-C17/H18).
 *   • Autenticación obligatoria en datos fiscales y de pago (IDOR — JLP-H14/H15).
 *   • Verificación de OTP end-to-end (JLP-M28).
 *   • IDOR entre usuarios: A no puede leer recursos de B.
 *
 * ⚠️ SEGURIDAD OPERATIVA: estas pruebas levantan todo `AppModule`, que abre una
 * conexión TypeORM a la BD de `.env`. Para NO ejecutarlas jamás contra producción
 * están **desactivadas por defecto** y solo corren si se define `RUN_SECURITY_E2E=1`
 * apuntando a una **BD de staging aislada**:
 *
 *     RUN_SECURITY_E2E=1 npm run test:e2e
 *
 * Las pruebas de IDOR entre usuarios requieren además dos JWT válidos de staging:
 *     SEC_E2E_TOKEN_A, SEC_E2E_TOKEN_B  (usuarios distintos)
 *     SEC_E2E_FACTURA_B_ID              (id de una factura que pertenece a B)
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './../src/app.module';

const RUN = process.env.RUN_SECURITY_E2E === '1';
// `describe.skip` registra las pruebas como omitidas sin abrir la app ni la BD.
const suite = RUN ? describe : describe.skip;

suite('Seguridad (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Reproducir el pipe global de main.ts (whitelist activo).
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  const server = () => app.getHttpServer();

  // ── BFLA: mutaciones de datos maestros/precios exigen admin ────────────────
  describe('Rechazo de anónimos en mutaciones protegidas (AdminGuard)', () => {
    it('POST /membresias sin token → 401', async () => {
      await request(server())
        .post('/membresias')
        .send({ nombre: 'Hack', precio: 0 })
        .expect(401);
    });

    it('PUT /membresias/1 sin token → 401 (no se pueden alterar precios)', async () => {
      await request(server())
        .put('/membresias/1')
        .send({ precio: 0 })
        .expect(401);
    });

    it('DELETE /membresias/1 sin token → 401', async () => {
      await request(server()).delete('/membresias/1').expect(401);
    });

    it('POST /ciudades sin token → 401 (no se corrompen catálogos)', async () => {
      await request(server())
        .post('/ciudades')
        .send({ nombre: 'Ciudad Falsa' })
        .expect(401);
    });

    it('DELETE /ciudades/1 sin token → 401', async () => {
      await request(server()).delete('/ciudades/1').expect(401);
    });
  });

  // ── IDOR/Autenticación: datos fiscales y de pago ───────────────────────────
  describe('Datos fiscales y de pago exigen autenticación (JwtAuthGuard)', () => {
    it('GET /facturas sin token → 401', async () => {
      await request(server()).get('/facturas').expect(401);
    });

    it('POST /facturas/solicitar sin token → 401', async () => {
      await request(server())
        .post('/facturas/solicitar')
        .send({})
        .expect(401);
    });

    it('GET /pagos sin token → 401', async () => {
      await request(server()).get('/pagos').expect(401);
    });

    it('DELETE /pagos/metodos/pm_test sin token → 401 (no se desvinculan tarjetas ajenas)', async () => {
      await request(server())
        .delete('/pagos/metodos/pm_test')
        .expect(401);
    });

    it('un JWT inválido/manipulado también es rechazado → 401', async () => {
      await request(server())
        .get('/facturas')
        .set('Authorization', 'Bearer no.es.un.jwt')
        .expect(401);
    });
  });

  // ── OTP end-to-end (JLP-M28) ───────────────────────────────────────────────
  describe('Verificación de OTP (JLP-M28)', () => {
    it('verify-otp con código inexistente → 401 (no autentica sin OTP válido)', async () => {
      await request(server())
        .post('/auth/verify-otp')
        .send({ phoneNumber: '5599999999', code: '000000' })
        .expect(401);
    });

    it('otp/email/verify con código inexistente → 401 (no resetea contraseña)', async () => {
      await request(server())
        .post('/auth/otp/email/verify')
        .send({
          correoElectronico: 'no-existe@example.com',
          codigo: '000000',
          nuevaContrasena: 'ClaveSegura123',
        })
        .expect(401);
    });
  });

  // ── IDOR entre usuarios (requiere tokens de staging) ───────────────────────
  const TOKEN_A = process.env.SEC_E2E_TOKEN_A;
  const TOKEN_B = process.env.SEC_E2E_TOKEN_B;
  const FACTURA_B = process.env.SEC_E2E_FACTURA_B_ID;
  const idorSuite = TOKEN_A && TOKEN_B && FACTURA_B ? describe : describe.skip;

  idorSuite('IDOR: el usuario A no accede a recursos del usuario B', () => {
    it('GET /facturas/:idDeB con token de A → 403/404 (no expone RFC/razón social ajenos)', async () => {
      const res = await request(server())
        .get(`/facturas/${FACTURA_B}`)
        .set('Authorization', `Bearer ${TOKEN_A}`);
      expect([403, 404]).toContain(res.status);
    });

    it('GET /pagos con token de A no devuelve pagos de B', async () => {
      const res = await request(server())
        .get('/pagos')
        .set('Authorization', `Bearer ${TOKEN_A}`)
        .expect(200);
      // Ningún registro debe pertenecer a otro suscriptor.
      const items = Array.isArray(res.body) ? res.body : res.body?.data ?? [];
      for (const p of items) {
        if (p?.suscriptorId != null) {
          expect(String(p.suscriptorId)).not.toEqual(
            process.env.SEC_E2E_SUSCRIPTOR_B_ID,
          );
        }
      }
    });
  });
});
