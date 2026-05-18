/**
 * Genera sugerencias contextuales después de una búsqueda.
 * Se muestran al usuario para continuar explorando.
 */
export class SugerenciasUtil {

  static generar(
    filtros: {
      categoriaId?: number | null;
      subcategoriaId?: number | null;
      categoriaHint?: string;
      subcategoriaHint?: string;
    },
    items: any[],
    ciudad: string,
  ): string[] {
    const sugerencias: string[] = [];

    if (!items || items.length === 0) return sugerencias;

    const cat = (filtros.categoriaHint || '').toLowerCase();
    const sub = (filtros.subcategoriaHint || '').toLowerCase();
    const ciudadNombre = ciudad || 'tu ciudad';

    // ── Sugerencias por categoría ──────────────────────────────────
    if (sub.includes('taquería') || sub.includes('taqueria') || sub.includes('tacos')) {
      sugerencias.push(`¿Quieres ver tacos con domicilio a ${ciudadNombre}?`);
      sugerencias.push('¿También te interesan las torterías?');
      sugerencias.push('¿Buscas promociones en taquerías?');
    } else if (sub.includes('mariscos')) {
      sugerencias.push('¿Quieres ver solo los que tienen ceviche?');
      sugerencias.push('¿También te gustaría ver restaurantes con aguachile?');
      sugerencias.push('¿Buscas mariscos con domicilio?');
    } else if (sub.includes('hamburguesa') || sub.includes('comida rápida') || sub.includes('comida rapida')) {
      sugerencias.push('¿También quieres ver alitas de pollo?');
      sugerencias.push('¿Buscas hamburguesas con domicilio?');
      sugerencias.push('¿Te interesan los combos y promociones?');
    } else if (sub.includes('pizza')) {
      sugerencias.push('¿Quieres ver pizzas con domicilio?');
      sugerencias.push('¿También te gustaría ver promociones en pizzas?');
    } else if (sub.includes('farmacia') || cat.includes('salud')) {
      sugerencias.push('¿Buscas farmacia de turno 24 horas?');
      sugerencias.push('¿También necesitas un médico cerca?');
    } else if (sub.includes('doctor') || sub.includes('médico') || sub.includes('medico')) {
      sugerencias.push('¿También necesitas una farmacia cercana?');
      sugerencias.push('¿Quieres ver médicos a domicilio?');
      sugerencias.push('¿Buscas alguna especialidad médica?');
    } else if (sub.includes('barbería') || sub.includes('barberia') || sub.includes('estética') || sub.includes('estetica')) {
      sugerencias.push('¿Quieres ver si tienen servicio a domicilio?');
      sugerencias.push('¿Buscas algún salón de belleza?');
    } else if (cat.includes('comida') || cat.includes('restaurante')) {
      sugerencias.push(`¿Quieres ver los más populares en ${ciudadNombre}?`);
      sugerencias.push('¿Buscas alguno con servicio a domicilio?');
      sugerencias.push('¿Te gustaría ver sus promociones?');
    } else if (sub.includes('dentist') || sub.includes('odontolog')) {
      sugerencias.push(items.length === 1 ? '¿Quieres saber el horario de este dentista?' : '¿Quieres saber el horario de alguno de estos?');
      sugerencias.push('¿También buscas ortodoncista o limpieza dental?');
    } else {
      // Genérico — singular vs plural
      sugerencias.push(
        items.length === 1
          ? '¿Quieres saber más sobre este lugar?'
          : '¿Quieres saber más sobre alguno de estos?',
      );
      sugerencias.push(`¿Buscas algo diferente en ${ciudadNombre}?`);
    }

    // Máximo 2 sugerencias para no saturar
    return sugerencias.slice(0, 2);
  }
}
