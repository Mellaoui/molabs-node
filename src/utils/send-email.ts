import { setApiKey, send } from '@sendgrid/mail'

setApiKey(process.env.SENDGRID_API_KEY!)

export default async(email: string, subject: string, html: string) => {
    if(process.env.NODE_ENV === 'test') {
		require('../tests/test-notifications').notifications.push({
			type: 'email',
			id: email,
			content: html
		})
		return 
	}


	await send(
		{
            to: email,
            from: {
                email: 'hello@chatdaddy.tech',
                name: 'ChatDaddy'
            },
            subject,
            html
        }
	)
}