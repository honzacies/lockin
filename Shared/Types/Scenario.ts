/** One beat of a video scenario/script — a timestamp, a short label, and the
 * actual words to say (or shot/action description) for that beat. */
export interface ScenarioBeat {
  id: string;
  /** Freeform — "0:00–0:10", "0:45", whatever the writer wants. */
  time: string;
  title: string;
  text: string;
}

export interface ScenarioStyle {
  showName: boolean;
  showDescription: boolean;
  showWordCount: boolean;
  /** A divider line between each beat ("video section"). */
  showDividers: boolean;
}

export interface ScenarioConfig {
  id: string;
  name: string;
  description: string;
  beats: ScenarioBeat[];
  style: ScenarioStyle;
}

export const DEFAULT_SCENARIO_STYLE: ScenarioStyle = {
  showName: true,
  showDescription: false,
  showWordCount: true,
  showDividers: true,
};

export function NewScenarioBeat(): ScenarioBeat {
  return { id: `scenario-beat-${crypto.randomUUID()}`, time: "", title: "", text: "" };
}

/** Word count across every beat's actual script text — the "words the
 * person will say" — deliberately excludes the name/description/time/title
 * fields, since those aren't spoken. */
export function CountScenarioWords(config: ScenarioConfig): number {
  return config.beats.reduce((total, beat) => {
    const words = beat.text.trim().split(/\s+/).filter(Boolean);
    return total + words.length;
  }, 0);
}
