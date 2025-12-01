// Manager.jsx (수정됨)
import React, { useState, useEffect } from 'react';
import { getFirestore, collection, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { getAuth, updateEmail, updatePassword } from 'firebase/auth';

// Firebase는 App.jsx에서 초기화되었으므로, 여기서는 db 인스턴스를 직접 받습니다.
const Manager = ({ db, user, adminEmail }) => {
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [adminUpdateError, setAdminUpdateError] = useState(null);
    const [newAdminEmail, setNewAdminEmail] = useState(adminEmail);
    const [newAdminPassword, setNewAdminPassword] = useState('');

    const usersCollectionPath = 'artifacts/dieter-app/users';

    // 사용자 목록 불러오기
    const fetchUsers = async () => {
        setIsLoading(true);
        setError(null);
        try {
            if (!db) {
                setError("Firestore 데이터베이스 연결을 찾을 수 없습니다.");
                setIsLoading(false);
                return;
            }

            const usersRef = collection(db, usersCollectionPath);
            const snapshot = await getDocs(usersRef);
            
            const usersData = snapshot.docs.map(document => ({
                id: document.id, // UID
                ...document.data(),
                email: document.data().email || `${document.id.substring(0, 4)}...@example.com`,
            }));

            // 현재 로그인된 관리자 계정은 목록에서 제외하거나 표시 방식을 조정할 수 있지만,
            // 여기서는 모든 프로필 문서를 가져오되, 이메일을 기반으로 관리자를 구별합니다.
            setUsers(usersData);
        } catch (err) {
            console.error("사용자 목록 로드 오류:", err);
            setError("사용자 목록을 불러오는 데 실패했습니다.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (db) {
            fetchUsers();
        }
    }, [db]); // 컴포넌트 마운트 시 한 번만 로드

    // 사용자 삭제 (Delete)
    const handleDeleteUser = async (userId, userEmail) => {
        if (userId === user.uid) {
            alert("자신의 계정은 관리자 화면에서 삭제할 수 없습니다.");
            return;
        }

        if (!confirm(`사용자(${userEmail}, ${userId})의 데이터를 모두 삭제하시겠습니까? (경고: 실제 Firebase Auth 계정은 삭제되지 않을 수 있습니다.)`)) return;
        
        try {
            // 1. 해당 사용자의 모든 식단 기록 삭제 (옵션)
            const foodEntriesRef = collection(db, `artifacts/dieter-app/users/${userId}/foodEntries`);
            const foodSnapshot = await getDocs(foodEntriesRef);
            const batch = writeBatch(db); // App.jsx에서 writeBatch를 import해야 함
            foodSnapshot.docs.forEach((doc) => batch.delete(doc.ref));
            await batch.commit();

            // 2. 사용자 프로필 문서 삭제
            const userDocRef = doc(db, usersCollectionPath, userId);
            await deleteDoc(userDocRef);
            
            // 목록에서 제거
            setUsers(prev => prev.filter(u => u.id !== userId));
            alert("사용자 데이터가 성공적으로 삭제되었습니다.");
        } catch (err) {
            console.error("사용자 삭제 오류:", err);
            setError(`사용자 ${userId} 삭제 실패: ` + err.message);
        }
    };

    // 관리자 이메일/비밀번호 수정 처리
    const handleAdminUpdate = async (e) => {
        e.preventDefault();
        setAdminUpdateError(null);
        const currentUser = getAuth().currentUser;

        if (!currentUser) {
            setAdminUpdateError("로그인된 관리자 정보를 찾을 수 없습니다.");
            return;
        }

        let updated = false;

        try {
            // 이메일 업데이트
            if (newAdminEmail !== currentUser.email && newAdminEmail.trim() !== adminEmail) {
                await updateEmail(currentUser, newAdminEmail.trim());
                alert(`관리자 이메일이 ${newAdminEmail}으로 업데이트되었습니다. (다시 로그인 필요)`);
                updated = true;
            }

            // 비밀번호 업데이트
            if (newAdminPassword.length >= 6) {
                await updatePassword(currentUser, newAdminPassword);
                alert("관리자 비밀번호가 업데이트되었습니다.");
                setNewAdminPassword('');
                updated = true;
            } else if (newAdminPassword.length > 0 && newAdminPassword.length < 6) {
                setAdminUpdateError("비밀번호는 최소 6자 이상이어야 합니다.");
                return;
            }
            
            if (updated) {
                // 이메일 변경 시 로그아웃을 유도해야 함 (Firebase 정책상)
                if (newAdminEmail !== currentUser.email) {
                    // 실제 앱에서는 로그아웃 후 재인증 프로세스가 필요합니다.
                    // 여기서는 간단히 새로고침을 유도합니다.
                    window.location.reload(); 
                }
            } else {
                alert("수정할 내용이 없습니다.");
            }

        } catch (err) {
            console.error("관리자 정보 업데이트 오류:", err);
            setAdminUpdateError(`업데이트 실패: ${err.message}. (최근 로그인 시간이 오래되었다면 다시 로그인해야 할 수 있습니다.)`);
        }
    };


    return (
        <div className="p-6 bg-white rounded-2xl shadow-xl border border-gray-200 min-h-screen">
            <h2 className="text-3xl font-bold text-teal-600 mb-6 border-b pb-2">사용자 관리 대시보드</h2>

            {error && <p className="text-red-500 mb-4 font-medium">{error}</p>}
            
            {/* 사용자 목록 테이블 */}
            <div className="mb-10">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">전체 사용자 목록</h3>
                {isLoading ? (
                    <div className="flex justify-center items-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-400"></div></div>
                ) : (
                    <div className="overflow-x-auto bg-gray-50 rounded-lg border border-gray-200">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">UID</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">이메일 (프로필)</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">액션</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {users.map((u) => (
                                    // 관리자 계정은 목록에서 제외 (또는 삭제 버튼 비활성화)
                                    u.email === adminEmail ? null : ( 
                                        <tr key={u.id} className="hover:bg-teal-50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">{u.id.substring(0, 10)}...</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{u.email}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                <button 
                                                    onClick={() => handleDeleteUser(u.id, u.email)}
                                                    className="text-red-600 hover:text-red-900"
                                                >
                                                    삭제 (데이터 초기화)
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* 관리자 정보 수정 섹션 */}
            <div className="p-6 bg-white rounded-xl shadow-inner border border-teal-200">
                <h3 className="text-xl font-bold text-teal-600 mb-4">관리자 계정 정보 수정</h3>
                <p className="text-sm text-gray-600 mb-4">이 섹션은 현재 로그인된 관리자 계정의 이메일 및 비밀번호를 Firebase Auth에서 직접 변경합니다.</p>
                
                {adminUpdateError && <p className="text-red-500 mb-4 font-medium">{adminUpdateError}</p>}
                
                <form onSubmit={handleAdminUpdate} className="space-y-4">
                    <div>
                        <label htmlFor="admin-email" className="block text-sm font-medium text-gray-700">새 관리자 이메일</label>
                        <input
                            id="admin-email"
                            type="email"
                            value={newAdminEmail}
                            onChange={(e) => setNewAdminEmail(e.target.value)}
                            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-teal-500 focus:border-teal-500"
                            placeholder="admin@dieter.com"
                        />
                    </div>
                    <div>
                        <label htmlFor="admin-password" className="block text-sm font-medium text-gray-700">새 관리자 비밀번호 (6자 이상)</label>
                        <input
                            id="admin-password"
                            type="password"
                            value={newAdminPassword}
                            onChange={(e) => setNewAdminPassword(e.target.value)}
                            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-teal-500 focus:border-teal-500"
                            placeholder="변경하지 않으려면 비워두세요"
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full bg-teal-600 hover:bg-teal-700 text-teal-600 font-bold py-2 px-4 rounded-lg transition-colors shadow-md disabled:opacity-50"
                        disabled={isLoading}
                    >
                        정보 수정
                    </button>
                </form>
            </div>

        </div>
    );
};

export default Manager;