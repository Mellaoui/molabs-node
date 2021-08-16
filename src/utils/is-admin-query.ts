import { Connection, EntityManager } from "typeorm";
import TeamMember from "../entity/TeamMember";

export default async(userId: string, db: Connection | EntityManager) => {
	const result = await db.createQueryBuilder()
		.select()
		.from(TeamMember, 'member')
		.innerJoin('member.team', 'team', 'team.is_admin')
		.where('member.user_id = :userId', { userId })
		.getCount()
	return !!result
}