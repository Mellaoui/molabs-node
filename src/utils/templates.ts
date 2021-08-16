import { readFileSync } from "fs";
import { load } from "js-yaml";
import he from 'he'
import mustache from 'mustache'

type Template = 'otp' | 'contactAssigned' | 'signUp' | 'newConnection' | 'disconnected'
type TemplateObject = { title: string, content: string }
const json = load( readFileSync('./templates.yaml', { encoding: 'utf-8' }) ) as { [T in Template]: TemplateObject }

const URL_REGEX = /(http|ftp|https):\/\/[\w-]+(\.[\w-]+)+([\w.,@?^=%&amp;:\/~+#-]*[\w@?^=%&amp;\/~+#-])?/g

const parsingLinks = (text: string) => text.replace (URL_REGEX, str => `<a href="${str.startsWith('http') ? str : `http://${str}`}">${str}</a>`)

export const replacingParameters = (text: string, parameters: { [_: string]: any }) => (
	he.decode(mustache.render(
		text, 
		parameters
	))
)

export const toHTML = (text: string) => {
	text = mustache.render(text, {})
	text = parsingLinks(text)
	text = text.replace(/(\n|\r)/g, '<br>')
	return text
}

export const replacingParametersOfTemplate = (template: Template, parameters: { [_: string]: any }) => (
	replacingParameters(json[template].content, parameters)
)
export const getTemplate = (template: Template) => json[template]