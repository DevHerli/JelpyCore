import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse, AxiosError } from 'axios';

import { JelpyAiRequest } from './interfaces/jelpy-ai-request.interface';
import { JelpyAiResponse } from './interfaces/jelpy-ai-response.interface';

@Injectable()
export class JelpyAiService {
  private readonly logger = new Logger(JelpyAiService.name);
  private readonly fastApiUrl = 'http://127.0.0.1:8000/api/interpretar';

  constructor(private readonly httpService: HttpService) {}

  async interpretar(payload: JelpyAiRequest): Promise<JelpyAiResponse> {
    try {
      const response: AxiosResponse<JelpyAiResponse> = await firstValueFrom(
        this.httpService.post<JelpyAiResponse>(this.fastApiUrl, payload),
      );

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