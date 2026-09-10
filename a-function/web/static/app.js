const presetSelect = document.getElementById("preset");
const actorIdInput = document.getElementById("actor-id");
const runInputArea = document.getElementById("run-input");
const form = document.getElementById("run-form");
const runButton = document.getElementById("run-button");
const statusLine = document.getElementById("status-line");
const resultsPreview = document.getElementById("results-preview");
const resultsMeta = document.getElementById("results-meta");
const downloadLink = document.getElementById("download-link");
const discoveryResults = document.getElementById("discovery-results");
const discoveryDownload = document.getElementById("discovery-download");
const discoveryTable = document.getElementById("discovery-table");
const discoveryExcel = document.getElementById("discovery-excel");

const MAX_ROWS = 100;
const MAX_CELL_LENGTH = 150;

function formatCell(value) {
  if (value === undefined || value === null || value === "") return "";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return text.length > MAX_CELL_LENGTH ? text.slice(0, MAX_CELL_LENGTH) + "…" : text;
}

function safeHref(url) {
  if (typeof url !== "string") return null;
  const trimmed = url.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : null;
}

function linkCell(url, label) {
  const td = document.createElement("td");
  const href = safeHref(url);
  if (href) {
    const a = document.createElement("a");
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = label;
    td.appendChild(a);
  } else {
    td.textContent = "—";
  }
  return td;
}

function renderLeadsTable(entities) {
  resultsPreview.textContent = "";

  if (!entities.length) {
    resultsPreview.textContent = "No items returned.";
    return;
  }

  const rows = entities.slice(0, MAX_ROWS);
  const showWebsite = rows.some((e) => safeHref(e.website_url));

  const table = document.createElement("table");

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  const headers = ["Name", "Handle", "Followers", "Profile"];
  if (showWebsite) headers.push("Website");
  headers.forEach((label) => {
    const th = document.createElement("th");
    th.textContent = label;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  rows.forEach((e) => {
    const tr = document.createElement("tr");

    const nameTd = document.createElement("td");
    nameTd.textContent = e.display_name || e.handle || "—";
    tr.appendChild(nameTd);

    const handleTd = document.createElement("td");
    handleTd.textContent = e.handle || "—";
    tr.appendChild(handleTd);

    const followersTd = document.createElement("td");
    followersTd.textContent = typeof e.follower_count === "number" ? e.follower_count.toLocaleString() : "—";
    tr.appendChild(followersTd);

    tr.appendChild(linkCell(e.source_url, "View profile ↗"));
    if (showWebsite) tr.appendChild(linkCell(e.website_url, "Website ↗"));

    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  resultsPreview.appendChild(table);

  resultsMeta.textContent =
    entities.length > MAX_ROWS
      ? `Showing ${MAX_ROWS} of ${entities.length} people (download for the full set).`
      : `${entities.length} ${entities.length === 1 ? "person" : "people"}.`;
}

function renderTable(items) {
  resultsPreview.textContent = "";

  if (!items.length) {
    resultsPreview.textContent = "No items returned.";
    return;
  }

  const rows = items.slice(0, MAX_ROWS);
  const columns = [];
  const seen = new Set();
  rows.forEach((item) => {
    Object.keys(item).forEach((key) => {
      if (!seen.has(key)) {
        seen.add(key);
        columns.push(key);
      }
    });
  });

  const table = document.createElement("table");

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  columns.forEach((col) => {
    const th = document.createElement("th");
    th.textContent = col;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  rows.forEach((item) => {
    const tr = document.createElement("tr");
    columns.forEach((col) => {
      const td = document.createElement("td");
      const value = formatCell(item[col]);
      td.textContent = value;
      td.title = value;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  resultsPreview.appendChild(table);

  resultsMeta.textContent =
    items.length > MAX_ROWS
      ? `Showing ${MAX_ROWS} of ${items.length} items (download for the full set).`
      : `${items.length} item${items.length === 1 ? "" : "s"}.`;
}

const CONTACT_COLUMNS = [
  ["name", "Channel"], ["youtube", "YouTube"], ["facebook", "Facebook"],
  ["email", "Email"], ["zalo", "Zalo"], ["phone", "Phone"],
  ["tiktok", "TikTok"], ["instagram", "Instagram"], ["telegram", "Telegram"], ["x", "X"],
];

function renderContacts(contacts) {
  discoveryResults.textContent = "";
  if (!contacts.length) {
    discoveryResults.textContent = "No matching channels.";
    return;
  }
  const table = document.createElement("table");
  const head = document.createElement("tr");
  CONTACT_COLUMNS.forEach(([, label]) => {
    const th = document.createElement("th");
    th.textContent = label;
    head.appendChild(th);
  });
  const thead = document.createElement("thead");
  thead.appendChild(head);
  table.appendChild(thead);
  const body = document.createElement("tbody");
  contacts.forEach((contact) => {
    const row = document.createElement("tr");
    CONTACT_COLUMNS.forEach(([key]) => {
      const td = document.createElement("td");
      const value = contact[key] || "";
      if (value && /^https?:\/\//.test(value)) {
        const a = document.createElement("a");
        a.href = value;
        a.target = "_blank";
        a.rel = "noopener";
        a.textContent = value;
        td.appendChild(a);
      } else {
        td.textContent = value;
      }
      row.appendChild(td);
    });
    body.appendChild(row);
  });
  table.appendChild(body);
  discoveryResults.appendChild(table);
}

function renderDiscovery(items) {
  discoveryResults.textContent = "";
  if (!items.length) {
    discoveryResults.textContent = "No matching channels or groups.";
    return;
  }
  const table = document.createElement("table");
  const head = document.createElement("tr");
  ["Name", "Handle", "Followers", "Profile"].forEach((label) => {
    const th = document.createElement("th");
    th.textContent = label;
    head.appendChild(th);
  });
  const thead = document.createElement("thead");
  thead.appendChild(head);
  table.appendChild(thead);
  const body = document.createElement("tbody");
  items.forEach((item) => {
    const row = document.createElement("tr");
    const snippet = item.snippet || {};
    const stats = item.statistics || item.public_metrics || {};
    const name = snippet.title || item.name || item.title || "—";
    const handle = snippet.customUrl || item.username || "—";
    const followers = stats.subscriberCount ?? stats.followers_count ?? item.participants_count ?? "—";
    [name, handle, Number(followers).toLocaleString()].forEach((value) => {
      const td = document.createElement("td");
      td.textContent = value;
      row.appendChild(td);
    });
    const profile = item.id && item.kind === "youtube#channel"
      ? `https://www.youtube.com/channel/${item.id}`
      : item.public_metrics && item.username ? `https://x.com/${item.username}`
      : item.username ? `https://t.me/${item.username}` : null;
    row.appendChild(linkCell(profile, "View ↗"));
    body.appendChild(row);
  });
  table.appendChild(body);
  discoveryResults.appendChild(table);
}

document.querySelectorAll(".discovery-form").forEach((discoveryForm) => {
  discoveryForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = discoveryForm.querySelector("button");
    const status = discoveryForm.querySelector(".tool-status");
    const source = discoveryForm.dataset.source;
    const keyword = discoveryForm.elements.keyword.value.trim();
    const follower = Number(discoveryForm.elements.follower.value || 0);
    const followerMaxRaw = discoveryForm.elements.follower_max?.value.trim();
    const followerMax = followerMaxRaw ? Number(followerMaxRaw) : null;
    const location = discoveryForm.elements.location.value.trim();
    const maxResults = Number(discoveryForm.elements.max_results.value || 10);
    button.disabled = true;
    status.textContent = "Starting...";
    discoveryDownload.style.display = "none";
    discoveryTable.style.display = "none";
    discoveryExcel.style.display = "none";
    try {
      const payload = { source, keyword, follower, follower_max: followerMax, location, max_results: maxResults };
      if (discoveryForm.elements.exclude_seen) payload.exclude_seen = discoveryForm.elements.exclude_seen.checked;
      const response = await fetch("/api/discovery/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || response.statusText);
      const timer = setInterval(async () => {
        const poll = await fetch(`/api/status/${data.job_id}`);
        const state = await poll.json();
        status.textContent = `${state.status} - ${state.item_count} result(s)`;
        if (state.status === "SUCCEEDED" || state.status === "FAILED") {
          clearInterval(timer);
          button.disabled = false;
          if (state.status === "FAILED") {
            status.textContent = `Failed: ${state.error}`;
            return;
          }
          const result = await (await fetch(`/api/result/${data.job_id}`)).json();
          if (result.contacts) {
            renderContacts(result.contacts);
            discoveryExcel.href = `/api/discovery/${data.job_id}/export.xlsx`;
            discoveryExcel.style.display = "inline-block";
          } else {
            renderDiscovery(result.items || []);
          }
          discoveryDownload.href = `/api/download/${data.job_id}`;
          discoveryDownload.style.display = "inline-block";
          discoveryTable.href = `/api/table/${data.job_id}`;
          discoveryTable.style.display = "inline-block";
        }
      }, 1500);
    } catch (error) {
      status.textContent = `Failed: ${error.message}`;
      button.disabled = false;
    }
  });
});

let pollTimer = null;

presetSelect.addEventListener("change", () => {
  const opt = presetSelect.selectedOptions[0];
  if (!opt || !opt.value) return;
  actorIdInput.value = opt.dataset.actorId;
  runInputArea.value = JSON.stringify(JSON.parse(opt.dataset.input), null, 2);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (pollTimer) clearInterval(pollTimer);
  downloadLink.style.display = "none";
  resultsPreview.textContent = "";
  resultsMeta.textContent = "";

  let runInput;
  try {
    runInput = runInputArea.value.trim() ? JSON.parse(runInputArea.value) : {};
  } catch (err) {
    statusLine.textContent = "Run Input is not valid JSON: " + err.message;
    return;
  }

  runButton.disabled = true;
  statusLine.textContent = "Starting run...";

  try {
    const res = await fetch("/api/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actor_id: actorIdInput.value.trim(),
        run_input: runInput,
        platform: presetSelect.value || "custom",
        exclude_seen: document.getElementById("exclude-seen-apify")?.checked ?? false,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      statusLine.textContent = "Error: " + (data.error || res.statusText);
      runButton.disabled = false;
      return;
    }
    pollTimer = setInterval(() => pollStatus(data.job_id), 2000);
    pollStatus(data.job_id);
  } catch (err) {
    statusLine.textContent = "Request failed: " + err.message;
    runButton.disabled = false;
  }
});

async function pollStatus(jobId) {
  const res = await fetch(`/api/status/${jobId}`);
  const data = await res.json();
  if (!res.ok) {
    statusLine.textContent = "Error: " + (data.error || res.statusText);
    clearInterval(pollTimer);
    runButton.disabled = false;
    return;
  }

  statusLine.textContent = `Status: ${data.status} - ${data.item_count} items scraped so far`;

  if (data.status === "SUCCEEDED") {
    clearInterval(pollTimer);
    runButton.disabled = false;
    if (data.db_status) {
      statusLine.textContent += ` (${data.db_status})`;
    }
    const resultRes = await fetch(`/api/result/${jobId}`);
    const resultData = await resultRes.json();
    if (resultData.entities) {
      renderLeadsTable(resultData.entities);
    } else {
      renderTable(resultData.items);
    }
    downloadLink.href = `/api/download/${jobId}`;
    downloadLink.style.display = "inline-block";
  } else if (data.status === "FAILED") {
    clearInterval(pollTimer);
    runButton.disabled = false;
    statusLine.textContent = "Failed: " + data.error;
  }
}
