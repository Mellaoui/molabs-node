import { SNS } from 'aws-sdk'
import EventARNMap from '../eventMap.json'
import MAIN_LOGGER from './logger'

export type EventsManager = ReturnType<typeof makeEventsManager>

export const testEvents: any[] = []

const makeEventsManager = () => {
	const MAX_EVENTS = +(process.env.EVENTS_PUSH_SIZE || 250)
	const logger = MAIN_LOGGER.child({ stream: 'events-manager' })
	const sns = new SNS({
		region: 'ap-east-1',
		accessKeyId: process.env.AWS_ACCESS_KEY,
		secretAccessKey: process.env.AWS_SECRET_KEY
	})
	const isTest = process.env.NODE_ENV === 'test'
	if(isTest) {
		logger.info('[TEST] test env, no events will be published')
	}
	let eventCount = 0
	let events: { [_: string]: {[id: string]: any[]} } = { }

	const flush = async() => {
		if(!eventCount) return 
		logger.info('flushing events...')
		const eventsToFlush = events
		const eventCountToFlush = eventCount
		events = {}
		eventCount = 0
	
		await Promise.all(
			Object.keys(eventsToFlush).flatMap(
				event => (
					Object.keys(eventsToFlush[event]).map(
						async id => {
							const events = eventsToFlush[event][id]
							try {
								!isTest && await sns.publish({
									TopicArn: EventARNMap[event],
									Message: JSON.stringify(events),
									MessageAttributes: {
										ownerId: {
											DataType: 'String',
											StringValue: id
										}
									}
								})
								.promise()
							} catch(error) {
								logger.error({ trace: error.stack, length: events.length }, 'error in emitting events')
							}
						}
					)
				)
			)
		)
		logger.info(`flushed ${eventCountToFlush} events`)
	}

	return {
		publish: (event: keyof typeof EventARNMap, id: string, data: any) => {
			if(!EventARNMap[event]) {
				logger.warn(`No ARN for ${event}, ignoring`)
				return
			}
			if(!events[event]) events[event] = {}
			if(!events[event][id]) events[event][id] = []
			events[event][id].push(data)
			eventCount += 1

			if(eventCount > MAX_EVENTS) {
				flush()
			}
		},
		flush
	}
}
export default makeEventsManager()