import { hash, compare } from 'bcrypt'

const HASH_SALT_ROUND = 10
export const passwordHash = (pass: string) => (
	hash(pass, HASH_SALT_ROUND)
)
export const passwordCheckMatch = async(bcrypt: string, pass: string) => {
	try {
		const result = await compare(pass, bcrypt)
		return result
	} catch(error) {
		return false
	}
}