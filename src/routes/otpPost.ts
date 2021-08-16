import { Boom } from "@hapi/boom";
import { randomBytes } from "crypto";
import OTP from "../entity/OTP";
import { Handler } from "../utils/make-api";
import sendSMS from "../utils/send-sms";
import sendWhatsapp from "../utils/send-whatsapp";
import parsePhoneNumber from 'libphonenumber-js'
import { otpTemplates } from '../config.json'

const OTP_EXPIRY_MINUTES = 5
const OTP_MAX_RETRIES = 3
const generateOTP = (length = 6) => {
    const bytes = randomBytes(length)
    let str = ((bytes[0] % 9) + 1).toString()
    for(let i = 1;i < length;i++) {
        str += (bytes[i] % 10).toString()
    }
    return +str
}
// the "Handler" type automatically does type checks for the response as well
const handler: Handler<'otpPost'> = async (
    { phoneNumber: phoneStr }, 
	{ db }, // db connection
    _,
    logger
) => {
    // workaround for typeORM bug
    const phoneNumber = phoneStr.replace(/[^0-9]/g, '') as any as number
    const otp = await db.transaction(
        async db => {
            const repo = db.getRepository(OTP)
            let otp = await repo
                    .createQueryBuilder('otp')
                    .where('phone_number = :phoneNumber', { phoneNumber })
                    .andWhere('expires_at > NOW()')
                    .addSelect('otp', 'otp_otp')
                    .getOne()
            // check if OTP is present for user
            if(!otp) {
                otp = repo.create({
                    phoneNumber,
                    otp: generateOTP(),
                    resendsLeft: OTP_MAX_RETRIES
                })
                logger.info({ otp }, 'generated new OTP')
            } else if(otp.resendsLeft > 0) {
                otp.resendsLeft -= 1
                logger.info({ otp }, 'updated OTP')
            } else {
                const minutesLeft = Math.floor((otp.expiresAt.getTime() - Date.now())/(1000*60))
                throw new Boom(`Cannot send more OTPs. Please try again in ${minutesLeft} minutes`, { statusCode: 429, data: { minutesLeft } })
            }

            const ph = parsePhoneNumber('+' + phoneNumber.toString()) || { countryCallingCode: '' }
            //@ts-expect-error
            const templateId = otpTemplates[ph.countryCallingCode] || otpTemplates.default
            try {
                await sendWhatsapp(
                    `${phoneNumber}@s.whatsapp.net`, 
                    { templateId, parameters: { otp: otp.otp } }
                )
            } catch(error) {
                if(error.output?.statusCode === 404) {
                    throw new Boom(
                        'This phone number is not on WhatsApp!',
                        { statusCode: 404 }
                    )
                } else {
                    logger.info(`error in sending OTP to ${phoneNumber} over WA, trying SMS...`)
                    await sendSMS(phoneNumber, `ChatDaddy OTP is ${otp.otp}`)
                }
            }
            // set new expiry
            otp.expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES*60*1000)
            // save OTP
            await repo.save(otp, {  })
            return otp
        }
    )
    
    delete otp.otp
    return otp
}
export default handler