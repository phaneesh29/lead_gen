import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (!arg.startsWith("--")) {
      continue;
    }

    const key = arg.slice(2);
    const next = argv[index + 1];

    if (!next || next.startsWith("--")) {
      options[key] = true;
      continue;
    }

    options[key] = next;
    index += 1;
  }

  return options;
}

function normalizeText(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function buildHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Lead Review</title>
  <style>
    :root {
      --bg: #f4efe6;
      --panel: #fffaf2;
      --ink: #1b1a17;
      --muted: #6c655b;
      --line: #d8cdbd;
      --accent: #b85c38;
      --good: #2f6f4f;
      --warn: #8c5d1f;
      --bad: #8d3434;
      --shadow: 0 18px 40px rgba(58, 41, 27, 0.08);
    }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Georgia, "Times New Roman", serif; color: var(--ink); background: radial-gradient(circle at top left, rgba(184, 92, 56, 0.12), transparent 28%), radial-gradient(circle at top right, rgba(47, 111, 79, 0.10), transparent 24%), var(--bg); }
    .shell { max-width: 1280px; margin: 0 auto; padding: 32px 20px 56px; }
    .hero { display: grid; gap: 18px; margin-bottom: 24px; }
    .eyebrow { font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--accent); }
    h1 { margin: 0; font-size: clamp(32px, 5vw, 56px); line-height: 0.95; max-width: 720px; }
    .hero p { margin: 0; max-width: 760px; font-size: 17px; color: var(--muted); line-height: 1.6; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin: 22px 0 28px; }
    .stat, .filters, .lead-card, .detail-panel, .notice { background: var(--panel); border: 1px solid var(--line); border-radius: 18px; box-shadow: var(--shadow); }
    .stat { padding: 16px 18px; }
    .stat-label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--muted); margin-bottom: 10px; }
    .stat-value { font-size: 30px; font-weight: 700; }
    .layout { display: grid; grid-template-columns: minmax(320px, 1.2fr) minmax(320px, 0.9fr); gap: 18px; }
    .filters { padding: 16px; margin-bottom: 16px; display: grid; gap: 12px; }
    .filters-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; }
    .notice { padding: 16px; margin-bottom: 16px; display: none; gap: 10px; }
    .notice.show { display: grid; }
    label { display: grid; gap: 6px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--muted); }
    input, select, button { width: 100%; border-radius: 12px; border: 1px solid var(--line); padding: 12px 14px; background: white; color: var(--ink); font-size: 14px; }
    button { cursor: pointer; }
    .lead-list { display: grid; gap: 12px; }
    .lead-card { padding: 16px; cursor: pointer; transition: transform 160ms ease, border-color 160ms ease, background 160ms ease; }
    .lead-card:hover, .lead-card.active { transform: translateY(-2px); border-color: var(--accent); background: #fffdf8; }
    .lead-top { display: flex; justify-content: space-between; gap: 10px; align-items: flex-start; margin-bottom: 10px; }
    .lead-name { margin: 0; font-size: 20px; line-height: 1.15; }
    .lead-meta, .detail-copy, .empty-state { color: var(--muted); font-size: 14px; line-height: 1.55; }
    .badges, .email-list, .quick-links, .notice-actions { display: flex; flex-wrap: wrap; gap: 8px; }
    .badge { border-radius: 999px; padding: 6px 10px; font-size: 12px; border: 1px solid var(--line); background: white; }
    .badge.good { color: var(--good); border-color: rgba(47, 111, 79, 0.28); }
    .badge.warn { color: var(--warn); border-color: rgba(140, 93, 31, 0.28); }
    .badge.bad { color: var(--bad); border-color: rgba(141, 52, 52, 0.28); }
    .detail-panel { padding: 20px; position: sticky; top: 20px; min-height: 420px; }
    .detail-title { margin: 0 0 12px; font-size: 30px; line-height: 1.05; }
    .detail-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin: 18px 0; }
    .detail-box { border: 1px solid var(--line); border-radius: 14px; padding: 12px; background: white; }
    .detail-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--muted); margin-bottom: 6px; }
    .detail-value { font-size: 15px; line-height: 1.45; word-break: break-word; }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .quick-links { margin: 16px 0 18px; }
    .quick-link, .secondary-link { display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; padding: 10px 14px; border: 1px solid var(--line); background: white; font-size: 14px; }
    .section-title { font-size: 13px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--muted); margin: 20px 0 10px; }
    .email-item { border: 1px solid var(--line); border-radius: 14px; padding: 12px; background: white; display: grid; gap: 4px; }
    @media (max-width: 980px) { .layout { grid-template-columns: 1fr; } .detail-panel { position: static; } }
  </style>
</head>
<body>
  <div class="shell">
    <section class="hero">
      <div class="eyebrow">Local Lead Review</div>
      <h1>Bangalore Agency Prospect Desk</h1>
      <p>Share this HTML together with <code>leads.json</code>. The page will try to load the JSON automatically, and if the browser blocks local file access it lets the viewer manually pick the JSON file.</p>
    </section>
    <section class="notice" id="noticeBox">
      <div id="noticeText" class="detail-copy"></div>
      <div class="notice-actions">
        <input id="jsonPicker" type="file" accept="application/json,.json">
        <a class="secondary-link" href="./leads.json">Open leads.json</a>
      </div>
    </section>
    <section class="stats" id="stats"></section>
    <div class="layout">
      <section>
        <div class="filters">
          <div class="filters-row">
            <label>Search<input id="searchInput" type="text" placeholder="Search business, city, website, email"></label>
            <label>City<select id="cityFilter"></select></label>
            <label>Website Quality<select id="websiteFilter"><option value="all">All</option><option value="own">Own website</option><option value="third-party">Third-party / directory</option><option value="none">No website</option></select></label>
            <label>Email<select id="emailFilter"><option value="all">All</option><option value="has-email">Has email</option><option value="no-email">No email</option></select></label>
          </div>
        </div>
        <div class="lead-list" id="leadList"></div>
      </section>
      <aside class="detail-panel" id="detailPanel"><div class="empty-state">Loading leads...</div></aside>
    </div>
  </div>
  <script>
    const leadList = document.getElementById("leadList");
    const detailPanel = document.getElementById("detailPanel");
    const stats = document.getElementById("stats");
    const cityFilter = document.getElementById("cityFilter");
    const websiteFilter = document.getElementById("websiteFilter");
    const emailFilter = document.getElementById("emailFilter");
    const searchInput = document.getElementById("searchInput");
    const noticeBox = document.getElementById("noticeBox");
    const noticeText = document.getElementById("noticeText");
    const jsonPicker = document.getElementById("jsonPicker");
    let payload = { leads: [] };
    let allLeads = [];
    let selectedLeadId = null;

    function escapeHtml(value) {
      return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function showNotice(message) {
      noticeText.textContent = message;
      noticeBox.classList.add("show");
    }

    function hideNotice() {
      noticeBox.classList.remove("show");
      noticeText.textContent = "";
    }

    function uniqueCities(leads) {
      return Array.from(new Set(leads.map(function (lead) { return lead.city; }).filter(Boolean))).sort(function (a, b) { return a.localeCompare(b); });
    }

    function badgeMarkup(text, tone) {
      return '<span class="badge ' + (tone || '') + '">' + escapeHtml(text) + '</span>';
    }

    function formatBadges(lead) {
      const badges = [];
      badges.push(badgeMarkup(lead.hasOwnWebsite ? 'Own website' : lead.website ? 'Third-party site' : 'No website', lead.hasOwnWebsite ? 'good' : lead.website ? 'warn' : 'bad'));
      badges.push(badgeMarkup(lead.primaryEmail ? 'Email found' : 'No email', lead.primaryEmail ? 'good' : 'bad'));
      badges.push(badgeMarkup(lead.leadStatus || 'new'));
      badges.push(badgeMarkup(lead.enrichmentStatus || 'pending'));
      return badges.join('');
    }

    function filteredLeads() {
      const query = searchInput.value.trim().toLowerCase();
      const city = cityFilter.value;
      const website = websiteFilter.value;
      const email = emailFilter.value;

      return allLeads.filter(function (lead) {
        if (city !== 'all' && lead.city !== city) return false;
        if (website === 'own' && !lead.hasOwnWebsite) return false;
        if (website === 'third-party' && (!lead.website || lead.hasOwnWebsite)) return false;
        if (website === 'none' && lead.website) return false;
        if (email === 'has-email' && !lead.primaryEmail) return false;
        if (email === 'no-email' && lead.primaryEmail) return false;
        if (!query) return true;

        const haystack = [lead.name, lead.city, lead.category, lead.website, lead.phone, lead.primaryEmail && lead.primaryEmail.email]
          .concat((lead.emails || []).map(function (entry) { return entry.email; }))
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return haystack.includes(query);
      });
    }

    function renderStats(leads) {
      const cards = [
        ['Total leads', leads.length],
        ['Own website', leads.filter(function (lead) { return lead.hasOwnWebsite; }).length],
        ['With email', leads.filter(function (lead) { return lead.primaryEmail; }).length],
        ['No website', leads.filter(function (lead) { return !lead.website; }).length]
      ];

      stats.innerHTML = cards.map(function (card) {
        return '<article class="stat"><div class="stat-label">' + escapeHtml(card[0]) + '</div><div class="stat-value">' + escapeHtml(card[1]) + '</div></article>';
      }).join('');
    }

    function renderDetail(lead) {
      if (!lead) {
        detailPanel.innerHTML = '<div class="empty-state">No lead selected.</div>';
        return;
      }

      const emailItems = !lead.emails || !lead.emails.length
        ? '<div class="empty-state">No extracted emails yet.</div>'
        : lead.emails.map(function (entry) {
            return '<div class="email-item">'
              + '<a href="mailto:' + entry.email + '">' + escapeHtml(entry.email) + '</a>'
              + '<div class="detail-copy">Confidence: ' + escapeHtml(entry.confidence ?? 'n/a') + ' • ' + escapeHtml(entry.sourceType || 'website') + '</div>'
              + (entry.sourceUrl ? '<div class="detail-copy"><a href="' + entry.sourceUrl + '" target="_blank" rel="noreferrer">Source page</a></div>' : '')
              + '</div>';
          }).join('');

      const quickLinks = [
        lead.primaryEmail ? '<a class="quick-link" href="mailto:' + lead.primaryEmail.email + '">Email primary contact</a>' : '',
        lead.phone ? '<a class="quick-link" href="tel:' + lead.phone.replace(/\s+/g, '') + '">Call business</a>' : '',
        lead.website ? '<a class="quick-link" href="' + lead.website + '" target="_blank" rel="noreferrer">Open website</a>' : '',
        lead.mapsUrl ? '<a class="quick-link" href="' + lead.mapsUrl + '" target="_blank" rel="noreferrer">Open Maps</a>' : ''
      ].join('');

      detailPanel.innerHTML = ''
        + '<div class="eyebrow">Lead #' + escapeHtml(lead.id) + '</div>'
        + '<h2 class="detail-title">' + escapeHtml(lead.name) + '</h2>'
        + '<div class="detail-copy">' + escapeHtml((lead.city || 'Unknown city') + (lead.category ? ' • ' + lead.category : '')) + '</div>'
        + '<div class="quick-links">' + quickLinks + '</div>'
        + '<div class="badges">' + formatBadges(lead) + '</div>'
        + '<div class="detail-grid">'
        + '<div class="detail-box"><div class="detail-label">Phone</div><div class="detail-value">' + escapeHtml(lead.phone || '-') + '</div></div>'
        + '<div class="detail-box"><div class="detail-label">Website</div><div class="detail-value">' + (lead.website ? '<a href="' + lead.website + '" target="_blank" rel="noreferrer">' + escapeHtml(lead.website) + '</a>' : '-') + '</div></div>'
        + '<div class="detail-box"><div class="detail-label">Primary Email</div><div class="detail-value">' + (lead.primaryEmail ? '<a href="mailto:' + lead.primaryEmail.email + '">' + escapeHtml(lead.primaryEmail.email) + '</a>' : '-') + '</div></div>'
        + '<div class="detail-box"><div class="detail-label">Address</div><div class="detail-value">' + escapeHtml(lead.address || '-') + '</div></div>'
        + '</div>'
        + '<div class="section-title">All Emails</div>'
        + '<div class="email-list">' + emailItems + '</div>'
        + '<div class="section-title">Notes</div>'
        + '<div class="detail-copy">' + escapeHtml(lead.notes || 'No notes yet.') + '</div>';
    }

    function renderList(leads) {
      if (!leads.length) {
        leadList.innerHTML = '<div class="empty-state">No leads matched the current filters.</div>';
        detailPanel.innerHTML = '<div class="empty-state">No lead selected.</div>';
        return;
      }

      if (!leads.some(function (lead) { return lead.id === selectedLeadId; })) {
        selectedLeadId = leads[0].id;
      }

      leadList.innerHTML = leads.map(function (lead) {
        return ''
          + '<article class="lead-card ' + (lead.id === selectedLeadId ? 'active' : '') + '" data-id="' + lead.id + '">'
          + '<div class="lead-top"><div><h2 class="lead-name">' + escapeHtml(lead.name) + '</h2><div class="lead-meta">' + escapeHtml((lead.city || 'Unknown city') + (lead.category ? ' • ' + lead.category : '')) + '</div></div>'
          + (lead.rating ? '<div class="badge good">' + escapeHtml(lead.rating) + ' rating</div>' : '')
          + '</div>'
          + '<div class="badges">' + formatBadges(lead) + '</div>'
          + '<p class="lead-meta">' + escapeHtml((lead.primaryEmail && lead.primaryEmail.email) || lead.phone || lead.website || 'No direct contact found yet') + '</p>'
          + '</article>';
      }).join('');

      Array.from(leadList.querySelectorAll('.lead-card')).forEach(function (card) {
        card.addEventListener('click', function () {
          selectedLeadId = Number(card.dataset.id);
          render();
        });
      });

      const selected = leads.find(function (lead) { return lead.id === selectedLeadId; });
      renderDetail(selected);
    }

    function render() {
      const leads = filteredLeads();
      renderStats(leads);
      renderList(leads);
    }

    function initFilters() {
      cityFilter.innerHTML = ['<option value="all">All cities</option>']
        .concat(uniqueCities(allLeads).map(function (city) { return '<option value="' + city + '">' + escapeHtml(city) + '</option>'; }))
        .join('');

      [searchInput, cityFilter, websiteFilter, emailFilter].forEach(function (element) {
        element.addEventListener('input', render);
        element.addEventListener('change', render);
      });
    }

    function applyPayload(nextPayload) {
      payload = nextPayload || { leads: [] };
      allLeads = payload.leads || [];
      selectedLeadId = allLeads[0] ? allLeads[0].id : null;
      initFilters();
      render();
    }

    async function loadRelativeJson() {
      const response = await fetch('./leads.json', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Unable to load leads.json (' + response.status + ')');
      }
      return response.json();
    }

    jsonPicker.addEventListener('change', async function () {
      const file = jsonPicker.files && jsonPicker.files[0];
      if (!file) return;
      const text = await file.text();
      const nextPayload = JSON.parse(text);
      hideNotice();
      applyPayload(nextPayload);
    });

    (async function boot() {
      try {
        const nextPayload = await loadRelativeJson();
        hideNotice();
        applyPayload(nextPayload);
      } catch (error) {
        showNotice('Automatic loading of leads.json failed. If you opened this HTML directly from disk, some browsers block local fetch requests. Keep leads.html and leads.json together, then either open them through a simple local server or use the file picker here to choose leads.json manually.');
        leadList.innerHTML = '<div class="empty-state">Load leads.json to view the lead list.</div>';
        detailPanel.innerHTML = '<div class="empty-state">Choose leads.json using the picker above.</div>';
        stats.innerHTML = '';
      }
    })();
  </script>
</body>
</html>`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const outputPath = path.resolve(process.cwd(), normalizeText(args.output) ?? "data/exports/leads.html");
  const html = buildHtml();
  fs.writeFileSync(outputPath, html, "utf8");
  console.log(JSON.stringify({ outputPath }, null, 2));
}

main();
