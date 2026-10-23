import { MODELS, currentModel, testConnection } from "../../ai/client";
import { errorMessage } from "../../ai/errors";
import { parseReply } from "../../ai/parse";
import { today } from "../../core/date";
import { STORAGE_KEYS, readString, writeString } from "../../core/storage";
import { FRIENDS, stageOf, weekInfo } from "../../data/curriculum";
import { dueKeys, learnedCount, slangOfTheDay } from "../../domain/dictionary";
import { streak } from "../../domain/progress";
import { RATES, englishVoices, pickVoice } from "../../speech/tts";
import type { TaskTarget } from "../../types";
import { flashLabel, numberData, type ActionHandler, type App, type Destination } from "../app";
import { avatar, header, speakButton } from "../components";
import { html, raw, type SafeHtml } from "../html";

const youtubeSearch = (q: string) =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;

/** The weekly card shared by the home and plan screens. */
export function weekCard(app: App, week: number): SafeHtml {
  const stage = stageOf(week);
  const info = weekInfo(week);
  const { clips, scores } = app.store.progress;
  const best = scores[`w${week}`];
  return html`<section class="card">
    <div class="row between">
      <h2>${week}주차</h2>
      <span class="chip st" style="background:${stage.color}">${stage.id}단계</span>
    </div>
    <p class="lead-title">${info.title}</p>
    <p class="small muted">단계 목표: ${stage.goal}</p>
    <button class="poster" data-action="openClip" data-week="${week}" style="--st:${stage.color}">
      <span class="pl" aria-hidden="true"></span>
      <span class="pt"
        ><b>${week}주차 레슨 클립 보기</b
        ><small
          >슬라이드 6장 · 약 3분 · 소리로 읽어 줘요${clips[week] ? " · ✓ 완료" : ""}</small
        ></span
      >
    </button>
    <a
      class="small muted"
      href="${youtubeSearch(info.searchQuery)}"
      target="_blank"
      rel="noopener noreferrer"
      >더 보고 싶으면 유튜브에서 찾아보기 →</a
    >
    <div class="row">
      <button class="btn sm" data-action="go" data-to="sheet" data-week="${week}">
        학습지 풀기${best !== undefined ? ` (${best}/8)` : ""}
      </button>
      <button class="btn sm" data-action="go" data-to="vocab" data-week="${week}">단어 15개</button>
      <button class="btn sm primary" data-action="go" data-to="friend">AI와 대화</button>
    </div>
  </section>`;
}

const TARGET_TO_DESTINATION: Partial<Record<TaskTarget, Destination>> = {
  clip: "clip",
  vocab: "vocab",
  review: "review",
  sheet: "sheet",
  dictation: "dictation",
  speaking: "speaking",
  friend: "friend",
  scene: "scene",
  writing: "writing",
  voice: "voice",
};

function todayCard(app: App): SafeHtml {
  const { progress, dictionary } = app.store;
  const stage = app.stage;
  const done = progress.daily[today()] ?? [];
  const due = dueKeys(dictionary, progress.srs, today()).length;
  const completed = stage.daily.filter((_, i) => done[i]).length;
  const start = progress.startDate
    ? html`<p class="small muted">
        시작일 ${progress.startDate} · 날짜에 맞춰 주차가 자동으로 넘어가요
      </p>`
    : html`<div class="note">
        시작일을 정하면 오늘이 몇 주차인지 자동으로 계산해요.
        <button class="btn sm primary" data-action="startCourse">오늘부터 시작</button>
      </div>`;
  return html`<section class="card">
    <div class="row between">
      <h2>오늘 할 일</h2>
      <span class="chip">${completed} / ${stage.daily.length} 완료</span>
    </div>
    ${start}
    ${stage.daily.map((task, i) => {
      const destination = TARGET_TO_DESTINATION[task.target];
      return html`<div class="task ${done[i] ? "done" : ""}">
        <button
          class="box"
          data-action="toggleTask"
          data-index="${i}"
          aria-label="완료 표시"
          aria-pressed="${!!done[i]}"
        >
          ${done[i] ? "✓" : ""}
        </button>
        <button class="t" data-action="toggleTask" data-index="${i}">
          ${task.label}${task.target === "review" && due ? html` <span class="chip warn">${due}개</span>` : ""}
        </button>
        <span class="min">${task.minutes}분</span>
        ${destination ? html`<button class="go" data-action="go" data-to="${destination}">하기 →</button>` : ""}
      </div>`;
    })}
    <div class="stats">
      <div class="stat"><b>${streak(progress.daily)}</b><span>연속 학습일</span></div>
      <div class="stat"><b>${learnedCount(dictionary, progress.srs)}</b><span>외운 단어</span></div>
      <div class="stat"><b>${due}</b><span>오늘 복습</span></div>
    </div>
    <p class="small muted">
      2개 이상 체크하면 그날은 공부한 날로 쳐요. '하기 →'를 누르면 바로 그 공부로 가요.
    </p>
  </section>`;
}

function slangCard(app: App): SafeHtml {
  const card = slangOfTheDay(app.store.dictionary, today());
  return html`<section class="card">
    <div class="row between">
      <h3>오늘의 슬랭</h3>
      <span class="chip">${card.tag}</span>
    </div>
    <div class="row"><span class="en big">${card.en}</span>${speakButton(card.en)}</div>
    <p><b>${card.ko}</b></p>
    <p class="small">
      <span class="en">${card.example}</span> ${speakButton(card.example)}<br /><span class="muted"
        >${card.exampleKo}</span
      >
    </p>
    <button class="btn sm" data-action="go" data-to="slang">슬랭 더 보기 →</button>
  </section>`;
}

function friendsCard(app: App): SafeHtml {
  const unlocked = FRIENDS.filter((f) => f.minStage <= Math.max(2, app.stage.id));
  return html`<section class="card">
    <h3>AI 친구</h3>
    <div class="flist">
      ${unlocked.map((f) => {
        const msgs = app.store.personal.friends[f.id]?.msgs ?? [];
        const last = msgs.at(-1);
        return html`<button class="fr" data-action="openFriend" data-friend="${f.id}">
          ${avatar(f, 36)}
          <span class="ft"
            ><b>${f.name} ${f.flag}</b
            ><small>${last ? parseReply(last.content).main.slice(0, 50) : f.job}</small></span
          >
        </button>`;
      })}
    </div>
  </section>`;
}

function profileCard(app: App): SafeHtml {
  const { profile } = app.store.personal;
  return html`<section class="card">
    <h3>👤 내 소개 (AI 친구가 참고해요)</h3>
    <label class="sr-only" for="profile-name">영어 이름</label>
    <input
      id="profile-name"
      class="field"
      maxlength="30"
      placeholder="영어 이름 (예: Kim, Sam)"
      value="${profile.name}"
    />
    <label class="sr-only" for="profile-about">하는 일·관심사</label>
    <input
      id="profile-about"
      class="field"
      maxlength="300"
      placeholder="하는 일·관심사 (예: 마케팅 일, 여행·영화 좋아함)"
      value="${profile.about}"
    />
    <div class="row">
      <button class="btn sm primary" data-action="saveProfile">저장</button
      >${app.ui.profileMessage ? html`<span class="small">${app.ui.profileMessage}</span>` : ""}
    </div>
    <span class="small muted">이 폰에만 저장돼요.</span>
  </section>`;
}

function voiceCard(app: App): SafeHtml {
  const voices = englishVoices();
  const selected = pickVoice(app.store.personal.voice)?.name;
  return html`<section class="card">
    <h3>🔊 영어 목소리·속도</h3>
    <div class="seg">
      ${RATES.map(
        (r) =>
          html`<button
            class="${app.store.personal.rate === r.value ? "on" : ""}"
            data-action="setRate"
            data-rate="${r.value}"
          >
            ${r.label}
          </button>`,
      )}
    </div>
    ${
      voices.length > 1
        ? html`<label class="sr-only" for="voice-select">목소리</label>
            <select id="voice-select" class="field">
              ${voices.map(
                (v) =>
                  html`<option value="${v.name}" ${v.name === selected ? raw("selected") : ""}>
                    ${v.name} (${v.lang})
                  </option>`,
              )}
            </select>
            <span class="small muted"
              >'Natural', 'Enhanced', 'Premium'이 붙은 목소리가 더 사람 같아요.</span
            >`
        : html`<span class="small muted">폰에 설치된 영어 목소리를 써요.</span>`
    }
  </section>`;
}

function settingsCard(app: App): SafeHtml {
  const model = currentModel();
  const ui = app.ui;
  return html`<section class="card" id="settings">
    <h3>⚙️ 설정</h3>
    <label class="label" for="api-key">Claude API 키</label>
    <div class="composer">
      <input
        id="api-key"
        class="field"
        type="password"
        autocomplete="off"
        placeholder="sk-ant-로 시작하는 키"
        value="${readString(STORAGE_KEYS.apiKey)}"
      />
      <button class="btn primary" data-action="saveKey">저장</button>
    </div>
    <span class="small muted"
      >키는 이 폰에만 저장돼요. console.anthropic.com에서 만들 수 있어요.</span
    >
    <label class="label" for="model-select">AI 모델</label>
    <select id="model-select" class="field">
      ${Object.entries(MODELS).map(
        ([id, m]) =>
          html`<option value="${id}" ${id === model ? raw("selected") : ""}>${m.label}</option>`,
      )}
    </select>
    <span class="small muted">${MODELS[model].cost} (대략적인 추정)</span>
    <div class="row">
      <button class="btn sm" data-action="testKey" ${ui.testing ? raw("disabled") : ""}>
        ${ui.testing ? "확인 중…" : "연결 확인"}
      </button>
      ${ui.testMessage ? html`<span class="small">${ui.testMessage}</span>` : ""}
    </div>
    <span class="label">학습 기록 백업</span>
    <div class="row">
      <button class="btn sm" data-action="backup">백업 파일 저장</button>
      <label class="btn sm" for="restore-file">백업에서 복원</label>
      <input id="restore-file" type="file" accept="application/json,.json" hidden />
    </div>
    ${ui.backupMessage ? html`<span class="small">${ui.backupMessage}</span>` : ""}
    <span class="small muted">앱 버전 ${__APP_VERSION__}</span>
  </section>`;
}

export function homeView(app: App): SafeHtml {
  return html`${header(app.week)} ${todayCard(app)} ${weekCard(app, app.week)} ${slangCard(app)}
    ${friendsCard(app)} ${profileCard(app)} ${voiceCard(app)} ${settingsCard(app)}
    <section class="card">
      <h3>릴스·영화 보는 법</h3>
      <p class="small">
        그냥 보면 실력이 거의 안 늘어요. <b>영어 자막</b>을 켜고, 들린 문장 하나를
        <b>멈춰서 따라 말해</b> 보세요. 인스타그램에서 <span class="en">#learnenglish</span>,
        <span class="en">#englishteacher</span> 계정을 몇 개 팔로우하면 피드가 공부 시간이 돼요.
      </p>
    </section>`;
}

const inputValue = (id: string) =>
  (document.getElementById(id) as HTMLInputElement | null)?.value.trim() ?? "";

export const homeActions: Record<string, ActionHandler> = {
  startCourse(app) {
    app.store.ensureStarted();
    app.render();
  },
  toggleTask(app, el) {
    const day = today();
    const flags = (app.store.progress.daily[day] ?? []).slice();
    const i = numberData(el, "index");
    flags[i] = !flags[i];
    app.store.progress.daily[day] = flags;
    app.store.ensureStarted();
    app.store.saveProgress();
    app.render();
  },
  go(app, el) {
    const week = el.dataset.week ? Number(el.dataset.week) : undefined;
    app.go(el.dataset.to as Destination, week);
  },
  openFriend(app, el) {
    app.openFriend(el.dataset.friend);
  },
  saveProfile(app) {
    app.store.personal.profile = {
      name: inputValue("profile-name").slice(0, 30),
      about: inputValue("profile-about").slice(0, 300),
    };
    app.store.savePersonal();
    app.ui.profileMessage = "저장했어요.";
    app.render();
  },
  setRate(app, el) {
    app.store.personal.rate = Number(el.dataset.rate);
    app.store.savePersonal();
    app.render();
    app.say("Nice to meet you. How are you today?");
  },
  saveKey(app) {
    const key = inputValue("api-key");
    writeString(STORAGE_KEYS.apiKey, key);
    app.ui.testMessage = key ? "저장했어요. '연결 확인'을 눌러 보세요." : "키를 지웠어요.";
    app.render();
  },
  testKey(app) {
    app.ui.testing = true;
    app.ui.testMessage = "";
    app.render();
    testConnection()
      .then((reply) => (app.ui.testMessage = `연결 성공! (${reply})`))
      .catch((err: unknown) => (app.ui.testMessage = errorMessage(err) || "연결 실패"))
      .finally(() => {
        app.ui.testing = false;
        app.render();
      });
  },
  backup(app, el) {
    const blob = new Blob([app.store.exportBackup()], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `english-year-backup-${today()}.json`;
    document.body.append(link);
    link.click();
    setTimeout(() => {
      URL.revokeObjectURL(link.href);
      link.remove();
    }, 1000);
    app.ui.backupMessage = "백업 파일을 저장했어요. 파일 앱이나 iCloud에 보관하세요.";
    flashLabel(el, "✓ 저장됨");
    app.render();
  },
};
