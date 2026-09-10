"use client";

import { UseTodoStore } from "@/Store/UseTodoStore";
import { TodoListView } from "./TodoListView";

interface TodoListProps {
  listId: string;
  onDelete?: () => void;
}

/** Zustand-backed wrapper around TodoListView for the Quick Notes page. */
export function TodoList({ listId, onDelete }: TodoListProps) {
  const todoList = UseTodoStore((state) => state.lists.find((l) => l.id === listId));
  const ToggleTask = UseTodoStore((state) => state.ToggleTask);
  const AddTask = UseTodoStore((state) => state.AddTask);
  const RemoveTask = UseTodoStore((state) => state.RemoveTask);
  const UpdateTask = UseTodoStore((state) => state.UpdateTask);
  const SetTitle = UseTodoStore((state) => state.SetListTitle);
  const SetDeadline = UseTodoStore((state) => state.SetListDeadline);
  const SetDeadlineTime = UseTodoStore((state) => state.SetListDeadlineTime);
  const UpdateStyle = UseTodoStore((state) => state.UpdateListStyle);
  const MoveTask = UseTodoStore((state) => state.MoveTask);
  const AddGroup = UseTodoStore((state) => state.AddGroup);
  const RemoveGroup = UseTodoStore((state) => state.RemoveGroup);
  const SetGroupTitle = UseTodoStore((state) => state.SetGroupTitle);
  const SetGroupIcon = UseTodoStore((state) => state.SetGroupIcon);

  if (!todoList) return null;

  return (
    <TodoListView
      config={todoList}
      onChangeTitle={(title) => SetTitle(listId, title)}
      onChangeDeadline={(deadline) => SetDeadline(listId, deadline)}
      onChangeDeadlineTime={(time) => SetDeadlineTime(listId, time)}
      onChangeStyle={(patch) => UpdateStyle(listId, patch)}
      onToggleTask={(taskId, groupId) => ToggleTask(listId, taskId, groupId)}
      onAddTask={(groupId) => AddTask(listId, groupId)}
      onRemoveTask={(taskId, groupId) => RemoveTask(listId, taskId, groupId)}
      onUpdateTask={(taskId, patch, groupId) => UpdateTask(listId, taskId, patch, groupId)}
      onMoveTask={(taskId, toGroupId, beforeTaskId) =>
        MoveTask(listId, taskId, toGroupId, beforeTaskId)
      }
      onAddGroup={() => AddGroup(listId)}
      onRemoveGroup={(groupId) => RemoveGroup(listId, groupId)}
      onChangeGroupTitle={(groupId, title) => SetGroupTitle(listId, groupId, title)}
      onChangeGroupIcon={(groupId, icon) => SetGroupIcon(listId, groupId, icon)}
      onDeleteList={onDelete}
    />
  );
}
