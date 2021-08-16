import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import { IOTP } from '../types'

@Entity()
export default class OTP implements IOTP {

	@PrimaryColumn({ type: 'bigint', unsigned: true })
	phoneNumber: IOTP['phoneNumber']

	@Column({ type: 'int', unsigned: true, select: false })
	@Index()
	otp: IOTP['otp']

	@Column()
	expiresAt: Date

	@Column({ type: 'int', unsigned: true })
	resendsLeft: number
}