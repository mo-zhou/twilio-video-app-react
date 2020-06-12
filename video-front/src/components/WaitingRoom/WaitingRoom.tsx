import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import { SyncClient } from 'twilio-sync';

export default function WaitingRoom() {
  const { URLMeetingId } = useParams();
  const [meetingId, setMeetingId] = useState<string>('');
  const [roomId, setRoomId] = useState<string>('');
  const [syncInfo, setSyncInfo] = useState({ document: '', identity: '', token: '' });

  function extractDocumentData({ documentData }: { documentData: any }) {
    if (documentData.room_id && documentData.room_id !== '') {
      setRoomId(documentData.room_id);
    } else {
      setRoomId('');
    }
  }

  // get meeting if from URL
  useEffect(() => {
    if (URLMeetingId) {
      setMeetingId(URLMeetingId);
    }
  }, [URLMeetingId]);

  // get connection details for Sync
  useEffect(() => {
    if (meetingId !== '') {
      console.log('Got meeting id :', meetingId);
      axios
        .post('https://backend-functions-3559-dev.twil.io/user/enter-waiting-room', {
          meeting_id: meetingId,
        })
        .then(res => {
          setSyncInfo({ document: res.data.document, identity: res.data.identity, token: res.data.token });
        })
        .catch(reason => {
          setSyncInfo({ document: '', identity: '', token: '' });
        });
    } else {
      setSyncInfo({ document: '', identity: '', token: '' });
    }
  }, [meetingId]);

  // get the sync document (to extract the room id) and subscribe to it
  useEffect(() => {
    if (syncInfo.document !== '' && syncInfo.token !== '' && syncInfo.identity !== '') {
      let syncClient = new SyncClient(syncInfo.token);
      syncClient
        .document(syncInfo.document)
        .then(syncDocument => {
          extractDocumentData({ documentData: syncDocument.value });
          syncDocument.on('updated', function(event) {
            console.log('Received Document update event. New value:', event.value);
            extractDocumentData({ documentData: event.value });
          });
        })
        .catch(function(error) {
          console.error('Unexpected error', error);
        });
    } else {
      // Throw error 404, beer not found
    }
  }, [syncInfo]);

  // Get connexion information to connect to the video room
  useEffect(() => {
    if (meetingId !== '' && roomId !== '') {
      console.log('Got meeting ', meetingId, 'and room', roomId);
      axios
        .post('https://backend-functions-3559-dev.twil.io/user/join', {
          meeting_id: meetingId,
          room_id: roomId,
          identity: syncInfo.identity,
        })
        .then(res => {
          // TODO: HERE WE HAVE: res.data.room_id, res.data.identity, res.data.token
          // TODO: CONNECT to video!
        })
        .catch(reason => {});
    } else {
    }
  }, [meetingId, roomId, syncInfo]);

  return (
    <div>
      <p>Waiting room {meetingId}.</p>
      {roomId !== '' ? (
        <p>Your meeting room {roomId} is ready!</p>
      ) : (
        <p>Please wait for your host to start the meeting...</p>
      )}
    </div>
  );
}
