import { Chance } from 'chance'
import request from 'supertest'
import { getConnection, LessThan, Not } from 'typeorm'
import OTP from '../entity/OTP'
import { FullRequest, Response } from '../utils/make-api'
import { createUser as createUserWithApp, getRefreshToken, describeWithApp, getAdminTokens, createInvite } from './test-setup'

const chance = new Chance()
describeWithApp('Users', (app) => {

	const createUser = () => createUserWithApp(app)

	const getOTPFor = async (user) => {
		return await request(app)
			.post('/otp')
			.send({ phoneNumber: user.phoneNumber.toString() })
			.expect(200)
			.then(async res => {
				const db = getConnection()
				const otpRepo = db.getRepository(OTP)
				const otp = await otpRepo.findOneOrFail({
					where: {
						phoneNumber: +(user.phoneNumber as number),
						expiresAt: Not(LessThan(new Date()))
					},
					select: ['otp', 'phoneNumber', 'resendsLeft', 'expiresAt']
				})
				return otp
			})
	}

	it('should create a user', async() => {
		await createUser()
	})

	it('should fail to create a user', async () => {
		// no auth
		await request(app)
			.post('/users')
			.set('Authorization', `Bearer 123123123123123`)
			.send({
				phoneNumber: +chance.phone().replace(/[^0-9]/g, ''),
				fullName: chance.name(),
				password: chance.sentence().slice(0, 48)
			})
			.expect(401)

		
		const { user } = await createUser()
		const { access_token } = await getAdminTokens(app)
		// cannot generate another user with same phone number
		await request(app)
			.post('/users')
			.set('Authorization', `Bearer ${access_token}`)
			.send({
				phoneNumber: user.phoneNumber,
				fullName: user.fullName,
				password: chance.sentence().slice(0, 48)
			})
			.expect(409)
	})

	it('should change user info', async () => {
		const { accessToken, user } = await getRefreshToken(app)

		const req = {
			fullName: 'Test D. user',
			emailAddress: 'a@b.com',
		} as FullRequest<'usersPatch'>

		await request(app)
			.patch('/users')
			.set('Authorization', `Bearer ${accessToken}`)
			.send(req)
			.expect(200)
			.then(res => {
				const body = res.body as Response<'usersPatch'>
				expect(body.id).toEqual(user.id)
				expect(body.fullName).toEqual(req.fullName)
				expect(body.emailAddress).toEqual(req.emailAddress)
				expect(body.notify).toEqual(user.notify)
				return body
			})
	})

	it('should fail to change user info', async () => {
		const { accessToken } = await getRefreshToken(app)

		const req = {
			fullName: 'Test D. user',
			passowrd: 'I am a password',
		} as FullRequest<'usersPatch'>
		await request(app)
			.patch('/users')
			.set('Authorization', `Bearer ${accessToken}`)
			.send(req)
			.expect(400)
			.then(res => {
				expect(res.body.message).toBeDefined()
				expect(res.body.statusCode).toBeDefined()
				expect(res.body.statusCode).toEqual(400)
				return
			})
	})

	it('should change password using otp', async() => {
		const { user } = await createUser()
		const otp = await getOTPFor(user)

		const req: FullRequest<'usersPasswordPatch'> = {
			password: 'newPasswordForTestUser@123'
		}

		await request(app)
			.patch('/users/password')
			.set('X-OTP', `${user.phoneNumber}:${otp!.otp}`)
			.send(req)
			.expect(200)

		//await getAccessTokenFrom(user, req.password as string)
	})

	it('should change password using admin panel', async() => {
		const { user } = await createUser()
		const { access_token } = await getAdminTokens(app)

		const req: FullRequest<'usersPasswordPatch'> = {
			password: 'newPasswordForTestUser@123'
		}

		await request(app)
			.patch('/users?userId=' + user.id)
			.set('Authorization', `Bearer ${access_token}`)
			.send(req)
			.expect(200)

		await request(app)
			.post('/token')
			.send({
				phoneNumber: user.phoneNumber,
				password: req.password
			})
			.expect(200)
	})

	it('should fail to change password', async() => {
		const { accessToken } = await getRefreshToken(app)

		await request(app)
			.patch('/users/password')
			.set('Authorization', `Bearer ${accessToken}`)
			.expect(400)
	})

	it('should get users', async() => {
		const { accessToken, user } = await getRefreshToken(app)

		await request(app)
			.get('/users')
			.set('Authorization', `Bearer ${accessToken}`)
			.expect(200)
			.then(res => {
				const body = res.body as Response<'usersGet'>;
				expect(body?.users?.length).toEqual(1)
				expect(body.users![0]!.id).toEqual(user.id)
				expect(body.users![0]!.memberships).toBeUndefined()
				return body
			})
	})

	it('should get users with memberships', async() => {
		const { accessToken, user } = await getRefreshToken(app)

		await request(app)
			.get(`/users?includeMemberships=true`)
			.set('Authorization', `Bearer ${accessToken}`)
			.expect(200)
			.then(res => {
				const body = res.body as Response<'usersGet'>;
				expect(body?.users?.length).toEqual(1)
				expect(body.users![0]!.id).toEqual(user.id)
				expect(body.users![0]!.memberships).toBeDefined()
				return body
			})
	})

	it('should get users using id and fullName', async() => {
		const { accessToken, user } = await getRefreshToken(app)

		await request(app)
			.get(`/users?id=${user.id}&q=${user.fullName}`)
			.set('Authorization', `Bearer ${accessToken}`)
			.expect(200)
			.then(res => {
				const body = res.body as Response<'usersGet'>;
				expect(body?.users?.length).toEqual(1)
				expect(body.users![0]!.id).toEqual(user.id)
				expect(body.users![0]!.fullName!).toEqual(user.fullName)
				return body
			})
	})

	it('should get users using admin acc', async() => {
		await getRefreshToken(app) // create a user
		const { access_token } = await getAdminTokens(app)

		await request(app)
			.get(`/users`)
			.set('Authorization', `Bearer ${access_token}`)
			.expect(200)
			.then(res => {
				const body = res.body as Response<'usersGet'>;
				expect(body.users).toBeDefined()
				expect(body.users!.length).toBeGreaterThan(1)
				return body
			})
	})

	it('should get users with memberships using admin acc', async() => {
		// create multiple users
		// check all of them are returned & have memberships
		const users = await Promise.all([1,2,3,4].map(async _ => (await (await getRefreshToken(app)).user))) // create a user
		const { access_token } = await getAdminTokens(app)

		await request(app)
			.get(`/users?includeMemberships=true`)
			.set('Authorization', `Bearer ${access_token}`)
			.expect(200)
			.then(res => {
				const body = res.body as Response<'usersGet'>;
				expect(body.users).toBeDefined()
				expect(body.users!.length).toBeGreaterThan(1)
				body.users!.forEach((user) => {
					expect(user!.memberships).toBeDefined()
				})
				users.forEach((user) => {
					expect(body.users).toEqual(
						expect.arrayContaining([
						  expect.objectContaining({ id: user.id })
						])
					)
				})
				return body
			})
	})

	it('should get user by id using admin acc', async() => {
		const { user } = await getRefreshToken(app) // create a user
		const { access_token } = await getAdminTokens(app)

		await request(app)
			.get(`/users?id=${user.id}`)
			.set('Authorization', `Bearer ${access_token}`)
			.expect(200)
			.then(res => {
				const body = res.body as Response<'usersGet'>;
				expect(body.users).toBeDefined()
				expect(body.users!.length).toEqual(1)
				return body
			})
	})

	// Test
	// check only admins can delete users (ADMIN_PANEL_ACCESS) scope
	// when deleting, ensure only the user (and only created teams) are deleted. Make sure other teams & users are unaffected.
	// Eg. if you delete a user, it shouldn't delete the teams the user is only a part of. It should only delete the teams created by the user

	it('should delete user along with its created teams using adminToken', async() => {
		const { user: user1, accessToken: access1 } = await getRefreshToken(app)
		const { user: user2, access_token: access2 } = await getAdminTokens(app)
		const invite = await createInvite(app, { accessToken: access2 })
		// user1 joins user2's team
		await request(app)
			.post(`/teams/join?id=${invite.id}`)
			.set('Authorization', `Bearer ${access1}`)
			.expect(200)

		// Delete user1
		await request(app)
			.delete(`/users?id=${user1.id}`)
			.set('Authorization', `Bearer ${access2}`)
			.expect(200)
			.then(async res => {
				// Check if user1 was deleted
				await request(app)
					.get(`/users?id=${user1.id}`)
					.set('Authorization', `Bearer ${access2}`)
					.expect(200)
					.then(getRes => {
						expect(getRes.body.users.length).toEqual(0)
					})

				// Check if user1's team was deleted
				await request(app)
					.get(`/teams?id=${user1!.memberships![0]!.team!.id}`)
					.set('Authorization', `Bearer ${access2}`)
					.expect(200)
					.then(getRes => {
						expect(getRes.body.teams.length).toEqual(0)
					})

				// Check if user1 was removed from user2's team && user2's team was unaffected
				await request(app)
					.get(`/teams?id=${user2!.memberships![0]!.team!.id}&includeTeamMembers=true`)
					.set('Authorization', `Bearer ${access2}`)
					.expect(200)
					.then(getRes => {
						const members = getRes.body.teams![0]!.members
						members.forEach(member => {
							expect(member!.user!.id).not.toEqual(user1.id)
						});
					})

				// Additionally test for number of teams before and after delete
			})
	})

	it('should fail to delete user using non-admin token', async() => {
		const { user: user1, accessToken: access1 } = await getRefreshToken(app)
		const { accessToken: access2 } = await getRefreshToken(app)

		const invite = await createInvite(app, { accessToken: access2 })
		// user1 joins user2's team
		await request(app)
			.post(`/teams/join?id=${invite.id}`)
			.set('Authorization', `Bearer ${access1}`)
			.expect(200)

		// Delete user1
		await request(app)
			.delete(`/users?id=${user1.id}`)
			.set('Authorization', `Bearer ${access2}`)
			.expect(403)
	})
})