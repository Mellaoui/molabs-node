import { createHash } from "crypto";
import P from "pino";
import { Connection } from "typeorm";
import Team from "../entity/Team";
import handler from "../routes/usersPost";
import getConnection from './get-connection'
import { RequestBody } from "./make-api";

export const adminUser: RequestBody<'usersPost'> = {
	fullName: 'Sweetie Pie Admin',
	phoneNumber: 1,
	password: createHash('SHA256')
			.update('Admin@1234')
			.digest('base64')
}
export const genAdmin = async(db: Connection) => {
	const logger = P()
	const adminTeam = await db.getRepository(Team)
			.findOne({ isAdmin: true })
	if(adminTeam) {
		logger.info(`admin team already exists as '${adminTeam.name}'`)
	} else {
		const user = await handler(
			{
				...adminUser,	
				//@ts-ignore
				isAdmin: true
			},
			{ db },
			{ },
			logger
		)
		logger.info({ user }, 'created admin team')
	}
}
if(require.main === module) {
	;(async() => {
		const db = await getConnection()
		await genAdmin(db)
		await db.close()
	})()
}