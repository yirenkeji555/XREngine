import { dispatchAction } from '@xrengine/hyperflux'

import { Engine } from '../../ecs/classes/Engine'
import { Network } from '../classes/Network'
import { WorldNetworkAction } from './WorldNetworkAction'

export async function validateNetworkObjects(network: Network): Promise<void> {
  for (const [userId, client] of network.peers) {
    if (userId === Engine.instance.userId) continue
    // Validate that user has phoned home recently
    if (Date.now() - client.lastSeenTs > 30000) {
      console.log('Removing client ', userId, ' due to inactivity')

      dispatchAction(WorldNetworkAction.destroyPeer({ $from: userId }), network.hostId)

      console.log('Disconnected Client:', client.userId)
      if (client?.instanceRecvTransport) {
        console.log('Closing instanceRecvTransport')
        await client.instanceRecvTransport.close()
        console.log('Closed instanceRecvTransport')
      }
      if (client?.instanceSendTransport) {
        console.log('Closing instanceSendTransport')
        await client.instanceSendTransport.close()
        console.log('Closed instanceSendTransport')
      }
      if (client?.channelRecvTransport) {
        console.log('Closing channelRecvTransport')
        await client.channelRecvTransport.close()
        console.log('Closed channelRecvTransport')
      }
      if (client?.channelSendTransport) {
        console.log('Closing channelSendTransport')
        await client.channelSendTransport.close()
        console.log('Closed channelSendTransport')
      }

      console.log('Removed transports for', userId)
    }
  }
}
