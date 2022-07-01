import { Ed25519Signature2020 } from '@digitalcredentials/ed25519-signature-2020'
import * as polyfill from 'credential-handler-polyfill'
import React, { useEffect, useState } from 'react'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'

import { validateEmail, validatePhoneNumber } from '@xrengine/common/src/config'
import { generateDid, IKeyPairDescription, issueCredential } from '@xrengine/common/src/identity'

import { Check, Close, Create, GitHub, Send } from '@mui/icons-material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import RefreshIcon from '@mui/icons-material/Refresh'
import { FormControlLabel } from '@mui/material'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Grid from '@mui/material/Grid'
import InputAdornment from '@mui/material/InputAdornment'
import { styled } from '@mui/material/styles'
import Switch from '@mui/material/Switch'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'

import { useAuthSettingState } from '../../../../admin/services/Setting/AuthSettingService'
import { DiscordIcon } from '../../../../common/components/Icons/DiscordIcon'
import { FacebookIcon } from '../../../../common/components/Icons/FacebookIcon'
import { GoogleIcon } from '../../../../common/components/Icons/GoogleIcon'
import { LinkedInIcon } from '../../../../common/components/Icons/LinkedInIcon'
import { TwitterIcon } from '../../../../common/components/Icons/TwitterIcon'
import { NotificationService } from '../../../../common/services/NotificationService'
import { AuthService, useAuthState } from '../../../services/AuthService'
import styles from '../index.module.scss'
import { getAvatarURLForUser, Views } from '../util'

interface Props {
  className?: string
  hideLogin?: boolean
  changeActiveMenu?: (type: string | null) => void
  setProfileMenuOpen?: (open: boolean) => void
}

const initialAuthState = {
  jwt: true,
  local: false,
  discord: false,
  facebook: false,
  github: false,
  google: false,
  linkedin: false,
  twitter: false,
  smsMagicLink: false,
  emailMagicLink: false
}

const initialOAuthConnectedState = {
  discord: false,
  facebook: false,
  github: false,
  google: false,
  linkedin: false,
  twitter: false
}

export const MaterialUISwitch = styled(Switch)(({ theme }) => ({
  width: 62,
  height: 34,
  padding: 7,
  '& .MuiSwitch-switchBase': {
    zIndex: 2,
    margin: 1,
    padding: 0,
    transform: 'translateX(6px)',
    '&.Mui-checked': {
      color: '#fff',
      transform: 'translateX(22px)',
      '& .MuiSwitch-thumb:before': {
        backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" height="20" width="20" viewBox="0 0 20 20"><path fill="${encodeURIComponent(
          '#fff'
        )}" d="M4.2 2.5l-.7 1.8-1.8.7 1.8.7.7 1.8.6-1.8L6.7 5l-1.9-.7-.6-1.8zm15 8.3a6.7 6.7 0 11-6.6-6.6 5.8 5.8 0 006.6 6.6z"/></svg>')`
      },
      '& + .MuiSwitch-track': {
        opacity: 1,
        backgroundColor: 'var(--themeSwitchTrack)'
      }
    }
  },
  '& .MuiSwitch-thumb': {
    backgroundColor: 'var(--themeSwitchThumb)',
    width: 32,
    height: 32,
    '&:before': {
      content: "''",
      position: 'absolute',
      width: '100%',
      height: '100%',
      left: 0,
      top: 0,
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'center',
      backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" height="20" width="20" viewBox="0 0 20 20"><path fill="${encodeURIComponent(
        '#fff'
      )}" d="M9.305 1.667V3.75h1.389V1.667h-1.39zm-4.707 1.95l-.982.982L5.09 6.072l.982-.982-1.473-1.473zm10.802 0L13.927 5.09l.982.982 1.473-1.473-.982-.982zM10 5.139a4.872 4.872 0 00-4.862 4.86A4.872 4.872 0 0010 14.862 4.872 4.872 0 0014.86 10 4.872 4.872 0 0010 5.139zm0 1.389A3.462 3.462 0 0113.471 10a3.462 3.462 0 01-3.473 3.472A3.462 3.462 0 016.527 10 3.462 3.462 0 0110 6.528zM1.665 9.305v1.39h2.083v-1.39H1.666zm14.583 0v1.39h2.084v-1.39h-2.084zM5.09 13.928L3.616 15.4l.982.982 1.473-1.473-.982-.982zm9.82 0l-.982.982 1.473 1.473.982-.982-1.473-1.473zM9.305 16.25v2.083h1.389V16.25h-1.39z"/></svg>')`
    }
  },
  '& .MuiSwitch-track': {
    opacity: 1,
    backgroundColor: 'var(--themeSwitchTrack)',
    borderRadius: 20 / 2
  }
}))

const ProfileMenu = ({ className, hideLogin, changeActiveMenu, setProfileMenuOpen }: Props): JSX.Element => {
  const { t } = useTranslation()
  const location = useLocation()

  const selfUser = useAuthState().user

  const [username, setUsername] = useState(selfUser?.name.value)
  const [emailPhone, setEmailPhone] = useState('')
  const [error, setError] = useState(false)
  const [errorUsername, setErrorUsername] = useState(false)
  const [showUserId, setShowUserId] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const authSettingState = useAuthSettingState()
  const [authSetting] = authSettingState?.authSettings?.value || []
  const [authState, setAuthState] = useState(initialAuthState)
  const loading = useAuthState().isProcessing.value
  const userSettings = selfUser.user_setting.value
  const userId = selfUser.id.value
  const apiKey = selfUser.apiKey?.token?.value
  const userRole = selfUser.userRole.value
  const [oauthConnectedState, setOauthConnectedState] = useState(initialOAuthConnectedState)

  useEffect(() => {
    if (authSetting) {
      let temp = { ...initialAuthState }
      authSetting?.authStrategies?.forEach((el) => {
        Object.entries(el).forEach(([strategyName, strategy]) => {
          temp[strategyName] = strategy
        })
      })
      setAuthState(temp)
    }
  }, [authSettingState?.updateNeeded?.value])

  const handleChangeUserThemeMode = (event) => {
    const settings = { ...userSettings, themeMode: event.target.checked ? 'dark' : 'light' }
    userSettings && AuthService.updateUserSettings(userSettings.id as string, settings)
  }

  let type = ''
  const addMoreSocial =
    (authState?.discord && !oauthConnectedState.discord) ||
    (authState.facebook && !oauthConnectedState.facebook) ||
    (authState.github && !oauthConnectedState.github) ||
    (authState.google && !oauthConnectedState.google) ||
    (authState.linkedin && !oauthConnectedState.linkedin) ||
    (authState.twitter && !oauthConnectedState.twitter)

  const removeSocial =
    (authState?.discord && oauthConnectedState.discord) ||
    (authState.facebook && oauthConnectedState.facebook) ||
    (authState.github && oauthConnectedState.github) ||
    (authState.google && oauthConnectedState.google) ||
    (authState.linkedin && oauthConnectedState.linkedin) ||
    (authState.twitter && oauthConnectedState.twitter)

  const loadCredentialHandler = async () => {
    try {
      const mediator =
        globalThis.process.env['VITE_MEDIATOR_SERVER'] +
        `/mediator?origin=${encodeURIComponent(window.location.origin)}`

      await polyfill.loadOnce(mediator)
      console.log('Ready to work with credentials!')
    } catch (e) {
      console.error('Error loading polyfill:', e)
    }
  }

  useEffect(() => {
    loadCredentialHandler()
  }, []) // Only run once

  useEffect(() => {
    selfUser && setUsername(selfUser.name.value)
  }, [selfUser.name.value])

  useEffect(() => {
    setOauthConnectedState(initialOAuthConnectedState)
    if (selfUser.identityProviders.value)
      for (let ip of selfUser.identityProviders.value) {
        switch (ip.type) {
          case 'discord':
            setOauthConnectedState((oauthConnectedState) => {
              return { ...oauthConnectedState, discord: true }
            })
            break
          case 'facebook':
            setOauthConnectedState((oauthConnectedState) => {
              return { ...oauthConnectedState, facebook: true }
            })
            break
          case 'linkedin':
            setOauthConnectedState((oauthConnectedState) => {
              return { ...oauthConnectedState, linkedin: true }
            })
            break
          case 'google':
            setOauthConnectedState((oauthConnectedState) => {
              return { ...oauthConnectedState, google: true }
            })
            break
          case 'twitter':
            setOauthConnectedState((oauthConnectedState) => {
              return { ...oauthConnectedState, twitter: true }
            })
            break
          case 'github':
            setOauthConnectedState((oauthConnectedState) => {
              return { ...oauthConnectedState, github: true }
            })
            break
        }
      }
  }, [selfUser.identityProviders])

  const updateUserName = (e) => {
    e.preventDefault()
    handleUpdateUsername()
  }

  const handleUsernameChange = (e) => {
    setUsername(e.target.value)
    if (!e.target.value) setErrorUsername(true)
  }

  const handleUpdateUsername = () => {
    const name = username.trim()
    if (!name) return
    if (selfUser.name.value.trim() !== name) {
      // @ts-ignore
      AuthService.updateUsername(userId, name)
    }
  }
  const handleInputChange = (e) => setEmailPhone(e.target.value)

  const validate = () => {
    if (emailPhone === '') return false
    if (validateEmail(emailPhone.trim()) && authState?.emailMagicLink) type = 'email'
    else if (validatePhoneNumber(emailPhone.trim()) && authState.smsMagicLink) type = 'sms'
    else {
      setError(true)
      return false
    }

    setError(false)
    return true
  }

  const handleGuestSubmit = (e: any): any => {
    e.preventDefault()
    if (!validate()) return
    if (type === 'email') AuthService.createMagicLink(emailPhone, authState, 'email')
    else if (type === 'sms') AuthService.createMagicLink(emailPhone, authState, 'sms')
    return
  }

  const handleOAuthServiceClick = (e) => {
    AuthService.loginUserByOAuth(e.currentTarget.id, location)
  }

  const handleRemoveOAuthServiceClick = (e) => {
    AuthService.removeUserOAuth(e.currentTarget.id)
  }

  const handleLogout = async (e) => {
    if (changeActiveMenu != null) changeActiveMenu(null)
    else if (setProfileMenuOpen != null) setProfileMenuOpen(false)
    setShowUserId(false)
    setShowApiKey(false)
    await AuthService.logoutUser()
    // window.location.reload()
  }

  /**
   * Example function, issues a Verifiable Credential, and uses the Credential
   * Handler API (CHAPI) to request to store this VC in the user's wallet.
   *
   * This is here in the ProfileMenu just for convenience -- it can be invoked
   * by the engine whenever appropriate (whenever a user performs some in-engine action,
   * makes a payment, etc).
   */
  async function handleIssueCredentialClick() {
    // Typically, this would be loaded directly from an env var (or other secret mgmt mechanism)
    // And used to bootstrap a client into a hardware KMS (Key Management System)
    // In this example, the secret seed is provided directly (obviously, don't do this)
    const CREDENTIAL_SIGNING_SECRET_KEY_SEED = 'z1AZK4h5w5YZkKYEgqtcFfvSbWQ3tZ3ZFgmLsXMZsTVoeK7'

    // Generate a DID Document and corresponding key pairs from the seed
    const { didDocument, methodFor } = await generateDid(CREDENTIAL_SIGNING_SECRET_KEY_SEED)

    // 'methodFor' serves as a wrapper/getter method for public/private key pairs
    // that were generated as a result of DID Doc creation.
    // It's a way to fetch keys not by ID (since that's quite opaque/random) but
    // by their usage purpose -- assertionMethod (for signing VCs), authentication (for DID Auth),
    // keyAgreement (for encrypting), etc.
    const key = methodFor({ purpose: 'assertionMethod' }) as IKeyPairDescription

    // This would typically be the Ethereal Engine's own DID, generated and cached at
    // startup from a secret.
    const issuer = didDocument.id

    // TODO: Extract from the logged in user's session
    const userDid = 'did:example:user:1234'

    const suite = new Ed25519Signature2020({ key })

    // Example VC that denotes that a user has entered a door / 3d volume
    const unsignedCredential = {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        // The object below is a temporary (in-line) context, used for an example
        // Once we settle on what our VC content is (what types we want to issue, etc)
        // We'll fold them all into the 'https://w3id.org/xr/v1' context
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
        id: userDid,
        etherealEvent: [
          {
            type: ['EnteredVolumeEvent', 'CheckpointEvent'],
            checkpointId: '12345'
          }
        ]
      }
    }

    const signedVc = await issueCredential(unsignedCredential, suite)

    console.log('Issued VC:', JSON.stringify(signedVc, null, 2))

    // Wrap the VC in an unsigned Verifiable Presentation
    const vp = {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: 'VerifiablePresentation',
      verifiableCredential: [signedVc]
    }

    const webCredentialType = 'VerifiablePresentation'
    // @ts-ignore
    const webCredentialWrapper = new window.WebCredential(webCredentialType, vp, {
      // recommendedHandlerOrigins: []
    })

    // Use Credential Handler API to store
    const result = await navigator.credentials.store(webCredentialWrapper)

    console.log('Result of receiving via store() request:', result)
  }

  async function handleRequestCredentialClick() {
    const vcRequestQuery: any = {
      web: {
        VerifiablePresentation: {
          query: [
            {
              type: 'QueryByExample',
              credentialQuery: [
                {
                  example: {
                    '@context': ['https://www.w3.org/2018/credentials/v1', 'https://w3id.org/xr/v1'],
                    type: 'VerifiableCredential'
                  }
                }
              ]
            }
          ]
        }
      }
    }

    const result = await navigator.credentials.get(vcRequestQuery)

    console.log('VC Request query result:', result)
  }

  async function handleWalletLoginClick() {
    const domain = window.location.origin
    const challenge = '99612b24-63d9-11ea-b99f-4f66f3e4f81a' // TODO: generate

    console.log('Sending DIDAuth query...')

    const didAuthQuery: any = {
      web: {
        VerifiablePresentation: {
          query: [
            {
              type: 'DIDAuth'
            }
          ],
          challenge,
          domain // e.g.: requestingparty.example.com
        }
      }
    }

    // Use Credential Handler API to authenticate and receive basic login display credentials
    const vprResult: any = await navigator.credentials.get(didAuthQuery)
    console.log(vprResult)

    AuthService.loginUserByXRWallet(vprResult)
  }

  const refreshApiKey = () => {
    AuthService.updateApiKey()
  }

  const getConnectText = () => {
    if (authState?.emailMagicLink && authState?.smsMagicLink) {
      return t('user:usermenu.profile.connectPhoneEmail')
    } else if (authState?.emailMagicLink && !authState?.smsMagicLink) {
      return t('user:usermenu.profile.connectEmail')
    } else if (!authState?.emailMagicLink && authState?.smsMagicLink) {
      return t('user:usermenu.profile.connectPhone')
    } else {
      return ''
    }
  }

  const getErrorText = () => {
    if (authState?.emailMagicLink && authState?.smsMagicLink) {
      return t('user:usermenu.profile.phoneEmailError')
    } else if (authState?.emailMagicLink && !authState?.smsMagicLink) {
      return t('user:usermenu.profile.emailError')
    } else if (!authState?.emailMagicLink && authState?.smsMagicLink) {
      return t('user:usermenu.profile.phoneError')
    } else {
      return ''
    }
  }

  const getConnectPlaceholder = () => {
    if (authState?.emailMagicLink && authState?.smsMagicLink) {
      return t('user:usermenu.profile.ph-phoneEmail')
    } else if (authState?.emailMagicLink && !authState?.smsMagicLink) {
      return t('user:usermenu.profile.ph-email')
    } else if (!authState?.emailMagicLink && authState?.smsMagicLink) {
      return t('user:usermenu.profile.ph-phone')
    } else {
      return ''
    }
  }

  const goToEthNFT = () => {
    let token = JSON.stringify(localStorage.getItem('TheOverlay-Auth-Store'))
    if (userId && token)
      window.open(`${globalThis.process.env['VITE_ETH_MARKETPLACE']}?data=${userId}&token=${token}`, '_blank')
  }

  const enableWalletLogin = !!globalThis.process.env['VITE_LOGIN_WITH_WALLET']

  const enableSocial =
    authState?.discord ||
    authState?.facebook ||
    authState?.github ||
    authState?.google ||
    authState?.linkedin ||
    authState?.twitter

  const enableConnect = authState?.emailMagicLink || authState?.smsMagicLink

  return (
    <div className={styles.menuPanel + (className ? ' ' + className : '')}>
      <section className={styles.profilePanel}>
        <section className={styles.profileBlock}>
          <div className={styles.avatarBlock}>
            <img src={getAvatarURLForUser(userId)} />
            {changeActiveMenu != null && (
              <Button
                className={styles.avatarBtn}
                id="select-avatar"
                onClick={() => changeActiveMenu(Views.AvatarSelect)}
                disableRipple
              >
                <Create />
              </Button>
            )}
          </div>
          <div className={styles.headerBlock}>
            <Typography variant="h1" className={styles.panelHeader}>
              {t('user:usermenu.profile.lbl-username')}
            </Typography>
            <span className={styles.inputBlock}>
              <TextField
                margin="none"
                size="small"
                name="username"
                variant="outlined"
                value={username || ''}
                onChange={handleUsernameChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') updateUserName(e)
                }}
                className={styles.usernameInput}
                error={errorUsername}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <a href="#" className={styles.materialIconBlock} onClick={updateUserName}>
                        <Check className={styles.primaryForeground} />
                      </a>
                    </InputAdornment>
                  )
                }}
              />
            </span>

            <Grid container justifyContent="right" className={styles.justify}>
              <Grid item xs={userRole === 'guest' ? 6 : 4}>
                <h2>
                  {userRole === 'admin' ? t('user:usermenu.profile.youAreAn') : t('user:usermenu.profile.youAreA')}
                  <span id="user-role">{` ${userRole}`}</span>.
                </h2>
              </Grid>
              <Grid item container xs={userRole === 'guest' ? 6 : 4} alignItems="flex-start" direction="column">
                <Tooltip
                  title={showUserId ? t('user:usermenu.profile.hideUserId') : t('user:usermenu.profile.showUserId')}
                  placement="right"
                >
                  <h2 className={styles.showUserId} id="show-user-id" onClick={() => setShowUserId(!showUserId)}>
                    {showUserId ? t('user:usermenu.profile.hideUserId') : t('user:usermenu.profile.showUserId')}
                  </h2>
                </Tooltip>
              </Grid>
              {selfUser?.apiKey?.id && (
                <Grid item container xs={4} alignItems="flex-start" direction="column">
                  <Tooltip
                    title={showApiKey ? t('user:usermenu.profile.hideApiKey') : t('user:usermenu.profile.showApiKey')}
                    placement="right"
                  >
                    <h2 className={styles.showUserId} onClick={() => setShowApiKey(!showApiKey)}>
                      {showApiKey ? t('user:usermenu.profile.hideApiKey') : t('user:usermenu.profile.showApiKey')}
                    </h2>
                  </Tooltip>
                </Grid>
              )}
            </Grid>
            {userRole !== 'guest' && (
              <Grid
                display="grid"
                gridTemplateColumns="1fr 1.5fr"
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1.5fr',

                  '@media(max-width: 600px)': {
                    gridTemplateColumns: '1fr'
                  },

                  button: {
                    margin: '0px',
                    width: '100%',
                    height: '100%',
                    color: 'white',
                    display: 'grid',
                    fontSize: '14px',
                    textAlign: 'left',
                    justifyContent: 'flex-start',
                    gridTemplateColumns: 'max-content auto',

                    svg: {
                      marginRight: '10px'
                    }
                  }
                }}
              />
            )}
            {selfUser && (
              <div className={styles.themeSettingContainer}>
                <FormControlLabel
                  control={<MaterialUISwitch sx={{ m: 1 }} checked={userSettings?.themeMode === 'dark'} />}
                  label={<div className={styles.themeHeading}>Theme Mode:</div>}
                  labelPlacement="start"
                  onChange={(e) => handleChangeUserThemeMode(e)}
                />
              </div>
            )}
            <h4>
              {userRole !== 'guest' && (
                <div className={styles.logout} onClick={handleLogout}>
                  {t('user:usermenu.profile.logout')}
                </div>
              )}
            </h4>
            {selfUser?.inviteCode.value != null && (
              <h2>
                {t('user:usermenu.profile.inviteCode')}: {selfUser.inviteCode.value}
              </h2>
            )}
          </div>
        </section>

        {showUserId && (
          <section className={styles.emailPhoneSection}>
            <Typography variant="h1" className={styles.panelHeader}>
              {t('user:usermenu.profile.userIcon.userId')}
            </Typography>

            <form>
              <TextField
                id="user-id"
                className={styles.emailField}
                size="small"
                placeholder={'user id'}
                variant="outlined"
                value={userId}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <CopyToClipboard
                        text={userId}
                        onCopy={() => {
                          NotificationService.dispatchNotify('User ID copied', {
                            variant: 'success'
                          })
                        }}
                      >
                        <a href="#" className={styles.materialIconBlock}>
                          <ContentCopyIcon className={styles.primaryForeground} />
                        </a>
                      </CopyToClipboard>
                    </InputAdornment>
                  )
                }}
              />
            </form>
          </section>
        )}

        {showApiKey && (
          <section className={styles.emailPhoneSection}>
            <Typography variant="h1" className={styles.panelHeader}>
              {t('user:usermenu.profile.apiKey')}
            </Typography>

            <form>
              <TextField
                className={styles.emailField}
                size="small"
                placeholder={'API key'}
                variant="outlined"
                value={apiKey}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <RefreshIcon className={styles.apiRefresh} onClick={refreshApiKey} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <CopyToClipboard
                        text={apiKey}
                        onCopy={() => {
                          NotificationService.dispatchNotify('API Key copied', {
                            variant: 'success'
                          })
                        }}
                      >
                        <a href="#" className={styles.materialIconBlock}>
                          <ContentCopyIcon className={styles.primaryForeground} />
                        </a>
                      </CopyToClipboard>
                    </InputAdornment>
                  )
                }}
              />
            </form>
          </section>
        )}

        {!hideLogin && (
          <>
            {userRole === 'guest' && enableConnect && (
              <section className={styles.emailPhoneSection}>
                <Typography variant="h1" className={styles.panelHeader}>
                  {getConnectText()}
                </Typography>

                <form onSubmit={handleGuestSubmit}>
                  <TextField
                    className={styles.emailField}
                    size="small"
                    placeholder={getConnectPlaceholder()}
                    variant="outlined"
                    onChange={handleInputChange}
                    onBlur={validate}
                    error={error}
                    helperText={error ? getErrorText() : null}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end" onClick={handleGuestSubmit}>
                          <a href="#" className={styles.materialIconBlock}>
                            <Send className={styles.primaryForeground} />
                          </a>
                        </InputAdornment>
                      )
                    }}
                  />
                  {loading && (
                    <div className={styles.container}>
                      <CircularProgress size={30} />
                    </div>
                  )}
                </form>
              </section>
            )}
            {userRole === 'guest' && changeActiveMenu && (
              <section className={styles.walletSection}>
                <Typography variant="h3" className={styles.textBlock}>
                  {t('user:usermenu.profile.or')}
                </Typography>

                {enableWalletLogin ? (
                  <div>
                    <Button onClick={() => handleWalletLoginClick()} className={styles.walletBtn}>
                      {t('user:usermenu.profile.loginWithXRWallet')}
                    </Button>

                    <Button onClick={() => handleIssueCredentialClick()} className={styles.walletBtn}>
                      Issue a VC
                    </Button>

                    <Button onClick={() => handleRequestCredentialClick()} className={styles.walletBtn}>
                      Request a VC
                    </Button>
                  </div>
                ) : (
                  <Button onClick={() => changeActiveMenu(Views.ReadyPlayer)} className={styles.walletBtn}>
                    {t('user:usermenu.profile.loginWithReadyPlayerMe')}
                  </Button>
                )}
              </section>
            )}

            {enableSocial && (
              <section className={styles.socialBlock}>
                {selfUser?.userRole.value === 'guest' && (
                  <Typography variant="h3" className={styles.textBlock}>
                    {t('user:usermenu.profile.connectSocial')}
                  </Typography>
                )}
                {selfUser?.userRole.value !== 'guest' && addMoreSocial && (
                  <Typography variant="h3" className={styles.textBlock}>
                    {t('user:usermenu.profile.addSocial')}
                  </Typography>
                )}
                <div className={styles.socialContainer}>
                  {authState?.discord && !oauthConnectedState.discord && (
                    <a href="#" id="discord" onClick={handleOAuthServiceClick}>
                      <DiscordIcon width="40" height="40" viewBox="0 0 40 40" />
                    </a>
                  )}
                  {authState?.google && !oauthConnectedState.google && (
                    <a href="#" id="google" onClick={handleOAuthServiceClick}>
                      <GoogleIcon width="40" height="40" viewBox="0 0 40 40" />
                    </a>
                  )}
                  {authState?.facebook && !oauthConnectedState.facebook && (
                    <a href="#" id="facebook" onClick={handleOAuthServiceClick}>
                      <FacebookIcon width="40" height="40" viewBox="0 0 40 40" />
                    </a>
                  )}
                  {authState?.linkedin && !oauthConnectedState.linkedin && (
                    <a href="#" id="linkedin" onClick={handleOAuthServiceClick}>
                      <LinkedInIcon width="40" height="40" viewBox="0 0 40 40" />
                    </a>
                  )}
                  {authState?.twitter && !oauthConnectedState.twitter && (
                    <a href="#" id="twitter" onClick={handleOAuthServiceClick}>
                      <TwitterIcon width="40" height="40" viewBox="0 0 40 40" />
                    </a>
                  )}
                  {authState?.github && !oauthConnectedState.github && (
                    <a href="#" id="github" onClick={handleOAuthServiceClick}>
                      <GitHub />
                    </a>
                  )}
                </div>
                {selfUser?.userRole.value !== 'guest' && removeSocial && (
                  <Typography variant="h3" className={styles.textBlock}>
                    {t('user:usermenu.profile.removeSocial')}
                  </Typography>
                )}
                <div className={styles.socialContainer}>
                  {authState?.discord && oauthConnectedState.discord && (
                    <a href="#" id="discord" onClick={handleRemoveOAuthServiceClick}>
                      <DiscordIcon width="40" height="40" viewBox="0 0 40 40" />
                    </a>
                  )}
                  {authState?.google && oauthConnectedState.google && (
                    <a href="#" id="google" onClick={handleRemoveOAuthServiceClick}>
                      <GoogleIcon width="40" height="40" viewBox="0 0 40 40" />
                    </a>
                  )}
                  {authState?.facebook && oauthConnectedState.facebook && (
                    <a href="#" id="facebook" onClick={handleRemoveOAuthServiceClick}>
                      <FacebookIcon width="40" height="40" viewBox="0 0 40 40" />
                    </a>
                  )}
                  {authState?.linkedin && oauthConnectedState.linkedin && (
                    <a href="#" id="linkedin" onClick={handleRemoveOAuthServiceClick}>
                      <LinkedInIcon width="40" height="40" viewBox="0 0 40 40" />
                    </a>
                  )}
                  {authState?.twitter && oauthConnectedState.twitter && (
                    <a href="#" id="twitter" onClick={handleRemoveOAuthServiceClick}>
                      <TwitterIcon width="40" height="40" viewBox="0 0 40 40" />
                    </a>
                  )}
                  {authState?.github && oauthConnectedState.github && (
                    <a href="#" id="github" onClick={handleRemoveOAuthServiceClick}>
                      <GitHub />
                    </a>
                  )}
                </div>
                {selfUser?.userRole.value === 'guest' && (
                  <Typography variant="h4" className={styles.smallTextBlock}>
                    {t('user:usermenu.profile.createOne')}
                  </Typography>
                )}
              </section>
            )}
            {setProfileMenuOpen && (
              <div className={styles.closeButton} onClick={() => setProfileMenuOpen(false)}>
                <Close />
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}

export default ProfileMenu
