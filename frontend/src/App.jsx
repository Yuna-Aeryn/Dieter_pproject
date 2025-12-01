import React, { useState, useEffect, useMemo, useRef } from 'react';

// 분리된 컴포넌트 import
import Login from './Login'; 
import MyPage from './MyPage'; 

// Firebase Imports (생략)
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
}
 from 'firebase/firestore';


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

// --- Helper Components (Design Updated) ---

const LoadingSpinner = () => (
  <div className="flex justify-center items-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-400"></div>
  </div>
);

const Modal = ({ title, message, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 transition-opacity duration-300">
    {/* 밝은 배경, 어두운 텍스트 */}
    <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md border border-gray-200">
      <h3 className="text-lg font-medium leading-6 text-gray-900">{title}</h3>
      <div className="mt-2">
        <p className="text-sm text-gray-600">{message}</p>
      </div>
      <div className="mt-4">
        <button
          type="button"
          // 민트색 버튼
          className="inline-flex justify-center rounded-md border border-transparent bg-teal-600 px-4 py-2 text-sm font-medium text-teal-600 shadow-sm hover:bg-teal-700"
          onClick={onClose}
        >
          닫기
        </button>
      </div>
    </div>
  </div>
);


const DailySummaryContent = ({ totals }) => {
  const nutItems = [
    { name: '순탄수', key: 'carbohydrates', rda: 100, unit: 'g' }, 
    { name: '단백질', key: 'protein', rda: 120, unit: 'g' }, 
    { name: '지방', key: 'fat', rda: 50, unit: 'g' }, 
    { name: '당류', key: 'sugar', rda: 50, unit: 'g' },
    { name: '나트륨', key: 'sodium', rda: 2000, unit: 'mg' }, 
  ].map(item => ({
    ...item,
    value: totals[item.key] || 0,
    rda: item.rda 
  }));

  return (
    // 배경색을 연한 민트색(teal-100)으로 변경, 텍스트는 어두운 색
    <div className="bg-teal-100 p-4 rounded-xl shadow-lg text-gray-800 border border-teal-200">
      <div className="flex items-center mb-4">
        {/* 중앙 원 색상 조정 */}
        <div className="bg-white text-teal-600 rounded-full w-20 h-20 flex flex-col items-center justify-center p-2 mr-4 font-bold shadow-md">
          <span className="text-3xl">{Math.round(totals.calories)}</span>
          <span className="text-xs font-medium">kcal</span>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2 text-center text-sm">
        {nutItems.map((item) => {
          const percentage = item.rda > 0 ? (item.value / item.rda) * 100 : 0;
          const barWidth = Math.min(percentage, 100);
          
          return (
            <div key={item.name} className="flex flex-col">
              <span className="font-semibold text-sm mb-1">{item.name}</span> 
              <div className="text-xs text-gray-600 mb-1">{item.value.toFixed(0)}/{item.rda}{item.unit}</div> 
              <div className="h-1 bg-teal-200 rounded-full">
                <div 
                  className="h-1 rounded-full" 
                  style={{ width: `${barWidth}%`, backgroundColor: barWidth >= 100 ? '#f00' : '#48E28C' }} 
                ></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};


const FoodList = ({ foodEntries }) => (
  <div className="p-0 mt-4">
    <h2 className="text-xl font-semibold text-gray-800 mb-4">오늘의 식사</h2>
    {/* 배경 흰색, 밝은 경계선 */}
    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 min-h-[150px]">
      <div className="space-y-4 max-h-60 overflow-y-auto pr-2">
        {foodEntries.length === 0 ? (
          <p className="text-gray-500 text-center py-4">
            아직 기록된 식사가 없어요. 텍스트로 입력하거나 사진을 업로드해 보세요.
          </p>
        ) : foodEntries.map((entry) => (
          // 각 아이템 배경을 매우 연한 민트색으로 변경
          <div key={entry.id} className="flex flex-col p-4 bg-teal-50 rounded-lg border border-teal-100"> 
            <div className="flex justify-between items-center mb-2">
              <p className="font-semibold text-gray-800">{entry.foodName}</p>
              <span className="text-xs text-gray-500">{entry.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div className="text-xs text-gray-600 grid grid-cols-3 gap-2">
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
  </div>
);

const FoodInputForm = ({ textInput, setTextInput, handleTextInput, handleImageUpload, isLoadingImage }) => {
  return (
    // 배경 흰색, 밝은 경계선
    <div className="mt-6 p-4 bg-white rounded-xl shadow-inner border border-gray-200">
      <form onSubmit={handleTextInput} className="flex items-center space-x-2">
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="오늘 먹은 음식을 텍스트로 입력하세요..."
            // 입력 필드 스타일 조정
            className="flex-grow p-2 text-gray-800 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            disabled={isLoadingImage}
          />
          
          <input 
            id="image-file-upload" 
            type="file" 
            className="sr-only" 
            accept="image/*" 
            onChange={(e) => handleImageUpload(e.target.files[0])} 
            disabled={isLoadingImage} 
          />
          
          <label htmlFor="image-file-upload" className="cursor-pointer p-2 rounded-lg hover:bg-gray-100 transition-colors">
            {isLoadingImage ? (
              <LoadingSpinner />
            ) : (
              // 아이콘 색상 민트색으로 변경
              <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 16m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            )}
          </label>
          
          {/* 전송 버튼 색상 조정 */}
          <button type="submit" className="text-teal-600 bg-teal-600 p-2 rounded-lg hover:bg-teal-700 transition-colors" disabled={isLoadingImage || !textInput.trim()}>
              <svg className="w-6 h-6 transform rotate-90" fill="currentColor" viewBox="0 0 24 24">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
          </button>
      </form>
    </div>
  );
};


// --- MAIN APP ---
export default function App() {
  const [user, setUser] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [foodEntries, setFoodEntries] = useState([]);
  const [userProfile, setUserProfile] = useState({ gender: 'male', height: 170, weight: 65 }); 
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [error, setError] = useState(null);
  const [authError, setAuthError] = useState(null); 
  const [textInput, setTextInput] = useState(''); 
  const [currentPage, setCurrentPage] = useState('home'); 
  
  const [recommendation, setRecommendation] = useState('');
  const [isLoadingRec, setIsLoadingRec] = useState(false);
  const recommendationTimerRef = useRef(null);

  // --- Auth Logic (Unchanged) ---
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
      setAuthError("유효하지 않은 이메일 또는 비밀번호입니다.");
      console.error(err);
    }
  };

  const handleSignup = async (email, password) => {
    setAuthError(null);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setAuthError(err.message.replace('Firebase: ', ''));
      console.error(err);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setFoodEntries([]); 
      setRecommendation('');
      setCurrentPage('home'); 
    } catch (err) {
      setError("로그아웃 실패: " + err.message);
    }
  };

  const handleUpdateProfile = (newProfileData) => {
    setUserProfile(prev => ({ ...prev, ...newProfileData }));
    console.log("프로필 업데이트:", newProfileData);
  };


  // Data Fetching (Unchanged)
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

  // Totals (Unchanged)
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

  // Image Upload (Unchanged)
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
    } catch (err) { setError("이미지 분석 및 기록에 실패했습니다: " + err.message); } finally { setIsLoadingImage(false); }
  };
  
  // Text Input Handler (Simulated)
  const handleTextInput = async (e) => {
      e.preventDefault();
      if (!textInput.trim()) return;
      
      // Simulating a text-based nutrition API call (e.g., to a separate backend endpoint)
      console.log(`Sending text for analysis: ${textInput}`);
      setTextInput('');
  };

  // Reset (Unchanged)
  const handleReset = async () => {
    if (!db || !user) return;
    if (!confirm("오늘의 데이터를 모두 초기화하시겠습니까?")) return;
    try {
      const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
      const q = query(collection(db, `artifacts/${appId}/users/${user.uid}/foodEntries`), where('timestamp', '>=', Timestamp.fromDate(startOfToday)));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.docs.forEach((doc) => { batch.delete(doc.ref); });
      await batch.commit();
      setRecommendation('');
    } catch (err) { setError("초기화 실패: " + err.message); }
  };

  // Recommendation (Unchanged)
  const handleGetRecommendation = async () => {
    if (isLoadingRec) return;
    setIsLoadingRec(true);
    setRecommendation(''); // Clear previous recommendation
    try {
      const foodListString = foodEntries.map(f => `${f.foodName} (${f.calories}kcal)`).join(', ');
      
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

    } catch (err) { setError("추천 메뉴를 가져오는 데 실패했습니다."); console.error(err); } finally { setIsLoadingRec(false); }
  };

  // Auto-trigger (Remains but the UI doesn't show it)
  useEffect(() => {
    if (!isAuthReady || !user) return;
    if (recommendationTimerRef.current) clearTimeout(recommendationTimerRef.current);
    
    if (foodEntries.length > 0) {
        setIsLoadingRec(true);
        // recommendationTimerRef.current = setTimeout(() => handleGetRecommendation(), 3000);
    }
    return () => clearTimeout(recommendationTimerRef.current);
  }, [dailyTotals, isAuthReady, user]);

  // Loading spinner color adjusted for bright theme
  if (!isAuthReady) return <div className="flex justify-center items-center h-screen bg-white"><LoadingSpinner /></div>;

  // --- Login Screen ---
  if (!user) {
    return <Login onLogin={handleLogin} onSignup={handleSignup} error={authError} />;
  }
  
  // 네비게이션 메뉴 정의
  const navItems = [
    { name: '홈', page: 'home' },
    { name: '기록', page: 'record' }, 
    { name: '메뉴 추천', page: 'recommend' }, 
    { name: '마이페이지', page: 'mypage' },
  ];
  
  // 현재 페이지 렌더링 함수
  const renderPage = () => {
      
      // 메뉴 추천 화면
      const RecommendationContent = () => (
          // 배경 흰색, 민트색 헤더
          <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-200">
              <h3 className="text-xl font-bold text-teal-600 mb-4">오늘의 식단 추천</h3>
              <div className="min-h-[150px] flex flex-col justify-between">
                  {isLoadingRec ? (
                      <LoadingSpinner />
                  ) : recommendation ? (
                      <p className="text-gray-800 whitespace-pre-wrap">{recommendation}</p>
                  ) : (
                      <p className="text-gray-500 text-center py-8">
                          현재까지의 식단 정보를 바탕으로 맞춤형 추천 메뉴를 받아보세요.
                      </p>
                  )}
                  <button
                      onClick={handleGetRecommendation}
                      disabled={isLoadingRec}
                      // 민트색 버튼
                      className="w-full bg-teal-600 hover:bg-teal-700 text-teal-500 font-bold py-3 rounded-lg transition-colors shadow-md mt-6 disabled:opacity-50"
                  >
                      {isLoadingRec ? '분석 중...' : '맞춤 메뉴 추천받기'}
                  </button>
              </div>
          </div>
      );


      switch (currentPage) {
          case 'mypage':
              return (
                <MyPage 
                    user={user} 
                    userProfile={userProfile} 
                    onUpdateProfile={handleUpdateProfile} 
                    onLogout={handleLogout} 
                    onReset={handleReset} 
                />
              );
              
          case 'recommend':
              return <RecommendationContent />;
              
          case 'record': // 식단 기록 상세 화면
              return (
                  <div className="space-y-6">
                      <h2 className="text-2xl font-bold text-gray-800">나의 식단 상세 기록</h2>
                      <FoodList foodEntries={foodEntries} />
                  </div>
              );

          case 'home': // 메인 대시보드 (요약 및 빠른 입력)
          default:
              return (
                  <div className="space-y-8">
                      {/* 1. 요약 카드 (Summary Card) */}
                      <div className="p-0">
                           <h2 className="text-2xl font-bold text-gray-800 mb-4">오늘의 영양 상태</h2>
                           <DailySummaryContent totals={dailyTotals} />
                      </div>

                      {/* 2. 빠른 입력 폼 (Input Form) */}
                      <div className="p-0">
                          <h2 className="text-2xl font-bold text-gray-800 mb-4">식단 기록하기</h2>
                          <FoodInputForm 
                              textInput={textInput} 
                              setTextInput={setTextInput} 
                              handleTextInput={handleTextInput} 
                              handleImageUpload={handleImageUpload} 
                              isLoadingImage={isLoadingImage} 
                          />
                      </div>
                  </div>
              );
      }
  };


  // --- Dashboard UI ---
  return (
    // 전역 배경 흰색, 텍스트 검은색으로 변경
    <div className="min-h-screen bg-white p-0 font-inter text-gray-800">
      {error && <Modal title="오류" message={error} onClose={() => setError(null)} />}
      
      {/* Top Header/Navigation - 배경 흰색 유지 */}
      <header className="bg-white sticky top-0 z-10 shadow-md">
        {/* max-w-4xl mx-auto는 중앙 정렬을 보장합니다. */}
        <div className="max-w-4xl mx-auto flex justify-between items-center px-4 py-3 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-teal-600 mx-4">Dieter</h1>
          
          {/* Navigation Links - 텍스트 색상 조정 */}
          <nav className="flex gap-6 text-gray-800 mx-2">
            {navItems.map((item) => (
                <button
                    key={item.page}
                    onClick={() => setCurrentPage(item.page)}
                    className={`font-semibold transition-colors duration-150 ${
                        currentPage === item.page ? 'text-teal-600 border-b-2 border-teal-600' : 'hover:text-teal-500'
                    }`}
                >
                    {item.name}
                </button>
            ))}
          </nav>

          {/* Logout Button - 텍스트 색상 조정 */}
          <button 
            onClick={handleLogout} 
            className=" mx-4 text-sm text-gray-800 hover:text-red-600 transition-colors duration-150 py-1 px-3 border border-gray-300 rounded-lg"
          >
            로그아웃
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-4xl mx-auto p-4 space-y-6 pt-8">
          {renderPage()}
      </main>
    </div>
  );
}