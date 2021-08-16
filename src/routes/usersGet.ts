import User from "../entity/User"
import isAdminQuery from "../utils/is-admin-query";
import { hasScope } from "../utils/jwt-utils";
import { Handler } from "../utils/make-api"

const handler: Handler<'usersGet'> = async (
    { q, id, count, page, includeMemberships },
    { db }, // db connection
    { chatdaddy }
) => {
    const { id: userId } = chatdaddy!.user
    const usersRepo = db.getRepository(User)
    const isAdmin = hasScope(chatdaddy!, 'ADMIN_PANEL_ACCESS') || await isAdminQuery(userId, db)

    page = page || 1
    count = count || 20

    let query = usersRepo
        .createQueryBuilder('user')
        .orderBy('"user"."created_at"', 'DESC')
        .limit(count)
        .offset((page - 1) * count)

    if (!isAdmin) {
        query = query.andWhere(
            '"user"."id" = :userId', { userId }
        )
    }

    if (includeMemberships?.toString() === 'true') {
        query = query.leftJoinAndSelect(
            'user.memberships',
            'member',
            'member."user_id" = "user"."id"'
        )
        query = query.leftJoinAndSelect(
            'member.team',
            'team'
        )
    }

    if (q) {
        q = q.toLowerCase()
        query = query.andWhere(
            'LOWER("user"."full_name") LIKE :q0 OR LOWER("user"."email_address") LIKE :q0 OR "user"."phone_number"::text LIKE :q0 OR "user".id::text = :q',
            { q0: `%${q}%`, q }
        )
    }

    if (id) {
        id = typeof id === 'string' ? [id] : id
        query = query.andWhere('"user"."id" IN (:...id)', { id })
    }

    const users = await query.getMany()
    return { users }

}
export default handler