import React, { useState } from 'react';
import logoImage from './logo.png';

/**
 * 로그인 및 회원가입 화면을 렌더링하는 컴포넌트입니다.
 * Tailwind CSS 스타일링을 사용합니다.
 */
const Login = ({ onLogin, onSignup, error }) => {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // [추가] 사용자 이름(닉네임) 상태
  const [username, setUsername] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isSignup) {
      // [수정] 회원가입 시 username도 함께 전달
      onSignup(email, password, username);
    } else {
      onLogin(email, password);
    }
  };

  return (
    // 전역 배경을 밝은 회색 (bg-gray-50)으로 설정
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4 font-inter">
      {/* 카드 배경을 흰색 (bg-white)으로, 텍스트를 검은색으로 변경 */}
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 border border-gray-200">
        <div className="text-center mb-8">
          {/* 타이틀 색상을 민트색 (teal-600)으로 변경 */}
          <img 
            src={logoImage} 
            alt="Dieter Logo" 
            className="h-32 w-auto mx-auto mb-4 object-contain" 
          />
          <p className="text-gray-500">당신의 AI 영양 동반자.</p>
        </div>

        {error && (
          // 에러 메시지 배경색과 텍스트 색상 조정
          <div className="mb-4 p-3 bg-red-100 border border-red-400 rounded text-red-700 text-sm">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* [추가] 회원가입 시에만 보이는 사용자 이름 입력 필드 */}
          {isSignup && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">사용자 이름 (닉네임)</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="홍길동"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이메일 주소</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              // 인풋 필드 디자인: 밝은 테마 (흰색 배경, 회색 테두리, 민트색 포커스)
              className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="you@example.com"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              // 인풋 필드 디자인: 밝은 테마
              className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            // 버튼 디자인: 민트색 메인 버튼
            className="w-full bg-teal-600 hover:bg-teal-700 text-teal-500 font-semibold py-3 px-4 rounded-lg transition-colors duration-200 mt-6 shadow-md"
          >
            {isSignup ? '계정 생성' : '로그인'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            {isSignup ? "이미 계정이 있으신가요? " : "계정이 없으신가요? "}
            <button
              onClick={() => { setIsSignup(!isSignup); setEmail(''); setPassword(''); setUsername(''); }}
              // 토글 버튼 디자인: 민트색 텍스트
              className="text-teal-600 hover:text-teal-700 font-medium hover:underline focus:outline-none"
            >
              {isSignup ? '로그인' : '회원가입'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;