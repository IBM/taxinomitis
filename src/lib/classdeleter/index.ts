// local dependencies
import * as slack from '../notifications/slack';
import * as db from '../db/store';
import * as auth0 from '../auth0/users';
import * as auth0requests from '../auth0/requests';
import { User } from '../auth0/auth-types';



async function deleteUsers(classid: string, users: User[], auth0token: string): Promise<void> {
    for (const user of users) {
        await auth0requests.deleteUser(auth0token, user.user_id);
        await db.deleteEntireUser(user.user_id, classid);
    }
}


export async function deleteClass(classid: string): Promise<void> {

    slack.notify('Deleting class "' + classid + '"');

    const auth0token = await auth0.getBearerToken();


    // The approach here is to delete the users first, and then
    // delete their stuff.
    // This is to prevent users creating more stuff while this
    // is running, so we need to invalidate their logins first.
    // The user/class references in the rest of the DB tables
    // aren't relational, so this won't prevent the rest of
    // the resources being deleted.

    // delete all students
    let users = await auth0requests.getUsers(auth0token, classid);
    while (users.length > 0) {
        await deleteUsers(classid, users, auth0token);

        users = await auth0requests.getUsers(auth0token, classid);
    }


    // The teacher account is deleted last, so that if anything
    // goes wrong, the teacher can try again.
    // If we delete the teacher account first, they won't be able
    // to submit another request, and could potentially be left
    // with some stuff left behind that would be difficult to
    // find/remove.

    // delete the teachers
    users = await auth0requests.getClassSupervisors(auth0token, classid);
    while (users.length > 0) {
        await deleteUsers(classid, users, auth0token);

        users = await auth0requests.getClassSupervisors(auth0token, classid);
    }


    // Finally, schedule a background task to delete uploaded images
    await db.storeDeleteClassImagesJob(classid);


    slack.notify('Successfully delete class "' + classid + '"');
}
