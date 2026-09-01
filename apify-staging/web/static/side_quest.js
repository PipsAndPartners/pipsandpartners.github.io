const STORAGE_KEY = 'side-quest-leads';

const sampleLeads = [
  { name: 'Forex With Minh', platform: 'YouTube', profile_url: 'https://youtube.com/', country: 'Vietnam', language: 'Vietnamese', followers: '18400', engagement: '4.8', bio: 'Daily forex education, market structure and risk management.', status: 'New', note: '' },
  { name: 'Trade Room Saigon', platform: 'Facebook', profile_url: 'https://facebook.com/', country: 'Vietnam', language: 'Vietnamese', followers: '9200', engagement: '2.4', bio: 'Trading community sharing analysis and live market discussions.', status: 'Reviewed', note: 'Check whether group permits partner education.' },
  { name: 'FX Atlas', platform: 'TikTok', profile_url: 'https://tiktok.com/', country: 'Australia', language: 'English', followers: '41200', engagement: '6.1', bio: 'Short-form forex and macro explainers for new traders.', status: 'New', note: '' },
  { name: 'Chart Logic', platform: 'Instagram', profile_url: 'https://instagram.com/', country: 'Singapore', language: 'English', followers: '6700', engagement: '8.2', bio: 'Technical analysis, chart breakdowns and trading psychology.', status: 'Contacted', note: 'Follow up next week.' },
  { name: 'Crypto Daily News', platform: 'YouTube', profile_url: 'https://youtube.com/', country: 'Vietnam', language: 'Vietnamese', followers: '105000', engagement: '1.1', bio: 'General crypto news and price commentary.', status: 'New', note: '' }
];
const discoveryDemoLeads = [
  { name: 'Forex Viet Nam Academy', platform: 'Facebook', profile_url: 'https://www.facebook.com/forexvietnamacademy', country: 'Vietnam', language: 'Vietnamese', followers: '12800', engagement: '5.6', bio: 'Forex trading education, market analysis and risk management for Vietnamese traders.' },
  { name: 'Dau Tu Forex Cung Minh', platform: 'Facebook', profile_url: 'https://www.facebook.com/dautufoxecungminh', country: 'Vietnam', language: 'Vietnamese', followers: '7600', engagement: '3.9', bio: 'Trading journal, currency market commentary and beginner lessons.' },
  { name: 'Crypto Saigon Community', platform: 'Facebook', profile_url: 'https://www.facebook.com/cryptosaigoncommunity', country: 'Vietnam', language: 'Vietnamese', followers: '22100', engagement: '2.1', bio: 'General crypto news, community events and digital asset discussion.' },
  { name: 'Trading Psychology VN', platform: 'Facebook', profile_url: 'https://www.facebook.com/tradingpsychologyvn', country: 'Vietnam', language: 'Vietnamese', followers: '4900', engagement: '7.3', bio: 'Trading psychology and discipline for retail traders.' },
  { name: 'Global Markets Lab', platform: 'Facebook', profile_url: 'https://www.facebook.com/globalmarketslab', country: 'Singapore', language: 'English', followers: '9300', engagement: '4.4', bio: 'Forex and macro market explainers for a Southeast Asian audience.' }
];

let leads = loadLeads();
const elements = {
  rows: document.querySelector('#leadRows'), empty: document.querySelector('#emptyState'), search: document.querySelector('#searchInput'),
  status: document.querySelector('#statusFilter'), score: document.querySelector('#scoreFilter'), csv: document.querySelector('#csvInput')
};

function loadLeads() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; }
}
function saveLeads() { localStorage.setItem(STORAGE_KEY, JSON.stringify(leads)); }
function number(value) { return Number(String(value || '').replace(/[^0-9.]/g, '')) || 0; }
function scoreLead(lead) {
  const audience = Math.min(30, Math.round(Math.log10(Math.max(number(lead.followers), 1)) * 7));
  const relevanceWords = /(forex|trading|trade|market|fx|technical analysis|risk)/i;
  const relevance = relevanceWords.test(lead.bio || '') ? 25 : 8;
  const engagement = Math.min(20, Math.round(number(lead.engagement) * 2.2));
  const geography = /(vietnam|singapore|australia|asia)/i.test(`${lead.country} ${lead.language}`) ? 15 : 7;
  const contactability = lead.profile_url ? 10 : 0;
  return Math.min(100, audience + relevance + engagement + geography + contactability);
}
function priority(score) { return score >= 70 ? 'high' : score >= 50 ? 'review' : 'low'; }
function normalizeUrl(url) { return String(url || '').trim().toLowerCase().replace(/\/$/, ''); }
function deduplicate(items) {
  const seen = new Set();
  return items.filter(item => { const key = `${item.platform || ''}:${normalizeUrl(item.profile_url) || item.name.toLowerCase()}`; if (seen.has(key)) return false; seen.add(key); return true; });
}
function filteredLeads() {
  const term = elements.search.value.trim().toLowerCase();
  return leads.filter(lead => {
    const score = scoreLead(lead); const tier = priority(score);
    const matchesTerm = !term || Object.values(lead).some(value => String(value).toLowerCase().includes(term));
    const matchesStatus = elements.status.value === 'all' || lead.status === elements.status.value;
    const matchesScore = elements.score.value === 'all' || tier === elements.score.value;
    return matchesTerm && matchesStatus && matchesScore;
  }).sort((a, b) => scoreLead(b) - scoreLead(a));
}
function render() {
  const visible = filteredLeads();
  elements.rows.innerHTML = visible.map((lead, index) => {
    const score = scoreLead(lead); const tier = priority(score);
    return `<tr><td><div class="profile"><strong>${escapeHtml(lead.name || 'Unnamed profile')}</strong><span class="audience">${escapeHtml(lead.platform || 'Unknown')} · ${escapeHtml(lead.country || 'Unknown')}</span><a href="${escapeAttribute(lead.profile_url || '#')}" target="_blank" rel="noopener">Open public profile →</a></div></td><td><span>${formatFollowers(lead.followers)}</span><br><span class="audience">${escapeHtml(lead.language || 'Language unknown')}</span></td><td><span class="score ${tier}">${score}<span class="score-bar"><i style="width:${score}%"></i></span></span></td><td><select class="status" data-index="${leads.indexOf(lead)}" aria-label="Update lead status"><option ${lead.status === 'New' ? 'selected' : ''}>New</option><option ${lead.status === 'Reviewed' ? 'selected' : ''}>Reviewed</option><option ${lead.status === 'Contacted' ? 'selected' : ''}>Contacted</option><option ${lead.status === 'Interested' ? 'selected' : ''}>Interested</option><option ${lead.status === 'Qualified' ? 'selected' : ''}>Qualified</option><option ${lead.status === 'Rejected' ? 'selected' : ''}>Rejected</option></select></td><td><input class="note-input" data-index="${leads.indexOf(lead)}" value="${escapeAttribute(lead.note || '')}" placeholder="Add a note" aria-label="Add note for ${escapeAttribute(lead.name)}"></td></tr>`;
  }).join('');
  elements.empty.hidden = visible.length > 0;
  document.querySelector('#resultCount').textContent = `${visible.length} lead${visible.length === 1 ? '' : 's'}`;
  document.querySelector('#totalLeads').textContent = leads.length;
  document.querySelector('#highPriority').textContent = leads.filter(lead => priority(scoreLead(lead)) === 'high').length;
  document.querySelector('#reviewCount').textContent = leads.filter(lead => priority(scoreLead(lead)) === 'review').length;
  document.querySelector('#contactedCount').textContent = leads.filter(lead => ['Contacted', 'Interested', 'Qualified'].includes(lead.status)).length;
}
function formatFollowers(value) { const count = number(value); return count >= 1000 ? `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}k followers` : `${count || 0} followers`; }
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char])); }
function escapeAttribute(value) { return escapeHtml(value); }
function parseCsv(text) {
  const rows = []; let row = []; let cell = ''; let quoted = false;
  for (const char of text.replace(/\r/g, '')) { if (char === '"') quoted = !quoted; else if (char === ',' && !quoted) { row.push(cell.trim()); cell = ''; } else if (char === '\n' && !quoted) { row.push(cell.trim()); rows.push(row); row = []; cell = ''; } else cell += char; }
  if (cell || row.length) { row.push(cell.trim()); rows.push(row); }
  const headers = rows.shift().map(header => header.toLowerCase().replace(/\s+/g, '_'));
  return rows.filter(row => row.some(Boolean)).map(row => Object.fromEntries(headers.map((header, index) => [header, row[index] || '']))).map(lead => ({ ...lead, status: lead.status || 'New', note: lead.note || '' }));
}
function renderDiscovery() {
  const query = document.querySelector('#discoveryQuery').value.trim().toLowerCase();
  const country = document.querySelector('#discoveryCountry').value;
  const minimum = number(document.querySelector('#minFollowers').value);
  const results = discoveryDemoLeads.filter(lead => {
    const haystack = `${lead.name} ${lead.bio} ${lead.language}`.toLowerCase();
    return (!query || query.split(/\s+/).every(term => haystack.includes(term))) && (country === 'all' || lead.country === country) && number(lead.followers) >= minimum;
  });
  const target = document.querySelector('#discoveryResults');
  target.innerHTML = results.length ? `<div class="discovery-meta">${results.length} demo result${results.length === 1 ? '' : 's'} · public-profile workflow preview <button class="text-button" id="addDiscoveryButton" type="button">Add visible results to review queue</button></div>${results.map(lead => `<article class="discovery-card"><div><strong>${escapeHtml(lead.name)}</strong><span>${escapeHtml(lead.platform)} · ${escapeHtml(lead.country)} · ${formatFollowers(lead.followers)}</span><p>${escapeHtml(lead.bio)}</p></div><span class="discovery-score">${scoreLead(lead)} fit</span></article>`).join('')}` : '<div class="discovery-empty">No demo results match these filters. Try a broader query or lower the minimum.</div>';
  const addButton = document.querySelector('#addDiscoveryButton');
  if (addButton) addButton.addEventListener('click', () => { leads = deduplicate([...leads, ...results.map(lead => ({ ...lead, status: 'New', note: '' }))]); saveLeads(); render(); addButton.textContent = 'Added to review queue'; addButton.disabled = true; });
}

elements.rows.addEventListener('change', event => { if (!event.target.matches('.status')) return; leads[event.target.dataset.index].status = event.target.value; saveLeads(); render(); });
elements.rows.addEventListener('input', event => { if (!event.target.matches('.note-input')) return; leads[event.target.dataset.index].note = event.target.value; saveLeads(); });
[elements.search, elements.status, elements.score].forEach(element => element.addEventListener('input', render));
elements.csv.addEventListener('change', async event => { const file = event.target.files[0]; if (!file) return; const imported = parseCsv(await file.text()); leads = deduplicate([...leads, ...imported]); saveLeads(); render(); event.target.value = ''; });
document.querySelector('#sampleButton').addEventListener('click', () => { leads = deduplicate([...leads, ...sampleLeads]); saveLeads(); render(); });
document.querySelector('#clearButton').addEventListener('click', () => { if (confirm('Clear all leads from this browser?')) { leads = []; saveLeads(); render(); } });
document.querySelector('#discoverButton').addEventListener('click', renderDiscovery);
['#discoveryQuery', '#discoveryCountry', '#minFollowers'].forEach(selector => document.querySelector(selector).addEventListener('input', renderDiscovery));
render();
renderDiscovery();
