let currentData = [];
let selectedProject = null;
let projectsMapping = {};
let sortField = 'created_at';
let sortOrder = 'asc';
let currentPage = 1;
let pageSize = 25;
let lastSortedData = [];

// Данные для фильтров
let domains = [];
let selectedDomain = null;
let campaigns = [];
let selectedCampaigns = new Set();

// Загрузка проектов с сервера
async function loadProjects() {
    try {
        const response = await fetch('/api/dynamic-projects');
        if (!response.ok) {
            throw new Error('Ошибка загрузки проектов');
        }
        projectsMapping = await response.json();
        initializeProjectDropdown();
    } catch (error) {
        console.error('Error loading projects:', error);
        document.getElementById('projectsDropdown').placeholder = 'Ошибка загрузки проектов';
    }
}

// Инициализация выпадающего списка проектов
function initializeProjectDropdown() {
    const projectOptions = document.getElementById('projectOptions');
    const projectNames = Object.keys(projectsMapping);
    
    // СОРТИРОВКА ПО АЛФАВИТУ ПО УБЫВАНИЮ (Z-A)
    const sortedProjectNames = projectNames.sort((a, b) => b.localeCompare(a));
    
    // Очищаем список
    projectOptions.innerHTML = '';
    
    // Заполняем отсортированными проектами
    sortedProjectNames.forEach(projectName => {
        const option = document.createElement('div');
        option.className = 'dropdown-option';
        option.textContent = projectName;
        option.setAttribute('data-project-name', projectName);
        
        option.addEventListener('click', function() {
            selectProject(projectName);
            closeProjectDropdown();
        });
        
        projectOptions.appendChild(option);
    });
    
    // Выбираем проект по умолчанию - FONTANKA
    const defaultProject = sortedProjectNames.find(name =>
        name.toUpperCase() === 'FONTANKA'
    ) || sortedProjectNames[0];
    
    if (defaultProject) {
        selectProject(defaultProject);
    }
}

// Выбор проекта
async function selectProject(projectName) {
    selectedProject = projectName;
    
    // Обновляем классы selected у опций
    const options = document.querySelectorAll('#projectOptions .dropdown-option');
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
    
    // Сбрасываем выбранные кампании при смене проекта
    selectedCampaigns.clear();
    updateCampaignFilterDisplay();
    
    // Загружаем домены и кампании для выбранного проекта
    await loadDomainsAndCampaigns(projectName);
    
    // Очищаем таблицу при смене проекта
    document.getElementById('tableContainer').innerHTML = '';
    // Скрываем пагинацию при смене проекта
    const pagination = document.getElementById('paginationContainer');
    if (pagination) pagination.style.display = 'none';
    document.getElementById('downloadBtn').disabled = true;
    const analyzeBtn = document.getElementById('analyzeBtn');
    if (analyzeBtn) analyzeBtn.disabled = true;
    document.getElementById('message').innerHTML = '';
    currentData = [];
}

// Загрузка доменов и кампаний для проекта
async function loadDomainsAndCampaigns(projectName) {
    try {
        const response = await fetch(`/api/campaign-info?projectName=${encodeURIComponent(projectName)}`);
        if (!response.ok) {
            throw new Error('Ошибка загрузки информации о кампаниях');
        }
        campaigns = await response.json();
        
        // Извлекаем уникальные домены
        domains = [...new Set(campaigns.map(campaign => campaign.domain))].filter(domain => domain);
        
        // Инициализируем фильтр доменов
        initializeDomainFilter();
        
    } catch (error) {
        console.error('Error loading domains and campaigns:', error);
        domains = [];
        campaigns = [];
        resetDomainFilter();
        resetCampaignFilter();
    }
}

// Инициализация фильтра доменов
function initializeDomainFilter() {
    const domainOptions = document.getElementById('domainOptions');
    const domainFilter = document.getElementById('domainFilter');
    
    domainOptions.innerHTML = '';
    
    if (domains.length === 0) {
        domainFilter.placeholder = 'Домены не найдены';
        domainFilter.value = '';
        resetCampaignFilter();
        return;
    }
    
    domains.forEach(domain => {
        const option = document.createElement('div');
        option.className = 'dropdown-option';
        option.textContent = domain;
        option.setAttribute('data-domain', domain);
        
        option.addEventListener('click', function() {
            selectDomain(domain);
            closeDomainDropdown();
        });
        
        domainOptions.appendChild(option);
    });
    
    // Выбираем первый домен по умолчанию
    selectDomain(domains[0]);
}

// Выбор домена
function selectDomain(domain) {
    selectedDomain = domain;
    const domainFilter = document.getElementById('domainFilter');
    domainFilter.value = selectedDomain;
    domainFilter.placeholder = 'Нажмите для выбора домена';
    
    // Обновляем классы selected у опций
    const options = document.querySelectorAll('#domainOptions .dropdown-option');
    options.forEach(option => {
        if (option.getAttribute('data-domain') === domain) {
            option.classList.add('selected');
        } else {
            option.classList.remove('selected');
        }
    });
    
    // Сбрасываем выбранные кампании при смене домена
    selectedCampaigns.clear();
    updateCampaignFilterDisplay();
    
    // Обновляем фильтр кампаний
    updateCampaignFilter();
}

// Обновление фильтра кампаний
function updateCampaignFilter() {
    const campaignOptions = document.getElementById('campaignOptions');
    const campaignFilter = document.getElementById('campaignFilter');
    
    // Очищаем список кампаний (кроме controls)
    const controls = campaignOptions.querySelector('.checkbox-controls');
    campaignOptions.innerHTML = '';
    if (controls) {
        campaignOptions.appendChild(controls);
    }
    
    if (!selectedDomain) {
        campaignFilter.placeholder = 'Выберите домен сначала';
        campaignFilter.value = '';
        return;
    }
    
    // Получаем кампании для выбранного домена
    const domainCampaigns = campaigns.filter(campaign => campaign.domain === selectedDomain);
    
    if (domainCampaigns.length === 0) {
        campaignFilter.placeholder = 'Кампании не найдены';
        campaignFilter.value = '';
        return;
    }
    
    // Добавляем кампании в список
    domainCampaigns.forEach(campaign => {
        const option = document.createElement('div');
        option.className = 'checkbox-option';
        option.innerHTML = `
            <input type="checkbox" id="campaign_${campaign.campaign_id}" value="${campaign.campaign_id}">
            <label for="campaign_${campaign.campaign_id}">${campaign.campaign_id}</label>
        `;
        
        const checkbox = option.querySelector('input');
        // При обновлении списка сбрасываем выбор, если домен изменился
        checkbox.checked = false;
        checkbox.addEventListener('change', function() {
            if (this.checked) {
                selectedCampaigns.add(campaign.campaign_id);
            } else {
                selectedCampaigns.delete(campaign.campaign_id);
            }
            updateCampaignFilterDisplay();
        });
        
        campaignOptions.appendChild(option);
    });
    
    // Обновляем отображение фильтра
    updateCampaignFilterDisplay();
}

// Выбрать все кампании
function selectAllCampaigns() {
    if (!selectedDomain) return;
    
    const domainCampaigns = campaigns.filter(campaign => campaign.domain === selectedDomain);
    domainCampaigns.forEach(campaign => {
        selectedCampaigns.add(campaign.campaign_id);
    });
    
    updateCampaignOptions();
    updateCampaignFilterDisplay();
}

// Сбросить все кампании
function deselectAllCampaigns() {
    selectedCampaigns.clear();
    updateCampaignOptions();
    updateCampaignFilterDisplay();
}

// Обновление отображения чекбоксов
function updateCampaignOptions() {
    const checkboxes = document.querySelectorAll('#campaignOptions input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        if (checkbox.id !== 'selectAllCampaigns') {
            checkbox.checked = false;
        }
    });
}

// Обновление отображения фильтра кампаний
function updateCampaignFilterDisplay() {
    const campaignFilter = document.getElementById('campaignFilter');
    
    if (selectedCampaigns.size === 0) {
        campaignFilter.value = '';
        campaignFilter.placeholder = 'Выберите кампании';
    } else if (selectedCampaigns.size === 1) {
        campaignFilter.value = Array.from(selectedCampaigns)[0];
    } else {
        campaignFilter.value = `Выбрано: ${selectedCampaigns.size}`;
    }
    
    // Также обновляем состояние чекбоксов
    updateCampaignOptionsState();
}

// Обновление состояния чекбоксов в списке
function updateCampaignOptionsState() {
    const checkboxes = document.querySelectorAll('#campaignOptions input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        if (checkbox.id !== 'selectAllCampaigns') {
            checkbox.checked = selectedCampaigns.has(checkbox.value);
        }
    });
}

// Сброс фильтра доменов
function resetDomainFilter() {
    selectedDomain = null;
    document.getElementById('domainFilter').value = '';
    document.getElementById('domainFilter').placeholder = 'Выберите проект сначала';
    resetCampaignFilter();
}

// Сброс фильтра кампаний
function resetCampaignFilter() {
    selectedCampaigns.clear();
    document.getElementById('campaignFilter').value = '';
    document.getElementById('campaignFilter').placeholder = 'Выберите домен сначала';
    updateCampaignOptions();
}

// Получение выбранных campaign_ids для загрузки данных
function getSelectedCampaignIds() {
    return Array.from(selectedCampaigns);
}

// Функции для работы с dropdown проектов
function toggleProjectDropdown() {
    const projectList = document.getElementById('projectList');
    const isShowing = projectList.classList.contains('show');
    
    // Закрываем все другие dropdown'ы
    closeAllDropdowns();
    
    if (!isShowing) {
        // Открываем dropdown проекта
        projectList.classList.add('show');
        // Сбрасываем поиск при открытии
        document.getElementById('projectSearch').value = '';
        // Показываем все опции
        const options = document.querySelectorAll('#projectOptions .dropdown-option');
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
    }
}

function closeProjectDropdown() {
    document.getElementById('projectList').classList.remove('show');
}

// Функции для работы с dropdown доменов
function toggleDomainDropdown() {
    const domainList = document.getElementById('domainList');
    const isShowing = domainList.classList.contains('show');
    
    // Закрываем все другие dropdown'ы
    closeAllDropdowns();
    
    if (!isShowing && domains.length > 0) {
        // Открываем dropdown доменов
        domainList.classList.add('show');
        // Сбрасываем поиск при открытии
        document.getElementById('domainSearch').value = '';
        // Показываем все опции
        const options = document.querySelectorAll('#domainOptions .dropdown-option');
        options.forEach(option => {
            option.style.display = 'block';
        });
        // Фокусируемся на поле поиска
        setTimeout(() => {
            document.getElementById('domainSearch').focus();
        }, 0);
    }
}

function closeDomainDropdown() {
    document.getElementById('domainList').classList.remove('show');
}

// Функции для работы с dropdown кампаний
function toggleCampaignDropdown() {
    const campaignList = document.getElementById('campaignList');
    const isShowing = campaignList.classList.contains('show');
    
    // Закрываем все другие dropdown'ы
    closeAllDropdowns();
    
    if (!isShowing && selectedDomain) {
        // Открываем dropdown кампаний
        campaignList.classList.add('show');
        // Сбрасываем поиск при открытии
        document.getElementById('campaignSearch').value = '';
        // Показываем все опции
        const options = document.querySelectorAll('#campaignOptions .checkbox-option');
        options.forEach(option => {
            option.style.display = 'flex';
        });
        // Фокусируемся на поле поиска
        setTimeout(() => {
            document.getElementById('campaignSearch').focus();
        }, 0);
    }
}

function closeCampaignDropdown() {
    document.getElementById('campaignList').classList.remove('show');
}

// Функция для закрытия всех dropdown'ов
function closeAllDropdowns() {
    closeProjectDropdown();
    closeDomainDropdown();
    closeCampaignDropdown();
}

// Фильтрация проектов
function filterProjects() {
    const searchInput = document.getElementById('projectSearch');
    const searchTerm = searchInput.value.toLowerCase();
    const options = document.querySelectorAll('#projectOptions .dropdown-option');
    
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
            document.getElementById('projectOptions').appendChild(noResultsMsg);
        }
    } else if (noResults) {
        noResults.remove();
    }
}

// Фильтрация доменов
function filterDomains() {
    const searchInput = document.getElementById('domainSearch');
    const searchTerm = searchInput.value.toLowerCase();
    const options = document.querySelectorAll('#domainOptions .dropdown-option');
    
    options.forEach(option => {
        const domain = option.getAttribute('data-domain').toLowerCase();
        option.style.display = domain.includes(searchTerm) ? 'block' : 'none';
    });
}

// Фильтрация кампаний
function filterCampaigns() {
    const searchInput = document.getElementById('campaignSearch');
    const searchTerm = searchInput.value.toLowerCase();
    const options = document.querySelectorAll('#campaignOptions .checkbox-option');
    
    options.forEach(option => {
        const label = option.querySelector('label');
        if (label) {
            const campaignId = label.textContent.toLowerCase();
            option.style.display = campaignId.includes(searchTerm) ? 'flex' : 'none';
        }
    });
}

// Функция сброса всех фильтров
function resetAllFilters() {
    // Сбрасываем выбранные кампании
    selectedCampaigns.clear();
    
    // Сбрасываем выбранный домен
    selectedDomain = null;
    
    // Сбрасываем поля фильтров
    document.getElementById('domainFilter').value = '';
    document.getElementById('domainFilter').placeholder = 'Выберите проект сначала';
    document.getElementById('campaignFilter').value = '';
    document.getElementById('campaignFilter').placeholder = 'Выберите домен сначала';
    
    // Сбрасываем выбранный проект (но оставляем FONTANKA по умолчанию)
    const projectNames = Object.keys(projectsMapping);
    const defaultProject = projectNames.find(name => 
        name.toUpperCase() === 'FONTANKA'
    ) || projectNames[0];
    
    if (defaultProject) {
        // Просто обновляем отображение без перезагрузки данных
        selectedProject = defaultProject;
        document.getElementById('projectsDropdown').value = defaultProject;
        
        // Загружаем домены и кампании заново
        loadDomainsAndCampaigns(defaultProject);
    }
    
    // Сбрасываем дату на сегодня
    document.getElementById('dateFilter').valueAsDate = new Date();
    
    // Очищаем сообщения
    document.getElementById('message').innerHTML = '';
    
    // Очищаем таблицу
    document.getElementById('tableContainer').innerHTML = '';
    // Скрываем пагинацию
    const pagination = document.getElementById('paginationContainer');
    if (pagination) pagination.style.display = 'none';
    
    // Блокируем кнопку скачивания
    document.getElementById('downloadBtn').disabled = true;
    const analyzeBtn = document.getElementById('analyzeBtn');
    if (analyzeBtn) analyzeBtn.disabled = true;
    
    // Очищаем текущие данные
    currentData = [];
    
    // Закрываем все dropdown'ы
    closeAllDropdowns();
    
    console.log('Все фильтры сброшены');
}

// Основная функция загрузки данных
async function loadData() {
    const dateFilter = document.getElementById('dateFilter').value;
    const messageDiv = document.getElementById('message');
    const loadingDiv = document.getElementById('loading');
    const downloadBtn = document.getElementById('downloadBtn');

    // Очистка предыдущих сообщений и данных
    messageDiv.innerHTML = '';
    document.getElementById('tableContainer').innerHTML = '';
    document.getElementById('paginationContainer').style.display = 'none';
    downloadBtn.disabled = true;
    currentData = [];
    currentPage = 1;

    if (!selectedProject) {
        messageDiv.innerHTML = '<div class="error">Пожалуйста, выберите проект</div>';
        return;
    }

    if (selectedCampaigns.size === 0) {
        messageDiv.innerHTML = '<div class="error">Пожалуйста, выберите хотя бы одну кампанию</div>';
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
        currentPage = 1;
        sortTable();

        messageDiv.innerHTML = `<div class="success">Найдено записей: ${data.length}</div>`;
        downloadBtn.disabled = false;
        const analyzeBtn = document.getElementById('analyzeBtn');
        if (analyzeBtn) analyzeBtn.disabled = data.length === 0;

    } catch (error) {
        console.error('Error:', error);
        messageDiv.innerHTML = `<div class="error">ERROR: ${error.message}</div>`;
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
    lastSortedData = sortedData;
    renderCurrentView();
}

// Функция для вычисления периода данных
function calculateDataPeriod() {
    if (!currentData || currentData.length === 0) {
        return null;
    }
    
    const dates = currentData
        .map(row => row.created_at ? new Date(row.created_at) : null)
        .filter(date => date !== null && !isNaN(date.getTime()));
    
    if (dates.length === 0) {
        return null;
    }
    
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
    
    // Форматируем даты в ДД.ММ.ГГГГ
    const formatDateForPeriod = (date) => {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}.${month}.${year}`;
    };
    
    return {
        min: formatDateForPeriod(minDate),
        max: formatDateForPeriod(maxDate)
    };
}

function displayTable(data) {
    const tableContainer = document.getElementById('tableContainer');
    
    if (data.length === 0) {
        tableContainer.innerHTML = '<p>Нет данных для отображения</p>';
        document.getElementById('paginationContainer').style.display = 'none';
        return;
    }

    // Вычисляем период данных
    const period = calculateDataPeriod();
    let periodHTML = '';
    if (period) {
        periodHTML = `<div class="data-period" style="margin-bottom: 15px; padding: 10px; background-color: #f5f5f5; border-radius: 4px; font-size: 14px;">`
                  + `<strong>Данные за период:</strong> с ${escapeHtml(period.min)} по ${escapeHtml(period.max)}`
                  + `</div>`;
    }

    let tableHTML = periodHTML + `
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
    currentPage = 1;
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
            let value = row[header];
            
            // Обрабатываем специальные случаи
            if (header === 'created_at') {
                value = formatDateForCSV(value);
            }
            
            // Для score: 0 должен остаться 0, null/undefined становятся пустой строкой
            if (header === 'score') {
                value = value !== undefined && value !== null ? value : '';
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

// ===== Analysis Modal =====
function openAnalysisModal() {
    if (!currentData || currentData.length === 0) {
        alert('Нет данных для анализа');
        return;
    }
    const overlay = document.getElementById('analysisModal');
    const body = document.getElementById('analysisBody');
    try {
        body.innerHTML = buildAnalysisReportHtml();
    } catch (err) {
        console.error('Analysis modal render error:', err);
        body.innerHTML = `<div class="error">Ошибка при формировании отчета: ${escapeHtml(err && err.message ? err.message : String(err))}</div>`;
    }
    overlay.style.display = 'flex';
}

function closeAnalysisModal() {
    const overlay = document.getElementById('analysisModal');
    overlay.style.display = 'none';
}

function buildAnalysisReportHtml() {
    const domainName = selectedDomain || '—';
    const byCampaign = new Map();
    let totalScores = [];
    const npsCountersProject = { promoter: 0, passiv: 0, critic: 0 };

    currentData.forEach(row => {
        const campaignId = row.campaign_id;
        const score = typeof row.score === 'number' ? row.score : (row.score ? Number(row.score) : null);
        if (!byCampaign.has(campaignId)) byCampaign.set(campaignId, []);
        byCampaign.get(campaignId).push(row);
        if (score !== null && !Number.isNaN(score)) {
            totalScores.push(score);
            const type = classifyNps(score);
            npsCountersProject[type] += 1;
        }
    });

    // Вычисляем период данных (минимальная и максимальная дата по created_at)
    let periodDisplay = '—';
    const period = calculateDataPeriod();
    if (period) {
        periodDisplay = `с ${period.min} по ${period.max}`;
    }

    let html = '';
    html += `<div class="analysis-header">`
          + `<div class="analysis-title"><strong>Проект:</strong> ${escapeHtml(selectedProject || '—')}</div>`
          + `<div class="analysis-title"><strong>Домен:</strong> ${escapeHtml(domainName)}</div>`
          + `<div class="analysis-title"><strong>Данные за период:</strong> ${escapeHtml(periodDisplay)}</div>`
          + `</div>`;

    byCampaign.forEach((rows, campaignId) => {
        const scores = rows.map(r => typeof r.score === 'number' ? r.score : (r.score ? Number(r.score) : null)).filter(s => s !== null && !Number.isNaN(s));
        const avg = scores.length ? (scores.reduce((a,b)=>a+b,0) / scores.length) : null;
        const npsCounters = { promoter: 0, passiv: 0, critic: 0 };
        scores.forEach(s => { npsCounters[classifyNps(s)] += 1; });
        const npsScore = calcNpsFromCounters(npsCounters);

        html += '<div class="campaign-card">';
        html += `<div class="campaign-card__header">Кампания <span class="badge">${escapeHtml(String(campaignId))}</span></div>`;
        html += '<div class="kpi-grid">';
        html += metricHtml('Средний score', avg !== null ? avg.toFixed(2) : '—');
        html += metricHtml('promoter (9-10)', String(npsCounters.promoter));
        html += metricHtml('passiv (7-8)', String(npsCounters.passiv));
        html += metricHtml('critic (0-6)', String(npsCounters.critic));
        html += metricHtml('NPS, %', `${npsScore.toFixed(2)}%`);
        html += '</div>';
        html += '</div>';
    });

    const projectAvg = totalScores.length ? (totalScores.reduce((a,b)=>a+b,0) / totalScores.length) : null;
    const projectNps = calcNpsFromCounters(npsCountersProject);
    if (byCampaign.size > 1) {
        html += `<div class="summary-box">`
             + `<div class="summary-title"><strong>Сводка по проекту</strong></div>`
             + `<div class="kpi-grid">`
             + metricHtml('Средний score по проекту', projectAvg !== null ? projectAvg.toFixed(2) : '—')
             + metricHtml('Всего promoter', String(npsCountersProject.promoter))
             + metricHtml('Всего passiv', String(npsCountersProject.passiv))
             + metricHtml('Всего critic', String(npsCountersProject.critic))
             + metricHtml('NPS проекта, %', `${projectNps.toFixed(2)}%`)
             + `</div>`
             + `<div class="formula">Формула NPS: ((promoter − critic) / (promoter + passiv + critic)) × 100%</div>`
             + `</div>`;
    } else {
        // Только формула, если выбрана одна кампания
        html += `<div class="formula">Формула NPS: ((promoter − critic) / (promoter + passiv + critic)) × 100%</div>`;
    }

    // ТОП-5 полезных комментариев по кампаниям (для любого количества кампаний)
    const topComments = selectTopComments(currentData, 5);
    if (topComments.length > 0) {
        html += `<div class="top-comments">`
             + `<h3 class="top-comments__title">ТОП‑5 комментариев</h3>`
             + `<table class="comments-table">`
             + `<thead><tr>`
             + `<th>Кампания</th><th>Категория</th><th>Score</th><th>Email</th><th>Комментарий</th>`
             + `</tr></thead><tbody>`;
        topComments.forEach(c => {
            html += `<tr>`
                 + `<td>${escapeHtml(String(c.campaign_id || ''))}</td>`
                 + `<td>${escapeHtml(c.category || '')}</td>`
                 + `<td>${escapeHtml(c.score !== null && c.score !== undefined ? String(c.score) : '')}</td>`
                 + `<td>${escapeHtml(c.email || '')}</td>`
                 + `<td class="comment-text">${escapeHtml(c.text || '')}</td>`
                 + `</tr>`;
        });
        html += `</tbody></table></div>`;
    }

    return html;
}

function metricHtml(label, value) {
    return `<div class="kpi"><div class="kpi__label">${label}</div><div class="kpi__value">${value}</div></div>`;
}

function classifyNps(score) {
    if (score >= 9) return 'promoter';
    if (score >= 7) return 'passiv';
    return 'critic';
}

function calcNpsFromCounters(counters) {
    const total = counters.promoter + counters.passiv + counters.critic;
    if (total === 0) return 0;
    return ((counters.promoter - counters.critic) / total) * 100;
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
    if (!e.target.closest('.dropdown')) {
        closeAllDropdowns();
    }
});

document.addEventListener('DOMContentLoaded', function() {
    loadProjects();
    document.getElementById('dateFilter').valueAsDate = new Date();

    // Pagination controls wiring
    const pageSizeSelect = document.getElementById('pageSizeSelect');
    const firstBtn = document.getElementById('firstPageBtn');
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    const lastBtn = document.getElementById('lastPageBtn');

    if (pageSizeSelect) {
        pageSizeSelect.value = String(pageSize);
        pageSizeSelect.addEventListener('change', function() {
            const newSize = parseInt(this.value, 10);
            if (!Number.isNaN(newSize) && newSize > 0) {
                pageSize = newSize;
                currentPage = 1;
                renderCurrentView();
            }
        });
    }

    if (firstBtn) firstBtn.addEventListener('click', function() { setPage(1); });
    if (prevBtn) prevBtn.addEventListener('click', function() { setPage(currentPage - 1); });
    if (nextBtn) nextBtn.addEventListener('click', function() { setPage(currentPage + 1); });
    if (lastBtn) lastBtn.addEventListener('click', function() { setPage(getTotalPages()); });

    // Floating scroll buttons
    const scrollFab = document.querySelector('.scroll-fab');
    const scrollUpBtn = document.getElementById('scrollUpBtn');
    const scrollDownBtn = document.getElementById('scrollDownBtn');

    function updateScrollFabVisibility() {
        const isScrollable = document.documentElement.scrollHeight > window.innerHeight + 200;
        if (scrollFab) scrollFab.classList.toggle('hidden', !isScrollable);
    }

    if (scrollUpBtn) scrollUpBtn.addEventListener('click', function() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    if (scrollDownBtn) scrollDownBtn.addEventListener('click', function() {
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
    });

    // Update visibility on load, resize, and after rendering
    updateScrollFabVisibility();
    window.addEventListener('resize', updateScrollFabVisibility);
    window.addEventListener('scroll', function() {
        // Hide "up" button near top, hide "down" near bottom
        const nearTop = window.scrollY < 100;
        const nearBottom = (window.innerHeight + window.scrollY) > (document.documentElement.scrollHeight - 100);
        if (scrollUpBtn) scrollUpBtn.style.opacity = nearTop ? '0.5' : '1';
        if (scrollDownBtn) scrollDownBtn.style.opacity = nearBottom ? '0.5' : '1';
    });

    // Expose to later calls after data rendering
    window.__updateScrollFabVisibility = updateScrollFabVisibility;

    // Modal events
    const analyzeBtn = document.getElementById('analyzeBtn');
    const analysisCloseBtn = document.getElementById('analysisCloseBtn');
    const analysisOkBtn = document.getElementById('analysisOkBtn');
    const analysisOverlay = document.getElementById('analysisModal');

    if (analyzeBtn) analyzeBtn.addEventListener('click', openAnalysisModal);
    if (analysisCloseBtn) analysisCloseBtn.addEventListener('click', closeAnalysisModal);
    if (analysisOkBtn) analysisOkBtn.addEventListener('click', closeAnalysisModal);
    if (analysisOverlay) analysisOverlay.addEventListener('click', function(e) {
        if (e.target === analysisOverlay) closeAnalysisModal();
    });
});

function renderCurrentView() {
    const total = lastSortedData.length;
    if (total === 0) {
        displayTable([]);
        return;
    }
    const totalPages = getTotalPages();
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, total);
    const pageSlice = lastSortedData.slice(startIndex, endIndex);
    displayTable(pageSlice);
    updatePaginationUI(total, totalPages);
    if (window.__updateScrollFabVisibility) window.__updateScrollFabVisibility();
}

function getTotalPages() {
    return Math.max(1, Math.ceil(currentData.length / pageSize));
}

function setPage(page) {
    const totalPages = getTotalPages();
    const newPage = Math.min(Math.max(1, page), totalPages);
    if (newPage !== currentPage) {
        currentPage = newPage;
        renderCurrentView();
    }
}

function updatePaginationUI(totalCount, totalPages) {
    const container = document.getElementById('paginationContainer');
    const pageInfo = document.getElementById('pageInfo');
    const totalCountEl = document.getElementById('totalCount');
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    const firstBtn = document.getElementById('firstPageBtn');
    const lastBtn = document.getElementById('lastPageBtn');

    if (!container) return;

    // Показать контейнер, если есть данные
    container.style.display = totalCount > 0 ? 'flex' : 'none';

    if (pageInfo) pageInfo.textContent = `Страница ${currentPage} из ${totalPages}`;
    if (totalCountEl) totalCountEl.textContent = `Всего: ${totalCount}`;

    const isFirst = currentPage === 1;
    const isLast = currentPage === totalPages;
    if (firstBtn) firstBtn.disabled = isFirst;
    if (prevBtn) prevBtn.disabled = isFirst;
    if (nextBtn) nextBtn.disabled = isLast;
    if (lastBtn) lastBtn.disabled = isLast;
}

// ===== Helpers for comments extraction =====
function selectTopComments(rows, limit) {
    const items = [];
    rows.forEach(r => {
        const scoreNum = typeof r.score === 'number' ? r.score : (r.score ? Number(r.score) : null);
        const parsed = extractFeedbackMeta(r.feedback);
        const text = parsed.text || (typeof r.feedback === 'string' ? r.feedback : '');
        const email = parsed.email || '';
        const category = parsed.category || '';
        const lengthScore = text ? text.length : 0;
        if (!text || lengthScore < 5) return;
        const typeOrder = scoreNum === null ? 1 : (scoreNum <= 6 ? 0 : (scoreNum <= 8 ? 1 : 2));
        const time = r.created_at ? new Date(r.created_at).getTime() : 0;
        items.push({
            campaign_id: r.campaign_id,
            score: scoreNum,
            email,
            category,
            text,
            typeOrder,
            lengthScore,
            time
        });
    });
    items.sort((a,b) => {
        if (a.typeOrder !== b.typeOrder) return a.typeOrder - b.typeOrder; // critics first
        if (a.lengthScore !== b.lengthScore) return b.lengthScore - a.lengthScore; // longer first
        return b.time - a.time; // newer first
    });
    return items.slice(0, limit);
}

function extractFeedbackMeta(feedback) {
    let raw = feedback;
    let obj = null;
    if (typeof raw === 'string') {
        try {
            obj = JSON.parse(raw);
        } catch (_) {
            obj = null;
        }
    } else if (typeof raw === 'object' && raw !== null) {
        obj = raw;
    }

    const get = (o, pathArr) => {
        try {
            return pathArr.reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), o);
        } catch (_) { return undefined; }
    };

    const textCandidates = [];
    const emailCandidates = [];
    const categoryCandidates = [];

    if (obj) {
        ['text','message','comment','feedback','body','content','reason'].forEach(k => {
            const v = obj[k]; if (typeof v === 'string') textCandidates.push(v);
        });
        const nestedText = get(obj, ['data','text']) || get(obj, ['payload','text']);
        if (typeof nestedText === 'string') textCandidates.push(nestedText);

        ['email','user_email','contact','userEmail'].forEach(k => {
            const v = obj[k]; if (typeof v === 'string') emailCandidates.push(v);
        });
        const nestedEmail = get(obj, ['user','email']) || get(obj, ['contact','email']);
        if (typeof nestedEmail === 'string') emailCandidates.push(nestedEmail);

        ['category','type','label','tag'].forEach(k => {
            const v = obj[k]; if (typeof v === 'string') categoryCandidates.push(v);
        });
        const nestedCategory = get(obj, ['meta','category']);
        if (typeof nestedCategory === 'string') categoryCandidates.push(nestedCategory);
    }

    const fallbackText = typeof feedback === 'string' ? feedback : '';
    const clean = s => s ? String(s).trim() : '';

    return {
        text: clean(textCandidates.find(Boolean) || fallbackText),
        email: clean(emailCandidates.find(Boolean) || ''),
        category: clean(categoryCandidates.find(Boolean) || '')
    };
}