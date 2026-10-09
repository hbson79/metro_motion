# METRO MOTION

한국어 숏폼 영상 피드와 자료 라이브러리, 관리자 스튜디오. Next.js App Router + TypeScript + Supabase Auth / PostgreSQL / Private Storage로 구현했습니다. 가짜 로그인·가짜 저장 기능은 없습니다. 환경 변수가 없으면 연결 안내를 표시하고 `/demo`에서만 명시적으로 공개 테스트 영상을 보여 줍니다.

## 실행

Node.js 20.9 이상(지원 중인 LTS 권장), npm이 필요합니다. 의존성 버전은 `package-lock.json`에 고정됩니다.

```sh
cd /Users/sonbummini/Desktop/metro_motion
npm ci
cp .env.example .env.local
# .env.local의 두 값을 실제 프로젝트 값으로 수정
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다. 환경 변수를 변경하면 개발 서버를 재시작하세요. 공개 변수는 빌드 시 번들에 포함되므로 Vercel에서는 변경 후 재배포해야 합니다.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_OR_PUBLISHABLE_KEY
```

두 번째 값은 **anon key 또는 publishable key**입니다. `service_role`, `sb_secret_...`, 데이터베이스 비밀번호는 절대 이 변수에 넣지 마세요. 공개 키의 안전성은 RLS 정책에 의존합니다. `.env.local`은 Git에서 제외됩니다. 이 앱은 서버 비밀 키를 필요로 하지 않습니다.

## Supabase 정확한 초기 설정

### 1. 스키마와 비공개 버킷

1. 새 Supabase 프로젝트를 생성합니다.
2. SQL Editor를 프로젝트 소유자 권한으로 엽니다.
3. **`supabase/migrations/001_initial.sql` 전체를 한 번 실행**합니다. 트랜잭션 안에서 아래 리소스를 생성합니다.
   - `public.admin_users`, `public.videos`, `public.documents`
   - 관리자 검사 함수, 업데이트 타임스탬프 트리거, 인덱스
   - 각 테이블의 RLS, 최소한의 명시적 grants(과도한 기본 grants를 먼저 revoke)
   - **`metro-videos`**, **`metro-documents`** 비공개 Storage 버킷과 이름 공간을 제한한 정책
4. 기존에 같은 이름의 테이블/함수/정책이 있는 프로젝트에서는 실행하지 마세요. 기존 앱을 덮어쓰거나 삭제하는 스크립트가 아닙니다. 버킷 이름도 다른 앱과 섞이지 않게 분리되어 있습니다.
5. Storage 설정의 프로젝트 전체 파일 크기 한도가 버킷 한도보다 낮으면 실제 업로드에는 더 낮은 한도가 적용됩니다. 플랜별 제한을 확인하세요. 앱은 MP4/WebM 250MiB, PDF/TXT/DOCX 20MiB 이하를 허용합니다. 큰 파일은 프로젝트 한도와 네트워크 상태에 따라 실패할 수 있으며 UI에 실제 오류가 표시됩니다. 장시간 대용량 업로드에는 TUS 기반 재개 업로드 확장을 권장합니다.

### 2. 첫 관리자 계정 생성 및 권한 부여

브라우저에서는 가입하거나 관리자 권한을 신청할 수 없습니다. 관리자 명단에 쓰는 권한 자체가 anon/authenticated에 없습니다.

1. Supabase Dashboard → **Authentication → Users → Add user → Create new user**에서 이메일과 강력한 비밀번호로 사용자를 생성합니다. 이메일 확인 상태를 확인하고, 확인이 필요하면 Dashboard의 확인 옵션 또는 정상 확인 메일 절차를 사용하세요. 비밀번호는 소스 코드나 SQL에 넣지 않습니다.
2. SQL Editor에서 아래 이메일을 **방금 만든 계정의 정확한 이메일로 교체**한 뒤 실행합니다. 사용자가 없으면 예외가 발생하고 아무 권한도 부여하지 않습니다.

```sql
do $$
declare
  target_user uuid;
begin
  select id into target_user
  from auth.users
  where lower(email) = lower('admin@your-domain.com');

  if target_user is null then
    raise exception '먼저 Authentication에서 해당 이메일 사용자를 생성하세요.';
  end if;

  insert into public.admin_users(user_id)
  values (target_user)
  on conflict (user_id) do nothing;
end $$;

-- 등록 결과 확인(프로젝트 소유자만 실행)
select u.id, u.email, a.created_at
from public.admin_users a
join auth.users u on u.id = a.user_id;
```

3. `/admin`에서 이메일/비밀번호로 로그인합니다. `signInWithPassword`의 실제 세션을 사용하고, `auth.getUser()` 및 `admin_users` 조회로 UI 접근을 확인합니다. **실제 권한 경계는 UI가 아닌 PostgreSQL / Storage RLS**입니다.
4. 로그인한 일반 사용자는 관리자 화면에 진입할 수 없고 원시 API를 직접 호출해도 업로드/수정/삭제/공개 전환이 차단됩니다.
5. 다른 관리자를 추가할 때도 SQL Editor에서 같은 절차를 사용합니다. 권한 회수는 다음과 같이 수행합니다.

```sql
delete from public.admin_users
where user_id = (select id from auth.users where lower(email)=lower('admin@your-domain.com'));
```

권한 회수 후 기존 UI가 보일 수 있어도 새 쓰기 요청은 RLS에서 거부됩니다. 사용자 계정/비밀번호 재설정은 프로젝트 관리자가 Dashboard에서 처리하세요. 운영 환경에서는 불필요한 공개 sign-up을 Authentication 설정에서 비활성화하고, 강력한 계정 정책과 공급자의 로그인 rate limit을 사용하세요.

### 3. 공개 동작 확인

- `/admin` → 새 콘텐츠 → 파일·제목·설명·카테고리 지정 → 저장. 기본은 **미공개**입니다.
- 공개 버튼을 누르면 익명 브라우저의 `/` 또는 `/documents`에 표시됩니다.
- 수정에서는 메타데이터만 수정하거나 실제 파일을 교체할 수 있습니다.
- 파일 확인은 권한 검사 후 생성한 서명 URL을 사용합니다. 문서는 다운로드로 열며 사용자 제공 HTML을 렌더링하지 않습니다.
- 삭제에는 브라우저의 명시적 확인 창이 있습니다. 메타데이터 삭제 결과가 실제 1개 행인지 확인한 후 파일을 삭제합니다.
- 실제 사용하는 환경에서 아래 운영 체크리스트를 반드시 실행하세요.

## 권한과 파일 수명

- 익명/일반 사용자는 `published=true` 행과 **그 행에 연결된 파일만** 읽을 수 있습니다.
- 관리자는 초안과 업로드 중 파일을 읽고 지정한 두 버킷에만 쓸 수 있습니다.
- 모든 버킷은 `public=false`입니다. `getPublicUrl()`을 쓰지 않습니다.
- 읽기 URL은 **300초(5분)** 동안 유효한 bearer URL입니다. URL을 발급할 때 RLS가 실행됩니다. 공개 해제는 **새 URL 발급을 즉시 차단**하지만 이미 발급된 URL이나 다운로드된 사본을 즉시 회수하지는 못합니다. 기존 URL은 만료까지 최대 5분 유효할 수 있습니다. 매우 민감한 문서는 이 구조로 배포하지 마세요. 활성 영상은 4분마다 권한을 다시 검사하고 URL을 갱신합니다.
- 브라우저 MIME / 확장자 / 크기 검사와 SQL 제약, Storage MIME / 크기 제한을 함께 사용합니다. MIME은 악의적으로 위장할 수 있으므로 **바이러스 검사나 파일 내용 검증을 대체하지 않습니다**. 업로드는 신뢰된 관리자에게만 허용하며 HTML/SVG/실행 파일은 지원하지 않습니다. 공개 전에 파일을 검수하세요.
- 외부 링크/서명 URL은 HTTPS만 허용합니다. React의 텍스트 렌더링을 사용하며 `dangerouslySetInnerHTML`을 사용하지 않습니다.

### 실패 시 정리 및 일관성

DB와 Storage는 하나의 원자적 트랜잭션이 아닙니다.

1. 생성/교체: UUID 파일 경로에 먼저 업로드 → 메타데이터 저장 → 성공 후 이전 파일 제거.
2. 메타데이터 실패: 새 파일을 보상 삭제. 기존 파일은 유지.
3. 삭제: 메타데이터 삭제 → 파일 제거. 파일 제거 실패 시 이미 목록에서 삭제됐다는 사실과 잔여 `storage_path`를 오류에 표시.
4. 파일 정리 실패는 성공처럼 숨기지 않습니다. 저장은 완료했지만 이전 파일 정리가 실패할 수 있습니다. 해당 경로를 기록하고 Dashboard → Storage에서 **다른 레코드가 참조하지 않는지 확인한 뒤** 관리자가 정리하세요.
5. 브라우저 종료/네트워크 단절 시 잔여 파일이 생길 수 있습니다. 정기적으로 버킷의 객체 경로와 테이블의 `storage_path`를 대조하고 참조가 없는 오래된 객체를 수동 정리하세요. `storage.objects`를 SQL로 직접 삭제하지 마세요(실제 객체가 삭제되지 않습니다). Storage API 또는 Dashboard를 사용하세요.

## 페이지와 조작

| 경로              | 기능                                                                   |
| ----------------- | ---------------------------------------------------------------------- |
| `/`               | 공개 영상, 수직 스크롤 스냅, 휠·터치·키보드, 검색·카테고리             |
| `/demo`           | 별도 표시된 MDN / Blender 공개 샘플, 실제 저장 목록과 분리             |
| `/documents`      | 공개 문서 검색·카테고리·정보 카드                                      |
| `/documents/[id]` | 접근 가능한 문서의 제목·설명·파일 정보·실제 서명 다운로드              |
| `/admin`          | 이메일/비밀번호 로그인, 영상/문서 업로드·수정·파일 교체·삭제·공개 전환 |

영상 조작: `↑` / `↓` 이동, `Space` 재생/일시 정지, `M` 음소거. 입력 필드와 버튼의 키보드 동작을 가로채지 않습니다. 활성 영상만 재생하며 다른 영상/다른 탭은 일시 정지됩니다. 기본 음소거, 모바일 `playsInline`, 브라우저 자동재생 차단 시 실제 재생 시작 버튼, 파일 오류 시 재시도를 제공합니다. 컨트롤에는 접근 가능한 이름, 문서에는 제목/파일 정보, 상태·오류에는 live region, 화면에는 skip link·focus 스타일·reduced-motion 대응이 있습니다.

영상의 대사에 대한 자막 관리나 트랜스코딩은 포함하지 않습니다. 운영 콘텐츠에 대사가 있다면 접근성을 위해 영상 자체에 자막을 넣고 설명에 요약을 제공하세요. 지원 형식이라도 브라우저가 해당 코덱을 지원하지 않으면 재생할 수 없습니다. MP4 H.264/AAC 또는 WebM VP8/VP9을 권장하며, 권리를 보유한 파일만 업로드하세요.

샘플 출처: MDN CC0 flower (`interactive-examples.mdn.mozilla.net`) 및 Blender Foundation Sintel / Big Buck Bunny 예고편 (`media.w3.org`). 데모는 가로 원본을 크롭해 보여 주며 원본 출처를 표시합니다. 외부 샘플의 가용성은 제3자에 달려 있습니다. Google Fonts에서 DM Sans / Noto Sans KR을 요청하며 연결이 차단되면 시스템 글꼴로 대체됩니다.

## 자동 검증

```sh
npm test                    # Vitest: 도메인·인증 폼·편집 폼·정리·RLS
npm run typecheck           # strict TypeScript
npm run build               # 실제 Next.js production build
npx playwright install chromium
npm run test:e2e            # desktop/mobile 실제 브라우저 + 공개 영상 재생 + axe
# 위에서 build한 환경 변수가 비어 있는 설정 안내 빌드 검증:
METRO_E2E_PRODUCTION=1 npm run test:e2e  # next start production 서버로 같은 검증
npm run format:check        # Prettier
npm audit
```

- 테스트를 먼저 만들고 missing-feature RED를 실행한 후 구현/회귀 GREEN을 수행한 수직 TDD 사이클을 사용했습니다. 스크롤과 하단 모바일 컨트롤 회귀도 브라우저 실패를 관찰한 뒤 고쳤습니다.
- RLS 테스트는 **PGlite의 실제 PostgreSQL 엔진**에서 마이그레이션을 실행합니다. Auth UID / Storage 테이블 최소 구조는 테스트 DB에 정의하고, anon / authenticated / admin 역할을 바꿔 공개·초안 읽기, self-grant 금지, 쓰기 금지, 공개 해제, 과도한 기본 TRUNCATE 권한 회수를 검증합니다. Supabase 관리형 HTTP/Auth/Storage 자체를 에뮬레이션하거나 실제 프로젝트 결과인 척하지 않습니다.
- 저장 보상·로그인 폼의 단위 테스트에서는 원격 경계만 테스트 더블을 사용합니다. 앱의 런타임에는 테스트 더블이 없습니다.
- Playwright는 테스트 서버의 공개 Supabase 환경 변수를 비워 **설정 안내와 별도 데모 경로**를 검사합니다. 실제 MDN 동영상의 decoded readiness, 활성 영상 하나만 재생, mute/pause/keyboard/wheel/filter, 모바일 레이아웃, axe 접근성을 검사합니다. 외부 샘플 네트워크에 접근하지 못하면 해당 테스트가 실패합니다.
- 관리형 Supabase의 실제 로그인/CRUD/서명 다운로드/익명 차단은 환경 연결 후 아래 체크리스트로 별도 검증해야 합니다. 환경 연결 전의 테스트 통과가 실제 프로젝트 연결 성공을 뜻하지는 않습니다.

## 배포: GitHub → Vercel

이 저장소 자체는 원격 생성이나 배포를 자동 실행하지 않습니다. DB 마이그레이션과 관리자 등록을 먼저 완료하세요.

```sh
cd /Users/sonbummini/Desktop/metro_motion
npm ci
npm test
npm run typecheck
npm run build
# 아직 Git 저장소가 아닌 경우에만 초기화
 git init -b main
 git add .
 git commit -m "Build Metro Motion site"
 git remote add origin https://github.com/hbson79/metro_motion.git
 git push -u origin main
```

기존 remote가 있으면 `git remote -v`로 대상 확인 후 설정하세요. `.env.local`, 비밀번호, 서버 키, test-results를 커밋하지 마세요.

1. Vercel → Add New → Project → `hbson79/metro_motion` Import.
2. Framework preset: **Next.js**, Root directory: 저장소 루트, Install: `npm ci`, Build: `npm run build`, Output directory: 기본값 유지.
3. Production / Preview / Development 환경에 두 `NEXT_PUBLIC_SUPABASE_*` 값을 설정합니다. **service_role/secret 키는 설정하지 않습니다.** 지원 중인 Node LTS(22/24 등)를 선택하세요.
4. Deploy를 실행하고 결과 URL의 홈·문서·관리자·데모를 확인합니다.
5. Supabase Authentication → URL Configuration → Site URL을 실제 Production origin으로 설정하고 필요한 Preview/Development origin만 Redirect URLs에 추가합니다. 비밀번호 로그인만 사용하는 앱이지만 이후 확인 메일/비밀번호 재설정을 위한 origin도 관리하세요.
6. 사용자 정의 도메인과 HTTPS를 연결한 뒤 아래 확인 항목을 수행합니다. 데이터베이스/스토리지 백업과 공개 콘텐츠 권리 정책은 운영자가 설정해야 합니다.

## 운영 acceptance 체크리스트

- [ ] 익명 브라우저: 공개 영상/문서만 보임, 문서 다운로드 성공.
- [ ] 관리자: 로그인/로그아웃, 영상·문서 각각 실제 업로드 → 새로고침에도 유지.
- [ ] 관리자: 메타데이터 수정, 실제 파일 교체, 공개/비공개 전환, 영구 삭제 확인.
- [ ] 미공개 행은 익명 REST select로 반환되지 않고 미공개 Storage 서명 요청이 거절됨.
- [ ] 일반 authenticated 사용자: self-grant / DB 쓰기 / Storage upload·update·delete 거절.
- [ ] 공개 해제 직후 새 서명 URL 거절. 이미 발급된 URL의 5분 만료 한계를 이해함.
- [ ] 크기 초과·허용하지 않는 MIME/확장자·DB 거절·네트워크 실패 시 실제 오류와 정리 상태 확인.
- [ ] 모바일 실제 기기에서 터치 스와이프·mute·pause·seek·하단 메뉴 확인.
- [ ] Browser console에 비밀 키/비밀번호가 노출되지 않고 공개 env만 포함됨.

## 파일 구조

```text
app/                       App Router pages, metadata, global CSS
components/                Shell, setup, shorts player, documents, admin studio
lib/domain.ts              Types, upload validation, filtering, safe URLs
lib/repository.ts          Real Supabase browser client / auth / DB / Storage operations
supabase/migrations/       Auditable SQL schema, grants, RLS, private buckets
 tests/                    Unit + PostgreSQL policy tests
 tests/e2e/                Playwright + axe checks
.env.example               Browser-safe configuration template
```
