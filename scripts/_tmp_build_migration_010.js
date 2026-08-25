const fs = require('fs');
const mysql = require('mysql2/promise');

function normalizeText(text) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function esc(s) {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "''");
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Same classification logic used for migration 009, with explicit-name-prefix
// checked first (fixes earlier bug where e.g. "Calle Playa Bucerías" got
// misclassified as Avenida via the highway-tag fallback).
function inferTipo(name, highwayTag) {
  if (/^(avenida|av\.?)\s/i.test(name)) return 'Avenida';
  if (/^(calle)\s/i.test(name)) return 'Calle';
  if (/^(privada|priv\.?)\s/i.test(name)) return 'Privada';
  if (/^(cerrada)\s/i.test(name)) return 'Cerrada';
  if (/^(andador)\s/i.test(name)) return 'Andador';
  if (/^(bulevar|boulevard|blvd\.?)\s/i.test(name)) return 'Bulevar';
  if (/^(prolongaci[oó]n)\s/i.test(name)) return 'Prolongación';
  if (/^(circuito)\s/i.test(name)) return 'Circuito';
  if (/^(callej[oó]n)\s/i.test(name)) return 'Callejón';
  if (/^(calzada)\s/i.test(name)) return 'Calzada';
  if (/^(peri[fé]erico|periférico)\s/i.test(name)) return 'Periférico';
  if (/^(retorno)\s/i.test(name)) return 'Retorno';
  if (/^(carretera|autopista|libramiento)\s/i.test(name)) return 'Carretera';
  switch (highwayTag) {
    case 'motorway':
    case 'trunk':
    case 'primary':
      return 'Bulevar';
    case 'secondary':
    case 'tertiary':
      return 'Avenida';
    case 'living_street':
    case 'pedestrian':
      return 'Andador';
    default:
      return 'Calle';
  }
}

function loadWays(path) {
  const data = JSON.parse(fs.readFileSync(path, 'utf8'));
  return data.elements.filter((w) => w.tags && w.tags.name && w.geometry && w.geometry.length);
}

async function main() {
  const geo = JSON.parse(fs.readFileSync('/tmp/geocode_results.json', 'utf8'));
  function isTrusted(g) {
    if (g.class === 'place') return true;
    if (g.class === 'landuse' && g.type === 'residential') return true;
    if (g.class === 'highway' && ['residential', 'tertiary', 'secondary', 'primary', 'unclassified', 'living_street', 'pedestrian'].includes(g.type)) return true;
    return false;
  }
  const matched = geo.filter((g) => g.lat != null && g.lon != null && isTrusted(g));
  console.log('Colonias geocodificadas con resultado CONFIABLE:', matched.length, '/', geo.length);
  console.log('(se descartaron matches tipo tienda/escuela/parque/etc. por no ser un proxy confiable de ubicacion)');

  const tepicWays = loadWays('/tmp/tepic_ways.json');
  const xaliscoWays = loadWays('/tmp/xalisco_ways.json');
  console.log('Ways tepic:', tepicWays.length, 'xalisco:', xaliscoWays.length);

  const RADIUS_M = 350;

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  });

  const [callesRows] = await conn.query('SELECT id, nombre, nombre_normalizado FROM calles');
  const calleIdByNorm = new Map();
  for (const r of callesRows) {
    calleIdByNorm.set(normalizeText(r.nombre), r.id);
  }
  console.log('Calles existentes en DB:', calleIdByNorm.size);

  // Also check for max radius sanity using boundingbox when it's small (point-like results)
  const matches = []; // {coloniaId, calles: [{nombre, tipo}]}
  let coloniasConCalle = 0;
  let totalCalleHits = 0;

  for (const g of matched) {
    const ways = g.ciudad === 'Tepic' ? tepicWays : xaliscoWays;
    const found = new Map(); // norm -> {nombre, tipo}
    for (const w of ways) {
      // distance = min distance from colonia point to any vertex of the way
      let minDist = Infinity;
      for (const pt of w.geometry) {
        const d = haversine(g.lat, g.lon, pt.lat, pt.lon);
        if (d < minDist) minDist = d;
        if (minDist <= RADIUS_M) break;
      }
      if (minDist <= RADIUS_M) {
        const norm = normalizeText(w.tags.name);
        if (!found.has(norm)) {
          found.set(norm, { nombre: w.tags.name, tipo: inferTipo(w.tags.name, w.tags.highway) });
        }
      }
    }
    if (found.size > 0) {
      coloniasConCalle++;
      totalCalleHits += found.size;
      matches.push({ coloniaId: g.id, coloniaNombre: g.nombre, ciudad: g.ciudad, calles: [...found.values()] });
    }
  }

  console.log('Colonias con >=1 calle encontrada dentro de', RADIUS_M, 'm:', coloniasConCalle);
  console.log('Total street-hits (con duplicados entre colonias):', totalCalleHits);

  fs.writeFileSync('/tmp/nominatim_match_results.json', JSON.stringify(matches, null, 2));

  // Build INSERT sql, same pattern as migration 009
  const newCallesInsertOrder = [];
  const seenNewNorm = new Set();
  const normToTipo = new Map();
  for (const m of matches) {
    for (const c of m.calles) {
      const norm = normalizeText(c.nombre);
      if (calleIdByNorm.has(norm)) continue;
      if (seenNewNorm.has(norm)) continue;
      seenNewNorm.add(norm);
      normToTipo.set(norm, c);
      newCallesInsertOrder.push(norm);
    }
  }
  console.log('Calles nuevas a insertar:', newCallesInsertOrder.length);

  const relations = [];
  const relSeen = new Set();
  for (const m of matches) {
    for (const c of m.calles) {
      const norm = normalizeText(c.nombre);
      const key = m.coloniaId + '|' + norm;
      if (relSeen.has(key)) continue;
      relSeen.add(key);
      relations.push({ coloniaId: m.coloniaId, norm });
    }
  }
  console.log('Relaciones calles_colonias a insertar:', relations.length);

  const coloniaIds = [...new Set(matches.map((m) => m.coloniaId))];
  console.log('Colonias a reactivar:', coloniaIds.length);

  const lines = [];
  lines.push('-- data_010_calles_nominatim_tepic_xalisco.sql');
  lines.push('-- Fuente: geocodificacion por nombre de colonia via Nominatim (OSM) + calles OSM');
  lines.push('-- (Overpass, ya descargadas) dentro de ' + RADIUS_M + 'm del punto geocodificado.');
  lines.push('-- Alcance: colonias de Tepic/Xalisco que quedaron inactivas tras la carga SEPOMEX +');
  lines.push('-- matching por vecindario OSM (migration 009). Complementa esa carga con geocoding');
  lines.push('-- directo por nombre de colonia, ya que Nominatim resuelve mas nombres que los');
  lines.push('-- nodos place=neighbourhood/suburb/quarter usados en 009.');
  lines.push('-- Generado ' + new Date().toISOString());
  lines.push('');
  lines.push('START TRANSACTION;');
  lines.push('');
  lines.push('-- ============================================');
  lines.push('-- 1) CALLES NUEVAS AL CATALOGO GLOBAL (' + newCallesInsertOrder.length + ')');
  lines.push('-- ============================================');
  for (const norm of newCallesInsertOrder) {
    const c = normToTipo.get(norm);
    lines.push(
      `INSERT INTO calles (nombre, nombre_normalizado, tipo_vialidad, activo) VALUES ('${esc(c.nombre)}', '${esc(norm)}', '${esc(c.tipo)}', 1);`,
    );
  }
  lines.push('');
  lines.push('-- ============================================');
  lines.push('-- 2) RELACIONES calles_colonias (' + relations.length + ')');
  lines.push('-- ============================================');
  for (const rel of relations) {
    lines.push(
      `INSERT INTO calles_colonias (calle_id, colonia_id, activo) SELECT id, ${rel.coloniaId}, 1 FROM calles WHERE nombre_normalizado = '${esc(rel.norm)}';`,
    );
  }
  lines.push('');
  lines.push('-- ============================================');
  lines.push('-- 3) REACTIVAR colonias que ya tienen al menos 1 calle (' + coloniaIds.length + ')');
  lines.push('-- ============================================');
  lines.push('UPDATE colonias SET activo = 1 WHERE id IN (' + coloniaIds.join(', ') + ');');
  lines.push('');
  lines.push('COMMIT;');
  lines.push('');

  fs.writeFileSync(
    '/Users/devherli16/Desktop/Proyectos/Jelpy/backend/jelpy-core-backend/migrations/data_010_calles_nominatim_tepic_xalisco.sql',
    lines.join('\n'),
  );
  console.log('Escrito migrations/data_010_calles_nominatim_tepic_xalisco.sql');

  await conn.end();
}

main();
