import { Ed25519Signature2020 } from '@digitalcredentials/ed25519-signature-2020'
import assert from 'assert'

import { generateDid, IKeyPairDescription, issueCredential } from '../../src/identity'

const CREDENTIAL_SIGNING_SECRET_KEY_SEED = 'z1AZK4h5w5YZkKYEgqtcFfvSbWQ3tZ3ZFgmLsXMZsTVoeK7'

describe.only('identity', () => {
  it('generates a did', async () => {
    const { didDocument, keyPairs, methodFor } = await generateDid(CREDENTIAL_SIGNING_SECRET_KEY_SEED)
    assert.equal(didDocument.id, 'did:key:z6Mkfeco2NSEPeFV3DkjNSabaCza1EoS3CmqLb1eJ5BriiaR')

    const keyId = didDocument.assertionMethod![0]
    const keyPair = keyPairs.get(keyId) as any
    assert.equal(keyPair.type, 'Ed25519VerificationKey2020')
    assert.equal(keyPair.controller, 'did:key:z6Mkfeco2NSEPeFV3DkjNSabaCza1EoS3CmqLb1eJ5BriiaR')

    const signingKey = methodFor({ purpose: 'assertionMethod' }) as IKeyPairDescription
    assert.equal(
      signingKey.privateKeyMultibase,
      'zrv1WyGTYHqjHHHD8FuYbnMBsReXBXTbrqZrpfTHNFpeCKS1MDcGUodNfBmihrCiSwY7fxPnsGjCoVZ3e9pGLYHWREM'
    )
  })

  it('issues/signs a VC', async () => {
    const { didDocument, methodFor } = await generateDid(CREDENTIAL_SIGNING_SECRET_KEY_SEED)
    const issuer = didDocument.id
    const key = methodFor({ purpose: 'assertionMethod' }) as IKeyPairDescription
    const suite = new Ed25519Signature2020({ key })

    const unsignedCredential = {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        // The object below is a temporary (in-line) context, used for an example
        {
          etherealEvent: 'https://w3id.org/xr/v1#etherealEvent',
          EnteredVolumeEvent: 'https://w3id.org/xr/v1#EnteredVolumeEvent',
          CheckpointEvent: 'https://w3id.org/xr/v1#CheckpointEvent',
          checkpointId: 'https://w3id.org/xr/v1#checkpointId'
        }
      ],
      type: ['VerifiableCredential'],
      issuer,
      issuanceDate: '2022-01-01T19:23:24Z',
      credentialSubject: {
        id: 'did:example:user:1234',
        etherealEvent: [
          {
            type: ['EnteredVolumeEvent', 'CheckpointEvent'],
            checkpointId: '12345'
          }
        ]
      }
    }

    const signedVc = await issueCredential(unsignedCredential, suite)

    // console.log(JSON.stringify(signedVc, null, 2))

    assert.equal(signedVc.proof.type, 'Ed25519Signature2020')
    assert.equal(signedVc.proof.proofPurpose, 'assertionMethod')
    assert.equal(signedVc.proof.verificationMethod, key.id)
  })
})
