// Configuração do Supabase
const SUPABASE_URL = 'https://spmowzpuinfojtfpxkab.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwbW93enB1aW5mb2p0ZnB4a2FiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0ODU3NTIsImV4cCI6MjEwNTA2MTc1Mn0.vy8rthkYjluGtD2C2Vj8u-iCBRi6gckVhUM8HDrJHQE';

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let isAdmin = false;

// Inicialização da aplicação
document.addEventListener('DOMContentLoaded', async () => {
  await checkUserSession();
  await loadTasks();
});

// Verifica se o usuário logado é o Admin
async function checkUserSession() {
  const { data: { session } } = await _supabase.auth.getSession();
  isAdmin = !!session;
  updateUI();
}

// Atualiza a visibilidade dos elementos com base no acesso
function updateUI() {
  document.querySelectorAll('.admin-only').forEach(el => el.style.display = isAdmin ? 'flex' : 'none');
  document.getElementById('btn-login-modal').style.display = isAdmin ? 'none' : 'block';
  document.getElementById('btn-logout').style.display = isAdmin ? 'block' : 'none';
}

// Carrega as tarefas do banco de dados
async function loadTasks() {
  const { data: tasks, error } = await _supabase.from('tasks').select('*').order('created_at', { ascending: true });
  if (error) return console.error('Erro ao carregar tarefas:', error);

  // Limpa as colunas
  document.querySelectorAll('.task-list').forEach(el => el.innerHTML = '');

  // Renderiza cada card
  tasks.forEach(task => {
    const card = document.createElement('div');
    card.className = `task-card ${!isAdmin ? 'readonly' : ''}`;
    card.id = task.id;

    let cardContent = `<span>${task.title}</span>`;
    if (isAdmin) {
      cardContent += `<button class="btn-delete" onclick="deleteTask('${task.id}')">✕</button>`;
    }
    card.innerHTML = cardContent;

    // Ativa drag and drop apenas se for Admin
    if (isAdmin) {
      card.draggable = true;
      card.ondragstart = (e) => e.dataTransfer.setData('text/plain', task.id);
    }

    const container = document.getElementById(`list-${task.status}`);
    if (container) container.appendChild(card);
  });
}

// Lógica de Drag and Drop
function allowDrop(e) {
  if (isAdmin) e.preventDefault();
}

async function drop(e) {
  if (!isAdmin) return;
  e.preventDefault();
  
  const id = e.dataTransfer.getData('text/plain');
  const targetColumn = e.currentTarget;
  const newStatus = targetColumn.dataset.status;

  // Atualiza no banco de dados
  const { error } = await _supabase.from('tasks').update({ status: newStatus }).eq('id', id);
  
  if (!error) {
    loadTasks();
  } else {
    alert('Erro ao mover tarefa.');
  }
}

// Criar nova tarefa
async function addTask() {
  if (!isAdmin) return;
  const input = document.getElementById('new-task-title');
  const title = input.value.trim();

  if (!title) return;

  const { error } = await _supabase.from('tasks').insert([{ title: title, status: 'todo' }]);
  if (!error) {
    input.value = '';
    loadTasks();
  } else {
    alert('Erro ao criar tarefa: ' + error.message);
  }
}

// Excluir tarefa
async function deleteTask(id) {
  if (!isAdmin) return;

  const confirmDelete = confirm("Deseja realmente excluir esta tarefa?");
  if (!confirmDelete) return;

  const { error } = await _supabase.from('tasks').delete().eq('id', id);

  if (!error) {
    loadTasks();
  } else {
    alert('Erro ao deletar tarefa: ' + error.message);
  }
}

// Funções de Autenticação
async function login() {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  const { error } = await _supabase.auth.signInWithPassword({ email, password });
  if (error) {
    alert('Falha no login: ' + error.message);
  } else {
    toggleModal(false);
    await checkUserSession();
    await loadTasks();
  }
}

async function logout() {
  await _supabase.auth.signOut();
  await checkUserSession();
  await loadTasks();
}

function toggleModal(show) {
  document.getElementById('login-modal').style.display = show ? 'flex' : 'none';
}