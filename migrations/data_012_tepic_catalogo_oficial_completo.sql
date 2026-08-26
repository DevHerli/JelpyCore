-- data_012_tepic_catalogo_oficial_completo.sql
-- Fuente: catálogo oficial CP+colonia/asentamiento de Tepic proporcionado directamente
-- por el usuario (dueño del catálogo geográfico). Objetivo: garantizar que TODOS los
-- CPs y colonias de esta lista existan en la BD, sin excepción.
--
-- CAMBIO DE POLÍTICA (temporal, por indicación explícita del usuario 2026-08-25):
-- se elimina el requisito de que una colonia tenga calles asociadas para poder
-- mostrarse (activo=1). A partir de ahora TODAS las colonias se muestran siempre,
-- independientemente de si tienen calles relacionadas o no. La relación calle<->colonia
-- deja de ser un gate de visibilidad mientras se sigue enriqueciendo el catálogo de calles.
-- Generado 2026-08-25T04:01:59.003Z

START TRANSACTION;

-- ============================================
-- 1) REACTIVAR TODAS las colonias existentes (sin importar si tienen calles)
-- ============================================
UPDATE colonias SET activo = 1 WHERE activo = 0;

-- ============================================
-- 2) CÓDIGOS POSTALES nuevos de Tepic (6)
-- ============================================
INSERT INTO codigos_postales (ciudad_id, codigo_postal, activo) SELECT 1, '63009', 1 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM codigos_postales WHERE ciudad_id = 1 AND codigo_postal = '63009');
INSERT INTO codigos_postales (ciudad_id, codigo_postal, activo) SELECT 1, '63147', 1 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM codigos_postales WHERE ciudad_id = 1 AND codigo_postal = '63147');
INSERT INTO codigos_postales (ciudad_id, codigo_postal, activo) SELECT 1, '63149', 1 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM codigos_postales WHERE ciudad_id = 1 AND codigo_postal = '63149');
INSERT INTO codigos_postales (ciudad_id, codigo_postal, activo) SELECT 1, '63189', 1 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM codigos_postales WHERE ciudad_id = 1 AND codigo_postal = '63189');
INSERT INTO codigos_postales (ciudad_id, codigo_postal, activo) SELECT 1, '63198', 1 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM codigos_postales WHERE ciudad_id = 1 AND codigo_postal = '63198');
INSERT INTO codigos_postales (ciudad_id, codigo_postal, activo) SELECT 1, '63199', 1 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM codigos_postales WHERE ciudad_id = 1 AND codigo_postal = '63199');

-- ============================================
-- 3) COLONIAS nuevas del catálogo oficial (calculado tras insertar CPs nuevos)
-- ============================================
INSERT INTO colonias (codigo_postal_id, nombre, nombre_normalizado, tipo_asentamiento, activo) SELECT cp.id, 'Centro SCT Nayarit', 'centro sct nayarit', 'Gran usuario', 1 FROM codigos_postales cp WHERE cp.ciudad_id = 1 AND cp.codigo_postal = '63009' AND NOT EXISTS (SELECT 1 FROM colonias c2 WHERE c2.codigo_postal_id = cp.id AND c2.nombre_normalizado = 'centro sct nayarit');
INSERT INTO colonias (codigo_postal_id, nombre, nombre_normalizado, tipo_asentamiento, activo) SELECT cp.id, 'Tulipanes', 'tulipanes', 'Fraccionamiento', 1 FROM codigos_postales cp WHERE cp.ciudad_id = 1 AND cp.codigo_postal = '63037' AND NOT EXISTS (SELECT 1 FROM colonias c2 WHERE c2.codigo_postal_id = cp.id AND c2.nombre_normalizado = 'tulipanes');
INSERT INTO colonias (codigo_postal_id, nombre, nombre_normalizado, tipo_asentamiento, activo) SELECT cp.id, 'Zapopan', 'zapopan', 'Fraccionamiento', 1 FROM codigos_postales cp WHERE cp.ciudad_id = 1 AND cp.codigo_postal = '63037' AND NOT EXISTS (SELECT 1 FROM colonias c2 WHERE c2.codigo_postal_id = cp.id AND c2.nombre_normalizado = 'zapopan');
INSERT INTO colonias (codigo_postal_id, nombre, nombre_normalizado, tipo_asentamiento, activo) SELECT cp.id, 'Social Progresivo Cuba', 'social progresivo cuba', 'Fraccionamiento', 1 FROM codigos_postales cp WHERE cp.ciudad_id = 1 AND cp.codigo_postal = '63039' AND NOT EXISTS (SELECT 1 FROM colonias c2 WHERE c2.codigo_postal_id = cp.id AND c2.nombre_normalizado = 'social progresivo cuba');
INSERT INTO colonias (codigo_postal_id, nombre, nombre_normalizado, tipo_asentamiento, activo) SELECT cp.id, 'Lomas del Valle Ampliación', 'lomas del valle ampliacion', 'Colonia', 1 FROM codigos_postales cp WHERE cp.ciudad_id = 1 AND cp.codigo_postal = '63066' AND NOT EXISTS (SELECT 1 FROM colonias c2 WHERE c2.codigo_postal_id = cp.id AND c2.nombre_normalizado = 'lomas del valle ampliacion');
INSERT INTO colonias (codigo_postal_id, nombre, nombre_normalizado, tipo_asentamiento, activo) SELECT cp.id, 'Ampliación Unidad Obrera', 'ampliacion unidad obrera', 'Colonia', 1 FROM codigos_postales cp WHERE cp.ciudad_id = 1 AND cp.codigo_postal = '63069' AND NOT EXISTS (SELECT 1 FROM colonias c2 WHERE c2.codigo_postal_id = cp.id AND c2.nombre_normalizado = 'ampliacion unidad obrera');
INSERT INTO colonias (codigo_postal_id, nombre, nombre_normalizado, tipo_asentamiento, activo) SELECT cp.id, 'Versalles Norte', 'versalles norte', 'Fraccionamiento', 1 FROM codigos_postales cp WHERE cp.ciudad_id = 1 AND cp.codigo_postal = '63139' AND NOT EXISTS (SELECT 1 FROM colonias c2 WHERE c2.codigo_postal_id = cp.id AND c2.nombre_normalizado = 'versalles norte');
INSERT INTO colonias (codigo_postal_id, nombre, nombre_normalizado, tipo_asentamiento, activo) SELECT cp.id, 'Secretaria de La Reforma Agraria', 'secretaria de la reforma agraria', 'Gran usuario', 1 FROM codigos_postales cp WHERE cp.ciudad_id = 1 AND cp.codigo_postal = '63147' AND NOT EXISTS (SELECT 1 FROM colonias c2 WHERE c2.codigo_postal_id = cp.id AND c2.nombre_normalizado = 'secretaria de la reforma agraria');
INSERT INTO colonias (codigo_postal_id, nombre, nombre_normalizado, tipo_asentamiento, activo) SELECT cp.id, 'Palacio de Gobierno del Estado de Nayarit', 'palacio de gobierno del estado de nayarit', 'Gran usuario', 1 FROM codigos_postales cp WHERE cp.ciudad_id = 1 AND cp.codigo_postal = '63149' AND NOT EXISTS (SELECT 1 FROM colonias c2 WHERE c2.codigo_postal_id = cp.id AND c2.nombre_normalizado = 'palacio de gobierno del estado de nayarit');
INSERT INTO colonias (codigo_postal_id, nombre, nombre_normalizado, tipo_asentamiento, activo) SELECT cp.id, 'Vistas de La Cantera Etapa 2', 'vistas de la cantera etapa 2', 'Fraccionamiento', 1 FROM codigos_postales cp WHERE cp.ciudad_id = 1 AND cp.codigo_postal = '63173' AND NOT EXISTS (SELECT 1 FROM colonias c2 WHERE c2.codigo_postal_id = cp.id AND c2.nombre_normalizado = 'vistas de la cantera etapa 2');
INSERT INTO colonias (codigo_postal_id, nombre, nombre_normalizado, tipo_asentamiento, activo) SELECT cp.id, '4 Milpas', '4 milpas', 'Colonia', 1 FROM codigos_postales cp WHERE cp.ciudad_id = 1 AND cp.codigo_postal = '63174' AND NOT EXISTS (SELECT 1 FROM colonias c2 WHERE c2.codigo_postal_id = cp.id AND c2.nombre_normalizado = '4 milpas');
INSERT INTO colonias (codigo_postal_id, nombre, nombre_normalizado, tipo_asentamiento, activo) SELECT cp.id, 'Dr. Cuesta Barrios', 'dr. cuesta barrios', 'Colonia', 1 FROM codigos_postales cp WHERE cp.ciudad_id = 1 AND cp.codigo_postal = '63175' AND NOT EXISTS (SELECT 1 FROM colonias c2 WHERE c2.codigo_postal_id = cp.id AND c2.nombre_normalizado = 'dr. cuesta barrios');
INSERT INTO colonias (codigo_postal_id, nombre, nombre_normalizado, tipo_asentamiento, activo) SELECT cp.id, 'Esteban Baca Calderón', 'esteban baca calderon', 'Unidad habitacional', 1 FROM codigos_postales cp WHERE cp.ciudad_id = 1 AND cp.codigo_postal = '63177' AND NOT EXISTS (SELECT 1 FROM colonias c2 WHERE c2.codigo_postal_id = cp.id AND c2.nombre_normalizado = 'esteban baca calderon');
INSERT INTO colonias (codigo_postal_id, nombre, nombre_normalizado, tipo_asentamiento, activo) SELECT cp.id, 'Universitario (AGEUAN)', 'universitario (ageuan)', 'Fraccionamiento', 1 FROM codigos_postales cp WHERE cp.ciudad_id = 1 AND cp.codigo_postal = '63177' AND NOT EXISTS (SELECT 1 FROM colonias c2 WHERE c2.codigo_postal_id = cp.id AND c2.nombre_normalizado = 'universitario (ageuan)');
INSERT INTO colonias (codigo_postal_id, nombre, nombre_normalizado, tipo_asentamiento, activo) SELECT cp.id, 'Gardenias', 'gardenias', 'Colonia', 1 FROM codigos_postales cp WHERE cp.ciudad_id = 1 AND cp.codigo_postal = '63184' AND NOT EXISTS (SELECT 1 FROM colonias c2 WHERE c2.codigo_postal_id = cp.id AND c2.nombre_normalizado = 'gardenias');
INSERT INTO colonias (codigo_postal_id, nombre, nombre_normalizado, tipo_asentamiento, activo) SELECT cp.id, 'El 8', 'el 8', 'Fraccionamiento', 1 FROM codigos_postales cp WHERE cp.ciudad_id = 1 AND cp.codigo_postal = '63185' AND NOT EXISTS (SELECT 1 FROM colonias c2 WHERE c2.codigo_postal_id = cp.id AND c2.nombre_normalizado = 'el 8');
INSERT INTO colonias (codigo_postal_id, nombre, nombre_normalizado, tipo_asentamiento, activo) SELECT cp.id, 'Predio San Martín', 'predio san martin', 'Colonia', 1 FROM codigos_postales cp WHERE cp.ciudad_id = 1 AND cp.codigo_postal = '63186' AND NOT EXISTS (SELECT 1 FROM colonias c2 WHERE c2.codigo_postal_id = cp.id AND c2.nombre_normalizado = 'predio san martin');
INSERT INTO colonias (codigo_postal_id, nombre, nombre_normalizado, tipo_asentamiento, activo) SELECT cp.id, 'Labores de Godínez', 'labores de godinez', 'Colonia', 1 FROM codigos_postales cp WHERE cp.ciudad_id = 1 AND cp.codigo_postal = '63189' AND NOT EXISTS (SELECT 1 FROM colonias c2 WHERE c2.codigo_postal_id = cp.id AND c2.nombre_normalizado = 'labores de godinez');
INSERT INTO colonias (codigo_postal_id, nombre, nombre_normalizado, tipo_asentamiento, activo) SELECT cp.id, 'El Guayabo', 'el guayabo', 'Colonia', 1 FROM codigos_postales cp WHERE cp.ciudad_id = 1 AND cp.codigo_postal = '63196' AND NOT EXISTS (SELECT 1 FROM colonias c2 WHERE c2.codigo_postal_id = cp.id AND c2.nombre_normalizado = 'el guayabo');
INSERT INTO colonias (codigo_postal_id, nombre, nombre_normalizado, tipo_asentamiento, activo) SELECT cp.id, 'Tabacos Aztecas', 'tabacos aztecas', 'Colonia', 1 FROM codigos_postales cp WHERE cp.ciudad_id = 1 AND cp.codigo_postal = '63197' AND NOT EXISTS (SELECT 1 FROM colonias c2 WHERE c2.codigo_postal_id = cp.id AND c2.nombre_normalizado = 'tabacos aztecas');
INSERT INTO colonias (codigo_postal_id, nombre, nombre_normalizado, tipo_asentamiento, activo) SELECT cp.id, 'Villas de La Paz', 'villas de la paz', 'Fraccionamiento', 1 FROM codigos_postales cp WHERE cp.ciudad_id = 1 AND cp.codigo_postal = '63198' AND NOT EXISTS (SELECT 1 FROM colonias c2 WHERE c2.codigo_postal_id = cp.id AND c2.nombre_normalizado = 'villas de la paz');
INSERT INTO colonias (codigo_postal_id, nombre, nombre_normalizado, tipo_asentamiento, activo) SELECT cp.id, 'José María Martínez (El Molino)', 'jose maria martinez (el molino)', 'Colonia', 1 FROM codigos_postales cp WHERE cp.ciudad_id = 1 AND cp.codigo_postal = '63199' AND NOT EXISTS (SELECT 1 FROM colonias c2 WHERE c2.codigo_postal_id = cp.id AND c2.nombre_normalizado = 'jose maria martinez (el molino)');

COMMIT;
