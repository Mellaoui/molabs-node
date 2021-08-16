import otpPost from './otpPost'
import usersPasswordPatch from './usersPasswordPatch'
import usersPost from './usersPost'
import inviteLinksPost from './inviteLinksPost'
import inviteLinksGet from './inviteLinksGet'
import tokenPost from './tokenPost'
import tokenGet from './tokenGet'
import tokenDelete from './tokenDelete'
import usersPatch from './usersPatch'
import teamsJoinInvite from './teamsJoinInvite'
import teamsPatch from './teamsPatch'
import teamsGet from './teamsGet'
import usersGet from './usersGet'
import usersDelete from './usersDelete'
import notify from './notify'

// export all routes as an object
// the API then imports these and type checks them
export default {
	otpPost,
	usersPasswordPatch,
	usersPost,
	inviteLinksPost,
	inviteLinksGet,
	tokenPost,
	tokenGet,
	tokenDelete,
	usersPatch,
	teamsJoinInvite,
	teamsPatch,
	teamsGet,
	usersGet,
	usersDelete,
	notify
}