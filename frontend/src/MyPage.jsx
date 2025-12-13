import React, { useState } from 'react';

// MyPage 컴포넌트는 App.js에서 필요한 데이터와 함수를 prop으로 받습니다.
const MyPage = ({ user, userProfile, onUpdateProfile, onLogout, onReset }) => {
  const [gender, setGender] = useState(userProfile.gender || 'male');
  const [email, setEmail] = useState(user?.email || '테스트 사용자'); 
  const [newPassword, setNewPassword] = useState('');
  
  const handleSave = () => {
    onUpdateProfile({ 
        gender: gender,
    });
    
    if (email !== user?.email || newPassword) {
        alert('신체 정보(성별)는 저장되었으나, 계정 정보(이메일/비밀번호)는 실제 Firebase 인증 로직이 필요합니다.');
    } else {
        alert('사용자 정보가 저장되었습니다.');
    }
    setNewPassword('');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 font-inter text-gray-800">
      <main className="max-w-4xl mx-auto space-y-8"> 
        <h2 className="text-3xl font-bold text-gray-800 border-b pb-4 border-gray-200">마이페이지</h2>

        <section className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
            <h3 className="text-xl font-bold text-teal-600 mb-4">사용자 정보</h3>
            
            {/* NEW: Display Username */}
            <div className="mb-6 p-4 bg-teal-50 rounded-lg border border-teal-100 flex items-center gap-3">
                 <div className="w-12 h-12 bg-teal-200 rounded-full flex items-center justify-center text-teal-700 font-bold text-xl">
                    {userProfile.username ? userProfile.username[0] : 'U'}
                 </div>
                 <div>
                     <p className="text-sm text-teal-800 font-bold">{userProfile.username || '사용자'} 님</p>
                     <p className="text-xs text-teal-600">환영합니다!</p>
                 </div>
            </div>

            <div className="space-y-6">
                
                {/* 1-1. 성별 설정 */}
                <div>
                    <label className="text-sm font-medium text-gray-600 block mb-1">성별 설정</label>
                    <select
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
                        className="w-full px-4 py-3 rounded-lg bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                        <option value="male">남성</option>
                        <option value="female">여성</option>
                    </select>
                </div>
                
                {/* 1-2. 이메일 수정 */}
                <div>
                    <label className="text-sm font-medium text-gray-600 block mb-1">이메일 (수정)</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                           className="w-full px-4 py-3 rounded-lg bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500" />
                    <p className="text-xs text-gray-500 mt-1">
                        * 실제 이메일 변경은 추가 인증 절차가 필요합니다.
                    </p>
                </div>

                {/* 1-3. 비밀번호 수정 */}
                <div>
                    <label className="text-sm font-medium text-gray-600 block mb-1">비밀번호 (수정)</label>
                    <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                           className="w-full px-4 py-3 rounded-lg bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500"
                           placeholder="변경할 비밀번호 입력" />
                </div>

                {/* 1-4. 저장 버튼 (민트색) */}
                <button 
                  onClick={handleSave}
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 rounded-lg transition-colors shadow-md mt-2"
                >
                  사용자 정보 저장
                </button>

                {/* 1-5. 로그아웃 (FIXED: 문법 오류 수정됨) */}
                <div className="pt-6 border-t border-gray-100 mt-6">
                    <p className="text-sm text-gray-500 mb-2">현재 계정에서 로그아웃합니다.</p>
                    <button 
                      onClick={onLogout}
                      className="w-full bg-gray-100 hover:bg-gray-200 text-red-500 font-bold py-3 rounded-lg transition-colors shadow-sm border border-gray-200"
                    >
                      로그아웃
                    </button>
                </div>
            </div>
        </section>
      </main>
    </div>
  );
};

export default MyPage;