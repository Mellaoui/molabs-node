import request from 'supertest'
import { getConnection } from 'typeorm'
import InviteLink from '../entity/InviteLink'
import { ALL_USER_SCOPES } from '../types'
import { FullRequest, Response } from '../utils/make-api'
import { describeWithApp, getAdminTokens, getRefreshToken } from './test-setup'

describeWithApp('Invite Links', (app) => {
    let accessToken = ''

    beforeAll(async () => {
        const result = await getRefreshToken(app)
        accessToken = result.accessToken
    })

    const createInvite = async () => {
        const { accessToken, user } = await getRefreshToken(app)
        const req: FullRequest<'inviteLinksPost'> = {
            scopes: ALL_USER_SCOPES
        }

        const invite = await request(app)
            .post(`/invite-links`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send(req)
            .expect(200)
            .then(async res => {
                const body = res.body as Response<'inviteLinksPost'>
                expect(body.id).toBeDefined()
                const db = getConnection()
                const repo = db.getRepository(InviteLink)
                const invite = await repo.findOne({
                    id: body.id,
                })
                expect(invite).toBeDefined()
                return body
            })
        return { accessToken, invite, user }
    }

    it('should generate an invite', async () => {
        await createInvite()
    })

    it('should fail to generate an inviteLink', async () => {
        await request(app)
            .post(`/invite-links`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                scopes: [
                    "ADMIN_PANEL_ACCESS"
                ]
            })
            .expect(403)
            .then(res => {
                expect(res.body.message).toBeDefined()
                expect(res.body.statusCode).toBeDefined()
                expect(res.body.statusCode).toEqual(403)
                return
            })
    })

    it('should fail to generate an inviteLink due to garbage scope', async () => {
        await request(app)
            .post(`/invite-links`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                scopes: [
                    "garbage_value_here"
                ]
            })
            .expect(400)
            .then(res => {
                expect(res.body.message).toBeDefined()
                expect(res.body.statusCode).toBeDefined()
                expect(res.body.statusCode).toEqual(400)
                return
            })
    })

    it('should return info about generated invite', async () => {
        const { accessToken, invite, user } = await createInvite()
        await request(app)
            .get(`/invite-links/${invite.id}`)
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(200)
            .then(async res => {
                const body = res.body as Response<'inviteLinksGet'>
                expect(body.id).toEqual(invite.id)
                // expect(body.scopes).toEqual(scopes)
                expect(body.teamId).toEqual(user!.memberships![0]!.team!.id)
                expect(body.scopes).toEqual(user!.memberships![0]!.scopes)
                expect(body.createdBy).toContain(invite.createdBy)
                return
            })
    })

    it('should fail to return info about invite', async () => {
        await request(app)
            .get(`/invite-links/82a2b29e-229c-4eda-9ece-7568c8e2ac08`)
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(404)
            .then(async res => {
                expect(res.body.message).toBeDefined()
                expect(res.body.statusCode).toBeDefined()
                expect(res.body.statusCode).toEqual(404)
                return
            })
    })

    it('should create an invite using an admin user', async() => {
        const { user } = await getRefreshToken(app)
        const { refresh_token } = await getAdminTokens(app)

        const teamId = user.memberships![0].team!.id

        const accessToken = await request(app)
            .post('/token')
            .send({
                refreshToken: refresh_token,
                teamId
            })
            .expect(200)
            .then(res => res.body.access_token)
        
        await request(app)
            .post('/invite-links')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                scopes: ALL_USER_SCOPES
            })
            .expect(200)
            .then(res => {
                const body = res.body as Response<'inviteLinksPost'>
                expect(body.teamId).toBe(teamId)
            })
    })
})
