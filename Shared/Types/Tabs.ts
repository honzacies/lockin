export interface OpenDocumentTab {
  id: string;
  title: string;
  href: string;
  /** Whether this tab represents a project document — gates the Rocket
   * default icon fallback so non-project tabs (Quick Notes) keep FileText. */
  isProject?: boolean;
  /** The owning project's icon (emoji or data URL), if any. */
  icon?: string;
}
