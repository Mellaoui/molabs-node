import { Boom } from "@hapi/boom"
import { Handler } from "../utils/make-api"
import InviteLink from '../entity/InviteLink'
import Team from "../entity/Team"
import { ALL_USER_SCOPES, Scope } from "../types"
import isAdminQuery from "../utils/is-admin-query"

const INVITE_EXPIRY_HOURS = 24 // hours

const handler: Handler<'inviteLinksPost'> = async (
    { scopes }, 
	{ db }, // db connection
    { chatdaddy: user }
) => {
    const inviteLinkRepo = db.getRepository(InviteLink)
    const teamRepo = db.getRepository(Team)
    const { id: userId, teamId } = user!.user

    // Check if user's scope allow requested scope invite-link
    const result = await teamRepo
                .createQueryBuilder('team')
                .leftJoinAndSelect('team.members', 'member', 'member.user_id = :userId', { userId })
                .where('team.id = :teamId', { teamId })
                .getOneOrFail()
    let userScopes: Scope[]
    if(result.members.length) {
        userScopes = result.members![0].scopes
    } else {
        const isAdmin = await isAdminQuery(userId, db)
        if(!isAdmin) {
            throw new Boom("Either the team does not exist, or you're not a member", { statusCode: 404 })
        }
        userScopes = ALL_USER_SCOPES
    }

    if (!scopes.every((elem) => userScopes.includes(elem))) {
        throw new Boom('You do not have permission to grant these scopes!', {
            statusCode: 403
        })
    }

    const inviteLink = inviteLinkRepo.create({
        user: { id: userId },
        team: { id: teamId },
        expiresAt: new Date(Date.now() + 1000*60*60*INVITE_EXPIRY_HOURS),
        scopes
    })

    await inviteLinkRepo.save(inviteLink)

    //@ts-ignore
    delete inviteLink.user
    //@ts-ignore
    delete inviteLink.team

    return inviteLink
}
export default handler
