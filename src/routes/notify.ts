import { Handler, Response, RequestBody } from "../utils/make-api"
import { replacingParameters, toHTML } from "../utils/templates"
import sendWhatsapp from "../utils/send-whatsapp"
import sendEmail from "../utils/send-email"
import TeamMember from "../entity/TeamMember"
import User from "../entity/User"
import teamMember from "./teamsJoinInvite"
import { Boom } from "@hapi/boom"
import { Logger } from "pino"

export const notify = async(
	{ title, content, parameters }: RequestBody<'notify'>, 
	user: User,
	teamName: String,
	logger: Logger
) => {
	// extract some user info
	const { fullName, emailAddress, phoneNumber, notify } = user
	const params = {
		fullName,
		phoneNumber,
		teamName,
		...(parameters || {})
	}
	// parse any parameters in the template
	content = replacingParameters(content, params)

	let result: Response<'notify'> = {
		whatsapp: false,
		email: false
	}
	await Promise.all([
		(async() => {
			// notify on WA
			if(notify.whatsapp) {
				try {
					const text = `**${title}**\n\n${content}`
					await sendWhatsapp(`${phoneNumber}@s.whatsapp.net`, { text })
					result.whatsapp = true
				} catch(error) {
					logger.error({ trace: error.stack }, 'error in notifying via WA')
					result.whatsapp = error.message
				}
			}
		})(),
		(async() => {
			// notify on email
			if(notify.email) {
				try {
					if(!emailAddress) {
						throw new Boom('No email address')
					}
					const html = toHTML(content)
					await sendEmail(emailAddress, title, html)
					result.email = true
				} catch(error) {
					logger.error({ trace: error.stack }, 'error in notifying via email')
					result.email = error.message
				}
			}
		})()
	])
	return result
}

const handler: Handler<'notify'> = async (
    req,
	{ db }, // db connection
	{ chatdaddy },
	logger
) => {
	const { user: { teamId } } = chatdaddy!
    const repo = db.getRepository(TeamMember)

    const { user, team } = await repo.findOneOrFail(
		{
			where: { 
				user: { id: req.userId }, 
				team: { id: teamId } 
			},
			relations: ['user', 'team']
		}
	)
	const result = await notify(req, user, team.name, logger)
	return result
}
export default handler