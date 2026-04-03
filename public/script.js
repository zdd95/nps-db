let currentData = [];
let selectedProject = null;
let projectsMapping = {};
let sortField = 'created_at';
let sortOrder = 'asc';
let currentPage = 1;
let pageSize = 25;
let lastSortedData = [];
const EGOR_DESIRED_ERROR = 0.05;
const EGOR_Z_SCORE = 1.96;
let currentAnalysisDownloadActions = null;

// Данные для фильтров
let domains = [];
let selectedDomain = null;
let campaigns = [];
let selectedCampaigns = new Set();

function setDataActionButtonsDisabled(isDisabled) {
    const downloadBtn = document.getElementById('downloadBtn');
    const analyzeBtn = document.getElementById('analyzeBtn');

    if (downloadBtn) downloadBtn.disabled = isDisabled;
    if (analyzeBtn) analyzeBtn.disabled = isDisabled;
}

function setTodayDateRange() {
    const today = new Date();
    const dateFromFilter = document.getElementById('dateFromFilter');
    const dateToFilter = document.getElementById('dateToFilter');

    if (dateFromFilter) {
        dateFromFilter.valueAsDate = today;
    }

    if (dateToFilter) {
        dateToFilter.valueAsDate = today;
    }
}

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
    setDataActionButtonsDisabled(true);
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
        campaignFilter.placeholder = 'Выберите домен';
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
    document.getElementById('domainFilter').placeholder = 'Выберите проект';
    resetCampaignFilter();
}

// Сброс фильтра кампаний
function resetCampaignFilter() {
    selectedCampaigns.clear();
    document.getElementById('campaignFilter').value = '';
    document.getElementById('campaignFilter').placeholder = 'Выберите домен';
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
    document.getElementById('domainFilter').placeholder = 'Выберите проект';
    document.getElementById('campaignFilter').value = '';
    document.getElementById('campaignFilter').placeholder = 'Выберите домен';
    
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
    
    // Сбрасываем диапазон дат на сегодня
    setTodayDateRange();
    
    // Очищаем сообщения
    document.getElementById('message').innerHTML = '';
    
    // Очищаем таблицу
    document.getElementById('tableContainer').innerHTML = '';
    // Скрываем пагинацию
    const pagination = document.getElementById('paginationContainer');
    if (pagination) pagination.style.display = 'none';
    
    // Блокируем вторичные действия до новой загрузки
    setDataActionButtonsDisabled(true);
    
    // Очищаем текущие данные
    currentData = [];
    
    // Закрываем все dropdown'ы
    closeAllDropdowns();
    
    console.log('Все фильтры сброшены');
}

// Основная функция загрузки данных
async function loadData() {
    const dateFromFilter = document.getElementById('dateFromFilter').value;
    const dateToFilter = document.getElementById('dateToFilter').value;
    const messageDiv = document.getElementById('message');
    const loadingDiv = document.getElementById('loading');

    // Очистка предыдущих сообщений и данных
    messageDiv.innerHTML = '';
    document.getElementById('tableContainer').innerHTML = '';
    document.getElementById('paginationContainer').style.display = 'none';
    setDataActionButtonsDisabled(true);
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

    if (!dateFromFilter || !dateToFilter) {
        messageDiv.innerHTML = '<div class="error">Пожалуйста, выберите диапазон дат</div>';
        return;
    }

    if (dateFromFilter > dateToFilter) {
        messageDiv.innerHTML = '<div class="error">Дата "с" не может быть больше даты "по"</div>';
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
                dateFrom: dateFromFilter,
                dateTo: dateToFilter
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
        setDataActionButtonsDisabled(data.length === 0);

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
    const csvRows = [headers];

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
        csvRows.push(rowData);
    });
    
    const dateStr = new Date().toISOString().split('T')[0];
    downloadCsvRows(csvRows, `nps_data_${selectedProject}_${dateStr}.csv`);
}

// ===== Analysis Modal =====
function openAnalysisModal() {
    openAnalysisModalWithBuilder(
        'Отчет анализа данных',
        buildAnalysisReportHtml,
        {
            downloadActions: {
                csv: downloadCombinedAnalysisCsv,
                excel: downloadCombinedAnalysisExcel
            }
        }
    );
}

function openAnalysisModalWithBuilder(title, builder, options = {}) {
    if (!currentData || currentData.length === 0) {
        alert('Нет данных для анализа');
        return;
    }

    const overlay = document.getElementById('analysisModal');
    const modalTitle = document.getElementById('analysisTitle');
    const body = document.getElementById('analysisBody');
    const footer = document.getElementById('analysisFooter');
    const downloadCsvBtn = document.getElementById('analysisDownloadBtn');
    const downloadExcelBtn = document.getElementById('analysisDownloadExcelBtn');

    if (modalTitle) {
        modalTitle.textContent = title;
    }

    currentAnalysisDownloadActions = options.downloadActions || null;
    const hasDownloadActions = Boolean(
        currentAnalysisDownloadActions
        && (typeof currentAnalysisDownloadActions.csv === 'function' || typeof currentAnalysisDownloadActions.excel === 'function')
    );
    if (footer) {
        footer.classList.toggle('hidden', !hasDownloadActions);
    }
    if (downloadCsvBtn) {
        downloadCsvBtn.disabled = !(currentAnalysisDownloadActions && typeof currentAnalysisDownloadActions.csv === 'function');
    }
    if (downloadExcelBtn) {
        downloadExcelBtn.disabled = !(currentAnalysisDownloadActions && typeof currentAnalysisDownloadActions.excel === 'function');
    }

    try {
        const content = builder();
        if (typeof content === 'string') {
            body.innerHTML = content;
        } else if (content instanceof Node) {
            body.replaceChildren(content);
        } else {
            body.innerHTML = '';
        }
    } catch (err) {
        console.error('Analysis modal render error:', err);
        body.innerHTML = `<div class="error">Ошибка при формировании отчета: ${escapeHtml(err && err.message ? err.message : String(err))}</div>`;
    }

    overlay.style.display = 'flex';
}

function closeAnalysisModal() {
    const overlay = document.getElementById('analysisModal');
    const footer = document.getElementById('analysisFooter');
    const body = document.getElementById('analysisBody');

    overlay.style.display = 'none';
    currentAnalysisDownloadActions = null;

    if (footer) {
        footer.classList.add('hidden');
    }
    if (body) {
        body.innerHTML = '';
    }
}

function buildAnalysisReportHtml() {
    const defaultDataset = getDefaultAnalysisDataset();
    const egorDataset = getEgorAnalysisDataset();
    const fragment = cloneTemplate('combinedAnalysisTemplate');

    if (!fragment) {
        return `<div class="error">Не найден HTML-шаблон объединенного отчета.</div>`;
    }

    setTemplateText(fragment, 'project', defaultDataset.project);
    setTemplateText(fragment, 'domain', defaultDataset.domain);
    setTemplateText(fragment, 'period', defaultDataset.periodDisplay);
    setTemplateText(fragment, 'defaultFormula', 'Формула NPS: ((promoter − critic) / (promoter + passiv + critic)) × 100%');
    setTemplateText(
        fragment,
        'egorFormula',
        `Формулы: NPS = (promoters − detractors) / n, ошибка = Z × SE, Z = ${EGOR_Z_SCORE}, целевая ошибка = ${(EGOR_DESIRED_ERROR * 100).toFixed(0)}%`
    );

    const metricsRows = fragment.querySelector('[data-role="metricsRows"]');
    if (!metricsRows) {
        return `<div class="error">Не найден контейнер строк общей сводки.</div>`;
    }

    defaultDataset.metricsRows.forEach(row => {
        metricsRows.appendChild(createDefaultAnalysisMetricsRow(row));
    });

    const egorRows = fragment.querySelector('[data-role="egorRows"]');
    if (!egorRows) {
        return `<div class="error">Не найден контейнер строк статистической значимости.</div>`;
    }

    if (!egorDataset) {
        return `<div class="error">Нет валидных значений score для расчета статистической значимости.</div>`;
    }

    egorDataset.statsRows.forEach(row => {
        egorRows.appendChild(createEgorStatsRow(row));
    });

    const commentsSection = fragment.querySelector('[data-role="commentsSection"]');
    const commentsRows = fragment.querySelector('[data-role="commentsRows"]');

    if (!commentsSection || !commentsRows) {
        return `<div class="error">Не найден блок комментариев для основной аналитики.</div>`;
    }

    if (defaultDataset.topComments.length === 0) {
        commentsSection.remove();
    } else {
        defaultDataset.topComments.forEach(comment => {
            commentsRows.appendChild(createDefaultAnalysisCommentRow(comment));
        });
    }

    return fragment;
}

function getDefaultAnalysisDataset() {
    const period = calculateDataPeriod();
    const groupedByCampaign = groupRowsByCampaign(currentData);
    const metricsRows = [];
    let totalScores = [];
    const projectCounters = { promoter: 0, passiv: 0, critic: 0 };

    groupedByCampaign.forEach((rows, campaignId) => {
        const scores = extractValidScores(rows);
        const counters = { promoter: 0, passiv: 0, critic: 0 };

        scores.forEach(score => {
            counters[classifyNps(score)] += 1;
            projectCounters[classifyNps(score)] += 1;
        });

        totalScores = totalScores.concat(scores);

        metricsRows.push({
            label: String(campaignId),
            responses: scores.length,
            averageScore: scores.length ? calculateMean(scores) : null,
            promoter: counters.promoter,
            passiv: counters.passiv,
            critic: counters.critic,
            nps: calcNpsFromCounters(counters),
            isTotal: false
        });
    });

    metricsRows.sort((a, b) => a.label.localeCompare(b.label, 'ru'));

    if (groupedByCampaign.size > 1) {
        metricsRows.push({
            label: 'Итого по проекту',
            responses: totalScores.length,
            averageScore: totalScores.length ? calculateMean(totalScores) : null,
            promoter: projectCounters.promoter,
            passiv: projectCounters.passiv,
            critic: projectCounters.critic,
            nps: calcNpsFromCounters(projectCounters),
            isTotal: true
        });
    }

    return {
        project: selectedProject || '—',
        domain: selectedDomain || '—',
        periodDisplay: period ? `с ${period.min} по ${period.max}` : '—',
        metricsRows,
        topComments: selectTopComments(currentData, 5)
    };
}

function createDefaultAnalysisMetricsRow(row) {
    const fragment = cloneTemplate('defaultAnalysisMetricsRowTemplate');
    const rowElement = fragment ? fragment.querySelector('tr') : null;

    if (!rowElement) {
        throw new Error('Не найден HTML-шаблон строки основной аналитики.');
    }

    if (row.isTotal) {
        rowElement.classList.add('analysis-total-row');
    }

    setTemplateText(rowElement, 'label', row.label);
    setTemplateText(rowElement, 'responses', String(row.responses));
    setTemplateText(rowElement, 'averageScore', row.averageScore !== null ? row.averageScore.toFixed(2) : '—');
    setTemplateText(rowElement, 'promoter', String(row.promoter));
    setTemplateText(rowElement, 'passiv', String(row.passiv));
    setTemplateText(rowElement, 'critic', String(row.critic));
    setTemplateText(rowElement, 'nps', `${row.nps.toFixed(2)}%`);

    return rowElement;
}

function createDefaultAnalysisCommentRow(comment) {
    const fragment = cloneTemplate('defaultAnalysisCommentRowTemplate');
    const rowElement = fragment ? fragment.querySelector('tr') : null;

    if (!rowElement) {
        throw new Error('Не найден HTML-шаблон строки комментария основной аналитики.');
    }

    setTemplateText(rowElement, 'campaignId', String(comment.campaign_id || ''));
    setTemplateText(rowElement, 'category', comment.category || '');
    setTemplateText(
        rowElement,
        'score',
        comment.score !== null && comment.score !== undefined ? String(comment.score) : ''
    );
    setTemplateText(rowElement, 'email', comment.email || '');
    setTemplateText(rowElement, 'text', comment.text || '');

    return rowElement;
}

function getEgorAnalysisDataset() {
    const period = calculateDataPeriod();
    const groupedByCampaign = groupRowsByCampaign(currentData);
    const statsRows = [];

    groupedByCampaign.forEach((rows, campaignId) => {
        const scores = extractValidScores(rows);
        if (scores.length === 0) return;
        statsRows.push({
            label: String(campaignId),
            ...calculateEgorStats(scores)
        });
    });

    statsRows.sort((a, b) => a.label.localeCompare(b.label, 'ru'));

    const allScores = extractValidScores(currentData);
    if (allScores.length === 0) {
        return null;
    }

    if (groupedByCampaign.size > 1) {
        statsRows.push({
            label: 'Итого по проекту',
            ...calculateEgorStats(allScores)
        });
    }

    return {
        project: selectedProject || '—',
        domain: selectedDomain || '—',
        periodDisplay: period ? `с ${period.min} по ${period.max}` : '—',
        statsRows
    };
}

function downloadCombinedAnalysisCsv() {
    const defaultDataset = getDefaultAnalysisDataset();
    const egorDataset = getEgorAnalysisDataset();

    if (!egorDataset) {
        alert('Нет валидных данных для скачивания анализа');
        return;
    }

    const csvRows = [
        ['Параметр', 'Значение'],
        ['Проект', defaultDataset.project],
        ['Домен', defaultDataset.domain],
        ['Данные за период', defaultDataset.periodDisplay],
        [],
        ['Общая сводка'],
        ['Кампания', 'Ответов', 'promoter (9-10)', 'passiv (7-8)', 'critic (0-6)', 'Score (ср.)', 'NPS, %']
    ];

    defaultDataset.metricsRows.forEach(row => {
        csvRows.push([
            row.label,
            row.responses,
            row.promoter,
            row.passiv,
            row.critic,
            row.averageScore !== null ? row.averageScore.toFixed(2) : '—',
            `${row.nps.toFixed(2)}%`
        ]);
    });

    csvRows.push(
        [],
        ['Стат. значимость'],
        ['Кампания', 'Среднее', 'Мода', 'Ст. отклонение', 'NPS, %', 'CI нижняя, %', 'CI верхняя, %', 'Ошибка, %', 'Точность', 'Ответов дано', 'Ответов надо', 'Осталось ответов']
    );

    egorDataset.statsRows.forEach(row => {
        csvRows.push([
            row.label,
            formatEgorNumber(row.mean),
            formatEgorNumber(row.mode, 0),
            formatEgorNumber(row.stdDev),
            formatEgorPercent(row.nps),
            formatEgorPercent(row.ciLower),
            formatEgorPercent(row.ciUpper),
            formatEgorPercent(row.error),
            row.precisionOk ? 'Да' : 'Нет',
            row.responsesGiven,
            row.responsesRequired,
            row.responsesRemaining
        ]);
    });

    const dateStr = new Date().toISOString().split('T')[0];
    downloadCsvRows(csvRows, `analysis_${sanitizeFilenamePart(defaultDataset.project)}_${dateStr}.csv`);
}

function downloadCombinedAnalysisExcel() {
    const defaultDataset = getDefaultAnalysisDataset();
    const egorDataset = getEgorAnalysisDataset();

    if (!egorDataset) {
        alert('Нет валидных данных для скачивания анализа');
        return;
    }

    if (typeof XLSX === 'undefined') {
        alert('Не удалось подготовить Excel-файл. Библиотека XLSX не загружена.');
        return;
    }

    const workbook = buildCombinedAnalysisWorkbook(defaultDataset, egorDataset);
    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `analysis_${sanitizeFilenamePart(defaultDataset.project)}_${dateStr}.xlsx`, {
        compression: true
    });
}

function buildCombinedAnalysisWorkbook(defaultDataset, egorDataset) {
    const workbook = XLSX.utils.book_new();
    const metadataRows = [
        ['Проект', defaultDataset.project],
        ['Домен', defaultDataset.domain],
        ['Данные за период', defaultDataset.periodDisplay]
    ];
    const summaryRows = [
        ...metadataRows,
        [],
        ['Общая сводка'],
        ['Кампания', 'Ответов', 'promoter (9-10)', 'passiv (7-8)', 'critic (0-6)', 'Score (ср.)', 'NPS, %'],
        ...defaultDataset.metricsRows.map(row => ([
            row.label,
            row.responses,
            row.promoter,
            row.passiv,
            row.critic,
            row.averageScore !== null ? Number(row.averageScore.toFixed(2)) : '—',
            `${row.nps.toFixed(2)}%`
        ]))
    ];
    const significanceRows = [
        ...metadataRows,
        [],
        ['Стат. значимость'],
        ['Кампания', 'Среднее', 'Мода', 'Ст. отклонение', 'NPS, %', 'CI нижняя, %', 'CI верхняя, %', 'Ошибка, %', 'Точность', 'Ответов дано', 'Ответов надо', 'Осталось ответов'],
        ...egorDataset.statsRows.map(row => ([
            row.label,
            formatEgorNumber(row.mean),
            formatEgorNumber(row.mode, 0),
            formatEgorNumber(row.stdDev),
            formatEgorPercent(row.nps),
            formatEgorPercent(row.ciLower),
            formatEgorPercent(row.ciUpper),
            formatEgorPercent(row.error),
            row.precisionOk ? 'Да' : 'Нет',
            row.responsesGiven,
            row.responsesRequired,
            row.responsesRemaining
        ]))
    ];

    const summarySheet = buildAnalysisWorkbookSheet(summaryRows);
    const significanceSheet = buildAnalysisWorkbookSheet(significanceRows);

    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Общая сводка');
    XLSX.utils.book_append_sheet(workbook, significanceSheet, 'Стат. значимость');

    return workbook;
}

function buildAnalysisWorkbookSheet(rows) {
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    worksheet['!cols'] = calculateWorkbookColumnWidths(rows);
    worksheet['!rows'] = rows.map((row, rowIndex) => {
        if (rowIndex === 3) {
            return { hpt: 18 };
        }

        return { hpt: 16 };
    });
    return worksheet;
}

function calculateWorkbookColumnWidths(rows) {
    if (!rows || rows.length === 0) {
        return [];
    }

    const columnCount = Math.max(...rows.map(row => row.length));

    return Array.from({ length: columnCount }, (_, columnIndex) => {
        const maxLength = rows.reduce((length, row) => {
            const value = row[columnIndex] === undefined || row[columnIndex] === null ? '' : String(row[columnIndex]);
            return Math.max(length, value.length);
        }, 0);

        return {
            wch: Math.min(Math.max(maxLength + 2, 12), 36)
        };
    });
}

function createEgorStatsRow(row) {
    const fragment = cloneTemplate('egorAnalysisRowTemplate');
    const rowElement = fragment ? fragment.querySelector('tr') : null;

    if (!rowElement) {
        throw new Error('Не найден HTML-шаблон строки аналитики Егора.');
    }

    if (row.label === 'ALL' || row.label === 'Итого по проекту') {
        rowElement.classList.add('analysis-total-row');
    }

    setTemplateText(rowElement, 'label', row.label);
    setTemplateText(rowElement, 'mean', formatEgorNumber(row.mean));
    setTemplateText(rowElement, 'mode', formatEgorNumber(row.mode, 0));
    setTemplateText(rowElement, 'stdDev', formatEgorNumber(row.stdDev));
    setTemplateText(rowElement, 'nps', formatEgorPercent(row.nps));
    setTemplateText(rowElement, 'ciLower', formatEgorPercent(row.ciLower));
    setTemplateText(rowElement, 'ciUpper', formatEgorPercent(row.ciUpper));
    setTemplateText(rowElement, 'error', formatEgorPercent(row.error));
    setTemplateText(rowElement, 'precisionOk', row.precisionOk ? 'Да' : 'Нет');
    setTemplateText(rowElement, 'responsesGiven', String(row.responsesGiven));
    setTemplateText(rowElement, 'responsesRequired', String(row.responsesRequired));
    setTemplateText(rowElement, 'responsesRemaining', String(row.responsesRemaining));

    return rowElement;
}

function cloneTemplate(templateId) {
    const template = document.getElementById(templateId);
    return template ? template.content.cloneNode(true) : null;
}

function setTemplateText(root, role, value) {
    const element = root.querySelector(`[data-role="${role}"]`);
    if (element) {
        element.textContent = value;
    }
}

function downloadCsvRows(rows, filename) {
    const csvContent = rows
        .map(row => row.map(escapeCsvValue).join(','))
        .join('\n');

    downloadTextFile(csvContent, filename, 'text/csv;charset=utf-8;');
}

function downloadTextFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function escapeCsvValue(value) {
    if (value === null || value === undefined) return '';

    const stringValue = String(value);
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
    }

    return stringValue;
}

function sanitizeFilenamePart(value) {
    return String(value || 'report')
        .trim()
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9_-]/g, '_');
}

function groupRowsByCampaign(rows) {
    const grouped = new Map();

    rows.forEach(row => {
        const campaignId = row.campaign_id || '—';
        if (!grouped.has(campaignId)) {
            grouped.set(campaignId, []);
        }
        grouped.get(campaignId).push(row);
    });

    return grouped;
}

function extractValidScores(rows) {
    return rows
        .map(row => (typeof row.score === 'number' ? row.score : Number(row.score)))
        .filter(score => Number.isFinite(score));
}

function calculateEgorStats(scores) {
    const n = scores.length;
    const promoters = scores.filter(score => score >= 9).length;
    const detractors = scores.filter(score => score <= 6).length;
    const pProm = promoters / n;
    const pDet = detractors / n;
    const variance = pProm * (1 - pProm) + pDet * (1 - pDet) + 2 * pProm * pDet;
    const se = Math.sqrt(variance / n);
    const nps = (promoters - detractors) / n;
    const ciLower = Math.max(-1, nps - EGOR_Z_SCORE * se);
    const ciUpper = Math.min(1, nps + EGOR_Z_SCORE * se);
    const currentError = (ciUpper - ciLower) / 2;
    const requiredSampleSize = variance === 0 ? n : Math.ceil(variance / ((EGOR_DESIRED_ERROR / EGOR_Z_SCORE) ** 2));

    return {
        mean: calculateMean(scores),
        mode: calculateMode(scores),
        stdDev: calculateSampleStdDev(scores),
        nps,
        ciLower,
        ciUpper,
        error: currentError,
        precisionOk: currentError <= EGOR_DESIRED_ERROR,
        responsesGiven: n,
        responsesRequired: requiredSampleSize,
        responsesRemaining: Math.max(0, requiredSampleSize - n)
    };
}

function calculateMean(scores) {
    if (scores.length === 0) return null;
    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

function calculateMode(scores) {
    if (scores.length === 0) return null;

    const counts = new Map();
    scores.forEach(score => {
        counts.set(score, (counts.get(score) || 0) + 1);
    });

    let mode = null;
    let maxCount = -1;

    counts.forEach((count, score) => {
        if (count > maxCount || (count === maxCount && score < mode)) {
            maxCount = count;
            mode = score;
        }
    });

    return mode;
}

function calculateSampleStdDev(scores) {
    if (scores.length < 2) return null;

    const mean = calculateMean(scores);
    const squaredDiffSum = scores.reduce((sum, score) => sum + ((score - mean) ** 2), 0);

    return Math.sqrt(squaredDiffSum / (scores.length - 1));
}

function formatEgorNumber(value, digits = 2) {
    if (value === null || value === undefined || Number.isNaN(value)) return '—';
    return Number(value).toFixed(digits);
}

function formatEgorPercent(value) {
    if (value === null || value === undefined || Number.isNaN(value)) return '—';
    return `${(Number(value) * 100).toFixed(2)}%`;
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
    setTodayDateRange();

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
    const analysisDownloadBtn = document.getElementById('analysisDownloadBtn');
    const analysisDownloadExcelBtn = document.getElementById('analysisDownloadExcelBtn');
    const analysisOverlay = document.getElementById('analysisModal');

    if (analyzeBtn) analyzeBtn.addEventListener('click', openAnalysisModal);
    if (analysisCloseBtn) analysisCloseBtn.addEventListener('click', closeAnalysisModal);
    if (analysisDownloadBtn) {
        analysisDownloadBtn.addEventListener('click', function() {
            if (currentAnalysisDownloadActions && typeof currentAnalysisDownloadActions.csv === 'function') {
                currentAnalysisDownloadActions.csv();
            }
        });
    }
    if (analysisDownloadExcelBtn) {
        analysisDownloadExcelBtn.addEventListener('click', function() {
            if (currentAnalysisDownloadActions && typeof currentAnalysisDownloadActions.excel === 'function') {
                currentAnalysisDownloadActions.excel();
            }
        });
    }
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
