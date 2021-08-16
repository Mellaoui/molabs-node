const nodeEnv = process.env.NODE_ENV || 'development'
require('dotenv').config({ path: `.env.${nodeEnv}` })

const isTS = process.env.TS === '1'
const URL = require('url').URL
const uri = new URL(process.env.DB_URI)

const NamingStrategy = require('typeorm-naming-strategies').SnakeNamingStrategy

module.exports = {
    type: uri.protocol.slice(0, -1),
    host: uri.hostname,
    port: uri.port || 5432,
    username: uri.username,
    password: uri.password || undefined,
    database: uri.pathname.slice(1),
    synchronize: false,
    logging: false,
    entities: [isTS ? `src/entity/*.ts` : `.build/src/entity/*.js`],
    migrations: [isTS ? `src/migrations/*.ts` : `.build/src/migrations/*.js`],
    cli: {
        migrationsDir: 'src/migrations',
    },
    extra: { connectionLimit: 2 },
    namingStrategy: new NamingStrategy()
}