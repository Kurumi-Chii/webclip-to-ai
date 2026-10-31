// Public defaults contain no shared secret. Import a per-installation connection.json in settings.
export const HARNESS_PRESET = {
  endpoint: "http://127.0.0.1:18766/receive",
  token: "",
  headers: "{}",
  template: JSON.stringify({ text: "{{text}}" }, null, 2),
  target: "harness"
};
