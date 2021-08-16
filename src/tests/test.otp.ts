import request from 'supertest'
import { getConnection } from 'typeorm'
import OTP from '../entity/OTP'
import { Response } from '../utils/make-api'
import { notifications } from './test-notifications'
import { describeWithApp, fetchingOTP, TEST_TOKEN } from './test-setup'

describeWithApp('OTP', (app) => {

    it('should generate an OTP', async() => {
        await Promise.all(
            [...Array(2)].map(async() => {
                let otpSendCount = 0
                const phoneNumber = Math.floor(Math.random()*1000000)
                const sendOTP = async() => {
                    const body = await request(app)
                        .post('/otp')
                        .set('Authorization', `Bearer ${TEST_TOKEN}`)
                        .send({ phoneNumber: phoneNumber.toString() })
                        .expect('Content-Type', /json/)
                        .expect(200)
                        .then(res => res.body as Response<'otpPost'>)
                    expect(body.otp).toBeUndefined()
                    expect(
                        new Date(body.expiresAt).getTime()
                    ).toBeGreaterThan(Date.now())

                    otpSendCount += 1
                    const msg = notifications.filter(i => i.id.startsWith(phoneNumber.toString()))
                    expect(msg).toHaveLength(otpSendCount)
                    for(const item of msg) {
                        if(item.type === 'whatsapp') {
                            //@ts-ignore
                            expect(item.content.parameters.otp.toString()).toHaveLength(6)
                        } else {
                            // expect 6 digit OTP
                            expect(item.content.replace(/[^0-9]/g, '')).toHaveLength(6)
                        }
                    }

                    return body
                }
                const result = await sendOTP()
                for(let i = 0; i < result.resendsLeft;i++) {
                    await sendOTP()
                }
                await request(app)
                    .post('/otp')
                    .set('Authorization', `Bearer ${TEST_TOKEN}`)
                    .send({ phoneNumber: phoneNumber.toString() })
                    .expect('Content-Type', /json/)
                    .expect(429) // too many requests
                    .then(() => { })
            })
        )
    })

    it('should authenticate on valid OTP', async() => {
        const { phoneNumber, otp } = await fetchingOTP(app)
        await request(app)
            .patch(`/users/password`)
            .set('X-OTP', `${phoneNumber}:${otp}`)
            .send({ password: 'abcd' })
            .then(
                res => {
                    // should not be unauthorized
                    expect(res.statusCode).not.toEqual(401)
                    // obv not be a bad request
                    expect(res.statusCode).not.toEqual(400)
                }
            )
    })

    it('should fail on invalid OTPs', async() => {
        const { phoneNumber, otp } = await fetchingOTP(app)
        const invalidOTPs = [
            '',
            `${phoneNumber}:`,
            otp.toString(),
            `:${otp}`,
            `123:${otp}`
        ]
        await Promise.all(
            invalidOTPs.map(
                async otp => {
                    await request(app)
                        .patch(`/users/password`)
                        .set('X-OTP', otp)
                        .send({ password: 'abcd' })
                        .expect(401)
                }
            )
        )
        const db = await getConnection()
        const repo = db.getRepository(OTP)
        await repo.update({
            phoneNumber
        }, { expiresAt: new Date(Date.now() - 1000) })

        await request(app)
            .patch(`/users/password`)
            .set('X-OTP', `${phoneNumber}:${otp}`)
            .send({ password: 'abcd' })
            .expect(401)
    })
    
})
