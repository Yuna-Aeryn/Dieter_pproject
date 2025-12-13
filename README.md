# [LINK](https://dieter01.netlify.app/)  

# 사용방법  
main은 호스팅에 사용되는 최종 브랜치이며, dev는 저희 개발 브랜치입니다  
여러분은 dev 브랜치에서 각각 본인 이름이나 역할에 대응하는 다른 브랜치를 만들어서 dev 브랜치에 pull request를 올리면, 다른 사람이 작성한 코드를 리뷰하고 merge하시면 됩니다.  
즉 (개인브랜치) -> dev (개발브랜치) -> main (최종 브랜치) 이런 구조입니다.  

# 구조 
사진+텍스트 입력 -> 모델 -> 음식명  
음식명 -> gemini -> 성분량, 성분비율, 추천음식  
 
React + TailwindCSS 기반 프론트엔드  
node.js + firebase 백엔드  
Gemini API  
백엔드 호스팅은 [Render](https://dashboard.render.com/)  
프론트엔드 호스팅은 [Netlify](https://www.netlify.com/) 사용  


# 문제점/버그/개안점  
  
### 로그인  기능  
현재 비공개 계정 로그인만 있습니다  
  
### 추천 시스템  
남은 식사 추천 시스템이 아직 없습니다  
  
### 택스트 박스  
텍스트, 이미지 혼합 입력 필요  
  
### AI 모델 

### 언어 한국어 변경 필요 
gemini도 UI도 영어로 설정되어 있
<<<<<<< HEAD
=======

### 발표
>>>>>>> 9c952f27c92a2b67552e07daebd49a05c2dd7bc1
