import { LessThan } from "typeorm"
import InviteLink from "../entity/InviteLink"
import OTP from "../entity/OTP"
import RefreshToken from "../entity/RefreshToken"
import getConnection from "../utils/get-connection"
import logger from "../utils/logger"

const EXPIRING_ENTITIES = [ OTP, InviteLink, RefreshToken ]

export const handler = async() => {
	const db = await getConnection()
	await Promise.all(
		EXPIRING_ENTITIES.map(
			async e => {
				const repo = db.getRepository(e)
				const result = await repo.delete({
					expiresAt: LessThan(new Date())
				})
				logger.info(`deleted ${result.affected} expired "${e.name}" entities`)
			}
		)
	)
}