const DAYS = ['ВОСКРЕСЕНЬЕ','ПОНЕДЕЛЬНИК','ВТОРНИК','СРЕДА','ЧЕТВЕРГ','ПЯТНИЦА','СУББОТА'];
const DAYS_SHORT = ['ВС','ПН','ВТ','СР','ЧТ','ПТ','СБ'];
const MONTHS = ['ЯНВАРЯ','ФЕВРАЛЯ','МАРТА','АПРЕЛЯ','МАЯ','ИЮНЯ','ИЮЛЯ','АВГУСТА','СЕНТЯБРЯ','ОКТЯБРЯ','НОЯБРЯ','ДЕКАБРЯ'];

const defaultTasks = [
    {text:'Подъём 6:00',done:false},
    {text:'Зарядка',done:false},
    {text:'Холодная ванна',done:false},
    {text:'Работа / Фокус',done:false},
    {text:'Сон до 23:00',done:false}
];

function dateKey(d){
    const date = d || new Date();
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function formatDate(d){
    return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function getWeekDates(offset){
    const now = new Date();
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + (offset || 0) * 7);
    const dates = [];
    for(let i = 0; i < 7; i++){
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        dates.push(d);
    }
    return dates;
}

function load(key, fallback){
    try{
        const v = localStorage.getItem('planner_'+key);
        return v ? JSON.parse(v) : fallback;
    }catch(e){return fallback}
}

function save(key, val){
    localStorage.setItem('planner_'+key, JSON.stringify(val));
}

let weekOffset = 0;
let xp = load('xp', {total:0, level:1});
let tasks = load('tasks', {});
let workouts = load('workouts', []);
let state = load('state', {});
let reflection = load('reflection', {});

function saveAll(){
    save('xp', xp);
    save('tasks', tasks);
    save('workouts', workouts);
    save('state', state);
    save('reflection', reflection);
}

function addXP(amount){
    xp.total += amount;
    checkLevelUp();
    saveAll();
    updateXP();
}

function removeXP(amount){
    xp.total = Math.max(0, xp.total - amount);
    if(xp.total < 0) xp.total = 0;
    saveAll();
    updateXP();
}

function checkLevelUp(){
    const threshold = xp.level * 100;
    if(xp.total >= threshold){
        xp.total -= threshold;
        xp.level++;
        showQuest(`УРОВЕНЬ ${xp.level}!`, `Новый уровень!`);
        checkLevelUp();
    }
}

function showQuest(title, desc){
    const popup = document.getElementById('questPopup');
    document.querySelector('.quest-title').textContent = title;
    document.getElementById('questDesc').textContent = desc;
    popup.classList.add('show');
    setTimeout(()=>popup.classList.remove('show'), 2500);
}

function updateXP(){
    document.getElementById('level').textContent = xp.level;
    const threshold = xp.level * 100;
    document.getElementById('xpCurrent').textContent = xp.total;
    document.getElementById('xpMax').textContent = threshold;
    document.getElementById('xpFill').style.width = (xp.total / threshold * 100)+'%';
}

function switchTab(tab){
    document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
    document.querySelectorAll('.nav-btn,.mob-btn').forEach(b=>b.classList.remove('active'));
    document.getElementById('tab-'+tab).classList.add('active');
    document.querySelectorAll(`[data-tab="${tab}"]`).forEach(b=>b.classList.add('active'));
}

function switchSubTab(sub){
    document.querySelectorAll('.sub-tab').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.subtab').forEach(s=>s.classList.remove('active'));
    document.querySelector(`[data-subtab="${sub}"]`).classList.add('active');
    document.getElementById('subtab-'+sub).classList.add('active');
}

function renderToday(){
    const now = new Date();
    const key = dateKey();
    if(!tasks[key]) tasks[key] = defaultTasks.map(t=>({...t}));
    const dayTasks = tasks[key];
    const doneCount = dayTasks.filter(t=>t.done).length;
    const pct = dayTasks.length ? Math.round(doneCount/dayTasks.length*100) : 0;

    document.getElementById('todayTitle').textContent = `${DAYS[now.getDay()]}, ${formatDate(now)}`;
    document.getElementById('todayDone').textContent = doneCount;
    document.getElementById('todayTotal').textContent = dayTasks.length;
    document.getElementById('todayPct').textContent = pct+'%';
    document.getElementById('todayProgressFill').style.width = pct+'%';

    const container = document.getElementById('todayContainer');
    container.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'day-card';
    const list = document.createElement('div');
    list.className = 'task-list';
    dayTasks.forEach((task, i)=>{
        const item = document.createElement('div');
        item.className = 'task-item';
        const cb = document.createElement('div');
        cb.className = 'checkbox' + (task.done ? ' checked' : '');
        const text = document.createElement('span');
        text.className = 'task-text' + (task.done ? ' done' : '');
        text.textContent = task.text;
        item.appendChild(cb);
        item.appendChild(text);
        item.addEventListener('click', ()=>{
            dayTasks[i].done = !dayTasks[i].done;
            if(dayTasks[i].done) addXP(5); else removeXP(5);
            saveAll();
            renderToday();
        });
        list.appendChild(item);
    });
    card.appendChild(list);

    const addBtn = document.createElement('button');
    addBtn.className = 'btn-secondary';
    addBtn.style.cssText = 'margin-top:10px;padding:6px 12px;font-size:11px';
    addBtn.textContent = '+ ДОБАВИТЬ ЗАДАЧУ';
    addBtn.addEventListener('click', ()=>{
        const text = prompt('Название задачи:');
        if(text && text.trim()){
            dayTasks.push({text:text.trim(),done:false});
            saveAll();
            renderToday();
        }
    });
    card.appendChild(addBtn);
    container.appendChild(card);
    saveAll();
}

function renderWeek(){
    const dates = getWeekDates(weekOffset);
    const first = dates[0];
    const last = dates[6];
    document.getElementById('weekRange').textContent = `${formatDate(first)} — ${formatDate(last)}`;
    renderStats(dates);
    renderBarChart(dates);
    renderDonut(dates);
    renderWeekDays(dates);
}

function renderStats(dates){
    let total=0, done=0;
    dates.forEach(d=>{
        const key = dateKey(d);
        const dayTasks = tasks[key] || [];
        total += dayTasks.length;
        done += dayTasks.filter(t=>t.done).length;
    });
    document.getElementById('statTotal').textContent = total;
    document.getElementById('statDone').textContent = done;
    document.getElementById('statFail').textContent = total - done;
}

function renderBarChart(dates){
    const container = document.getElementById('barChart');
    container.innerHTML = '';
    dates.forEach(d=>{
        const key = dateKey(d);
        const dayTasks = tasks[key] || [];
        const pct = dayTasks.length ? Math.round(dayTasks.filter(t=>t.done).length / dayTasks.length * 100) : 0;
        const col = document.createElement('div');
        col.className = 'bar-col';
        const val = document.createElement('div');
        val.className = 'bar-value';
        val.textContent = pct > 0 ? pct+'%' : '';
        const bar = document.createElement('div');
        bar.className = 'bar' + (pct === 0 ? ' empty' : '');
        bar.style.height = Math.max(pct, 4) + '%';
        const label = document.createElement('div');
        label.className = 'bar-label';
        label.textContent = DAYS_SHORT[d.getDay()];
        col.appendChild(val);
        col.appendChild(bar);
        col.appendChild(label);
        container.appendChild(col);
    });
}

function renderDonut(dates){
    let total=0, done=0;
    dates.forEach(d=>{
        const key = dateKey(d);
        const dayTasks = tasks[key] || [];
        total += dayTasks.length;
        done += dayTasks.filter(t=>t.done).length;
    });
    const pct = total ? Math.round(done/total*100) : 0;
    const circumference = 2 * Math.PI * 50;
    const offset = circumference - (pct / 100) * circumference;
    document.getElementById('donutFill').style.strokeDashoffset = offset;
    document.getElementById('donutValue').textContent = pct+'%';
}

function renderWeekDays(dates){
    const container = document.getElementById('weekContainer');
    container.innerHTML = '';
    dates.forEach(d=>{
        const key = dateKey(d);
        if(!tasks[key]) tasks[key] = defaultTasks.map(t=>({...t}));
        const dayTasks = tasks[key];
        const doneCount = dayTasks.filter(t=>t.done).length;
        const pct = dayTasks.length ? Math.round(doneCount/dayTasks.length*100) : 0;
        const card = document.createElement('div');
        card.className = 'day-card';
        const header = document.createElement('div');
        header.className = 'day-header';
        const title = document.createElement('div');
        title.className = 'day-title';
        title.textContent = `${DAYS[d.getDay()]}, ${formatDate(d)}`;
        const percent = document.createElement('div');
        percent.className = 'day-percent';
        percent.textContent = pct+'%';
        header.appendChild(title);
        header.appendChild(percent);
        card.appendChild(header);

        const list = document.createElement('div');
        list.className = 'task-list';
        dayTasks.forEach((task, i)=>{
            const item = document.createElement('div');
            item.className = 'task-item';
            const cb = document.createElement('div');
            cb.className = 'checkbox' + (task.done ? ' checked' : '');
            const text = document.createElement('span');
            text.className = 'task-text' + (task.done ? ' done' : '');
            text.textContent = task.text;
            item.appendChild(cb);
            item.appendChild(text);
            item.addEventListener('click', ()=>{
                dayTasks[i].done = !dayTasks[i].done;
                if(dayTasks[i].done) addXP(5); else removeXP(5);
                saveAll();
                renderWeek();
            });
            list.appendChild(item);
        });
        card.appendChild(list);

        const addBtn = document.createElement('button');
        addBtn.className = 'btn-secondary';
        addBtn.style.cssText = 'margin-top:10px;padding:6px 12px;font-size:11px';
        addBtn.textContent = '+ ДОБАВИТЬ ЗАДАЧУ';
        addBtn.addEventListener('click', ()=>{
            const text = prompt('Название задачи:');
            if(text && text.trim()){
                dayTasks.push({text:text.trim(),done:false});
                saveAll();
                renderWeek();
            }
        });
        card.appendChild(addBtn);
        container.appendChild(card);
    });
    saveAll();
}

function renderState(){
    const today = dateKey();
    const s = state[today] || {};

    document.querySelectorAll('#sleepSelector button').forEach(btn=>{
        btn.classList.toggle('active', parseInt(btn.dataset.value) === s.sleep);
        btn.onclick = ()=>{
            state[today] = state[today] || {};
            state[today].sleep = parseInt(btn.dataset.value);
            saveAll();
            renderState();
        };
    });

    const energyEl = document.getElementById('energySelector');
    energyEl.innerHTML = '';
    for(let i = 1; i <= 5; i++){
        const btn = document.createElement('button');
        btn.textContent = '⚡';
        btn.classList.toggle('active', i <= (s.energy || 0));
        btn.addEventListener('click', ()=>{
            state[today] = state[today] || {};
            state[today].energy = i;
            saveAll();
            renderState();
        });
        energyEl.appendChild(btn);
    }

    document.querySelectorAll('#moodSelector button').forEach(btn=>{
        btn.classList.toggle('active', parseInt(btn.dataset.value) === s.mood);
        btn.onclick = ()=>{
            state[today] = state[today] || {};
            state[today].mood = parseInt(btn.dataset.value);
            saveAll();
            renderState();
        };
    });
}

function renderWorkouts(){
    const list = document.getElementById('workoutList');
    list.innerHTML = '';
    if(workouts.length === 0){
        list.innerHTML = '<div style="text-align:center;color:var(--text3);padding:40px;font-size:13px">Нет тренировок. Добавьте первую!</div>';
        return;
    }
    workouts.forEach((w, wi)=>{
        const card = document.createElement('div');
        card.className = 'workout-card';
        const header = document.createElement('div');
        header.className = 'workout-header';
        const title = document.createElement('div');
        title.className = 'workout-title';
        title.textContent = w.name;
        const date = document.createElement('div');
        date.className = 'workout-date';
        date.textContent = w.date;
        header.appendChild(title);
        header.appendChild(date);
        card.appendChild(header);

        const table = document.createElement('table');
        table.className = 'workout-table';
        const thead = document.createElement('thead');
        thead.innerHTML = '<tr><th>УПРАЖНЕНИЕ</th><th>П</th><th>ТЕК</th><th>ПРЕД Р-ЦА</th><th>✓</th></tr>';
        table.appendChild(thead);
        const tbody = document.createElement('tbody');
        w.exercises.forEach((ex, ei)=>{
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><input type="text" value="${ex.name}" data-w="${wi}" data-e="${ei}" data-f="name"></td>
                <td><input type="text" value="${ex.sets}" data-w="${wi}" data-e="${ei}" data-f="sets" style="width:40px"></td>
                <td><input type="text" value="${ex.current}" data-w="${wi}" data-e="${ei}" data-f="current" style="width:50px"></td>
                <td><input type="text" value="${ex.prev}" data-w="${wi}" data-e="${ei}" data-f="prev" style="width:50px"></td>
                <td class="check-cell"><div class="checkbox${ex.done?' checked':''}" data-w="${wi}" data-e="${ei}"></div></td>
            `;
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        card.appendChild(table);
        list.appendChild(card);
    });

    list.querySelectorAll('input').forEach(inp=>{
        inp.addEventListener('change', ()=>{
            const w = parseInt(inp.dataset.w);
            const e = parseInt(inp.dataset.e);
            workouts[w].exercises[e][inp.dataset.f] = inp.value;
            saveAll();
        });
    });

    list.querySelectorAll('.checkbox').forEach(cb=>{
        cb.addEventListener('click', ()=>{
            const w = parseInt(cb.dataset.w);
            const e = parseInt(cb.dataset.e);
            workouts[w].exercises[e].done = !workouts[w].exercises[e].done;
            if(workouts[w].exercises[e].done) addXP(3); else removeXP(3);
            saveAll();
            renderWorkouts();
        });
    });
}

function renderReflection(){
    const today = dateKey();
    const r = reflection[today] || {};

    document.getElementById('lessonOfDay').value = r.lesson || '';
    document.getElementById('dailyNotes').value = r.notes || '';

    document.getElementById('lessonOfDay').addEventListener('input', function(){
        reflection[today] = reflection[today] || {};
        reflection[today].lesson = this.value;
        saveAll();
        renderLessonHistory();
    });

    document.getElementById('dailyNotes').addEventListener('input', function(){
        reflection[today] = reflection[today] || {};
        reflection[today].notes = this.value;
        saveAll();
    });

    renderLessonHistory();
}

function renderLessonHistory(){
    const container = document.getElementById('lessonHistory');
    container.innerHTML = '';
    const entries = Object.entries(reflection)
        .filter(([k,v])=>v.lesson && k !== dateKey())
        .sort((a,b)=>b[0].localeCompare(a[0]))
        .slice(0, 10);
    if(entries.length === 0){
        container.innerHTML = '<div style="color:var(--text3);font-size:12px;padding:8px 0">Пока нет записей</div>';
        return;
    }
    entries.forEach(([key, val])=>{
        const item = document.createElement('div');
        item.className = 'lesson-item';
        const d = new Date(key);
        item.innerHTML = `<div class="lesson-date">${formatDate(d).toUpperCase()}</div><div class="lesson-text">${val.lesson}</div>`;
        container.appendChild(item);
    });
}

let exerciseCount = 0;
function addExerciseRow(){
    exerciseCount++;
    const list = document.getElementById('exerciseList');
    const row = document.createElement('div');
    row.className = 'exercise-row';
    row.innerHTML = `
        <input type="text" placeholder="Упражнение" class="ex-name">
        <input type="text" placeholder="П" class="ex-sets">
        <input type="text" placeholder="Тек" class="ex-cur">
        <input type="text" placeholder="Пред" class="ex-prev">
        <button class="btn-icon remove-ex" style="color:var(--fail);font-size:16px">✕</button>
    `;
    row.querySelector('.remove-ex').addEventListener('click', ()=>row.remove());
    list.appendChild(row);
}

function init(){
    updateXP();

    document.querySelectorAll('.nav-btn,.mob-btn').forEach(btn=>{
        btn.addEventListener('click', ()=>switchTab(btn.dataset.tab));
    });

    document.querySelectorAll('.sub-tab').forEach(btn=>{
        btn.addEventListener('click', ()=>switchSubTab(btn.dataset.subtab));
    });

    document.getElementById('prevWeek').addEventListener('click', ()=>{weekOffset--;renderWeek()});
    document.getElementById('nextWeek').addEventListener('click', ()=>{weekOffset++;renderWeek()});

    document.getElementById('addWorkout').addEventListener('click', ()=>{
        exerciseCount = 0;
        document.getElementById('workoutName').value = '';
        document.getElementById('exerciseList').innerHTML = '';
        addExerciseRow();
        document.getElementById('workoutModal').classList.add('show');
    });

    document.getElementById('closeModal').addEventListener('click', ()=>{
        document.getElementById('workoutModal').classList.remove('show');
    });

    document.getElementById('addExercise').addEventListener('click', addExerciseRow);

    document.getElementById('saveWorkout').addEventListener('click', ()=>{
        const name = document.getElementById('workoutName').value.trim() || `Тренировка #${workouts.length+1}`;
        const rows = document.querySelectorAll('.exercise-row');
        const exercises = [];
        rows.forEach(row=>{
            const ename = row.querySelector('.ex-name').value.trim();
            if(ename){
                exercises.push({
                    name: ename,
                    sets: row.querySelector('.ex-sets').value.trim() || '3',
                    current: row.querySelector('.ex-cur').value.trim() || '0',
                    prev: row.querySelector('.ex-prev').value.trim() || '0',
                    done: false
                });
            }
        });
        if(exercises.length > 0){
            const now = new Date();
            workouts.unshift({
                name: name,
                date: `${formatDate(now).toUpperCase()}, ${now.getFullYear()}`,
                exercises: exercises
            });
            saveAll();
            renderWorkouts();
            addXP(15);
        }
        document.getElementById('workoutModal').classList.remove('show');
    });

    renderToday();
    renderWeek();
    renderState();
    renderWorkouts();
    renderReflection();
}

document.addEventListener('DOMContentLoaded', init);
