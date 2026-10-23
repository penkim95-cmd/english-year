/**
 * User journeys through every feature of the app. Each test starts with empty
 * storage; Claude API replies and device speech come from e2e/fixtures.ts.
 */
import { readFile } from "node:fs/promises";
import { TEST_KEY, expect, lastSpoken, test } from "./fixtures";

const app = "#app";
const progress = (page: import("@playwright/test").Page) =>
  page.evaluate(
    () => JSON.parse(localStorage.getItem("eng-year-v1") ?? "{}") as Record<string, never>,
  );
const personal = (page: import("@playwright/test").Page) =>
  page.evaluate(
    () => JSON.parse(localStorage.getItem("eng-year-v1-aux") ?? "{}") as Record<string, never>,
  );

test.describe("오늘", () => {
  test("starts the course and saves settings", async ({ page }) => {
    await page.goto("/");
    await page.click('[data-action="startCourse"]');
    await expect(page.locator(app)).toContainText("시작일");

    await page.fill("#profile-name", "Sam");
    await page.click('[data-action="saveProfile"]');
    await expect(page.locator(app)).toContainText("저장했어요");

    await page.click('[data-action="setRate"][data-rate="1"]');
    expect(await lastSpoken(page)).toContain("Nice to meet you");
    await page.selectOption("#voice-select", "Daniel");
    expect(await lastSpoken(page)).toContain("This is my English voice");

    await page.selectOption("#model-select", "claude-sonnet-5");
    expect(await page.evaluate(() => localStorage.getItem("eng-year-model"))).toBe(
      "claude-sonnet-5",
    );
    await expect(page.locator(app)).toContainText("앱 버전");
  });

  test("tests the API key against Claude", async ({ page, apiCalls }) => {
    await page.goto("/");
    await page.fill("#api-key", TEST_KEY);
    await page.click('[data-action="saveKey"]');
    await page.click('[data-action="testKey"]');
    await expect(page.locator(app)).toContainText("연결 성공");
    const call = apiCalls.at(-1)!;
    expect(call.headers["authorization"] ?? call.headers["x-api-key"]).toContain(TEST_KEY);
    expect(call.model).toBe("claude-opus-5");
    expect(call.headers["anthropic-beta"]).toContain("server-side-fallback");
  });

  test("backs up and restores progress, rejecting foreign files", async ({ page }) => {
    await page.goto("/");
    await page.click('[data-action="startCourse"]');
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.click('[data-action="backup"]'),
    ]);
    const backup = await readFile((await download.path())!, "utf8");
    expect(backup).not.toContain("sk-ant");

    await page.evaluate(() => localStorage.removeItem("eng-year-v1"));
    await page.setInputFiles("#restore-file", {
      name: "backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(backup),
    });
    await expect(page.locator(app)).toContainText("복원했어요");
    expect((await progress(page)).startDate).toBeTruthy();

    await page.setInputFiles("#restore-file", {
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"app":"other"}'),
    });
    await expect(page.locator(app)).toContainText("올바른 백업 파일이 아니에요");
  });
});

test.describe("오늘의 퀘스트", () => {
  test("unlocks steps one by one as today's work is done", async ({ page }) => {
    const steps = page.locator(".qstep");
    const bar = page.locator("#quest");
    await page.goto("/");
    await expect(page.locator(app)).toContainText("오늘의 퀘스트");
    await expect(steps.nth(0)).toHaveClass(/current/);
    await expect(steps.nth(1)).toHaveClass(/locked/);
    await expect(steps.nth(2)).toHaveClass(/locked/);

    // Step 1: the lesson clip, opened straight from the quest.
    await page.click('.qstep.current [data-action="questGo"]');
    await expect(page.locator("#clip")).toBeVisible();
    for (let i = 0; i < 5; i++) await page.click('[data-clip="next"]');
    await page.click('[data-clip="done"]');
    await expect(steps.nth(0)).toHaveClass(/done/);
    await expect(steps.nth(1)).toHaveClass(/current/);
    await expect(bar).toContainText("1단계 완료");
    // 1단계 + 복습 단계(오늘 복습할 카드가 없어 자동 통과)
    await expect(page.locator(".quest .chip")).toContainText("2 / 5");

    // Step 2: "next step" lands on this week's flashcards; 15 cards finish it.
    await page.click('[data-action="questNext"]');
    await expect(page.locator('[data-tab="vocab"]')).toHaveClass(/on/);
    await expect(bar).toContainText("퀘스트 2/5");
    for (let i = 0; i < 15; i++) {
      await page.click('[data-action="answerCard"][data-known="1"]');
      if (i === 6) await expect(bar).toContainText("7 / 15장");
    }
    await expect(bar).toContainText("2단계 완료");
    await expect(bar).toContainText("다음: 3단계");

    await page.click('[data-tab="home"]');
    await expect(steps.nth(1)).toHaveClass(/done/);
    await expect(steps.nth(2)).toHaveClass(/current/);
    await expect(page.locator(".stat b").first()).toHaveText("1"); // two steps done = a study day
  });

  test("off-app steps are confirmed by hand and the quest completes", async ({ page }) => {
    await page.addInitScript(() => {
      const d = new Date();
      const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (!localStorage.getItem("eng-year-v1")) {
        localStorage.setItem(
          "eng-year-v1",
          JSON.stringify({
            startDate: day,
            activity: { [day]: { clip: 1, vocab: 15, sheet: 8, review: 10 } },
          }),
        );
      }
    });
    await page.goto("/");
    await expect(page.locator(".qstep.current")).toContainText("릴스");
    await page.click('[data-action="questManual"]');
    await expect(page.locator(app)).toContainText("오늘 퀘스트 완료");
    await expect(page.locator(".quest .chip")).toContainText("5 / 5");
  });
});

test.describe("레슨 클립", () => {
  test("narrates slides, navigates and marks the clip done", async ({ page }) => {
    await page.goto("/");
    await page.click('[data-action="openClip"]');
    const clip = page.locator("#clip");
    await expect(clip).toBeVisible();
    await expect.poll(() => lastSpoken(page)).toContain("1주차");

    await page.click('[data-clip="next"]');
    await expect(clip.locator(".bar2 span")).toContainText("2 / 6");
    await page.click('[data-clip="play"]');
    await expect(page.locator('[data-clip="play"]')).toHaveAttribute("aria-label", "재생");
    await page.click('[data-clip="mute"]');
    await expect(page.locator('[data-clip="mute"]')).toHaveText("🔇");
    await page.click('[data-clip="prev"]');
    await expect(clip.locator(".bar2 span")).toContainText("1 / 6");

    for (let i = 0; i < 4; i++) await page.click('[data-clip="next"]');
    await expect(clip).toContainText("영어로 말해 보세요");
    await page.locator('[data-clip="reveal"]').first().click();
    await expect(clip.locator(".ex .e").first()).toBeVisible();

    await page.click('[data-clip="next"]');
    await page.click('[data-clip="done"]');
    await expect(clip).toBeHidden();
    expect((await progress(page)).clips).toEqual({ "1": true });

    await page.click('[data-action="openClip"]');
    await page.keyboard.press("Escape");
    await expect(clip).toBeHidden();
  });
});

test.describe("플랜과 학습지", () => {
  test("shows all 52 weeks and opens any week", async ({ page }) => {
    await page.goto("/");
    await page.click('[data-tab="plan"]');
    await expect(page.locator(".wk")).toHaveCount(52);
    await page.click('[data-action="selectWeek"][data-week="30"]');
    await expect(page.locator(app)).toContainText("30주차");
  });

  test("grades worksheets, stage tests, dictation and speaking", async ({ page }) => {
    await page.goto("/");
    await page.click('[data-tab="sheet"]');
    await page.locator('[data-action="pickOption"][data-q="0"]').first().click();
    await expect(page.locator(".exp").first()).toBeVisible();
    await page.locator('[data-action="pickToken"]').first().click();
    await expect(page.locator('[data-action="clearTokens"]').first()).toBeVisible();

    await page.click('[data-action="sheetMode"][data-value="stage"]');
    await expect(page.locator(".q").first()).toBeVisible();
    await page.click('[data-action="sheetMode"][data-value="test"]');
    await expect(page.locator(".q")).toHaveCount(20);

    await page.click('[data-action="sheetMode"][data-value="dictation"]');
    await page.click('[data-action="dictationPlay"]');
    await page.fill("#dictation-input", await lastSpoken(page));
    await page.press("#dictation-input", "Enter");
    await expect(page.locator(".dres .ok").first()).toBeVisible();
    await expect(page.locator(".dres .no")).toHaveCount(0);
    await page.click('[data-action="dictationNext"]');
    await expect(page.locator(app)).toContainText("2 /");

    await page.click('[data-action="sheetMode"][data-value="speaking"]');
    await page.click('[data-action="speakingPlay"]');
    const sentence = await lastSpoken(page);
    await page.evaluate((s) => (window.__nextTranscript = s), sentence);
    await page.click('[data-action="speakingRecord"]');
    await expect(page.locator(app)).toContainText("100%");
  });

  test("generates an extra worksheet with AI", async ({ withKey: page }) => {
    await page.goto("/");
    await page.click('[data-tab="sheet"]');
    await page.click('[data-action="generateSheet"]');
    await expect(page.locator(app)).toContainText("Q0");
  });
});

test.describe("단어장", () => {
  test("reviews cards with spaced repetition", async ({ page }) => {
    await page.goto("/");
    await page.click('[data-tab="vocab"]');
    await page.click('[data-action="flipCard"]');
    await expect(page.locator(".flash .k")).toBeVisible();
    await page.click('[data-action="answerCard"][data-known="1"]');
    await page.click('[data-action="answerCard"][data-known="0"]');
    await expect.poll(async () => Object.keys((await progress(page)).srs ?? {})).toHaveLength(2);

    await page.click('[data-action="vocabMode"][data-value="slang"]');
    await expect
      .poll(() => page.locator('[data-action="slangCategory"]').count())
      .toBeGreaterThan(1);
  });

  test("adds heard phrases and AI word lists, then removes one", async ({ withKey: page }) => {
    await page.goto("/");
    await page.click('[data-tab="vocab"]');
    await page.click('[data-action="vocabMode"][data-value="mine"]');
    await page.fill("#add-word", "no cap");
    await page.press("#add-word", "Enter");
    await expect(page.locator(".wordlist")).toContainText("진짜로");
    await page.click('[data-action="generateWords"]');
    await expect(page.locator(".wordlist")).toContainText("mock phrase 14");
    await expect(page.locator('[data-action="removeWord"]')).toHaveCount(16);
    await page.locator('[data-action="removeWord"]').first().click();
    await expect(page.locator('[data-action="removeWord"]')).toHaveCount(15);
  });
});

test.describe("AI 대화", () => {
  test("chats with a friend, gets hints and an evaluation", async ({ withKey: page, apiCalls }) => {
    await page.goto("/");
    await page.fill("#profile-name", "Sam");
    await page.click('[data-action="saveProfile"]');
    await page.click('[data-tab="chat"]');
    await page.click('[data-action="startFriendChat"]');
    await expect(page.locator(".msg.ai")).toHaveCount(1);
    await expect(page.locator("#live")).toHaveCount(0);
    await expect(page.locator(".msg.ai .tr")).toBeVisible();
    await expect(page.locator(".msg.ai .fix")).toBeVisible();

    await page.fill("#chat-input", "I like coffee");
    await page.press("#chat-input", "Enter");
    await expect(page.locator(".msg.ai")).toHaveCount(2);
    await expect(page.locator("#live")).toHaveCount(0);
    expect(apiCalls.at(-1)!.prompt).toContain("texting with Sam");

    await page.locator('.msg.ai [data-action="saveSentence"]').first().click();
    await expect
      .poll(async () => ((await personal(page)).extra as { en: string }[] | undefined)?.length ?? 0)
      .toBe(1);

    await page.click('[data-action="suggestReplies"]');
    await expect(page.locator(".hint")).toHaveCount(3);
    await page.locator(".hint").first().click();
    await expect(page.locator("#chat-input")).toHaveValue("Nice to meet you!");
    await page.click('[data-action="sendMessage"]');
    await expect(page.locator(".msg.ai")).toHaveCount(3);
    await expect(page.locator("#live")).toHaveCount(0);

    await page.click('[data-action="evaluateChat"]');
    await expect(page.locator(".fbk")).toContainText("82점");
    await expect(page.locator(".fbk .fx")).toHaveCount(1);

    await page.click('[data-action="clearFriendChat"]');
    await expect(page.locator(app)).toContainText("한 번 더 누르면");
    await page.click('[data-action="clearFriendChat"]');
    await expect(page.locator(".msg")).toHaveCount(0);
  });

  test("voice mode sends speech and listens again after the reply", async ({ withKey: page }) => {
    await page.goto("/");
    await page.click('[data-tab="chat"]');
    await page.click('[data-action="toggleVoiceMode"]');
    await expect(page.locator(".vbar.on")).toBeVisible();
    await page.evaluate(() => (window.__nextTranscript = "I like movies"));
    await page.click('[data-action="toggleMic"]');
    await expect(page.locator(".msg.me").first()).toHaveText("I like movies");
    await expect(page.locator(".msg.ai")).toHaveCount(1);
    await expect(page.locator("#live")).toHaveCount(0);
    await expect.poll(() => lastSpoken(page)).toContain("What do you like to do?");
    await expect
      .poll(() => page.evaluate(() => window.__recognitionStarts))
      .toBeGreaterThanOrEqual(2);
  });

  test("role-plays a scene and corrects writing", async ({ withKey: page }) => {
    await page.goto("/");
    await page.click('[data-tab="chat"]');
    await page.click('[data-action="chatMode"][data-value="scene"]');
    await expect(page.locator(".mission")).toBeVisible();
    await page.fill("#chat-input", "Hello, one coffee please");
    await page.click('[data-action="sendMessage"]');
    await expect(page.locator(".msg.ai")).toHaveCount(1);
    await expect(page.locator("#live")).toHaveCount(0);
    await page.click('[data-action="resetScene"]');
    await expect(page.locator(".msg")).toHaveCount(0);

    await page.click('[data-action="chatMode"][data-value="writing"]');
    await page.fill("#writing-input", "I go to cafe yesterday");
    await page.click('[data-action="correctWriting"]');
    await expect(page.locator(app)).toContainText("지난 첨삭");
    await expect(page.locator(app)).toContainText("I went to the cafe yesterday.");
  });

  test("explains how to add a key instead of failing silently", async ({ page }) => {
    await page.goto("/");
    await page.click('[data-tab="chat"]');
    await page.click('[data-action="startFriendChat"]');
    await expect(page.locator(app)).toContainText("API 키");
  });
});

test.describe("보안과 저장", () => {
  test("ships a strict CSP and talks only to Anthropic", async ({
    withKey: page,
    externalHosts,
    apiCalls,
  }) => {
    await page.goto("/");
    const csp = await page
      .locator('meta[http-equiv="Content-Security-Policy"]')
      .getAttribute("content");
    expect(csp).toContain("script-src 'self';");
    expect(csp).toContain("connect-src 'self' https://api.anthropic.com");
    await expect(page.locator("script:not([src])")).toHaveCount(0);

    await page.click('[data-tab="chat"]');
    await page.click('[data-action="startFriendChat"]');
    await expect(page.locator(".msg.ai")).toHaveCount(1);
    await expect(page.locator("#live")).toHaveCount(0);
    expect(apiCalls.length).toBeGreaterThan(0);
    expect(externalHosts.filter((host) => host !== "api.anthropic.com")).toEqual([]);
  });

  test("renders hostile saved data as text", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "eng-year-v1-aux",
        JSON.stringify({
          friends: {
            jake: {
              msgs: [{ role: "assistant", content: '<img src=x onerror="window.hacked=1">' }],
            },
          },
        }),
      );
    });
    await page.goto("/");
    await page.click('[data-tab="chat"]');
    await expect(page.locator(".msg.ai")).toContainText("<img src=x");
    expect(await page.evaluate(() => "hacked" in window)).toBe(false);
  });

  test("remembers the last tab across reloads", async ({ page }) => {
    await page.goto("/");
    await page.click('[data-tab="vocab"]');
    await page.reload();
    await expect(page.locator('[data-tab="vocab"]')).toHaveClass(/on/);
  });
});

test.describe("오프라인 설치", () => {
  test.use({ serviceWorkers: "allow" });

  test("the first install does not reload the page under the learner", async ({ page }) => {
    let loads = 0;
    page.on("load", () => loads++);
    await page.goto("/");
    await page.click('[data-action="openClip"]');
    await expect(page.locator("#clip")).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 15000 })
      .toBe(true);
    await page.waitForTimeout(500);
    expect(loads).toBe(1);
    await expect(page.locator("#clip")).toBeVisible();
  });
});
