import { Boom } from '@hapi/boom'
import got from 'got/dist/source'
import User from '../entity/User'
import SCOPES from '../scopes.json'
import { ALL_USER_SCOPES, IJWT } from '../types'
import { generateAccessToken } from './jwt-utils'

// scopes that dont require knowing which subscription is active
export const BASE_SCOPES = ALL_USER_SCOPES.filter(
	scope => !SCOPES[scope].features.length
)

type ActiveFeaturesResponse = {
	features: string[]
	limits: {
		seats: number
	}
	isActivePaidUser: boolean
}

export const subscriptionBasedScopesForTeamId = async(teamId: string, user: IJWT['user'] | User) => {
	if(process.env.NODE_ENV === 'test') {
		return {
			scopes: BASE_SCOPES,
			limits: {
				seats: 2
			}
		}
	}

	const token = generateAccessToken(user, teamId, [ ])
	
	const result = await got.get<ActiveFeaturesResponse>(
		new URL('/purchases/active', 'https://api-payments.chatdaddy.tech').toString(),
		{ 
			headers: { 'Authorization': `Bearer ${token}` },
			responseType: 'json',
			throwHttpErrors: false
		}
	)
	if(result.statusCode !== 200) {
		throw new Boom('Error in fetching subscriptions', { data: result.body })
	}
	const featureSet = new Set(result.body.features)
	const scopes = ALL_USER_SCOPES.filter(
		scope => (
			// either there is no feature requirement
			!SCOPES[scope].features?.length ||
			// or the feature requirement is met
			SCOPES[scope].features?.find(f => featureSet.has(f))
		)
	)
	return {
		scopes,
		limits: result.body.limits
	}
}


export const initializeUserSubscriptions = async(teamId: string, user: IJWT['user'] | User) => {
	if(process.env.NODE_ENV === 'test') {
		return
	}

	const token = generateAccessToken(user, teamId, [ 'PAYMENTS_READ' ])
	
	const result = await got.get<ActiveFeaturesResponse>(
		new URL('/purchases/all', 'https://api-payments.chatdaddy.tech').toString(),
		{ 
			headers: { 'Authorization': `Bearer ${token}` },
			responseType: 'json',
			throwHttpErrors: false
		}
	)
	if(result.statusCode !== 200) {
		throw new Boom('Error in fetching subscriptions', { data: result.body })
	}
}