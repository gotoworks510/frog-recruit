const DEFAULTS = {
  apiBase: "http://localhost:3005",
  token: "",
};

document.getElementById("save").addEventListener("click", async () => {
  const apiBase = document.getElementById("apiBase").value.trim() || DEFAULTS.apiBase;
  const token = document.getElementById("token").value.trim();
  await chrome.storage.sync.set({ apiBase, token });
  document.getElementById("msg").textContent = "Saved.";
});

chrome.storage.sync.get(DEFAULTS, (cfg) => {
  document.getElementById("apiBase").value = cfg.apiBase || DEFAULTS.apiBase;
  document.getElementById("token").value = cfg.token || "";
});
