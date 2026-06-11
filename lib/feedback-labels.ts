// English copy for the feedback form. Shared by the main app (via i18n) and
// Drive (standalone, no I18nProvider).
export const FEEDBACK_LABELS_EN = {
  subtitle: "Bugs, ideas, anything — it goes straight to the team.",
  placeholder: "What's working, what isn't, what would you love to see…",
  emailPlaceholder: "Email (optional, if you want a reply)",
  attach: "Attach a screenshot",
  drop: "Drop an image to attach",
  removeAttachment: "Remove attachment",
  previewAlt: "Attachment preview",
  imageType: "Please choose an image file",
  imageError: "Couldn't attach that image",
  thanks: "Thanks — got it.",
  genericError: "Something went wrong",
  requestFailed: (status: number) => `Request failed (${status})`,
  close: "Close",
  cancel: "Cancel",
  sending: "Sending…",
  sent: "Sent",
  send: "Send",
  button: "Feedback",
  launcherTitle: "Send feedback — bugs, ideas, anything",
  title: "Send feedback",
} as const;

export type FeedbackLabels = {
  subtitle: string;
  placeholder: string;
  emailPlaceholder: string;
  attach: string;
  drop: string;
  removeAttachment: string;
  previewAlt: string;
  imageType: string;
  imageError: string;
  thanks: string;
  genericError: string;
  requestFailed: (status: number) => string;
  close: string;
  cancel: string;
  sending: string;
  sent: string;
  send: string;
  button: string;
  launcherTitle: string;
  title: string;
};
