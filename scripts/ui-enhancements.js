// ui-enhancements.js - UI behavior (local-only) with export/backup and sheet + mode toggle
const STORAGE_TASKS = 'tarefamix.tasks.v1';
const STORAGE_NOTES = 'tarefamix.notes.v1';
const STORAGE_SHEET = 'tarefamix.sheet.v1';
const STORAGE_MODE = 'tarefamix.mode.v1';

const taskForm = document.getElementById('taskForm');
const taskTitleInput = document.getElementById('taskTitle');
const taskDueInput = document.getElementById('taskDue');
const taskList = document.getElementById('taskList');
const todayCount = document.getElementById('todayCount');

const assistantForm = document.getElementById('assistantForm');
const assistantInput = document.getElementById('assistantInput');
const assistantChat = document.getElementById('assistantChat');
const assistantSend = document.getElementById('assistantSend');

const notesArea = document.getElementById('notesArea');
const timerDisplay = document.getElementById('timerDisplay');
const startTimerBtn = document.getElementById('startTimer');
const resetTimerBtn = document.getElementById('resetTimer');
const reloadBtn = document.getElementById('reloadBtn');
const helpBtn = document.getElementById('helpBtn');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const exportJsonBtn = document.getElementById('exportJsonBtn');
const exportTasksCsvBtn = document.getElementById('exportTasksCsv');

const modeSelect = document.getElementById('modeSelect');

const addRowBtn = document.getElementById('addRowBtn');
const exportSheetCsv = document.getElementById('exportSheetCsv');
const importSheetInput = document.getElementById('importSheetInput');
const sheetTableBody = document.querySelector('#sheetTable tbody');

let tasks = JSON.parse(localStorage.getItem(STORAGE_TASKS) || '[]');
let sheet = JSON.parse(localStorage.getItem(STORAGE_SHEET) || '[]');
let timerSeconds = 25 * 60;
let timerId = null;

// Mode handling
function loadMode(){
  const mode = localStorage.getItem(STORAGE_MODE) || 'student';
  modeSelect.value = mode;
  applyMode(mode);
}
function applyMode(mode){
  const app = document.querySelector('.app-shell');
  app.setAttribute('data-mode', mode);
  // show/hide elements by mode if needed (example: show sheet only in worker mode)
  const sheetCard = document.getElementById('sheetCard');
  if(sheetCard){
    sheetCard.style.display = (mode === 'worker') ? 'block' : 'none';
  }
  localStorage.setItem(STORAGE_MODE, mode);
}
modeSelect.addEventListener('change', (e)=> applyMode(e.target.value));
loadMode();

// Tasks
function saveTasks() {
  localStorage.setItem(STORAGE_TASKS, JSON.stringify(tasks));
  renderTasks();
}

function renderTasks() {
  taskList.innerHTML = '';

  if (!tasks.length) {
    const empty = document.createElement('div');
    empty.className = 'task-item';
    empty.innerHTML = `
      <div class="task-main">
        <div class="task-check"></div>
        <div style="flex:1">
          <div class="task-text">Nenhuma tarefa ainda.</div>
          <div class="task-meta">Adicione sua primeira tarefa acima.</div>
        </div>
      </div>
    `;
    taskList.appendChild(empty);
    todayCount.textContent = '0 tarefas';
    return;
  }

  tasks.forEach((task, index) => {
    const item = document.createElement('div');
    item.className = `task-item ${task.done ? 'done' : ''}`;

    item.innerHTML = `
      <div class="task-main">
        <button type="button" class="task-check" aria-label="Marcar tarefa como concluída" data-index="${index}"></button>
        <div style="flex:1; min-width:0;">
          <div class="task-text">${escapeHtml(task.title)}</div>
          <div class="task-meta">${task.due ? formatDate(task.due) : 'Sem prazo'}</div>
        </div>
      </div>
      <div class="task-actions">
        <button type="button" class="small-btn" data-delete-index="${index}">Apagar</button>
      </div>
    `;

    taskList.appendChild(item);
  });

  const pending = tasks.filter(t => !t.done).length;
  todayCount.textContent = `${pending} tarefas`;
}

function formatDate(dateString) {
  return new Date(dateString + 'T00:00:00').toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'short'
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

taskForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const title = taskTitleInput.value.trim();
  if (!title) return;

  tasks.push({
    title,
    due: taskDueInput.value || null,
    done: false
  });

  taskForm.reset();
  saveTasks();
});

taskList.addEventListener('click', (event) => {
  const toggle = event.target.closest('.task-check');
  if (toggle) {
    const index = Number(toggle.dataset.index);
    if (Number.isFinite(index) && tasks[index]) {
      tasks[index].done = !tasks[index].done;
      saveTasks();
    }
    return;
  }

  const deleteBtn = event.target.closest('[data-delete-index]');
  if (deleteBtn) {
    const index = Number(deleteBtn.dataset.deleteIndex);
    if (Number.isFinite(index) && tasks[index]) {
      tasks.splice(index, 1);
      saveTasks();
    }
  }
});

// Timer
function renderTimer() {
  const minutes = String(Math.floor(timerSeconds / 60)).padStart(2, '0');
  const seconds = String(timerSeconds % 60).padStart(2, '0');
  timerDisplay.textContent = `${minutes}:${seconds}`;
}

startTimerBtn.addEventListener('click', () => {
  if (timerId) return;

  timerId = setInterval(() => {
    timerSeconds -= 1;
    renderTimer();

    if (timerSeconds <= 0) {
      clearInterval(timerId);
      timerId = null;
      timerSeconds = 25 * 60;
      alert('Ciclo concluído! Faça uma pausa.');
      renderTimer();
    }
  }, 1000);
});

resetTimerBtn.addEventListener('click', () => {
  if (timerId) clearInterval(timerId);
  timerId = null;
  timerSeconds = 25 * 60;
  renderTimer();
});

reloadBtn.addEventListener('click', () => location.reload());

helpBtn.addEventListener('click', () => {
  alert('TarefaMix funciona localmente e salva tudo no navegador. Você pode adicionar tarefas, usar o timer e pedir ajuda de estudo sem IA externa. Use Exportar CSV para baixar suas tarefas.');
});

// Assistant
function addAssistantMessage(text, who = 'bot') {
  const el = document.createElement('div');
  el.className = `message ${who}`;
  el.textContent = text;
  assistantChat.appendChild(el);
  assistantChat.scrollTop = assistantChat.scrollHeight;
}

function answerLocalStudyQuestion(question) {
  const q = question.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  if (q.includes('fracao') || q.includes('fracao') || q.includes('fraction') || q.includes('frações')) {
    return 'Para somar frações com denominadores iguais, some os numeradores e mantenha o denominador. Exemplo: 2/7 + 3/7 = 5/7. Se os denominadores forem diferentes, primeiro encontre o mínimo múltiplo comum.';
  }

  if (q.includes('raiz quadrada') || q.includes('raiz')) {
    return 'A raiz quadrada de 25 é 5, porque 5 × 5 = 25. Para calcular outras raízes, procure um número que multiplicado por si mesmo resulte no número original.';
  }

  if (q.includes('fotossintese') || q.includes('fotossintese')) {
    return 'Fotossíntese: plantas usam luz solar, água e dióxido de carbono para produzir glicose e liberar oxigênio.';
  }

  if (q.includes('equacao') || q.includes('equacao')) {
    return 'Para resolver uma equação, isole a incógnita fazendo operações inversas em ambos os lados. Ex: x + 4 = 9 → x = 5.';
  }

  if (q.includes('matematica') || q.includes('matematica')) {
    return 'Matemática envolve números e estruturas. Posso explicar frações, multiplicação, divisões e equações simples.';
  }

  if (q.includes('tempo') || q.includes('foco')) {
    return 'Sugestão: Pomodoro — 25 minutos de foco seguidos por 5 minutos de pausa. Repita 4 ciclos e faça uma pausa maior.';
  }

  return 'Ainda não tenho resposta para isso. Tente perguntar sobre frações, equações simples, fotossíntese ou foco.';
}

assistantSend.addEventListener('click', () => {
  const question = assistantInput.value.trim();
  if (!question) return;

  addAssistantMessage(question, 'user');
  assistantInput.value = '';

  setTimeout(() => {
    addAssistantMessage(answerLocalStudyQuestion(question), 'bot');
  }, 250);
});

assistantForm.addEventListener('submit', (event) => {
  event.preventDefault();
  assistantSend.click();
});

// Notes
notesArea.value = localStorage.getItem(STORAGE_NOTES) || '';
notesArea.addEventListener('input', () => {
  localStorage.setItem(STORAGE_NOTES, notesArea.value);
});

// Export helpers
function download(filename, content, type = 'application/octet-stream') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function exportTasksAsCsv() {
  if (!tasks.length) return alert('Não há tarefas para exportar.');
  const rows = [['Título', 'Prazo', 'Concluída']];
  tasks.forEach(t => rows.push([t.title, t.due || '', t.done ? 'Sim' : 'Não']));
  const csv = rows.map(r => r.map(cell => '"' + String(cell).replace(/"/g, '""') + '"').join(';')).join('\r\n');
  download('tarefas-tarefamix.csv', '\uFEFF' + csv, 'text/csv;charset=utf-8');
}

function exportFullBackupJson() {
  const backup = {
    exportedAt: new Date().toISOString(),
    tasks,
    sheet,
    notes: localStorage.getItem(STORAGE_NOTES) || '',
    mode: localStorage.getItem(STORAGE_MODE) || 'student'
  };
  download('tarefamix-backup-' + new Date().toISOString().slice(0,10) + '.json', JSON.stringify(backup, null, 2), 'application/json');
}

exportCsvBtn.addEventListener('click', () => exportTasksAsCsv());
exportTasksCsvBtn.addEventListener('click', () => exportTasksAsCsv());
exportJsonBtn.addEventListener('click', () => exportFullBackupJson());

// Sheet functions
function saveSheet(){
  localStorage.setItem(STORAGE_SHEET, JSON.stringify(sheet));
  renderSheet();
}

function renderSheet(){
  sheetTableBody.innerHTML = '';
  if(!sheet.length){
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="4" style="opacity:.7">Nenhuma linha. Clique em "＋ Nova linha" para começar.</td>';
    sheetTableBody.appendChild(tr);
    return;
  }
  sheet.forEach((row, i)=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input value="${escapeHtml(row.item||'')}" data-i="${i}" data-field="item"></td>
      <td><input value="${escapeHtml(row.desc||'')}" data-i="${i}" data-field="desc"></td>
      <td><input value="${escapeHtml(row.qty||'')}" data-i="${i}" data-field="qty"></td>
      <td class="sheet-actions"><button class="small-btn" data-delete-row="${i}">Apagar</button></td>
    `;
    sheetTableBody.appendChild(tr);
  });
}

sheetTableBody.addEventListener('input', (e)=>{
  const inp = e.target.closest('input'); if(!inp) return; const i = Number(inp.dataset.i); const f = inp.dataset.field; if(!Number.isFinite(i) || !f) return; sheet[i][f] = inp.value; saveSheet();
});

sheetTableBody.addEventListener('click', (e)=>{
  const del = e.target.closest('[data-delete-row]'); if(!del) return; const i = Number(del.dataset.deleteRow); if(Number.isFinite(i)){ sheet.splice(i,1); saveSheet(); }
});

addRowBtn.addEventListener('click', ()=>{ sheet.push({item:'',desc:'',qty:''}); saveSheet(); });

exportSheetCsv.addEventListener('click', ()=>{
  if(!sheet.length) return alert('Planilha vazia.');
  const rows = [['Item','Descrição','Qtd']];
  sheet.forEach(r=> rows.push([r.item||'', r.desc||'', r.qty||'']));
  const csv = rows.map(r => r.map(c => '"'+String(c).replace(/"/g,'""')+'"').join(';')).join('\r\n');
  download('planilha-tarefamix.csv', '\uFEFF'+csv, 'text/csv;charset=utf-8');
});

importSheetInput.addEventListener('change', (e)=>{
  const f = e.target.files && e.target.files[0]; if(!f) return; const reader = new FileReader(); reader.onload = ()=>{
    try{ const data = JSON.parse(reader.result); if(Array.isArray(data.sheet)) { sheet = data.sheet; saveSheet(); alert('Importação concluída.'); } else { alert('Arquivo inválido: não contém planilha.'); } }catch(err){ alert('Erro ao ler arquivo: '+err.message);} }, reader.readAsText(f);
});

// Load sheet and initial
sheet = sheet || [];
renderSheet();

// initial render
renderTasks();
renderTimer();
renderSheet();
