const uuid = require('uuid');

exports.handler = async function(context, event, callback) {
    console.log("admin trying to join");

    let response = new Twilio.Response();
    response.appendHeader('Content-Type', 'application/json');
    response.setHeaders({"Access-Control-Allow-Origin": "*"}); // For testing from localhost

    /*if(!SSO.checkAccess(event, context)) {
        response.setStatusCode(403);
        response.setBody("Unauthorized");

        callback(null, response);
        return;
    }*/

    const identity = uuid.v4(); ///TODO: PROBABLY A WAY TO GET ONE FROM OKTA?

    // Get meeting id from parameters:
    const meeting_id = event.meeting_id;
    if(!meeting_id) {
        response.setStatusCode(400);
        response.setBody("Error: Missing meeting_id");

        callback(null, response);
        return;
    }

    // Check if meeting_id exists:
    console.log("checking if meeting " + meeting_id + " exists");
    const document = await Sync.getRoomDocument(meeting_id, context);
    if(!document || !document.data) {
        response.setStatusCode(404);
        response.setBody("Error: couldn't find your meeting room. Please go to admin and create it first.");

        callback(null, response);
        return;
    }

    // Check if room is opened already:
    console.log("checking if video room is already opened");
    let room_id = document.data.room;
    if(!room_id) {
        console.log("No room yet, creating one");
        let room = await Video.createVideoRoom(uuid.v4(), context.VIDEO_ENABLE_RECORDING, context);
        if(!room || !room.sid) {
            response.setStatusCode(500);
            response.setBody("Error: couldn't create the room");

            callback(null, response);
            return;
        }
        room_id = room.sid;

        console.log('publishing room_id created: ', room_id);
        let result = await Sync.updateSyncDocument(document.sid, {room_id: room_id}, context);
        if(!result) {
            response.setStatusCode(500);
            response.setBody("Error: couldn't publish the new room");

            callback(null, response);
            return;
        }
    }
    console.log('room_id: ', room_id);

    let video_params = null;
    if(room_id) {
        console.log("Creating an authorization token for the video room");
        video_params = Video.grantVideoAccess(room_id, identity, context);
    }

    response.appendHeader('Content-Type', 'application/json');
    response.setStatusCode(200);
    response.setBody({video_params: video_params});
    callback(null, response);
};

const SSO = {
    checkToken: function (event, context) {
        console.log("HERE WILL BE OKTA AUTH...");
        return true;
        /// TODO: CHECK OKTA AUTH TO CHECK IF ADMIN IS AUTHORIZED

        const accessToken = event.accessToken;
        const oktaJwtVerifier = new OktaJwtVerifier({
            issuer: context.OKTA_ISSUER
        });

        return oktaJwtVerifier.verifyAccessToken(accessToken)
            .then((jwt) => {
                req.jwt = jwt;
                next();
            })
            .catch((err) => {
                res.status(401).send(err.message);
            });
    }
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

    updateSyncDocument: function (document_sid, new_data, context) {
        return new Promise((resolve, reject) => {
            const client = context.getTwilioClient();
            client.sync.services(context.SYNC_SERVICE_ID)
                .documents(document_sid)
                .update({data: new_data})
                .then(() => {
                    resolve(true)
                })
                .catch(() => {
                    resolve(false)
                });
        });
    },
};

const Video = {
    createVideoRoom:function (room_id, enable_recording, context) {
        return new Promise((resolve, reject) => {
            const client = context.getTwilioClient();
            client.video.rooms
                .create({
                    recordParticipantsOnConnect: enable_recording,
                    statusCallback: context.VIDEO_WEBHOOK,
                    type: context.VIDEO_ROOM_TYPE,
                    uniqueName: room_id
                })
                .then(resolve)
                .catch(() => {resolve(null)});
        });
    },

    grantVideoAccess: function (room_id, identity, context) {
        const AccessToken = require('twilio').jwt.AccessToken;
        const VideoGrant = AccessToken.VideoGrant;
        const videoGrant = new VideoGrant({
            room: room_id
        });

        let token = new AccessToken(
            context.ACCOUNT_SID,
            context.TWILIO_API_KEY,
            context.TWILIO_API_SECRET
        );

        token.addGrant(videoGrant, context);
        token.identity = identity;
        return {
            room_id: room_id,
            identity: identity,
            token: token.toJwt()
        };
    }
};