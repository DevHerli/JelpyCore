// JLP — serverStartedAt vivía en main.ts. HealthService lo importaba desde
// ahí (`import { serverStartedAt } from '../../../main'`), y como main.ts
// ejecuta `bootstrap()` a nivel de módulo (top-level `await`/llamada), CUALQUIER
// import de AppModule (incluidos los e2e con @nestjs/testing, que NO deberían
// levantar un servidor HTTP real) arrastraba ese bootstrap y rompía la prueba.
// Se extrae a este archivo, sin efectos secundarios, para poder importar
// AppModule (y por tanto HealthService) sin disparar main.ts.
export const serverStartedAt = new Date();
