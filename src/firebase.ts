import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: 'AIzaSyBopAMppp45m-GU6vSzIlCTmpMpSeez9ks',
  authDomain: 'hockey-manager-2652a.firebaseapp.com',
  databaseURL: 'https://hockey-manager-2652a-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'hockey-manager-2652a',
  storageBucket: 'hockey-manager-2652a.firebasestorage.app',
  messagingSenderId: '998534842600',
  appId: '1:998534842600:web:e0c2c47f417adddad1215d',
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
