import type { WASendContent } from "../utils/send-whatsapp";

export const notifications: ({ 
	type: 'sms' | 'email', 
	id: string
	content: string
} | { 
	type: 'whatsapp', 
	id: string
	content: WASendContent
})[] = []