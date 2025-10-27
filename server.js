const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Конфигурация базы данных
const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    max: 20
});

// Проверка подключения к БД
pool.on('connect', () => {
    console.log('✅ Подключение к БД установлено');
});

pool.on('error', (err) => {
    console.error('❌ Ошибка подключения к БД:', err);
});

// Функция для обработки feedback (может быть строкой или объектом)
function parseFeedback(feedback) {
    if (!feedback) return '';
    
    // Если feedback уже строка, пытаемся распарсить как JSON
    if (typeof feedback === 'string') {
        try {
            const parsed = JSON.parse(feedback);
            return JSON.stringify(parsed, null, 2); // Красивое форматирование
        } catch (e) {
            // Если не JSON, возвращаем как есть
            return feedback;
        }
    }
    
    // Если feedback уже объект
    if (typeof feedback === 'object') {
        return JSON.stringify(feedback, null, 2);
    }
    
    return String(feedback);
}

// API endpoint для получения данных
app.post('/api/nps-data', async (req, res) => {
    const { campaignIds, date } = req.body;

    try {
        if (!campaignIds || !Array.isArray(campaignIds) || campaignIds.length === 0) {
            return res.status(400).json({ error: 'campaignIds обязателен и должен быть массивом' });
        }

        // Создаем условия для WHERE
        const campaignConditions = campaignIds.map((_, index) => `campaign_id = $${index + 1}`).join(' OR ');
        
        let query = `
            SELECT client_user_id, campaign_id, score, feedback, created_at
            FROM nps.survey
            WHERE (${campaignConditions})
        `;
        
        const params = [...campaignIds];
        let paramIndex = campaignIds.length + 1;

        // Добавляем фильтр по дате если указан
        if (date) {
            query += ` AND created_at >= $${paramIndex}`;
            params.push(date + ' 00:00:00+07');
            paramIndex++;
        }

        query += ' ORDER BY created_at DESC';

        console.log('Выполняем запрос:', query);
        console.log('Параметры:', params);

        const result = await pool.query(query, params);
        
        // Обрабатываем данные перед отправкой
        const processedData = result.rows.map(row => ({
            ...row,
            feedback: parseFeedback(row.feedback),
            score: row.score !== null ? row.score : ''
        }));

        console.log(`Найдено записей: ${processedData.length}`);
        res.json(processedData);

    } catch (error) {
        console.error('Database error:', error);
        res.status(500).json({ error: 'Ошибка базы данных: ' + error.message });
    }
});

// API endpoint для получения списка проектов с БД
app.get('/api/dynamic-projects', async (req, res) => {
    try {
        const query = `
            SELECT
                LOWER(c.client_id) as project_name,
                ARRAY_AGG(DISTINCT c.id) as campaign_ids
            FROM nps.campaign c
            WHERE c.survey_type = 'NPS'
            GROUP BY LOWER(c.client_id)
            ORDER BY project_name
        `;
        
        const result = await pool.query(query);
        
        // Преобразуем в нужный формат
        const projectsMapping = {};
        result.rows.forEach(row => {
            const projectName = row.project_name.toUpperCase();
            projectsMapping[projectName] = row.campaign_ids;
        });
        
        res.json(projectsMapping);
    } catch (error) {
        console.error('Error fetching projects:', error);
        res.status(500).json({ error: 'Ошибка загрузки проектов' });
    }
});

// API endpoint для получения информации о кампаниях проекта
app.get('/api/campaign-info', async (req, res) => {
    const { projectName } = req.query;

    try {
        if (!projectName) {
            return res.status(400).json({ error: 'projectName обязателен' });
        }

        const query = `
            SELECT
                c.id as campaign_id,
                c.domain,
                c.client_id,
                c.start_at,
                c.end_at
            FROM nps.campaign c
            WHERE LOWER(c.client_id) = LOWER($1)
            AND c.survey_type = 'NPS'
            ORDER BY c.domain, c.start_at DESC
        `;
        
        const result = await pool.query(query, [projectName]);
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching campaign info:', error);
        res.status(500).json({ error: 'Ошибка загрузки информации о кампаниях' });
    }
});

// Тестовый endpoint для проверки подключения
app.get('/api/test-db', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW() as current_time');
        res.json({ 
            success: true, 
            message: 'Подключение к БД успешно',
            time: result.rows[0].current_time
        });
    } catch (error) {
        console.error('Test DB error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка подключения к БД: ' + error.message 
        });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Обработка graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Получен сигнал завершения...');
    console.log('Завершение работы сервера...');
    
    try {
        await pool.end();
        console.log('✅ Подключение к БД закрыто');
        process.exit(0);
    } catch (error) {
        console.error('❌ Ошибка при завершении:', error);
        process.exit(1);
    }
});

app.listen(port, async () => {
    console.log(`🚀 Сервер запущен на http://localhost:${port}`);
    console.log(`📊 База данных: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);

    // Динамически загружаем проекты для отображения в консоли
    try {
        const result = await pool.query(`
            SELECT COUNT(DISTINCT LOWER(client_id)) as project_count
            FROM nps.campaign
            WHERE survey_type = 'NPS'
        `);
        console.log(`📋 Проектов в БД: ${result.rows[0].project_count}`);
    } catch (error) {
        console.log('📋 Не удалось загрузить количество проектов');
    }
});