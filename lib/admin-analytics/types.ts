export type MetricGroup = "users" | "engagement";

export type MetricTab = "product";

export type MetricSource = "events" | "supabase";

export type RenderHint =
  | "scalars"
  | "funnel"
  | "bars"
  | "timeseries"
  | "table"
  | "matrix";

export type MetricResult = {
  columns: string[];
  rows: (string | number | null)[][];
  note?: string;
  rowMeta?: (string[] | null)[];
  cellMeta?: (string[] | null)[][];
};

export type MetricMeta = {
  key: string;
  title: string;
  description: string;
  group: MetricGroup;
  tab: MetricTab;
  source: MetricSource;
  render: RenderHint;
  windowed: boolean;
};
