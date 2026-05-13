import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface PushPayload {
  title:    string;
  body:     string;
  category: string;
  priority: string;
  ctaRoute: string;
  ctaUrl:   string;
  ctaLabel: string;
  imageUrl: string;
}

@Injectable()
export class OneSignalService {
  private readonly logger = new Logger(OneSignalService.name);
  private readonly appId:  string | undefined;
  private readonly apiKey: string | undefined;
  private readonly url = 'https://onesignal.com/api/v1/notifications';

  constructor(
    private readonly config: ConfigService,
    private readonly http: HttpService,
  ) {
    this.appId  = this.config.get<string>('ONESIGNAL_APP_ID');
    this.apiKey = this.config.get<string>('ONESIGNAL_API_KEY');

    if (!this.appId || !this.apiKey) {
      this.logger.warn(
        'OneSignal no configurado — push desactivado. ' +
        'Agrega ONESIGNAL_APP_ID y ONESIGNAL_API_KEY al .env',
      );
    }
  }

  /**
   * Envía una notificación a una lista de external_user_ids (IDs de suscriptores).
   * OneSignal mapea el external_user_id al token del dispositivo internamente.
   *
   * Retorna el número de destinatarios que recibieron el push.
   */
  async sendToUsers(
    userIds: number[],
    payload: PushPayload,
  ): Promise<number> {
    if (!this.appId || !this.apiKey) {
      this.logger.debug(
        `[OneSignal simulado] "${payload.title}" → ${userIds.length} usuarios`,
      );
      return userIds.length;
    }

    const body = {
      app_id:             this.appId,
      include_external_user_ids: userIds.map(String),
      headings:  { en: payload.title },
      contents:  { en: payload.body },
      data: {
        category:  payload.category,
        priority:  payload.priority,
        cta_route: payload.ctaRoute ?? '',
        cta_url:   payload.ctaUrl   ?? '',
        cta_label: payload.ctaLabel ?? '',
      },
      ...(payload.imageUrl ? { big_picture: payload.imageUrl, ios_attachments: { image: payload.imageUrl } } : {}),
    };

    try {
      const response = await firstValueFrom(
        this.http.post(this.url, body, {
          headers: {
            Authorization: `Basic ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }),
      );

      return response.data?.recipients ?? userIds.length;
    } catch (err) {
      this.logger.error('Error enviando push por OneSignal:', err?.response?.data ?? err.message);
      return 0;
    }
  }

  /**
   * Envía a TODOS los usuarios suscritos en la app OneSignal.
   */
  async sendToAll(payload: PushPayload): Promise<number> {
    if (!this.appId || !this.apiKey) {
      this.logger.debug(`[OneSignal simulado] "${payload.title}" → todos`);
      return 0;
    }

    const body = {
      app_id:            this.appId,
      included_segments: ['All'],
      headings:  { en: payload.title },
      contents:  { en: payload.body },
      data: {
        category:  payload.category,
        priority:  payload.priority,
        cta_route: payload.ctaRoute ?? '',
        cta_url:   payload.ctaUrl   ?? '',
        cta_label: payload.ctaLabel ?? '',
      },
      ...(payload.imageUrl ? { big_picture: payload.imageUrl } : {}),
    };

    try {
      const response = await firstValueFrom(
        this.http.post(this.url, body, {
          headers: {
            Authorization: `Basic ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }),
      );
      return response.data?.recipients ?? 0;
    } catch (err) {
      this.logger.error('Error enviando push a todos:', err?.response?.data ?? err.message);
      return 0;
    }
  }
}
