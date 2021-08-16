import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn, RelationId, UpdateDateColumn } from "typeorm";
import { IRefreshToken } from '../types'
import User from "./User";

@Entity()
export default class RefreshToken implements IRefreshToken {

	@PrimaryGeneratedColumn('uuid')
	token: IRefreshToken['token']

	@ManyToOne(() => User, ({ refreshTokens }) => refreshTokens, { onDelete: 'CASCADE', nullable: false })
	@Index()
	user: User

	@RelationId(({ user }) => user)
	userId: string

	@CreateDateColumn()
	createdAt: Date

	@UpdateDateColumn()
	updatedAt: Date

	@Column({ nullable: false })
	expiresAt: Date
}