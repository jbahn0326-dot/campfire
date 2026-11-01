# 🔥 모닥불, 잠깐 쉬어가요

말없이 같이 불을 보는 온라인 캠핑장이에요.
링크로 들어온 사람은 누구나 모닥불 둘레에 캐릭터로 앉고, 장작 넣기·마시멜로 굽기·몸짓·별똥별 소원을 다 같이 실시간으로 봐요.

- 외부 라이브러리가 하나도 없어요. Node.js만 있으면 돌아가요 (Node 18 이상).
- 파일 구성
  - `server.js`: 실시간 서버 (접속자, 자리, 몸짓, 모두가 같이 쓰는 불 세기)
  - `public/index.html`: 게임 화면 전체
  - `public/og.png`: 카카오톡·인스타 등에 링크를 붙였을 때 보이는 미리보기 이미지
  - `public/favicon.svg`: 브라우저 탭 아이콘

---

## 1. 내 컴퓨터에서 먼저 켜보기 (선택)

1. https://nodejs.org 에서 LTS 버전을 설치해요.
2. 이 폴더에서 터미널을 열고 실행해요.
   ```
   npm start
   ```
3. 브라우저로 http://localhost:3000 에 들어가요. 창을 두 개 열면 둘이 같이 앉은 모습을 볼 수 있어요.

---

## 2. 인터넷에 올려서 링크 만들기 (Render, 무료)

### ① GitHub에 올리기
1. https://github.com 에 가입하고 로그인해요.
2. 오른쪽 위 **+** → **New repository** → 이름에 `campfire`를 적고 **Create repository**를 눌러요.
3. 다음 화면에서 **uploading an existing file** 링크를 누르고, 이 폴더 안의 파일을 **전부** 끌어다 놓아요
   (`server.js`, `package.json`, `README.md`, `public` 폴더째로). 그다음 **Commit changes**를 눌러요.

### ② Render에서 서버 켜기
1. https://render.com 에 GitHub 계정으로 가입해요.
2. **New +** → **Web Service** → 방금 만든 `campfire` 저장소를 골라요.
3. 설정은 이렇게 해요.
   | 항목 | 값 |
   |---|---|
   | Language | Node |
   | Build Command | `npm install` |
   | Start Command | `npm start` |
   | Instance Type | Free |
4. **Deploy Web Service**를 누르고 1~3분 기다려요.
5. 위쪽에 생기는 `https://campfire-xxxx.onrender.com` 주소가 바로 공유할 링크예요. 🎉

### 무료 플랜에서 알아둘 점
- 15분 동안 아무도 없으면 서버가 잠들어요. 다음 사람이 들어올 때 깨어나는 데 1분쯤 걸려요.
  누군가 앉아 있는 동안에는 잠들지 않아요.
- 항상 바로 열리게 하려면 Render 설정에서 Instance Type을 유료(Starter, 월 7달러)로 바꾸면 돼요.

### 수정하고 다시 올리기
GitHub 저장소에서 파일을 고치거나 새로 올리면 Render가 알아서 다시 배포해요.

---

## 3. 내 마음대로 바꿔보기

| 바꾸고 싶은 것 | 찾을 곳 |
|---|---|
| 제목·문구 | `public/index.html`의 `모닥불`, `잠깐 쉬어가요` 같은 글자 |
| 캐릭터 색 | `index.html`의 `COLORS` 목록 |
| 자동 이름 | `index.html`의 `ADJ`(형용사), `NOUN`(동물) 목록 |
| 몸짓 종류 | `index.html`의 `data-e` 버튼과 `BUBBLE` 목록 + `server.js`의 `ACTS` |
| 불이 꺼지는 속도 | `server.js`의 `DECAY`와 `index.html`의 `dt*0.006` (둘을 같게 맞춰요) |
| 장작 하나로 커지는 정도 | `server.js`의 `LOG_BOOST` |
| 최대 동시 접속자 | Render의 Environment에 `MAX_CLIENTS` 값 추가 (기본 300) |

화면에는 한 번에 16명까지 앉고, 그보다 많으면 "그 밖에 N명이 어둠 속에 앉아 있어요"라고 보여줘요.
