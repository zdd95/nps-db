let currentData = [];
let selectedProject = null;
let projectsMapping = {};
let sortField = 'created_at';
let sortOrder = 'asc';

// Загрузка проектов с сервера
async function loadProjects() {
    try {
        const response = await fetch('/api/projects');
        if (!response.ok) {
            throw new Error('Ошибка загрузки проектов');
        }
        projectsMapping = await response.json();
        initializeDropdown();
    } catch (error) {
        console.error('Error loading projects:', error);
        document.getElementById('projectsDropdown').placeholder = 'Ошибка загрузки проектов';
    }
}

// Инициализация выпадающего списка
function initializeDropdown() {
    const dropdownOptions = document.getElementById('dropdownOptions');
    const projectNames = Object.keys(projectsMapping);
    
    // Очищаем список
    dropdownOptions.innerHTML = '';
    
    projectNames.forEach(projectName => {
        const option = document.createElement('div');
        option.className = 'dropdown-option';
        option.textContent = projectName;
        option.setAttribute('data-project-name', projectName);
        
        option.addEventListener('click', function() {
            selectProject(projectName);
            closeDropdown();
        });
        
        dropdownOptions.appendChild(option);
    });
    
    // Выбираем проект по умолчанию
    if (projectNames.length > 0) {
        selectProject('Фонтанка');
    }
}

// Фильтрация проектов
function filterProjects() {
    const searchInput = document.getElementById('projectSearch');
    const searchTerm = searchInput.value.toLowerCase();
    const options = document.querySelectorAll('.dropdown-option');
    const dropdownOptions = document.getElementById('dropdownOptions');
    
    let hasVisibleOptions = false;
    
    options.forEach(option => {
        const projectName = option.getAttribute('data-project-name').toLowerCase();
        if (projectName.includes(searchTerm)) {
            option.style.display = 'block';
            hasVisibleOptions = true;
        } else {
            option.style.display = 'none';
        }
    });
    
    // Показываем сообщение если нет результатов
    const noResults = document.getElementById('noResults');
    if (!hasVisibleOptions) {
        if (!noResults) {
            const noResultsMsg = document.createElement('div');
            noResultsMsg.id = 'noResults';
            noResultsMsg.className = 'no-results';
            noResultsMsg.textContent = 'Проекты не найдены';
            dropdownOptions.appendChild(noResultsMsg);
        }
    } else if (noResults) {
        noResults.remove();
    }
}

// Переключение отображения выпадающего списка
function toggleDropdown() {
    const dropdownList = document.getElementById('dropdownList');
    const isShowing = dropdownList.classList.contains('show');
    
    if (!isShowing) {
        // Открываем dropdown
        dropdownList.classList.add('show');
        // Сбрасываем поиск при открытии
        document.getElementById('projectSearch').value = '';
        // Показываем все опции
        const options = document.querySelectorAll('.dropdown-option');
        options.forEach(option => {
            option.style.display = 'block';
        });
        // Удаляем сообщение "не найдено"
        const noResults = document.getElementById('noResults');
        if (noResults) noResults.remove();
        // Фокусируемся на поле поиска
        setTimeout(() => {
            document.getElementById('projectSearch').focus();
        }, 0);
    } else {
        closeDropdown();
    }
}

// Закрытие выпадающего списка
function closeDropdown() {
    const dropdownList = document.getElementById('dropdownList');
    dropdownList.classList.remove('show');
}

// Выбор проекта
function selectProject(projectName) {
    selectedProject = projectName;
    
    // Обновляем классы selected у опций
    const options = document.querySelectorAll('.dropdown-option');
    options.forEach(option => {
        if (option.getAttribute('data-project-name') === projectName) {
            option.classList.add('selected');
        } else {
            option.classList.remove('selected');
        }
    });
    
    // Обновляем поле ввода
    const dropdownInput = document.getElementById('projectsDropdown');
    dropdownInput.value = selectedProject;
    dropdownInput.placeholder = 'Нажмите для выбора проекта';
}

// Получение campaign_ids для выбранного проекта
function getSelectedCampaignIds() {
    return projectsMapping[selectedProject] || [];
}

async function loadData() {
    const dateFilter = document.getElementById('dateFilter').value;
    const messageDiv = document.getElementById('message');
    const loadingDiv = document.getElementById('loading');
    const downloadBtn = document.getElementById('downloadBtn');

    // Очистка предыдущих сообщений и данных
    messageDiv.innerHTML = '';
    document.getElementById('tableContainer').innerHTML = '';
    downloadBtn.disabled = true;
    currentData = [];

    if (!selectedProject) {
        messageDiv.innerHTML = '<div class="error">Пожалуйста, выберите проект</div>';
        return;
    }

    loadingDiv.style.display = 'block';

    try {
        const campaignIds = getSelectedCampaignIds();

        const response = await fetch('/api/nps-data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                campaignIds: campaignIds,
                date: dateFilter
            })
        });

        if (!response.ok) {
            throw new Error(`Ошибка сервера: ${response.status}`);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        currentData = data;

        // Автоматически сортируем данные по возрастанию даты
        sortTable();

        messageDiv.innerHTML = `<div class="success">Найдено записей: ${data.length}</div>`;
        downloadBtn.disabled = false;

    } catch (error) {
        console.error('Error:', error);
        messageDiv.innerHTML = `<div class="error"> ERROR: ${error.message}</div>`;
    } finally {
        loadingDiv.style.display = 'none';
    }
}

// Сортировка таблицы
function sortTable() {
    if (currentData.length === 0) return;

    const sortedData = [...currentData].sort((a, b) => {
        let valueA = a[sortField];
        let valueB = b[sortField];

        // Для дат преобразуем в timestamp
        if (sortField === 'created_at') {
            valueA = new Date(valueA).getTime();
            valueB = new Date(valueB).getTime();
        }

        // Для чисел
        if (sortField === 'score') {
            valueA = valueA !== null ? Number(valueA) : -Infinity;
            valueB = valueB !== null ? Number(valueB) : -Infinity;
        }
        
        // Для строк
        if (typeof valueA === 'string') {
            valueA = valueA.toLowerCase();
            valueB = valueB.toLowerCase();
        }
        
        if (valueA < valueB) return sortOrder === 'asc' ? -1 : 1;
        if (valueA > valueB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
    });
    
    displayTable(sortedData);
}

function displayTable(data) {
    const tableContainer = document.getElementById('tableContainer');
    
    if (data.length === 0) {
        tableContainer.innerHTML = '<p>Нет данных для отображения</p>';
        return;
    }

    let tableHTML = `
        <table>
            <thead>
                <tr>
                    <th onclick="sortByColumn('client_user_id')">Client User ID</th>
                    <th onclick="sortByColumn('campaign_id')">Campaign ID</th>
                    <th onclick="sortByColumn('score')">Score</th>
                    <th>Feedback</th>
                    <th onclick="sortByColumn('created_at')">Created At</th>
                </tr>
            </thead>
            <tbody>
    `;

    data.forEach((row, index) => {
        tableHTML += `
            <tr>
                <td>${escapeHtml(row.client_user_id || '')}</td>
                <td>${escapeHtml(row.campaign_id || '')}</td>
                <td>${escapeHtml(row.score !== null && row.score !== undefined ? row.score : '')}</td>
                <td class="feedback-cell">${escapeHtml(row.feedback || '')}</td>
                <td>${escapeHtml(formatDate(row.created_at))}</td>
            </tr>
        `;
    });

    tableHTML += '</tbody></table>';
    tableContainer.innerHTML = tableHTML;
    
    // Обновляем индикаторы сортировки в заголовках
    updateSortIndicators();
}

// Сортировка по клику на заголовок
function sortByColumn(column) {
    if (sortField === column) {
        // Если уже сортируем по этой колонке, меняем порядок
        sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
        // Если новая колонка, сортируем по убыванию
        sortField = column;
        sortOrder = 'desc';
    }
    
    sortTable();
}

// Обновление индикаторов сортировки в заголовках
function updateSortIndicators() {
    const headers = document.querySelectorAll('th');
    headers.forEach(header => {
        header.classList.remove('sorted-asc', 'sorted-desc');
        
        const column = header.getAttribute('onclick');
        if (column && column.includes(sortField)) {
            header.classList.add(`sorted-${sortOrder}`);
        }
    });
}

function downloadCSV() {
    if (currentData.length === 0) {
        alert('Нет данных для скачивания');
        return;
    }

    // Всегда используем ASC сортировку по дате для CSV
    const dataToExport = [...currentData].sort((a, b) => {
        let valueA = new Date(a.created_at).getTime();
        let valueB = new Date(b.created_at).getTime();
        return valueA - valueB; // ASC сортировка
    });

    // Создаем CSV заголовок
    const headers = ['client_user_id', 'campaign_id', 'score', 'feedback', 'created_at'];
    let csvContent = headers.join(',') + '\n';

    // Добавляем данные
    dataToExport.forEach(row => {
        const rowData = headers.map(header => {
            let value;
            
            if (header === 'created_at') {
                // Для даты используем формат как в DBeaver
                value = formatDateForCSV(row[header]);
            } else {
                value = row[header] || '';
            }
            
            // Для feedback обрабатываем переносы строк
            if (header === 'feedback' && value) {
                value = value.replace(/\n/g, ' ').replace(/\r/g, ' ');
            }
            
            // Экранируем кавычки и запятые
            if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
                value = `"${value.replace(/"/g, '""')}"`;
            }
            return value;
        });
        csvContent += rowData.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    
    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `nps_data_${selectedProject}_${dateStr}.csv`);
    
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function formatDate(dateString) {
    if (!dateString) return '';

    const date = new Date(dateString);

    // Форматируем как в DBeaver: 2025-10-14 10:34:05.346 +0700
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const milliseconds = String(date.getMilliseconds()).padStart(3, '0');

    // Получаем часовой пояс (+0700)
    const timezoneOffset = -date.getTimezoneOffset();
    const timezoneHours = String(Math.floor(Math.abs(timezoneOffset) / 60)).padStart(2, '0');
    const timezoneMinutes = String(Math.abs(timezoneOffset) % 60).padStart(2, '0');
    const timezoneSign = timezoneOffset >= 0 ? '+' : '-';

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds} ${timezoneSign}${timezoneHours}${timezoneMinutes}`;
}

function formatDateForCSV(dateString) {
    // Та же логика что и в formatDate
    return formatDate(dateString);
}

function escapeHtml(unsafe) {
    if (unsafe === null || unsafe === undefined) return '';
    return unsafe.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Инициализация при загрузке страницы
document.addEventListener('click', function(e) {
    const dropdown = document.querySelector('.dropdown');
    if (!dropdown.contains(e.target)) {
        closeDropdown();
    }
});
document.addEventListener('DOMContentLoaded', function() {
    loadProjects();
    // Автозаполнение текущей даты
    document.getElementById('dateFilter').valueAsDate = new Date();
});