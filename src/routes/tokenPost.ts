import { Boom } from "@hapi/boom";
import { getRepository } from "typeorm";
import RefreshToken from "../entity/RefreshToken";
import TeamMember from "../entity/TeamMember";
import User from "../entity/User";
import { Handler, Response } from "../utils/make-api";
import { generateAccessToken } from "../utils/jwt-utils";
import { passwordCheckMatch } from "../utils/passwords";
import Team from "../entity/Team";
import { ALL_SCOPES, Scope } from "../types";
import { subscriptionBasedScopesForTeamId } from "../utils/subscription-utils";

const DEFAULT_TOKEN_EXPIRY_DAYS = 14

const handler: Handler<'tokenPost'> = async (
   	request, 
	{ db },
	{},
	logger
) => {
	const tokenRepo = db.getRepository(RefreshToken)
	const userRepo = db.getRepository(User)
	const teamRepo = db.getRepository(Team)
	
	// find the right user
	let user: User
	let team: Team
	let shouldSaveUser = false

	if('refreshToken' in request) {
		const result = await userRepo
					.createQueryBuilder('user')
					.innerJoinAndSelect('user.refreshTokens', 'token', 'token."token" = :token', { token: request.refreshToken })
					.andWhere('(token."expires_at" > NOW() OR token."expires_at" IS NULL)')
					.getOne()
		if(!result) {
			throw new Boom('Invalid or expired refresh token', { statusCode: 401 })
		}
		user = result
	} else {
		user = await userRepo
					.createQueryBuilder('user')
					.addSelect('password', 'user_password')
					.where('phone_number = :ph', { ph: request.phoneNumber })
					.getOneOrFail()
		const passCheckResult = await passwordCheckMatch(user.password, request.password)
		if(!passCheckResult) {
			throw new Boom('Invalid phone number or password', { statusCode: 401 })
		}
	}
	const isAdmin = await getRepository(TeamMember)
				.createQueryBuilder('member')
				.innerJoinAndSelect('member.team', 'team')
				.where('member.user_id = :userId', { userId: user.id })
				.andWhere('team.is_admin')
				.getCount()
	const teamIdToFetch = request.teamId || user.lastUsedTeamId
	// get team
	let qb = await teamRepo
			.createQueryBuilder('team')
			.limit(1)
	// admins can access all teams
	// add another condition in case we don't know the team ID to request for
	if(!isAdmin) {
		qb = qb
			.innerJoinAndSelect('team.members', 'member', 'member.user_id=:userId', { userId: user.id })
			.orderBy('"team".creator_id="member".user_id', 'DESC')
	}
	if(teamIdToFetch) {
		qb = qb.andWhere('team.id = :teamIdToFetch', { teamIdToFetch })
	} else if(isAdmin) { // fetch the OG team if no team to use is present
		qb = qb.andWhere('team.creator_id = :userId', { userId: user.id })
	}
	qb = qb.addOrderBy('team.created_at', 'DESC')
	team = (await qb.getOne())!
	if(!team) {
		throw new Boom('Either the team specified is invalid, or you do not have access', { statusCode: 404 })
	}
	// max scopes this team member is allowed
	const memberScopes = new Set(isAdmin ? ALL_SCOPES : team.members?.[0].scopes as Scope[])
	// get the max scopes the team can give
	// admin teams get access to all scopes
	const teamScopes = team.isAdmin ? ALL_SCOPES : (await subscriptionBasedScopesForTeamId(team.id, user)).scopes
	// filter out the scopes this user can be given
	const maxAllowedScopes = teamScopes.filter(scope => memberScopes.has(scope))
	let allowedScopes: Scope[]
	if(request.scopes) {
		const maxAllowedSet = new Set(maxAllowedScopes)
		const disallowedScopes = request.scopes!.filter(scope => !maxAllowedSet.has(scope))
		// only throw error if not admin
		if(disallowedScopes.length && !isAdmin) {
			throw new Boom(
				'You do not have access to certain scopes you requested',
				{ statusCode: 403, data: disallowedScopes }
			)
		}
		allowedScopes = request.scopes
	} else {
		allowedScopes = maxAllowedScopes
	}
	// generate the token
	const result: Response<'tokenPost'> = {
		access_token: generateAccessToken(
			user,
			team.id,
			allowedScopes
		)
	}
	// should return refresh token
	if('returnRefreshToken' in request && request.returnRefreshToken !== false) {
		const token = tokenRepo.create({
			user,
			expiresAt: new Date(Date.now() + DEFAULT_TOKEN_EXPIRY_DAYS*24*60*60*1000),
		})
		await tokenRepo.save(token)
		result.refresh_token = token.token
		result.refresh_token_expiry = token.expiresAt!
	}

	if(user.refreshTokens?.length) {
		const [token] = user.refreshTokens
		// update expiry
		token.expiresAt = new Date(Date.now() + DEFAULT_TOKEN_EXPIRY_DAYS*24*60*60*1000)
		await tokenRepo.save(token)
		// we delete this property so it's not saved again
		// saving it again will delete all other refresh tokens :/
		delete user.refreshTokens
	}
	// if the user specified a team ID and they want to update last used team
	if(request.updateLastUsedTeam && !!request.teamId) {
		user.lastUsedTeam = { id: team.id } as any
		shouldSaveUser = true
		logger.info({ userId: user.id, teamId: team.id }, 'updating last used team')
	}
	// user logged in
	if('phoneNumber' in request) {
		user.lastLoginDate = new Date()
		shouldSaveUser = true
	}

	if(shouldSaveUser) {
		await userRepo.save(user)
	}

	return result
}
export default handler