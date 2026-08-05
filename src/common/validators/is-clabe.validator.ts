/**
 * Validador personalizado de CLABE Interbancaria (18 dígitos).
 *
 * Algoritmo oficial SAT/Banxico:
 *  1. Los primeros 17 dígitos se multiplican por los pesos [3,7,1] en ciclo.
 *  2. Se suman los resultados, cada uno módulo 10.
 *  3. Dígito verificador = (10 - (suma % 10)) % 10.
 *  4. Debe coincidir con el dígito 18 del número.
 *
 * Ref: https://www.banxico.org.mx/clabe-portabilidad-bancaría/
 */
import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

const CLABE_WEIGHTS = [3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7];

function verificarClabe(clabe: string): boolean {
  if (!/^\d{18}$/.test(clabe)) return false;

  const digits = clabe.split('').map(Number);

  const suma = CLABE_WEIGHTS.reduce(
    (acc, peso, i) => acc + ((digits[i] * peso) % 10),
    0,
  );

  const digitoCalculado = (10 - (suma % 10)) % 10;
  return digitoCalculado === digits[17];
}

@ValidatorConstraint({ name: 'IsClabe', async: false })
export class IsClabeConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    return verificarClabe(value);
  }

  defaultMessage(): string {
    return 'CLABE inválida: debe tener 18 dígitos con dígito verificador correcto.';
  }
}

/**
 * Decorador para usar en DTOs:
 *
 * @example
 * @IsClabe()
 * clabe: string;
 */
export function IsClabe(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsClabeConstraint,
    });
  };
}
