import User from "../entity/User";
import { sign as signJWT, verify as verifyJWT, VerifyOptions } from 'jsonwebtoken'
import keys from '../keys.json'
import { IJWT, Scope } from "../types";
import SCOPES from '../scopes.json'
import { Boom } from "@hapi/boom";

const JWT_ALG = 'ES256'
// the keys are attached with the headers in code
// this is because storing new lines in GH actions secrets causes weird issues
const PRIVATE_KEY = `-----BEGIN EC PRIVATE KEY-----\n${keys.privateKey}\n-----END EC PRIVATE KEY-----`
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----\n${keys.publicKey}\n-----END PUBLIC KEY-----`

const DEFAULT_EXPIRATION_MINUTES = 60

export const generateBinaryString = (scopes: Scope[]) => {
    let str = ''
    for(const scope of scopes) {
        const { number } = SCOPES[scope]
		if(str.length <= number) {
			while(str.length < number) {
				str += '0'
			}
			str += '1'
		} else {
			str = str.slice(0, number) + '1' + str.slice(number+1)
		}
    }
	return str
}

export const generateAccessToken = (
	user: User | IJWT['user'], 
	teamId: string,
	scopes: Scope[],
	expirationMinutes: number = DEFAULT_EXPIRATION_MINUTES
) => {
	const iat = Math.floor(Date.now()/1000)
	const jwt: IJWT = {
		scope: generateBinaryString(scopes),
		iat,
		exp: iat + expirationMinutes*60,
		user: {
			id: user.id,
			fullName: user.fullName,
			phoneNumber: user.phoneNumber,
			teamId
		}
	}
	const token = signJWT(jwt, PRIVATE_KEY, { algorithm: JWT_ALG })
	return token
}

export const validateAccessToken = (token: string, opts?: VerifyOptions) => {
	try {
		const user = verifyJWT(token, PUBLIC_KEY, { 
			algorithms: [ JWT_ALG ],
			...(opts || {})
		}) as IJWT
		return user
	} catch(error) {
		throw new Boom(error.message, { statusCode: 401 })
	}
}

export const hasScope = (user: IJWT, scope: Scope) => (
	user.scope[ SCOPES[scope]?.number ] === '1'
)

/**
 * Checks whether this JWT token data has at least one of these scopes
 */
export const validateUserScopes = (user: IJWT, ...scopes: Scope[]) => {
	if(!scopes.length) return { authorized: true, missingScopes: [] }
	
    const userScopes: string = user.scope
	const missingScopes = scopes.filter(scope => 
		userScopes[ SCOPES[scope]?.number ] !== '1'
	)
    const authorized = missingScopes.length < scopes.length
    return { authorized, missingScopes }
}
export const assertUserScopes = (user: IJWT, ...scopes: Scope[]) => {
	const { authorized, missingScopes } = validateUserScopes(user, ...scopes)
	if(!authorized) {
		throw new Boom(
			`You need the "${missingScopes[0]}" scope to access this data`, 
			{ statusCode: 403, data: missingScopes }
		)
	}
}