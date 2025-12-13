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

// --- 관리자 정보 설정 ---
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
    calories: 2500, // 남성 기준
    protein: 65, 
    fat: 78, 
    carbohydrates: 300, 
    sodium: 2300, 
    sugar: 50, 
  },
  female: {
    calories: 2000, // 여성 기준
    protein: 50, 
    fat: 65, 
    carbohydrates: 250, 
    sodium: 2000, 
    sugar: 40, 
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
    // 성별에 맞는 RDA 값 선택 (기본값은 male로 설정)
    const targetRDA = STANDARD_RDA[userGender] || STANDARD_RDA.male;
    
    // 이 예시에서는 탄수화물, 단백질, 지방, 당류, 나트륨만 표시
    const nutItems = [
      { name: '칼로리', key: 'calories', rda: targetRDA.calories, unit: 'kcal' }, 
      { name: '탄수화물', key: 'carbohydrates', rda: targetRDA.carbohydrates, unit: 'g' }, 
      { name: '단백질', key: 'protein', rda: targetRDA.protein, unit: 'g' }, 
      { name: '지방', key: 'fat', rda: targetRDA.fat, unit: 'g' }, 
      { name: '당류', key: 'sugar', rda: targetRDA.sugar, unit: 'g' },
      { name: '나트륨', key: 'sodium', rda: targetRDA.sodium, unit: 'mg' }, 
    ].filter(item => item.key !== 'calories').map(item => ({ // 칼로리는 별도로 표시
      ...item,
      value: totals[item.key] || 0,
    }));
  
    // 칼로리 별도 추출
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
  
const FoodInputForm = ({ textInput, setTextInput, handleTextInput, handleImageUpload, isLoadingImage }) => {
    return (
      <div className="mt-6 p-4 bg-white rounded-xl shadow-inner border border-gray-200">
        <form onSubmit={handleTextInput} className="flex items-center space-x-2">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="오늘 먹은 음식을 텍스트로 입력하세요..."
              // 🔴 수정 1-1: input에 마우스 올렸을 때 포커스 링 색상 변경 (focus:ring-teal-500은 그대로 유지)
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
                <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 16m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              )}
            </label>
            
            <button type="submit" className="bg-teal-600 p-2 rounded-lg hover:bg-teal-700 transition-colors" disabled={isLoadingImage || !textInput.trim()}>
              <svg className="w-6 h-6 transform rotate-90 text-white" fill="currentColor" viewBox="0 0 24 24">
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
  
  // [수정] userProfile에 username 필드 추가
  const [userProfile, setUserProfile] = useState({ 
    username: '', 
    gender: 'male' // 초기값 male
  }); 
  
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [error, setError] = useState(null);
  const [authError, setAuthError] = useState(null); 
  const [textInput, setTextInput] = useState(''); 
  
  // ⭐️ 초기 화면을 'recommend'로 설정
  const [currentPage, setCurrentPage] = useState('recommend'); 
  
  const [recommendation, setRecommendation] = useState(null); 
  const [isLoadingRec, setIsLoadingRec] = useState(false);
  const recommendationTimerRef = useRef(null);

  // 관리자 상태 추가
  const [isAdmin, setIsAdmin] = useState(false);

  // --- Auth Logic ---
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsAdmin(currentUser && currentUser.email === ADMIN_EMAIL);
      
      // [추가] 로그인 시 Firestore에서 사용자 프로필 불러오기 (닉네임, 성별 등)
      if (currentUser) {
        try {
            const userDocRef = doc(db, `artifacts/${appId}/users/${currentUser.uid}`);
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists()) {
                const data = userDoc.data();
                // gender 값이 없으면 기본값 'male'을 사용
                setUserProfile(prev => ({ ...prev, gender: data.gender || 'male', username: data.username || '' })); 
            } else {
                setUserProfile(prev => ({ ...prev, gender: 'male' }));
            }
        } catch (err) {
            console.error("프로필 불러오기 오류:", err);
        }
      } else {
        // 로그아웃 시 프로필 초기화
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

  // [수정] 회원가입 시 username 인자 추가
  const handleSignup = async (email, password, username) => {
    setAuthError(null);
    try {
      // 1. Auth 사용자 생성
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Firestore에 사용자 프로필 문서 생성 (닉네임, 기본 성별 저장)
      await setDoc(doc(db, `artifacts/${appId}/users/${user.uid}`), {
        username: username,
        email: email,
        gender: 'male', // 기본값 'male'
        createdAt: Timestamp.now()
      });
      // onAuthStateChanged가 트리거되면서 state 업데이트 됨 (gender: 'male'로 설정될 것임)
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
    // UI 즉시 반영
    setUserProfile(prev => ({ ...prev, ...newProfileData }));
    
    // Firestore 업데이트
    if (user) {
        try {
            const userDocRef = doc(db, `artifacts/${appId}/users/${user.uid}`);
            // merge: true 옵션으로 기존 필드 유지하면서 업데이트
            await setDoc(userDocRef, newProfileData, { merge: true });
            
            // 프로필 업데이트 시 영양소 추천도 새로고침 (즉시 트리거)
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
  
  const handleTextInput = async (e) => {
      e.preventDefault();
      if (!textInput.trim()) return;
      console.log(`Sending text for analysis: ${textInput}`);
      setTextInput('');
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
      const foodListArray = foodEntries.map(f => `${f.foodName} (${f.calories}kcal)`);
      
      const currentIntake = {
        ...dailyTotals,
        carbs: dailyTotals.carbohydrates 
      };
      
      // 사용자의 성별을 API에 전달
      const response = await fetch('http://localhost:3001/get-recommendation', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          foodList: foodListArray, 
          currentIntake: currentIntake,
          gender: userProfile.gender // 성별 전달
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
  // dailyTotals 또는 userProfile.gender가 변경될 때마다 자동 추천 재실행
  useEffect(() => {
    if (!isAuthReady || !user || isAdmin) return; 
    if (recommendationTimerRef.current) clearTimeout(recommendationTimerRef.current);
    
    // Only auto-trigger if there is food logged
    if (foodEntries.length > 0) {
        setIsLoadingRec(true);
        // The timer is now active!
        recommendationTimerRef.current = setTimeout(() => handleGetRecommendation(), 3000);
    } else {
      // 식단이 없으면 추천 결과 및 로딩 상태 초기화
      setRecommendation(null);
      setIsLoadingRec(false);
    }
    return () => clearTimeout(recommendationTimerRef.current);
  }, [dailyTotals, userProfile.gender, isAuthReady, user, isAdmin]); // userProfile.gender 의존성 추가

  
  if (!isAuthReady) return <div className="flex justify-center items-center h-screen bg-white"><LoadingSpinner /></div>;

  // --- Login Screen ---
  if (!user) {
    // Login 컴포넌트에서는 input과 버튼의 호버/포커스 스타일을 수정해야 합니다.
    // 하지만 Login 컴포넌트 내부 코드가 없으므로, 해당 컴포넌트의 스타일이 아래와 같이 가정된다고 보고 수정합니다.
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
                    <p className="text-gray-600">{recommendation.reason}</p>
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
                      // 식단이 없으면 버튼 비활성화
                      disabled={isLoadingRec || foodEntries.length === 0} 
                      className="flex-1 bg-teal-600 hover:bg-teal-700 text-teal-600 font-bold py-3 rounded-lg transition-colors shadow-md"
                  >
                    {isLoadingRec ? '분석 중...' : '맞춤 메뉴 추천받기'}
                  </button>
                  
                  {/* 식단 입력하러 가기 버튼 추가 */}
                  <button
                      onClick={() => setCurrentPage('home')} // 'home' 페이지(기존 식단 입력)로 이동
                      className="text-teal-600 bg-white border border-teal-600 hover:bg-teal-50 font-bold py-3 px-4 rounded-lg transition-colors shadow-md"
                  >
                    식단 입력하러 가기
                  </button>
                </div>
                
                {/* 식단 입력 안내 텍스트 추가 */}
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
                           <h2 className="text-2xl font-bold text-gray-800 mb-4">오늘의 영양 상태 ({userProfile.gender === 'male' ? '남성' : '여성'} 기준)</h2>
                           {/* userProfile.gender를 DailySummaryContent에 전달 */}
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
                        />
                    </div>

                    {/* --- 리셋 버튼 --- */}
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

          {/* 로그아웃 버튼 (MyPage로 이동했으므로 제거된 상태 유지) */}
          <div className="w-16"></div> 
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-6 pt-8">
          {renderPage()}
      </main>
    </div>
  );
}