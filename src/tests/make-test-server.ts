import express from 'express'
import { api } from '../functions/api'

export default () => {
	const app = express()
	app.use(express.json({ limit: '6mb' }));  // lambda limit
	app.use((req, res) => api.handleRequest(req as any, req, res));
	return app
}