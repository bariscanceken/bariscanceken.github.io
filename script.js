const canvas = document.querySelector("#signalCanvas");
const ctx = canvas.getContext("2d");
let width = 0;
let height = 0;
let dots = [];
let frame = 0;

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const githubUser = "bariscanceken";

function truncateText(text, maxLength) {
  if (!text || text.length <= maxLength) {
    return text || "";
  }

  return `${text.slice(0, maxLength - 1)}…`;
}

function formatActivityDate(value) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function summarizeGithubEvent(event) {
  const repoName = event.repo?.name?.replace(`${githubUser}/`, "") || "GitHub";
  const date = formatActivityDate(event.created_at);

  if (event.type === "PushEvent" && Array.isArray(event.payload?.commits) && event.payload.commits.length > 0) {
    const commit = event.payload.commits[event.payload.commits.length - 1];
    return {
      title: `${repoName}: ${(commit.message || "Yeni commit").split("\n")[0]}`,
      meta: date
    };
  }

  if (event.type === "CreateEvent") {
    return {
      title: `${repoName}: ${event.payload.ref_type || "kaynak"} oluşturuldu`,
      meta: date
    };
  }

  if (event.type === "PullRequestEvent") {
    return {
      title: `${repoName}: pull request ${event.payload.action || "güncellendi"}`,
      meta: date
    };
  }

  if (event.type === "IssuesEvent") {
    return {
      title: `${repoName}: issue ${event.payload.action || "güncellendi"}`,
      meta: date
    };
  }

  if (event.type === "WatchEvent") {
    return {
      title: `${repoName}: yıldızlandı`,
      meta: date
    };
  }

  return null;
}

function renderActivityList(items) {
  const list = document.querySelector("#githubActivityList");

  if (!list) {
    return;
  }

  const visibleItems = items.filter(Boolean).slice(0, 3);
  list.replaceChildren();

  if (visibleItems.length === 0) {
    const item = document.createElement("li");
    item.textContent = "Public activity bulunamadı";
    list.append(item);
    return;
  }

  for (const activityItem of visibleItems) {
    const item = document.createElement("li");
    const title = document.createElement("strong");
    const meta = document.createElement("span");

    title.textContent = truncateText(activityItem.title, 58);
    meta.textContent = activityItem.meta;
    item.append(title, meta);
    list.append(item);
  }
}

async function loadGithubActivity() {
  const activity = document.querySelector("#githubActivity");
  const title = document.querySelector("#githubActivityTitle");
  const meta = document.querySelector("#githubActivityMeta");

  if (!activity || !title || !meta) {
    return;
  }

  try {
    const fetchGithub = async (url) => {
      const response = await fetch(url, {
        headers: {
          Accept: "application/vnd.github+json"
        }
      });

      if (!response.ok) {
        throw new Error("GitHub data unavailable");
      }

      return response.json();
    };

    const events = await fetchGithub(`https://api.github.com/users/${githubUser}/events/public`);
    renderActivityList(events.map(summarizeGithubEvent));
    const latestPush = events.find((event) => (
      event.type === "PushEvent"
      && event.payload
      && Array.isArray(event.payload.commits)
      && event.payload.commits.length > 0
    ));

    if (latestPush) {
      const commits = latestPush.payload.commits;
      const latestCommit = commits[commits.length - 1];
      const message = (latestCommit.message || "Son commit").split("\n")[0];
      const repoName = latestPush.repo.name.replace(`${githubUser}/`, "");

      title.textContent = truncateText(message, 48);
      meta.textContent = `${repoName} · ${formatActivityDate(latestPush.created_at)}`;
      activity.href = `https://github.com/${latestPush.repo.name}/commit/${latestCommit.sha}`;
      activity.classList.remove("is-loading", "is-error");
      activity.classList.add("is-loaded");
      return;
    }

    const repos = await fetchGithub(`https://api.github.com/users/${githubUser}/repos?sort=pushed&per_page=12`);
    const latestRepo = repos.find((repo) => !repo.fork && repo.pushed_at) || repos.find((repo) => repo.pushed_at);
    renderActivityList(repos.filter((repo) => repo.pushed_at).slice(0, 3).map((repo) => ({
      title: `${repo.name}: repo güncellendi`,
      meta: formatActivityDate(repo.pushed_at)
    })));

    if (!latestRepo) {
      throw new Error("No public repository activity");
    }

    const commits = await fetchGithub(`https://api.github.com/repos/${latestRepo.full_name}/commits?per_page=1`);
    const latestCommit = commits[0];
    const message = (latestCommit.commit.message || "Son commit").split("\n")[0];
    const date = latestCommit.commit.author.date || latestRepo.pushed_at;

    title.textContent = truncateText(message, 48);
    meta.textContent = `${latestRepo.name} · ${formatActivityDate(date)}`;
    activity.href = latestCommit.html_url || latestRepo.html_url;
    activity.classList.remove("is-loading", "is-error");
    activity.classList.add("is-loaded");
  } catch (error) {
    title.textContent = "GitHub activity alınamadı";
    meta.textContent = "Public profilini görüntüle";
    activity.classList.remove("is-loading");
    activity.classList.add("is-error");
  }
}

function resizeCanvas() {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  width = canvas.offsetWidth;
  height = canvas.offsetHeight;
  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  const count = Math.max(42, Math.floor((width * height) / 18000));
  dots = Array.from({ length: count }, (_, index) => ({
    x: (index * 97) % width,
    y: (index * 53) % height,
    speed: 0.18 + ((index % 7) * 0.035),
    phase: index * 0.43,
    radius: 1.3 + (index % 4) * 0.45
  }));
}

function drawGrid() {
  ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
  ctx.lineWidth = 1;

  for (let x = 0; x < width; x += 72) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  for (let y = 0; y < height; y += 72) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function drawSignalLine(yBase, color, amplitude, offset) {
  ctx.beginPath();
  for (let x = 0; x <= width; x += 8) {
    const wave = Math.sin((x + frame * 1.8 + offset) * 0.015) * amplitude;
    const pulse = Math.sin((x - frame * 2.8 + offset) * 0.045) * (amplitude * 0.33);
    const y = yBase + wave + pulse;
    if (x === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawContours() {
  const centerX = width * 0.73;
  const centerY = height * 0.43;

  for (let i = 0; i < 7; i += 1) {
    const radius = 72 + i * 44 + Math.sin(frame * 0.015 + i) * 5;
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radius * 1.36, radius * 0.72, -0.24, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(241, 182, 91, ${0.19 - i * 0.018})`;
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }
}

function drawDots() {
  for (const dot of dots) {
    dot.x += dot.speed;
    dot.y += Math.sin(frame * 0.01 + dot.phase) * 0.14;

    if (dot.x > width + 20) {
      dot.x = -20;
      dot.y = (dot.y + 131) % height;
    }

    ctx.beginPath();
    ctx.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(104, 208, 198, 0.56)";
    ctx.fill();
  }
}

function render() {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#101820";
  ctx.fillRect(0, 0, width, height);
  drawGrid();
  drawContours();
  drawSignalLine(height * 0.28, "rgba(104, 208, 198, 0.62)", 18, 0);
  drawSignalLine(height * 0.58, "rgba(228, 93, 68, 0.52)", 24, 120);
  drawSignalLine(height * 0.76, "rgba(217, 154, 43, 0.48)", 14, 260);
  drawDots();

  frame += 1;
  if (!prefersReducedMotion.matches) {
    requestAnimationFrame(render);
  }
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();
render();
loadGithubActivity();
