import OpenAPIBackend from "openapi-backend";
import { Boom } from "@hapi/boom";
import { Handler as APIHandler } from 'openapi-backend'
import { Connection, EntityNotFoundError, LessThan, Not } from "typeorm";
import { operations } from "../types/gen";
import getConnection from './get-connection'
import MAIN_LOGGER from "./logger";
import { Context } from "aws-lambda";
import { Logger } from "pino";
import OTP from "../entity/OTP";
import { IJWT, Scope } from "../types";
import { assertUserScopes, validateAccessToken } from "./jwt-utils";
import eventsManager from "./events-manager";

/**
 * Main file with almost all the boilerplate required
 * for scope validation, auth, wrapping a pure function into an HTTP controller etc.
 */
// get all operations from openAPI
export type Operation = keyof operations
// add missing parameters
// (not all operations have all these, so we add them)
type FullOp<O extends Operation> = operations[O] & {
    parameters: {
        path: {  }
        query: {  }
    }
    requestBody: {
        content: {
            'application/json': { }
        }
    },
	responses: {
		'200': {
			content: {
				'application/json': {} | void
			}
		}
	}
}
export type Authentication = { chatdaddy?: IJWT, otp?: OTP }
export type RequestBody<O extends Operation> = FullOp<O>['requestBody']['content']['application/json']
// full request type of an operation -- query + parameters + requestBody
export type FullRequest<O extends Operation> = FullOp<O>['parameters']['query'] & FullOp<O>['parameters']['path'] & FullOp<O>['requestBody']['content']['application/json']
// the response type of an operation
export type Response<O extends Operation> = FullOp<O>['responses']['200']['content']['application/json']
// handle cleaned up request (type checks response too)
export type Handler<O extends Operation> = (
	ev: FullRequest<O>, 
	conn: { db: Connection },
	auth: Authentication,
	logger: Logger
) => Promise<Response<O>>
export type APIResult = { statusCode: number, body: any }

const headers = {
	'content-type': 'application/json',
	'access-control-allow-origin': '*', // lazy cors config
	'access-control-allow-headers': '*'
}
const IMPORTANT_METHODS = new Set([ 'delete', 'post', 'patch' ])
// backend agnostic wrapper
// makes a function work for serverless, express & others
function errorHandlingWrap<O extends Operation>(handler: Handler<O>): APIHandler {
	return async(e, req, ctx: Context) => {
		let logger = MAIN_LOGGER.child({ requestId: ctx?.awsRequestId || 'unknown' })
		const result = {  } as APIResult
		const fullRequest = {
			...(e.request.query || {}),
			...(e.request.requestBody || {}),
			...(e.request.params || {})
		}
		let auth: Authentication | undefined = undefined
		let trace: string | undefined = undefined
		try {
			if(e.validation?.errors) {
				throw new Boom('Invalid request', { statusCode: 400, data: e.validation.errors })
			}
			// if auth failed
			if(!!e.security && !e.security.authorized) {
				if(e.security.otp) {
					throw e.security.otp.error
				} else if(e.security.chatdaddy) {
					throw e.security.chatdaddy.error
				}
			}
			auth = e.security
			logger = logger.child({ teamId: auth?.chatdaddy?.user?.teamId })
			const db = await getConnection()
			
			result.body = await handler(
				fullRequest, 
				{ db }, 
				auth,
				logger
			)
			result.statusCode = 200//result.body ? 200 : 204
			await eventsManager.flush()
			// delete OTP so it cannot be used again
			if(auth.otp instanceof OTP) {
				await db.getRepository(OTP).remove(auth.otp)
			}
		} catch(error) {
			let errorDescription: string
			let data: any
			trace = error.stack
			if(error instanceof Boom) {
				errorDescription = error.message
				data = error.data
				result.statusCode = error.output.statusCode
			} else if(error instanceof EntityNotFoundError) {
				errorDescription = `Could not find the entity you were looking for`
				result.statusCode = 404
			} else {
				errorDescription = 'Internal Server Error'
				result.statusCode = 500
			}
			result.body = {
				error: errorDescription,
				statusCode: result.statusCode,
				message: error.message,
				data
			}
		}
		if(trace || IMPORTANT_METHODS.has(e.request.method)) {
			const method = trace ? 'error' :  'info'
			logger[method]({
				trace,
				path: `${e.request.method} ${e.request.path}`,
				res: result.body,
				req: fullRequest,
				statusCode: result.statusCode,
				actor: auth?.chatdaddy?.user,
			}, 'processed request')
		}

		const res = e.request['res']
		if(typeof res?.status === 'function') {
			res.set(headers)
			return res
				.status(result.statusCode)
				.send(result.body)
		} else return {
			statusCode: result.statusCode,
			body: JSON.stringify(result.body),
			headers
		}
	}
}
export default (
	definition: string, 
	routes: { [K in Operation]: Handler<K> }
) => {
	// create api with your definition file or object
	const api = new OpenAPIBackend({ definition, quick: process.env.NODE_ENV === 'production' })
	api.registerSecurityHandler('chatdaddy', e => {
		try {
			const security = e.operation.security!.find(s => !!s.chatdaddy)!
			const scopes = security.chatdaddy
			const headers = e.request.headers
			const token = (headers.Authorization || headers.authorization)?.slice(7)
			if(!token || typeof token !== 'string') {
				throw new Boom('Token not found', { statusCode: 401 })
			}
			const user = validateAccessToken(token)
			assertUserScopes(user, ...scopes as Scope[])
			return user
		} catch(error) {
			if(error instanceof Boom) {
				throw error
			} else {
				throw new Boom(error.message, { statusCode: error.code || 500 })
			}
		}
	})
	api.registerSecurityHandler('otp', async e => {
		const headers = e.request.headers
		const otpToken = headers['X-OTP'] || headers['x-otp']
		if(headers['Authorization'] || headers['authorization']) return undefined;
		if(typeof otpToken !== 'string') {
			throw new Boom('OTP not found', { statusCode: 401 })
		}
		const [phone, otp] = otpToken.split(':')

		if(!phone || !otp || otp?.length > 6 || phone?.length > 15) {
			throw new Boom('Invalid phone or otp', { statusCode: 401 })
		}
		const db = await getConnection()
		const repo = db.getRepository(OTP)
		const item = await repo.findOne({
			phoneNumber: +phone,
			otp: +otp,
			expiresAt: Not(LessThan(new Date()))
		})
		if(!item) {
			throw new Boom('Unknown OTP', { statusCode: 401 })
		}
		return item
	})

	api.register({
		notFound: errorHandlingWrap(() => {
			throw new Boom('Not Found', { statusCode: 404 })
		}),
		validationFail: errorHandlingWrap<any>(async() => { }),
		...Object.keys(routes).reduce((dict, key) => ({
			...dict, [key]: errorHandlingWrap(routes[key])
		}), { })
	})
	// initalize the backend
	api.init()
	return api
}