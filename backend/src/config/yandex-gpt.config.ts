import { registerAs } from '@nestjs/config';

/** YandexGPT (Yandex Cloud AI Studio Foundation Models) credentials — used to generate AI-text
 * placeholder content from questionnaire answers. Until these are set, `AiTextGenerationService`
 * skips generation entirely (best-effort — never blocks saving a questionnaire answer). Chosen
 * over Anthropic/OpenAI because the site must run inside Russia. */
export const yandexGptConfig = registerAs('yandexGpt', () => ({
  apiKey: process.env.YANDEX_GPT_API_KEY,
  folderId: process.env.YANDEX_GPT_FOLDER_ID,
  model: process.env.YANDEX_GPT_MODEL ?? 'yandexgpt-lite/latest',
  apiUrl:
    process.env.YANDEX_GPT_API_URL ??
    'https://llm.api.cloud.yandex.net/foundationModels/v1/completion',
}));
