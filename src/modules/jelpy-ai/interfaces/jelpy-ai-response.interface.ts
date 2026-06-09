export interface JelpyAiResponse {
  intent: string;
  confidence: number;
  entities: {
    categoria: string | null;
    subcategoria: string | null;
    ciudad: string | null;
    especialidad?: string | null;
  };
  filters: {
    abierto_ahora: boolean;
    promos?: boolean;
    cerca_de_mi?: boolean;
  };
  normalized_text: string;
  reply: {
    mode: 'direct_reply' | 'search';
    title?: string | null;
    message?: string | null;
    suggestions?: string[];
  };
  /** Campos estructurados retornados directamente por FastAPI */
  filtros_detectados?: {
    categoriaId?: number | null;
    subcategoriaId?: number | null;
    ciudad?: string | null;
    /** Código de la característica principal, ej. "24_HORAS" */
    caracteristica?: string | null;
    /** Nombre legible de la característica principal, ej. "Abierto 24 horas" */
    caracteristicaNombre?: string | null;
    /** Array de códigos de características detectadas */
    caracteristicas?: string[] | null;
  };
}