import { Injectable } from '@nestjs/common';

/**
 * Corrección ortográfica para búsquedas en español mexicano informal.
 * Cubre: abreviaciones de chat, errores fonéticos comunes, separación de palabras
 * y variantes regionales del español mexicano.
 */
@Injectable()
export class OrthographyCheckUseCase {

  execute(texto: string): string {
    if (!texto) return texto;

    let t = texto.trim();

    // ── 1. ABREVIACIONES DE CHAT ────────────────────────────────────
    t = t
      .replace(/\bq\b/gi, 'que')
      .replace(/\bxq\b/gi, 'porque')
      .replace(/\bxk\b/gi, 'porque')
      .replace(/\bpq\b/gi, 'porque')
      .replace(/\bk\b/gi, 'que')
      .replace(/\bx\b/gi, 'por')
      .replace(/\bd\b/gi, 'de')
      .replace(/\btmb\b/gi, 'también')
      .replace(/\btbn\b/gi, 'también')
      .replace(/\btb\b/gi, 'también')
      .replace(/\bntp\b/gi, 'no te preocupes')
      .replace(/\bnvm\b/gi, 'no importa')
      .replace(/\bomg\b/gi, 'dios mío')
      .replace(/\blol\b/gi, 'jaja')
      .replace(/\btqm\b/gi, 'te quiero mucho')
      .replace(/\bfyi\b/gi, 'para tu información')
      .replace(/\basap\b/gi, 'lo antes posible')
      .replace(/\bwtf\b/gi, 'qué pasó')
      .replace(/\bidk\b/gi, 'no sé')
      .replace(/\bimo\b/gi, 'en mi opinión')
      .replace(/\bbtw\b/gi, 'por cierto');

    // ── 2. CONTRACCIONES Y PALABRAS PEGADAS COMUNES ─────────────────
    t = t
      .replace(/\bxfa\b/gi, 'por favor')
      .replace(/\bporfa\b/gi, 'por favor')
      .replace(/\bporfavor\b/gi, 'por favor')
      .replace(/\bnose\b/gi, 'no sé')
      .replace(/\bnosé\b/gi, 'no sé')
      .replace(/\bpa\b/gi, 'para')
      .replace(/\bpa'?\b/gi, 'para')
      .replace(/\bnadamás\b/gi, 'nada más')
      .replace(/\bamas\b/gi, 'a más')
      .replace(/\bdnde\b/gi, 'dónde')
      .replace(/\bkien\b/gi, 'quién')
      .replace(/\bkomo\b/gi, 'cómo')
      .replace(/\bkual\b/gi, 'cuál')
      .replace(/\bkuando\b/gi, 'cuándo')
      .replace(/\bkanto\b/gi, 'cuánto')
      .replace(/\bkieres\b/gi, 'quieres')
      .replace(/\bkiero\b/gi, 'quiero')
      .replace(/\bkieren\b/gi, 'quieren')
      .replace(/\bke\b/gi, 'que')
      .replace(/\bvdd\b/gi, 'verdad')
      .replace(/\bverdá\b/gi, 'verdad')
      .replace(/\bgral\b/gi, 'general')
      .replace(/\bahorita\b/gi, 'ahora')    // normaliza intención de búsqueda
      .replace(/\bahorita mismo\b/gi, 'ahora');

    // ── 2.5 CORRECCIONES FONÉTICAS K→C EN PALABRAS COMUNES ──────────
    // "mariskos" → "mariscos", "direkto" → "directo", etc.
    t = t
      // Patrón general: reemplaza 'k' por 'c' cuando la fonética lo indica
      .replace(/mariskos/gi, 'mariscos')
      .replace(/marisko\b/gi, 'marisco')
      .replace(/marisqueria/gi, 'marisquería')
      .replace(/mariskerias/gi, 'marisquerías')
      .replace(/\bkamaron\b/gi, 'camarón')
      .replace(/\bkamarones\b/gi, 'camarones')
      .replace(/\bkeviche\b/gi, 'ceviche')
      .replace(/\bseviche\b/gi, 'ceviche')
      .replace(/\baguachili\b/gi, 'aguachile')
      .replace(/\btakos\b/gi, 'tacos')
      .replace(/\btako\b/gi, 'taco')
      .replace(/\btakeria\b/gi, 'taquería')
      .replace(/\btakerias\b/gi, 'taquerías')
      .replace(/\btaqueria\b/gi, 'taquería')
      .replace(/\btaquerias\b/gi, 'taquerías')
      .replace(/\bpissa\b/gi, 'pizza')
      .replace(/\bpisa\b/gi, 'pizza')
      .replace(/\bpizas\b/gi, 'pizzas')
      .replace(/\bburguer\b/gi, 'burger')
      .replace(/\bhamburgueza\b/gi, 'hamburguesa')
      .replace(/\bhamburguezas\b/gi, 'hamburguesas')
      .replace(/\bpolllo\b/gi, 'pollo')
      .replace(/\bpolleria\b/gi, 'pollería')
      .replace(/\bkarne\b/gi, 'carne')
      .replace(/\bkarnes\b/gi, 'carnes')
      .replace(/\bkarnitas\b/gi, 'carnitas')
      .replace(/\bcarnitas\b/gi, 'carnitas')
      .replace(/\bbirkeria\b/gi, 'birriería')
      .replace(/\bbirreria\b/gi, 'birriería')
      .replace(/\bbirria\b/gi, 'birria')
      .replace(/\btortas\b/gi, 'tortas')
      .replace(/\btorterias\b/gi, 'torterías')
      .replace(/\btorteria\b/gi, 'tortería')
      .replace(/\bsusi\b/gi, 'sushi')
      .replace(/\bsuchi\b/gi, 'sushi')
      .replace(/\bchino\b/gi, 'chino')
      .replace(/\bchinos\b/gi, 'chinos')
      .replace(/\bsebiche\b/gi, 'ceviche')
      .replace(/\bpeskado\b/gi, 'pescado')
      .replace(/\bpezcado\b/gi, 'pescado')
      .replace(/\batun\b/gi, 'atún')
      .replace(/\bostión\b/gi, 'ostión')
      .replace(/\bostiones\b/gi, 'ostiones')
      .replace(/\balmeja\b/gi, 'almeja')
      .replace(/\bpulpo\b/gi, 'pulpo')
      .replace(/\blangosta\b/gi, 'langosta')
      .replace(/\bkebab\b/gi, 'kebab')
      .replace(/\bsalbutes\b/gi, 'salbutes')
      .replace(/\bhot dog\b/gi, 'hot dog')
      .replace(/\botdog\b/gi, 'hot dog')
      .replace(/\bhotdog\b/gi, 'hot dog');

    // ── 3. ERRORES FONÉTICOS COMUNES EN ESPAÑOL ─────────────────────
    t = t
      // b/v confusión en búsquedas comunes
      .replace(/\bvarbería\b/gi, 'barbería')
      .replace(/\bbarberia\b/gi, 'barbería')
      .replace(/\bvarberia\b/gi, 'barbería')
      .replace(/\bfarmácia\b/gi, 'farmacia')
      .replace(/\bveterinaria\b/gi, 'veterinaria')
      // ll/y confusión
      .replace(/\bayuda\b/gi, 'ayuda')
      // s/c/z confusión
      .replace(/\bservisio\b/gi, 'servicio')
      .replace(/\bservicios\b/gi, 'servicios')
      .replace(/\bcomerzio\b/gi, 'comercio')
      .replace(/\bnegosio\b/gi, 'negocio')
      .replace(/\bnegosios\b/gi, 'negocios')
      // h muda omitida o sobrante
      .replace(/\boa\b/gi, 'hoa')     // rarísimo pero por si acaso
      .replace(/\bospital\b/gi, 'hospital')
      .replace(/\bhotel\b/gi, 'hotel'); // ya correcto, solo garantizamos

    // ── 4. PLURALES Y TÉRMINOS DE BÚSQUEDA FRECUENTES ───────────────
    t = t
      .replace(/\btaquerias\b/gi, 'taquerías')
      .replace(/\btaqueria\b/gi, 'taquería')
      .replace(/\bpizzerias\b/gi, 'pizzerías')
      .replace(/\bpizzeria\b/gi, 'pizzería')
      .replace(/\bcafeterias\b/gi, 'cafeterías')
      .replace(/\bcafeteria\b/gi, 'cafetería')
      .replace(/\bferreteria\b/gi, 'ferretería')
      .replace(/\bfruterias\b/gi, 'fruterías')
      .replace(/\bfruteria\b/gi, 'frutería')
      .replace(/\bpanaderias\b/gi, 'panaderías')
      .replace(/\bpanaderia\b/gi, 'panadería')
      .replace(/\bcarniceria\b/gi, 'carnicería')
      .replace(/\bcarnicerías\b/gi, 'carnicerías')
      .replace(/\bzapateria\b/gi, 'zapatería')
      .replace(/\bpapeleria\b/gi, 'papelería')
      .replace(/\bfotografia\b/gi, 'fotografía')
      .replace(/\boptometria\b/gi, 'optometría')
      .replace(/\bginecologo\b/gi, 'ginecólogo')
      .replace(/\bginecologa\b/gi, 'ginecóloga')
      .replace(/\bpediatra\b/gi, 'pediatra')
      .replace(/\bodontologia\b/gi, 'odontología')
      .replace(/\bpsicologo\b/gi, 'psicólogo')
      .replace(/\bpsicologia\b/gi, 'psicología')
      .replace(/\bnutriologo\b/gi, 'nutriólogo')
      .replace(/\bnutricion\b/gi, 'nutrición')
      .replace(/\bclinica\b/gi, 'clínica')
      .replace(/\bclinicas\b/gi, 'clínicas')
      .replace(/\bmedico\b/gi, 'médico')
      .replace(/\bmedica\b/gi, 'médica')
      .replace(/\bestetica\b/gi, 'estética')
      .replace(/\besteticas\b/gi, 'estéticas')
      .replace(/\bmecanica\b/gi, 'mecánica')
      .replace(/\belectrica\b/gi, 'eléctrica')
      .replace(/\blavanderia\b/gi, 'lavandería')
      .replace(/\bfontaneria\b/gi, 'fontanería')
      .replace(/\bplomeria\b/gi, 'plomería')
      .replace(/\belectricista\b/gi, 'electricista')
      .replace(/\bhoteles\b/gi, 'hoteles')
      .replace(/\bpension\b/gi, 'pensión')
      .replace(/\bpensiones\b/gi, 'pensiones');

    // ── 5. PALABRAS DE CONTEXTO DE BÚSQUEDA ─────────────────────────
    t = t
      .replace(/\bcerca de mi\b/gi, 'cerca de mí')
      .replace(/\baque hora\b/gi, 'a qué hora')
      .replace(/\ba ke hora\b/gi, 'a qué hora')
      .replace(/\bdomicilio\b/gi, 'domicilio')
      .replace(/\bdelivery\b/gi, 'domicilio')   // normalizar inglés a español
      .replace(/\bdeliveri\b/gi, 'domicilio')
      .replace(/\babierto ahorita\b/gi, 'abierto ahora')
      .replace(/\babiertos ahorita\b/gi, 'abiertos ahora')
      .replace(/\bpromo\b/gi, 'promoción')
      .replace(/\bpromos\b/gi, 'promociones')
      .replace(/\bdesctos\b/gi, 'descuentos')
      .replace(/\boftas\b/gi, 'ofertas')
      .replace(/\btel\b/gi, 'teléfono')
      .replace(/\btelefono\b/gi, 'teléfono')
      .replace(/\bdir\b/gi, 'dirección')
      .replace(/\bdirecc\b/gi, 'dirección');

    // ── 6. DOBLES ESPACIOS Y PUNTUACIÓN EXTRA ───────────────────────
    t = t.replace(/\s{2,}/g, ' ').trim();

    return t;
  }
}
