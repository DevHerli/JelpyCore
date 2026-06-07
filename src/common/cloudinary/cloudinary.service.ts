import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse, UploadApiOptions } from 'cloudinary';

@Injectable()
export class CloudinaryService implements OnModuleInit {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    cloudinary.config({
      cloud_name: this.config.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key:    this.config.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.config.get<string>('CLOUDINARY_API_SECRET'),
      secure: true,
    });
    this.logger.log(`Cloudinary conectado como: ${this.config.get('CLOUDINARY_CLOUD_NAME')}`);
  }

  /**
   * Sube un Buffer a Cloudinary y devuelve la respuesta completa.
   * @param buffer  Contenido del archivo (de memoryStorage)
   * @param options Opciones de upload: folder, public_id, etc.
   */
  uploadBuffer(buffer: Buffer, options: UploadApiOptions = {}): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
        if (error) reject(error);
        else resolve(result as UploadApiResponse);
      });
      stream.end(buffer);
    });
  }

  /**
   * Elimina un recurso de Cloudinary por su public_id.
   * Si la URL no es de Cloudinary, simplemente ignora la operación.
   */
  async destroy(urlOrPublicId: string): Promise<void> {
    if (!urlOrPublicId.includes('res.cloudinary.com') && !urlOrPublicId.includes('/')) {
      return; // No es una URL de Cloudinary
    }

    const publicId = this.extractPublicId(urlOrPublicId);
    if (!publicId) return;

    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (err) {
      this.logger.warn(`No se pudo eliminar imagen de Cloudinary (${publicId}): ${err}`);
    }
  }

  /**
   * Extrae el public_id de una URL de Cloudinary.
   * Ejemplo: https://res.cloudinary.com/cloud/image/upload/v123/jelpy/logos/abc.png
   *          → jelpy/logos/abc
   */
  extractPublicId(url: string): string | null {
    try {
      // Si ya es un publicId directo (sin dominio), devolverlo tal cual
      if (!url.startsWith('http')) return url;

      const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-z]+)?$/i);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }
}
