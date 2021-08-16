import RefreshToken from "../entity/RefreshToken"
import { Handler } from "../utils/make-api"

const handler: Handler<'tokenGet'> = async(
    { },
	{ db }, // db connection
	{ chatdaddy }
) => {
    const repo = db.getRepository(RefreshToken)
	const { id: userId } = chatdaddy!.user
    const tokens = await repo.find({
		where: { user: { id: userId } },
		order: { updatedAt: 'DESC' } // most recent tokens first
	})
    return tokens
}
export default handler