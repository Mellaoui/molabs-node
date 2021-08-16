import { Boom } from "@hapi/boom";
import { In } from "typeorm";
import InviteLink from "../entity/InviteLink";
import Team from "../entity/Team";
import TeamMember from "../entity/TeamMember";
import { ALL_SCOPES, Scope } from "../types";
import isAdminQuery from "../utils/is-admin-query";
import { assertUserScopes, hasScope } from "../utils/jwt-utils";
import { Handler } from "../utils/make-api";

const handler: Handler<'teamsPatch'> = async (
    request, 
	{ db }, // db connection
    { chatdaddy },
	logger
) => {
    const { id: userId, teamId } = chatdaddy!.user
	await db.transaction(
		async db => {
			const teamsRepo = db.getRepository(Team)
			const team = await teamsRepo.findOneOrFail({
				where: {
					id: teamId
				}
			})
			// update members
			if(request.members) {
				assertUserScopes(chatdaddy!, 'TEAMMEMBERS_UPDATE')
				const membersRepo = db.getRepository(TeamMember)

				if(request.members!.find(m => m.id === team.createdBy)) {
					throw new Boom('Cannot alter the team creator!', { statusCode: 400 })
				}

				const memberIdsToRemove = request.members!.filter(m => !!m.delete).map(m => m.id)
				const memberIdsToUpdate = request.members!.reduce(
					(dict, update) => {
						if(!update.delete) {
							dict[update.id] = update
						}
						return dict
					},
					{} as { [_: string]: { id: string, scopes?: Scope[], delete?: true } }
				)

				if(request.members!.find(m => m.id === userId) && memberIdsToRemove.includes(userId)) {
					throw new Boom('Cannot delete your own user!', { statusCode: 400 })
				}

				/**
				 * This function is required to set the right relations for the teammmember type
				 * Otherwise the update/remove fails
				 */
				const updateMemberRelations = (members: TeamMember[]) => {
					for(const member of members) {
						member.user = { id: member.userId } as any
						member.team = { id: member.teamId } as any
					}
				}

				if(memberIdsToRemove.length) {
					const members = await membersRepo.find({
						where: {
							team: { id: teamId },
							user: { id: In(memberIdsToRemove) }
						}
					})
					updateMemberRelations(members)
					await membersRepo.remove(members)
				}

				if(Object.keys(memberIdsToUpdate).length) {
					const fetchArr = [
						...Object.keys(memberIdsToUpdate),
						userId
					]
					const members = await membersRepo.find({
						where: {
							team: { id: teamId },
							user: { id: In(fetchArr) }
						}
					})
					const meMember = members.find(m => m.userId === userId)!
					if(request.members!.find(m => m.id === userId) && !!meMember) {
						throw new Boom('Cannot alter your own user!', { statusCode: 400 })
					}

					let meMemberScopeSet: Set<Scope>
					if(!meMember) {
						if(await isAdminQuery(userId, db)) {
							meMemberScopeSet = new Set(ALL_SCOPES)
						} else {
							throw new Boom('Cannot find your user in the team', { statusCode: 403 })
						}
					} else {
						meMemberScopeSet = new Set(meMember.scopes)
					}
					for(const member of members) {
						const update = memberIdsToUpdate[member.userId]
						if(update?.scopes) {
							// tried to give scope user didn't have themselves
							const disallowedScopes = update.scopes.filter(s => !meMemberScopeSet.has(s))
							if(disallowedScopes.length) {
								throw new Boom(
									'You do not have enough access to update these scopes on this team member',
									{
										statusCode: 403,
										data: disallowedScopes
									}
								)
							}
							member.scopes = update.scopes
						}
					}
					updateMemberRelations(members)

					const remainingMemberIds = Object.keys(memberIdsToUpdate).filter(
						userId => !members.find(member => member.userId === userId)
					)
					// allow admins to add members
					if(remainingMemberIds.length) {
						if(!hasScope(chatdaddy!, 'ADMIN_PANEL_ACCESS')) {
							throw new Boom('received extra member IDs to update', { statusCode: 403, data: remainingMemberIds })
						}
						const newMembers = remainingMemberIds.map(id => {
							const scopes = memberIdsToUpdate[id].scopes!
							if(!scopes) {
								throw new Boom('scopes not present', { statusCode: 403 })
							}
							// these are translated to team ID in the updateMemberRelations function
							return membersRepo.create({
								user: { id },
								team: { id: team.id },
								scopes,
								addedBy: userId,
							})
						})
						logger.info({ newMembers }, 'admin adding members')
						members.push(...newMembers)
					}
					
					await membersRepo.save(members)
				}
				delete request.members
			}
			
			// update/delete invite links
			if(request.inviteLinks) {
				assertUserScopes(chatdaddy!, 'TEAMLINK_CREATE')
				
				const inviteRepo = db.getRepository(InviteLink)
				const inviteIds = request.inviteLinks!.filter(m => !!m.delete).map(m => m.id)

				if(inviteIds.length) {
					const links = await inviteRepo.find({
						where: {
							team: { id: teamId },
							id: In(inviteIds)
						}
					})
					await inviteRepo.remove(links)
				}
			}

			if(Object.keys(request).length) {
				Object.assign(
					team,
					{
						...request,
						metadata: {
							...team.metadata,
							...request.metadata
						}
					}
				)
			}

			await teamsRepo.save(team)
		}
	)

	return { success: true }
}
export default handler