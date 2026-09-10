export interface TodoTask {
  id: string;
  title: string;
  description: string;
  done: boolean;
}

/** A named cluster of tasks inside a to-do list, rendered as its own
 * sub-section below the list's ungrouped tasks. */
export interface TodoGroup {
  id: string;
  title: string;
  /** Emoji shown before the group title. */
  icon?: string;
  tasks: TodoTask[];
}

export function NewTodoGroup(): TodoGroup {
  return { id: `group-${Date.now()}`, title: "New group", tasks: [] };
}

export interface NoteBlock {
  id: string;
  group: "Today" | "Yesterday";
  heading: string;
  body: string;
}

export type TodoListVariant = "solid" | "transparent";

/** Color/font/size overrides for one piece of to-do list text. */
export interface TodoTextStyle {
  color?: string;
  fontFamily?: string;
  fontSize?: number;
}

export interface TodoListStyle {
  variant: TodoListVariant;
  showTitle: boolean;
  showIcon: boolean;
  showProgress: boolean;
  showDeadline: boolean;
  showDescriptions: boolean;
  checkboxColor?: string;
  iconColor?: string;
  /** The list's own heading ("My To-Do List"). */
  heading: TodoTextStyle;
  /** Each task's title line. */
  taskTitle: TodoTextStyle;
  /** Each task's description line. */
  taskDescription: TodoTextStyle;
  /** Every group header's title text, list-wide (like heading/taskTitle). */
  groupTitle: TodoTextStyle;
}

export interface TodoListConfig {
  id: string;
  title: string;
  /** Stored "YYYY-MM-DD", or null. */
  deadline: string | null;
  /** Stored "HH:mm", or null. */
  deadlineTime: string | null;
  /** Ungrouped tasks, rendered above any groups. */
  tasks: TodoTask[];
  /** Optional named groups of tasks, rendered below the ungrouped tasks. */
  groups: TodoGroup[];
  style: TodoListStyle;
}

export const DEFAULT_TODO_LIST_STYLE: TodoListStyle = {
  variant: "solid",
  showTitle: true,
  showIcon: true,
  showProgress: true,
  showDeadline: true,
  showDescriptions: true,
  heading: {},
  taskTitle: {},
  taskDescription: {},
  groupTitle: {},
};
