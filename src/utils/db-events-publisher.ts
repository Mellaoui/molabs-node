import { EntityMetadata, EntitySubscriberInterface, InsertEvent, RemoveEvent, UpdateEvent } from "typeorm";
import eventsManager from "./events-manager";

const getValue = (obj: any, path: string[]) => (
	path.reduce(function(a, b) {
		return typeof a === 'object' ? a[b] : undefined
	}, obj)
)
const setValue = (obj: any, path: string[], value: any) => (
	path.reduce(function(a, b, idx) {
		if(idx === path.length-1) {
			a[b] = value
		} else {
			a[b] = a[b] || {}
		}
		return a[b]
	}, obj)
)

export class DBEventsPublisher<T extends { ownerId: () => string | undefined }> implements EntitySubscriberInterface<T> {
	entity: new () => T
	entityName: string
	constructor(entity: new () => T) {
		this.entity = entity
		this.entityName = entity.name.toLocaleLowerCase()
	}
	listenTo() {
		return this.entity
	}
	eventPublish(event: string, data: T | Partial<T>, ownerId: string | undefined) {
		eventsManager.publish(event as any, ownerId!, data)
	}
	getId(e: T, metadata: EntityMetadata): Partial<T> {
		const p: Partial<T> = {}
		for(const column of metadata.primaryColumns) {
			const path = column.propertyPath.split('.')
			const value = getValue(e, path)
			setValue(p, path, value)
		}
		return p
	}
	afterInsert(event: InsertEvent<T>) {
		const name = `${this.entityName}-insert`
		this.eventPublish(name, event.entity, event.entity.ownerId())
	}
	beforeUpdate(event: UpdateEvent<T>) {
		if (!event.entity) return

		const name = `${this.entityName}-update`
		const update = this.getId(event.entity as T, event.metadata)
		for(const column of event.updatedColumns) {
			const name = column.propertyName
			update[name] = event.entity[name]
		}
		this.eventPublish(name, update, event.entity.ownerId())
	}
	beforeRemove(event: RemoveEvent<T>) {
		if (!event.entity && !event.databaseEntity) {
			console.log(`no entity for delete event in ${this.entityName}`)
			return
		}

		const name = `${this.entityName}-delete`
		const entity = event.entity || event.databaseEntity
		const deleteItem = this.getId(entity, event.metadata)
		this.eventPublish(name, deleteItem, entity.ownerId())
	}
}