import { Column, CreateDateColumn, DeleteDateColumn, Entity, Index, OneToMany, OneToOne, PrimaryGeneratedColumn, RelationId, Unique, UpdateDateColumn, JoinColumn, ManyToOne } from "typeorm";
import { IUser } from "../types";
import RefreshToken from "./RefreshToken";
import Team from "./Team";
import TeamMember from "./TeamMember";

@Entity()
export default class User implements IUser {

	@PrimaryGeneratedColumn('uuid')
	id: IUser['id']

	@CreateDateColumn()
	createdAt: IUser['createdAt']

	@UpdateDateColumn({ select: false })
	updatedAt: IUser['updatedAt']

	@DeleteDateColumn({ select: false })
	disabledAt: IUser['disabledAt']
	
	@Column({ type: 'varchar', length: 100, nullable: false })
	fullName: string

	@Column({ type: 'bigint', unsigned: true, nullable: false, unique: true })
	phoneNumber: IUser['phoneNumber']

	@Column({ type: 'varchar', length: 255, nullable: true })
	emailAddress: IUser['emailAddress']

	@Column({ type: 'varchar', length: 128, nullable: false, select: false })
	password: string

	@Column({ type: 'json', nullable: false })
	notify: IUser['notify']

	@Column({ nullable: true, default: null })
	lastLoginDate: Date
	
	@Column({ type: 'varchar', length: 24, select: false })
	createdByMethod: IUser['createdByMethod']
	
	@ManyToOne(() => Team, { onDelete: 'SET NULL' })
	@JoinColumn()
	lastUsedTeam: Team

	@RelationId(({ lastUsedTeam }) => lastUsedTeam)
	lastUsedTeamId: string

	@OneToMany(() => TeamMember, ({ user }) => user)
	memberships: TeamMember[]

	@OneToMany(() => RefreshToken, ({ user }) => user)
	refreshTokens?: RefreshToken[]
	
	ownerId() { return undefined }
}