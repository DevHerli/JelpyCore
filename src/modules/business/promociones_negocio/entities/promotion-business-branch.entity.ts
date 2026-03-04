import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

import { PromotionBusiness } from './promotion-business.entity';
import { SucursalNegocio } from '../../sucursales_negocios/entities/sucursal-negocio.entity';

@Entity('promociones_negocios_sucursales')
export class PromotionBusinessBranch {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Index()
  @Column({ type: 'bigint', unsigned: true, name: 'promocion_negocio_id' })
  promotionBusinessId: number;

  @Index()
  @Column({ type: 'bigint', unsigned: true, name: 'sucursal_id' })
  sucursalId: number;

  @ManyToOne(() => PromotionBusiness, (p) => p.branches, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'promocion_negocio_id' })
  promotion: PromotionBusiness;

  @ManyToOne(() => SucursalNegocio, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sucursal_id' })
  sucursal: SucursalNegocio;
}