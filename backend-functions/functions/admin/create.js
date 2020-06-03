exports.handler = async function(context, event, callback) {
    console.log("admin trying to create a meeting");

    //if(!SSO.checkAccess(event, context)) callback("unauthorized", null);

    let n_digits = event.n_digits;
    if(!n_digits) n_digits = parseInt(context.MEETING_ID_DIGITS);

    let exists = true;
    let meeting_id = generate_meeting_id(n_digits);

    while (exists) {
        // Check if meeting_id exists:
        console.log("checking if meeting " + meeting_id + " exists");
        const document = await Sync.getRoomDocument(meeting_id, context);
        if(document) {
            meeting_id = generate_meeting_id(n_digits);
        } else {
            break;
        }
    }

    console.log("Meeting ID: ", meeting_id);
    let document = Sync.createDocument(meeting_id, context);
    if(!document) {
        callback("Error: couldn't create the new meeting", null);
    }

    callback(null, {
        meeting_id: meeting_id
    });
};


function generate_meeting_id(n_digits) {
    const min = 0;
    const max = Math.pow(10, n_digits);
    console.log(max);
    //The maximum is exclusive and the minimum is inclusive
    const id = Math.floor(Math.random() * (max - min)) + min;

    const str1 = id.toString();
    return str1.padStart(n_digits, str1);
}


const OktaJwtVerifier = require('@okta/jwt-verifier');

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
    createDocument: function(meeting_id, context) {
        return new Promise((resolve, reject) => {
            const client = context.getTwilioClient();
            client.sync.services(context.SYNC_SERVICE_ID)
                .documents
                .create({uniqueName: meeting_id})
                .then(resolve)
                .catch(() => {
                    resolve(null)
                });
        });
    },

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
};