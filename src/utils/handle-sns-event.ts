import { SNSEvent, Context } from "aws-lambda"
import { Logger } from "pino"
import MAIN_LOGGER from './logger'

export default (
	handle: (event: string, data: any, identifier: string, logger: Logger) => Promise<void> 
) => (
	async(event: SNSEvent, ctx: Context) => {
		const logger = MAIN_LOGGER.child({ requestId: ctx.awsRequestId })
		await Promise.all(
			event.Records.map(async({ Sns: { TopicArn, Message }  }) => {
				const [event] = TopicArn.split(':').slice(-1) 
				logger.info({ event, data: Message.slice(0, 100) }, 'received event')
	
				const data = JSON.parse(Message)
				const ownerId = data.ownerId
				if(!ownerId) return

				await handle(
					event,
					data,
					ownerId,
					logger.child({ ownerId })
				)
			})
		)
	}
)