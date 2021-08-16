import { Column, CreateDateColumn, Entity, ManyToOne, RelationId, Index } from "typeorm";
import { ITeamMember } from "../types";
import Team from "./Team";
import User from "./User";

@Entity()
export default class TeamMember implements ITeamMember {

	@ManyToOne(() => Team, ({ members }) => members, { primary: true, onDelete: 'CASCADE', onUpdate: 'RESTRICT', orphanedRowAction: 'delete'  })
	team: Team
	
	@ManyToOne(() => User, ({ memberships }) => memberships, { primary: true, onDelete: 'CASCADE' })
	user: User

	@RelationId(({ user }) => user)
	userId: string

	@RelationId(({ team }) => team)
	teamId: string

	@CreateDateColumn()
	addedAt: Date

	@Column({ type: 'uuid', nullable: true })
	addedBy: ITeamMember['addedBy']

	@Column({ type: 'varchar', length: 32, array: true, nullable: false })
	@Index()
	scopes: ITeamMember['scopes']

	ownerId() { return this.team?.id || this.teamId }
}