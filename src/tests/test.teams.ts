import { Chance } from 'chance'
import request from 'supertest'
import { getConnection } from 'typeorm'
import InviteLink from '../entity/InviteLink'
import { getRefreshToken, describeWithApp, createInvite, getAdminTokens, createUser } from './test-setup'
import { FullRequest, Response } from '../utils/make-api'
import { ALL_SCOPES, ALL_USER_SCOPES, Scope } from '../types'
import { BASE_SCOPES } from '../utils/subscription-utils'

const chance = new Chance()
describeWithApp('Teams', (app) => {

	const fetchFullTeam = async(accessToken: string, teamId: string) => {
		const result = await request(app)
			.get(`/teams?id=${teamId}&includeTeamMembers=true&includeInviteLinks=true`)
			.set('authorization', `Bearer ${accessToken}`)
			.expect(200)
			.then(res => {
				const { teams } = res.body as Response<'teamsGet'>
				expect(teams).toHaveLength(1)
				return teams[0]
			})
		return result
	}
	
	const joiningTeam = async(scopes: Scope[] = ALL_USER_SCOPES) => {
		// user1 invites, user2 joins
		const { user: user1, accessToken: access1 } = await getRefreshToken(app)
		const { user: user2, accessToken: access2 } = await getRefreshToken(app)

		const invite = await createInvite(app, { accessToken: access1, scopes })
		// user2 joins user1's team
		await request(app)
			.post(`/teams/join?id=${invite.id}`)
			.set('Authorization', `Bearer ${access2}`)
			.expect(200)

		const team = await fetchFullTeam(access1, user1.memberships![0].team!.id)
		expect(team.inviteLinks!).toHaveLength(1)
		expect(team.inviteLinks![0].id).toEqual(invite.id)

		expect(team.members).toHaveLength(2)

		const addedMember = team.members!.find(m => m.user?.id === user2.id)!
		expect(addedMember).toBeDefined()
		expect(addedMember.addedBy).toEqual(user1.id)
		expect(addedMember.scopes).toEqual(invite.scopes)

		await request(app)
			.get(`/teams?includeTeamMembers=true&includeInviteLinks=true`)
			.set('authorization', `Bearer ${access2}`)
			.expect(200)
			.then(res => {
				const { teams } = res.body as Response<'teamsGet'>
				expect(teams).toHaveLength(2)
			})
		
		return {
			user1,
			access1,
			user2,
			access2,
			invite
		}
	}

	it('should fetch a full team', async() => {
		const { user, accessToken } = await getRefreshToken(app)
		const teamId = user.memberships![0].team!.id

		const team = await fetchFullTeam(accessToken, teamId)
		expect(team.members).toHaveLength(1)
		expect(team.members![0].user?.id).toEqual(user.id)
		expect(team.createdBy).toBeDefined()

		expect(team.inviteLinks).toHaveLength(0)
	})

	it('should fetch team by creator phone', async() => {
		const { user, accessToken } = await getRefreshToken(app)
		await request(app)
			.get(`/teams?q=${user.phoneNumber}`)
			.set('authorization', `Bearer ${accessToken}`)
			.expect(200)
			.then(res => {
				const { teams } = res.body as Response<'teamsGet'>
				expect(teams![0]!.id).toEqual(user!.memberships![0]!.team!.id)
				expect(teams.length).toEqual(1)
			})
	})

	it('should update a team', async () => {
		const { user, accessToken } = await getRefreshToken(app)
		const teamId = user.memberships![0].team!.id
		const req: FullRequest<'teamsPatch'> = {
			name: chance.name(),
			metadata: {
				companyName: chance.name(),
				companyWebsite: chance.url()
			}
		}

		await request(app)
			.patch('/teams')
			.set('authorization', `Bearer ${accessToken}`)
			.send(req)
			.expect(200)
		
		await request(app)
			.get(`/teams?id=${teamId}`)
			.set('authorization', `Bearer ${accessToken}`)
			.expect(200)
			.then(res => {
				const { teams } = res.body as Response<'teamsGet'>
				expect(teams).toHaveLength(1)
				expect(teams[0]).toHaveProperty('name', req.name)
				expect(teams[0]).toHaveProperty('metadata.companyName', req.metadata!.companyName)
				expect(teams[0]).toHaveProperty('metadata.companyWebsite', req.metadata!.companyWebsite)
			})
	})

	it('should delete an invite link', async() => {
		const {
			user1,
			access1,
			access2,
			invite
		} = await joiningTeam()

		await request(app)
			.patch('/teams')
			.set('authorization', `Bearer ${access1}`)
			.send({
				inviteLinks: [
					{ id: invite.id, delete: true }
				]
			} as FullRequest<'teamsPatch'>)
			.expect(200)
		
		const team = await fetchFullTeam(access1, user1.memberships![0].team!.id)
		expect(team.inviteLinks).toHaveLength(0)

		await request(app)
            .get(`/invite-links/${invite.id}`)
            .set('Authorization', `Bearer ${access2}`)
            .expect(404)
	})

	it('should delete a team member', async() => {
		const {
			user1,
			user2,
			access1
		} = await joiningTeam()

		await request(app)
			.patch('/teams')
			.set('authorization', `Bearer ${access1}`)
			.send({
				members: [
					{ id: user2.id, delete: true }
				]
			} as FullRequest<'teamsPatch'>)
			.expect(200)
		
		const team = await fetchFullTeam(access1, user1.memberships![0].team!.id)
		expect(team.members).toHaveLength(1)
		expect(team.members![0].user!.id).toEqual(user1.id)
	})

	it('should update a team member', async() => {
		const {
			user2,
			access1
		} = await joiningTeam(BASE_SCOPES.slice(0, 10))

		await request(app)
			.patch('/teams')
			.set('authorization', `Bearer ${access1}`)
			.send({
				members: [
					{ id: user2.id, scopes: ALL_USER_SCOPES }
				]
			} as FullRequest<'teamsPatch'>)
			.expect(200)
	})

	it('should fail to update a team member', async() => {
		const {
			user2,
			access1,
			access2
		} = await joiningTeam(BASE_SCOPES.slice(0, 10))
		// cannot edit myself
		await request(app)
			.patch('/teams')
			.set('authorization', `Bearer ${access2}`)
			.send({
				members: [
					{ id: user2.id, scopes: ALL_USER_SCOPES }
				]
			} as FullRequest<'teamsPatch'>)
			.expect(400)
		// cannot add a scope one does not have
		await request(app)
			.patch('/teams')
			.set('authorization', `Bearer ${access1}`)
			.send({
				members: [
					{ id: user2.id, scopes: ALL_SCOPES }
				]
			} as FullRequest<'teamsPatch'>)
			.expect(403)
	})

	it('should join a team', async () => {
		await joiningTeam()
	})

	it('should fail to join a team', async () => {
		// user1 invites, user2 joins
		const { accessToken: access1 } = await getRefreshToken(app)
		const { accessToken: access2 } = await getRefreshToken(app)

		const invite = await createInvite(app, { accessToken: access1 })

		const db = getConnection()
		const inviteLinkRepo = db.getRepository(InviteLink)

		await inviteLinkRepo.update(
			{ id: invite.id },
			{ expiresAt: new Date(Date.now() - 1000) }
		)

		await request(app)
			.post(`/teams/join?id=${invite.id}`)
			.set('Authorization', `Bearer ${access2}`)
			.expect(404)
	})

	// -- team join limits are observed
	it('should exceed join limit while joining team', async() => {
		const { accessToken: access1 } = await getRefreshToken(app) // inviter

		// invitee
		const invitees = await Promise.all([1,2].map(async _ => await getRefreshToken(app)))
		const { accessToken: access3 } = await getRefreshToken(app) // inviter

		const invite = await createInvite(app, { accessToken: access1 })

		await Promise.all(invitees.map(async(invitee) => {
			await request(app)
				.post(`/teams/join?id=${invite.id}`)
				.set('Authorization', `Bearer ${invitee.accessToken}`)
				.expect(200)
		}))

		// Should exceed limit
		await request(app)
				.post(`/teams/join?id=${invite.id}`)
				.set('Authorization', `Bearer ${access3}`)
				.expect(403)
		
	})

	it('should admin add members', async() => {
		const {user: user1} = await createUser(app)
		const {user: user2} = await createUser(app)
		
		const teamId1 = user1.memberships![0].team!.id

		const { user: admin, access_token } = await getAdminTokens(app, teamId1)

		await request(app)
			.patch('/teams')
			.set('Authorization', `Bearer ${access_token}`)
			.send({
				// add user2 to the team
				members: [
					{ id: user2.id, scopes: ALL_USER_SCOPES }
				]
			} as FullRequest<'teamsPatch'>)
			.expect(200)
		await request(app)
			.get(`/teams?id=${teamId1}&includeTeamMembers=true`)
			.set('Authorization', `Bearer ${access_token}`)
			.expect(200)
			.then(res => {
				const { teams: [team] } = res.body as Response<'teamsGet'>
				expect(team).toBeDefined()
				expect(team.members).toHaveLength(2)

				const member = team.members!.find(m => m.user!.id === user2.id)
				expect(member).toBeDefined()
				expect(member).toHaveProperty('addedBy', admin.id)
			})
	})

	it('should fail to add members via admin access', async() => {
		const {user: user1} = await createUser(app)
		const {user: user2, accessToken} = await getRefreshToken(app)
	
		await request(app)
			.patch('/teams')
			.set('Authorization', `Bearer ${accessToken}`)
			.send({
				// add user2 to the team
				members: [
					{ id: user1.id, scopes: ALL_USER_SCOPES }
				]
			} as FullRequest<'teamsPatch'>)
			.expect(403)
			
	})

})