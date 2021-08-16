import { Handler } from "../utils/make-api"
import User from '../entity/User'
import { hasScope } from "../utils/jwt-utils"
import { Boom } from "@hapi/boom"
import { passwordHash } from "../utils/passwords"

const handler: Handler<'usersPatch'> = async (
    newUserInfo,
	{ db }, // db connection
    {chatdaddy: user}
) => {
    let {userId} = newUserInfo
    userId = userId || user?.user.id
    if(!hasScope(user!, 'ADMIN_PANEL_ACCESS')) {
        if(userId !== user?.user.id) {
            throw new Boom('Cannot change for this user', { statusCode: 403 })
        }
        if(newUserInfo.password || newUserInfo.phoneNumber) {
            throw new Boom('Cannot update these fields', { statusCode: 403 })
        }
    }
    if(newUserInfo.phoneNumber) {
        newUserInfo.phoneNumber = +newUserInfo.phoneNumber!.toString().replace(/[^0-9]/g, '')
    }
    if(newUserInfo.password) {
        newUserInfo.password = await passwordHash(newUserInfo.password!)
    }
    
    const userRepo = db.getRepository(User)
    const oldUser = await userRepo.findOneOrFail({
        where: { id: userId }
    })

    Object.assign(oldUser, newUserInfo)

    await userRepo.save(oldUser)

    return oldUser
}
export default handler