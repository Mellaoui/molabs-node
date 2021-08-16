import { Boom } from "@hapi/boom"
import { LessThan, Not } from "typeorm"
import InviteLink from "../entity/InviteLink"
import TeamMember from "../entity/TeamMember"
import User from "../entity/User"
import { Handler } from "../utils/make-api"
import { subscriptionBasedScopesForTeamId } from "../utils/subscription-utils"
import result from "./notify"

const handler: Handler<'teamsJoinInvite'> = async(
    { id },
	{ db }, // db connection
	{ chatdaddy: user }
) => {
    const inviteLinkRepo = db.getRepository(InviteLink)
    const teamMemberRepo = db.getRepository(TeamMember)

    const invite = await inviteLinkRepo.findOneOrFail({
        where: {
            id,
            expiresAt: Not(LessThan(new Date())),
        },
        relations: ['team']
    })
    if(!invite.team.isAdmin) {
        const { limits } = await subscriptionBasedScopesForTeamId(invite.teamId, user!.user)
        const existingMemberCount = await teamMemberRepo.count({
            where: { team: { id: invite.teamId } }
        })
        if(existingMemberCount >= limits.seats) {
            throw new Boom(
                'this team already has the maximum number of members!',
                { statusCode: 403 }
            )
        }
    }

    const teamExists = await teamMemberRepo.findOne({
        where: {
            user: { id: user?.user.id },
            team: { id: invite.teamId },
        },
    })

    if(teamExists) {
        throw new Boom('User is already member of this team!', {
            statusCode: 409
        })
    }

    const teamMember = teamMemberRepo.create({
        user: { id: user?.user.id },
        team: { id: invite.teamId },
        scopes: invite.scopes,
        addedBy: invite.createdBy
    })

    await teamMemberRepo.save(teamMember)

    return result
}
export default handler