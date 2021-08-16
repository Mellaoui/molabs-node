import { Boom } from "@hapi/boom";
import OTP from "../entity/OTP";
import Team from "../entity/Team";
import TeamMember from "../entity/TeamMember";
import User from "../entity/User";
import { ALL_SCOPES, ALL_USER_SCOPES } from "../types";
import { Handler } from "../utils/make-api";
import { passwordHash } from "../utils/passwords";
import { initializeUserSubscriptions } from "../utils/subscription-utils";

const handler: Handler<'usersPost'> = async (
    req, 
	{ db },
	{ otp },
	logger
) => {
	let { fullName, phoneNumber, password, emailAddress, notify } = req
	emailAddress = emailAddress || null
	notify = { whatsapp: true, email: true, ...(notify || {}) }
	password = await passwordHash(password)
	
	// only for internal use, cannot be sent with a request
	const isAdmin = req['isAdmin'] as boolean || false

	const user = await db.transaction(async db => {
		const userRepo = db.getRepository(User)
		const teamRepo = db.getRepository(Team)
		const membershipRepo = db.getRepository(TeamMember)

		const prevCount = await userRepo.count({
			where: { phoneNumber },
			take: 1
		})
		if(prevCount) {
			throw new Boom(
				'This phone number is already registered! Please login, if you have forgotten your password, press "forget password"', 
				{ statusCode: 409 }
			)
		}

		// create the user
		const user = userRepo.create({
			fullName,
			phoneNumber,
			password,
			emailAddress,
			notify,
			createdByMethod: otp instanceof OTP ? 'otp' : 'admin-panel'
		})
		await userRepo.save(user)

		// create the team
		const team = await teamRepo.create({
			creator: user,
			metadata: { },
			name: `${fullName}'s team`,
			isAdmin
		})
		user.lastUsedTeam = team
		await teamRepo.save(team)
		// add the user as a member of their team
		const membership = await membershipRepo.create({
			team,
			user,
			scopes: isAdmin ? ALL_SCOPES : ALL_USER_SCOPES,
			addedBy: user.id
		})
		await membershipRepo.save(membership)
		//@ts-ignore
		delete team.creator
		//@ts-ignore
		delete membership.user
		//@ts-ignore
		delete user.lastUsedTeam
		
		membership.team.createdBy = user.id
		user.memberships = [ membership ]

		return user
	})
	
	await (
		initializeUserSubscriptions(user.memberships[0].team.id, user)
		.catch(err => logger.error({ trace: err.stack }, 'error in intializing subscription'))
	)
	return user
}
export default handler