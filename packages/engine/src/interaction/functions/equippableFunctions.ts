import { dispatchAction } from '@xrengine/hyperflux'

import { ParityValue } from '../../common/enums/ParityValue'
import { Engine } from '../../ecs/classes/Engine'
import { Entity } from '../../ecs/classes/Entity'
import { addComponent, getComponent, hasComponent, removeComponent } from '../../ecs/functions/ComponentFunctions'
import { NetworkObjectComponent } from '../../networking/components/NetworkObjectComponent'
import { WorldNetworkAction } from '../../networking/functions/WorldNetworkAction'
import { EquippedComponent } from '../components/EquippedComponent'
import { EquipperComponent } from '../components/EquipperComponent'
import { EquippableAttachmentPoint } from '../enums/EquippedEnums'

export const equipEntity = (
  equipperEntity: Entity,
  equippedEntity: Entity,
  attachmentPoint: EquippableAttachmentPoint = EquippableAttachmentPoint.RIGHT_HAND
): void => {
  if (!hasComponent(equipperEntity, EquipperComponent) && !hasComponent(equippedEntity, EquippedComponent)) {
    addComponent(equipperEntity, EquipperComponent, { equippedEntity, data: {} as any })
    addComponent(equippedEntity, EquippedComponent, { equipperEntity, attachmentPoint })
    dispatchEquipEntity(equippedEntity, true)
  }
}

export const unequipEntity = (equipperEntity: Entity): void => {
  console.log('unequip')
  const equipperComponent = getComponent(equipperEntity, EquipperComponent)
  if (!equipperComponent) return

  console.log(equipperComponent)
  removeComponent(equipperEntity, EquipperComponent)
  dispatchEquipEntity(equipperComponent.equippedEntity, false)
}

const dispatchEquipEntity = (equippedEntity: Entity, equip: boolean): void => {
  const world = Engine.instance.currentWorld
  if (Engine.instance.userId === world.worldNetwork.hostId) return

  const equippedComponent = getComponent(equippedEntity, EquippedComponent)
  const attachmentPoint = equippedComponent.attachmentPoint
  const networkComponet = getComponent(equippedEntity, NetworkObjectComponent)

  dispatchAction(
    WorldNetworkAction.setEquippedObject({
      object: {
        ownerId: networkComponet.ownerId,
        networkId: networkComponet.networkId
      },
      attachmentPoint: attachmentPoint,
      equip: equip
    }),
    Engine.instance.currentWorld.worldNetwork.hostId
  )
}

export const changeHand = (equipperEntity: Entity, attachmentPoint: EquippableAttachmentPoint): void => {
  const equipperComponent = getComponent(equipperEntity, EquipperComponent)
  if (equipperComponent) {
    const equippedEntity = equipperComponent.equippedEntity
    const equippedComponent = getComponent(equippedEntity, EquippedComponent)
    equippedComponent.attachmentPoint = attachmentPoint
  } else {
    console.warn(`changeHand for equippable called on entity with id ${equipperEntity} without equipperComponent!.`)
  }
}

export const getAttachmentPoint = (parityValue: ParityValue): EquippableAttachmentPoint => {
  let attachmentPoint = EquippableAttachmentPoint.RIGHT_HAND
  if (parityValue === ParityValue.LEFT) attachmentPoint = EquippableAttachmentPoint.LEFT_HAND

  return attachmentPoint
}

export const getParity = (attachmentPoint: EquippableAttachmentPoint): ParityValue => {
  let parityValue = ParityValue.RIGHT
  if (attachmentPoint === EquippableAttachmentPoint.LEFT_HAND) parityValue = ParityValue.LEFT

  return parityValue
}
