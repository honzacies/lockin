/** A user-defined priority option — label + color, editable via the pencil
 * in the priority picker. Stored globally (applies across all projects). */
export interface PriorityOption {
  id: string;
  label: string;
  color: string;
}

/** Same idea as PriorityOption, for project status. */
export interface StatusOption {
  id: string;
  label: string;
  color: string;
}
