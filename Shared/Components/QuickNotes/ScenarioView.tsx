"use client";

import { Button } from "@heroui/react";
import { Clapperboard, Plus, Settings, X } from "lucide-react";
import type { ScenarioBeat, ScenarioConfig, ScenarioStyle } from "@lockin/shared/Types/Scenario";
import { CountScenarioWords } from "@lockin/shared/Types/Scenario";
import { BlockSettingsPortal } from "@lockin/shared/Components/Shared/BlockSettingsPortal";
import { InlineEditable } from "@lockin/shared/Components/Shared/InlineEditable";
import { ScenarioSettingsPanel } from "./ScenarioSettingsPanel";
import { UseUiStore } from "@lockin/shared/Store/UseUiStore";
import { useBlockSettingsPortalNode } from "@lockin/shared/Components/AppShell/TodoSettingsPanelSlot";

export interface ScenarioViewProps {
  config: ScenarioConfig;
  onChangeName: (name: string) => void;
  onChangeDescription: (description: string) => void;
  onChangeStyle: (patch: Partial<ScenarioStyle>) => void;
  onAddBeat: () => void;
  onRemoveBeat: (beatId: string) => void;
  onChangeBeat: (beatId: string, patch: Partial<Pick<ScenarioBeat, "time" | "title" | "text">>) => void;
  /** Omit to hide the "Delete scenario" action in settings. */
  onDeleteScenario?: () => void;
}

function BeatRow({
  beat,
  onChange,
  onRemove,
}: {
  beat: ScenarioBeat;
  onChange: (patch: Partial<Pick<ScenarioBeat, "time" | "title" | "text">>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="group/beat flex flex-col gap-1 rounded-lg px-2 py-1.5 hover:bg-black/[0.02]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-baseline gap-2">
          {/* Both fields (and the time pill's own background) stay fully
           * invisible until the card is hovered — see InlineEditable's
           * `isEmpty` handling in TodoListView.tsx. */}
          <InlineEditable
            value={beat.time}
            onCommit={(next) => onChange({ time: next })}
            placeholder="0:00"
            className="shrink-0 rounded bg-black/[0.04] px-1.5 py-0.5 font-mono text-[12px] text-[var(--lk-text2)]"
            seamless
            seamlessBackground="rgba(0, 0, 0, 0.04)"
            seamlessRadius="0.25rem"
          />
          <InlineEditable
            value={beat.title}
            onCommit={(next) => onChange({ title: next })}
            placeholder="Add a title…"
            className="truncate text-[15px] font-semibold text-[var(--lk-ink)]"
            seamless
          />
        </div>
        <Button
          variant="ghost"
          isIconOnly
          onPress={onRemove}
          aria-label="Remove beat"
          className="h-auto w-auto shrink-0 rounded p-0.5 text-[var(--lk-faint)] opacity-0 hover:bg-black/[0.06] hover:text-[#e5484d] group-hover/beat:opacity-100"
        >
          <X size={13} strokeWidth={1.75} />
        </Button>
      </div>
      <InlineEditable
        value={beat.text}
        onCommit={(next) => onChange({ text: next })}
        placeholder="Write what they'll say…"
        className="text-[14px] leading-[22px] text-[var(--lk-ink)]/90"
        multiline
        seamless
      />
    </div>
  );
}

/**
 * Movie/video scenario block — a named script broken into timestamped beats,
 * each with a time, a title, and the actual words to say. Mirrors
 * ColorPaletteView.tsx's shape: a single `config` object owned by whatever
 * bridges it to storage.
 */
export function ScenarioView({
  config,
  onChangeName,
  onChangeDescription,
  onChangeStyle,
  onAddBeat,
  onRemoveBeat,
  onChangeBeat,
  onDeleteScenario,
}: ScenarioViewProps) {
  const { name, description, beats, style } = config;
  const wordCount = CountScenarioWords(config);
  const openBlockSettings = UseUiStore((state) => state.openBlockSettings);
  const OpenBlockSettings = UseUiStore((state) => state.OpenBlockSettings);
  const CloseBlockSettings = UseUiStore((state) => state.CloseBlockSettings);
  const settingsPortalNode = useBlockSettingsPortalNode();
  const settingsOpen =
    openBlockSettings?.kind === "scenario" && openBlockSettings.id === config.id;

  return (
    <div className="group flex w-full flex-col gap-3 rounded-2xl bg-[var(--lk-panel)] p-4">
      <div className="flex items-center justify-between">
        {style.showName ? (
          <InlineEditable
            value={name}
            onCommit={(next) => onChangeName(next || "Scenario Name")}
            placeholder="Scenario Name"
            className="text-[24px] font-medium"
            seamless
          />
        ) : (
          <span />
        )}

        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            isIconOnly
            onPress={onAddBeat}
            aria-label="Add beat"
            className="h-7 w-7 rounded-md text-[var(--lk-muted)] hover:bg-black/[0.05]"
          >
            <Plus size={16} strokeWidth={1.5} />
          </Button>
          <Button
            variant="ghost"
            isIconOnly
            aria-label="Scenario settings"
            onPress={() => (settingsOpen ? CloseBlockSettings() : OpenBlockSettings("scenario", config.id))}
            className={`h-7 w-7 rounded-md text-[var(--lk-muted)] transition-colors ${
              settingsOpen ? "bg-black/[0.06] text-[var(--lk-ink)]" : "hover:bg-black/[0.05]"
            }`}
          >
            <Settings size={16} strokeWidth={1.5} />
          </Button>
        </div>
      </div>

      <BlockSettingsPortal
        open={settingsOpen}
        portalNode={settingsPortalNode}
        title={`${name || "Scenario"} settings`}
        onClose={CloseBlockSettings}
      >
        <ScenarioSettingsPanel
          style={style}
          onChange={onChangeStyle}
          onDeleteScenario={
            onDeleteScenario
              ? () => {
                  CloseBlockSettings();
                  onDeleteScenario();
                }
              : undefined
          }
        />
      </BlockSettingsPortal>

      {style.showDescription ? (
        <InlineEditable
          value={description}
          onCommit={onChangeDescription}
          placeholder="Add a description…"
          className="text-sm text-[var(--lk-muted)]"
          multiline
          seamless
        />
      ) : null}

      {beats.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[var(--lk-line2)] py-10 text-center">
          <Clapperboard size={20} strokeWidth={1.5} className="text-[var(--lk-faint)]" />
          <p className="text-sm text-[var(--lk-muted)]">No beats yet.</p>
          <Button
            variant="ghost"
            onPress={onAddBeat}
            className="h-auto gap-1.5 rounded-lg border border-[var(--lk-line)] px-3 py-1.5 text-sm font-normal text-[var(--lk-text2)] hover:bg-black/[0.03]"
          >
            <Plus size={15} strokeWidth={1.75} />
            Add a beat
          </Button>
        </div>
      ) : (
        <div className={`flex flex-col ${style.showDividers ? "divide-y divide-[var(--lk-line)]" : ""}`}>
          {beats.map((beat) => (
            <BeatRow
              key={beat.id}
              beat={beat}
              onChange={(patch) => onChangeBeat(beat.id, patch)}
              onRemove={() => onRemoveBeat(beat.id)}
            />
          ))}
        </div>
      )}

      {style.showWordCount ? (
        <div className="flex justify-end border-t border-[var(--lk-line)] pt-2 text-xs font-medium text-[var(--lk-muted)]">
          {wordCount} {wordCount === 1 ? "word" : "words"}
        </div>
      ) : null}
    </div>
  );
}
