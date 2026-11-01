# 🔥 모닥불 캠핑장

같이 걷고, 불 앞에 앉고, 이야기하는 **3D 온라인 캠핑장**이에요. 머리 큰 동물(강아지·고양이·곰·토끼·여우·판다)로 놀러 와요.
링크로 들어온 사람은 누구나 캐릭터로 캠핑장을 돌아다니고, 가까이 있는 사람과 말풍선으로 이야기해요.

## 할 수 있는 것
| 장소 | 놀이 |
|---|---|
| 🔥 모닥불 광장 | 장작 넣기(모두의 불이 같이 커져요), 마시멜로 굽기, 🍠 군고구마 묻었다 꺼내기, 🔥 불멍 모드 |
| 🥩 바비큐 그릴 | 고기 굽기 (레어 → 미디엄 → 웰던 → 숯) |
| 🌊 호숫가 | 선착장 끝에서 🎣 낚시 (황금 잉어는 아주 드물어요) |
| ⛺ 텐트촌 | 텐트에 들어가 쉬기 (빗소리만 들려요) |
| 🌌 별 언덕 | 별똥별이 떨어지면 소원 빌기 |
| 🌲 숲길 | 반딧불이 산책 |
| ♨️ 노천탕 | 물에 들어가면 몸을 담가요. 수건 얹기, 물장구, 바나나우유, 맥반석 계란 |
| 🎄 크리스마스 광장 | 장식(공·별·종·지팡이·하트·선물)을 골라 트리를 눌러 달고 한 줄 메시지 남기기. 장식을 누르면 메시지가 보여요 |
| 어디서나 | 🍺 한잔 · 🥂 건배, 🎆 불꽃 쏘기(모두에게 보여요), 🎇 손불꽃, 몸짓 7가지 |

- **이동:** 땅을 클릭(탭)하면 길을 찾아 걸어가요. 방향키/WASD도 돼요. 오른쪽 아래 지도를 눌러도 이동해요.
- **채팅:** 14m 안에 있는 사람에게만 들려요. 욕설은 ♡로 바뀌고, 링크는 막혀요. 이름을 누르면 숨기기/신고할 수 있어요.
- **날씨:** 맑음, 흐림, 비, 눈, 안개가 5~11분마다 모두에게 똑같이 바뀌어요. 비가 오면 불이 빨리 약해져요.
- **멈추면 앉기:** 통나무 의자, 벤치, 선착장 끝에 다가가 멈추면 자동으로 앉아요.

## 파일 구성
- `server.js`: 실시간 서버 (위치, 근거리 채팅, 욕설 거르기, 신고 기록, 날씨, 불 세기). 외부 라이브러리가 없어요.
- `public/index.html`: 화면 틀과 버튼
- `public/game.js`: 3D 캠핑장 전체
- `public/vendor/`: 3D 엔진 Three.js r160과 빛 번짐 효과 (MIT 라이선스)
- `public/og.png`: 카톡·인스타 링크 미리보기 이미지

---

## 배포 (Render)
GitHub 저장소에 올리면 Render가 알아서 다시 배포해요. 처음 설정은 이렇게 해요.

| 항목 | 값 |
|---|---|
| Language | Node |
| Build Command | `npm install` |
| Start Command | `npm start` |

### 환경 변수 (Render → Environment)
| 이름 | 설명 |
|---|---|
| `DONATE_URL` | 후원 링크 (예: 투네이션, 카카오페이 송금 링크, Buy Me a Coffee). `https://`로 시작하면 오른쪽 위에 ☕ 후원하기 버튼이 생겨요 |
| `MAX_CLIENTS` | 최대 동시 접속자 (기본 300) |
| `START_WEATHER` | 서버가 켜질 때 날씨 (clear, cloudy, rain, snow, fog). 테스트용 |
| `SUPABASE_URL` | 트리 장식을 영구 저장할 Supabase 프로젝트 주소 (아래 참고) |
| `SUPABASE_SERVICE_KEY` | Supabase의 비밀 키 (service_role 또는 secret 키). 절대 다른 곳에 공개하지 마세요 |

### 트리 장식 영구 저장 (Supabase, 무료)
이 설정이 없으면 장식은 서버 메모리에만 있어서, 서버가 잠들거나 다시 배포되면 사라져요.
1. https://supabase.com 에 가입하고 **New project**를 만들어요 (지역은 Seoul 또는 Tokyo).
2. 왼쪽 **SQL Editor**에서 아래를 붙여넣고 **Run**을 눌러요.
   ```sql
   create table ornaments (
     id bigint generated always as identity primary key,
     kind text not null,
     color integer not null,
     x real not null, y real not null, z real not null,
     nick text not null,
     msg text not null default '',
     created_at timestamptz not null default now()
   );
   alter table ornaments enable row level security;
   ```
3. **Project Settings → Data API**에서 Project URL을, **API Keys**에서 service_role(또는 secret) 키를 복사해요.
4. Render → Environment에 `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`로 넣고 저장해요.
5. 이상한 장식은 Supabase의 **Table Editor → ornaments**에서 그 줄을 지우면 돼요. 신고는 Render Logs에 `[장식 신고]`로 남아요.

### 신고 확인
누군가 신고하면 Render 대시보드의 **Logs**에 `[신고]`로 시작하는 줄이 남아요.

### 무료 플랜 참고
15분 동안 아무도 없으면 서버가 잠들고, 다음 사람이 들어올 때 1분쯤 걸려요. 항상 바로 열리게 하려면 Instance Type을 유료(Starter)로 바꾸면 돼요.

---

## 내 컴퓨터에서 켜보기
Node.js 18 이상을 설치한 뒤:
```
npm start
```
http://localhost:3000 에 들어가요. 창을 두 개 열면 둘이 같이 있는 모습을 볼 수 있어요.

## 바꿔보기
| 바꾸고 싶은 것 | 찾을 곳 |
|---|---|
| 욕설 단어 | `server.js`의 `BAD` 목록 |
| 채팅이 들리는 거리 | `server.js`의 `CHAT_RANGE` |
| 날씨 확률 | `server.js`의 `WEATHERS` |
| 물고기 종류·확률 | `public/game.js`의 `FISH` |
| 군고구마 익는 시간 | `public/game.js`의 `POTATO_GOOD` |
| 캐릭터 색, 자동 이름 | `public/game.js`의 `COLORS`, `ADJ`, `NOUN` |
