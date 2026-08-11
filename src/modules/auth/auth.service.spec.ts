import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

/**
 * JLP-M28 — Regresión del endurecimiento de OTP.
 *
 * Objetivo: verificar que el cambio de `Math.random()` → `crypto.randomInt`
 * y la introducción del límite de intentos NO rompen el camino feliz
 * (login/registro por OTP siguen funcionando) y que las nuevas defensas
 * (código de 6 dígitos, incremento de intentos, bloqueo al máximo) se aplican.
 *
 * No requiere base de datos: todos los repositorios están mockeados.
 */

type AnyFn = jest.Mock;

/** QueryBuilder encadenable mínimo para las rutas de invalidación de OTP. */
function makeQb() {
  const qb: any = {};
  ['update', 'set', 'where', 'andWhere'].forEach((m) => {
    qb[m] = jest.fn(() => qb);
  });
  qb.execute = jest.fn().mockResolvedValue({});
  return qb;
}

function futureDate() {
  return new Date(Date.now() + 5 * 60 * 1000);
}

describe('AuthService — OTP hardening (JLP-M28)', () => {
  let service: AuthService;
  let otpRepo: Record<string, AnyFn>;
  let suscriptorRepo: Record<string, AnyFn>;
  let jwtService: Record<string, AnyFn>;
  let configService: Record<string, AnyFn>;
  let mailService: Record<string, AnyFn>;

  beforeEach(() => {
    otpRepo = {
      findOne: jest.fn(),
      save: jest.fn((x) => Promise.resolve(x)),
      create: jest.fn((x) => x),
      createQueryBuilder: jest.fn(() => makeQb()),
    };
    suscriptorRepo = {
      findOne: jest.fn(),
      save: jest.fn((x) => Promise.resolve({ id: 1, ...x })),
      create: jest.fn((x) => x),
      update: jest.fn(() => Promise.resolve({})),
      createQueryBuilder: jest.fn(() => makeQb()),
    };
    jwtService = { sign: jest.fn(() => 'signed.jwt.token'), verify: jest.fn() };
    configService = { get: jest.fn(() => undefined) };
    mailService = { sendOtp: jest.fn(() => Promise.resolve()) };

    service = new AuthService(
      otpRepo as any,
      suscriptorRepo as any,
      jwtService as any,
      configService as any,
      mailService as any,
    );
  });

  describe('generación de código (sendOtp)', () => {
    it('genera un OTP numérico de exactamente 6 dígitos y no lo registra en logs', async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await service.sendOtp({ phoneNumber: '5512345678' } as any);

      // El código persistido debe ser 6 dígitos (rango 100000-999999).
      expect(otpRepo.save).toHaveBeenCalledTimes(1);
      const saved = otpRepo.create.mock.calls[0][0];
      expect(saved.codigo).toMatch(/^\d{6}$/);
      const n = Number(saved.codigo);
      expect(n).toBeGreaterThanOrEqual(100000);
      expect(n).toBeLessThanOrEqual(999999);

      // JLP-M28: ya no debe filtrarse el OTP por consola.
      expect(logSpy).not.toHaveBeenCalled();
      logSpy.mockRestore();
    });

    it('invalida códigos activos previos del mismo teléfono antes de emitir uno nuevo', async () => {
      const qb = makeQb();
      otpRepo.createQueryBuilder.mockReturnValueOnce(qb);

      await service.sendOtp({ phoneNumber: '5512345678' } as any);

      expect(otpRepo.createQueryBuilder).toHaveBeenCalled();
      expect(qb.execute).toHaveBeenCalled();
    });

    it('produce códigos distintos en llamadas sucesivas (CSPRNG, no constante)', async () => {
      await service.sendOtp({ phoneNumber: '5512345678' } as any);
      await service.sendOtp({ phoneNumber: '5512345678' } as any);
      const c1 = otpRepo.create.mock.calls[0][0].codigo;
      const c2 = otpRepo.create.mock.calls[1][0].codigo;
      expect(c1).toMatch(/^\d{6}$/);
      expect(c2).toMatch(/^\d{6}$/);
      // No es una garantía absoluta, pero una colisión sería 1 en 900k.
      expect(c1).not.toEqual(c2);
    });
  });

  describe('verificación con límite de intentos (verifyOtp)', () => {
    it('camino feliz: código correcto y vigente → marca usado y emite tokens', async () => {
      const otp = {
        id: 10,
        telefonoCelular: '5512345678',
        codigo: '123456',
        usado: false,
        intentos: 0,
        expiracion: futureDate(),
      };
      otpRepo.findOne.mockResolvedValue(otp);
      suscriptorRepo.findOne.mockResolvedValue({
        id: 1,
        telefonoCelular: '5512345678',
        nombre: 'Ana',
        apellidoPaterno: 'García',
        registroCompleto: true,
        tieneNegocios: false,
      });

      const res = await service.verifyOtp({
        phoneNumber: '5512345678',
        code: '123456',
      } as any);

      expect(otp.usado).toBe(true);
      expect(res.success).toBe(true);
      expect(res.access_token).toBe('signed.jwt.token');
      expect(res.refresh_token).toBe('signed.jwt.token');
    });

    it('código incorrecto → incrementa intentos y lanza Unauthorized', async () => {
      const otp = {
        id: 11,
        telefonoCelular: '5512345678',
        codigo: '123456',
        usado: false,
        intentos: 0,
        expiracion: futureDate(),
      };
      otpRepo.findOne.mockResolvedValue(otp);

      await expect(
        service.verifyOtp({ phoneNumber: '5512345678', code: '000000' } as any),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(otp.intentos).toBe(1);
      expect(otp.usado).toBe(false); // aún no alcanza el máximo
      expect(otpRepo.save).toHaveBeenCalledWith(otp);
    });

    it('último intento fallido (4→5) bloquea el código marcándolo usado', async () => {
      const otp = {
        id: 12,
        telefonoCelular: '5512345678',
        codigo: '123456',
        usado: false,
        intentos: 4,
        expiracion: futureDate(),
      };
      otpRepo.findOne.mockResolvedValue(otp);

      await expect(
        service.verifyOtp({ phoneNumber: '5512345678', code: '999999' } as any),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(otp.intentos).toBe(5);
      expect(otp.usado).toBe(true); // bloqueado
    });

    it('código ya bloqueado (intentos>=máximo) → rechaza aunque el código sea correcto', async () => {
      const otp = {
        id: 13,
        telefonoCelular: '5512345678',
        codigo: '123456',
        usado: false,
        intentos: 5,
        expiracion: futureDate(),
      };
      otpRepo.findOne.mockResolvedValue(otp);

      await expect(
        service.verifyOtp({ phoneNumber: '5512345678', code: '123456' } as any),
      ).rejects.toThrow(/Demasiados intentos/);

      expect(otp.usado).toBe(true);
      // No debe emitir tokens.
      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it('sin OTP activo (inexistente o expirado) → Unauthorized', async () => {
      otpRepo.findOne.mockResolvedValue(null);

      await expect(
        service.verifyOtp({ phoneNumber: '5512345678', code: '123456' } as any),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('recuperación de contraseña (verifyOtpEmail)', () => {
    it('camino feliz: código correcto → actualiza contraseña y consume el OTP', async () => {
      const otp = {
        id: 20,
        correoElectronico: 'user@example.com',
        codigo: '654321',
        usado: false,
        intentos: 0,
        expiracion: futureDate(),
      };
      otpRepo.findOne.mockResolvedValue(otp);
      suscriptorRepo.findOne.mockResolvedValue({ id: 7, correoElectronico: 'user@example.com' });

      const res = await service.verifyOtpEmail({
        correoElectronico: 'user@example.com',
        codigo: '654321',
        nuevaContrasena: 'NuevaClave123',
      } as any);

      expect(res.success).toBe(true);
      expect(otp.usado).toBe(true);
      // Debe persistir la nueva contraseña (hasheada) del suscriptor 7.
      expect(suscriptorRepo.update).toHaveBeenCalledWith(7, expect.objectContaining({
        contrasena: expect.any(String),
      }));
    });

    it('código incorrecto → incrementa intentos y no cambia la contraseña', async () => {
      const otp = {
        id: 21,
        correoElectronico: 'user@example.com',
        codigo: '654321',
        usado: false,
        intentos: 0,
        expiracion: futureDate(),
      };
      otpRepo.findOne.mockResolvedValue(otp);

      await expect(
        service.verifyOtpEmail({
          correoElectronico: 'user@example.com',
          codigo: '000000',
          nuevaContrasena: 'NuevaClave123',
        } as any),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(otp.intentos).toBe(1);
      expect(suscriptorRepo.update).not.toHaveBeenCalled();
    });
  });
});
