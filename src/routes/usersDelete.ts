import User from "../entity/User"
import Team from "../entity/Team"
import { Handler } from "../utils/make-api"

const handler: Handler<'usersDelete'> = async(
    { id },
	{ db }, // db connection
	_,
    logger
) => {
    const userRepo = db.getRepository(User)
    const teamRepo = db.getRepository(Team)

    const user = await userRepo.findOneOrFail({
        where: { id }
    })

    const teams = await teamRepo.find({
        where: {
            creator: { id },
        }
    });

    const deletedTeams = await teamRepo.remove(teams)

    const deletedUser = await userRepo.remove(user)

    logger.info({
        deletedTeams,
        deletedUser
    }, 'affected entities')

    return
    
}
export default handler