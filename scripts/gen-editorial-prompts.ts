/**
 * Generates an INTERVIEW SHEET for a tour's voiceover editorial.
 *
 * WHY THIS IS A LOCAL SCRIPT AND NOT A FEATURE. Wanderlust ships no
 * AI-generated content to learners — that is a stated differentiator, not a
 * limitation. STYLE_GUIDE's exception covers AI-assisted code, tests and dev
 * scaffolding: the authoring process, not the shipped product. A runtime LLM
 * feature would fall outside it, because anything a model emits at runtime
 * reaches a visitor. A script BAM runs on his own machine, whose output is a
 * list of questions he answers in his own voice, is squarely inside it.
 *
 * Two structural safeguards rather than good intentions:
 *
 *   1. This file has NO write path to the database. It imports read queries
 *      only, so it cannot put generated text into a publishable field even by
 *      mistake.
 *   2. Output goes to plans/editorial/, which is gitignored and outside every
 *      publishable path.
 *
 * THE OUTPUT CONTRACT. Questions and angles only — never a sentence of
 * narration, never a beat sheet, never suggested wording. The whole value is
 * that BAM's voice stays his. A model that helpfully drafts a line has
 * defeated the point, so the system prompt forbids it and the run prints a
 * warning when the output looks like prose it should not be.
 *
 * Usage:
 *   pnpm editorial:prompts --destination <slug>
 *   pnpm editorial:prompts --destination <slug> --dry-run   (no API call)
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { getDestinationBySlug } from "@/db/queries/destinations";
import { listScenesForDestination } from "@/db/queries/scenes";
import { listHotspotsForScene, listLinksForDestination } from "@/db/queries/hotspots";
import { listHuntsForDestination, listStopsForHunt } from "@/db/queries/hunts";
import { descriptionPlainText } from "@/lib/description-markdown-core";
import { analyzeTourGraph } from "@/lib/tour-graph";
import { findNarrativeLines } from "@/lib/editorial-contract";

const MODEL = "claude-opus-5";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const hasFlag = (name: string) => process.argv.includes(`--${name}`);

/**
 * The brief handed to the model.
 *
 * Deliberately built from the RAW queries rather than `assembleTour` alone.
 * assembleTour is lossy for this purpose: it drops scenes whose media is not
 * ready, drops links with no placed arrow, and discards scene `status` and
 * coordinates. Every one of those is editorially interesting — an unplaced
 * link is a connection the creator meant to make, and a draft scene is
 * usually the one they are unsure how to talk about.
 */
async function buildBrief(slug: string) {
  const destination = await getDestinationBySlug(slug);
  if (!destination) throw new Error(`No destination with slug "${slug}".`);

  const scenes = await listScenesForDestination(destination.id);
  const links = await listLinksForDestination(destination.id);
  const hunts = await listHuntsForDestination(destination.id);

  const hotspotsByScene = new Map(
    await Promise.all(
      scenes.map(
        async (s) => [s.id, await listHotspotsForScene(s.id)] as const,
      ),
    ),
  );

  const huntsWithStops = await Promise.all(
    hunts.map(async (h) => ({ hunt: h, stops: await listStopsForHunt(h.id) })),
  );

  // Same fallback assemble-tour uses, so the graph analysis describes the tour
  // a visitor actually walks rather than a different one.
  const startSceneId =
    (destination.defaultStartSceneId &&
      scenes.some((s) => s.id === destination.defaultStartSceneId) &&
      destination.defaultStartSceneId) ||
    scenes[0]?.id ||
    null;

  const graph = analyzeTourGraph({
    sceneIds: scenes.map((s) => s.id),
    links: links.map((l) => ({
      fromSceneId: l.fromSceneId,
      toSceneId: l.toSceneId,
      placed: l.yaw !== null && l.pitch !== null,
    })),
    startSceneId,
  });

  // Markdown rendered flat first: raw markdown makes the model comment on
  // syntax, and the description is written in a textarea so it carries
  // newlines and stray formatting.
  const description = destination.description
    ? await descriptionPlainText(destination.description)
    : null;

  return {
    destination: {
      name: destination.name,
      slug: destination.slug,
      city: destination.city,
      country: destination.country,
      description,
      hasCoordinates: destination.lat !== null && destination.lng !== null,
    },
    scenes: scenes.map((s) => {
      const stats = graph.get(s.id);
      return {
        name: s.name,
        status: s.status,
        isStart: s.id === startSceneId,
        // Editorially useful, and invisible in assembleTour's output.
        isDeadEnd: stats?.isDeadEnd ?? false,
        isOrphan: stats?.isOrphan ?? false,
        isUnreachable: stats?.isUnreachable ?? false,
        unplacedLinks: stats?.needsPlacement ?? 0,
        leadsTo: links
          .filter((l) => l.fromSceneId === s.id)
          .map((l) => scenes.find((x) => x.id === l.toSceneId)?.name ?? "(unknown)"),
        hotspots: (hotspotsByScene.get(s.id) ?? []).map((h) => ({
          title: h.title,
          kind: h.targetDestinationId ? "cross_tour" : h.externalUrl ? "external" : "content",
        })),
      };
    }),
    hunts: huntsWithStops.map(({ hunt, stops }) => ({
      title: hunt.title,
      stops: stops.map((s) => ({
        title: s.title,
        sceneName: s.sceneName,
        // The clue is the creator's own writing and the best single hint at
        // the tone they already reach for.
        clue: s.clue,
      })),
    })),
  };
}

const SYSTEM = `You prepare INTERVIEW SHEETS for a documentary narrator.

The narrator is the person who photographed these places. He is going to record
a voiceover in his own voice. Your job is to help him find what he wants to say
— never to say it for him.

ABSOLUTE CONSTRAINTS. Breaking any of these makes the output worthless:

- Write NO narration. Not a line, not a fragment, not an example, not "something
  like...". No suggested wording of any kind.
- Write NO beat sheet, NO script outline, NO structure for the piece.
- Do not describe what the places are like. You have not seen them; he has.
  Descriptions from you are invention, and invention is the one thing this
  project refuses to ship.
- Do not tell him what a visitor will feel. Ask him what he noticed.

WHAT TO PRODUCE. For each scene, a small number of questions worth answering
out loud, drawn from what is actually in the data you are given:

- What is worth noticing here that a photograph does not carry — sound, smell,
  temperature, who else was present, what it took to get the shot.
- What a visitor standing in this spot would want to ask.
- What the move to the next scene has to carry, given where it leads.
- What he personally remembers about being here.

Prefer few sharp questions to many generic ones. A question that could be asked
of any place is a wasted line — if the data does not give you something specific
for a scene, say so plainly and move on rather than padding.

Where the data shows something structurally odd — a dead end, an unreachable
scene, a link with no arrow placed, a draft scene — raise it as an editorial
question ("this scene is a dead end: is that the ending, or unfinished?").
These are usually the most useful lines on the sheet.

FORMAT. Markdown. A short section per scene, using the scene's name as the
heading. Questions as a bulleted list. No preamble, no closing summary.`;

async function main() {
  const slug = arg("destination");
  if (!slug) {
    console.error("Usage: pnpm editorial:prompts --destination <slug> [--dry-run]");
    process.exit(1);
  }

  const brief = await buildBrief(slug);
  console.log(
    `Brief for "${brief.destination.name}": ${brief.scenes.length} scenes, ${brief.hunts.length} hunt(s).`,
  );

  const outPath = path.join(process.cwd(), "plans", "editorial", `${slug}.md`);

  if (hasFlag("dry-run")) {
    // Lets the brief be inspected without spending a call — and without an API
    // key, which is the point: this must be runnable by someone checking what
    // would be sent before anything is sent.
    await mkdir(path.dirname(outPath), { recursive: true });
    const debugPath = outPath.replace(/\.md$/, ".brief.json");
    await writeFile(debugPath, JSON.stringify(brief, null, 2));
    console.log(`Dry run — no API call. Brief written to ${debugPath}`);
    return;
  }

  const client = new Anthropic();
  // Streamed: a sheet for a fourteen-scene tour is long enough to risk an HTTP
  // timeout on a non-streaming call.
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 32000,
    system: SYSTEM,
    thinking: { type: "adaptive" },
    messages: [
      {
        role: "user",
        content:
          `Prepare the interview sheet for this tour.\n\n` +
          `\`\`\`json\n${JSON.stringify(brief, null, 2)}\n\`\`\``,
      },
    ],
  });
  const message = await stream.finalMessage();

  if (message.stop_reason === "refusal") {
    console.error("The model declined this request.", message.stop_details);
    process.exit(1);
  }

  const markdown = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  if (!markdown) {
    console.error("No text came back. Nothing written.");
    process.exit(1);
  }

  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(
    outPath,
    `<!--\nInterview sheet for "${brief.destination.name}".\n` +
      `Generated by scripts/gen-editorial-prompts.ts. Questions only — if any line\n` +
      `here reads as narration, the system prompt is wrong. Fix it before\n` +
      `generating anything else.\n-->\n\n# ${brief.destination.name} — editorial questions\n\n${markdown}\n`,
  );
  console.log(`Wrote ${outPath}`);

  const warnings = findNarrativeLines(markdown);
  if (warnings.length) {
    console.warn(`\n⚠ ${warnings.length} line(s) look declarative rather than interrogative:`);
    for (const w of warnings) console.warn(`   line ${w.line}: ${w.reason}`);
    console.warn("   Read them. If they are narration, the contract has slipped.");
  }
}

void main().then(
  () => process.exit(0),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  },
);
