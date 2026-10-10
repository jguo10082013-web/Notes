const STORAGE_KEY = 'threadnote-notes-v1';

const starterNotes = [
  { id: 'n1', title: 'A morning ritual for better ideas', body: 'What if the first 20 minutes of the day were for collecting, not consuming?', priority: 5, symbol: '✦', tags: ['ritual', 'wellbeing'], category: 'A calmer day', createdAt: '2026-10-10T09:20:00.000Z', link: 'n2' },
  { id: 'n2', title: 'The tiny library in the neighborhood', body: 'A free shelf, a handwritten recommendation, and a reason to walk a different way home.', priority: 4, symbol: '→', tags: ['community', 'place'], category: 'A calmer day', createdAt: '2026-10-09T15:30:00.000Z', link: 'n3' },
  { id: 'n3', title: 'Design for the pause', body: 'Interfaces could make a little more room for people to stop and notice what they need.', priority: 4, symbol: '⌁', tags: ['design', 'question'], category: 'A calmer day', createdAt: '2026-10-08T11:45:00.000Z', link: 'n1' },
  { id: 'n4', title: 'A collection of useful questions', body: 'Start with questions that open a door instead of questions that close a case.', priority: 3, symbol: '?', tags: ['writing', 'practice'], category: 'Visual language', createdAt: '2026-10-07T10:10:00.000Z', link: '' },
  { id: 'n5', title: 'Make the invisible visible', body: 'A visual language for half-formed thoughts: symbols, colors, arrows, and gentle signals.', priority: 2, symbol: '!', tags: ['making', 'notes'], category: 'Visual language', createdAt: '2026-10-05T17:10:00.000Z', link: 'n4' },
  { id: 'n6', title: 'One small thing to try today', body: 'Leave your phone in another room while you make breakfast. See what comes up.', priority: 2, symbol: '✦', tags: ['experiment'], category: '', createdAt: '2026-10-03T08:05:00.000Z', link: '' }
];

let notes = loadNotes();
let currentView = 'all';
let selectedSymbol = '✦';
let threadGroups = [];
let drawingTool = 'pencil';
let drawingColor = '#e77b5c';
let drawingHasInk = false;
let isDrawing = false;

const els = {
  grid: document.querySelector('#notesGrid'),
  empty: document.querySelector('#emptyState'),
  resultCount: document.querySelector('#resultCount'),
  search: document.querySelector('#searchInput'),
  sort: document.querySelector('#sortSelect'),
  allCount: document.querySelector('#allCount'),
  importantCount: document.querySelector('#importantCount'),
  connectionCount: document.querySelector('#connectionCount'),
  modal: document.querySelector('#modalBackdrop'),
  form: document.querySelector('#noteForm'),
  title: document.querySelector('#noteTitle'),
  body: document.querySelector('#noteBody'),
  priority: document.querySelector('#notePriority'),
  priorityOutput: document.querySelector('#priorityOutput'),
  tags: document.querySelector('#noteTags'),
  category: document.querySelector('#noteCategory'),
  link: document.querySelector('#noteLink'),
  canvas: document.querySelector('#noteCanvas'),
  canvasPlaceholder: document.querySelector('#canvasPlaceholder'),
  drawingColor: document.querySelector('#drawingColor'),
  threadBoard: document.querySelector('#threadBoard'),
  threadDetailBackdrop: document.querySelector('#threadDetailBackdrop'),
  threadDetailLabel: document.querySelector('#threadDetailLabel'),
  threadDetailTitle: document.querySelector('#threadDetailTitle'),
  threadDetailDescription: document.querySelector('#threadDetailDescription'),
  threadDetailList: document.querySelector('#threadDetailList'),
  shortcuts: document.querySelector('#shortcutPopover')
};

const drawingContext = els.canvas.getContext('2d');
drawingContext.lineCap = 'round';
drawingContext.lineJoin = 'round';

function loadNotes() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) && saved.length ? saved : starterNotes;
  } catch { return starterNotes; }
}

function saveNotes() { localStorage.setItem(STORAGE_KEY, JSON.stringify(notes)); }

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[char]));
}

function noteById(id) { return notes.find(note => note.id === id); }
function normalizedTag(tag) { return String(tag).trim().toLowerCase(); }

function sharedTagsFor(note) {
  return (note.tags || []).filter(tag => notes.some(other => other.id !== note.id && (other.tags || []).some(otherTag => normalizedTag(otherTag) === normalizedTag(tag))));
}

function hasCategoryPeer(note) {
  const category = normalizedTag(note.category || '');
  return Boolean(category && notes.some(other => other.id !== note.id && normalizedTag(other.category || '') === category));
}

function clearDrawing() {
  drawingContext.clearRect(0, 0, els.canvas.width, els.canvas.height);
  drawingHasInk = false;
  els.canvasPlaceholder.classList.remove('hidden');
}

function loadDrawing(dataUrl = '') {
  clearDrawing();
  if (!dataUrl) return;
  const image = new Image();
  image.onload = () => {
    drawingContext.drawImage(image, 0, 0, els.canvas.width, els.canvas.height);
    drawingHasInk = true;
    els.canvasPlaceholder.classList.add('hidden');
  };
  image.src = dataUrl;
}

function drawingPoint(event) {
  const rect = els.canvas.getBoundingClientRect();
  return [(event.clientX - rect.left) * (els.canvas.width / rect.width), (event.clientY - rect.top) * (els.canvas.height / rect.height)];
}

function startDrawing(event) {
  isDrawing = true;
  els.canvas.setPointerCapture(event.pointerId);
  const [x, y] = drawingPoint(event);
  drawingContext.beginPath();
  drawingContext.moveTo(x, y);
  drawingContext.lineWidth = drawingTool === 'eraser' ? 18 : 3;
  drawingContext.strokeStyle = drawingTool === 'eraser' ? '#fffdfa' : drawingColor;
  drawingContext.lineTo(x + 0.01, y + 0.01);
  drawingContext.stroke();
  drawingHasInk = true;
  els.canvasPlaceholder.classList.add('hidden');
}

function draw(event) {
  if (!isDrawing) return;
  const [x, y] = drawingPoint(event);
  drawingContext.lineTo(x, y);
  drawingContext.stroke();
  drawingContext.beginPath();
  drawingContext.moveTo(x, y);
}

function stopDrawing() { isDrawing = false; drawingContext.beginPath(); }

function formatDate(date) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(date));
}

function visibleNotes() {
  const term = els.search.value.trim().toLowerCase();
  let result = notes.filter(note => {
    const haystack = [note.title, note.body, ...(note.tags || [])].join(' ').toLowerCase();
    const matchesSearch = !term || haystack.includes(term);
    const matchesView = currentView === 'all' || (currentView === 'important' && note.priority >= 4) || (currentView === 'connections' && (Boolean(note.link) || sharedTagsFor(note).length || hasCategoryPeer(note)));
    return matchesSearch && matchesView;
  });
  const sort = els.sort.value;
  result.sort((a, b) => sort === 'priority' ? b.priority - a.priority || new Date(b.createdAt) - new Date(a.createdAt) : sort === 'newest' ? new Date(b.createdAt) - new Date(a.createdAt) : sort === 'oldest' ? new Date(a.createdAt) - new Date(b.createdAt) : a.title.localeCompare(b.title));
  return result;
}

function render() {
  const visible = visibleNotes();
  els.grid.innerHTML = visible.map(noteCard).join('');
  els.empty.classList.toggle('hidden', visible.length !== 0);
  els.grid.classList.toggle('hidden', visible.length === 0);
  els.resultCount.textContent = `${visible.length} ${visible.length === 1 ? 'note' : 'notes'}`;
  els.allCount.textContent = notes.length;
  els.importantCount.textContent = notes.filter(note => note.priority >= 4).length;
  els.connectionCount.textContent = notes.filter(note => note.link || sharedTagsFor(note).length || hasCategoryPeer(note)).length;
  renderThreads();
  updateLinkOptions();
}

function noteCard(note) {
  const tags = (note.tags || []).map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('');
  const dots = Array.from({ length: 5 }, (_, index) => `<i class="${index < note.priority ? 'filled' : ''}"></i>`).join('');
  const linkedNote = noteById(note.link);
  const sharedTags = sharedTagsFor(note);
  const drawingPreview = note.drawing ? `<div class="drawing-preview"><img src="${escapeHtml(note.drawing)}" alt="Doodle attached to ${escapeHtml(note.title)}" /></div>` : '';
  const categoryBadge = note.category ? `<div class="category-badge"><span>▦</span> ${escapeHtml(note.category)}</div>` : '';
  return `<article class="note-card" data-id="${escapeHtml(note.id)}">
    <div class="note-head"><span class="note-symbol" aria-label="Symbol ${escapeHtml(note.symbol)}">${escapeHtml(note.symbol)}</span><div class="note-actions"><button class="card-action edit-note" type="button" aria-label="Edit ${escapeHtml(note.title)}">↗</button><button class="card-action delete-note" type="button" aria-label="Delete ${escapeHtml(note.title)}">×</button></div></div>
    <h3>${escapeHtml(note.title)}</h3><p class="note-body">${escapeHtml(note.body || 'A thought waiting to be explored.')}</p>
    ${drawingPreview}
    ${categoryBadge}
    ${sharedTags.length ? `<div class="tag-connect"><span>⌁</span> ${escapeHtml(sharedTags[0])} thread</div>` : ''}
    ${linkedNote ? `<div class="link-badge"><span>→</span> ${escapeHtml(linkedNote.title)}</div>` : ''}
    <div class="note-footer"><div class="tag-list">${tags || '<span class="tag">untagged</span>'}</div><div class="priority-dots" aria-label="Priority ${note.priority} out of 5">${dots}</div></div>
  </article>`;
}

function renderThreads() {
  const categoryBuckets = new Map();
  notes.forEach(note => {
    const category = String(note.category || '').trim();
    if (!category) return;
    const key = normalizedTag(category);
    if (!categoryBuckets.has(key)) categoryBuckets.set(key, { category, notes: [] });
    categoryBuckets.get(key).notes.push(note);
  });
  const categoryGroups = [...categoryBuckets.values()]
    .filter(group => group.notes.length > 1)
    .sort((a, b) => b.notes.length - a.notes.length)
    .map(group => ({ kind: 'category', label: 'Stack category', title: group.category, notes: group.notes }));

  const directGroups = notes.filter(note => note.link && noteById(note.link)).map(note => {
    const linked = noteById(note.link);
    const sameCategory = note.category && linked.category && normalizedTag(note.category) === normalizedTag(linked.category);
    return sameCategory ? null : { kind: 'link', label: 'Direct connection', title: `${note.title} connects to ${linked.title}`, notes: [note, linked] };
  }).filter(Boolean);
  const tagBuckets = new Map();
  notes.forEach(note => (note.tags || []).forEach(tag => {
    const key = normalizedTag(tag);
    if (!key) return;
    if (!tagBuckets.has(key)) tagBuckets.set(key, { tag, notes: [] });
    const bucket = tagBuckets.get(key);
    if (!bucket.notes.some(item => item.id === note.id)) bucket.notes.push(note);
  }));
  const tagGroups = [...tagBuckets.values()]
    .filter(group => group.notes.length > 1 && !(new Set(group.notes.map(note => normalizedTag(note.category || ''))).size === 1 && normalizedTag(group.notes[0].category || '')))
    .sort((a, b) => b.notes.length - a.notes.length)
    .map(group => ({ kind: 'tag', label: `Shared tag · #${group.tag}`, title: `${group.notes.length} notes share “${group.tag}”`, notes: group.notes }));
  const threadData = [...categoryGroups, ...directGroups, ...tagGroups];
  if (!threadData.length) threadData.push(...notes.slice(0, 3).map(note => ({ kind: 'open', label: 'Open thread', title: note.title, notes: [note] })));
  threadGroups = threadData.map((group, index) => ({ ...group, id: `thread-${index}` }));
  els.threadBoard.innerHTML = threadGroups.map((group, index) => {
    const previewNodes = group.notes.slice(0, 3).map((note, nodeIndex) => `${nodeIndex ? '<span class="stack-arrow" aria-hidden="true"></span>' : ''}<span class="stack-note"><b>${escapeHtml(note.symbol)}</b><span>${escapeHtml(note.title)}</span></span>`).join('');
    const extraCount = group.notes.length - 3;
    return `<article class="thread-stack" data-thread-index="${index}" tabindex="0" role="button" aria-label="Open ${escapeHtml(group.title)} with ${group.notes.length} notes"><span class="stack-sheet stack-sheet-back"></span><span class="stack-sheet stack-sheet-middle"></span><span class="stack-card"><span class="stack-topline"><span class="thread-label">${escapeHtml(group.label)}</span><span class="stack-count">${group.notes.length} notes</span></span><span class="stack-title">${escapeHtml(group.title)}</span><span class="stack-preview">${previewNodes}${extraCount > 0 ? `<span class="stack-more">+${extraCount} more</span>` : ''}</span><span class="stack-open">Open connected notes <b aria-hidden="true">↗</b></span></span></article>`;
  }).join('');
}

function openThreadDetail(group) {
  if (!group) return;
  const categoryLabel = group.kind === 'category' ? 'Stack category' : group.label;
  els.threadDetailLabel.textContent = categoryLabel;
  els.threadDetailTitle.textContent = group.kind === 'category' ? group.title : `${group.notes.length} connected notes`;
  els.threadDetailDescription.textContent = group.kind === 'category' ? 'Everything in this stack belongs to the same category.' : 'These notes are connected by a link or a shared tag.';
  els.threadDetailList.innerHTML = group.notes.map(noteCard).join('');
  els.threadDetailBackdrop.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeThreadDetail() {
  els.threadDetailBackdrop.classList.add('hidden');
  document.body.style.overflow = '';
}

function updateLinkOptions(selected = '') {
  const options = ['<option value="">No connection yet</option>', ...notes.map(note => `<option value="${escapeHtml(note.id)}">${escapeHtml(note.symbol)} ${escapeHtml(note.title)}</option>`)];
  els.link.innerHTML = options.join('');
  els.link.value = selected;
}

function openModal(editingNote = null) {
  els.form.dataset.editing = editingNote ? editingNote.id : '';
  els.form.reset();
  selectedSymbol = editingNote?.symbol || '✦';
  els.title.value = editingNote?.title || '';
  els.body.value = editingNote?.body || '';
  els.priority.value = editingNote?.priority || 3;
  els.priorityOutput.textContent = `${els.priority.value} / 5`;
  els.tags.value = editingNote?.tags?.join(', ') || '';
  els.category.value = editingNote?.category || '';
  updateLinkOptions(editingNote?.link || '');
  loadDrawing(editingNote?.drawing || '');
  document.querySelectorAll('.symbol-option').forEach(button => button.classList.toggle('is-selected', button.dataset.symbol === selectedSymbol));
  els.modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => els.title.focus());
}

function closeModal() { els.modal.classList.add('hidden'); document.body.style.overflow = ''; }

function clearFilters() { els.search.value = ''; currentView = 'all'; els.sort.value = 'priority'; document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('is-active', item.dataset.view === currentView)); render(); }

els.search.addEventListener('input', render);
els.sort.addEventListener('change', render);
document.querySelectorAll('.nav-item').forEach(item => item.addEventListener('click', () => { currentView = item.dataset.view; document.querySelectorAll('.nav-item').forEach(nav => nav.classList.toggle('is-active', nav === item)); render(); }));
document.querySelector('#clearFiltersButton').addEventListener('click', clearFilters);
document.querySelector('#openModalButton').addEventListener('click', () => openModal());
document.querySelector('#emptyAddButton').addEventListener('click', () => openModal());
document.querySelector('#closeModalButton').addEventListener('click', closeModal);
document.querySelector('#cancelButton').addEventListener('click', closeModal);
els.modal.addEventListener('click', event => { if (event.target === els.modal) closeModal(); });
els.priority.addEventListener('input', () => { els.priorityOutput.textContent = `${els.priority.value} / 5`; });
document.querySelectorAll('.symbol-option').forEach(button => button.addEventListener('click', () => { selectedSymbol = button.dataset.symbol; document.querySelectorAll('.symbol-option').forEach(option => option.classList.toggle('is-selected', option === button)); }));
document.querySelectorAll('.draw-tool').forEach(button => button.addEventListener('click', () => { drawingTool = button.dataset.tool; document.querySelectorAll('.draw-tool').forEach(tool => tool.classList.toggle('is-selected', tool === button)); }));
els.drawingColor.addEventListener('input', () => { drawingColor = els.drawingColor.value; drawingTool = 'pencil'; document.querySelectorAll('.draw-tool').forEach(tool => tool.classList.toggle('is-selected', tool.dataset.tool === drawingTool)); });
document.querySelector('#clearDrawingButton').addEventListener('click', clearDrawing);
els.canvas.addEventListener('pointerdown', startDrawing);
els.canvas.addEventListener('pointermove', draw);
els.canvas.addEventListener('pointerup', stopDrawing);
els.canvas.addEventListener('pointercancel', stopDrawing);
els.canvas.addEventListener('pointerleave', stopDrawing);

els.threadBoard.addEventListener('click', event => {
  const stack = event.target.closest('.thread-stack');
  if (stack) openThreadDetail(threadGroups[Number(stack.dataset.threadIndex)]);
});
els.threadBoard.addEventListener('keydown', event => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const stack = event.target.closest('.thread-stack');
  if (!stack) return;
  event.preventDefault();
  openThreadDetail(threadGroups[Number(stack.dataset.threadIndex)]);
});
document.querySelector('#closeThreadDetailButton').addEventListener('click', closeThreadDetail);
els.threadDetailBackdrop.addEventListener('click', event => { if (event.target === els.threadDetailBackdrop) closeThreadDetail(); });

els.form.addEventListener('submit', event => {
  event.preventDefault();
  const data = new FormData(els.form);
  const editingId = els.form.dataset.editing;
  const payload = { title: data.get('title').trim(), body: data.get('body').trim(), priority: Number(data.get('priority')), symbol: selectedSymbol, tags: data.get('tags').split(',').map(tag => tag.trim()).filter(Boolean), category: data.get('category').trim(), link: data.get('link') || '', drawing: drawingHasInk ? els.canvas.toDataURL('image/png') : '' };
  if (editingId) { notes = notes.map(note => note.id === editingId ? { ...note, ...payload } : note); } else { notes.unshift({ ...payload, id: `n${Date.now()}`, createdAt: new Date().toISOString() }); }
  saveNotes(); closeModal(); render();
});

function handleNoteCardAction(event) {
  const card = event.target.closest('.note-card');
  if (!card) return;
  const note = noteById(card.dataset.id);
  if (event.target.closest('.delete-note')) {
    if (confirm(`Delete “${note.title}”?`)) {
      closeThreadDetail();
      notes = notes.filter(item => item.id !== note.id).map(item => item.link === note.id ? { ...item, link: '' } : item);
      saveNotes();
      render();
    }
  }
  if (event.target.closest('.edit-note')) { closeThreadDetail(); openModal(note); }
}

els.grid.addEventListener('click', handleNoteCardAction);
els.threadDetailList.addEventListener('click', handleNoteCardAction);

document.querySelector('#helpButton').addEventListener('click', () => els.shortcuts.classList.toggle('hidden'));
document.addEventListener('keydown', event => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); els.search.focus(); }
  if (event.key.toLowerCase() === 'n' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) openModal();
  if (event.key === 'Escape') { closeModal(); closeThreadDetail(); els.shortcuts.classList.add('hidden'); }
});

render();
