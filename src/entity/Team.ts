import { Column, CreateDateColumn, DeleteDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, OneToOne, PrimaryGeneratedColumn, RelationId, UpdateDateColumn } from "typeorm";
import { ITeam } from "../types";
import InviteLink from "./InviteLink";
import TeamMember from "./TeamMember";
import User from "./User";

@Entity()
export default class Team implements ITeam {

	@PrimaryGeneratedColumn('uuid')
	id: ITeam['id']

	@CreateDateColumn()
	createdAt: ITeam['createdAt']

	@ManyToOne(() => User, { onDelete: 'CASCADE' })
	@JoinColumn()
	creator: User

	@RelationId(({ creator }) => creator)
	createdBy: ITeam['createdBy']

	@UpdateDateColumn({ select: false })
	updatedAt: ITeam['updatedAt']

	@DeleteDateColumn({ select: false })
	deletedAt: Date

	@Column({ type: 'boolean', nullable: false, default: false })
	isAdmin: boolean

	@Column({ type: 'jsonb', nullable: false })
	metadata: ITeam['metadata']

	@Column({ type: 'varchar', length: 64, nullable: false })
	name: ITeam['name']

	@OneToMany(() => TeamMember, ({ team }) => team)
	members: TeamMember[]

	@OneToMany(() => InviteLink, ({ team }) => team)
	inviteLinks: InviteLink[]

	scopes: ITeam['scopes']

	ownerId () { return this.id }
}