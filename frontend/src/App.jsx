import React, { useState, useEffect, useCallback } from 'react';
import Login from './Login';
import MyPage from './MyPage';

// Firebase Imports
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import {
  getFirestore,
  addDoc,
  collection,
  query,
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

const appId = 'dieter-app';

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
setLogLevel('error');

// --- Helper Components: NavHeader (공통 사용) ---
const NavHeader = ({ currentView, onNavigate }) => (
    <header className="bg-white px-4 py-4 shadow-md sticky top-0 z-10">
        <div className="flex justify-between items-center">
             <h1 className="text-2xl font-bold text-teal-500">Dieter</h1>
             <nav>
                {['dashboard', 'log', 'recommendation', 'mypage'].map((view) => (
                    <button 
                        key={view}
                        onClick={() => onNavigate(view)} 
                        className={`mx-2 text-lg pb-1 transition-colors ${
                            currentView === view
                                ? 'font-bold text-teal-500 border-b-2 border-teal-500'
                                : 'font-medium text-gray-500 hover:text-teal-500'
                        }`}
                    >
                        {view === 'dashboard' ? '홈' : view === 'log' ? '기록' : view === 'recommendation' ? '메뉴 추천' : '마이페이지'}
                    </button>
                ))}
            </nav>
        </div>
    </header>
);

// --- 1. MainDashboard Component ---
const MainDashboard = ({ dailyTotals, foodEntries, onUploadText, onUploadImage, isLoading, onNavigate }) => {
  const [inputText, setInputText] = useState('');
  
  const handleTextSubmit = () => {
    if (inputText.trim() !== '') {
      onUploadText(inputText.trim());
      setInputText('');
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      onUploadImage(file);
    }
  };

  // 최종 영양소 배열: 순탄수, 단백질, 지방, 당류, 나트륨
  const macros = [
    { name: '순탄수', key: 'netCarbs', target: dailyTotals.rda.netCarbs },
    { name: '단백질', key: 'protein', target: dailyTotals.rda.protein },
    { name: '지방', key: 'fat', target: dailyTotals.rda.fat },
    { name: '당류', key: 'sugar', target: dailyTotals.rda.sugar || 50 },
    { name: '나트륨', key: 'sodium', target: dailyTotals.rda.sodium || 2000 },
  ];

  const totalCalories = dailyTotals.intake.calories;
  const targetCalories = dailyTotals.rda.calories || 2000;
  const caloriePercentage = (totalCalories / targetCalories) * 100;
  
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <NavHeader currentView="dashboard" onNavigate={onNavigate} />

      <main className="p-4 space-y-6">
        {/* 2. 칼로리 및 매크로 요약 카드 */}
        <div className="bg-[#66cdaa] p-6 rounded-2xl text-white shadow-xl">
          <div className="flex justify-between items-center mb-4">
             {/* Calorie Chart Placeholder */}
             <div className="relative w-24 h-24 flex items-center justify-center rounded-full border-4 border-white border-opacity-30">
                <div className="absolute inset-0 rounded-full" style={{
                    background: `conic-gradient(#fff ${caloriePercentage}%, transparent ${caloriePercentage}%)`
                }}/>
                <div className="text-center">
                    <span className="text-2xl font-bold">{totalCalories.toFixed(0)}</span>
                    <span className="text-xs block">kcal</span>
                </div>
             </div>
             {/* Macros Ratio Placeholder (생략) */}
          </div>

          {/* 3. 영양소 막대 그래프 */}
          <div className="grid grid-cols-5 gap-2 text-center text-xs mt-4">
            {macros.map((macro) => {
              const consumed = dailyTotals.intake[macro.key] || 0;
              const percentage = macro.target > 0 ? (consumed / macro.target) * 100 : 0;
              const isProtein = macro.key === 'protein';
              const barColor = isProtein ? 'bg-yellow-300' : 'bg-white';
              
              return (
                <div key={macro.name} className="flex flex-col items-center">
                  <div className="text-sm font-semibold">{macro.name}</div>
                  <div className="w-full h-2 bg-black bg-opacity-20 rounded-full overflow-hidden mt-1">
                    <div 
                      className={`${barColor} h-full rounded-full`} 
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs">{consumed.toFixed(0)}/{macro.target.toFixed(0)}{macro.key === 'sodium' ? 'mg' : 'g'}</p>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* 4. 오늘의 식사 (채팅 및 업로드) */}
        <section className="bg-white p-4 rounded-2xl shadow-md">
          <h2 className="text-xl font-bold text-gray-800 mb-4">오늘의 식사</h2>
          
          <div className="space-y-3 mb-4 h-40 overflow-y-auto border-b pb-4">
             {foodEntries.length === 0 && <p className="text-gray-400 text-center pt-8">아직 기록된 식사가 없어요. 텍스트로 입력하거나 사진을 업로드해 보세요.</p>}
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') handleTextSubmit();
              }}
              className="flex-grow px-4 py-2 rounded-full border border-gray-300 focus:outline-none focus:border-teal-500"
              placeholder="오늘 먹은 음식을 텍스트로 입력하세요..."
              disabled={isLoading}
            />
            
            <button 
              onClick={handleTextSubmit}
              className="p-2 bg-teal-500 text-white rounded-full hover:bg-teal-600 transition-colors"
              disabled={isLoading || inputText.trim() === ''}
            >
              <svg className="w-6 h-6 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
            </button>
            
            <label className="p-2 bg-gray-200 text-gray-600 rounded-full cursor-pointer hover:bg-gray-300 transition-colors">
              <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
            </label>

            {isLoading && (
              <p className="text-teal-500 text-sm animate-pulse ml-2">AI가 분석 중...</p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

// --- 2. FoodLogScreen Component ---
const FoodLogScreen = ({ foodEntries, onNavigate }) => {
    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            <NavHeader currentView="log" onNavigate={onNavigate} />
            <main className="p-4">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">나의 식단 기록</h2>
                <div className="space-y-4">
                    {foodEntries.length === 0 ? (
                        <p className="text-center text-gray-500 mt-20">아직 기록된 식단이 없습니다.</p>
                    ) : (
                        foodEntries
                            .sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis())
                            .map((entry) => (
                            <div key={entry.timestamp.toMillis()} className="bg-white p-4 rounded-xl shadow-md border border-gray-100">
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="text-lg font-semibold text-gray-700">
                                        {entry.type === 'text' ? '텍스트 기록' : '사진 분석 기록'}
                                    </h3>
                                    <p className="text-sm text-gray-400">
                                        {new Date(entry.timestamp.toMillis()).toLocaleString('ko-KR', {
                                            month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
                                        })}
                                    </p>
                                </div>
                                
                                <p className="text-sm text-gray-600 mb-2">{entry.foodName || entry.originalText || '분석된 식단'}</p>
                                <p className="text-xl font-bold text-teal-600">
                                    {entry.calories ? `${entry.calories.toFixed(0)} kcal` : '칼로리 미정'}
                                </p>
                                
                                {/* 영양소 요약 (나트륨, 당류 포함) */}
                                {entry.macros && (
                                    <div className="grid grid-cols-5 gap-2 text-xs mt-3 text-gray-500 font-medium">
                                        <span className="text-center">탄: {entry.macros.netCarbs?.toFixed(0) || 0}g</span>
                                        <span className="text-center">단: {entry.macros.protein?.toFixed(0) || 0}g</span>
                                        <span className="text-center">지: {entry.macros.fat?.toFixed(0) || 0}g</span>
                                        <span className="text-center text-orange-500">당: {entry.macros.sugar?.toFixed(0) || 0}g</span>
                                        <span className="text-center text-red-500">나: {entry.macros.sodium?.toFixed(0) || 0}mg</span>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </main>
        </div>
    );
};

// --- 3. MenuRecommendationScreen Component ---
const MenuRecommendationScreen = ({ onNavigate }) => {
    const recommendations = [
        { name: "닭가슴살 샐러드", reason: "최근 단백질 섭취량이 부족했습니다. (단백질 60g)", calories: 350 },
        { name: "저당 샌드위치", reason: "점심에 순탄수가 높았습니다. (순탄수 30g)", calories: 420 },
        { name: "그릭 요거트", reason: "아침 식단으로 가볍게 추천합니다. (지방 10g)", calories: 150 },
    ];
    
    return (
        <div className="min-h-screen bg-gray-50 pb-20">
             <NavHeader currentView="recommendation" onNavigate={onNavigate} />
             <main className="p-4">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">맞춤 메뉴 추천 🍽️</h2>

                <div className="mb-6 p-4 bg-white rounded-xl shadow-md">
                    <p className="text-gray-600">회원님의 최근 식단 기록을 분석하여 맞춤 메뉴를 추천해 드립니다.</p>
                </div>
                
                <div className="space-y-4">
                    {recommendations.map((menu, index) => (
                        <div key={index} className="bg-white p-4 rounded-xl shadow-lg border-l-4 border-teal-400">
                            <h3 className="text-xl font-bold text-gray-800 mb-1">{menu.name}</h3>
                            {/* 추천 이유 텍스트 색상 검정색으로 수정 */}
                            <p className="text-sm text-gray-800 font-medium mb-2">{menu.reason}</p> 
                            <p className="text-base text-gray-600">{menu.calories} kcal</p>
                            {/* '식단에 추가' 버튼 제거 */}
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
};


// --- App Component (Main Logic) ---
const initialDailyTotals = {
  rda: { netCarbs: 100, protein: 120, fat: 50, sugar: 50, sodium: 2000, calories: 2000 },
  intake: { netCarbs: 0, protein: 0, fat: 0, sugar: 0, sodium: 0, calories: 0 },
};

const App = () => {
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userId, setUserId] = useState(null);
  const [foodEntries, setFoodEntries] = useState([]);
  const [dailyTotals, setDailyTotals] = useState(initialDailyTotals);
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [userProfile, setUserProfile] = useState({ email: 'user@dieter.com', height: 175, weight: 65 });
  const [currentView, setCurrentView] = useState('dashboard');

  // --- Auth Logic ---
  useEffect(() => {
    // 임시 로그인 로직: 익명 로그인
    signInAnonymously(auth).then((userCredential) => {
        setUserId(userCredential.user.uid);
        setIsLoggedIn(true);
        setIsAuthReady(true);
    }).catch(error => {
        console.error("Authentication failed:", error);
        setIsAuthReady(true);
    });
  }, []);

  const handleLogin = () => {
    // 로그인 버튼 클릭 시 (익명 로그인 상태이므로 실제 동작은 useEffect에서 처리)
    setIsLoggedIn(true);
  };

  // --- Data Fetching Logic (Firebase) ---
  useEffect(() => {
    if (!userId || !db) return;
    
    // Food Entries Listener
    const entriesQuery = query(collection(db, `artifacts/${appId}/users/${userId}/foodEntries`));
    const unsubscribeEntries = onSnapshot(entriesQuery, (snapshot) => {
        const entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setFoodEntries(entries);
        
        // Calculate daily totals
        const newTotals = { ...initialDailyTotals.intake };
        entries.forEach(entry => {
            if (entry.macros) {
                newTotals.netCarbs += entry.macros.netCarbs || 0;
                newTotals.protein += entry.macros.protein || 0;
                newTotals.fat += entry.macros.fat || 0;
                newTotals.sugar += entry.macros.sugar || 0;
                newTotals.sodium += entry.macros.sodium || 0;
                newTotals.calories += entry.calories || 0;
            }
        });
        setDailyTotals(prev => ({ ...prev, intake: newTotals }));
    });
    
    return () => {
        unsubscribeEntries();
    };
  }, [userId]);

  // --- Handlers ---
  const handleImageUpload = useCallback(async (file) => {
    // 이미지 업로드 로직
    alert('이미지 업로드 및 분석 로직 실행');
  }, [userId, db]);

  const handleTextUpload = useCallback(async (text) => {
    if (!db || !userId) return;
    try {
        setIsLoadingImage(true);
        // 텍스트 분석 결과 임시 데이터로 추가
        await addDoc(collection(db, `artifacts/${appId}/users/${userId}/foodEntries`), {
            foodName: text,
            calories: Math.floor(Math.random() * 500) + 100,
            macros: { 
                netCarbs: Math.floor(Math.random() * 50), 
                protein: Math.floor(Math.random() * 50), 
                fat: Math.floor(Math.random() * 30), 
                sugar: Math.floor(Math.random() * 10), 
                sodium: Math.floor(Math.random() * 800) 
            },
            type: 'text',
            originalText: text,
            timestamp: Timestamp.now(),
        });
    } catch (err) {
        console.error("Text analysis failed:", err);
        alert("텍스트 기록 실패");
    } finally {
        setIsLoadingImage(false);
    }
  }, [userId, db]);

  const handleUpdateProfile = (newProfile) => {
    setUserProfile(newProfile);
    // 실제 백엔드 연동 로직 추가 필요
  };

  // --- Render ---
  if (!isAuthReady) return <div className="flex justify-center items-center h-screen">Loading...</div>;

  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  // 뷰 상태에 따라 다른 컴포넌트를 렌더링
  const commonProps = {
    onNavigate: setCurrentView,
    dailyTotals: dailyTotals,
    foodEntries: foodEntries,
    userProfile: userProfile,
  };

  switch (currentView) {
    case 'dashboard':
      return (
        <MainDashboard 
          onUploadImage={handleImageUpload}
          onUploadText={handleTextUpload}
          isLoading={isLoadingImage}
          {...commonProps}
        />
      );
    case 'log':
      return <FoodLogScreen {...commonProps} />;
    case 'recommendation':
      return <MenuRecommendationScreen {...commonProps} />;
    case 'mypage':
      return (
        <MyPage 
          onUpdateProfile={handleUpdateProfile}
          {...commonProps}
        />
      );
    default:
      return null;
  }
};

export default App;