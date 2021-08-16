import RefreshToken from "../entity/RefreshToken"
import { Handler } from "../utils/make-api"

const handler: Handler<'tokenDelete'> = async(
    { token },
	{ db }, // db connection
	{ chatdaddy }
) => {
    const repo = db.getRepository(RefreshToken)
	const { id: userId } = chatdaddy!.user
    const tokens = await repo.find({
		where: { 
			user: { id: userId },
			token
		}
	})
	await repo.remove(tokens)
}
export default handler