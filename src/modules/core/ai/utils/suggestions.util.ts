/**
 * Genera sugerencias contextuales después de una búsqueda.
 *
 * Cubre las ~93 categorías del catálogo semántico de Jelpy:
 *  Salud · Comida · Automotriz · Tiendas · Belleza · Educación
 *  Hogar · Mascotas · Entretenimiento · Turismo · Tecnología
 *
 * Lógica anti-repetición:
 *  - Se recibe `yaUsadas` con las sugerencias ya mostradas en la sesión.
 *  - Se filtran del pool antes de devolver.
 *  - Si el pool de la categoría se agota, se complementa con sugerencias
 *    "profundas" (operativas: horario, domicilio, promos, precio).
 */
export class SugerenciasUtil {

  /**
   * @param filtros     Filtros detectados (categoría, subcategoría, hints)
   * @param items       Resultados encontrados en esta búsqueda
   * @param ciudad      Ciudad activa de la sesión
   * @param yaUsadas    Sugerencias ya mostradas en turnos anteriores
   */
  static generar(
    filtros: {
      categoriaId?: number | null;
      subcategoriaId?: number | null;
      categoriaHint?: string;
      subcategoriaHint?: string;
    },
    items: any[],
    ciudad: string,
    yaUsadas: string[] = [],
  ): string[] {
    if (!items || items.length === 0) return [];

    const cat = (filtros.categoriaHint || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const sub = (filtros.subcategoriaHint || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const ciudadNombre = ciudad || 'tu ciudad';

    const pool = this.obtenerPool(sub, cat, ciudadNombre, items);
    const nuevas = pool.filter((s) => !yaUsadas.includes(s));

    if (nuevas.length >= 2) return nuevas.slice(0, 2);

    const profundas = this.sugerenciasProfundas(ciudadNombre, items)
      .filter((s) => !yaUsadas.includes(s));

    return [...nuevas, ...profundas].slice(0, 2);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // POOLS POR CATEGORÍA
  // ─────────────────────────────────────────────────────────────────────────────

  private static obtenerPool(sub: string, cat: string, ciudad: string, items: any[]): string[] {

    // ── SALUD ─────────────────────────────────────────────────────────────────

    if (sub.includes('farmacia')) {
      return [
        '¿Buscas farmacia de turno 24 horas?',
        '¿También necesitas un médico cerca?',
        '¿Quieres ver cuáles tienen medicamentos genéricos?',
        '¿Buscas farmacia con envío a domicilio?',
        '¿Necesitas algún medicamento específico?',
      ];
    }

    if (sub.includes('doctor') || sub.includes('medico') || sub.includes('medicina general')) {
      return [
        '¿También necesitas una farmacia cercana?',
        '¿Quieres ver médicos a domicilio?',
        '¿Buscas alguna especialidad médica?',
        '¿Quieres ver cuáles tienen cita disponible hoy?',
        '¿Buscas el consultorio más cercano a ti?',
      ];
    }

    if (sub.includes('dentist') || sub.includes('odontolog')) {
      return [
        items.length === 1
          ? '¿Quieres saber el horario de este dentista?'
          : '¿Quieres saber el horario de alguno?',
        '¿También buscas ortodoncista o limpieza dental?',
        '¿Quieres ver cuáles tienen consulta de urgencia?',
        '¿Buscas el más cercano a ti?',
        '¿Te interesan los precios aproximados?',
      ];
    }

    if (sub.includes('consultorio')) {
      return [
        '¿Quieres ver también médicos generales?',
        '¿Buscas consulta a domicilio?',
        '¿Quieres saber el costo de la consulta?',
        '¿También necesitas una farmacia cercana?',
        '¿Buscas alguna especialidad en particular?',
      ];
    }

    if (sub.includes('clinica') || sub.includes('clínica')) {
      return [
        '¿Buscas clínica con urgencias 24 horas?',
        '¿Quieres ver hospitales privados cercanos?',
        '¿También necesitas médicos especialistas?',
        '¿Buscas clínica con laboratorio incluido?',
        '¿Quieres ver cuáles tienen citas disponibles?',
      ];
    }

    if (sub.includes('hospital')) {
      return [
        '¿Buscas urgencias disponibles ahora?',
        '¿Quieres ver hospitales con especialidades?',
        '¿También necesitas una clínica más cercana?',
        '¿Buscas hospital con estacionamiento?',
        '¿Quieres ver los que aceptan tu seguro médico?',
      ];
    }

    if (sub.includes('laboratorio')) {
      return [
        '¿Buscas laboratorio con toma de muestra a domicilio?',
        '¿Quieres ver cuáles tienen resultados en línea?',
        '¿También necesitas una farmacia o médico cerca?',
        '¿Buscas paquetes de análisis clínicos?',
        '¿Quieres ver los que abren temprano?',
      ];
    }

    if (sub.includes('optica') || sub.includes('óptica')) {
      return [
        '¿Buscas óptica con estudio de la vista incluido?',
        '¿Quieres ver cuáles tienen lentes con tu receta en el día?',
        '¿Buscas lentes de contacto también?',
        '¿Te interesan los marcos económicos?',
        '¿Quieres ver las promociones disponibles?',
      ];
    }

    if (sub.includes('psicolog')) {
      return [
        '¿Buscas terapia presencial o en línea?',
        '¿Quieres ver psicólogos con consulta a domicilio?',
        '¿Buscas atención para niños o adolescentes?',
        '¿También te interesa orientación familiar?',
        '¿Quieres ver cuáles tienen primera consulta gratuita?',
      ];
    }

    if (sub.includes('nutrici') || sub.includes('nutriolog')) {
      return [
        '¿Buscas nutriólogo con plan personalizado?',
        '¿Quieres ver consultas a domicilio?',
        '¿También buscas apoyo para bajar de peso?',
        '¿Buscas nutriólogo deportivo?',
        '¿Quieres ver cuáles ofrecen seguimiento semanal?',
      ];
    }

    if (sub.includes('fisio') || sub.includes('rehabilit')) {
      return [
        '¿Buscas fisioterapia a domicilio?',
        '¿Quieres ver rehabilitación post-operatoria?',
        '¿También buscas masaje terapéutico?',
        '¿Buscas terapia para lesiones deportivas?',
        '¿Quieres ver cuáles tienen aparatos especializados?',
      ];
    }

    if (sub.includes('ambulancia')) {
      return [
        '¿Necesitas traslado médico urgente?',
        '¿Buscas también hospital o clínica de urgencias?',
        '¿Quieres ver servicios de emergencia 24 horas?',
        '¿También necesitas un médico a domicilio?',
      ];
    }

    // ── COMIDA ────────────────────────────────────────────────────────────────

    if (sub.includes('taqueria') || sub.includes('tacos')) {
      return [
        `¿Quieres ver tacos con domicilio a ${ciudad}?`,
        '¿También te interesan las torterías?',
        '¿Buscas promociones en taquerías?',
        '¿Quieres ver los que están abiertos ahora?',
        '¿Te gustaría ver el menú de alguno?',
        '¿Buscas tacos de canasta o de guisados?',
      ];
    }

    if (sub.includes('mariscos') || sub.includes('ceviche') || sub.includes('aguachile') || sub.includes('coctel de camaron') || sub.includes('tostada de mariscos')) {
      return [
        '¿Quieres ver solo los que tienen ceviche?',
        '¿También te gustaría ver restaurantes con aguachile?',
        '¿Buscas mariscos con domicilio?',
        '¿Quieres ver cuáles están abiertos ahora?',
        '¿Te interesan los que tienen coctel de camarón?',
        '¿Buscas mariscos con estacionamiento?',
        '¿Quieres ver taquería de mariscos?',
        '¿Buscas el más cercano a ti?',
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

    if (sub.includes('pizza') || sub.includes('pizzeria')) {
      return [
        '¿Quieres ver pizzas con domicilio?',
        '¿También te gustaría ver promociones en pizzas?',
        '¿Buscas pizza por rebanada?',
        '¿Quieres ver cuáles están abiertos ahora?',
        '¿Te interesan los descuentos del día?',
        '¿También te gustan las pastas?',
      ];
    }

    if (sub.includes('japones') || sub.includes('sushi') || sub.includes('ramen')) {
      return [
        '¿Buscas sushi con domicilio?',
        '¿Quieres ver cuáles tienen ramen también?',
        '¿Buscas el más cercano abierto ahora?',
        '¿Te interesan los combos de sushi?',
        '¿También te gusta otra comida oriental?',
      ];
    }

    if (sub.includes('cafeteria') || sub.includes('cafe') || sub.includes('café')) {
      return [
        '¿Buscas cafetería con desayunos o brunch?',
        '¿Quieres ver cuáles tienen wifi disponible?',
        '¿También te interesan las pastelerías?',
        '¿Buscas café de especialidad?',
        '¿Quieres ver los que tienen área de trabajo?',
        `¿Hay otra opción de café que quieras buscar en ${ciudad}?`,
      ];
    }

    if ((sub.includes('restaurant') && sub.includes('famili')) || sub.includes('cocina casera') || sub.includes('fonda') || sub.includes('comida corrida')) {
      return [
        '¿Buscas comida corrida económica?',
        '¿Quieres ver los que tienen menú del día?',
        '¿Buscas alguno con domicilio?',
        '¿Quieres ver los que están abiertos ahora?',
        `¿Hay otra comida casera que busques en ${ciudad}?`,
        '¿Te gustaría ver sus precios?',
      ];
    }

    if (sub.includes('postre') || sub.includes('helado') || sub.includes('nieve') || sub.includes('raspado') || sub.includes('crepa')) {
      return [
        '¿Buscas helados artesanales o nieves?',
        '¿Quieres ver cuáles tienen raspados o mangonadas?',
        '¿También te interesan las crepas?',
        '¿Buscas opciones con domicilio?',
        '¿Quieres ver los más cercanos abiertos ahora?',
        '¿Te gustaría ver sus sabores disponibles?',
      ];
    }

    if (sub.includes('parrillada') || sub.includes('asador') || sub.includes('bbq') || sub.includes('cortes')) {
      return [
        '¿Buscas parrilla con cortes de carne premium?',
        '¿Quieres ver cuáles tienen promociones de grupo?',
        '¿También te interesan las carnes asadas?',
        '¿Buscas uno con domicilio o servicio a domicilio?',
        '¿Quieres ver los que tienen área al aire libre?',
        '¿Buscas el más cercano abierto ahora?',
      ];
    }

    if (sub.includes('italiana') || sub.includes('pasta') || sub.includes('lasana')) {
      return [
        '¿Buscas pasta fresca o lasaña?',
        '¿Quieres ver cuáles tienen pizza artesanal también?',
        '¿Buscas comida italiana con domicilio?',
        '¿Te gustaría ver menús o precios?',
        '¿Quieres ver los abiertos ahora?',
      ];
    }

    if (sub.includes('china') || sub.includes('arroz frito') || sub.includes('oriental')) {
      return [
        '¿Buscas comida china con domicilio?',
        '¿Quieres ver cuáles tienen combinaciones?',
        '¿También te gustan otras cocinas orientales?',
        '¿Buscas el más cercano abierto ahora?',
        '¿Te gustaría ver los precios?',
      ];
    }

    if (sub.includes('comida mexicana') || sub.includes('mexicana') || sub.includes('mole') || sub.includes('enchilada')) {
      return [
        '¿Buscas comida mexicana tradicional o regional?',
        '¿Quieres ver cuáles tienen pozole o menudo?',
        '¿También te interesan los tamales o antojitos?',
        '¿Buscas uno con domicilio?',
        `¿Quieres ver los más populares en ${ciudad}?`,
      ];
    }

    if (sub.includes('food truck') || sub.includes('comida movil')) {
      return [
        '¿Buscas food truck con especialidad en hamburguesas?',
        '¿Quieres ver cuáles están cerca ahora?',
        '¿También te interesan los que tienen tacos?',
        '¿Buscas food trucks con bebidas también?',
        `¿Hay otro tipo de comida que quieras en ${ciudad}?`,
      ];
    }

    if (sub.includes('antojito') || sub.includes('elote') || sub.includes('esquite')) {
      return [
        '¿Buscas antojitos con domicilio?',
        '¿Quieres ver los que tienen elotes y esquites?',
        '¿También te interesan los churros o raspados?',
        '¿Buscas los más cercanos abiertos ahora?',
        '¿Te gustaría ver otras opciones de botanas?',
      ];
    }

    if (sub.includes('saludable') || sub.includes('ensalada') || sub.includes('bowl') || sub.includes('vegano')) {
      return [
        '¿Buscas opciones veganas o vegetarianas?',
        '¿Quieres ver cuáles tienen jugos naturales?',
        '¿También te interesan los bowls proteicos?',
        '¿Buscas comida saludable con domicilio?',
        `¿Quieres ver las opciones fit en ${ciudad}?`,
      ];
    }

    if (sub.includes('bares') || sub.includes('cantina') || sub.includes('cerveza') || sub.includes('caguameria')) {
      return [
        '¿Buscas bar con música en vivo?',
        '¿Quieres ver cantinas con botanas?',
        '¿También te interesan los bares con karaoke?',
        '¿Buscas cerveza artesanal?',
        '¿Quieres ver cuáles están abiertos ahora?',
        '¿Te gustaría ver bares con terraza?',
      ];
    }

    if (sub.includes('panaderia') || sub.includes('pan dulce') || sub.includes('pan artesanal')) {
      return [
        '¿Buscas panadería con conchas y pan dulce?',
        '¿Quieres ver cuáles tienen pan recién hecho?',
        '¿También te interesan las pastelerías?',
        '¿Buscas pan integral o saludable?',
        '¿Quieres ver los que abren temprano?',
      ];
    }

    if (sub.includes('fruteria') || sub.includes('jugueria') || sub.includes('jugos') || sub.includes('licuado') || sub.includes('aguas frescas')) {
      return [
        '¿Buscas jugos naturales o smoothies?',
        '¿Quieres ver cuáles tienen fruta picada?',
        '¿También te interesan las aguas frescas?',
        '¿Buscas opciones con delivery?',
        '¿Quieres ver los más cercanos abiertos ahora?',
      ];
    }

    if (sub.includes('tortilleria')) {
      return [
        '¿Buscas tortillería con tortillas recién hechas?',
        '¿Quieres ver cuáles tienen tortillas de harina también?',
        '¿También te interesa comprar masa?',
        '¿Buscas la más cercana abierta ahora?',
        `¿Necesitas algo más de la despensa en ${ciudad}?`,
      ];
    }

    if (sub.includes('birria') || sub.includes('birrier') || sub.includes('consome')) {
      return [
        '¿Buscas birria con consomé o en tacos?',
        '¿Quieres ver cuáles están abiertos ahora?',
        '¿También te interesan las quesabirrias?',
        '¿Buscas birria con domicilio?',
        `¿Quieres ver las birrieras más populares en ${ciudad}?`,
      ];
    }

    if (sub.includes('desayuno') || sub.includes('desayunos') || sub.includes('brunch') || sub.includes('hotcake') || sub.includes('chilaquil')) {
      return [
        '¿Buscas desayunos con huevos o chilaquiles?',
        '¿Quieres ver cuáles tienen menú de brunch?',
        '¿También buscas café o jugos naturales?',
        '¿Buscas opciones con domicilio?',
        `¿Quieres ver los que están abiertos ahora en ${ciudad}?`,
      ];
    }

    if (sub.includes('pozole') || sub.includes('menudo') || sub.includes('bucheria') || sub.includes('caldo')) {
      return [
        '¿Buscas pozolería o menudería?',
        '¿Quieres ver cuáles están abiertos los fines de semana?',
        '¿También te interesa birria o caldo de res?',
        '¿Buscas opciones con domicilio?',
        `¿Quieres ver los más populares en ${ciudad}?`,
      ];
    }

    if (sub.includes('torter') || sub.includes('loncher') || sub.includes('torta') || sub.includes('lonche')) {
      return [
        '¿Buscas tortería con variedad de guisados?',
        '¿Quieres ver cuáles tienen lonches y tortas grandes?',
        '¿También buscas tacos o comida corrida?',
        '¿Buscas la más cercana abierta ahora?',
        `¿Hay otra opción que te llame la atención en ${ciudad}?`,
      ];
    }

    if (sub.includes('cocteleria') || sub.includes('coctelería') || sub.includes('mezcal') || sub.includes('tequila') || sub.includes('cocktail')) {
      return [
        '¿Buscas coctelería con mezcal artesanal?',
        '¿Quieres ver cuáles tienen happy hour?',
        '¿También buscas bar o terraza?',
        '¿Buscas el más cercano abierto ahora?',
        '¿Te gustaría ver la carta de bebidas?',
      ];
    }

    if (sub.includes('cerveceria') || sub.includes('cervecería') || sub.includes('cerveza artesanal') || sub.includes('craft beer')) {
      return [
        '¿Buscas cervecería artesanal local?',
        '¿Quieres ver cuáles tienen variedad de estilos?',
        '¿También buscas bar con botanas?',
        '¿Buscas la más cercana abierta ahora?',
        '¿Quieres ver los precios por jarra o pinta?',
      ];
    }

    // ── AUTOMOTRIZ ────────────────────────────────────────────────────────────

    if (sub.includes('mecanico') || sub.includes('mecanica') || (sub.includes('taller') && cat.includes('automotriz'))) {
      return [
        '¿Buscas mecánico con servicio a domicilio?',
        '¿Quieres ver cuáles tienen garantía de trabajo?',
        '¿También buscas cambio de aceite rápido?',
        '¿Quieres ver los que están abiertos ahora?',
        '¿Buscas taller para tu marca de carro?',
        '¿También necesitas diagnóstico electrónico?',
      ];
    }

    if (sub.includes('llantera movil') || sub.includes('llantera móvil') || sub.includes('auxilio de llanta')) {
      return [
        '¿Necesitas el servicio en este momento?',
        '¿También buscas llantera física cercana?',
        '¿Quieres ver cuáles atienden en carretera?',
        '¿También necesitas grúa o auxilio vial?',
        '¿Buscas el más cercano disponible ahora?',
      ];
    }

    if (sub.includes('llantera')) {
      return [
        '¿Buscas llantas nuevas o usadas?',
        '¿Quieres ver cuáles incluyen balanceo gratis?',
        '¿También necesitas alineación?',
        '¿Buscas rines también?',
        '¿Quieres ver las promociones disponibles?',
        '¿Buscas llantera móvil a domicilio?',
      ];
    }

    if (sub.includes('autolavado') || sub.includes('lavado de auto')) {
      return [
        '¿Buscas autolavado con detallado completo?',
        '¿Quieres ver cuáles incluyen interior?',
        '¿También buscas pulido o encerado?',
        '¿Buscas lavado express rápido?',
        '¿Quieres ver los precios disponibles?',
      ];
    }

    if (sub.includes('alineacion') || sub.includes('balanceo')) {
      return [
        '¿También necesitas cambio de llantas?',
        '¿Quieres ver cuáles incluyen revisión de suspensión?',
        '¿Buscas el más cercano abierto ahora?',
        '¿También buscas diagnóstico de manejo?',
        '¿Quieres ver los precios aproximados?',
      ];
    }

    if (sub.includes('hojalateria') || sub.includes('pintura automotriz')) {
      return [
        '¿Buscas reparación de golpes o raspones?',
        '¿Quieres ver cuáles hacen pintura al original?',
        '¿También necesitas cambio de vidrios?',
        '¿Buscas el servicio con garantía de trabajo?',
        '¿Quieres ver presupuesto sin compromiso?',
      ];
    }

    if (sub.includes('grua') || sub.includes('grúa') || sub.includes('auxilio vial')) {
      return [
        '¿Necesitas la grúa en este momento?',
        '¿Quieres ver cuáles atienden las 24 horas?',
        '¿También buscas mecánico de emergencia?',
        '¿Buscas la grúa más cercana disponible?',
        '¿Necesitas traslado a taller específico?',
      ];
    }

    if (sub.includes('cambio de aceite') || (sub.includes('aceite') && cat.includes('automotriz'))) {
      return [
        '¿Buscas cambio de aceite con revisión incluida?',
        '¿Quieres ver cuáles usan aceite sintético?',
        '¿También necesitas cambio de filtros?',
        '¿Buscas el más cercano abierto ahora?',
        '¿Quieres ver los precios disponibles?',
      ];
    }

    if (sub.includes('diagnostico') || sub.includes('electrico automotriz') || sub.includes('scanner')) {
      return [
        '¿Buscas diagnóstico computarizado con escáner OBD2?',
        '¿Quieres ver cuáles también reparan la falla?',
        '¿También necesitas mecánico general?',
        '¿Buscas servicio de urgencia para tu carro?',
        '¿Quieres ver los precios del diagnóstico?',
      ];
    }

    if (sub.includes('refaccionaria') || sub.includes('autopart')) {
      return [
        '¿Buscas refacciones para tu marca de auto?',
        '¿Quieres ver cuáles tienen entrega a domicilio?',
        '¿También buscas accesorios para carro?',
        '¿Buscas batería o filtros?',
        '¿Quieres ver las que están abiertas ahora?',
      ];
    }

    // ── TIENDAS Y NEGOCIOS ────────────────────────────────────────────────────

    if (sub.includes('abarrote') || sub.includes('miscelanea') || sub.includes('tiendita')) {
      return [
        '¿Buscas tienda con delivery a domicilio?',
        '¿Quieres ver cuáles tienen refresco frío?',
        '¿También buscas cigarros o botanas?',
        '¿Buscas la más cercana abierta ahora?',
        `¿Necesitas algo más cerca de ti en ${ciudad}?`,
      ];
    }

    if (sub.includes('supermercado') || sub.includes('super ')) {
      return [
        '¿Buscas súper con servicio a domicilio?',
        '¿Quieres ver cuáles tienen frutas y verduras frescas?',
        '¿También buscas carnicería o deli?',
        '¿Buscas el más cercano con estacionamiento?',
        '¿Quieres ver las promociones de la semana?',
      ];
    }

    if (sub.includes('ropa') || sub.includes('boutique')) {
      return [
        '¿Buscas ropa para mujer, hombre o infantil?',
        '¿Quieres ver cuáles tienen promociones?',
        '¿También buscas zapatos o accesorios?',
        '¿Buscas ropa vaquera o deportiva?',
        `¿Quieres ver las boutiques en ${ciudad}?`,
      ];
    }

    if (sub.includes('zapateria') || sub.includes('zapatos') || sub.includes('calzado')) {
      return [
        '¿Buscas tenis, botas o zapatos formales?',
        '¿Quieres ver cuáles tienen tu talla disponible?',
        '¿También buscas calzado para niños?',
        '¿Buscas botas vaqueras?',
        '¿Quieres ver las promociones disponibles?',
      ];
    }

    if (sub.includes('sombrer') || sub.includes('gorra') || sub.includes('cachucha')) {
      return [
        '¿Buscas sombrero vaquero o de paja?',
        '¿Quieres ver cuáles tienen gorras bordadas?',
        '¿También buscas accesorios vaqueros?',
        '¿Buscas el más cercano abierto ahora?',
        '¿Te gustaría ver los precios disponibles?',
      ];
    }

    if (sub.includes('electronica') || sub.includes('electrónica') || sub.includes('laptop') || sub.includes('computadora')) {
      return [
        '¿Buscas laptops, pantallas o bocinas?',
        '¿Quieres ver cuáles tienen meses sin intereses?',
        '¿También buscas consolas o accesorios?',
        '¿Buscas electrónica con garantía?',
        '¿Quieres ver las promociones disponibles?',
      ];
    }

    if ((sub.includes('celular') || sub.includes('telefono')) && (cat.includes('tienda') || cat.includes('tecnolog'))) {
      return [
        '¿Buscas celular nuevo o de segunda?',
        '¿Quieres ver cuáles tienen micas o fundas?',
        '¿También buscas recargas o accesorios?',
        '¿Buscas celulares liberados?',
        '¿Quieres ver los precios disponibles?',
      ];
    }

    if (sub.includes('papeleria') || sub.includes('utiles')) {
      return [
        '¿Buscas impresiones o fotocopias?',
        '¿Quieres ver cuáles tienen plastificado?',
        '¿También buscas útiles escolares?',
        '¿Buscas la más cercana abierta ahora?',
        '¿Te interesan los servicios de encuadernado?',
      ];
    }

    if (sub.includes('regalo') || sub.includes('peluche') || sub.includes('globo')) {
      return [
        '¿Buscas regalos personalizados?',
        '¿Quieres ver cuáles hacen arreglos de globos?',
        '¿También buscas envolturas de regalo?',
        '¿Buscas regalos para niños o adultos?',
        `¿Quieres ver tiendas de regalos en ${ciudad}?`,
      ];
    }

    if (sub.includes('naturista') || sub.includes('suplemento') || sub.includes('herba')) {
      return [
        '¿Buscas suplementos o vitaminas?',
        '¿Quieres ver cuáles tienen tés medicinales?',
        '¿También buscas productos para bajar de peso?',
        '¿Buscas atención personalizada de un naturista?',
        '¿Quieres ver las opciones disponibles?',
      ];
    }

    if (sub.includes('cosmetico') || sub.includes('maquillaje') && cat.includes('tienda')) {
      return [
        '¿Buscas cosméticos de marca o genéricos?',
        '¿Quieres ver cuáles tienen cuidado para la piel?',
        '¿También buscas productos para uñas?',
        '¿Buscas tienda con asesoría de imagen?',
        '¿Quieres ver las promociones disponibles?',
      ];
    }

    if (sub.includes('purificadora') || sub.includes('garrafon') || sub.includes('garrafón')) {
      return [
        '¿Buscas purificadora con entrega a domicilio?',
        '¿Quieres ver cuáles tienen garrafón de 20 litros?',
        '¿Buscas la más cercana a ti?',
        '¿También buscas agua embotellada en presentaciones pequeñas?',
        '¿Quieres ver los precios disponibles?',
      ];
    }

    if (sub.includes('mercado') || sub.includes('tianguis') || sub.includes('bazar')) {
      return [
        '¿Buscas mercado con verduras o frutas frescas?',
        '¿Quieres ver cuáles tienen comida de mercado?',
        '¿También buscas ropa de segunda o remates?',
        `¿Hay otro mercado que quieras buscar en ${ciudad}?`,
        '¿Buscas los días de tianguis disponibles?',
      ];
    }

    if (sub.includes('licoreria') || sub.includes('licorería') || sub.includes('caguameria') || sub.includes('vinos y licores')) {
      return [
        '¿Buscas caguamas o cerveza fría?',
        '¿Quieres ver cuáles tienen vinos o mezcal?',
        '¿También buscas hielo o botanas?',
        '¿Buscas la más cercana abierta ahora?',
        '¿Quieres ver las que entregan a domicilio?',
      ];
    }

    if (sub.includes('ferreteria') || sub.includes('ferretería') || sub.includes('tlapaleria') || sub.includes('herramienta')) {
      return [
        '¿Buscas herramientas o materiales de construcción?',
        '¿Quieres ver cuáles tienen pintura para paredes?',
        '¿También buscas material eléctrico o de plomería?',
        '¿Buscas la más cercana abierta ahora?',
        '¿Quieres ver los precios disponibles?',
      ];
    }

    if (sub.includes('carniceria') || sub.includes('carnicería') || sub.includes('carne ')) {
      return [
        '¿Buscas carnicería con carne para asar?',
        '¿Quieres ver cuáles tienen chorizo o longaniza?',
        '¿También buscas pollo fresco?',
        '¿Buscas la más cercana abierta ahora?',
        '¿Quieres ver los precios disponibles?',
      ];
    }

    if (sub.includes('tienda de mascota') || sub.includes('petshop') || sub.includes('pet shop') || sub.includes('croqueta')) {
      return [
        '¿Buscas alimento premium para tu mascota?',
        '¿Quieres ver cuáles tienen accesorios?',
        '¿También buscas juguetes o camas?',
        '¿Buscas tienda con veterinaria incluida?',
        '¿Quieres ver las promociones disponibles?',
      ];
    }

    // ── BELLEZA Y BIENESTAR ───────────────────────────────────────────────────

    if (sub.includes('barberia') || sub.includes('barbería') || sub.includes('corte de hombre')) {
      return [
        '¿Buscas barbería con arreglo de barba?',
        '¿Quieres ver cuáles hacen fade o degradado?',
        '¿También buscas tratamiento capilar?',
        '¿Buscas la más cercana abierta ahora?',
        '¿Quieres ver cuáles tienen cita disponible?',
        '¿Te interesan los precios?',
      ];
    }

    if ((sub.includes('salon') || sub.includes('salón')) && sub.includes('belleza')) {
      return [
        '¿Buscas salón con tinte o decoloración?',
        '¿Quieres ver cuáles hacen keratina?',
        '¿También buscas peinados para eventos?',
        '¿Buscas el más cercano abierto ahora?',
        '¿Quieres ver cuáles tienen cita disponible?',
        '¿Te interesan las promociones?',
      ];
    }

    if ((sub.includes('estetica') || sub.includes('estética') || sub.includes('peluqueria') || sub.includes('peluquería')) && !cat.includes('mascota')) {
      return [
        '¿Buscas estética con servicio a domicilio?',
        '¿Quieres ver cuáles tienen keratina o alaciado?',
        '¿También buscas tinte o coloración?',
        '¿Buscas la más cercana abierta ahora?',
        '¿Quieres ver los precios disponibles?',
      ];
    }

    if (sub.includes('unas') || sub.includes('uñas') || sub.includes('manicure') || sub.includes('pedicure')) {
      return [
        '¿Buscas uñas acrílicas o gelish?',
        '¿Quieres ver cuáles hacen diseños artísticos?',
        '¿También buscas pedicure?',
        '¿Buscas el más cercano abierto ahora?',
        '¿Quieres ver los precios disponibles?',
        '¿También te interesan los spas de pies?',
      ];
    }

    if (sub.includes('spa') && !sub.includes('mascota')) {
      return [
        '¿Buscas spa con masaje relajante?',
        '¿Quieres ver cuáles tienen tratamiento facial?',
        '¿También buscas baño de vapor o exfoliación?',
        '¿Buscas paquetes para pareja?',
        '¿Quieres ver los precios y disponibilidad?',
      ];
    }

    if (sub.includes('masaje') || sub.includes('masajes')) {
      return [
        '¿Buscas masaje descontracturante o relajante?',
        '¿Quieres ver cuáles tienen masaje deportivo?',
        '¿También buscas masaje a domicilio?',
        '¿Buscas masaje de tejido profundo?',
        '¿Quieres ver los precios disponibles?',
      ];
    }

    if (sub.includes('gimnasio') || sub.includes('gym') || sub.includes('crossfit') || sub.includes('fitness')) {
      return [
        '¿Buscas gimnasio con entrenador personal?',
        '¿Quieres ver cuáles tienen clases grupales?',
        '¿También buscas crossfit o funcional?',
        '¿Buscas membresía mensual o pase de día?',
        '¿Quieres ver los precios y horarios?',
      ];
    }

    if (sub.includes('yoga')) {
      return [
        '¿Buscas clases de yoga para principiantes?',
        '¿Quieres ver cuáles tienen yoga terapéutico?',
        '¿También buscas meditación o mindfulness?',
        '¿Buscas clases virtuales o presenciales?',
        '¿Quieres ver los horarios disponibles?',
      ];
    }

    if (sub.includes('pilates')) {
      return [
        '¿Buscas pilates con reformer o mat?',
        '¿Quieres ver cuáles tienen pilates terapéutico?',
        '¿También buscas yoga o clases de estiramiento?',
        '¿Buscas clases privadas o grupales?',
        '¿Quieres ver los horarios y precios?',
      ];
    }

    if (sub.includes('clinica estetica') || sub.includes('clínica estética') || sub.includes('botox')) {
      return [
        '¿Buscas clínica con botox o rellenos faciales?',
        '¿Quieres ver cuáles tienen tratamiento antiacné?',
        '¿También buscas depilación láser?',
        '¿Buscas valoración gratuita?',
        '¿Quieres ver los precios disponibles?',
      ];
    }

    if (sub.includes('depilacion') || sub.includes('depilación')) {
      return [
        '¿Buscas depilación láser o con cera?',
        '¿Quieres ver cuáles tienen depilación facial?',
        '¿También buscas depilación corporal completa?',
        '¿Buscas paquetes con descuento?',
        '¿Quieres ver los precios disponibles?',
      ];
    }

    if (sub.includes('maquillaje') || sub.includes('makeup') || sub.includes('cejas') || sub.includes('microblading') || sub.includes('pestana')) {
      return [
        '¿Buscas maquillaje para evento, boda o XV?',
        '¿Quieres ver cuáles hacen diseño de cejas?',
        '¿También buscas extensiones de pestañas?',
        '¿Buscas microblading o semipermanente?',
        '¿Quieres ver los precios disponibles?',
      ];
    }

    if (sub.includes('bronceado') || sub.includes('tanning') || sub.includes('solarium')) {
      return [
        '¿Buscas bronceado en cama o spray?',
        '¿Quieres ver cuáles tienen sesiones de solarium?',
        '¿También buscas tratamiento para la piel?',
        '¿Buscas el más cercano abierto ahora?',
        '¿Quieres ver los precios disponibles?',
      ];
    }

    // ── EDUCACIÓN Y CURSOS ────────────────────────────────────────────────────

    if (sub.includes('idioma') || sub.includes('ingles') || sub.includes('inglés') || sub.includes('frances')) {
      return [
        '¿Buscas clases de inglés para adultos o niños?',
        '¿Quieres ver cursos en línea o presenciales?',
        '¿También buscas otro idioma como francés o alemán?',
        '¿Buscas preparación para exámenes (TOEFL, Cambridge)?',
        '¿Quieres ver los precios y horarios?',
      ];
    }

    if (sub.includes('clases particulares') || sub.includes('asesoria') || sub.includes('asesoría') || sub.includes('regularizacion')) {
      return [
        '¿Buscas asesoría en matemáticas o física?',
        '¿Quieres ver maestros con clases a domicilio?',
        '¿También buscas preparación para exámenes?',
        '¿Buscas asesoría para niños o universitarios?',
        '¿Quieres ver los precios por hora?',
      ];
    }

    if (sub.includes('computacion') || sub.includes('computación') || sub.includes('excel') || sub.includes('informatica')) {
      return [
        '¿Buscas curso de Excel o Word?',
        '¿Quieres ver cursos de diseño gráfico también?',
        '¿También buscas clases de programación?',
        '¿Buscas curso en línea o presencial?',
        '¿Quieres ver los precios y horarios?',
      ];
    }

    if (sub.includes('musica') || sub.includes('música') || sub.includes('guitarra') || sub.includes('piano')) {
      return [
        '¿Buscas clases de guitarra, piano o batería?',
        '¿Quieres ver cuáles tienen clases de canto?',
        '¿También buscas clases para niños?',
        '¿Buscas clases particulares o grupales?',
        '¿Quieres ver los precios y horarios?',
      ];
    }

    if (sub.includes('baile') || sub.includes('academia de baile') || sub.includes('salsa') || sub.includes('bachata')) {
      return [
        '¿Buscas clases de salsa, bachata o urbano?',
        '¿Quieres ver cuáles tienen clases para principiantes?',
        '¿También buscas clases para niños?',
        '¿Buscas clases en pareja o individuales?',
        '¿Quieres ver los horarios y precios?',
      ];
    }

    if (sub.includes('arte') || sub.includes('pintura') && cat.includes('educaci') || sub.includes('dibujo')) {
      return [
        '¿Buscas clases de pintura o dibujo?',
        '¿Quieres ver cuáles tienen clases para niños?',
        '¿También buscas ilustración digital?',
        '¿Buscas taller o clases particulares?',
        '¿Quieres ver los precios y materiales incluidos?',
      ];
    }

    if (sub.includes('cocina') && cat.includes('curso') || sub.includes('reposteria')) {
      return [
        '¿Buscas curso de repostería o cocina mexicana?',
        '¿Quieres ver cuáles tienen talleres de fin de semana?',
        '¿También buscas clases de panadería artesanal?',
        '¿Buscas curso online o presencial?',
        '¿Quieres ver los precios e ingredientes incluidos?',
      ];
    }

    if (sub.includes('programacion') || sub.includes('programación') || sub.includes('desarrollo web') || sub.includes('python')) {
      return [
        '¿Buscas curso de desarrollo web o apps móviles?',
        '¿Quieres ver cuáles tienen Python o JavaScript?',
        '¿También buscas bootcamp intensivo?',
        '¿Buscas curso online o presencial?',
        '¿Quieres ver precios y certificaciones?',
      ];
    }

    if (sub.includes('manejo') || sub.includes('escuela de manejo') || sub.includes('licencia')) {
      return [
        '¿Buscas clases de manejo para principiantes?',
        '¿Quieres ver cuáles incluyen carro automático?',
        '¿También buscas manejo defensivo?',
        '¿Buscas preparación para el examen de licencia?',
        '¿Quieres ver los precios por clase?',
      ];
    }

    // ── HOGAR Y CONSTRUCCIÓN ──────────────────────────────────────────────────

    if (sub.includes('materiales de construccion') || sub.includes('materiales de construcción') || sub.includes('cemento') || sub.includes('block')) {
      return [
        '¿Buscas materiales para obra o remodelación?',
        '¿Quieres ver cuáles tienen entrega a domicilio?',
        '¿También buscas herramientas o andamios?',
        '¿Buscas block, tabique o varilla?',
        '¿Quieres ver los precios disponibles?',
      ];
    }

    if ((sub.includes('pintura') && cat.includes('hogar')) || sub.includes('tienda de pintura') || sub.includes('vinilica')) {
      return [
        '¿Buscas pintura vinílica o esmalte?',
        '¿Quieres ver cuáles mezclan colores personalizados?',
        '¿También buscas impermeabilizante?',
        '¿Buscas brochas, rodillos y accesorios?',
        '¿Quieres ver los precios disponibles?',
      ];
    }

    if (sub.includes('plomero') || sub.includes('plomeria') || sub.includes('plomería') || sub.includes('fuga de agua') || sub.includes('drenaje')) {
      return [
        '¿Buscas plomero con servicio de urgencia?',
        '¿Quieres ver cuáles atienden los fines de semana?',
        '¿También buscas destape de drenaje?',
        '¿Buscas el más cercano disponible ahora?',
        '¿Quieres ver los precios aproximados?',
      ];
    }

    if (sub.includes('electricista') || sub.includes('instalacion electrica') || sub.includes('instalación eléctrica') || sub.includes('corto')) {
      return [
        '¿Buscas electricista de urgencia?',
        '¿Quieres ver cuáles hacen instalaciones nuevas?',
        '¿También buscas mantenimiento preventivo?',
        '¿Buscas el más cercano disponible ahora?',
        '¿Quieres ver los precios aproximados?',
      ];
    }

    if (sub.includes('carpinteria') || sub.includes('carpintería') || sub.includes('muebles de madera') || sub.includes('closet')) {
      return [
        '¿Buscas carpintero para closets o cocinas?',
        '¿Quieres ver cuáles hacen muebles a medida?',
        '¿También buscas reparación de puertas o ventanas?',
        '¿Buscas trabajo con garantía?',
        '¿Quieres ver presupuesto sin compromiso?',
      ];
    }

    if (sub.includes('albanil') || sub.includes('albañil') || sub.includes('remodelacion') || sub.includes('remodelación')) {
      return [
        '¿Buscas albañil para construcción o remodelación?',
        '¿Quieres ver cuáles tienen experiencia en acabados?',
        '¿También buscas pintor o plomero?',
        '¿Buscas trabajo con presupuesto incluido?',
        '¿Quieres ver los precios aproximados?',
      ];
    }

    if (sub.includes('cerrajeria') || sub.includes('cerrajería') || sub.includes('chapa') || sub.includes('duplicado de llave')) {
      return [
        '¿Necesitas abrir puerta de urgencia?',
        '¿Buscas duplicado de llaves?',
        '¿También buscas cambio de chapa de seguridad?',
        '¿Buscas el más cercano disponible ahora?',
        '¿Quieres ver los precios disponibles?',
      ];
    }

    if (sub.includes('herreria') || sub.includes('herrería') || sub.includes('protecciones') || sub.includes('porton')) {
      return [
        '¿Buscas herrería para protecciones o portones?',
        '¿Quieres ver cuáles hacen barandales?',
        '¿También buscas soldadura o estructuras metálicas?',
        '¿Buscas cotización sin compromiso?',
        '¿Quieres ver trabajos con garantía?',
      ];
    }

    if (sub.includes('impermeabiliz') || sub.includes('filtracion') || sub.includes('azotea')) {
      return [
        '¿Buscas impermeabilización de techo o azotea?',
        '¿Quieres ver cuáles tienen garantía de años?',
        '¿También buscas sellado de grietas o filtraciones?',
        '¿Buscas visita de diagnóstico gratuita?',
        '¿Quieres ver los precios aproximados?',
      ];
    }

    if (sub.includes('vidriera') || sub.includes('vidriería') || sub.includes('cancel de bano') || sub.includes('vidrio templado')) {
      return [
        '¿Buscas cancel de baño o vidrio templado?',
        '¿Quieres ver cuáles hacen espejos a medida?',
        '¿También buscas ventanas de aluminio?',
        '¿Buscas instalación con garantía?',
        '¿Quieres ver los precios disponibles?',
      ];
    }

    if (sub.includes('instalacion de pisos') || sub.includes('piso ceramico') || sub.includes('laminado') || (sub.includes('piso') && cat.includes('hogar'))) {
      return [
        '¿Buscas instalación de piso cerámico o laminado?',
        '¿Quieres ver cuáles incluyen el material?',
        '¿También buscas nivelación de superficie?',
        '¿Buscas piso vinílico o alfombra?',
        '¿Quieres ver los precios por metro cuadrado?',
      ];
    }

    if (sub.includes('aire acondicionado') || sub.includes('minisplit') || sub.includes('mini split') || sub.includes('clima')) {
      return [
        '¿Buscas instalación de minisplit?',
        '¿Quieres ver cuáles hacen mantenimiento o recarga de gas?',
        '¿También buscas reparación de aire acondicionado?',
        '¿Buscas servicio de urgencia?',
        '¿Quieres ver los precios disponibles?',
      ];
    }

    if (sub.includes('electrodomestico') || sub.includes('electrodoméstico') || sub.includes('lavadora') || sub.includes('refrigerador')) {
      return [
        '¿Buscas reparación de lavadora o refrigerador?',
        '¿Quieres ver cuáles reparan microondas o estufas?',
        '¿También buscas servicio a domicilio?',
        '¿Buscas el más cercano disponible ahora?',
        '¿Quieres ver los precios de diagnóstico?',
      ];
    }

    if (sub.includes('jardineria') || sub.includes('jardinería') || sub.includes('jardinero') || sub.includes('poda')) {
      return [
        '¿Buscas jardinero con servicio periódico?',
        '¿Quieres ver cuáles hacen diseño de jardines?',
        '¿También buscas poda de árboles grandes?',
        '¿Buscas instalación de pasto?',
        '¿Quieres ver los precios disponibles?',
      ];
    }

    if (sub.includes('fumig') || sub.includes('plagas') || sub.includes('cucaracha') || sub.includes('termita')) {
      return [
        '¿Buscas fumigación de urgencia?',
        '¿Quieres ver cuáles controlan termitas o cucarachas?',
        '¿También buscas desinfección del hogar?',
        '¿Buscas servicio con garantía?',
        '¿Quieres ver los precios disponibles?',
      ];
    }

    if (sub.includes('limpieza del hogar') || sub.includes('servicio de limpieza') || sub.includes('mucama') || sub.includes('intendencia')) {
      return [
        '¿Buscas servicio de limpieza semanal o mensual?',
        '¿Quieres ver cuáles tienen limpieza de fin de obra?',
        '¿También buscas planchado o lavandería?',
        '¿Buscas servicio con personal verificado?',
        '¿Quieres ver los precios por hora o por servicio?',
      ];
    }

    if (sub.includes('mudanza') || sub.includes('flete') || sub.includes('cargadores')) {
      return [
        '¿Buscas mudanza local o a otra ciudad?',
        '¿Quieres ver cuáles tienen camión y personal?',
        '¿También buscas guardado de muebles?',
        '¿Buscas el más económico disponible?',
        '¿Quieres ver los precios aproximados?',
      ];
    }

    if (sub.includes('servicios del hogar') || sub.includes('mantenimiento del hogar') || sub.includes('servicio a domicilio hogar')) {
      return [
        '¿Buscas plomero, electricista o albañil?',
        '¿Quieres ver cuáles atienden hoy mismo?',
        '¿También buscas fumigación o jardinería?',
        '¿Buscas el servicio más urgente para tu hogar?',
        `¿Necesitas otro servicio a domicilio en ${ciudad}?`,
      ];
    }

    // ── MASCOTAS ──────────────────────────────────────────────────────────────

    if (sub.includes('veterinaria') || sub.includes('veterinario') || (sub.includes('clinica') && cat.includes('mascota'))) {
      return [
        '¿Buscas veterinaria con urgencias 24 horas?',
        '¿Quieres ver cuáles tienen vacunación?',
        '¿También buscas desparasitación?',
        '¿Buscas veterinario a domicilio?',
        '¿Quieres ver los precios de consulta?',
      ];
    }

    if (sub.includes('estetica canina') || sub.includes('estética canina') || sub.includes('bano para perro') || sub.includes('baño para perro')) {
      return [
        '¿Buscas estética canina con baño y corte?',
        '¿Quieres ver cuáles hacen limpieza de oídos?',
        '¿También buscas corte para gatos?',
        '¿Buscas servicio a domicilio?',
        '¿Quieres ver los precios disponibles?',
      ];
    }

    if (sub.includes('peluqueria') && cat.includes('mascota') || sub.includes('peluquerias para mascota') || sub.includes('estilista canina') || sub.includes('grooming')) {
      return [
        '¿Buscas peluquería para perro o gato?',
        '¿Quieres ver cuáles hacen corte y baño en el mismo servicio?',
        '¿También buscas tintura o accesorios de grooming?',
        '¿Buscas servicio a domicilio para tu mascota?',
        '¿Quieres ver los precios disponibles?',
      ];
    }

    if (sub.includes('adiestramiento') || sub.includes('entrenamiento de perro') || sub.includes('obediencia canina')) {
      return [
        '¿Buscas adiestramiento básico o avanzado?',
        '¿Quieres ver cuáles hacen corrección de conducta?',
        '¿También buscas clases en casa?',
        '¿Buscas adiestramiento para cachorros?',
        '¿Quieres ver los precios y métodos?',
      ];
    }

    if (sub.includes('paseador') || sub.includes('pasear perro')) {
      return [
        '¿Buscas paseador diario o esporádico?',
        '¿Quieres ver cuáles hacen paseo grupal?',
        '¿También buscas guardería para tu mascota?',
        '¿Buscas el más cercano disponible?',
        '¿Quieres ver los precios por paseo?',
      ];
    }

    if (sub.includes('guarderia para mascota') || sub.includes('hotel para mascota') || sub.includes('hotel canino') || sub.includes('hospedaje para perro')) {
      return [
        '¿Buscas guardería de día o por las noches?',
        '¿Quieres ver cuáles tienen área de juego?',
        '¿También buscas hotel para tus vacaciones?',
        '¿Buscas cuidado para perro o gato?',
        '¿Quieres ver los precios disponibles?',
      ];
    }

    if (sub.includes('alimento para mascota') || sub.includes('croqueta') || (sub.includes('alimento') && cat.includes('mascota'))) {
      return [
        '¿Buscas croquetas premium o comida húmeda?',
        '¿Quieres ver cuáles tienen alimento para gatos también?',
        '¿También buscas snacks o premios para tu mascota?',
        '¿Buscas la tienda más cercana?',
        '¿Quieres ver los precios disponibles?',
      ];
    }

    if (sub.includes('accesorio') && cat.includes('mascota')) {
      return [
        '¿Buscas correa, collar o arnés?',
        '¿Quieres ver cuáles tienen camas o juguetes?',
        '¿También buscas ropa o disfraces para tu mascota?',
        '¿Buscas accesorios para perro o gato?',
        '¿Quieres ver los precios disponibles?',
      ];
    }

    if (sub.includes('veterinario a domicilio') || sub.includes('veterinaria a domicilio') || (sub.includes('veterinari') && sub.includes('domicilio'))) {
      return [
        '¿Buscas veterinario a domicilio para urgencias?',
        '¿Quieres ver cuáles hacen vacunación en casa?',
        '¿También buscas desparasitación a domicilio?',
        '¿Buscas el disponible más cercano?',
        '¿Quieres ver los precios de visita?',
      ];
    }

    // ── ENTRETENIMIENTO ───────────────────────────────────────────────────────

    if (sub.includes('cine')) {
      return [
        '¿Buscas cine VIP o sala normal?',
        '¿Quieres ver la cartelera disponible?',
        '¿También buscas funciones para toda la familia?',
        '¿Buscas el más cercano a ti?',
        '¿Quieres ver los horarios y precios?',
      ];
    }

    if (sub.includes('antro') || sub.includes('discoteca') || sub.includes('club nocturno')) {
      return [
        '¿Buscas antro con DJ o música en vivo?',
        '¿Quieres ver cuáles tienen cover o entrada libre?',
        '¿También buscas bar o lounge?',
        `¿Quieres ver los antros de moda en ${ciudad}?`,
        '¿Buscas antro LGBT friendly?',
      ];
    }

    if (sub.includes('karaoke')) {
      return [
        '¿Buscas karaoke con cabinas privadas?',
        '¿Quieres ver cuáles tienen bar incluido?',
        '¿También buscas karaoke familiar?',
        '¿Buscas el más cercano abierto ahora?',
        '¿Quieres ver los precios disponibles?',
      ];
    }

    if (sub.includes('billar')) {
      return [
        '¿Buscas billar con bar?',
        '¿Quieres ver cuáles tienen torneos?',
        '¿También buscas billar familiar?',
        '¿Buscas el más cercano abierto ahora?',
        '¿Quieres ver los precios por hora?',
      ];
    }

    if (sub.includes('boliche') || sub.includes('bowling')) {
      return [
        '¿Buscas boliche familiar o nocturno?',
        '¿Quieres ver cuáles tienen restaurante incluido?',
        '¿También buscas otras actividades familiares?',
        '¿Buscas el más cercano abierto ahora?',
        '¿Quieres ver los precios disponibles?',
      ];
    }

    if ((sub.includes('salon') && sub.includes('evento')) || sub.includes('salón de evento') || sub.includes('boda') || sub.includes('quinceañera')) {
      return [
        '¿Buscas salón para boda, XV o cumpleaños?',
        '¿Quieres ver cuáles incluyen banquete?',
        '¿También buscas salón para eventos corporativos?',
        '¿Buscas capacidad para cuántas personas?',
        '¿Quieres ver los precios disponibles?',
      ];
    }

    if (sub.includes('teatro')) {
      return [
        '¿Buscas teatro con obras musicales o dramáticas?',
        '¿Quieres ver cuáles tienen funciones infantiles?',
        '¿También buscas shows de comedia o stand-up?',
        '¿Buscas la cartelera disponible?',
        '¿Quieres ver los precios de boletos?',
      ];
    }

    if (sub.includes('entretenimiento familiar') || sub.includes('trampolines') || sub.includes('centro familiar')) {
      return [
        '¿Buscas entretenimiento para niños o toda la familia?',
        '¿Quieres ver cuáles tienen trampolines o juegos?',
        '¿También buscas parques de diversiones?',
        `¿Quieres ver opciones para este fin de semana en ${ciudad}?`,
        '¿Buscas el más cercano abierto ahora?',
      ];
    }

    if (sub.includes('escape room') || (sub.includes('experienci') && sub.includes('recreativ')) || sub.includes('realidad virtual')) {
      return [
        '¿Buscas escape room para amigos o familia?',
        '¿Quieres ver cuáles tienen realidad virtual?',
        '¿También buscas otras experiencias interactivas?',
        '¿Buscas el más cercano disponible?',
        '¿Quieres ver los precios y duración?',
      ];
    }

    if (sub.includes('parque recreativ') || sub.includes('parque de diversion') || sub.includes('parque de diversiones') || sub.includes('parques de diversion')) {
      return [
        '¿Buscas parque para niños o familiar?',
        `¿Quieres ver opciones de actividades al aire libre en ${ciudad}?`,
        '¿También buscas áreas deportivas?',
        '¿Buscas el más cercano a ti?',
        '¿Quieres ver los horarios y acceso?',
      ];
    }

    if (sub.includes('videojuego') || sub.includes('arcade') || sub.includes('maquinita')) {
      return [
        '¿Buscas arcade con maquinitas de última generación?',
        '¿Quieres ver cuáles tienen realidad virtual?',
        '¿También buscas entretenimiento familiar completo?',
        '¿Buscas el más cercano abierto ahora?',
        '¿Quieres ver los precios por tiempo o token?',
      ];
    }

    if (sub.includes('concierto') || sub.includes('evento musical') || sub.includes('show') || sub.includes('espectaculo') || sub.includes('espectáculo')) {
      return [
        `¿Quieres ver los eventos disponibles en ${ciudad}?`,
        '¿Buscas concierto, show de comedia o teatro?',
        '¿También buscas festivales o eventos al aire libre?',
        '¿Buscas boletos para algún evento próximo?',
        '¿Quieres ver los precios disponibles?',
      ];
    }

    // ── TURISMO Y VIAJES ──────────────────────────────────────────────────────

    if (sub.includes('hotel') && (cat.includes('turismo') || cat.includes('viaje') || cat.includes('hospedaje'))) {
      return [
        '¿Buscas hotel con alberca o jacuzzi?',
        '¿Quieres ver cuáles son pet friendly?',
        '¿También buscas hotel con desayuno incluido?',
        '¿Buscas hotel de negocios o vacacional?',
        '¿Quieres ver los precios por noche?',
        '¿Buscas hotel céntrico o en la playa?',
      ];
    }

    if (sub.includes('hostal') || sub.includes('hostel')) {
      return [
        '¿Buscas hostal céntrico o económico?',
        '¿Quieres ver cuáles tienen habitaciones privadas?',
        '¿También buscas departamento vacacional?',
        '¿Buscas el mejor precio por noche?',
        '¿Quieres ver las reseñas disponibles?',
      ];
    }

    if (sub.includes('cabana') || sub.includes('cabaña')) {
      return [
        '¿Buscas cabaña en bosque, montaña o playa?',
        '¿Quieres ver cuáles son para parejas o familias?',
        '¿También buscas campamento o glamping?',
        '¿Buscas con o sin servicios incluidos?',
        '¿Quieres ver los precios por noche?',
      ];
    }

    if (sub.includes('departamento') && sub.includes('vacacional') || sub.includes('airbnb') || sub.includes('renta vacacional')) {
      return [
        '¿Buscas departamento con cocina equipada?',
        '¿Quieres ver cuáles tienen alberca o terraza?',
        '¿También buscas hotel o cabaña?',
        '¿Buscas para cuántas personas?',
        '¿Quieres ver los precios por noche?',
      ];
    }

    if (sub.includes('agencia') && (sub.includes('viaje') || sub.includes('turismo')) || sub.includes('paquete vacacional')) {
      return [
        '¿Buscas paquete vacacional nacional o internacional?',
        '¿Quieres ver cuáles incluyen vuelo y hotel?',
        '¿También buscas cruceros o tours?',
        '¿Buscas viaje en semana santa o verano?',
        '¿Quieres ver los precios disponibles?',
      ];
    }

    if (sub.includes('tour') || sub.includes('guia turistico') || sub.includes('guías turistico') || (sub.includes('guia') && sub.includes('turistico'))) {
      return [
        '¿Buscas tour gastronómico, cultural o de aventura?',
        '¿Quieres ver cuáles son en español o inglés?',
        '¿También buscas tour privado o grupal?',
        '¿Buscas el horario disponible para hoy?',
        '¿Quieres ver los precios por persona?',
      ];
    }

    if (sub.includes('renta de auto') || sub.includes('renta autos') || sub.includes('alquiler de auto')) {
      return [
        '¿Buscas renta de auto económico o familiar?',
        '¿Quieres ver cuáles incluyen seguro?',
        '¿También buscas transporte privado?',
        '¿Buscas renta por día o semana?',
        '¿Quieres ver los precios disponibles?',
      ];
    }

    if (sub.includes('aventura') || sub.includes('tirolesa') || sub.includes('rapel') || sub.includes('kayak')) {
      return [
        '¿Buscas tirolesa, rapel o senderismo?',
        '¿Quieres ver cuáles incluyen equipo?',
        '¿También buscas kayak o actividades acuáticas?',
        '¿Buscas actividad para grupos o familias?',
        '¿Quieres ver los precios por persona?',
      ];
    }

    if (sub.includes('ecoturismo') || sub.includes('turismo ecologico') || sub.includes('observacion de aves')) {
      return [
        '¿Buscas tour de observación de aves o fauna?',
        '¿Quieres ver cuáles son sustentables?',
        '¿También buscas senderismo o camping?',
        '¿Buscas guía local bilingüe?',
        '¿Quieres ver los precios disponibles?',
      ];
    }

    if (sub.includes('campamento') || sub.includes('camping') || sub.includes('acampar')) {
      return [
        '¿Buscas camping familiar o de aventura?',
        '¿Quieres ver cuáles tienen servicios incluidos?',
        '¿También buscas glamping?',
        '¿Buscas renta de equipo de camping?',
        '¿Quieres ver los precios por noche?',
      ];
    }

    if (sub.includes('cuatrimoto') || sub.includes('atv') || sub.includes('renta de cuatrimoto')) {
      return [
        '¿Buscas renta de cuatrimotos en playa o campo?',
        '¿Quieres ver cuáles incluyen tour guiado?',
        '¿También buscas renta de lanchas?',
        '¿Buscas para cuántas personas?',
        '¿Quieres ver los precios por hora?',
      ];
    }

    if (sub.includes('renta de lancha') || sub.includes('lancha') || sub.includes('tour en lancha')) {
      return [
        '¿Buscas lancha para tour o pesca deportiva?',
        '¿Quieres ver cuáles incluyen equipo de pesca?',
        '¿También buscas renta de cuatrimotos?',
        '¿Buscas para cuántas personas?',
        '¿Quieres ver los precios disponibles?',
      ];
    }

    if (sub.includes('renta de bicicleta') || sub.includes('renta bicicleta') || sub.includes('bicicleta')) {
      return [
        '¿Buscas renta de bicicleta de montaña o de paseo?',
        '¿Quieres ver cuáles incluyen casco?',
        '¿También buscas tours en bicicleta?',
        '¿Buscas renta por hora o por día?',
        '¿Quieres ver los precios disponibles?',
      ];
    }

    if (sub.includes('transporte turistico') || sub.includes('transporte turístico') || sub.includes('traslado aeropuerto')) {
      return [
        '¿Buscas traslado al aeropuerto o a la zona hotelera?',
        '¿Quieres ver cuáles tienen unidades cómodas?',
        '¿También buscas renta de autos?',
        '¿Buscas transporte privado o compartido?',
        '¿Quieres ver los precios disponibles?',
      ];
    }

    if ((sub.includes('parque') && sub.includes('turistico')) || sub.includes('zona arqueologica') || sub.includes('museo')) {
      return [
        `¿Quieres ver los atractivos turísticos de ${ciudad}?`,
        '¿Buscas parque natural, museo o zona arqueológica?',
        '¿También buscas tours guiados?',
        '¿Buscas el más cercano a ti?',
        '¿Quieres ver los horarios y precios de entrada?',
      ];
    }

    if (sub.includes('mirador') || sub.includes('miradores')) {
      return [
        `¿Buscas mirador con vista panorámica de ${ciudad}?`,
        '¿Quieres ver cuáles tienen restaurante o bar con vista?',
        '¿También buscas tours fotográficos?',
        '¿Buscas el más cercano a ti?',
        '¿Quieres ver los horarios de acceso?',
      ];
    }

    // ── TECNOLOGÍA ────────────────────────────────────────────────────────────

    if (
      (sub.includes('celular') || sub.includes('telefono') || sub.includes('laptop') || sub.includes('computadora')) &&
      (cat.includes('tecnolog') || cat.includes('reparacion') || cat.includes('reparación'))
    ) {
      return [
        '¿Buscas reparación de pantalla o batería?',
        '¿Quieres ver cuáles tienen servicio el mismo día?',
        '¿También buscas accesorios o fundas?',
        '¿Buscas reparación de laptops también?',
        '¿Quieres ver los precios de diagnóstico?',
      ];
    }

    if (sub.includes('internet') || sub.includes('wifi') || sub.includes('proveedor de internet') || sub.includes('servicio de internet')) {
      return [
        '¿Buscas proveedor de internet con fibra óptica?',
        '¿Quieres ver cuáles tienen planes sin contrato?',
        '¿También buscas soporte técnico a domicilio?',
        '¿Buscas el mejor plan por precio?',
        '¿Quieres ver los precios disponibles?',
      ];
    }

    if (sub.includes('gasolinera') || sub.includes('gasolina') || sub.includes('diesel') || sub.includes('combustible')) {
      return [
        '¿Buscas gasolinera abierta ahora?',
        '¿Quieres ver cuáles tienen servicio de auto?',
        '¿También buscas servicio de inflado de llantas?',
        '¿Buscas la más cercana a tu ruta?',
        '¿Quieres ver cuáles tienen tienda de conveniencia?',
      ];
    }

    // ── FALLBACKS POR CATEGORÍA PRINCIPAL ────────────────────────────────────

    if (cat.includes('salud')) {
      return [
        '¿Buscas médico, farmacia o laboratorio?',
        '¿Quieres ver servicios disponibles ahora?',
        '¿También buscas clínica o especialista?',
        '¿Buscas servicio a domicilio?',
        `¿Necesitas otra atención médica en ${ciudad}?`,
      ];
    }

    if (cat.includes('automotriz')) {
      return [
        '¿Buscas mecánico, llantera o autolavado?',
        '¿Quieres ver servicios de urgencia disponibles?',
        '¿También buscas refacciones o accesorios?',
        '¿Buscas el más cercano abierto ahora?',
        `¿Necesitas otro servicio para tu auto en ${ciudad}?`,
      ];
    }

    if (cat.includes('belleza') || cat.includes('bienestar')) {
      return [
        '¿Buscas estética, barbería o spa?',
        '¿Quieres ver cuáles están abiertos ahora?',
        '¿También buscas masajes o tratamientos?',
        '¿Buscas el más cercano a ti?',
        `¿Hay otro servicio de belleza que quieras en ${ciudad}?`,
      ];
    }

    if (cat.includes('hogar') || cat.includes('construccion') || cat.includes('construcción')) {
      return [
        '¿Buscas plomero, electricista o carpintero?',
        '¿Quieres ver servicios disponibles hoy?',
        '¿También buscas materiales de construcción?',
        '¿Buscas el más cercano disponible?',
        `¿Necesitas otro servicio para tu hogar en ${ciudad}?`,
      ];
    }

    if (cat.includes('mascota')) {
      return [
        '¿Buscas veterinaria, estética canina o alimento?',
        '¿Quieres ver los más cercanos a ti?',
        '¿También buscas guardería o paseador?',
        '¿Buscas servicio a domicilio para tu mascota?',
        `¿Necesitas otra cosa para tu mascota en ${ciudad}?`,
      ];
    }

    if (cat.includes('educaci') || cat.includes('curso')) {
      return [
        '¿Buscas clases, cursos o talleres?',
        '¿Quieres ver opciones presenciales o en línea?',
        '¿También buscas clases para niños o adultos?',
        '¿Buscas el horario disponible?',
        `¿Necesitas otro curso o capacitación en ${ciudad}?`,
      ];
    }

    if (cat.includes('turismo') || cat.includes('hospedaje') || cat.includes('viaje')) {
      return [
        '¿Buscas hotel, tour o actividad de aventura?',
        '¿Quieres ver opciones para este fin de semana?',
        '¿También buscas paquetes vacacionales?',
        `¿Qué más te gustaría descubrir en ${ciudad}?`,
        '¿Buscas opciones para toda la familia?',
      ];
    }

    if (cat.includes('entretenimiento')) {
      return [
        '¿Buscas cine, antro, karaoke o boliche?',
        `¿Quieres ver las opciones disponibles esta noche en ${ciudad}?`,
        '¿También buscas actividades para toda la familia?',
        '¿Buscas el más cercano abierto ahora?',
        '¿Quieres ver cuáles tienen promociones?',
      ];
    }

    if (cat.includes('tienda') || cat.includes('negocio')) {
      return [
        '¿Buscas algún producto o tienda en específico?',
        '¿Quieres ver cuáles tienen envío a domicilio?',
        '¿También buscas promociones o remates?',
        '¿Buscas la tienda más cercana abierta ahora?',
        `¿Hay algo más que quieras encontrar en ${ciudad}?`,
      ];
    }

    // ── COMIDA GENERAL (fallback cuando es categoría pero no subcategoría específica) ──

    if (cat.includes('comida') || cat.includes('restaurante')) {
      return [
        `¿Quieres ver los más populares en ${ciudad}?`,
        '¿Buscas alguno con servicio a domicilio?',
        '¿Te gustaría ver sus promociones?',
        '¿Quieres ver cuáles están abiertos ahora?',
        '¿Buscas opciones con estacionamiento?',
        `¿Hay otra comida que te llame la atención en ${ciudad}?`,
      ];
    }

    // ── GENÉRICO (ninguna categoría específica detectada) ─────────────────────

    return [
      items.length === 1
        ? '¿Quieres saber más sobre este lugar?'
        : '¿Quieres saber más sobre alguno de estos?',
      `¿Buscas algo diferente en ${ciudad}?`,
      '¿Quieres ver cuáles están abiertos ahora?',
      '¿Buscas opciones con promociones activas?',
      `¿Tienes otra búsqueda en mente para ${ciudad}?`,
    ];
  }

  // ─── Sugerencias "profundas" ─────────────────────────────────────────────────
  // Se usan cuando el pool específico de la categoría se agota completamente.
  // Son neutras — funcionan como comodín para cualquier tipo de negocio.

  private static sugerenciasProfundas(ciudad: string, items: any[]): string[] {
    const tienenPromo = items.some((i) => i.promo);
    const tienenDomicilio = items.some((i) => i.domicilio || i.a_domicilio);

    const pool: string[] = [
      '¿Quieres ver cuáles están abiertos en este momento?',
      '¿Buscas el más cercano a tu ubicación?',
      '¿Quieres ver los horarios de atención?',
      '¿Buscas opciones mejor calificadas?',
      `¿Hay algo más que pueda encontrarte en ${ciudad}?`,
      '¿Quieres comparar opciones en otra colonia?',
      '¿Buscas uno que tenga estacionamiento?',
    ];

    if (tienenPromo) {
      pool.unshift('¿Quieres ver solo los que tienen promoción activa?');
    }
    if (tienenDomicilio) {
      pool.unshift('¿Quieres ver solo los que tienen servicio a domicilio?');
    }

    return pool;
  }
}
