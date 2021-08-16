import dotenv from 'dotenv'
dotenv.config({ path: '.env.test' }) // ensure we load this one

import request from 'supertest'
import { Application } from 'express'
import getConnection from '../utils/get-connection'
import makeTestServer from './make-test-server'
import { FullRequest, Response } from '../utils/make-api'
import { TEST_TEAM_ID, TEST_USER_ID, TEST_SCOPE_BIN } from './constants';
import { Chance } from 'chance'
import { ALL_SCOPES, ALL_USER_SCOPES } from '../types'
import { notifications } from './test-notifications'
import handler from "../routes/usersPost"
import P from 'pino'
import { adminUser, genAdmin } from '../utils/gen-admin'

// should probably set testIDs from .env.test

export const TEST_TOKEN = Buffer.from(JSON.stringify({ 
    userId: TEST_USER_ID,
    teamId: TEST_TEAM_ID,
    scope: TEST_SCOPE_BIN
})).toString('base64')

export const TEST_TOKEN2 = Buffer.from(JSON.stringify({ 
    teamId: 'TEST_TEAM_ID2',
    scope: [...Array(80)].map(() => '1').join('') 
})).toString('base64')

const chance = new Chance()

jest.setTimeout(20_000)

export const describeWithApp = (
    name: string,
    tests: (
        app: Application
    ) => void,
) => describe(name, () => {
    const app = makeTestServer()
    const conn = getConnection()

    afterAll(async () => {
        await (await conn).close()
    })

    tests(app)
})

export const fetchingOTP = async(app: Application) => {
    const phoneNumber = Math.floor(Math.random()*1000000)
    await request(app)
        .post('/otp')
        .set('Authorization', `Bearer ${TEST_TOKEN}`)
        .send({ phoneNumber: phoneNumber.toString() })
        .expect('Content-Type', /json/)
        .expect(200)
        .then(res => res.body as Response<'otpPost'>)
    const otpContent = notifications
            .find(ph => ph.id.startsWith(phoneNumber.toString()))!
            .content
    let otp: number
    if(typeof otpContent === 'object') {
        //@ts-ignore
        otp = +otpContent.parameters.otp
    } else {
        otp = +(otpContent.replace(/[^0-9]/g, ''))
    }
    return { phoneNumber, otp }
}

export const createUser = async(app) => {
    const { phoneNumber, otp } = await fetchingOTP(app)
    const req = {
        phoneNumber,
        fullName: chance.name(),
        password: chance.sentence().slice(0, 32),
    } as FullRequest<'usersPost'>

    const user = await request(app)
        .post('/users')
        .set('X-OTP', `${phoneNumber}:${otp}`)
        .send(req)
        .expect(200)
        .then(res => {
            const body = res.body as Response<'usersPost'>
            expect(body.id).toBeDefined()
            expect(body.fullName).toEqual(req.fullName)
            expect(body.phoneNumber).toEqual(req.phoneNumber)

            expect(body.memberships).toHaveLength(1)
            const [membership] = body.memberships!
            expect(membership.addedBy).toEqual(body.id)
            expect(membership.team).toBeDefined()
            expect(membership.team!.createdBy).toEqual(body.id)

            return body
        })
    return {
        req,
        user
    }
}

export const getAdminTokens = async(app, teamId?: string) => {
    await genAdmin(await getConnection())
	
    const result = await request(app)
        .post('/token')
        .send({
            phoneNumber: adminUser.phoneNumber,
            password: adminUser.password,
            returnRefreshToken: true,
            teamId,
            scopes: ALL_SCOPES
        } as FullRequest<'tokenPost'>)
        .expect(200) as { body: Response<'tokenPost'> }

    const user = await request(app)
        .get(`/users?q=${adminUser.fullName}&includeMemberships=true`)
        .set('Authorization', `Bearer ${result.body.access_token}`)
        .expect(200) as { body: Response<'usersGet'> }

    // @ts-ignore
    return { ...result.body, user: user.body.users?.[0] } as Response<'tokenPost'> & { user: typeof user.body.users[0] }
}

export const getRefreshToken = async(app) => {
    const { req, user} = await createUser(app)
    const { refresh_token, access_token } = await request(app)
        .post('/token')
        .send({
            phoneNumber: user.phoneNumber,
            password: req.password,
            returnRefreshToken: true
        } as FullRequest<'tokenPost'>)
        .expect(200)
        .then(res => res.body)
    expect(refresh_token).toBeDefined()
    return { user, refreshToken: refresh_token, accessToken: access_token, req }
}

export const createInvite = async (app, {
    accessToken,
    scopes = ALL_USER_SCOPES,
}) => {
    const req: FullRequest<'inviteLinksPost'> = { scopes }

    const invite = await request(app)
        .post(`/invite-links`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(req)
        .expect(200)
        .then(async res => {
            const body = res.body as Response<'inviteLinksPost'>
            expect(body.id).toBeDefined()
            return body
        })
    return invite
}