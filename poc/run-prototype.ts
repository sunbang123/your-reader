import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { aggregateForDisplay, type EmotionAnalyzer, type EmotionScores, normalize, selectHighlight } from "./core";
import { findPersonaViolations } from "./quality";

type Config = {
  prototype_version: string;
  emotion_model: string;
  generation_model: string;
  translation_model: string;
  source_language: string;
  target_language: string;
  emotion_labels: string[];
  highlight: { intensity_weight: number; theme_weight: number };
};

type Sample = {
  id: string;
  text: string;
  expected_emotions: string[];
  expected_highlight_contains: string;
};

type Pipeline = ((...args: unknown[]) => Promise<unknown>) & { dispose(): Promise<void> };
type ModelDtype = "q8" | "q4f16";
type ProgressInfo = { status: string; file?: string; progress?: number };

type PrototypeResult = {
  id: string;
  input: string;
  expected_emotions: string[];
  raw_emotions: EmotionScores;
  display_emotions: EmotionScores;
  highlight: string;
  highlight_score: number;
  highlight_match: boolean;
  comment: string;
  persona_violations: string[];
  translation: string;
  latency_seconds: { emotion_and_highlight: number; generation: number; translation: number; total: number };
};

const cliArgs = process.argv.slice(2);
const personaIndex = cliArgs.indexOf("--persona");
const persona = personaIndex >= 0 ? cliArgs[personaIndex + 1] ?? "listener" : "listener";
const sampleIndex = cliArgs.indexOf("--sample");
const selectedSample = sampleIndex >= 0 ? cliArgs[sampleIndex + 1] : undefined;
const cacheDir = join(process.cwd(), ".cache", "transformers");

const PERSONAS: Record<string, string> = {
  listener: "차분한 경청자. 글쓴이의 구체적인 문장을 짚고 감정을 판단 없이 비춰 준다.",
  penpal: "한국 문화를 일반화하거나 이국화하지 않는 다정한 외국인 펜팔. 글쓴이의 감정과 사건만 근거로 답한다.",
  librarian: "반복되는 이미지와 시간의 흐름을 짚는 밤의 사서. 작품을 평가하지 않고 조용히 반영한다.",
};

function seconds(started: number): number {
  return Number(((performance.now() - started) / 1000).toFixed(3));
}

function createProgressReporter(modelName: string) {
  const buckets = new Map<string, number>();
  return (info: ProgressInfo) => {
    const file = info.file ?? modelName;
    if (info.status === "progress" && typeof info.progress === "number") {
      const bucket = Math.floor(info.progress / 10) * 10;
      if (buckets.get(file) !== bucket) {
        buckets.set(file, bucket);
        console.log(`[download:${modelName}] ${file} ${bucket}%`);
      }
    } else if (info.status === "ready") {
      console.log(`[ready:${modelName}]`);
    }
  };
}

async function loadPipeline(task: string, model: string, dtype: ModelDtype): Promise<Pipeline> {
  const { env, pipeline } = await import("@huggingface/transformers");
  env.cacheDir = cacheDir;
  console.log(`\n[load] ${model}`);
  return await pipeline(task as never, model, {
    dtype,
    progress_callback: createProgressReporter(model),
  }) as unknown as Pipeline;
}

class TransformersEmotionAnalyzer implements EmotionAnalyzer {
  private constructor(private readonly classifier: Pipeline, private readonly labels: string[]) {}

  static async create(modelId: string, labels: string[]): Promise<TransformersEmotionAnalyzer> {
    return new TransformersEmotionAnalyzer(await loadPipeline("zero-shot-classification", modelId, "q8"), labels);
  }

  async analyze(text: string): Promise<EmotionScores> {
    const output = await this.classifier(text, this.labels, {
      multi_label: true,
      hypothesis_template: "이 글에는 {} 감정이 드러난다.",
    }) as { labels: string[]; scores: number[] };
    return Object.fromEntries(output.labels.map((label, index) => [label, output.scores[index]]));
  }

  async dispose(): Promise<void> { await this.classifier.dispose(); }
}

function buildMessages(text: string, personaId: string) {
  const role = PERSONAS[personaId] ?? PERSONAS.listener;
  return [
    {
      role: "system",
      content: `당신은 ${role}\n반드시 지킬 규칙:\n- 진단, 평가, 훈계, 해결책, 행동 권유를 하지 않는다.\n- '~하세요', '~해보세요', '~하는 건 어떨까요' 같은 권유 표현을 쓰지 않는다.\n- 글에 없는 사실을 만들거나 문화를 일반화하지 않는다.\n- 글에서 실제로 눈에 들어온 장면이나 문장을 먼저 언급한다.\n- 한국어 2~3개 짧은 문단으로만 답한다.`,
    },
    { role: "user", content: text },
  ];
}

async function generateComments(config: Config, results: PrototypeResult[]) {
  const generator = await loadPipeline("text-generation", config.generation_model, "q4f16");
  try {
    for (const result of results) {
      const started = performance.now();
      const output = await generator(buildMessages(result.input, persona), {
        max_new_tokens: 160,
        do_sample: false,
      }) as Array<{ generated_text: Array<{ content: string }> }>;
      result.comment = output[0]?.generated_text.at(-1)?.content?.trim() ?? "";
      result.persona_violations = findPersonaViolations(result.comment);
      result.latency_seconds.generation = seconds(started);
      console.log(`[generation] ${result.id}: ${result.latency_seconds.generation}s`);
    }
  } finally {
    await generator.dispose();
  }
}

async function translateEssays(config: Config, results: PrototypeResult[]) {
  const translator = await loadPipeline("translation", config.translation_model, "q8");
  try {
    for (const result of results) {
      const started = performance.now();
      const output = await translator(result.input, {
        src_lang: config.source_language,
        tgt_lang: config.target_language,
        max_new_tokens: 256,
      }) as Array<{ translation_text: string }>;
      result.translation = output[0]?.translation_text?.trim() ?? "";
      result.latency_seconds.translation = seconds(started);
      console.log(`[translation] ${result.id}: ${result.latency_seconds.translation}s`);
    }
  } finally {
    await translator.dispose();
  }
}

function renderMarkdown(report: { created_at: string; persona: string; results: PrototypeResult[]; summary: Record<string, unknown> }) {
  const rows = report.results.map((result) => `| ${result.id} | ${result.highlight_match ? "일치" : "불일치"} | ${result.latency_seconds.total}s | ${result.persona_violations.join(", ") || "없음"} |`).join("\n");
  const details = report.results.map((result) => `## ${result.id}\n\n- 하이라이트: ${result.highlight}\n- 답글: ${result.comment}\n- 번역: ${result.translation}\n- 화면 감정: ${JSON.stringify(result.display_emotions)}\n`).join("\n");
  return `# Your Reader npm 프로토타입 결과\n\n- 실행 시각: ${report.created_at}\n- 페르소나: ${report.persona}\n- 하이라이트 일치율: ${report.summary.highlight_accuracy}\n\n| 샘플 | 하이라이트 | 총 지연 | 규칙 위반 |\n| --- | --- | ---: | --- |\n${rows}\n\n${details}`;
}

async function main() {
  if (!PERSONAS[persona]) throw new Error(`지원하지 않는 persona: ${persona}`);
  const config = JSON.parse(await readFile(join("poc", "config.json"), "utf8")) as Config;
  const allSamples = JSON.parse(await readFile(join("poc", "samples.json"), "utf8")) as Sample[];
  const samples = selectedSample ? allSamples.filter((sample) => sample.id === selectedSample) : allSamples;
  if (samples.length === 0) throw new Error(`샘플을 찾을 수 없습니다: ${selectedSample}`);

  const runStarted = performance.now();
  const analyzer = await TransformersEmotionAnalyzer.create(config.emotion_model, config.emotion_labels);
  const results: PrototypeResult[] = [];
  try {
    for (const sample of samples) {
      const started = performance.now();
      const raw = normalize(await analyzer.analyze(sample.text));
      const highlight = await selectHighlight(sample.text, analyzer, config.highlight.intensity_weight, config.highlight.theme_weight);
      results.push({
        id: sample.id,
        input: sample.text,
        expected_emotions: sample.expected_emotions,
        raw_emotions: Object.fromEntries(Object.entries(raw).sort((a, b) => b[1] - a[1])),
        display_emotions: aggregateForDisplay(raw),
        highlight: highlight.sentence,
        highlight_score: highlight.score,
        highlight_match: highlight.sentence.includes(sample.expected_highlight_contains),
        comment: "",
        persona_violations: [],
        translation: "",
        latency_seconds: { emotion_and_highlight: seconds(started), generation: 0, translation: 0, total: 0 },
      });
      console.log(`[emotion] ${sample.id}: ${results.at(-1)?.latency_seconds.emotion_and_highlight}s`);
    }
  } finally {
    await analyzer.dispose();
  }

  await generateComments(config, results);
  await translateEssays(config, results);
  for (const result of results) {
    result.latency_seconds.total = Number((result.latency_seconds.emotion_and_highlight + result.latency_seconds.generation + result.latency_seconds.translation).toFixed(3));
  }

  const report = {
    created_at: new Date().toISOString(),
    prototype_version: config.prototype_version,
    runtime: `node ${process.version} / ${process.platform}-${process.arch}`,
    persona,
    models: { emotion: config.emotion_model, generation: config.generation_model, translation: config.translation_model },
    results,
    summary: {
      sample_count: results.length,
      highlight_accuracy: results.filter((result) => result.highlight_match).length / results.length,
      persona_violation_count: results.reduce((sum, result) => sum + result.persona_violations.length, 0),
      wall_clock_seconds: seconds(runStarted),
    },
  };

  const outputDir = join("poc", "results");
  await mkdir(outputDir, { recursive: true });
  await writeFile(join(outputDir, "prototype-report.json"), JSON.stringify(report, null, 2), "utf8");
  await writeFile(join(outputDir, "prototype-report.md"), renderMarkdown(report), "utf8");
  console.log(`\n${JSON.stringify(report, null, 2)}`);
  console.log(`\nSaved: ${join(outputDir, "prototype-report.json")}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
