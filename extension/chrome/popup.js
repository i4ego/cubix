const api = globalThis.browser ?? globalThis.chrome;

document.getElementById("send").addEventListener("click", async () => {
  try {
    const api = globalThis.browser ?? globalThis.chrome;

    const field = document.getElementById("prompt");

    if (!field) {
      throw new Error("Не найдено поле #prompt в sidebar");
    }

    const text = field.value ?? field.innerText ?? "";

    if (!text.trim()) {
      throw new Error("Введите текст сообщения");
    }

    const [tab] = await api.tabs.query({
      active: true,
      currentWindow: true
    });

    if (tab?.id == null) {
      throw new Error("Не найдена активная вкладка");
    }

    const [execution] = await api.scripting.executeScript({
      target: { tabId: tab.id },
      func: sendChatGPT,
      args: [text]
    });

    const outcome = execution?.result;

    if (!outcome?.ok) {
      throw new Error(outcome?.error || "Функция не вернула результат");
    }

    console.log("Кнопка отправки ChatGPT нажата:", outcome);
  } catch (error) {
    console.error("Ошибка отправки:", error);
  }
});

function getResponses() {
  return [...document.querySelectorAll('div[data-dil-response]')]
  .map(element => element.innerText.trim());
}

async function sendChatGPT(text) {
  try {
    if (typeof text !== "string" || !text.trim()) {
      throw new Error("Пустой текст");
    }

    const selector =
      '[contenteditable="true"][role="textbox"]' +
      '[aria-label="Спросить ChatGPT"]';

    const editor = [...document.querySelectorAll(selector)]
      .find(element => element.getClientRects().length > 0);

    if (!editor) {
      throw new Error("Не найден редактор ChatGPT");
    }

    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    const normalize = value => value
      .replace(/\r\n?/g, "\n")
      .replace(/\u00a0/g, " ")
      .trim();

    editor.focus();

    // Выделяем содержимое только этого редактора.
    const range = document.createRange();
    range.selectNodeContents(editor);

    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    // Вставляем текст через механизм редактирования браузера.
    document.execCommand("insertText", false, text);

    await wait(100);

    if (normalize(editor.innerText) !== normalize(text)) {
      throw new Error("Редактор не принял вставленный текст");
    }

    const deadline = Date.now() + 10000;

    while (Date.now() < deadline) {
      if (!editor.isConnected) {
        throw new Error("Редактор заменился во время отправки");
      }

      const composer =
        editor.closest("[data-composer-body]") ||
        editor.closest("form");

      if (!composer) {
        throw new Error("Не найден контейнер поля и кнопки отправки");
      }

      const button = [...composer.querySelectorAll("button")].find(el => {
        const label = (
          el.getAttribute("aria-label") ||
          el.getAttribute("title") ||
          el.textContent ||
          ""
        ).trim();

        return el.getClientRects().length > 0 &&
          /^(Отправить|Send)(\s|$)/i.test(label) &&
          !el.matches(":disabled") &&
          el.getAttribute("aria-disabled") !== "true";
      });

      if (button) {
        if (normalize(editor.innerText) !== normalize(text)) {
          throw new Error("Текст изменился — отправка отменена");
        }

        button.click();
        return { ok: true, clicked: true };
      }

      await wait(100);
    }

    throw new Error("Текст вставлен, но доступная кнопка отправки не найдена");
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}