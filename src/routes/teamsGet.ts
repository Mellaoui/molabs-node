import Team from "../entity/Team";
import { Scope } from "../types";
import isAdminQuery from "../utils/is-admin-query";
import { hasScope } from "../utils/jwt-utils";
import { Handler } from "../utils/make-api";

const handler: Handler<'teamsGet'> = async (
    { q, id, count, page, userId, includeTeamMembers, includeInviteLinks }, 
	{ db }, // db connection
    { chatdaddy },
) => {
    const { id: meId, teamId: meTeamId } = chatdaddy!.user
	const teamsRepo = db.getRepository(Team)
	const isAdmin = hasScope(chatdaddy!, 'ADMIN_PANEL_ACCESS') || await isAdminQuery(meId, db)

	const accessibleTeamsSubQuery = (scope?: Scope) => {
		// admins can access all teams
		if(isAdmin) return
		let includeTeamClause: string = ''
		if(!scope || hasScope(chatdaddy!, scope)) {
			// you can of course access the team you have the token for
			// we just verify that you can access with the scopes you have too
			includeTeamClause = ` OR team."id" = '${meTeamId}'`
		}
		return `(team."id" IN (SELECT team_id FROM "team_member" "m" WHERE user_id = '${meId}' ${scope ? `AND '${scope}' = ANY(scopes)` : ''}) ${includeTeamClause})`
	}

	page = +(page || 1)
	count = +(count || 10)
	// first create a query builder
	// to select all the teams the user wants & has access to
	// then we inner join this query result to the teams table
	// this is done so we can correctly limit and join
	let selectQb = teamsRepo
			.createQueryBuilder('team')
			.select('team.id')
			.orderBy('team."created_at"', 'DESC')
			.leftJoin('team.inviteLinks', 'invite')
			.leftJoin('team.creator', 'creator')
			.distinctOn(['team."id"', 'team."created_at"'])
			.limit(count)
			.offset((page-1)*count)
	if(q) {
		q = q.toLowerCase()
		selectQb = selectQb.andWhere(
			'(team."id"::varchar = :q OR creator."phone_number"::varchar = :q OR invite."id"::varchar = :q OR LOWER(team."name") LIKE :q0 OR LOWER((team."metadata"->\'companyName\')::text) LIKE :q0)',
			{ q0: `%${q}%`, q }
		)
	}
	if(id) {
		id = typeof id === 'string' ? [id] : id
		selectQb = selectQb.andWhere('team."id" IN (:...id)', { id })
	}
	if(userId) {
		selectQb = selectQb.andWhere(
			'team."id" IN (SELECT team_id FROM "team_member" "m" WHERE user_id = :userId)',
			{ userId }
		)
	}
	// can only fetch teams you have access to if not an admin
	const subq = accessibleTeamsSubQuery()
	if(subq) {
		selectQb = selectQb.andWhere(subq)
	}

	let qb = teamsRepo
			.createQueryBuilder('team')
			.innerJoin(`(${selectQb.getQuery()})`, 't', `t."team_id" = team.id`, selectQb.getParameters())
			.orderBy('team."created_at"', 'DESC')
	
	if(includeTeamMembers?.toString() === 'true') {
		qb = qb.leftJoinAndSelect(
			'team.members',
			'member',
			accessibleTeamsSubQuery('TEAMMEMBERS_READ')
		)
		
		qb = qb.leftJoinAndSelect(
			'member.user',
			'user'
		)
	} else {
		qb = qb.leftJoin('team.members', 'member')
	}

	if(includeInviteLinks?.toString() === 'true') {
		// admins can access all team links
		let joinClause = accessibleTeamsSubQuery('TEAMLINK_READ')
		joinClause = `invite.expires_at > NOW() ${joinClause ? ` AND ${joinClause}` : ''}`
		qb = qb.leftJoinAndSelect(
			'team.inviteLinks',
			'invite',
			joinClause
		)
	} else {
		qb = qb.leftJoin('team.inviteLinks', 'invite', 'invite.expires_at > NOW()')
	}

	//console.log(qb.getQueryAndParameters())
	const teams = await qb.getMany()
	return { teams }
}
export default handler