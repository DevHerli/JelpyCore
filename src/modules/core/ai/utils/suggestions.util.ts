/**
 * SugerenciasUtil — Sugerencias contextuales post-búsqueda.
 *
 * Estrategia anti-ciclo (doble capa):
 *  1. yaUsadas  : strings ya mostrados en turnos anteriores (historial de sesión).
 *  2. Auto-excluir el texto que el usuario acaba de enviar (inyectado en ai.service.ts).
 *     Así, si el usuario tocó la sugerencia A, A no vuelve a aparecer aunque la sesión
 *     no sea persistente.
 *  3. Pool contextual por categoría/subcategoría → las sugerencias son ESPECÍFICAS
 *     al negocio buscado (no genéricas que se sienten iguales).
 *  4. Fallback genérico reducido y sin duplicados semánticos cuando no hay match.
 */
export class SugerenciasUtil {

  static generar(
    filtros: {
      categoriaId?: number | null;
      subcategoriaId?: number | null;
      categoriaHint?: string;
      subcategoriaHint?: string;
      caracteristica?: string | null;
      caracteristicaAliases?: string[];
    },
    items: any[],
    ciudad: string,
    yaUsadas: string[] = [],
  ): string[] {
    const ciudadNombre = ciudad || 'tu ciudad';

    // Sin resultados → sugerencias de recuperación
    if (!items || items.length === 0) {
      return this.filtrar([
        '¿Quieres intentar con otra palabra?',
        `¿Buscas algo diferente en ${ciudadNombre}?`,
        '¿Quieres ampliar la búsqueda a otra categoría?',
        '¿Quieres buscar en otra ciudad?',
      ], yaUsadas, 2);
    }

    const norm = (s: string) =>
      (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const sub = norm(filtros.subcategoriaHint ?? '');
    const cat = norm(filtros.categoriaHint ?? '');
    const car = norm(filtros.caracteristica ?? '');

    // Obtener pool contextual
    const pool = this.obtenerPool(sub, cat, car, ciudadNombre, items);

    // Filtrar yaUsadas
    const disponibles = pool.filter((s) => !yaUsadas.includes(s));

    // Si el pool de la categoría se agotó, usar genéricas filtradas
    if (disponibles.length < 2) {
      const genericas = this.genericasFallback(ciudadNombre)
        .filter((s) => !yaUsadas.includes(s));
      const combinado = [...disponibles, ...genericas];
      return this.mezclar(combinado).slice(0, 2);
    }

    return this.mezclar(disponibles).slice(0, 2);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // POOLS CONTEXTUALES POR CATEGORÍA
  // ─────────────────────────────────────────────────────────────────────────────
  private static obtenerPool(
    sub: string,
    cat: string,
    car: string,
    ciudad: string,
    items: any[],
  ): string[] {

    // ── SALUD ────────────────────────────────────────────────────────────────

    if (sub.includes('farmacia')) {
      return [
        '¿Buscas farmacia de turno 24 horas?',
        '¿También necesitas un médico cerca?',
        '¿Quieres ver cuáles tienen medicamentos genéricos?',
        '¿Buscas farmacia con envío a domicilio?',
        '¿Necesitas algún medicamento específico?',
        '¿Quieres ver la más cercana a ti?',
      ];
    }

    if (sub.includes('hospital') || sub.includes('clinica') || sub.includes('sanatorio') || sub.includes('nosocomio')) {
      return [
        '¿Buscas hospital con urgencias 24 horas?',
        '¿Quieres ver cuáles tienen seguro médico?',
        '¿Buscas alguna especialidad médica?',
        '¿Quieres ver los hospitales más cercanos?',
        '¿Buscas clínica privada o pública?',
        `¿Hay algún hospital específico que busques en ${ciudad}?`,
      ];
    }

    if (sub.includes('doctor') || sub.includes('medico') || sub.includes('medicina general') || sub.includes('consultor')) {
      return [
        '¿También necesitas una farmacia cercana?',
        '¿Quieres ver médicos a domicilio?',
        '¿Buscas alguna especialidad médica?',
        '¿Quieres ver cuáles tienen cita disponible hoy?',
        '¿Buscas el consultorio más cercano a ti?',
        '¿Quieres ver médicos que acepten tu seguro?',
      ];
    }

    if (sub.includes('dentista') || sub.includes('odontolog') || sub.includes('dental')) {
      return [
        '¿Buscas dentista de urgencias?',
        '¿Quieres ver cuáles hacen blanqueamiento?',
        '¿Buscas ortodoncia o brackets?',
        '¿Quieres ver cuáles atienden niños?',
        '¿Buscas el dentista más económico?',
        '¿Quieres ver cuáles tienen cita disponible hoy?',
      ];
    }

    if (sub.includes('optic') || sub.includes('lentes')) {
      return [
        '¿Buscas lentes con examen de vista incluido?',
        '¿Quieres ver cuáles tienen lentes de contacto?',
        '¿Buscas armazones de marca?',
        '¿Quieres ver las opciones más económicas?',
        '¿También buscas lentes de sol?',
      ];
    }

    if (sub.includes('psicolog') || sub.includes('terapia') || sub.includes('psiquiatr')) {
      return [
        '¿Buscas terapia individual o de pareja?',
        '¿Quieres ver cuáles ofrecen terapia online?',
        '¿Buscas psicólogo para niños o adolescentes?',
        '¿Quieres ver cuáles tienen primera consulta gratuita?',
        '¿Buscas terapia grupal?',
      ];
    }

    if (sub.includes('laboratorio') || sub.includes('analisis clinico') || sub.includes('rayos x') || sub.includes('ultrasonido')) {
      return [
        '¿Buscas laboratorio con toma de muestra a domicilio?',
        '¿Quieres ver cuáles tienen resultados en el día?',
        '¿Buscas ultrasonido o rayos X específico?',
        '¿Quieres ver los precios disponibles?',
        '¿Buscas resultados en línea?',
      ];
    }

    // ── COMIDA ───────────────────────────────────────────────────────────────

    if (sub.includes('mariscos') || sub.includes('ceviche') || sub.includes('aguachile') || sub.includes('coctel de camaron') || sub.includes('tostada de marisco')) {
      return [
        '¿Quieres ver solo los que tienen ceviche?',
        '¿También te gustaría ver restaurantes con aguachile?',
        '¿Buscas mariscos con servicio a domicilio?',
        '¿Quieres ver cuáles están abiertos ahora?',
        '¿Te interesan los que tienen coctel de camarón?',
        '¿Buscas mariscos con estacionamiento?',
        '¿Quieres ver taquería de mariscos?',
        '¿Buscas el más cercano a ti?',
      ];
    }

    if (sub.includes('taco') || sub.includes('taqueria') || sub.includes('birria') || sub.includes('barbacoa') || sub.includes('carnitas')) {
      return [
        '¿También te gustaría ver taquerías de birria?',
        '¿Buscas tacos con servicio a domicilio?',
        '¿Quieres ver cuáles están abiertos en la noche?',
        '¿Buscas carnitas o barbacoa?',
        '¿Quieres ver los mejor calificados?',
        '¿Buscas tacos de canasta?',
        '¿Quieres ver los más cercanos a ti?',
      ];
    }

    if (sub.includes('pizza') || sub.includes('italiana')) {
      return [
        '¿Buscas pizza con envío a domicilio?',
        '¿Quieres ver cuáles tienen promociones 2x1?',
        '¿También te gustaría ver pasta o comida italiana?',
        '¿Buscas pizza artesanal o por rebanada?',
        '¿Quieres ver los que tienen promociones hoy?',
        '¿Buscas calzones o antipasto?',
      ];
    }

    if (sub.includes('hamburguesa') || sub.includes('comida rapida') || sub.includes('fast food') || sub.includes('alitas')) {
      return [
        '¿También quieres ver alitas de pollo?',
        '¿Buscas hamburguesas con domicilio?',
        '¿Te interesan los combos y promociones?',
        '¿Quieres ver los que están abiertos ahora?',
        '¿Buscas el más cercano a ti?',
        '¿Te gustaría ver pizzas también?',
      ];
    }

    if (sub.includes('sushi') || sub.includes('japones') || sub.includes('ramen') || sub.includes('comida asiatica')) {
      return [
        '¿Buscas sushi con envío a domicilio?',
        '¿También te gustaría ver comida coreana?',
        '¿Quieres ver cuáles tienen rolls especiales?',
        '¿Buscas ramen o sopas japonesas?',
        '¿Quieres ver los que tienen promociones hoy?',
      ];
    }

    if (sub.includes('cafe') || sub.includes('cafeteria') || sub.includes('coffee')) {
      return [
        '¿Buscas café con área de trabajo o coworking?',
        '¿También te gustaría ver pastelerías?',
        '¿Quieres ver cuáles tienen wifi?',
        '¿Buscas café para llevar?',
        '¿Quieres ver los que abren temprano?',
        '¿Buscas café de especialidad?',
      ];
    }

    if (sub.includes('panaderia') || sub.includes('pasteleria') || sub.includes('reposteria') || sub.includes('dulceria')) {
      return [
        '¿También quieres ver pastelerías con pedidos especiales?',
        '¿Buscas pan dulce para llevar?',
        '¿Quieres ver cuáles hacen pasteles personalizados?',
        '¿Buscas postres o dulces típicos?',
        '¿Quieres ver los que hacen entrega a domicilio?',
      ];
    }

    if (sub.includes('abarrote') || sub.includes('miscelanea') || sub.includes('tienda de conveniencia') || sub.includes('minisuper')) {
      return [
        '¿Buscas abarrotes con servicio a domicilio?',
        '¿También necesitas una farmacia cerca?',
        '¿Quieres ver los que están abiertos ahora?',
        '¿Buscas algún producto en específico?',
        '¿Quieres ver el más cercano a ti?',
        '¿Buscas también carnicería o cremería?',
      ];
    }

    if (sub.includes('supermerc') || sub.includes('supermercado') || sub.includes('walmart') || sub.includes('chedraui') || sub.includes('soriana')) {
      return [
        '¿Buscas supermercado con servicio a domicilio?',
        '¿Quieres ver cuáles tienen promociones esta semana?',
        '¿También buscas farmacia o panadería dentro?',
        '¿Quieres ver el más cercano a ti?',
        '¿Buscas algún producto en específico?',
      ];
    }

    if (sub.includes('carnicer') || sub.includes('carnicos') || sub.includes('polleria')) {
      return [
        '¿Buscas carnicería con cortes especiales?',
        '¿También quieres ver pollerías?',
        '¿Buscas carne para asar o en trozo?',
        '¿Quieres ver los que tienen pedidos a domicilio?',
        '¿Buscas embutidos o chorizos también?',
      ];
    }

    if (sub.includes('restaurant') && (sub.includes('famili') || sub.includes('cocina casera') || sub.includes('fonda') || sub.includes('corrida'))) {
      return [
        '¿Buscas comida corrida económica?',
        '¿También te gustaría ver fondas?',
        '¿Quieres ver cuáles tienen menú del día?',
        '¿Buscas comida para llevar?',
        '¿Quieres ver los que atienden grupos grandes?',
      ];
    }

    if (sub.includes('helado') || sub.includes('nieve') || sub.includes('paleta') || sub.includes('paleteria')) {
      return [
        '¿También quieres ver heladerías artesanales?',
        '¿Buscas paletas de hielo o cremosas?',
        '¿Quieres ver nieves de garrafa?',
        '¿Buscas el más cercano a ti?',
        '¿Quieres ver cuáles tienen sabores de temporada?',
      ];
    }

    if (sub.includes('bar') || sub.includes('cantina') || sub.includes('antro') || sub.includes('discoteca') || sub.includes('botanero')) {
      return [
        '¿Buscas bar con música en vivo?',
        '¿También quieres ver cantinas con botana?',
        '¿Quieres ver cuáles tienen promociones hoy?',
        '¿Buscas antro con pista de baile?',
        '¿Quieres ver los que tienen entrada libre?',
        '¿Buscas el más cercano a ti?',
      ];
    }

    // ── AUTOMOTRIZ ────────────────────────────────────────────────────────────

    if (sub.includes('mecanico') || sub.includes('taller automovilistic') || sub.includes('taller mecanic')) {
      return [
        '¿También buscas hojalatería y pintura?',
        '¿Quieres ver talleres que trabajan tu marca de auto?',
        '¿Buscas servicio express de aceite?',
        '¿Quieres ver cuáles tienen grúa?',
        '¿Buscas taller con diagnóstico computarizado?',
        '¿Quieres ver el más cercano a ti?',
      ];
    }

    if (sub.includes('refaccion') || sub.includes('autopartes') || sub.includes('refaccionar')) {
      return [
        '¿Buscas refacciones para tu marca específica?',
        '¿También quieres ver lubricantes o aceites?',
        '¿Buscas refacciones originales o genéricas?',
        '¿Quieres ver cuáles hacen envío?',
        '¿Buscas también accesorios para tu auto?',
      ];
    }

    if (sub.includes('llanter') || sub.includes('llanta') || sub.includes('neumatico')) {
      return [
        '¿Buscas llantas nuevas o usadas?',
        '¿También quieres ver servicio de alineación y balanceo?',
        '¿Quieres ver cuáles tienen montaje gratis?',
        '¿Buscas llantas para tu medida específica?',
        '¿Quieres ver los precios disponibles?',
      ];
    }

    if (sub.includes('car wash') || sub.includes('lavado de auto') || sub.includes('detailing')) {
      return [
        '¿Buscas lavado express o completo?',
        '¿También quieres ver servicio de pulido?',
        '¿Quieres ver cuáles hacen detailing interior?',
        '¿Buscas el más cercano?',
        '¿Quieres ver los precios disponibles?',
      ];
    }

    if (sub.includes('agencia') && (sub.includes('auto') || sub.includes('carro') || sub.includes('vehiculo'))) {
      return [
        '¿Buscas autos nuevos o seminuevos?',
        '¿Quieres ver agencias con financiamiento?',
        '¿Buscas alguna marca en especial?',
        '¿Quieres ver cuáles tienen promociones?',
        '¿Buscas SUV, sedán o pick-up?',
      ];
    }

    // ── TIENDAS ───────────────────────────────────────────────────────────────

    if (sub.includes('ropa') || sub.includes('boutique') || sub.includes('moda') || sub.includes('vestido')) {
      return [
        '¿Buscas ropa casual o formal?',
        '¿También quieres ver zapaterías?',
        '¿Buscas ropa de marca o económica?',
        '¿Quieres ver cuáles tienen descuentos?',
        '¿Buscas ropa para hombre, mujer o niños?',
        '¿Quieres ver cuáles tienen envío?',
      ];
    }

    if (sub.includes('zapateria') || sub.includes('zapato') || sub.includes('calzado')) {
      return [
        '¿Buscas zapato casual, formal o deportivo?',
        '¿También quieres ver tiendas de ropa?',
        '¿Buscas calzado de marca o económico?',
        '¿Quieres ver cuáles tienen tu talla disponible?',
        '¿Buscas zapatos para niños?',
      ];
    }

    if (sub.includes('ferreteria') || sub.includes('materiales de construccion') || sub.includes('plomeria') || sub.includes('herreria')) {
      return [
        '¿Buscas ferretería con entrega a domicilio?',
        '¿También necesitas materiales de construcción?',
        '¿Quieres ver cuáles tienen el producto que buscas?',
        '¿Buscas herramientas o accesorios?',
        '¿Quieres ver los precios disponibles?',
      ];
    }

    if (sub.includes('electronica') || sub.includes('celular') || sub.includes('telefono') || sub.includes('computadora') || sub.includes('laptop')) {
      return [
        '¿Buscas celular nuevo o reacondicionado?',
        '¿También quieres ver accesorios o fundas?',
        '¿Buscas servicio técnico o reparación?',
        '¿Quieres ver cuáles tienen financiamiento?',
        '¿Buscas alguna marca en específico?',
        '¿Quieres ver los precios disponibles?',
      ];
    }

    if (sub.includes('joyeria') || sub.includes('reloj') || sub.includes('bisuteria')) {
      return [
        '¿Buscas joyería de plata u oro?',
        '¿También quieres ver relojes?',
        '¿Buscas algo para regalo?',
        '¿Quieres ver cuáles hacen grabado personalizado?',
        '¿Buscas bisutería económica?',
      ];
    }

    if (sub.includes('muebleria') || sub.includes('mueble') || sub.includes('colchon') || sub.includes('decoracion')) {
      return [
        '¿Buscas muebles con financiamiento?',
        '¿También quieres ver colchonerías?',
        '¿Buscas muebles de sala, recámara o comedor?',
        '¿Quieres ver cuáles tienen entrega a domicilio?',
        '¿Buscas muebles nuevos o de segunda mano?',
      ];
    }

    if (sub.includes('papeleria') || sub.includes('articulos de oficina') || sub.includes('impresion') || sub.includes('imprenta')) {
      return [
        '¿Buscas papelería con servicio de impresión?',
        '¿También quieres ver copiadoras o scanners?',
        '¿Buscas material escolar o de oficina?',
        '¿Quieres ver cuáles hacen envío de archivos en línea?',
        '¿Buscas engargolado o empastado?',
      ];
    }

    // ── BELLEZA ───────────────────────────────────────────────────────────────

    if ((sub.includes('estetica') || sub.includes('peluqueria') || sub.includes('salon') && sub.includes('belleza')) && !cat.includes('mascota')) {
      return [
        '¿Buscas estética con cita o sin cita?',
        '¿También quieres ver salones de uñas?',
        '¿Buscas coloración o tinte?',
        '¿Quieres ver cuáles tienen keratina o tratamientos?',
        '¿Buscas barbería para caballeros?',
        '¿Quieres ver los precios disponibles?',
        '¿Buscas el más cercano a ti?',
      ];
    }

    if (sub.includes('spa') || sub.includes('masaje') || sub.includes('relajacion')) {
      return [
        '¿Buscas spa con paquetes completos?',
        '¿También quieres ver masajes a domicilio?',
        '¿Buscas masaje de tejido profundo o relajante?',
        '¿Quieres ver cuáles tienen aromaterapia?',
        '¿Buscas algo para regalo especial?',
      ];
    }

    if (sub.includes('unas') || sub.includes('manicure') || sub.includes('pedicure') || sub.includes('nail')) {
      return [
        '¿Buscas manicure o pedicure completo?',
        '¿También quieres ver estéticas?',
        '¿Buscas uñas acrílicas o de gel?',
        '¿Quieres ver cuáles tienen nail art?',
        '¿Buscas el servicio a domicilio?',
      ];
    }

    if (sub.includes('barberia') || sub.includes('barbero')) {
      return [
        '¿Buscas barbería con arreglo de barba?',
        '¿También quieres ver estéticas?',
        '¿Buscas barbería vintage o tradicional?',
        '¿Quieres ver cuáles tienen diseños de cabello?',
        '¿Buscas el más cercano a ti?',
      ];
    }

    if (sub.includes('tatuaje') || sub.includes('piercing') || sub.includes('estudio de tatuaje')) {
      return [
        '¿Buscas tatuaje pequeño o manga completa?',
        '¿También quieres ver estudios de piercing?',
        '¿Buscas tatuaje a color o blackwork?',
        '¿Quieres ver los portafolios disponibles?',
        '¿Buscas el más cercano a ti?',
      ];
    }

    // ── EDUCACIÓN ─────────────────────────────────────────────────────────────

    if (sub.includes('escuela') || sub.includes('colegio') || sub.includes('primaria') || sub.includes('secundaria') || sub.includes('preparatoria')) {
      return [
        '¿Buscas escuela pública o privada?',
        '¿Quieres ver cuáles tienen transporte escolar?',
        '¿Buscas escuela con programa extracurricular?',
        '¿Quieres ver cuáles tienen cupo disponible?',
        '¿Buscas la más cercana a tu domicilio?',
      ];
    }

    if (sub.includes('universidad') || sub.includes('tecnologic') || sub.includes('educacion superior')) {
      return [
        '¿Buscas universidad pública o privada?',
        '¿Quieres ver cuáles tienen la carrera que buscas?',
        '¿Buscas modalidad presencial o en línea?',
        '¿Quieres ver cuáles tienen becas disponibles?',
        '¿Buscas posgrado o maestría?',
      ];
    }

    if (sub.includes('idioma') || sub.includes('ingles') || sub.includes('frances') || sub.includes('academia de idioma')) {
      return [
        '¿Buscas clases de inglés u otro idioma?',
        '¿Quieres ver clases presenciales o en línea?',
        '¿Buscas curso intensivo o regular?',
        '¿Quieres ver cuáles tienen certificación internacional?',
        '¿Buscas clases para niños o adultos?',
      ];
    }

    if (sub.includes('guarder') || sub.includes('kinder') || sub.includes('preescolar') || sub.includes('estancia infantil')) {
      return [
        '¿Buscas guardería con horario extendido?',
        '¿Quieres ver cuáles incluyen alimentación?',
        '¿Buscas kinder con actividades extraescolares?',
        '¿Quieres ver las más cercanas a tu domicilio?',
        '¿Buscas cupo inmediato?',
      ];
    }

    // ── HOGAR ─────────────────────────────────────────────────────────────────

    if (sub.includes('plomero') || sub.includes('plomeria')) {
      return [
        '¿Buscas plomero de urgencia?',
        '¿También necesitas electricista?',
        '¿Quieres ver cuáles atienden hoy mismo?',
        '¿Buscas instalación o reparación?',
        '¿Quieres ver los precios disponibles?',
      ];
    }

    if (sub.includes('electric') || sub.includes('electricista')) {
      return [
        '¿Buscas electricista de urgencia?',
        '¿También necesitas plomero?',
        '¿Quieres ver cuáles atienden hoy mismo?',
        '¿Buscas instalación o reparación eléctrica?',
        '¿Quieres ver los precios disponibles?',
      ];
    }

    if (sub.includes('limpieza') || sub.includes('intendencia') || sub.includes('mucama') || sub.includes('aseo')) {
      return [
        '¿Buscas servicio de limpieza por horas o mensual?',
        '¿También quieres ver lavandería?',
        '¿Buscas limpieza de oficina o casa?',
        '¿Quieres ver cuáles tienen servicio de fin de semana?',
        '¿Buscas el servicio a domicilio?',
      ];
    }

    if (sub.includes('jardineria') || sub.includes('paisajismo') || sub.includes('poda')) {
      return [
        '¿Buscas servicio de jardinería por visita o contrato?',
        '¿También quieres ver viveros o plantas?',
        '¿Buscas diseño de jardín o mantenimiento?',
        '¿Quieres ver los precios disponibles?',
        '¿Buscas el servicio más urgente?',
      ];
    }

    if (sub.includes('fumigaci') || sub.includes('control de plaga') || sub.includes('desinfeccion')) {
      return [
        '¿Buscas fumigación de urgencia?',
        '¿Quieres ver cuáles tienen garantía?',
        '¿Buscas fumigación de casa, negocio o bodega?',
        '¿Quieres ver los precios disponibles?',
        '¿Buscas servicio mensual o por evento?',
      ];
    }

    if (sub.includes('mudanza') || sub.includes('flete') || sub.includes('carga y descarga')) {
      return [
        '¿Buscas mudanza local o foránea?',
        '¿Quieres ver cuáles incluyen empaque?',
        '¿Buscas servicio con seguro de artículos?',
        '¿Quieres ver los precios disponibles?',
        '¿Buscas disponibilidad para hoy o mañana?',
      ];
    }

    // ── MASCOTAS ──────────────────────────────────────────────────────────────

    if (sub.includes('veterinari') || sub.includes('clinica veterinaria') || sub.includes('medico veterinario')) {
      return [
        '¿Buscas veterinaria de urgencias 24 horas?',
        '¿Quieres ver cuáles tienen vacunas disponibles?',
        '¿También quieres ver tiendas de mascotas?',
        '¿Buscas veterinaria para perros, gatos u otra especie?',
        '¿Quieres ver la más cercana a ti?',
      ];
    }

    if ((sub.includes('peluqueria') || sub.includes('estetica')) && cat.includes('mascota') || sub.includes('grooming') || sub.includes('estilista canin')) {
      return [
        '¿Buscas peluquería para perro o gato?',
        '¿Quieres ver cuáles hacen corte y baño en el mismo servicio?',
        '¿También buscas tintura o accesorios de grooming?',
        '¿Buscas servicio a domicilio para tu mascota?',
        '¿Quieres ver los precios disponibles?',
      ];
    }

    if (sub.includes('tienda') && cat.includes('mascota') || sub.includes('pet shop') || sub.includes('accesorios para mascota')) {
      return [
        '¿Buscas alimento especial para tu mascota?',
        '¿También quieres ver juguetes o accesorios?',
        '¿Buscas tienda con veterinaria incluida?',
        '¿Quieres ver cuáles tienen entrega a domicilio?',
        '¿Buscas algún producto específico?',
      ];
    }

    // ── ENTRETENIMIENTO ───────────────────────────────────────────────────────

    if (sub.includes('gimnasio') || sub.includes('gym') || sub.includes('crossfit') || sub.includes('fitness')) {
      return [
        '¿Buscas gimnasio con clases grupales?',
        '¿Quieres ver cuáles tienen alberca?',
        '¿También quieres ver estudios de yoga o pilates?',
        '¿Buscas membresía mensual o anual?',
        '¿Quieres ver los precios disponibles?',
        '¿Buscas el más cercano a ti?',
      ];
    }

    if (sub.includes('cine') || sub.includes('cinema')) {
      return [
        '¿Quieres ver la cartelera de hoy?',
        '¿Buscas cine con sala VIP o 4DX?',
        '¿Quieres ver cuáles tienen función de madrugada?',
        '¿Buscas cine cerca de tu ubicación?',
        '¿Quieres ver los precios y horarios?',
      ];
    }

    if (sub.includes('parque') || sub.includes('area recreativa') || sub.includes('diversion') || sub.includes('parque de diversion')) {
      return [
        '¿Buscas parque de diversiones para niños?',
        '¿Quieres ver cuáles tienen juegos acuáticos?',
        '¿Buscas área para picnic o eventos?',
        '¿Quieres ver los precios de entrada?',
        '¿Buscas el más cercano a ti?',
      ];
    }

    if (sub.includes('boliche') || sub.includes('billar') || sub.includes('bowling') || sub.includes('pool')) {
      return [
        '¿Buscas boliche o billar más cercano?',
        '¿También quieres ver salas de videojuegos?',
        '¿Quieres ver cuáles tienen bar o snacks?',
        '¿Buscas para ir en grupo o pareja?',
        '¿Quieres ver los precios disponibles?',
      ];
    }

    // ── TURISMO / VIAJES ──────────────────────────────────────────────────────

    if (sub.includes('hotel') || sub.includes('hostal') || sub.includes('motel') || sub.includes('alojamiento')) {
      return [
        '¿Buscas hotel con desayuno incluido?',
        '¿También quieres ver hostales más económicos?',
        '¿Buscas hotel con alberca o gym?',
        '¿Quieres ver cuáles tienen estacionamiento?',
        `¿Buscas hotel en una zona específica de ${ciudad}?`,
        '¿Quieres ver los precios disponibles?',
      ];
    }

    if (sub.includes('agencia de viaje') || sub.includes('agencia de turismo') || sub.includes('paquete vacacional')) {
      return [
        '¿Buscas paquete de playa o ciudad?',
        '¿Quieres ver cuáles tienen vuelo incluido?',
        '¿Buscas viaje nacional o internacional?',
        '¿Quieres ver las promociones disponibles?',
        '¿Buscas viaje en grupo o individual?',
      ];
    }

    if (sub.includes('tour') || sub.includes('guia turistico') || (sub.includes('guia') && sub.includes('turistico'))) {
      return [
        '¿Buscas tour cultural o de aventura?',
        '¿Quieres ver tours en español o inglés?',
        '¿Buscas tour privado o en grupo?',
        '¿Quieres ver los precios disponibles?',
        '¿Buscas tour de medio día o día completo?',
      ];
    }

    if (sub.includes('renta de carro') || sub.includes('renta de auto') || sub.includes('arrendadora')) {
      return [
        '¿Buscas renta de auto por día o semana?',
        '¿Quieres ver cuáles incluyen seguro?',
        '¿Buscas auto económico o camioneta?',
        '¿Quieres ver cuáles tienen entrega en aeropuerto?',
        '¿Quieres ver los precios disponibles?',
      ];
    }

    // ── TECNOLOGÍA / SERVICIOS ────────────────────────────────────────────────

    if (sub.includes('reparacion') && (sub.includes('celular') || sub.includes('telefono') || sub.includes('tablet'))) {
      return [
        '¿Buscas reparación de pantalla o batería?',
        '¿Quieres ver cuáles tienen garantía?',
        '¿Buscas reparación express?',
        '¿Quieres ver los precios disponibles?',
        '¿Buscas el más cercano a ti?',
      ];
    }

    if (sub.includes('internet') || sub.includes('proveedor de internet') || sub.includes('fibra optica') || sub.includes('wifi')) {
      return [
        '¿Buscas internet para hogar o empresa?',
        '¿Quieres ver cuáles tienen fibra óptica?',
        '¿Buscas el plan más económico?',
        '¿Quieres ver cuáles tienen instalación gratis?',
        '¿Buscas también servicio de telefonía?',
      ];
    }

    if (sub.includes('contador') || sub.includes('contabilidad') || sub.includes('despacho contable') || sub.includes('fiscal')) {
      return [
        '¿Buscas contador para persona física o moral?',
        '¿Quieres ver cuáles hacen declaraciones SAT?',
        '¿Buscas asesoría fiscal o contable?',
        '¿Quieres ver los precios disponibles?',
        '¿Buscas contador con atención a domicilio?',
      ];
    }

    if (sub.includes('abogado') || sub.includes('notaria') || sub.includes('asesor legal') || sub.includes('despacho juridico')) {
      return [
        '¿Buscas abogado para qué tipo de caso?',
        '¿Quieres ver cuáles ofrecen consulta gratuita?',
        '¿Buscas despacho familiar, penal o civil?',
        '¿Quieres ver los despachos más cercanos?',
        '¿Buscas notaría o asesoría legal?',
      ];
    }

    // ── FALLBACK GENÉRICO (reducido, sin duplicados semánticos) ──────────────
    return this.genericasFallback(ciudad);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // FALLBACK GENÉRICO — sin duplicados semánticos, variedad real
  // ─────────────────────────────────────────────────────────────────────────────
  private static genericasFallback(ciudad: string): string[] {
    return [
      `¿Quieres buscar otra cosa en ${ciudad}?`,
      '¿Quieres ver los que están abiertos ahora?',
      '¿Buscas el más cercano a ti?',
      '¿Quieres ver opciones con promociones?',
      '¿Buscas servicio a domicilio?',
      '¿Quieres ver los mejor calificados?',
      '¿Buscas algo en otra zona de la ciudad?',
      '¿Quieres ver los precios disponibles?',
      '¿Quieres explorar otra categoría?',
      '¿Buscas para hoy o para otro día?',
      '¿Quieres ver negocios con estacionamiento?',
      '¿Buscas atención inmediata o puedes esperar?',
      '¿Quieres comparar varias opciones?',
      '¿Buscas algo más específico?',
      '¿Quieres ver los más populares del área?',
    ];
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // UTILERÍAS
  // ─────────────────────────────────────────────────────────────────────────────

  /** Filtra yaUsadas y devuelve hasta `n` sugerencias. */
  private static filtrar(pool: string[], yaUsadas: string[], n = 2): string[] {
    const disponibles = pool.filter((s) => !yaUsadas.includes(s));
    return disponibles.slice(0, n);
  }

  /** Fisher-Yates shuffle. */
  private static mezclar<T>(array: T[]): T[] {
    const copia = [...array];
    for (let i = copia.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copia[i], copia[j]] = [copia[j], copia[i]];
    }
    return copia;
  }
}
