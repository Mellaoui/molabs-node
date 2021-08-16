import { components } from "./gen";
import SCOPES from '../scopes.json'

export type IUser = components['schemas']['User']
export type ITeam = components['schemas']['Team']
export type ITeamMember = components['schemas']['TeamMember']
export type IOTP = components['schemas']['OTP']
export type IInviteLink = components['schemas']['InviteLink']
export type IRefreshToken = components['schemas']['RefreshToken']

export type IJWT = components['schemas']['JWT']
export type INotificationResult = components['schemas']['NotificationResult']

export type Scope = keyof typeof SCOPES

export const ALL_SCOPES = Object.keys(SCOPES) as Scope[]
/** Scopes all regular users have. Basically excluding admin scopes */
export const ALL_USER_SCOPES = ALL_SCOPES.filter(s => s !== 'ADMIN_PANEL_ACCESS')