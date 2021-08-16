import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn, RelationId } from "typeorm";
import { IInviteLink } from '../types'
import Team from "./Team";
import User from "./User";

@Entity()
export default class InviteLink implements IInviteLink {

	@PrimaryGeneratedColumn('uuid')
	id: IInviteLink['id']

	@CreateDateColumn()
	createdAt: Date

	@Column({ nullable: false })
	expiresAt: Date

	@ManyToOne(() => Team, ({ inviteLinks }) => inviteLinks, { onDelete: 'CASCADE' })
	@Index()
	team: Team
	
	@ManyToOne(() => User, { onDelete: 'CASCADE' })
	user: User

	@Column({ type: 'varchar', length: 32, array: true, nullable: false })
	scopes: IInviteLink['scopes']

	@RelationId(({ user }) => user)
	createdBy: IInviteLink['createdBy']

	@RelationId(({ team }) => team)
	teamId: IInviteLink['teamId']
}