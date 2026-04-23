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

      this.logger.log(`Respuesta de FastAPI: ${JSON.stringify(response.data)}`);

      return response.data;
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