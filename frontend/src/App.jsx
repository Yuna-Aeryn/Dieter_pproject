import React, { useState, useEffect, useMemo, useRef } from 'react';

// 분리된 컴포넌트 import
import Login from './Login'; 
import MyPage from './MyPage'; 
import Manager from './Manager'; 

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
  setDoc, 
  getDoc, 

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

// NOTE: 'firebaseConfig' 변수는 사용자 환경에서 제공되어야 합니다.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'dieter-app';
const ADMIN_EMAIL = 'admin@dieter.com';

// --- Firebase Initialization ---
let app, auth, db;
try {
  // 경고: firebaseConfig가 정의되어 있어야 합니다.
  app = initializeApp(firebaseConfig); 
  auth = getAuth(app);
  db = getFirestore(app);
  setLogLevel('debug');
} catch (e) {
  console.error('Firebase initialization error:', e);
}

// --- STANDARD Recommended Daily Allowances (RDAs) - 성별에 따른 기본 권장량 설정 ---
const STANDARD_RDA = {
  male: {
    calories: 2500, protein: 65, fat: 78, carbohydrates: 300, sodium: 2300, sugar: 50, 
  },
  female: {
    calories: 2000, protein: 50, fat: 65, carbohydrates: 250, sodium: 2000, sugar: 40, 
  }
};

// --- Helper Components ---

const LoadingSpinner = () => (
    <div className="flex justify-center items-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-400"></div>
    </div>
  );
  
const Modal = ({ title, message, onClose }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 transition-opacity duration-300">
      <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md border border-gray-200">
        <h3 className="text-lg font-medium leading-6 text-gray-900">{title}</h3>
        <div className="mt-2">
          <p className="text-sm text-gray-600">{message}</p>
        </div>
        <div className="mt-4">
          <button
            type="button"
            className="inline-flex justify-center rounded-md border border-transparent bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-teal-700"
            onClick={onClose}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
  
const DailySummaryContent = ({ totals, userGender }) => {
    const targetRDA = STANDARD_RDA[userGender] || STANDARD_RDA.male;
    
    const nutItems = [
      { name: '칼로리', key: 'calories', rda: targetRDA.calories, unit: 'kcal' }, 
      { name: '탄수화물', key: 'carbohydrates', rda: targetRDA.carbohydrates, unit: 'g' }, 
      { name: '단백질', key: 'protein', rda: targetRDA.protein, unit: 'g' }, 
      { name: '지방', key: 'fat', rda: targetRDA.fat, unit: 'g' }, 
      { name: '당류', key: 'sugar', rda: targetRDA.sugar, unit: 'g' },
      { name: '나트륨', key: 'sodium', rda: targetRDA.sodium, unit: 'mg' }, 
    ].filter(item => item.key !== 'calories').map(item => ({ 
      ...item,
      value: totals[item.key] || 0,
    }));
  
    const calorieItem = STANDARD_RDA[userGender].calories;

    return (
      <div className="bg-teal-100 p-4 rounded-xl shadow-lg text-gray-800 border border-teal-200">
        <div className="flex items-center mb-4">
          {/* 칼로리 표시 */}
          <div className="bg-white text-teal-600 rounded-full w-20 h-20 flex flex-col items-center justify-center p-2 mr-4 font-bold shadow-md">
            <span className="text-xl font-bold">
              {Math.round(totals.calories)}
            </span>
            <span className="text-xs font-medium">/ {calorieItem} kcal</span>
          </div>
        </div>
  
        <div className="grid grid-cols-5 gap-2 text-center text-sm">
          {nutItems.map((item) => {
            const percentage = item.rda > 0 ? (item.value / item.rda) * 100 : 0;
            const barWidth = Math.min(percentage, 100);
            
            return (
              <div key={item.name} className="flex flex-col">
                <span className="font-semibold text-sm mb-1">{item.name}</span> 
                {/* 현재 섭취량 / 권장량 표시 */}
                <div className="text-xs text-gray-600 mb-1">{item.value.toFixed(0)}/{item.rda}{item.unit}</div> 
                <div className="h-1 bg-teal-200 rounded-full">
                  <div 
                    className="h-1 rounded-full" 
                    // 100% 초과 시 빨간색
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
      <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 min-h-[150px]">
        <div className="space-y-4 max-h-60 overflow-y-auto pr-2">
          {foodEntries.length === 0 ? (
            <p className="text-gray-500 text-center py-4">
              아직 기록된 식사가 없어요. 텍스트로 입력하거나 사진을 업로드해 보세요.
            </p>
          ) : foodEntries.map((entry) => (
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
  
const FoodInputForm = ({ textInput, setTextInput, handleTextInput, handleImageUpload, isLoadingImage, isLoadingText }) => {
    
    const isDisabled = isLoadingImage || isLoadingText;

    return (
      <div className="mt-6 p-4 bg-white rounded-xl shadow-inner border border-gray-200">
        <form onSubmit={handleTextInput} className="flex items-center space-x-2">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="음식명 또는 '떡볶이 1인분'을 입력하세요."
              className="flex-grow p-2 border border-gray-300 rounded-lg focus:ring-teal-500 focus:border-teal-500"
              disabled={isDisabled} 
            />
            
            <input 
              id="image-file-upload" 
              type="file" 
              className="sr-only" 
              accept="image/*" 
              onChange={(e) => handleImageUpload(e.target.files[0])} 
              disabled={isDisabled} 
            />
            
            <label htmlFor="image-file-upload" className="cursor-pointer p-2 rounded-lg hover:bg-gray-100 transition-colors">
              {isLoadingImage ? (
                <LoadingSpinner />
              ) : (
                <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 16m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              )}
            </label>
            
            <button 
              type="submit" 
              className={`p-2 rounded-lg transition-colors ${isDisabled || !textInput.trim() ? 'bg-gray-400 cursor-not-allowed' : 'bg-teal-600 hover:bg-teal-700'}`} 
              disabled={isDisabled || !textInput.trim()} 
            >
              {isLoadingText ? (
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
              ) : (
                <svg className="w-6 h-6 transform rotate-90 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              )}
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
  
  const [userProfile, setUserProfile] = useState({ 
    username: '', 
    gender: 'male' 
  }); 
  
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [error, setError] = useState(null);
  const [authError, setAuthError] = useState(null); 
  const [textInput, setTextInput] = useState(''); 

  const [isLoadingText, setIsLoadingText] = useState(false); 
  
  const [currentPage, setCurrentPage] = useState('recommend'); 
  
  const [recommendation, setRecommendation] = useState(null); 
  const [isLoadingRec, setIsLoadingRec] = useState(false);
  const recommendationTimerRef = useRef(null);

  const [isAdmin, setIsAdmin] = useState(false);

  // --- Auth Logic ---
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsAdmin(currentUser && currentUser.email === ADMIN_EMAIL);
      
      if (currentUser) {
        try {
            const userDocRef = doc(db, `artifacts/${appId}/users/${currentUser.uid}`);
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists()) {
                const data = userDoc.data();
                setUserProfile(prev => ({ ...prev, gender: data.gender || 'male', username: data.username || '' })); 
            } else {
                setUserProfile(prev => ({ ...prev, gender: 'male' }));
            }
        } catch (err) {
            console.error("프로필 불러오기 오류:", err);
        }
      } else {
        setUserProfile({ username: '', gender: 'male' });
      }

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

  const handleSignup = async (email, password, username) => {
    setAuthError(null);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await setDoc(doc(db, `artifacts/${appId}/users/${user.uid}`), {
        username: username,
        email: email,
        gender: 'male',
        createdAt: Timestamp.now()
      });
    } catch (err) {
      setAuthError(err.message.replace('Firebase: ', ''));
      console.error(err);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setFoodEntries([]); 
      setRecommendation(null);
      setCurrentPage('recommend'); 
      setIsAdmin(false);
    } catch (err) {
      setError("로그아웃 실패: " + err.message);
    }
  };

  const handleUpdateProfile = async (newProfileData) => {
    setUserProfile(prev => ({ ...prev, ...newProfileData }));
    
    if (user) {
        try {
            const userDocRef = doc(db, `artifacts/${appId}/users/${user.uid}`);
            await setDoc(userDocRef, newProfileData, { merge: true });
            handleGetRecommendation(); 

        } catch (err) {
            console.error("프로필 업데이트 오류:", err);
            setError("프로필 저장 실패: " + err.message);
        }
    }
  };


  // Data Fetching
  useEffect(() => {
    if (!isAuthReady || !user || !db || isAdmin) return; 
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    const q = query(collection(db, `artifacts/${appId}/users/${user.uid}/foodEntries`), where('timestamp', '>=', Timestamp.fromDate(startOfToday)));
    return onSnapshot(q, (snapshot) => {
      const entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      entries.sort((a, b) => (b.timestamp?.toDate() || 0) - (a.timestamp?.toDate() || 0));
      setFoodEntries(entries);
    });
  }, [isAuthReady, user, isAdmin]); 

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

  // Image Upload handler
  const handleImageUpload = async (file) => {
    if (!file) return;
    setIsLoadingImage(true); setError(null);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64ImageData = reader.result.split(',')[1];
        const response = await fetch('https://schoolstuff-lj67.onrender.com/analyze-image', {
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
  
  const handleTextInput = async (e) => {
    e.preventDefault();
    if (!textInput.trim() || isLoadingImage || isLoadingText) return; 

    setIsLoadingText(true); 
    setError(null);
    
    const input = textInput.trim();
    setTextInput(''); 
    
    try {
        console.log(`📤 Sending text for analysis: ${input}`);
        
        const response = await fetch('https://schoolstuff-lj67.onrender.com/analyze-text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: input }), 
        });

        if (!response.ok) throw new Error('텍스트 분석 백엔드 실패');
        
        const foodData = await response.json();
        
        if (db && user) {
            await addDoc(collection(db, `artifacts/${appId}/users/${user.uid}/foodEntries`), { 
                ...foodData, 
                timestamp: Timestamp.now() 
            });
            console.log("✅ Text Analysis & Record Success:", foodData.foodName);
        }
    } catch (err) { 
        setError("텍스트 분석 및 기록에 실패했습니다: " + err.message); 
        console.error("Text Analysis Error:", err);
    } finally { 
        setIsLoadingText(false); 
    }
};

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
      setRecommendation(null);
    } catch (err) { setError("초기화 실패: " + err.message); }
  };

  // --- Recommendation Handler ---
  const handleGetRecommendation = async () => {
    if (foodEntries.length === 0) return; 
    
    setIsLoadingRec(true);
    setRecommendation(null); 
    try {
      // 1. Create Array of Strings (server expects foodList: string[])
      const foodListArray = foodEntries.map(f => `${f.foodName} (${f.calories}kcal)`);
      
      // 2. Map 'carbohydrates' -> 'carbs' (Server expects currentIntake: { carbs: ... })
      const currentIntake = {
        ...dailyTotals,
        carbs: dailyTotals.carbohydrates 
      };
      
      // 사용자의 성별을 API에 전달
      const response = await fetch('https://schoolstuff-lj67.onrender.com/get-recommendation', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          foodList: foodListArray, 
          currentIntake: currentIntake,
          gender: userProfile.gender 
        }),
      });
      
      const data = await response.json();
      setRecommendation(data); 

    } catch (err) { 
        setError("추천 메뉴를 가져오는 데 실패했습니다."); 
        console.error(err); 
    } finally { 
        setIsLoadingRec(false); 
    }
  };

  // --- Auto-trigger Effect ---
  useEffect(() => {
    if (!isAuthReady || !user || isAdmin) return; 
    if (recommendationTimerRef.current) clearTimeout(recommendationTimerRef.current);
    
    if (foodEntries.length > 0) {
        setIsLoadingRec(true);
        recommendationTimerRef.current = setTimeout(() => handleGetRecommendation(), 3000);
    } else {
        setRecommendation(null);
        setIsLoadingRec(false);
    }
    return () => clearTimeout(recommendationTimerRef.current);
  }, [dailyTotals, userProfile.gender, isAuthReady, user, isAdmin]); 

  
  if (!isAuthReady) return <div className="flex justify-center items-center h-screen bg-white"><LoadingSpinner /></div>;

  // --- Login Screen ---
  if (!user) {
    // Pass the new handleSignup which now accepts username
    return <Login onLogin={handleLogin} onSignup={handleSignup} error={authError} />;
  }
  
  // 🚀 Admin Render
  if (isAdmin) {
    return (
      <div className="min-h-screen bg-white p-0 font-inter text-gray-800">
        <header className="bg-teal-600 sticky top-0 z-10 shadow-lg">
          <div className="max-w-4xl mx-auto flex justify-between items-center px-4 py-3">
            <h1 className="text-2xl font-bold text-white mx-4">DIETER 관리자</h1>
            <button 
              onClick={handleLogout} 
              className="mx-4 text-sm text-red-500 border border-white hover:bg-teal-500 transition-colors duration-150 py-1 px-3 rounded-lg"
            >
              로그아웃
            </button>
          </div>
        </header>
        <main className="max-w-4xl mx-auto p-4 space-y-6 pt-8">
            <Manager db={db} user={user} adminEmail={ADMIN_EMAIL} />
        </main>
        {error && <Modal title="오류" message={error} onClose={() => setError(null)} />}
      </div>
    );
  }


  // 🚀 User Render

  // 네비게이션 아이템
  const navItems = [
    { name: '추천 메뉴', page: 'recommend' }, 
    { name: '식단 입력', page: 'home' }, 
    { name: '상세 기록', page: 'record' }, 
    { name: '마이페이지', page: 'mypage' },
  ];
  
  const renderPage = () => {
      
      const RecommendationContent = () => (
          <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-200">
            <h3 className="text-xl font-bold text-teal-600 mb-4">오늘의 식단 추천</h3>
            <div className="min-h-[150px] flex flex-col justify-between">
              {isLoadingRec ? (
                  <LoadingSpinner />
              ) : recommendation ? (
                  <div className="space-y-2">
                    <h4 className="text-xl font-bold text-gray-800">{recommendation.menuName}</h4>
                    <p className="text-sm text-teal-600 font-semibold">{recommendation.calories} kcal</p>
                    
                    {/* 🔥 [핵심 수정] 여기에 style 추가해서 줄바꿈(엔터) 적용됨 */}
                    <p className="text-gray-600" style={{ whiteSpace: "pre-wrap", lineHeight: "1.6" }}>
                        {recommendation.reason}
                    </p>

                  </div>
              ) : (
                  <p className="text-gray-500 text-center py-8">
                    현재까지의 식단 정보를 바탕으로 맞춤형 추천 메뉴를 받아보세요.
                  </p>
              )}
              
              <div className="space-y-2 mt-6">
                <div className="flex justify-between items-center gap-4">
                  
                  <button
                      onClick={handleGetRecommendation}
                      disabled={isLoadingRec || foodEntries.length === 0} 
                      className="flex-1 bg-teal-600 hover:bg-teal-700 text-teal-600 font-bold py-3 rounded-lg transition-colors shadow-md"
                  >
                    {isLoadingRec ? '분석 중...' : '맞춤 메뉴 추천받기'}
                  </button>
                  
                  <button
                      onClick={() => setCurrentPage('home')}
                      className="text-teal-600 bg-white border border-teal-600 hover:bg-teal-50 font-bold py-3 px-4 rounded-lg transition-colors shadow-md"
                  >
                    식단 입력하러 가기
                  </button>
                </div>
                
                {foodEntries.length === 0 && (
                  <p className="text-red-500 text-center text-sm font-medium mt-2">
                    입력된 식단이 없으면 추천이 불가해요
                  </p>
                )}
              </div>
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
              
          case 'record': 
              return (
                  <div className="space-y-6">
                    <h2 className="text-2xl font-bold text-gray-800">나의 식단 상세 기록</h2>
                    <FoodList foodEntries={foodEntries} />
                  </div>
              );

          case 'home': 
          default:
              return (
                  <div className="space-y-8">
                    <div className="p-0">
                            <h2 className="text-2xl font-bold text-gray-800 mb-4">오늘의 영양 상태</h2>
                            <DailySummaryContent totals={dailyTotals} userGender={userProfile.gender} />
                    </div>

                    <div className="p-0">
                      <h2 className="text-2xl font-bold text-gray-800 mb-4">식단 기록하기</h2>
                      <FoodInputForm 
                        textInput={textInput} 
                        setTextInput={setTextInput} 
                        handleTextInput={handleTextInput} 
                        handleImageUpload={handleImageUpload} 
                        isLoadingImage={isLoadingImage} 
                        isLoadingText={isLoadingText} 
                      />
                    </div>

                    <div className="flex justify-center mt-8 pb-8">
                      <button
                          onClick={handleReset}
                          className="text-sm text-gray-400 hover:text-red-500 underline transition-colors hover:border-1 hover:border-teal-500 rounded p-1"
                      >
                          일일 식단 리셋
                      </button>
                    </div>
                  </div>
              );
      }
  };


  // --- Dashboard UI ---
  return (
    <div className="min-h-screen bg-white p-0 font-inter text-gray-800">
      {error && <Modal title="오류" message={error} onClose={() => setError(null)} />}
      
      <header className="bg-white sticky top-0 z-10 shadow-md">
        <div className="max-w-4xl mx-auto flex justify-between items-center px-4 py-3 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-teal-600 mx-4">Dieter</h1>
          
          <nav className="flex gap-6 text-teal-600 mx-2">
            {navItems.map((item) => (
                <button
                    key={item.page}
                    onClick={() => setCurrentPage(item.page)}
                    
                    className={`font-semibold transition-colors duration-150 ${
                        // 이 부분은 이미 'text-teal-600 border-b-2 border-teal-600'로 되어 있어 수정 없이 요청에 맞게 유지됩니다.
                        currentPage === item.page ? 'text-teal-600 border-b-2 border-teal-600' : 'hover:text-teal-500'
                    }`}
                >
                    {item.name}
                </button>
            ))}
          </nav>

          <div className="w-16"></div> 
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-6 pt-8">
          {renderPage()}
      </main>
    </div>
  );
}