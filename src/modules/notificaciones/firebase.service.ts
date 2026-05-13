import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

export interface FcmPayload {
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
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private initialized = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const projectId   = this.config.get<string>('FIREBASE_PROJECT_ID');
    const privateKey  = this.config.get<string>('FIREBASE_PRIVATE_KEY');
    const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');

    if (!projectId || !privateKey || !clientEmail) {
      this.logger.warn(
        'Firebase no configurado — las notificaciones push están desactivadas. ' +
        'Agrega FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY y FIREBASE_CLIENT_EMAIL al .env',
      );
      return;
    }

    // Evitar inicializar dos veces (hot-reload en dev)
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          privateKey: privateKey.replace(/\\n/g, '\n'),
          clientEmail,
        }),
      });
    }

    this.initialized = true;
    this.logger.log('Firebase Admin SDK inicializado correctamente');
  }

  /**
   * Envía una notificación a un lote de tokens FCM.
   * Retorna la cantidad de envíos exitosos.
   * Los tokens inválidos son retornados para marcarlos como inactivos.
   */
  async sendMulticast(
    tokens: string[],
    payload: FcmPayload,
  ): Promise<{ successCount: number; invalidTokens: string[] }> {
    if (!this.initialized || !tokens.length) {
      this.logger.debug(
        `[FCM simulado] "${payload.title}" → ${tokens.length} dispositivos`,
      );
      return { successCount: tokens.length, invalidTokens: [] };
    }

    const BATCH_SIZE = 500; // límite de FCM por llamada
    let successCount = 0;
    const invalidTokens: string[] = [];

    // Dividir en lotes de 500 (límite de FCM)
    for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
      const batch = tokens.slice(i, i + BATCH_SIZE);

      const message: admin.messaging.MulticastMessage = {
        notification: {
          title: payload.title,
          body:  payload.body,
          ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
        },
        data: {
          category: payload.category,
          priority: payload.priority,
          cta_route: payload.ctaRoute ?? '',
          cta_url:   payload.ctaUrl   ?? '',
          cta_label: payload.ctaLabel ?? '',
        },
        tokens: batch,
        android: {
          priority: 'high',
          notification: { sound: 'default' },
        },
        apns: {
          payload: { aps: { sound: 'default', badge: 1 } },
        },
      };

      try {
        const response = await admin.messaging().sendEachForMulticast(message);
        successCount += response.successCount;

        response.responses.forEach((resp, idx) => {
          if (
            !resp.success &&
            (resp.error?.code === 'messaging/registration-token-not-registered' ||
              resp.error?.code === 'messaging/invalid-registration-token')
          ) {
            invalidTokens.push(batch[idx]);
          }
        });
      } catch (err) {
        this.logger.error(`Error enviando lote FCM [${i}–${i + BATCH_SIZE}]:`, err);
      }
    }

    return { successCount, invalidTokens };
  }
}
