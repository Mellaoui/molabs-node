import Team from "../entity/Team";
import User from "../entity/User";
import notify from "../routes/notify";
import { IJWT } from "../types";
import getConnection from "../utils/get-connection";
import handleSnsEvent from "../utils/handle-sns-event";
import { FullRequest } from "../utils/make-api";
import { getTemplate } from "../utils/templates";

export const handler = handleSnsEvent(
	async(event, data, teamId, logger) => {
		let notification: FullRequest<'notify'> | undefined = undefined
		switch(event) {
			case 'open':
			case 'close':
				if(data.isReconnecting || data.reason === 'intentional') {
					return
				}
				if(!data.isNewUser && event === 'open') {
					return
				}
				
				const repo = (await getConnection()).getRepository(Team)
				const { createdBy } = await repo.findOneOrFail(teamId)
				notification = {
					...getTemplate(event === 'open' ? 'newConnection' : 'disconnected'),
					userId: createdBy!,
					parameters: {
						phoneNumber: data.user?.jid.replace(/[^0-9]/g, '')
					}
				}
			break
			case 'contact-update':
				let assignee = data[0].assignee
				if(assignee) {
					notification = {
						...getTemplate('contactAssigned'),
						userId: assignee
					}
				}
			break
		}
		if(notification) {
			await notify(
				notification, 
				{ db: await getConnection() }, 
				{ chatdaddy: { user: { teamId } } as IJWT }, 
				logger
			)
		}
	}
)