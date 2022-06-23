import { decodeSecretKeySeed } from '@digitalcredentials/bnid'
import * as didKey from '@digitalcredentials/did-method-key'
import vcjs from '@digitalcredentials/vc'

import { securityLoader } from '../documentLoader'

const DEFAULT_LOADER = securityLoader()

// Used to generate did:key from secret seed
const didKeyDriver = didKey.driver()

export interface IKeyPairDescription {
  id: string
  type: string
  controller: string
  publicKeyMultibase: string
  privateKeyMultibase?: string
}

interface IDidDocument {
  '@context': string | string[]
  id: string
  verificationMethod?: IKeyPairDescription | IKeyPairDescription[]
  authentication?: string | string[] | IKeyPairDescription | IKeyPairDescription[]
  assertionMethod?: string | string[] | IKeyPairDescription | IKeyPairDescription[]
  capabilityDelegation?: string | string[] | IKeyPairDescription | IKeyPairDescription[]
  capabilityInvocation?: string | string[] | IKeyPairDescription | IKeyPairDescription[]
  keyAgreement?: string | string[] | IKeyPairDescription | IKeyPairDescription[]
  service: any | any[]
}

interface IDidDocumentGenerateResult {
  didDocument: IDidDocument
  keyPairs: Map<string, object>
  methodFor: (options: object) => object
}

export async function generateDid(
  secretKeySeed: string,
  didMethod: string = 'key',
  url?: string
): Promise<IDidDocumentGenerateResult> {
  const didSeedBytes = decodeSeed(secretKeySeed)
  switch (didMethod) {
    case 'key':
      return didKeyDriver.generate({ seed: didSeedBytes }) as IDidDocumentGenerateResult
    default:
      throw new TypeError(`Unrecognized DID method "${didMethod}".`)
  }
}

export async function issueCredential(unsignedCredential: any, suite: any, documentLoader: any = DEFAULT_LOADER) {
  return vcjs.issue({ credential: unsignedCredential, suite, documentLoader })
}

function decodeSeed(secretKeySeed: string): Uint8Array {
  let secretKeySeedBytes: Uint8Array
  if (secretKeySeed.startsWith('z')) {
    // A multibase-decoded key seed, such as that generated via @digitalcredentials/did-cli
    secretKeySeedBytes = decodeSecretKeySeed({ secretKeySeed })
  } else if (secretKeySeed.length >= 32) {
    secretKeySeedBytes = new TextEncoder().encode(secretKeySeed).slice(0, 32)
  } else {
    throw TypeError('"secretKeySeed" must be at least 32 bytes, preferably multibase-encoded.')
  }

  return secretKeySeedBytes
}
