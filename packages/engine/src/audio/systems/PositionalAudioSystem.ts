import sdpTransform from 'sdp-transform'
import { Audio as AudioObject } from 'three'
import { AudioContext } from 'three'

import { addActionReceptor } from '@xrengine/hyperflux'

import { AvatarComponent } from '../../avatar/components/AvatarComponent'
import { matches } from '../../common/functions/MatchesUtils'
import { Engine } from '../../ecs/classes/Engine'
import { EngineActions, EngineActionType } from '../../ecs/classes/EngineState'
import { Entity } from '../../ecs/classes/Entity'
import { World } from '../../ecs/classes/World'
import { addComponent, defineQuery, getComponent, hasComponent } from '../../ecs/functions/ComponentFunctions'
import { LocalInputTagComponent } from '../../input/components/LocalInputTagComponent'
import { NetworkObjectComponent } from '../../networking/components/NetworkObjectComponent'
import { MediaStreams } from '../../networking/systems/MediaStreamSystem'
import {
  PositionalAudioSettingsComponent,
  PositionalAudioSettingsComponentType
} from '../../scene/components/AudioSettingsComponent'
import { Object3DComponent } from '../../scene/components/Object3DComponent'
import {
  deserializeAudio,
  SCENE_COMPONENT_AUDIO,
  SCENE_COMPONENT_AUDIO_DEFAULT_VALUES,
  updateAudio
} from '../../scene/functions/loaders/AudioFunctions'
import { AudioComponent, AudioComponentType } from '../components/AudioComponent'
import { AudioTagComponent } from '../components/AudioTagComponent'
import { AudioType } from '../constants/AudioConstants'

const SHOULD_CREATE_SILENT_AUDIO_ELS = typeof navigator !== 'undefined' && /chrome/i.test(navigator.userAgent)
function createSilentAudioEl(streamsLive) {
  const audioEl = new Audio()
  audioEl.setAttribute('autoplay', 'autoplay')
  audioEl.setAttribute('playsinline', 'playsinline')
  audioEl.srcObject = streamsLive
  audioEl.volume = 0 // we don't actually want to hear audio from this element
  return audioEl
}

let delayedReconnectTimeout: ReturnType<typeof setTimeout> | null = null
function performDelayedReconnect(gainNode) {
  if (delayedReconnectTimeout) {
    clearTimeout(delayedReconnectTimeout)
  }

  delayedReconnectTimeout = setTimeout(() => {
    delayedReconnectTimeout = null
    console.warn(
      'enableChromeAEC: recreate RTCPeerConnection loopback because the local connection was disconnected for 10s'
    )
    // eslint-disable-next-line no-use-before-define
    enableChromeAEC(gainNode)
  }, 10000)
}

async function enableChromeAEC(gainNode) {
  /**
   *  workaround for: https://bugs.chromium.org/p/chromium/issues/detail?id=687574
   *  1. grab the GainNode from the scene's THREE.AudioListener
   *  2. disconnect the GainNode from the AudioDestinationNode (basically the audio out), this prevents hearing the audio twice.
   *  3. create a local webrtc connection between two RTCPeerConnections (see this example: https://webrtc.github.io/samples/src/content/peerconnection/pc1/)
   *  4. create a new MediaStreamDestination from the scene's THREE.AudioContext and connect the GainNode to it.
   *  5. add the MediaStreamDestination's track  to one of those RTCPeerConnections
   *  6. connect the other RTCPeerConnection's stream to a new audio element.
   *  All audio is now routed through Chrome's audio mixer, thus enabling AEC, while preserving all the audio processing that was performed via the WebAudio API.
   */

  const audioEl = new Audio()
  audioEl.setAttribute('autoplay', 'autoplay')
  audioEl.setAttribute('playsinline', 'playsinline')

  const context = AudioContext.getContext()
  const loopbackDestination = context.createMediaStreamDestination()
  const outboundPeerConnection = new RTCPeerConnection()
  const inboundPeerConnection = new RTCPeerConnection()

  const onError = (e) => {
    console.error('enableChromeAEC: RTCPeerConnection loopback initialization error', e)
  }

  outboundPeerConnection.addEventListener('icecandidate', (e) => {
    if (e?.candidate) inboundPeerConnection.addIceCandidate(e.candidate).catch(onError)
  })
  outboundPeerConnection.addEventListener('iceconnectionstatechange', () => {
    console.warn(
      'enableChromeAEC: outboundPeerConnection state changed to ' + outboundPeerConnection.iceConnectionState
    )
    if (outboundPeerConnection.iceConnectionState === 'disconnected') {
      performDelayedReconnect(gainNode)
    }
    if (outboundPeerConnection.iceConnectionState === 'connected') {
      if (delayedReconnectTimeout) {
        // The RTCPeerConnection reconnected by itself, cancel recreating the
        // local connection.
        clearTimeout(delayedReconnectTimeout)
      }
    }
  })

  inboundPeerConnection.addEventListener('icecandidate', (e) => {
    if (e?.candidate) outboundPeerConnection.addIceCandidate(e.candidate).catch(onError)
  })
  inboundPeerConnection.addEventListener('iceconnectionstatechange', () => {
    console.warn('enableChromeAEC: inboundPeerConnection state changed to ' + inboundPeerConnection.iceConnectionState)
    if (inboundPeerConnection.iceConnectionState === 'disconnected') {
      performDelayedReconnect(gainNode)
    }
    if (inboundPeerConnection.iceConnectionState === 'connected') {
      if (delayedReconnectTimeout) {
        // The RTCPeerConnection reconnected by itself, cancel recreating the
        // local connection.
        clearTimeout(delayedReconnectTimeout)
      }
    }
  })

  inboundPeerConnection.addEventListener('track', (e) => {
    audioEl.srcObject = e.streams[0]
  })

  try {
    //The following should never fail, but just in case, we won't disconnect/reconnect the gainNode unless all of this succeeds
    loopbackDestination.stream.getTracks().forEach((track) => {
      outboundPeerConnection.addTrack(track, loopbackDestination.stream)
    })

    const offer = await outboundPeerConnection.createOffer()
    outboundPeerConnection.setLocalDescription(offer)
    await inboundPeerConnection.setRemoteDescription(offer)

    const answer = await inboundPeerConnection.createAnswer()

    // Rewrite SDP to be stereo and (variable) max bitrate
    const parsedSdp = sdpTransform.parse(answer.sdp)
    for (let i = 0; i < parsedSdp.media.length; i++) {
      for (let j = 0; j < parsedSdp.media[i].fmtp.length; j++) {
        parsedSdp.media[i].fmtp[j].config += `;stereo=1;cbr=0;maxaveragebitrate=510000;`
      }
    }
    answer.sdp = sdpTransform.write(parsedSdp)

    inboundPeerConnection.setLocalDescription(answer)
    outboundPeerConnection.setRemoteDescription(answer)

    gainNode.disconnect()
    gainNode.connect(loopbackDestination)
    console.log('gainNode connected', gainNode)
  } catch (e) {
    onError(e)
  }
}

/** System class which provides methods for Positional Audio system. */

export default async function PositionalAudioSystem(world: World) {
  const avatarAudioQuery = defineQuery([AudioTagComponent, AvatarComponent])
  const audioTagQuery = defineQuery([AudioTagComponent])
  const audioQuery = defineQuery([AudioComponent])
  const settingsQuery = defineQuery([PositionalAudioSettingsComponent])

  const avatarAudioStream: Map<Entity, any> = new Map()

  function audioReceptors(action: EngineActionType) {
    matches(action)
      .when(EngineActions.startSuspendedContexts.matches, () => {
        console.log('starting suspended audio nodes')
        for (const entity of avatarAudioQuery()) {
          const audio = getComponent(entity, Object3DComponent).value
          const audioEl = audio?.userData.audioEl
          if (audioEl && audioEl.context?.state === 'suspended') audioEl.context.resume()
        }
        if (!Engine.instance.isEditor) {
          for (const entity of audioQuery()) {
            const audio = getComponent(entity, Object3DComponent).value
            const audioEl = audio?.userData.audioEl
            if (audioEl && audioEl.autoplay) audioEl.play()
          }
        }
      })
      .when(EngineActions.suspendPositionalAudio.matches, () => {
        for (const entity of avatarAudioQuery()) {
          const audio = getComponent(entity, Object3DComponent).value
          const audioEl = audio?.userData.audioEl
          if (audioEl && audioEl.context) audioEl.context.suspend()
        }
      })
  }
  addActionReceptor(Engine.instance.store, audioReceptors)

  let positionalAudioSettings: PositionalAudioSettingsComponentType

  const applyMediaAudioSettings = (props: AudioComponentType, setVolume = true): AudioComponentType => {
    props.audioType = positionalAudioSettings.usePositionalAudio ? AudioType.Positional : AudioType.Stereo
    props.distanceModel = positionalAudioSettings.mediaDistanceModel
    props.maxDistance = positionalAudioSettings.mediaMaxDistance
    props.refDistance = positionalAudioSettings.mediaRefDistance
    props.rolloffFactor = positionalAudioSettings.mediaRolloffFactor
    if (setVolume) props.volume = positionalAudioSettings.mediaVolume

    return props
  }

  return () => {
    for (const entity of settingsQuery.enter()) {
      positionalAudioSettings = getComponent(entity, PositionalAudioSettingsComponent)
    }

    for (const entity of audioTagQuery.exit()) {
      const obj3d = getComponent(entity, Object3DComponent, true)
      if (obj3d && obj3d.value.userData.audioEl?.source) obj3d.value.userData.audioEl.disconnect()
    }

    for (const entity of avatarAudioQuery.enter()) {
      const entityNetworkObject = getComponent(entity, NetworkObjectComponent)
      if (entityNetworkObject) {
        const peerId = entityNetworkObject.ownerId
        const consumer = MediaStreams.instance?.consumers.find(
          (c: any) => c.appData.peerId === peerId && c.appData.mediaTag === 'cam-audio'
        )
        if (consumer == null && avatarAudioStream.get(entity) != null) {
          avatarAudioStream.delete(entity)
        }
      }

      const props = applyMediaAudioSettings(SCENE_COMPONENT_AUDIO_DEFAULT_VALUES)
      addComponent(entity, AudioComponent, props)
      updateAudio(entity, props)
    }

    for (const entity of avatarAudioQuery.exit()) {
      avatarAudioStream.delete(entity)
    }

    for (const entity of avatarAudioQuery()) {
      if (hasComponent(entity, LocalInputTagComponent)) continue

      const entityNetworkObject = getComponent(entity, NetworkObjectComponent)
      let consumer
      if (entityNetworkObject != null) {
        const peerId = entityNetworkObject.ownerId
        consumer = MediaStreams.instance?.consumers.find(
          (c: any) => c.appData.peerId === peerId && c.appData.mediaTag === 'cam-audio'
        )
      }

      if (!consumer) continue
      if (avatarAudioStream.has(entity) && consumer.id === avatarAudioStream.get(entity).id) continue

      const consumerLive = consumer.track
      avatarAudioStream.set(entity, consumerLive)
      const streamsLive = new MediaStream([consumerLive.clone()])

      const avatarAudio = getComponent(entity, Object3DComponent)?.value
      console.log('avatarAudio', avatarAudio)

      if (avatarAudio) {
        const audioEl = avatarAudio.userData.audioEl as AudioObject
        if (audioEl) {
          const audioStreamSource = audioEl.context.createMediaStreamSource(streamsLive)
          if (audioEl.context.state === 'suspended') audioEl.context.resume()

          audioEl.setNodeSource(audioStreamSource as unknown as AudioBufferSourceNode)

          if (SHOULD_CREATE_SILENT_AUDIO_ELS) {
            enableChromeAEC(audioEl.gain) // TODO: Do the audio els need to get cleaned up?
          }
        }
      }
    }
  }
}
