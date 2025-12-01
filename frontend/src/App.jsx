import React, { useState, useEffect, useMemo, useRef } from 'react';

// Firebase Imports
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  addDoc,
  writeBatch,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  Timestamp,
  setLogLevel,
} from 'firebase/firestore';

// --- Global Firebase & App Config ---
const firebaseConfig = {
  apiKey: "AIzaSyCOggkRb4hF3gUT3Gf6aJXes3zm6_Yspzg",
  authDomain: "dieter-512e1.firebaseapp.com",
  projectId: "dieter-512e1",
  storageBucket: "dieter-512e1.firebasestorage.app",
  messagingSenderId: "494620949863",
  appId: "1:494620949863:web:70d3aca17dc51708c583c2"
};

const appId = typeof __app_id !== 'undefined' ? __app_id : 'dieter-app';

// --- Firebase Initialization ---
let app, auth, db;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  setLogLevel('debug');
} catch (e) {
  console.error('Firebase initialization error:', e);
}

// --- STANDARD Recommended Daily Allowances (RDAs) ---
const STANDARD_RDA = {
  calories: 2000,
  protein: 50,
  fat: 78,
  carbohydrates: 275,
  sodium: 2300,
  sugar: 50,
};

// --- Helper Components ---

const LoadingSpinner = () => (
  <div className="flex justify-center items-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
  </div>
);

const Modal = ({ title, message, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 transition-opacity duration-300">
    <div className="bg-gray-800 p-6 rounded-xl shadow-2xl w-full max-w-md border border-gray-700">
      <h3 className="text-lg font-medium leading-6 text-white">{title}</h3>
      <div className="mt-2">
        <p className="text-sm text-gray-400">{message}</p>
      </div>
      <div className="mt-4">
        <button
          type="button"
          className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  </div>
);

// --- SEPARATE LOGIN SCREEN ---
const LoginScreen = ({ onLogin, onSignup, error }) => {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isSignup) {
      onSignup(email, password);
    } else {
      onLogin(email, password);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 p-4 font-inter">
      <div className="max-w-md w-full bg-gray-800 rounded-xl shadow-2xl p-8 border border-gray-700">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Dieter</h1>
          <p className="text-gray-400">Your AI-powered nutrition companion.</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded text-red-200 text-sm">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="you@example.com"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 mt-6"
          >
            {isSignup ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-400">
            {isSignup ? "Already have an account? " : "Don't have an account? "}
            <button
              onClick={() => { setIsSignup(!isSignup); setEmail(''); setPassword(''); }}
              className="text-blue-400 hover:text-blue-300 font-medium hover:underline focus:outline-none"
            >
              {isSignup ? 'Sign In' : 'Sign Up'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

// --- DASHBOARD COMPONENTS ---

const ImageUploader = ({ onImageUpload, isLoading }) => {
  const [dragOver, setDragOver] = useState(false);
  const handleFileChange = (e) => { const file = e.target.files ? e.target.files[0] : null; if (file) onImageUpload(file); };
  const handleDrop = (e) => { e.preventDefault(); setDragOver(false); const file = e.dataTransfer.files ? e.dataTransfer.files[0] : null; if (file) onImageUpload(file); };

  return (
    <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">
      <h2 className="text-xl font-semibold text-white mb-4">Add Food Item</h2>
      <label
        htmlFor="file-upload"
        className={`flex justify-center w-full h-48 px-6 pt-5 pb-6 border-2 border-gray-600 border-dashed rounded-lg cursor-pointer transition-colors duration-200 ${dragOver ? 'border-blue-500 bg-gray-700' : 'hover:border-gray-500'}`}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
      >
        <div className="space-y-1 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-500" stroke="currentColor" fill="none" viewBox="0 0 48 48">
            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="flex text-sm text-gray-400">
            <span className="relative font-medium text-blue-400 hover:text-blue-300">Upload a photo</span>
            <input id="file-upload" type="file" className="sr-only" accept="image/*" onChange={handleFileChange} disabled={isLoading} />
            <p className="pl-1">or drag and drop</p>
          </div>
        </div>
      </label>
      {isLoading && <div className="mt-4"><LoadingSpinner /><p className="text-center text-sm text-gray-400 mt-2">Analyzing...</p></div>}
    </div>
  );
};

const DailySummary = ({ totals }) => {
  const summaryItems = [
    { name: 'Calories', value: totals.calories, rda: STANDARD_RDA.calories, unit: 'kcal' },
    { name: 'Protein', value: totals.protein, rda: STANDARD_RDA.protein, unit: 'g' },
    { name: 'Carbs', value: totals.carbohydrates, rda: STANDARD_RDA.carbohydrates, unit: 'g' },
    { name: 'Fat', value: totals.fat, rda: STANDARD_RDA.fat, unit: 'g' },
    { name: 'Sugar', value: totals.sugar, rda: STANDARD_RDA.sugar, unit: 'g' },
    { name: 'Sodium', value: totals.sodium, rda: STANDARD_RDA.sodium, unit: 'mg' },
  ];

  return (
    <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">
      <h2 className="text-xl font-semibold text-white mb-4">Today's Summary</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {summaryItems.map((item) => {
          const percentage = item.rda > 0 ? (item.value / item.rda) * 100 : 0;
          const barWidth = Math.min(percentage, 100);
          return (
            <div key={item.name} className="text-center p-2 bg-gray-700/30 rounded-lg">
              <div className="relative h-20 w-20 mx-auto">
                <svg className="h-full w-full" viewBox="0 0 36 36">
                  <path className="text-gray-700" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3.8" />
                  <path className="text-blue-500" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3.8" strokeDasharray={`${barWidth}, 100`} />
                </svg>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-sm font-bold text-white">{Math.round(percentage)}%</div>
              </div>
              <p className="font-semibold text-gray-300 mt-2 text-sm">{item.name}</p>
              <p className="text-xs text-gray-400">{item.value.toFixed(0)} / {item.rda}{item.unit}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Recommendation = ({ recommendation, isLoading }) => (
  <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">
    <h2 className="text-xl font-semibold text-white mb-4">AI Diet Coach</h2>
    <div className="min-h-[60px] flex items-center">
      {isLoading ? (
        <div className="w-full"><LoadingSpinner /><p className="text-sm text-gray-400 text-center mt-2">Generating tip...</p></div>
      ) : recommendation ? (
        <p className="text-blue-300 italic">"{recommendation}"</p>
      ) : (
        <p className="text-gray-400">Add a food item to get your first tip.</p>
      )}
    </div>
  </div>
);

const FoodList = ({ foodEntries }) => (
  <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">
    <h2 className="text-xl font-semibold text-white mb-4">Today's Log</h2>
    <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
      {foodEntries.length === 0 ? <p className="text-gray-400 text-center py-4">No food logged for today.</p> : foodEntries.map((entry) => (
        <div key={entry.id} className="flex flex-col p-4 bg-gray-700 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <p className="font-semibold text-white">{entry.foodName}</p>
            {entry.timestamp && <span className="text-xs text-gray-500">{entry.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
          </div>
          <div className="text-xs text-gray-400 grid grid-cols-3 gap-2">
            <span>{entry.calories?.toFixed(0)} kcal</span>
            <span>P: {entry.nutrients?.protein?.toFixed(0)}g</span>
            <span>C: {entry.nutrients?.carbohydrates?.toFixed(0)}g</span>
            <span>F: {entry.nutrients?.fat?.toFixed(0)}g</span>
            <span>Sug: {entry.nutrients?.sugar?.toFixed(0)}g</span>
            <span>Sod: {entry.nutrients?.sodium?.toFixed(0)}mg</span>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// --- MAIN APP ---
export default function App() {
  const [user, setUser] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [foodEntries, setFoodEntries] = useState([]);
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [error, setError] = useState(null);
  const [authError, setAuthError] = useState(null); 
  
  const [recommendation, setRecommendation] = useState('');
  const [isLoadingRec, setIsLoadingRec] = useState(false);
  const recommendationTimerRef = useRef(null);

  // --- Auth Logic ---
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async (email, password) => {
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setAuthError("Invalid email or password.");
      console.error(err);
    }
  };

  const handleSignup = async (email, password) => {
    setAuthError(null);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setAuthError(err.message.replace('Firebase: ', '')); // Clean up error message
      console.error(err);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setFoodEntries([]); 
      setRecommendation('');
    } catch (err) {
      setError("Logout failed: " + err.message);
    }
  };

  // Data Fetching
  useEffect(() => {
    if (!isAuthReady || !user || !db) return; 
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    const q = query(collection(db, `artifacts/${appId}/users/${user.uid}/foodEntries`), where('timestamp', '>=', Timestamp.fromDate(startOfToday)));
    return onSnapshot(q, (snapshot) => {
      const entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      entries.sort((a, b) => (b.timestamp?.toDate() || 0) - (a.timestamp?.toDate() || 0));
      setFoodEntries(entries);
    });
  }, [isAuthReady, user]); 

  // Totals
  const dailyTotals = useMemo(() => {
    const totals = { calories: 0, protein: 0, fat: 0, carbohydrates: 0, sugar: 0, sodium: 0 };
    foodEntries.forEach((entry) => {
      totals.calories += (entry.calories || 0);
      totals.protein += (entry.nutrients?.protein || 0);
      totals.fat += (entry.nutrients?.fat || 0);
      totals.carbohydrates += (entry.nutrients?.carbohydrates || 0);
      totals.sugar += (entry.nutrients?.sugar || 0);
      totals.sodium += (entry.nutrients?.sodium || 0);
    });
    return totals;
  }, [foodEntries]);

  // Image Upload
  const handleImageUpload = async (file) => {
    if (!file) return;
    setIsLoadingImage(true); setError(null);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64ImageData = reader.result.split(',')[1];
        // LOCAL DEVELOPMENT MODE: Pointing to localhost
        const response = await fetch('http://localhost:3001/analyze-image', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64ImageData, mimeType: file.type }),
        });
        if (!response.ok) throw new Error('Backend failed');
        const foodData = await response.json();
        if (db && user) {
          await addDoc(collection(db, `artifacts/${appId}/users/${user.uid}/foodEntries`), { ...foodData, timestamp: Timestamp.now() });
        }
      };
    } catch (err) { setError(err.message); } finally { setIsLoadingImage(false); }
  };

  // Reset
  const handleReset = async () => {
    if (!db || !user) return;
    if (!confirm("Reset all data?")) return;
    try {
      const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
      const q = query(collection(db, `artifacts/${appId}/users/${user.uid}/foodEntries`), where('timestamp', '>=', Timestamp.fromDate(startOfToday)));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.docs.forEach((doc) => { batch.delete(doc.ref); });
      await batch.commit();
      setRecommendation('');
    } catch (err) { setError("Reset failed: " + err.message); }
  };

  // Recommendation
  const handleGetRecommendation = async () => {
    if (isLoadingRec) return;
    setIsLoadingRec(true);
    try {
      const foodListString = foodEntries.map(f => `${f.foodName} (${f.calories}kcal)`).join(', ');
      
      // LOCAL DEVELOPMENT MODE: Pointing to localhost
      const response = await fetch('http://localhost:3001/get-recommendation', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          foodList: foodListString, 
          totals: dailyTotals, 
          rda: STANDARD_RDA 
        }),
      });
      
      const data = await response.json();
      setRecommendation(data.recommendation);

    } catch (err) { console.error(err); } finally { setIsLoadingRec(false); }
  };

  // Auto-trigger
  useEffect(() => {
    if (!isAuthReady || !user) return;
    if (recommendationTimerRef.current) clearTimeout(recommendationTimerRef.current);
    
    if (foodEntries.length > 0) {
        setIsLoadingRec(true);
        recommendationTimerRef.current = setTimeout(() => handleGetRecommendation(), 3000);
    }
    return () => clearTimeout(recommendationTimerRef.current);
  }, [dailyTotals, isAuthReady, user]);

  if (!isAuthReady) return <div className="flex justify-center items-center h-screen bg-gray-900"><LoadingSpinner /></div>;

  // --- NEW: Conditional Rendering for Login ---
  if (!user) {
    return <LoginScreen onLogin={handleLogin} onSignup={handleSignup} error={authError} />;
  }

  // --- Dashboard (Only shown if user is logged in) ---
  return (
    <div className="min-h-screen bg-gray-900 p-4 sm:p-8 font-inter text-gray-200">
      {error && <Modal title="Error" message={error} onClose={() => setError(null)} />}
      <main className="max-w-2xl mx-auto space-y-6">
        <header className="text-center py-4 flex justify-between items-center">
          <div className="text-left">
            <h1 className="text-4xl font-bold text-white">Dieter</h1>
            <p className="text-xs text-gray-500 mt-1">Hello, {user.email}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleReset} className="text-xs text-red-400 hover:text-red-300 border border-red-500 px-2 py-1 rounded">Reset</button>
            <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-gray-300 border border-gray-500 px-2 py-1 rounded">Logout</button>
          </div>
        </header>

        <ImageUploader onImageUpload={handleImageUpload} isLoading={isLoadingImage} />
        
        <DailySummary totals={dailyTotals} />
        
        <Recommendation recommendation={recommendation} isLoading={isLoadingRec} />
        <FoodList foodEntries={foodEntries} />
      </main>
    </div>
  );
}