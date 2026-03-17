export interface SemanticCategory {
  clave: string;
  aliases: string[];
  categoriaHint?: string;
  subcategoriaHint?: string;
  servicios: string[];
}

export interface SemanticDetectionResult {
  giroDetectado?: string;
  serviciosDetectados: string[];
  aliasesDetectados: string[];
}