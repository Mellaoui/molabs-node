import User from "../entity/User";
import { Handler } from "../utils/make-api";
import { passwordHash } from "../utils/passwords";
// the "Handler" type automatically does type checks for the response as well
const handler: Handler<'usersPasswordPatch'> = async (
    { password: newPassword },
	{ db }, // db connection
    { otp },
) => {
    const userRepo = db.getRepository(User)
    const user = await userRepo.findOneOrFail({
        where: { phoneNumber: otp!.phoneNumber }
    })
    user.password = await passwordHash(newPassword!)

    await userRepo.save(user)
}
export default handler