// 1. CONFIGURAÇÃO E CREDENCIAIS
const SUPABASE_URL = 'https://spmowzpuinfojtfpxkab.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwbW93enB1aW5mb2p0ZnB4a2FiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0ODU3NTIsImV4cCI6MjEwNTA2MTc1Mn0.vy8rthkYjluGtD2C2Vj8u-iCBRi6gckVhUM8HDrJHQE';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 2. CHECAGEM DE PERMISSÃO (SÓ VISUALIZAÇÃO OU EDIÇÃO)
const urlParams = new URLSearchParams(window.location.search);
const IS_EDIT_MODE = urlParams.get('admin') === 'true'; // Acessar com ?admin=true para editar

const TAGS = [
  ['discovery','DISCOVERY'],['asis','AS IS'],['dados','DADOS'],['benchmark','BENCHMARK'],
  ['hipotese','HIPÓTESE'],['insight','INSIGHT'],['wireframe','WIREFRAME'],['decisao','DECISÃO'],['validacao','VALIDAÇÃO']
];

let tasks = [];
let appFlow = [];

let editingId = null;
let editingFlowNodeId = null;
let draggedTaskId = null;
let draggedNodeId = null;

// Helper functions
function tagLabel(k){ return TAGS.find(x=>x[0]===k)?.[1]||k; }
function statusLabel(k){ return {backlog:'Backlog',doing:'Em andamento',review:'Review',done:'Concluída'}[k]; }
function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }

// 3. CARREGAR DADOS DO SUPABASE
async function initApp() {
  showToast('Carregando dados...');
  try {
    const { data: dbTasks, error: e1 } = await _supabase.from('tasks').select('*').order('created_at', { ascending: true });
    if (e1) throw e1;
    tasks = dbTasks || [];

    const { data: dbFlow, error: e2 } = await _supabase.from('flow_nodes').select('*').order('created_at', { ascending: true });
    if (e2) throw e2;
    appFlow = dbFlow || [];

    populateFilters();
    renderAll();
    applyPermissionsUI();
    showToast('Dados atualizados!');
  } catch (err) {
    console.error('Erro ao conectar com Supabase:', err);
    showToast('Erro ao carregar dados');
  }
}

// 4. APLICAR RESTRIÇÕES DE VISUALIZAÇÃO / EDIÇÃO NA INTERFACE
function applyPermissionsUI() {
  if (!IS_EDIT_MODE) {
    // Esconde botões de criação e edição se não for admin
    document.querySelectorAll('.top-actions, .flow-builder-header button, #case .hero button, .node-actions, .flow-node-quick-add, .decision-head-row + button').forEach(el => {
      if(el) el.style.display = 'none';
    });
    console.log("🔒 Modo de Visualização Ativo");
  } else {
    console.log("✏️ Modo de Edição Ativo (?admin=true)");
  }
}

function renderAll() {
  renderOverview();
  renderBoard();
  renderAppFlow();
  renderDecisions();
  renderCase();
}

function populateFilters() {
  const tf = document.getElementById('tagFilter');
  if(tf) {
    const old = tf.value;
    tf.innerHTML = '<option value="">Todos os temas</option>' + TAGS.map(t=>`<option value="${t[0]}">${t[1]}</option>`).join('');
    tf.value = old;
  }
  const ft = document.getElementById('fTag');
  if(ft) ft.innerHTML = TAGS.map(t=>`<option value="${t[0]}">${t[1]}</option>`).join('');
  const cit = document.getElementById('ciTag');
  if(cit) cit.innerHTML = TAGS.map(t=>`<option value="${t[0]}">${t[1]}</option>`).join('');
}

// 5. OVERVIEW
function renderOverview() {
  const counts = {backlog:0, doing:0, review:0, done:0};
  tasks.forEach(t => { if(counts[t.status] !== undefined) counts[t.status]++; });
  
  ['backlog','doing','review','done'].forEach(s => {
    const el = document.getElementById('s' + s[0].toUpperCase() + s.slice(1));
    if(el) el.textContent = counts[s];
  });

  const pct = Math.round((counts.done + counts.review*.65 + counts.doing*.3) / Math.max(tasks.length,1) * 100);
  const pText = document.getElementById('progressText');
  const pBar = document.getElementById('progressBar');
  if(pText) pText.textContent = pct + '%';
  if(pBar) pBar.style.width = pct + '%';

  const themeEl = document.getElementById('themeProgress');
  if(themeEl) {
    themeEl.innerHTML = TAGS.map(([k,l]) => {
      const all = tasks.filter(t=>t.tag===k).length;
      const done = tasks.filter(t=>t.tag===k && t.status==='done').length;
      if(!all) return '';
      const p = Math.round(done/all*100);
      return `<div class="bar-row"><span>${l}</span><div class="bar"><i style="width:${p}%"></i></div><b>${p}%</b></div>`;
    }).join('');
  }
}

// 6. KANBAN (TASK BOARD)
function renderBoard() {
  const q = (document.getElementById('search')?.value||'').toLowerCase();
  const filter = document.getElementById('tagFilter')?.value||'';
  const cols = ['backlog','doing','review','done'];
  const kanban = document.getElementById('kanban');

  if(!kanban) return;

  kanban.innerHTML = cols.map(s => {
    const arr = tasks.filter(t => t.status === s && (!filter || t.tag === filter) && (!q || (`${t.title} ${t.desc} ${t.evidence}`).toLowerCase().includes(q)));
    return `
      <div class="column" data-status="${s}">
        <div class="col-head"><b>${statusLabel(s)}</b><span class="count">${arr.length}</span></div>
        ${arr.map(t => `
          <article class="task" ${IS_EDIT_MODE ? 'draggable="true"' : ''} data-task-id="${t.id}">
            <span class="tag ${t.tag}">${tagLabel(t.tag)}</span>
            <h3 style="margin:4px 0 6px;font-size:14px;color:var(--ink);">${escapeHtml(t.title)}</h3>
            <p style="margin:0;font-size:12px;color:var(--muted);">${escapeHtml(t.desc||'')}</p>
            <div class="meta">
              <span>${statusLabel(t.status)}</span>
              ${IS_EDIT_MODE ? `<button class="btn sm" onclick="editTask(${t.id}); event.stopPropagation();">✏️ Editar</button>` : ''}
            </div>
          </article>
        `).join('') || '<div class="empty">Nenhuma tarefa</div>'}
      </div>`;
  }).join('');

  if(IS_EDIT_MODE) setupTaskDragAndDrop();
}

function setupTaskDragAndDrop() {
  document.querySelectorAll('.task').forEach(card => {
    card.addEventListener('dragstart', (e) => {
      draggedTaskId = parseInt(card.getAttribute('data-task-id'));
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
  });

  document.querySelectorAll('.column').forEach(col => {
    col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('drag-over'); });
    col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
    col.addEventListener('drop', async (e) => {
      e.preventDefault();
      col.classList.remove('drag-over');
      const targetStatus = col.getAttribute('data-status');
      if(draggedTaskId && targetStatus) {
        const task = tasks.find(t => t.id === draggedTaskId);
        if(task && task.status !== targetStatus) {
          task.status = targetStatus;
          renderAll();
          await _supabase.from('tasks').update({ status: targetStatus }).eq('id', draggedTaskId);
          showToast('Status atualizado!');
        }
      }
    });
  });
}

// 7. FLOW BUILDER
function renderAppFlow() {
  const container = document.getElementById('flowLanesContainer');
  if(!container) return;

  const lanesMap = { 'main': { title: 'Fluxo Principal', items: [] }, 'sub1': { title: 'Fluxo Secundário', items: [] } };
  appFlow.forEach(node => {
    const lane = node.laneId || 'main';
    if(!lanesMap[lane]) lanesMap[lane] = { title: `Linha: ${lane}`, items: [] };
    lanesMap[lane].items.push(node);
  });

  container.innerHTML = Object.keys(lanesMap).map(laneKey => {
    const lane = lanesMap[laneKey];
    if(lane.items.length === 0 && laneKey !== 'main') return '';
    return `
      <div class="flow-lane">
        <div class="flow-lane-title">${lane.title}</div>
        ${lane.items.map((node, index) => renderNodeHTML(node, index, lane.items.length)).join('')}
      </div>`;
  }).join('');

  if(!IS_EDIT_MODE) {
    document.querySelectorAll('.node-actions, .flow-node-quick-add').forEach(el => el.style.display = 'none');
  }
}

function renderNodeHTML(node, index, total) {
  let shapeClass = 'node-process';
  if(node.type === 'start') shapeClass = 'node-start';
  else if(node.type === 'end') shapeClass = 'node-end';
  else if(node.type === 'decision') shapeClass = 'node-decision';
  else if(node.type === 'input') shapeClass = 'node-input';

  return `
    <div class="flow-node-wrapper" data-id="${node.id}">
      <div class="flow-node-block">
        <div class="flow-node ${shapeClass}">
          <span class="node-text">${escapeHtml(node.label)}</span>
          ${IS_EDIT_MODE ? `
            <div class="node-actions">
              <button class="btn sm" onclick="editFlowNode(${node.id})">✏️</button>
              <button class="btn sm danger" onclick="deleteFlowNode(${node.id})">✕</button>
            </div>` : ''}
        </div>
        ${node.errorLabel ? `<div class="flow-error-branch"><div class="flow-error-line"></div><div class="flow-error-card">⚠️ ${escapeHtml(node.errorLabel)}</div></div>` : ''}
      </div>
      ${index < total - 1 ? `<div class="flow-arrow-main">${node.actionLabel ? `<span class="flow-arrow-label">${escapeHtml(node.actionLabel)}</span>` : ''}</div>` : ''}
    </div>`;
}

// 8. DECISIONS & CASE STUDY
function renderDecisions() {
  const arr = tasks.filter(t => t.tag === 'decisao').slice().reverse();
  const dLog = document.getElementById('decisionLog');
  if(dLog) {
    dLog.innerHTML = arr.map(t => `
      <div class="decision-item">
        <div class="decision-head-row">
          <span class="decision-title">${escapeHtml(t.title)}</span>
          <span class="decision-badge">Decisão</span>
        </div>
        <div class="decision-body">${escapeHtml(t.evidence || t.desc || '')}</div>
      </div>`).join('') || '<div class="empty">Nenhuma decisão registrada.</div>';
  }
}

function renderCase() {
  const caseGrid = document.getElementById('casePortfolioGrid');
  if(!caseGrid) return;

  const caseItems = tasks.filter(t => t.status === 'done' || t.imageUrl);
  if(caseItems.length === 0) {
    caseGrid.innerHTML = '<div class="empty">Nenhum item concluído para o portfólio.</div>';
    return;
  }

  caseGrid.innerHTML = caseItems.map(item => `
    <article class="case-card">
      <div class="case-card-content">
        <div>
          <div class="case-card-header"><span class="tag ${item.tag}">${tagLabel(item.tag)}</span></div>
          <h3 class="case-card-title">${escapeHtml(item.title)}</h3>
          <div class="case-card-desc">${escapeHtml(item.desc || '')}</div>
          ${item.evidence ? `<div class="case-card-evidence"><strong>Evidência:</strong> ${escapeHtml(item.evidence)}</div>` : ''}
        </div>
      </div>
      <div class="case-card-media">
        ${item.imageUrl ? `<img src="${escapeHtml(item.imageUrl)}" onclick="zoomImage('${escapeHtml(item.imageUrl)}')">` : '<div class="case-media-placeholder">Sem print</div>'}
      </div>
    </article>`).join('');
}

// 9. MODAIS DE SALVAMENTO (TASKS E FLUXO)
async function saveTask(e) {
  e.preventDefault();
  if(!IS_EDIT_MODE) return;

  const data = {
    title: document.getElementById('fTitle').value.trim(),
    tag: document.getElementById('fTag').value,
    status: document.getElementById('fStatus').value,
    desc: document.getElementById('fDesc').value.trim(),
    evidence: document.getElementById('fEvidence').value.trim()
  };

  if(editingId) {
    Object.assign(tasks.find(t => t.id === editingId), data);
    await _supabase.from('tasks').update(data).eq('id', editingId);
  } else {
    const newTask = { id: Date.now(), ...data };
    tasks.push(newTask);
    await _supabase.from('tasks').insert([newTask]);
  }

  closeModal();
  renderAll();
  showToast('Tarefa salva!');
}

async function saveFlowNode(e) {
  e.preventDefault();
  if(!IS_EDIT_MODE) return;

  const nodeData = {
    label: document.getElementById('fnLabel').value.trim(),
    type: document.getElementById('fnType').value,
    laneId: document.getElementById('fnLane').value,
    actionLabel: document.getElementById('fnActionLabel').value.trim(),
    errorLabel: document.getElementById('fnErrorLabel').value.trim()
  };

  if(editingFlowNodeId) {
    Object.assign(appFlow.find(n => n.id === editingFlowNodeId), nodeData);
    await _supabase.from('flow_nodes').update(nodeData).eq('id', editingFlowNodeId);
  } else {
    const newNode = { id: Date.now(), ...nodeData };
    appFlow.push(newNode);
    await _supabase.from('flow_nodes').insert([newNode]);
  }

  closeFlowNodeModal();
  renderAll();
  showToast('Etapa salva!');
}

// 10. UTILITÁRIOS E NAVEGAÇÃO
function openTask(prefill) {
  if(!IS_EDIT_MODE) return alert("Modo de visualização ativo. Adicione ?admin=true na URL para editar.");
  editingId = null;
  document.getElementById('taskForm').reset();
  if(prefill) document.getElementById('fTag').value = prefill;
  document.getElementById('modal').classList.add('show');
}

function editTask(id) {
  if(!IS_EDIT_MODE) return;
  const t = tasks.find(x => x.id === id);
  if(!t) return;
  editingId = id;
  document.getElementById('fTitle').value = t.title;
  document.getElementById('fTag').value = t.tag;
  document.getElementById('fStatus').value = t.status;
  document.getElementById('fDesc').value = t.desc || '';
  document.getElementById('fEvidence').value = t.evidence || '';
  document.getElementById('modal').classList.add('show');
}

function closeModal() { document.getElementById('modal').classList.remove('show'); }
function openFlowNodeModal() { if(IS_EDIT_MODE) document.getElementById('flowNodeModal').classList.add('show'); }
function closeFlowNodeModal() { document.getElementById('flowNodeModal').classList.remove('show'); }
function zoomImage(url) { document.getElementById('imageModalImg').src = url; document.getElementById('imageModal').classList.add('show'); }
function showToast(t) { const el = document.getElementById('toast'); if(el){ el.textContent = t; el.style.display = 'block'; setTimeout(() => el.style.display = 'none', 1800); } }

// Event Listeners de Navegação das Abas
document.querySelectorAll('.nav button').forEach(b => {
  b.addEventListener('click', () => {
    document.querySelectorAll('.nav button').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(b.dataset.view).classList.add('active');
    document.getElementById('crumb').textContent = b.textContent;
  });
});

// Inicialização
initApp();