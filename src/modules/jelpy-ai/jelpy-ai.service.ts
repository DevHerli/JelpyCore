import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse, AxiosError } from 'axios';

import { JelpyAiRequest } from './interfaces/jelpy-ai-request.interface';
import { JelpyAiResponse } from './interfaces/jelpy-ai-response.interface';

@Injectable()
export class JelpyAiService {
  private readonly logger = new Logger(JelpyAiService.name);

  constructor(private readonly httpService: HttpService) {}

  private normalizarRespuesta(
    data: Partial<JelpyAiResponse> | any,
    payload: JelpyAiRequest,
  ): JelpyAiResponse {
    const replyMode =
      data?.reply?.mode === 'direct_reply' || data?.reply?.mode === 'search'
        ? data.reply.mode
        : 'search';

    return {
      intent: typeof data?.intent === 'string' ? data.intent : 'buscar_negocios',
      confidence:
        typeof data?.confidence === 'number' && Number.isFinite(data.confidence)
          ? data.confidence
          : 0,
      entities: {
        categoria: data?.entities?.categoria ?? null,
        subcategoria: data?.entities?.subcategoria ?? null,
        ciudad: data?.entities?.ciudad ?? payload.city_hint ?? null,
        especialidad: data?.entities?.especialidad ?? null,
      },
      filters: {
        abierto_ahora: Boolean(data?.filters?.abierto_ahora),
        promos: Boolean(data?.filters?.promos),
        cerca_de_mi: Boolean(data?.filters?.cerca_de_mi),
      },
      normalized_text:
        typeof data?.normalized_text === 'string'
          ? data.normalized_text
          : payload.text,
      reply: {
        mode: replyMode,
        title: data?.reply?.title ?? null,
        message: data?.reply?.message ?? null,
        suggestions: Array.isArray(data?.reply?.suggestions)
          ? data.reply.suggestions
          : [],
      },
      filtros_detectados: data?.filtros_detectados,
    };
  }

  async interpretar(payload: JelpyAiRequest): Promise<JelpyAiResponse> {
    const baseUrl = process.env.JELPY_AI_URL;

    if (!baseUrl) {
      this.logger.error('JELPY_AI_URL no está definida en variables de entorno');
      throw new InternalServerErrorException(
        'No fue posible interpretar la solicitud con Jelpy AI',
      );
    }

    const fastApiUrl = `${baseUrl}/api/interpretar`;

    try {
      this.logger.log(`JELPY_AI_URL: ${baseUrl}`);
      this.logger.log(`FastAPI endpoint: ${fastApiUrl}`);
      this.logger.log(`Payload enviado a FastAPI: ${JSON.stringify(payload)}`);

      const response: AxiosResponse<JelpyAiResponse> = await firstValueFrom(
        this.httpService.post<JelpyAiResponse>(fastApiUrl, payload, {
          timeout: 10000,
        }),
      );

      const respuestaNormalizada = this.normalizarRespuesta(response.data, payload);

      this.logger.log(`Respuesta de FastAPI: ${JSON.stringify(respuestaNormalizada)}`);

      return respuestaNormalizada;
    } catch (error: unknown) {
      const axiosError = error as AxiosError;

      this.logger.error('Error llamando a FastAPI');
      this.logger.error(`message: ${axiosError.message}`);
      this.logger.error(`code: ${axiosError.code ?? 'N/A'}`);
      this.logger.error(`status: ${axiosError.response?.status ?? 'N/A'}`);
      this.logger.error(
        `data: ${axiosError.response?.data ? JSON.stringify(axiosError.response.data) : 'N/A'}`,
      );

      throw new InternalServerErrorException(
        'No fue posible interpretar la solicitud con Jelpy AI',
      );
    }
  }
}
