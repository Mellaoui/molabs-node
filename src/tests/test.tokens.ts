import request from 'supertest'
import RefreshToken from '../entity/RefreshToken'
import TeamMember from '../entity/TeamMember'
import User from '../entity/User'
import { ALL_USER_SCOPES, Scope } from '../types'
import getConnection from '../utils/get-connection'
import { generateBinaryString, validateAccessToken } from '../utils/jwt-utils'
import { FullRequest, Response } from '../utils/make-api'
import { BASE_SCOPES } from '../utils/subscription-utils'
import { createUser as createUserWithApp, getRefreshToken as getRefreshTokenWithApp, describeWithApp, createInvite, getAdminTokens } from './test-setup'

describeWithApp('Tokens', (app) => {

	const createUser = () => createUserWithApp(app)
	const getRefreshToken = () => getRefreshTokenWithApp(app)

	it('should return a token', async() => {
		const { req, user} = await createUser()
		// test with and without refresh token
		const refreshTokenReturns = [true, false]
		await Promise.all(
			refreshTokenReturns.map(
				async returnRefreshToken => {
					await request(app)
						.post('/token')
						.send({
							phoneNumber: user.phoneNumber,
							password: req.password,
							returnRefreshToken
						} as FullRequest<'tokenPost'>)
						.expect(200)
						.then(res => {
							const body = res.body as Response<'tokenPost'>
							expect(body.access_token).toBeDefined()
							if(returnRefreshToken) {
								expect(body.refresh_token).toBeDefined()
							} else {
								expect(body.refresh_token).toBeUndefined()
								expect(body.refresh_token_expiry).toBeUndefined()
							}

							const jwt = validateAccessToken(body.access_token)

							expect(jwt.user.id).toEqual(user.id)
							expect(jwt.user.teamId).toEqual(user.memberships![0].team!.id)
							expect(jwt.scope.length).toBeGreaterThan(0)
							expect(jwt.scope).toEqual(generateBinaryString(BASE_SCOPES))
						})
				}
			)
		)
	})

	it('should request an access token multiple times', async() => {
		const { refreshToken, user } = await getRefreshToken()
		const teamId = user.memberships![0].team!.id
		for(let i = 0; i < 5;i++) {
			await request(app)
				.post('/token')
				.send({
					refreshToken,
					teamId,
					updateLastUsedTeam: true
				} as FullRequest<'tokenPost'>)
				.expect(200)
		}
		
	})

	it('should not affect other refresh tokens', async() => {
		const { user, req } = await createUser()
		const teamId = user.memberships![0].team!.id

		const tokens: string[] = []
		for(let i = 0; i < 4;i++) {
			tokens.push(
				await request(app)
					.post('/token')
					.send({
						phoneNumber: user.phoneNumber,
						password: req.password,
						returnRefreshToken: true,
					} as FullRequest<'tokenPost'>)
					.expect(200)
					.then(res => {
						const { refresh_token } = res.body as Response<'tokenPost'>
						return refresh_token!
					})
			)
		}
		
		await Promise.all(
			tokens.map((refreshToken, i) => (
				request(app)
					.post('/token')
					.send({
						refreshToken,
						teamId,
						updateLastUsedTeam: true
					} as FullRequest<'tokenPost'>)
					.expect(200)
			))
		)
	})

	it('should return a token with a scope set', async() => {
		const { req, user } = await createUser()
		// test with and without refresh token
		const scopes: Scope[][] = [
			BASE_SCOPES.slice(0, 2),
			BASE_SCOPES.slice(3, 10)
		]
		await Promise.all(
			scopes.map(
				async scopes => {
					await request(app)
						.post('/token')
						.send({
							phoneNumber: user.phoneNumber,
							password: req.password,
							scopes,
							returnRefreshToken: false
						} as FullRequest<'tokenPost'>)
						.expect(200)
						.then(res => {
							const body = res.body as Response<'tokenPost'>
							expect(body.access_token).toBeDefined()

							const jwt = validateAccessToken(body.access_token)
							expect(jwt.user.id).toEqual(user.id)
							expect(jwt.user.teamId).toEqual(user.memberships![0].team!.id)
							expect(jwt.scope.length).toBeGreaterThan(0)
							expect(jwt.scope).toEqual(generateBinaryString(scopes))
						})
				}
			)
		)
	})

	it('should fail on incorrect password', async() => {
		const { req, user } = await createUser()
		await request(app)
			.post('/token')
			.send({
				phoneNumber: user.phoneNumber,
				password: 'lol',
				returnRefreshToken: false
			} as FullRequest<'tokenPost'>)
			.expect(401)
	})

	it('should fail on unauthorized scopes', async() => {
		const { req, user} = await createUser()
		const scopes: Scope[] = [ 'ADMIN_PANEL_ACCESS' ]
		await request(app)
			.post('/token')
			.send({
				phoneNumber: user.phoneNumber,
				password: req.password,
				scopes,
				returnRefreshToken: false
			} as FullRequest<'tokenPost'>)
			.expect(403)
	})

	it('should fail to access another user team', async() => {
		const { req, user} = await createUser()
		const otherUser = await createUser()
		const otherTeamId = otherUser.user.memberships![0].team!.id
		await request(app)
			.post('/token')
			.send({
				phoneNumber: user.phoneNumber,
				password: req.password,
				teamId: otherTeamId,
				returnRefreshToken: false
			} as FullRequest<'tokenPost'>)
			.expect(404)
		// try with refresh token too
		const { refreshToken } = await getRefreshToken()
		await request(app)
			.post('/token')
			.send({
				refreshToken,
				teamId: otherTeamId
			} as FullRequest<'tokenPost'>)
			.expect(404)
	})

	it('should use a refresh token to generate access tokens', async() => {
		const { user, refreshToken } = await getRefreshToken()
		const teamId = user.memberships![0].team!.id

		await request(app)
			.post('/token')
			.send({
				refreshToken,
				teamId
			} as FullRequest<'tokenPost'>)
			.expect(200)
			.then(res => {
				const body = res.body as Response<'tokenPost'>

				const jwt = validateAccessToken(body.access_token)
				expect(jwt.user.id).toEqual(user.id)
				expect(jwt.user.teamId).toEqual(user.memberships![0].team!.id)
				expect(jwt.scope).toEqual(generateBinaryString(BASE_SCOPES))
			})
	})


	it('should be able to access /tokens', async() => {
		const { user, accessToken } = await getRefreshToken()
		await request(app)
			.get('/token')
			.set('authorization', `Bearer ${accessToken}`)
			.expect(200)
			.then(res => {
				const result = res.body as Response<'tokenGet'>
				expect(result.length).toBeGreaterThan(0)

				for(const item of result) {
					expect(item.userId).toEqual(user.id)
					expect(
						new Date(item.expiresAt).getTime()
					).toBeGreaterThan(Date.now())
				}
			})
	})

	it('should fail on an expired refresh token', async() => {
		const { user, refreshToken } = await getRefreshToken()
		const teamId = user.memberships![0].team!.id

		const db = await getConnection()
		// expire the token
		await db.getRepository(RefreshToken)
			.update({
				token: refreshToken
			}, { expiresAt: new Date(0) }) // expired at unix time

		await request(app)
			.post('/token')
			.send({
				refreshToken,
				teamId
			} as FullRequest<'tokenPost'>)
			.expect(401)
	})

	it('should fail on revoked refresh token', async() => {
		const { user, accessToken, refreshToken } = await getRefreshToken()
		const teamId = user.memberships![0].team!.id
		await request(app)
			.delete('/token?token=' + refreshToken)
			.set('authorization', `Bearer ${accessToken}`)
			.expect(200)
		
		await request(app)
			.post('/token')
			.send({
				refreshToken,
				teamId
			} as FullRequest<'tokenPost'>)
			.expect(401)
	})

	it('should fail to generate token on deleted user', async() => {
		const { user, refreshToken } = await getRefreshToken()
		const teamId = user.memberships![0].team!.id
		// delete the user
		const db = await getConnection()
		await db.getRepository(User).delete({ id: user.id })

		await request(app)
			.post('/token')
			.send({
				refreshToken,
				teamId
			} as FullRequest<'tokenPost'>)
			.expect(401)
	})

	it('should join a team with specific scopes', async() => {
		// user1 invites, user2 joins
		const { user: user1, accessToken: access1 } = await getRefreshToken()
		const { user: user2, accessToken: access2 } = await getRefreshToken()

		const inviteScopes: Scope[] = [ "WA_STATE" ]
		const invite = await createInvite(app, { accessToken: access1, scopes: inviteScopes })
		await request(app)
			.post(`/teams/join?id=${invite.id}`)
			.set('Authorization', `Bearer ${access2}`)
			.expect(200)

		const db = await getConnection()
		const teamMemberRepo = db.getRepository(TeamMember)

		const teamMember = await teamMemberRepo.findOne({
			where: {
				user: user2,
				team: user1!.memberships![0]!.team!
			}
		})

		expect(teamMember).toBeDefined()
		expect(teamMember!.scopes!).toEqual(inviteScopes)
	})

	it('should should update last used team correctly', async() => {
		// user1 invites, user2 joins
		const { user: user1, accessToken: access1 } = await getRefreshToken()
		const { user: user2, accessToken: access2, refreshToken: refresh2, req } = await getRefreshToken()

		const inviteScopes: Scope[] = [ "WA_STATE" ]
		const invite = await createInvite(app, { accessToken: access1, scopes: inviteScopes })
		await request(app)
			.post(`/teams/join?id=${invite.id}`)
			.set('Authorization', `Bearer ${access2}`)
			.expect(200)
		
		const expectations = [
			// when update is false, it should by default generate the OG team token
			{ updateLastUsedTeam: false, teamId: user2.memberships![0].team!.id },
			// when update is true, it will update last used team
			{ updateLastUsedTeam: true, teamId: user1.memberships![0].team!.id }
		]
		for(const { updateLastUsedTeam, teamId } of expectations) {

			await request(app)
				.post('/token')
				.send({
					refreshToken: refresh2,
					teamId: user1.memberships![0].team!.id,
					updateLastUsedTeam
				} as FullRequest<'tokenPost'>)
				.expect(200)

			await request(app)
				.post('/token')
				.send({
					phoneNumber: user2.phoneNumber,
					password: req.password
				} as FullRequest<'tokenPost'>)
				.expect(200)
				.then(res => {
					const { access_token } = res.body as Response<'tokenPost'>
					const parsed = validateAccessToken(access_token)
					expect(parsed).toHaveProperty('user.teamId', teamId)
				})
		}

	})
	
	it('should fail to join own team', async () => {
		// user1 invites, user2 joins
		const { user: user1, accessToken: access1 } = await getRefreshToken()
		// const { user: user2, accessToken: access2, refreshToken } = await getRefreshToken()

		const inviteScopes: Scope[] = [ "WA_STATE" ]
		const invite = await createInvite(app, { accessToken: access1, scopes: inviteScopes })
		await request(app)
			.post(`/teams/join?id=${invite.id}`)
			.set('Authorization', `Bearer ${access1}`)
			.expect(409)
	})

	it('should fail on other team if requested forbidden scopes', async () => {
		// user1 invites, user2 joins
		const { user: user1, accessToken: access1 } = await getRefreshToken()
		const { user: user2, accessToken: access2, refreshToken } = await getRefreshToken()

		const inviteScopes = BASE_SCOPES.slice(1, 2)
		const invite = await createInvite(app, { accessToken: access1, scopes: inviteScopes })
		await request(app)
			.post(`/teams/join?id=${invite.id}`)
			.set('Authorization', `Bearer ${access2}`)
			.expect(200)

		await request(app)
			.post('/token')
			.send({
				teamId: user1!.memberships![0]!.team!.id!, 
				refreshToken,
				scopes: ALL_USER_SCOPES,
			} as FullRequest<'tokenPost'>)
			.expect(403)
	})

	it('should grant ONLY the scopes given in the invite', async () => {
		// user1 invites, user2 joins
		const { user: user1, accessToken: access1 } = await getRefreshToken()
		const { user: user2, accessToken: access2, refreshToken } = await getRefreshToken()

		const inviteScopes = BASE_SCOPES.slice(0, 1)
		const invite = await createInvite(app, { accessToken: access1, scopes: inviteScopes })
		await request(app)
			.post(`/teams/join?id=${invite.id}`)
			.set('Authorization', `Bearer ${access2}`)
			.expect(200)

		await request(app)
			.post('/token')
			.send({
				refreshToken,
				teamId: invite.teamId
			} as FullRequest<'tokenPost'>)
			.expect(200)
			.then(res => {
				const { access_token } = res.body as Response<'tokenPost'>
				const { user, scope } = validateAccessToken(access_token)
				

				expect(user.teamId).toEqual(invite.teamId)
				expect(scope).toEqual(generateBinaryString(inviteScopes))
			})
	})

	it('should admin fetch any team', async() => {
		const { user: user1 } = await createUser()
		const { refresh_token } = await getAdminTokens(app)
		
		const teamId = user1.memberships![0].team!.id
		const accessToken = await request(app)
			.post('/token')
			.send({
				refreshToken: refresh_token,
				teamId
			} as FullRequest<'tokenPost'>)
			.expect(200)
			.then(res => {
				const { access_token } = res.body as Response<'tokenPost'>
				const { user } = validateAccessToken(access_token)
				
				expect(user.teamId).toEqual(teamId)
				return access_token
				//expect(scope).toEqual(generateBinaryString(inviteScopes))
			})
		// check you can fetch the team
		await request(app)
			.get(`/teams?id=${teamId}&includeTeamMembers=true`)
			.set('authorization', `Bearer ${accessToken}`)
			.expect(200)
			.then(res => {
				const { teams } = res.body as Response<'teamsGet'>
				expect(teams).toHaveLength(1)
				expect(teams[0]).toHaveProperty('id', teamId)

				const members = teams[0].members!
				expect(members).toHaveLength(1)
				expect(members[0]).toHaveProperty('user.id', user1.id)
			})
		
	})

	// test for admin fetch token of any given team
	it('should fetch token for a team using admin refresh', async() => {
		const { refresh_token } = await getAdminTokens(app)
		const { user } = await getRefreshToken()
		await request(app)
			.post('/token')
			.send({
				refreshToken: refresh_token,
				teamId: user.memberships![0]!.team!.id
			} as FullRequest<'tokenPost'>)
			.expect(200)
			.then(res => {
				expect(res.body!.access_token).toBeDefined()
			})
	})
})