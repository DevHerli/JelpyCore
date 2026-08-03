import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SuscriptoresController } from './suscriptores.controller';
import { SuscriptoresService } from './suscriptores.service';
import { Suscriptor } from './entities/suscriptores.entity';
import { Membresia } from '../membresias/entities/membresia.entity';
import { MembresiasModule } from '../membresias/membresias.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Suscriptor, Membresia]),
    MembresiasModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '1h' },
      }),
    }),
  ],
  controllers: [SuscriptoresController],
  providers: [SuscriptoresService],
  exports: [SuscriptoresService],
})
export class SuscriptoresModule {}
