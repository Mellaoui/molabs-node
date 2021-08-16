import { readFileSync, writeFileSync } from 'fs'
import { dump, load } from 'js-yaml';
import openapiTS, { SchemaObject } from "openapi-typescript";
import SCOPES from '../scopes.json'

const OPENAPI_FILE = './openapi.yaml';

(async() => {
	const parsedYaml: any = load( readFileSync(OPENAPI_FILE, { encoding: 'utf-8' }) )
	parsedYaml.components.schemas.Scope.enum = Object.keys(SCOPES)
	parsedYaml.components.securitySchemes.chatdaddy.flows.password.scopes = 
		Object.keys(SCOPES).reduce(
			(dict, scope) => ({
				...dict, [scope]: SCOPES[scope].description
			}), {}
		)
	// save with updated scopes
	writeFileSync(
		OPENAPI_FILE,
		dump(parsedYaml, {  })
	)

	const output = await openapiTS(OPENAPI_FILE, {
		formatter: (node: SchemaObject) => {
			if (node.format === 'date-time') {
				return "Date | string"; // return the TypeScript “Date” type, as a string
			}
		}
		// for all other schema objects, let openapi-typescript decide (return undefined)
	})
	writeFileSync('./src/types/gen.ts', output)
})()
