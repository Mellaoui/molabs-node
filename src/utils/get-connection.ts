import { Connection, ConnectionOptions, createConnection, getConnectionManager } from "typeorm";
import config from '../../ormconfig'
import entities from '../entity'
import Team from "../entity/Team";
import TeamMember from "../entity/TeamMember";
import User from "../entity/User";
import { DBEventsPublisher } from "./db-events-publisher";

const CONNECTION_NAME = 'default';
const connectionManager = getConnectionManager()

const getConnection = async() => {
  let connection: Connection
  if(connectionManager.has(CONNECTION_NAME)) {
    connection = await connectionManager.get(CONNECTION_NAME)
    if(!connection.isConnected) {
      connection = await connection.connect()
    }
  } else {
    console.log('created')
    //@ts-ignore
    config.entities = entities
    connection = await createConnection(config as ConnectionOptions)
    for(const entity of [User, Team, TeamMember]) {
      connection.subscribers.push(
        new DBEventsPublisher(entity as any)
      )
    }
  }
  return connection
}
export default getConnection
