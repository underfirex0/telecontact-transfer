import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, query, orderBy, limit, getDocs, doc, getDoc, onSnapshot, where, updateDoc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export { collection, query, orderBy, limit, getDocs, doc, getDoc, onSnapshot, where, updateDoc };
