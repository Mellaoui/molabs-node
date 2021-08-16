import { SNS } from "aws-sdk";

const sns = new SNS({
	region: 'ap-south-1',
	accessKeyId: process.env.AWS_ACCESS_KEY,
	secretAccessKey: process.env.AWS_SECRET_KEY
})
const sendSMS = async(phoneNumber: number, content: string) => {
	if(process.env.NODE_ENV === 'test') {
		require('../tests/test-notifications').notifications.push({
			type: 'sms',
			id: phoneNumber.toString(),
			content: content
		})
		return 
	}

	const result = await sns.publish({
		Message: content,
		PhoneNumber: phoneNumber.toString(),
		MessageAttributes: {
			'AWS.SNS.SMS.SMSType': {
				'DataType': 'String',
                'StringValue': 'Transactional'
			}
		}
	})
	.promise()

	return result.MessageId
}
export default sendSMS