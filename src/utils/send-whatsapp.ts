import { Boom } from "@hapi/boom"
import got from "got"
import User from "../entity/User"
import { generateAccessToken } from "./jwt-utils"
import { whatsappNotifications } from '../config.json'

const ADMIN_USER = {
	id: whatsappNotifications.userId,
	fullName: 'Sweetie Pie',
	phoneNumber: 1
} as User

const WHATSAPP_SENDING_TEAM_ID = whatsappNotifications.teamId

export type WASendContent = { text: string } | { templateId: string, parameters: { [_: string]: any } }

const sendWhatsapp = async(jid: string, content: WASendContent) => {
	if(process.env.NODE_ENV === 'test') {
		require('../tests/test-notifications').notifications.push({
			type: 'whatsapp',
			id: jid,
			content
		})
		return 
	}
	const token = generateAccessToken(ADMIN_USER, WHATSAPP_SENDING_TEAM_ID, [ 'MESSAGES_SEND_TO_ALL' ], 5)
	let url = `https://api-wa.chatdaddy.tech/messages/${jid}`
	let json: any
	if('templateId' in content) {
		url += `/${content.templateId}`
		json = {
			parameters: content.parameters
		}
	} else {
		json = content
	}
	const result = await got(
		url,
		{
			method: 'POST',
			headers: {
				authorization: `Bearer ${token}`
			},
			json,
			throwHttpErrors: false,
			responseType: 'json',
			timeout: 14_000
		}
	)
	if(result.statusCode !== 200) {
		throw new Boom(`Error in request`, { statusCode: result.statusCode, data: result.body })
	}
}
export default sendWhatsapp