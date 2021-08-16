import { generateKeyPairSync } from "crypto"
import { writeFileSync } from "fs"

(async() => {
	let { privateKey, publicKey } = generateKeyPairSync('ec', {
		namedCurve: 'secp256k1',
		publicKeyEncoding: {
			type: 'spki',
			format: 'pem'
		},
		privateKeyEncoding: {
			type: 'pkcs8',
			format: 'pem'
		}
	  })
	// store raw base64 keys
	privateKey = privateKey.split('-----')[2].replace(/\n/g, '')
	publicKey = publicKey.split('-----')[2].replace(/\n/g, '')
	writeFileSync('./src/keys.json', JSON.stringify({ privateKey, publicKey }, undefined, 2))
})()