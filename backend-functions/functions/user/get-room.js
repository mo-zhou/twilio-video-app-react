const uuid = require('uuid');

exports.handler = async function(context, event, callback) {
    console.log("customer trying to join");

    const identity = uuid.v4();
    console.log("user identity: ", identity);

    const meeting_id = event.meeting_id;
    if(!meeting_id) {
        callback("Error: Missing meeting_id", null);
        return;
    }

    // Check if meeting_id exists:
    console.log("checking if meeting " + meeting_id + " exists");
    const document = await Sync.getRoomDocument(meeting_id, context);
    if(!document || !document.data) {
        callback("Error: couldn't find your meeting room. Please go to admin and create it first.", null);
        return;
    }

    console.log("Creating an authorization token for this user");
    const authorization = await Sync.authorizeClient(meeting_id, identity, context);
    if(!authorization) {
        callback("Error: couldn't authorize your to connect to this room.", null);
        return;
    }
    const sync_params = Sync.createToken(meeting_id, identity, context);

    callback(null, sync_params);
};

const Sync = {
    getRoomDocument: function (meeting_id, context) {
        return new Promise((resolve, reject) => {
            const client = context.getTwilioClient();
            client.sync.services(context.SYNC_SERVICE_ID)
                .documents(meeting_id)
                .fetch()
                .then(resolve)
                .catch(() => {
                    resolve(null)
                });
        });
    },

    createToken: function(meeting_id, identity, context) {
        let AccessToken = require('twilio').jwt.AccessToken;
        let SyncGrant = AccessToken.SyncGrant;

        // Create a "grant" identifying the Sync service instance for this app.
        let syncGrant = new SyncGrant({
            serviceSid: context.SYNC_SERVICE_ID,
        });
        // Create an access token which we will sign and return to the client,
        // containing the grant we just created and specifying his identity.
        let token = new AccessToken(
            context.ACCOUNT_SID,
            context.TWILIO_API_KEY,
            context.TWILIO_API_SECRET
        );
        token.addGrant(syncGrant);
        token.identity = identity;

        return {
            document: meeting_id,
            identity: identity,
            token: token.toJwt()
        }
    },


    authorizeClient: function (document_sid, identity, context) {
        return new Promise((resolve, reject) => {
            const client = context.getTwilioClient();
            client.sync.services(context.SYNC_SERVICE_ID)
                .documents(document_sid)
                .documentPermissions(identity)
                .update({read: true, write: false, manage: false})
                .then(document_permission => resolve(document_permission))
                .catch(() => {resolve(null)});
        });
    }
};