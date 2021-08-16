import { Handler } from "../utils/make-api"
import InviteLink from '../entity/InviteLink'
import { LessThan, Not } from "typeorm"

const handler: Handler<'inviteLinksGet'> = async (
    { id },
	{ db }, // db connection
) => {
    const inviteLinkRepo = db.getRepository(InviteLink)
    const inviteLink = await inviteLinkRepo.findOneOrFail({ 
        where: {
            id,
            expiresAt: Not(LessThan(new Date())),
        },
        relations: ['team', 'user']
    })
    return inviteLink
}
export default handler