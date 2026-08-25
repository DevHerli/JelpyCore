-- data_011_calles_inegi_tepic_xalisco.sql
-- Fuente: INEGI Marco Geoestadistico (diciembre 2025), capa oficial de Vialidades
-- (https://gaia.inegi.org.mx/wscatgeo/v2/geo/vialidades/{ent}/{mun}), geometria real de
-- ejes de calle con nombre oficial. Se asocian a colonias usando el mismo centro de
-- barrio ya calculado (OSM place=neighbourhood/suburb/quarter + geocoding Nominatim
-- confiable de migraciones 009/010), buscando vialidades INEGI dentro de 350m.
-- Generado 2026-08-25T02:00:08.975Z

START TRANSACTION;

-- ============================================
-- 1) CALLES NUEVAS AL CATALOGO GLOBAL (9)
-- ============================================
INSERT INTO calles (nombre, nombre_normalizado, tipo_vialidad, activo) VALUES ('Tepic', 'tepic', 'Calle', 1);
INSERT INTO calles (nombre, nombre_normalizado, tipo_vialidad, activo) VALUES ('Estatal Libre ND Caleras de Cofrados-Francisco I. Madero (Puga)', 'estatal libre nd caleras de cofrados-francisco i. madero (puga)', 'Carretera', 1);
INSERT INTO calles (nombre, nombre_normalizado, tipo_vialidad, activo) VALUES ('Ixtlán', 'ixtlan', 'Calle', 1);
INSERT INTO calles (nombre, nombre_normalizado, tipo_vialidad, activo) VALUES ('Lázaro Cárdenas', 'lazaro cardenas', 'Calle', 1);
INSERT INTO calles (nombre, nombre_normalizado, tipo_vialidad, activo) VALUES ('Benito Juárez', 'benito juarez', 'Calle', 1);
INSERT INTO calles (nombre, nombre_normalizado, tipo_vialidad, activo) VALUES ('Compostela', 'compostela', 'Calle', 1);
INSERT INTO calles (nombre, nombre_normalizado, tipo_vialidad, activo) VALUES ('Municipal Libre ND Las Pilas (El Tepehuaje)-Los Salazares', 'municipal libre nd las pilas (el tepehuaje)-los salazares', 'Carretera', 1);
INSERT INTO calles (nombre, nombre_normalizado, tipo_vialidad, activo) VALUES ('Municipal Libre ND Los Salazares-El Jicote', 'municipal libre nd los salazares-el jicote', 'Carretera', 1);
INSERT INTO calles (nombre, nombre_normalizado, tipo_vialidad, activo) VALUES ('Estatal Libre ND Santiago de Pochotitán-Francisco I. Madero (Puga)', 'estatal libre nd santiago de pochotitan-francisco i. madero (puga)', 'Carretera', 1);

-- ============================================
-- 2) RELACIONES calles_colonias (18)
-- ============================================
INSERT INTO calles_colonias (calle_id, colonia_id, activo) SELECT id, 379, 1 FROM calles WHERE nombre_normalizado = 'tepic';
INSERT INTO calles_colonias (calle_id, colonia_id, activo) SELECT id, 379, 1 FROM calles WHERE nombre_normalizado = 'estatal libre nd caleras de cofrados-francisco i. madero (puga)';
INSERT INTO calles_colonias (calle_id, colonia_id, activo) SELECT id, 379, 1 FROM calles WHERE nombre_normalizado = 'ixtlan';
INSERT INTO calles_colonias (calle_id, colonia_id, activo) SELECT id, 379, 1 FROM calles WHERE nombre_normalizado = 'mexico';
INSERT INTO calles_colonias (calle_id, colonia_id, activo) SELECT id, 379, 1 FROM calles WHERE nombre_normalizado = 'lazaro cardenas';
INSERT INTO calles_colonias (calle_id, colonia_id, activo) SELECT id, 379, 1 FROM calles WHERE nombre_normalizado = 'xalisco';
INSERT INTO calles_colonias (calle_id, colonia_id, activo) SELECT id, 379, 1 FROM calles WHERE nombre_normalizado = 'benito juarez';
INSERT INTO calles_colonias (calle_id, colonia_id, activo) SELECT id, 379, 1 FROM calles WHERE nombre_normalizado = 'compostela';
INSERT INTO calles_colonias (calle_id, colonia_id, activo) SELECT id, 379, 1 FROM calles WHERE nombre_normalizado = 'sauce';
INSERT INTO calles_colonias (calle_id, colonia_id, activo) SELECT id, 379, 1 FROM calles WHERE nombre_normalizado = 'acaponeta';
INSERT INTO calles_colonias (calle_id, colonia_id, activo) SELECT id, 379, 1 FROM calles WHERE nombre_normalizado = 'vicente guerrero';
INSERT INTO calles_colonias (calle_id, colonia_id, activo) SELECT id, 379, 1 FROM calles WHERE nombre_normalizado = 'emiliano zapata';
INSERT INTO calles_colonias (calle_id, colonia_id, activo) SELECT id, 379, 1 FROM calles WHERE nombre_normalizado = 'francisco villa';
INSERT INTO calles_colonias (calle_id, colonia_id, activo) SELECT id, 363, 1 FROM calles WHERE nombre_normalizado = 'municipal libre nd las pilas (el tepehuaje)-los salazares';
INSERT INTO calles_colonias (calle_id, colonia_id, activo) SELECT id, 363, 1 FROM calles WHERE nombre_normalizado = 'municipal libre nd los salazares-el jicote';
INSERT INTO calles_colonias (calle_id, colonia_id, activo) SELECT id, 330, 1 FROM calles WHERE nombre_normalizado = 'estatal libre nd santiago de pochotitan-francisco i. madero (puga)';
INSERT INTO calles_colonias (calle_id, colonia_id, activo) SELECT id, 446, 1 FROM calles WHERE nombre_normalizado = 'nayarit';
INSERT INTO calles_colonias (calle_id, colonia_id, activo) SELECT id, 446, 1 FROM calles WHERE nombre_normalizado = 'mexico';

-- ============================================
-- 3) REACTIVAR colonias que ya tienen al menos 1 calle (4)
-- ============================================
UPDATE colonias SET activo = 1 WHERE id IN (379, 363, 330, 446);

COMMIT;
