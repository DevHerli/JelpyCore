/**
 * Auditoría entity-vs-schema.
 *
 * Compara TODAS las entidades de TypeORM (compiladas en dist/) contra el
 * esquema REAL de la base. Busca la clase de errores que sólo aparecen en
 * runtime y tumban un endpoint entero:
 *
 *   [CRITICO] tabla inexistente        -> ER_NO_SUCH_TABLE (1146)
 *   [CRITICO] columna en entity, no en BD -> ER_BAD_FIELD_ERROR (1054)
 *   [ALTO]    columna NOT NULL sin default y sin equivalente en entity -> INSERT falla
 *   [MEDIO]   entity dice nullable:false pero la BD permite NULL (y viceversa)
 *   [MEDIO]   valores de ENUM que la entity declara y la BD no acepta
 *   [INFO]    columna en BD que la entity ignora (inofensivo)
 *
 * NO modifica nada. Sólo lee information_schema.
 *
 * ── USO ────────────────────────────────────────────────────────────────────
 *   npm run build                  # imprescindible: audita dist/, no src/
 *   node scripts/audit-schema.js
 *
 * Lee las credenciales del .env del proyecto (DB_HOST, DB_PORT, DB_USER,
 * DB_PASS, DB_NAME). Para auditar otra base sin tocar el .env:
 *
 *   DB_NAME=otra_base node scripts/audit-schema.js
 *
 * NUNCA escribir credenciales dentro de este archivo: se versiona en git.
 *
 * Termina con código de salida 2 si hay hallazgos CRITICO o ALTO, para poder
 * encadenarlo en un pipeline y frenar un deploy antes de que rompa producción.
 *
 * ── POR QUÉ EXISTE ─────────────────────────────────────────────────────────
 * Con DB_SYNC=false en producción, TypeORM no sincroniza el esquema: si una
 * entity y su tabla se separan, nada avisa hasta que un usuario pega en el
 * endpoint y recibe un 500. Así se llegó a producción con /membresias,
 * /facturas y /ventas/membresias caídos al mismo tiempo. Correr esto antes de
 * cada deploy convierte ese 500 en un error de build.
 */
require('reflect-metadata');
const path = require('path');
const fs = require('fs');
const { DataSource } = require('typeorm');

// Carga el .env sin depender de dotenv (puede no estar disponible en runtime).
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const linea of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = linea.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    // Las variables ya presentes en el entorno mandan sobre el .env.
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
}

const RESET = '\x1b[0m', RED = '\x1b[31m', YEL = '\x1b[33m', GRN = '\x1b[32m', DIM = '\x1b[2m', BOLD = '\x1b[1m';

(async () => {
  const ds = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306', 10),
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    entities: [path.join(__dirname, '..', 'dist', '**', '*.entity.js')],
    synchronize: false,
    logging: false,
  });

  await ds.initialize();
  const [{ b: dbName }] = await ds.query('SELECT DATABASE() AS b');
  console.log(`${BOLD}BASE AUDITADA:${RESET} ${dbName}`);

  // Esquema real, de un solo golpe.
  const rawCols = await ds.query(`
    SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, DATA_TYPE, IS_NULLABLE,
           COLUMN_DEFAULT, EXTRA
      FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()`);
  const rawTables = await ds.query(`
    SELECT TABLE_NAME FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'`);

  const dbTables = new Set(rawTables.map((t) => t.TABLE_NAME));
  const dbCols = new Map(); // tabla -> Map(columna -> info)
  for (const c of rawCols) {
    if (!dbCols.has(c.TABLE_NAME)) dbCols.set(c.TABLE_NAME, new Map());
    dbCols.get(c.TABLE_NAME).set(c.COLUMN_NAME, c);
  }

  const findings = { CRITICO: [], ALTO: [], MEDIO: [], INFO: [] };
  const add = (sev, entity, table, msg) => findings[sev].push({ entity, table, msg });

  const entidadesOk = [];

  for (const meta of ds.entityMetadatas) {
    const table = meta.tableName;
    const entity = meta.name;

    if (!dbTables.has(table)) {
      add('CRITICO', entity, table,
        `la tabla NO EXISTE en la base. Cualquier consulta a ${entity} revienta con ER_NO_SUCH_TABLE (1146).`);
      continue;
    }

    const cols = dbCols.get(table) || new Map();
    const entityColNames = new Set();
    let limpia = true;

    for (const col of meta.columns) {
      const name = col.databaseName;
      entityColNames.add(name);
      const real = cols.get(name);

      if (!real) {
        add('CRITICO', entity, table,
          `la entity declara la columna "${name}" y la BD no la tiene. ` +
          `findOne()/find() piden todas las columnas -> ER_BAD_FIELD_ERROR (1054).`);
        limpia = false;
        continue;
      }

      // Nullabilidad
      const dbNullable = real.IS_NULLABLE === 'YES';
      if (col.isNullable && !dbNullable && real.COLUMN_DEFAULT === null && !/auto_increment/i.test(real.EXTRA || '')) {
        add('MEDIO', entity, table,
          `"${name}": la entity la marca nullable pero en la BD es NOT NULL sin default. ` +
          `Guardar sin ese valor lanza ER_NO_DEFAULT_FOR_FIELD (1364).`);
        limpia = false;
      }
      if (!col.isNullable && dbNullable && !col.isPrimary) {
        add('INFO', entity, table,
          `"${name}": la entity la asume obligatoria pero la BD acepta NULL. Filas viejas pueden traer NULL.`);
      }

      // ENUM: valores que la entity declara y la BD no acepta
      if (col.type === 'enum' && Array.isArray(col.enum) && /^enum/i.test(real.COLUMN_TYPE)) {
        const dbVals = (real.COLUMN_TYPE.match(/'((?:[^']|'')*)'/g) || [])
          .map((s) => s.slice(1, -1).replace(/''/g, "'"));
        const faltantes = col.enum.map(String).filter((v) => !dbVals.includes(v));
        if (faltantes.length) {
          add('ALTO', entity, table,
            `"${name}": la entity permite [${faltantes.join(', ')}] y la BD no. ` +
            `Guardar esos valores falla con ER_TRUNCATED_WRONG_VALUE (1265). BD acepta: [${dbVals.join(', ')}]`);
          limpia = false;
        }
      }
    }

    // Columnas obligatorias en BD que la entity ni conoce -> INSERT desde la app falla
    for (const [name, real] of cols) {
      if (entityColNames.has(name)) continue;
      const obligatoria = real.IS_NULLABLE === 'NO'
        && real.COLUMN_DEFAULT === null
        && !/auto_increment/i.test(real.EXTRA || '');
      if (obligatoria) {
        add('ALTO', entity, table,
          `la BD exige "${name}" (NOT NULL sin default) y la entity no la mapea. ` +
          `Todo INSERT de ${entity} desde la app falla con ER_NO_DEFAULT_FOR_FIELD (1364).`);
        limpia = false;
      } else {
        add('INFO', entity, table, `la BD tiene "${name}" y la entity la ignora (inofensivo).`);
      }
    }

    if (limpia) entidadesOk.push(`${entity} (${table})`);
  }

  await ds.destroy();

  // ── Reporte ──
  const sevColor = { CRITICO: RED, ALTO: RED, MEDIO: YEL, INFO: DIM };
  for (const sev of ['CRITICO', 'ALTO', 'MEDIO', 'INFO']) {
    const list = findings[sev];
    if (sev === 'INFO' && list.length) {
      console.log(`\n${DIM}── INFO: ${list.length} hallazgos inofensivos (omitidos del detalle) ──${RESET}`);
      continue;
    }
    if (!list.length) continue;
    console.log(`\n${sevColor[sev]}${BOLD}── ${sev}: ${list.length} ──${RESET}`);
    for (const f of list) {
      console.log(`${sevColor[sev]}  [${f.table}]${RESET} ${f.msg}`);
    }
  }

  console.log(`\n${BOLD}── RESUMEN ──${RESET}`);
  console.log(`  Entidades auditadas : ${ds.entityMetadatas.length}`);
  console.log(`  ${GRN}Sin problemas${RESET}       : ${entidadesOk.length}`);
  console.log(`  ${RED}CRITICO${RESET}             : ${findings.CRITICO.length}  (endpoint caído)`);
  console.log(`  ${RED}ALTO${RESET}                : ${findings.ALTO.length}  (escritura falla)`);
  console.log(`  ${YEL}MEDIO${RESET}               : ${findings.MEDIO.length}`);
  console.log(`  ${DIM}INFO${RESET}                : ${findings.INFO.length}`);

  process.exit(findings.CRITICO.length || findings.ALTO.length ? 2 : 0);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
