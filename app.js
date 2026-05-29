const DAYS = ['ВОСКРЕСЕНЬЕ','ПОНЕДЕЛЬНИК','ВТОРНИК','СРЕДА','ЧЕТВЕРГ','ПЯТНИЦА','СУББОТА'];
const DAYS_SHORT = ['ПН','ВТ','СР','ЧТ','ПТ','СБ','ВС'];
const DAYS_CAL = ['ПН','ВТ','СР','ЧТ','ПТ','СБ','ВС'];
const MONTHS = ['ЯНВАРЯ','ФЕВРАЛЯ','МАРТА','АПРЕЛЯ','МАЯ','ИЮНЯ','ИЮЛЯ','АВГУСТА','СЕНТЯБРЯ','ОКТЯБРЯ','НОЯБРЯ','ДЕКАБРЯ'];

function dateKey(d){
    const date = d || new Date();
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
function formatDate(d){ return `${d.getDate()} ${MONTHS[d.getMonth()]}`; }
function getWeekDates(offset){
    const now = new Date();
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + (offset || 0) * 7);
    const dates = [];
    for(let i = 0; i < 7; i++){ const d = new Date(monday); d.setDate(monday.getDate() + i); dates.push(d); }
    return dates;
}
function load(key, fallback){
    try{ const v = localStorage.getItem('planner_'+key); return v ? JSON.parse(v) : fallback; }catch(e){return fallback}
}
function save(key, val){ localStorage.setItem('planner_'+key, JSON.stringify(val)); }

let weekOffset = 0, calMonth = new Date().getMonth(), calYear = new Date().getFullYear(), calSelected = null;
let xp = load('xp', {total:0, level:1});
let tasks = load('tasks', {});
let workouts = load('workouts', []);
let state = load('state', {});
let reflection = load('reflection', {});
let settings = load('settings', {name:'', defaultTasks:['Подъём 6:00','Зарядка','Холодная ванна','Работа / Фокус','Сон до 23:00'], remindMorning:'07:00', remindEvening:'21:00'});
let pomodoro = load('pomodoro', {total:0, today:dateKey(), todayCount:0});
let dailyQuests = load('dailyQuests', {});
let achievementsData = load('achievements', {});

function getDefaultTasks(){ return (settings.defaultTasks || []).map(t=>({text:t,done:false})); }
function saveAll(){ save('xp',xp); save('tasks',tasks); save('workouts',workouts); save('state',state); save('reflection',reflection); save('settings',settings); save('pomodoro',pomodoro); save('dailyQuests',dailyQuests); save('achievements',achievementsData); }

function addXP(amount){ xp.total += amount; checkLevelUp(); saveAll(); updateXP(); checkAchievements(); }
function removeXP(amount){ xp.total = Math.max(0, xp.total - amount); saveAll(); updateXP(); }
function checkLevelUp(){
    const threshold = xp.level * 100;
    if(xp.total >= threshold){ xp.total -= threshold; xp.level++; showQuest(`УРОВЕНЬ ${xp.level}!`, 'Новый уровень!'); checkLevelUp(); }
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
    if(tab==='calendar') renderCalendar();
    if(tab==='timer') renderTimer();
    if(tab==='achievements') renderAchievements();
    if(tab==='settings') renderSettings();
}
function switchSubTab(sub){
    document.querySelectorAll('.sub-tab').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.subtab').forEach(s=>s.classList.remove('active'));
    document.querySelector(`[data-subtab="${sub}"]`).classList.add('active');
    document.getElementById('subtab-'+sub).classList.add('active');
}

// === STREAK ===
function calcStreak(){
    let streak = 0;
    const today = new Date();
    for(let i = 0; i < 365; i++){
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const key = dateKey(d);
        const dayTasks = tasks[key];
        if(!dayTasks) { if(i===0) continue; break; }
        const doneCount = dayTasks.filter(t=>t.done).length;
        if(doneCount === dayTasks.length && dayTasks.length > 0) streak++;
        else { if(i===0) continue; break; }
    }
    return streak;
}

// === DAILY QUESTS ===
const QUEST_POOL = [
    'Пробежать 3 км','Прочитать 20 страниц','Медитация 10 минут','Выпить 8 стаканов воды',
    'Прибраться в комнате','Позвонить близкому человеку','Написать 3 вещи за которые благодарен',
    'Сделать растяжку 15 минут','Готовить еду самому','Не использовать соцсети 2 часа',
    'Пройти 10000 шагов','Пораньше лечь спать','Сделать доброе дело','Учить что-то новое 30 минут',
    'Написать план на завтра','Сделать холодный душ','Отказаться от сладкого сегодня',
    'Провести время на свежем воздухе','Написать письмо себе будущему','Попрактиковать навык 1 час'
];
function getDailyQuest(){
    const today = dateKey();
    if(!dailyQuests[today]){
        const idx = (new Date().getFullYear() * 366 + new Date().getMonth() * 31 + new Date().getDate()) % QUEST_POOL.length;
        dailyQuests[today] = {text: QUEST_POOL[idx], done: false};
        saveAll();
    }
    return dailyQuests[today];
}
function renderDailyQuest(){
    const quest = getDailyQuest();
    document.getElementById('questText').textContent = quest.text;
    const cb = document.getElementById('questCheckbox');
    cb.className = 'checkbox' + (quest.done ? ' checked' : '');
    document.getElementById('dailyQuestCard').onclick = ()=>{
        quest.done = !quest.done;
        if(quest.done) addXP(10); else removeXP(10);
        saveAll();
        renderDailyQuest();
    };
}

// === TODAY ===
function renderToday(){
    const now = new Date();
    const key = dateKey();
    if(!tasks[key]) tasks[key] = getDefaultTasks();
    const dayTasks = tasks[key];
    const doneCount = dayTasks.filter(t=>t.done).length;
    const pct = dayTasks.length ? Math.round(doneCount/dayTasks.length*100) : 0;
    document.getElementById('todayTitle').textContent = `${DAYS[now.getDay()]}, ${formatDate(now)}`;
    document.getElementById('todayDone').textContent = doneCount;
    document.getElementById('todayTotal').textContent = dayTasks.length;
    document.getElementById('todayPct').textContent = pct+'%';
    document.getElementById('todayProgressFill').style.width = pct+'%';
    document.getElementById('streakCount').textContent = calcStreak();
    renderDailyQuest();
    const container = document.getElementById('todayContainer');
    container.innerHTML = '';
    const card = document.createElement('div'); card.className = 'day-card';
    const list = document.createElement('div'); list.className = 'task-list';
    dayTasks.forEach((task, i)=>{
        const item = document.createElement('div'); item.className = 'task-item';
        const cb = document.createElement('div'); cb.className = 'checkbox'+(task.done?' checked':'');
        const text = document.createElement('span'); text.className = 'task-text'+(task.done?' done':''); text.textContent = task.text;
        item.appendChild(cb); item.appendChild(text);
        item.addEventListener('click', ()=>{ dayTasks[i].done=!dayTasks[i].done; if(dayTasks[i].done) addXP(5); else removeXP(5); saveAll(); renderToday(); });
        list.appendChild(item);
    });
    card.appendChild(list);
    const addBtn = document.createElement('button'); addBtn.className='btn-secondary'; addBtn.style.cssText='margin-top:10px;padding:6px 12px;font-size:11px'; addBtn.textContent='+ ДОБАВИТЬ ЗАДАЧУ';
    addBtn.addEventListener('click', ()=>{ showInlineInput(card, dayTasks, ()=>renderToday()); });
    card.appendChild(addBtn);
    container.appendChild(card);
    saveAll();
}

// === WEEK ===
function renderWeek(){
    const dates = getWeekDates(weekOffset);
    document.getElementById('weekRange').textContent = `${formatDate(dates[0])} — ${formatDate(dates[6])}`;
    renderStats(dates); renderBarChart(dates); renderDonut(dates); renderWeekDays(dates);
}
function renderStats(dates){
    let total=0,done=0;
    dates.forEach(d=>{const k=dateKey(d);const t=tasks[k]||[];total+=t.length;done+=t.filter(x=>x.done).length;});
    document.getElementById('statTotal').textContent=total;
    document.getElementById('statDone').textContent=done;
    document.getElementById('statFail').textContent=total-done;
}
function renderBarChart(dates){
    const c=document.getElementById('barChart'); c.innerHTML='';
    dates.forEach(d=>{
        const k=dateKey(d),t=tasks[k]||[],pct=t.length?Math.round(t.filter(x=>x.done).length/t.length*100):0;
        const col=document.createElement('div');col.className='bar-col';
        const val=document.createElement('div');val.className='bar-value';val.textContent=pct>0?pct+'%':'';
        const bar=document.createElement('div');bar.className='bar'+(pct===0?' empty':'');bar.style.height=Math.max(pct,4)+'%';
        const label=document.createElement('div');label.className='bar-label';label.textContent=DAYS_CAL[d.getDay()===0?6:d.getDay()-1];
        col.appendChild(val);col.appendChild(bar);col.appendChild(label);c.appendChild(col);
    });
}
function renderDonut(dates){
    let total=0,done=0;
    dates.forEach(d=>{const k=dateKey(d),t=tasks[k]||[];total+=t.length;done+=t.filter(x=>x.done).length;});
    const pct=total?Math.round(done/total*100):0;
    document.getElementById('donutFill').style.strokeDashoffset=314.16-(pct/100)*314.16;
    document.getElementById('donutValue').textContent=pct+'%';
}
function renderWeekDays(dates){
    const container=document.getElementById('weekContainer');container.innerHTML='';
    dates.forEach(d=>{
        const key=dateKey(d); if(!tasks[key]) tasks[key]=getDefaultTasks();
        const dayTasks=tasks[key],doneCount=dayTasks.filter(t=>t.done).length,pct=dayTasks.length?Math.round(doneCount/dayTasks.length*100):0;
        const card=document.createElement('div');card.className='day-card';
        const header=document.createElement('div');header.className='day-header';
        const title=document.createElement('div');title.className='day-title';title.textContent=`${DAYS[d.getDay()]}, ${formatDate(d)}`;
        const percent=document.createElement('div');percent.className='day-percent';percent.textContent=pct+'%';
        header.appendChild(title);header.appendChild(percent);card.appendChild(header);
        const list=document.createElement('div');list.className='task-list';
        dayTasks.forEach((task,i)=>{
            const item=document.createElement('div');item.className='task-item';
            const cb=document.createElement('div');cb.className='checkbox'+(task.done?' checked':'');
            const text=document.createElement('span');text.className='task-text'+(task.done?' done':'');text.textContent=task.text;
            item.appendChild(cb);item.appendChild(text);
            item.addEventListener('click',()=>{dayTasks[i].done=!dayTasks[i].done;if(dayTasks[i].done)addXP(5);else removeXP(5);saveAll();renderWeek();});
            list.appendChild(item);
        });
        card.appendChild(list);
        const addBtn=document.createElement('button');addBtn.className='btn-secondary';addBtn.style.cssText='margin-top:10px;padding:6px 12px;font-size:11px';addBtn.textContent='+ ДОБАВИТЬ ЗАДАЧУ';
        addBtn.addEventListener('click',()=>{showInlineInput(card,dayTasks,()=>renderWeek());});
        card.appendChild(addBtn);container.appendChild(card);
    });
    saveAll();
}

// === CALENDAR ===
function renderCalendar(){
    document.getElementById('monthLabel').textContent = `${MONTHS[calMonth].toUpperCase()} ${calYear}`;
    const grid = document.getElementById('calendarGrid'); grid.innerHTML = '';
    DAYS_CAL.forEach(d=>{const h=document.createElement('div');h.className='cal-header';h.textContent=d;grid.appendChild(h);});
    const first = new Date(calYear, calMonth, 1);
    let startDay = first.getDay() - 1; if(startDay < 0) startDay = 6;
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const prevDays = new Date(calYear, calMonth, 0).getDate();
    const today = dateKey();
    for(let i = startDay - 1; i >= 0; i--){
        const cell = document.createElement('div'); cell.className = 'cal-day other-month';
        cell.innerHTML = `<span>${prevDays - i}</span><span class="cal-dot"></span>`;
        grid.appendChild(cell);
    }
    for(let d = 1; d <= daysInMonth; d++){
        const dt = new Date(calYear, calMonth, d);
        const key = dateKey(dt);
        const cell = document.createElement('div');
        cell.className = 'cal-day' + (key === today ? ' today' : '') + (tasks[key] ? ' has-data' : '') + (calSelected === key ? ' selected' : '');
        cell.innerHTML = `<span>${d}</span><span class="cal-dot"></span>`;
        cell.addEventListener('click', ()=>{ calSelected = key; renderCalendar(); renderCalendarDay(key, dt); });
        grid.appendChild(cell);
    }
    const remaining = 42 - (startDay + daysInMonth);
    for(let i = 1; i <= remaining; i++){
        const cell = document.createElement('div'); cell.className = 'cal-day other-month';
        cell.innerHTML = `<span>${i}</span><span class="cal-dot"></span>`;
        grid.appendChild(cell);
    }
}
function renderCalendarDay(key, dt){
    document.getElementById('calDayTitle').textContent = `${DAYS[dt.getDay()]}, ${formatDate(dt)}`;
    const container = document.getElementById('calDayTasks'); container.innerHTML = '';
    const dayTasks = tasks[key];
    if(!dayTasks || dayTasks.length === 0){ container.innerHTML = '<div style="color:var(--text3);font-size:12px;padding:8px 0">Нет задач</div>'; return; }
    dayTasks.forEach((task,i)=>{
        const item = document.createElement('div'); item.className = 'task-item';
        const cb = document.createElement('div'); cb.className = 'checkbox'+(task.done?' checked':'');
        const text = document.createElement('span'); text.className = 'task-text'+(task.done?' done':''); text.textContent = task.text;
        item.appendChild(cb); item.appendChild(text);
        item.addEventListener('click',()=>{dayTasks[i].done=!dayTasks[i].done;if(dayTasks[i].done)addXP(5);else removeXP(5);saveAll();renderCalendarDay(key,dt);});
        container.appendChild(item);
    });
}

// === STATE (sleep, energy, mood) ===
function renderState(){
    const today = dateKey(), s = state[today] || {};
    document.querySelectorAll('#sleepSelector button').forEach(btn=>{
        btn.classList.toggle('active', parseInt(btn.dataset.value)===s.sleep);
        btn.onclick = ()=>{ state[today]=state[today]||{}; state[today].sleep=parseInt(btn.dataset.value); saveAll(); renderState(); };
    });
    const energyEl = document.getElementById('energySelector'); energyEl.innerHTML = '';
    for(let i=1;i<=5;i++){
        const btn=document.createElement('button');btn.textContent='⚡';btn.classList.toggle('active',i<=(s.energy||0));
        btn.addEventListener('click',()=>{state[today]=state[today]||{};state[today].energy=i;saveAll();renderState();});
        energyEl.appendChild(btn);
    }
    document.querySelectorAll('#moodSelector button').forEach(btn=>{
        btn.classList.toggle('active',parseInt(btn.dataset.value)===s.mood);
        btn.onclick=()=>{state[today]=state[today]||{};state[today].mood=parseInt(btn.dataset.value);saveAll();renderState();};
    });
}

// === WORKOUTS ===
function renderWorkouts(){
    const list=document.getElementById('workoutList');list.innerHTML='';
    if(!workouts.length){list.innerHTML='<div style="text-align:center;color:var(--text3);padding:40px;font-size:13px">Нет тренировок</div>';return;}
    workouts.forEach((w,wi)=>{
        const card=document.createElement('div');card.className='workout-card';
        const header=document.createElement('div');header.className='workout-header';
        const title=document.createElement('div');title.className='workout-title';title.textContent=w.name;
        const date=document.createElement('div');date.className='workout-date';date.textContent=w.date;
        header.appendChild(title);header.appendChild(date);card.appendChild(header);
        const table=document.createElement('table');table.className='workout-table';
        table.innerHTML='<thead><tr><th>УПРАЖНЕНИЕ</th><th>П</th><th>ТЕК</th><th>ПРЕД</th><th>✓</th></tr></thead>';
        const tbody=document.createElement('tbody');
        w.exercises.forEach((ex,ei)=>{
            const tr=document.createElement('tr');
            tr.innerHTML=`<td><input type="text" value="${ex.name}" data-w="${wi}" data-e="${ei}" data-f="name"></td><td><input type="text" value="${ex.sets}" data-w="${wi}" data-e="${ei}" data-f="sets" style="width:40px"></td><td><input type="text" value="${ex.current}" data-w="${wi}" data-e="${ei}" data-f="current" style="width:50px"></td><td><input type="text" value="${ex.prev}" data-w="${wi}" data-e="${ei}" data-f="prev" style="width:50px"></td><td class="check-cell"><div class="checkbox${ex.done?' checked':''}" data-w="${wi}" data-e="${ei}"></div></td>`;
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);card.appendChild(table);list.appendChild(card);
    });
    list.querySelectorAll('input').forEach(inp=>{inp.addEventListener('change',()=>{workouts[inp.dataset.w].exercises[inp.dataset.e][inp.dataset.f]=inp.value;saveAll();});});
    list.querySelectorAll('.checkbox').forEach(cb=>{cb.addEventListener('click',()=>{const w=parseInt(cb.dataset.w),e=parseInt(cb.dataset.e);workouts[w].exercises[e].done=!workouts[w].exercises[e].done;if(workouts[w].exercises[e].done)addXP(3);else removeXP(3);saveAll();renderWorkouts();});});
}

// === POMODORO TIMER ===
let timerInterval = null, timerRunning = false, timerSeconds = 0, timerTotal = 0, timerMode = 'work';
function renderTimer(){
    if(pomodoro.today !== dateKey()){ pomodoro.today = dateKey(); pomodoro.todayCount = 0; saveAll(); }
    document.getElementById('pomodoroCount').textContent = pomodoro.todayCount;
    document.getElementById('pomodoroTotal').textContent = pomodoro.total;
    updateTimerDisplay();
}
function updateTimerDisplay(){
    const mins = Math.floor(timerSeconds/60), secs = timerSeconds%60;
    document.getElementById('timerTime').textContent = `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
    document.getElementById('timerLabel').textContent = timerMode==='work'?'ФОКУС':'ОТДЫХ';
    const circ = 2 * Math.PI * 90;
    document.getElementById('timerFill').style.strokeDasharray = circ;
    document.getElementById('timerFill').style.strokeDashoffset = timerTotal > 0 ? circ * (1 - timerSeconds / timerTotal) : 0;
}
function startTimer(){
    if(timerRunning){ clearInterval(timerInterval); timerRunning=false; document.getElementById('timerStart').textContent='ПРОДОЛЖИТЬ'; return; }
    if(timerSeconds === 0){
        const workMins = parseInt(document.getElementById('pomWork').value) || 25;
        const restMins = parseInt(document.getElementById('pomRest').value) || 5;
        if(timerMode==='work'){ timerSeconds=workMins*60; timerTotal=timerSeconds; }
        else{ timerSeconds=restMins*60; timerTotal=timerSeconds; }
    }
    timerRunning = true; document.getElementById('timerStart').textContent='ПАУЗА';
    timerInterval = setInterval(()=>{
        timerSeconds--;
        if(timerSeconds <= 0){
            clearInterval(timerInterval); timerRunning=false;
            if(timerMode==='work'){
                pomodoro.todayCount++; pomodoro.total++; addXP(20);
                showQuest('ПОМОДОРО ЗАВЕРШЁН!','+20 XP');
                timerMode='rest';
            } else { timerMode='work'; }
            timerSeconds=0; document.getElementById('timerStart').textContent='СТАРТ';
            saveAll(); renderTimer();
        }
        updateTimerDisplay();
    }, 1000);
}
function resetTimer(){ clearInterval(timerInterval); timerRunning=false; timerSeconds=0; timerTotal=0; timerMode='work'; document.getElementById('timerStart').textContent='СТАРТ'; updateTimerDisplay(); }

// === ACHIEVEMENTS ===
const ACHIEVEMENTS = [
    {id:'first_task',icon:'🎯',name:'Первый шаг',desc:'Выполни первую задачу'},
    {id:'streak_3',icon:'🔥',name:'Серия 3 дня',desc:'3 дня подряд все задачи'},
    {id:'streak_7',icon:'⚡',name:'Неделя дисциплины',desc:'7 дней подряд все задачи'},
    {id:'streak_30',icon:'💎',name:'Месяц силы',desc:'30 дней подряд все задачи'},
    {id:'tasks_50',icon:'✅',name:'Полтинник',desc:'Выполни 50 задач'},
    {id:'tasks_100',icon:'💯',name:'Сотня',desc:'Выполни 100 задач'},
    {id:'tasks_500',icon:'🏆',name:'Мастер',desc:'Выполни 500 задач'},
    {id:'workout_1',icon:'💪',name:'Железо',desc:'Запиши первую тренировку'},
    {id:'workout_10',icon:'🏋️',name:'Атлет',desc:'Запиши 10 тренировок'},
    {id:'level_5',icon:'⭐',name:'Подъём',desc:'Достигни 5 уровня'},
    {id:'level_10',icon:'🌟',name:'Восхождение',desc:'Достигни 10 уровня'},
    {id:'pomodoro_1',icon:'🍅',name:'Фокус',desc:'Заверши первый помодоро'},
    {id:'pomodoro_10',icon:'⏰',name:'Тайм-мастер',desc:'Заверши 10 помодоро'},
    {id:'quest_1',icon:'⚔️',name:'Квестер',desc:'Выполни первый квест дня'},
    {id:'quest_10',icon:'🗡️',name:'Искатель',desc:'Выполни 10 квестов дня'},
    {id:'reflect_1',icon:'📝',name:'Рефлексия',desc:'Напиши первый урок дня'},
    {id:'reflect_7',icon:'📖',name:'Философ',desc:'Напиши 7 уроков дня'},
];
function checkAchievements(){
    let totalDone = 0;
    Object.values(tasks).forEach(dt=>{ totalDone += dt.filter(t=>t.done).length; });
    const streak = calcStreak();
    const questsDone = Object.values(dailyQuests).filter(q=>q.done).length;
    const lessonsDone = Object.values(reflection).filter(r=>r.lesson).length;
    const checks = {
        first_task: totalDone >= 1, tasks_50: totalDone >= 50, tasks_100: totalDone >= 100, tasks_500: totalDone >= 500,
        streak_3: streak >= 3, streak_7: streak >= 7, streak_30: streak >= 30,
        workout_1: workouts.length >= 1, workout_10: workouts.length >= 10,
        level_5: xp.level >= 5, level_10: xp.level >= 10,
        pomodoro_1: pomodoro.total >= 1, pomodoro_10: pomodoro.total >= 10,
        quest_1: questsDone >= 1, quest_10: questsDone >= 10,
        reflect_1: lessonsDone >= 1, reflect_7: lessonsDone >= 7,
    };
    let newUnlock = false;
    Object.entries(checks).forEach(([id, met])=>{
        if(met && !achievementsData[id]){ achievementsData[id] = true; newUnlock = true; }
    });
    if(newUnlock){ saveAll(); showQuest('ДОСТИЖЕНИЕ РАЗБЛОКИРОВАНО!','Проверь вкладку Достижения'); }
}
function renderAchievements(){
    const grid = document.getElementById('achievementsGrid'); grid.innerHTML = '';
    ACHIEVEMENTS.forEach(a=>{
        const card = document.createElement('div');
        card.className = 'ach-card' + (achievementsData[a.id] ? ' unlocked' : '');
        card.innerHTML = `<div class="ach-icon">${a.icon}</div><div class="ach-name">${a.name}</div><div class="ach-desc">${a.desc}</div>`;
        grid.appendChild(card);
    });
}

// === REFLECTION ===
function renderReflection(){
    const today=dateKey(), r=reflection[today]||{};
    document.getElementById('lessonOfDay').value=r.lesson||'';
    document.getElementById('dailyNotes').value=r.notes||'';
    document.getElementById('lessonOfDay').addEventListener('input',function(){reflection[today]=reflection[today]||{};reflection[today].lesson=this.value;saveAll();renderLessonHistory();checkAchievements();});
    document.getElementById('dailyNotes').addEventListener('input',function(){reflection[today]=reflection[today]||{};reflection[today].notes=this.value;saveAll();});
    renderLessonHistory();
}
function renderLessonHistory(){
    const container=document.getElementById('lessonHistory');container.innerHTML='';
    const entries=Object.entries(reflection).filter(([k,v])=>v.lesson&&k!==dateKey()).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,10);
    if(!entries.length){container.innerHTML='<div style="color:var(--text3);font-size:12px;padding:8px 0">Пока нет записей</div>';return;}
    entries.forEach(([key,val])=>{const item=document.createElement('div');item.className='lesson-item';const d=new Date(key);item.innerHTML=`<div class="lesson-date">${formatDate(d).toUpperCase()}</div><div class="lesson-text">${val.lesson}</div>`;container.appendChild(item);});
}

// === SETTINGS ===
function renderSettings(){
    document.getElementById('settingsName').value = settings.name || '';
    document.getElementById('remindMorning').value = settings.remindMorning || '07:00';
    document.getElementById('remindEvening').value = settings.remindEvening || '21:00';
    const list = document.getElementById('defaultTasksList'); list.innerHTML = '';
    (settings.defaultTasks || []).forEach((t, i) => {
        const item = document.createElement('div'); item.className = 'task-item';
        item.innerHTML = `<span class="task-text">${t}</span>`;
        const del = document.createElement('button'); del.className='btn-icon'; del.style.cssText='color:var(--fail);margin-left:auto'; del.textContent='✕';
        del.addEventListener('click',()=>{settings.defaultTasks.splice(i,1);saveAll();renderSettings();});
        item.appendChild(del); list.appendChild(item);
    });
    document.getElementById('settingsName').oninput = function(){ settings.name=this.value; saveAll(); };
    document.getElementById('remindMorning').onchange = function(){ settings.remindMorning=this.value; saveAll(); setupReminders(); };
    document.getElementById('remindEvening').onchange = function(){ settings.remindEvening=this.value; saveAll(); setupReminders(); };
}

// === NOTIFICATIONS ===
function setupReminders(){
    if(!('Notification' in window)) { document.getElementById('notifStatus').textContent='Уведомления не поддерживаются'; return; }
    const scheduleReminder = (time, body) => {
        const [h,m] = time.split(':').map(Number);
        const now = new Date();
        const target = new Date(now); target.setHours(h,m,0,0);
        if(target <= now) target.setDate(target.getDate()+1);
        const delay = target - now;
        setTimeout(()=>{
            new Notification('ПЛАНЕР', { body: body, icon: 'icon-192.png' });
            setInterval(()=>{ new Notification('ПЛАНЕР', { body: body, icon: 'icon-192.png' }); }, 86400000);
        }, delay);
    };
    scheduleReminder(settings.remindMorning, `${settings.name||'Время'} планировать день!`);
    scheduleReminder(settings.remindEvening, `${settings.name||'Время'} подвести итоги дня!`);
}
function enableNotifications(){
    if(!('Notification' in window)) return;
    Notification.requestPermission().then(p=>{
        document.getElementById('notifStatus').textContent = p==='granted' ? 'Уведомления включены' : 'Уведомления отклонены';
        if(p==='granted') setupReminders();
    });
}

// === EXPORT/IMPORT ===
function exportData(){
    const data = {xp,tasks,workouts,state,reflection,settings,pomodoro,dailyQuests,achievementsData};
    const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
    const a = document.createElement('a'); a.href=URL.createObjectURL(blob);
    a.download = `planner_backup_${dateKey()}.json`; a.click();
}
function importData(file){
    const reader = new FileReader();
    reader.onload = (e)=>{
        try{
            const data = JSON.parse(e.target.result);
            if(data.xp) xp=data.xp; if(data.tasks) tasks=data.tasks; if(data.workouts) workouts=data.workouts;
            if(data.state) state=data.state; if(data.reflection) reflection=data.reflection;
            if(data.settings) settings=data.settings; if(data.pomodoro) pomodoro=data.pomodoro;
            if(data.dailyQuests) dailyQuests=data.dailyQuests; if(data.achievementsData) achievementsData=data.achievementsData;
            saveAll(); location.reload();
        }catch(err){ alert('Ошибка импорта: '+err.message); }
    };
    reader.readAsText(file);
}

// === EXERCISE MODAL ===
let exerciseCount = 0;
function addExerciseRow(){
    exerciseCount++;
    const list=document.getElementById('exerciseList');
    const row=document.createElement('div');row.className='exercise-row';
    row.innerHTML=`<input type="text" placeholder="Упражнение" class="ex-name"><input type="text" placeholder="П" class="ex-sets"><input type="text" placeholder="Тек" class="ex-cur"><input type="text" placeholder="Пред" class="ex-prev"><button class="btn-icon remove-ex" style="color:var(--fail);font-size:16px">✕</button>`;
    row.querySelector('.remove-ex').addEventListener('click',()=>row.remove());
    list.appendChild(row);
}

// === INLINE INPUT (instead of prompt) ===
function showInlineInput(parentEl, dayTasks, callback){
    const existing = parentEl.querySelector('.inline-add');
    if(existing){ existing.querySelector('input').focus(); return; }
    const row = document.createElement('div'); row.className='inline-add task-item'; row.style.cssText='gap:8px;margin-top:10px';
    const input = document.createElement('input'); input.type='text'; input.placeholder='Название задачи';
    input.style.cssText='flex:1;background:var(--surface2);border:1px solid var(--border);color:var(--text);padding:8px 10px;border-radius:6px;font-size:13px;outline:none';
    const ok = document.createElement('button'); ok.className='btn-primary'; ok.style.cssText='padding:6px 12px;font-size:11px'; ok.textContent='✓';
    const cancel = document.createElement('button'); cancel.className='btn-icon'; cancel.style.cssText='color:var(--fail)'; cancel.textContent='✕';
    ok.addEventListener('click',()=>{if(input.value.trim()){dayTasks.push({text:input.value.trim(),done:false});saveAll();callback();}});
    cancel.addEventListener('click',()=>row.remove());
    input.addEventListener('keydown',(e)=>{if(e.key==='Enter')ok.click();if(e.key==='Escape')row.remove();});
    row.appendChild(input);row.appendChild(ok);row.appendChild(cancel);parentEl.appendChild(row);input.focus();
}

// === INIT ===
function init(){
    updateXP();
    document.querySelectorAll('.nav-btn,.mob-btn').forEach(btn=>{btn.addEventListener('click',()=>switchTab(btn.dataset.tab));});
    document.querySelectorAll('.sub-tab').forEach(btn=>{btn.addEventListener('click',()=>switchSubTab(btn.dataset.subtab));});
    document.getElementById('prevWeek').addEventListener('click',()=>{weekOffset--;renderWeek();});
    document.getElementById('nextWeek').addEventListener('click',()=>{weekOffset++;renderWeek();});
    document.getElementById('prevMonth').addEventListener('click',()=>{calMonth--;if(calMonth<0){calMonth=11;calYear--;}renderCalendar();});
    document.getElementById('nextMonth').addEventListener('click',()=>{calMonth++;if(calMonth>11){calMonth=0;calYear++;}renderCalendar();});
    document.getElementById('addWorkout').addEventListener('click',()=>{exerciseCount=0;document.getElementById('workoutName').value='';document.getElementById('exerciseList').innerHTML='';addExerciseRow();document.getElementById('workoutModal').classList.add('show');});
    document.getElementById('closeModal').addEventListener('click',()=>{document.getElementById('workoutModal').classList.remove('show');});
    document.getElementById('addExercise').addEventListener('click',addExerciseRow);
    document.getElementById('saveWorkout').addEventListener('click',()=>{
        const name=document.getElementById('workoutName').value.trim()||`Тренировка #${workouts.length+1}`;
        const rows=document.querySelectorAll('.exercise-row');const exercises=[];
        rows.forEach(row=>{const n=row.querySelector('.ex-name').value.trim();if(n){exercises.push({name:n,sets:row.querySelector('.ex-sets').value.trim()||'3',current:row.querySelector('.ex-cur').value.trim()||'0',prev:row.querySelector('.ex-prev').value.trim()||'0',done:false});}});
        if(exercises.length>0){const now=new Date();workouts.unshift({name,date:`${formatDate(now).toUpperCase()}, ${now.getFullYear()}`,exercises});saveAll();renderWorkouts();addXP(15);checkAchievements();}
        document.getElementById('workoutModal').classList.remove('show');
    });
    document.getElementById('timerStart').addEventListener('click',startTimer);
    document.getElementById('timerReset').addEventListener('click',resetTimer);
    document.getElementById('enableNotifications').addEventListener('click',enableNotifications);
    document.getElementById('exportData').addEventListener('click',exportData);
    document.getElementById('importData').addEventListener('click',()=>document.getElementById('importFile').click());
    document.getElementById('importFile').addEventListener('change',(e)=>{if(e.target.files[0])importData(e.target.files[0]);});
    document.getElementById('resetAll').addEventListener('click',()=>{if(confirm('Удалить ВСЕ данные? Это необратимо.')){localStorage.clear();location.reload();}});
    document.getElementById('addDefaultTask').addEventListener('click',()=>{
        const container = document.getElementById('defaultTasksList');
        const row = document.createElement('div'); row.className='task-item'; row.style.cssText='gap:8px';
        const input = document.createElement('input'); input.type='text'; input.placeholder='Название задачи'; input.style.cssText='flex:1;background:var(--surface2);border:1px solid var(--border);color:var(--text);padding:8px 10px;border-radius:6px;font-size:12px;outline:none';
        const ok = document.createElement('button'); ok.className='btn-primary'; ok.style.cssText='padding:6px 12px;font-size:11px'; ok.textContent='✓';
        const cancel = document.createElement('button'); cancel.className='btn-icon'; cancel.style.cssText='color:var(--fail)'; cancel.textContent='✕';
        ok.addEventListener('click',()=>{if(input.value.trim()){settings.defaultTasks.push(input.value.trim());saveAll();renderSettings();}});
        cancel.addEventListener('click',()=>row.remove());
        input.addEventListener('keydown',(e)=>{if(e.key==='Enter')ok.click();if(e.key==='Escape')row.remove();});
        row.appendChild(input);row.appendChild(ok);row.appendChild(cancel);container.appendChild(row);input.focus();
    });

    renderToday(); renderWeek(); renderState(); renderWorkouts(); renderReflection(); checkAchievements();
    if('Notification' in window && Notification.permission==='granted') setupReminders();
}
document.addEventListener('DOMContentLoaded', init);
